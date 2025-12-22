const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../../config/database");
const { sendVerificationCode, sendPasswordResetLink } = require("../../config/email");


// ============================================
// YARDIMCI FONKSİYONLAR
// ============================================

// Yardımcı: SECRET'in mevcut olmasını sağlar. Production'da zorunlu, diğer ortamlarda geçici secret üretir.
let _devTempSecret = null;
function ensureSecret() {
	// Eğer zaten tanımlıysa direkt döndür
	if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

	// PROD kontrolü: yalnızca kesinlikle "production" ise hata fırlat
	// Böylece NODE_ENV undefined veya "development" gibi değerlerde fallback çalışır
	if (process.env.NODE_ENV === 'production') {
		const msg = 'JWT_SECRET tanımlı değil. Lütfen process.env.JWT_SECRET ayarlayın.';
		console.error(msg);
		throw new Error(msg);
	}

	// Production dışında (development veya test veya undefined) geçici secret üret ve process.env'e koy
	if (!_devTempSecret) {
		const crypto = require('crypto');
		_devTempSecret = crypto.randomBytes(32).toString('hex');
		console.warn('Temporary JWT_SECRET generated for development. Set JWT_SECRET in production.');
	}
	process.env.JWT_SECRET = _devTempSecret;
	return _devTempSecret;
}

// JWT Token oluştur (SECRET zorunlu, development için geçici fallback)
function generateToken(user) {
    const secret = ensureSecret(); // artık kesin secret dönecek veya hata fırlatılacak

    const payload = {
        id: user.id,
        email: user.email,
        role: user.role
    };

    try {
        return jwt.sign(payload, secret, { expiresIn: "7d", algorithm: "HS256" });
    } catch (err) {
        console.error('Token generation error:', err);
        throw err;
    }
}

// Şifre hashle
async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}

// Şifre karşılaştır
async function comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
}

// 6 haneli doğrulama kodu üret
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Doğrulama kodunu veritabanına kaydet
async function saveVerificationCode(email, code, type) {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 5 dakika geçerli
    
    try {
        // Kodu normalize et: string'e çevir, trim et, boşlukları temizle
        const normalizedCode = String(code).trim().replace(/\s+/g, '');
        
        // Önce eski kodları sil (aynı email ve type için)
        await db.execute(
            "DELETE FROM email_verification_codes WHERE email = ? AND type = ?",
            [email, type]
        );
        
        // Yeni kodu kaydet (her zaman string olarak)
        await db.execute(
            "INSERT INTO email_verification_codes (email, code, type, expires_at) VALUES (?, ?, ?, ?)",
            [email, normalizedCode, type, expiresAt]
        );
    } catch (error) {
        console.error("Verification code save error:", error);
        throw error;
    }
}

// Doğrulama kodunu kontrol et
async function verifyCode(email, code, type) {
    try {
        // Kodu normalize et: string'e çevir, trim et, boşlukları temizle
        const normalizedCode = String(code).trim().replace(/\s+/g, '');
        
        if (!normalizedCode || normalizedCode.length !== 6) {
            console.error("Verification code invalid format:", { code, normalizedCode, length: normalizedCode?.length });
            return false;
        }
        
        // Veritabanından email ve type'a göre tüm kodları çek (JavaScript'te karşılaştır)
        const allCodes = await db.query(
            `SELECT id, code, expires_at, used, created_at 
             FROM email_verification_codes 
             WHERE email = ? AND type = ? 
             ORDER BY created_at DESC`,
            [email, type]
        );
        
        if (!allCodes || allCodes.length === 0) {
            console.log("No verification codes found for:", { email, type });
            return false;
        }
        
        // En son kod ile karşılaştır (kullanılmamış ve geçerli olanı bul)
        const now = new Date();
        for (const dbCode of allCodes) {
            // Kodun geçerlilik süresini kontrol et
            const expiresAt = new Date(dbCode.expires_at);
            if (expiresAt <= now) {
                continue; // Süresi dolmuş, sonrakine bak
            }
            
            if (dbCode.used) {
                continue; // Kullanılmış, sonrakine bak
            }
            
            // Kodu string olarak karşılaştır (veritabanındaki kod INT veya VARCHAR olabilir)
            const dbCodeStr = String(dbCode.code).trim().replace(/\s+/g, '');
            
            console.log("Comparing codes:", {
                email,
                type,
                inputCode: normalizedCode,
                dbCode: dbCode.code,
                dbCodeStr: dbCodeStr,
                match: dbCodeStr === normalizedCode
            });
            
            if (dbCodeStr === normalizedCode) {
                // Kodu kullanıldı olarak işaretle
                await db.execute(
                    "UPDATE email_verification_codes SET used = TRUE WHERE id = ?",
                    [dbCode.id]
                );
                console.log("Verification code matched and marked as used:", dbCode.id);
                return true;
            }
        }
        
        console.log("Verification code not found, expired, or already used");
        return false;
    } catch (error) {
        console.error("Verification code verify error:", error);
        return false;
    }
}

// ============================================
// LOGIN ENDPOINT (GÜNCELLENDİ)
// ============================================
router.post("/login", async (req, res) => {
    const { email, password } = req.body;


    try {
        // Zorunlu alan kontrolü
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Geçersiz kimlik bilgileri."
            });
        }

        // Kullanıcıyı veritabanından bul
        let users;
        try {
            users = await db.query("SELECT id, email, password, fullname, role, two_factor_enabled FROM users WHERE email = ?", [email]);
        } catch (dbError) {
            console.error("Database query error:", dbError);
            if (dbError.code === 'ER_NO_SUCH_TABLE' || dbError.code === 'ER_BAD_FIELD_ERROR') {
                return res.status(500).json({ 
                    success: false, 
                    message: "Veritabanı yapılandırma hatası. Lütfen veritabanını kontrol edin." 
                });
            }
            throw dbError;
        }

        // Kullanıcı yoksa genel hata (gizlilik için)
        if (!users || users.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Geçersiz kimlik bilgileri."
            });
        }

        const user = users[0];

        // Şifre kontrolü
        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Geçersiz kimlik bilgileri."
            });
        }

        // 2FA kontrolü
        const twoFactorEnabled = user.two_factor_enabled === 1 || user.two_factor_enabled === true;
        if (twoFactorEnabled) {
            // 2FA kodu gönder
            const code = generateVerificationCode();
            await saveVerificationCode(user.email, code, 'two_factor');
            await sendVerificationCode(user.email, code, 'two_factor');
            
            return res.json({
                success: true,
                requires2FA: true,
                message: "Doğrulama kodu email adresinize gönderildi."
            });
        }

        // Başarılı giriş -> token oluştur ve session oluştur
        const token = generateToken(user);
        const userData = {
            id: user.id,
            email: user.email,
            fullname: user.fullname,
            role: user.role
        };

        // Eğer seller ise, seller bilgilerini de ekle
        if (user.role === 'seller') {
            try {
                const sellerInfo = await db.query(
                    "SELECT id, shop_name FROM sellers WHERE user_id = ?",
                    [user.id]
                );
                if (sellerInfo && sellerInfo.length > 0) {
                    userData.sellerId = sellerInfo[0].id;
                    userData.shopName = sellerInfo[0].shop_name;
                }
            } catch (sellerError) {
                console.error("Seller info error:", sellerError.message);
                // Seller bilgisi alınamazsa devam et, kritik değil
            }
        }

        // Eğer courier ise, courier bilgilerini de ekle
        if (user.role === 'courier') {
            try {
                // Courier bilgileri users tablosunda, courierId = user.id
                userData.courierId = user.id;
                
                // Courier'ın telefon bilgisini de ekle
                const courierInfo = await db.query(
                    "SELECT phone FROM users WHERE id = ? AND role = 'courier'",
                    [user.id]
                );
                if (courierInfo && courierInfo.length > 0) {
                    userData.phone = courierInfo[0].phone;
                }
                
            } catch (courierError) {
                console.error("Courier info error:", courierError.message);
                // Courier bilgisi alınamazsa devam et, kritik değil
                // Yine de courierId'yi ekle (user.id olarak)
                userData.courierId = user.id;
            }
        }

        // Session oluştur
        req.session.user = userData;
        req.session.isAuthenticated = true;
        

        // Session'ı kaydet ve response gönder
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({
                    success: false,
                    message: "Session oluşturulamadı."
                });
            }
            
            
            res.json({
                success: true,
                user: userData,
                token: token
            });
        });

    } catch (error) {
        console.error("Login error:", {
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: "Sunucu hatası. Giriş yapılamadı.",
            ...(process.env.NODE_ENV === 'development' && { error: error.message })
        });
    }
});

// ============================================
// REGISTER ENDPOINT
// ============================================
router.post("/register", async (req, res) => {
    // artık hem `name` hem de `fullname` alanlarını kabul ediyoruz
    const { name, fullname, email, password, role = "buyer" } = req.body;
    const displayName = (name || fullname || '').trim();


    try {
        // Validasyon
        if (!displayName || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Tüm alanlar gereklidir."
            });
        }

        // E-posta kontrolü
        let existingUsers;
        try {
            existingUsers = await db.query("SELECT id FROM users WHERE email = ?", [email]);
        } catch (dbError) {
            console.error("Database query error:", dbError);
            if (dbError.code === 'ER_NO_SUCH_TABLE' || dbError.code === 'ER_BAD_FIELD_ERROR') {
                return res.status(500).json({
                    success: false,
                    message: "Veritabanı yapılandırma hatası. Lütfen veritabanını kontrol edin."
                });
            }
            throw dbError;
        }

        if (existingUsers && existingUsers.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Bu e-posta adresi zaten kayıtlı."
            });
        }

        // Email doğrulama kodu gönder
        const code = generateVerificationCode();
        await saveVerificationCode(email, code, 'registration');
        const emailResult = await sendVerificationCode(email, code, 'registration');
        
        if (!emailResult.success) {
            return res.status(500).json({
                success: false,
                message: "Doğrulama kodu gönderilemedi. Lütfen tekrar deneyin."
            });
        }

        res.status(200).json({
            success: true,
            requiresVerification: true,
            message: "Doğrulama kodu email adresinize gönderildi. Lütfen kodu girin."
        });

    } catch (error) {
        console.error("Register error:", {
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: "Sunucu hatası. Kayıt yapılamadı.",
            ...(process.env.NODE_ENV === 'development' && { error: error.message })
        });
    }
});

// ============================================
// FORGOT PASSWORD ENDPOINT
// ============================================
router.post("/forgot-password", async (req, res) => {
    const { email } = req.body;


    try {
        // Kullanıcıyı bul
        let users;
        try {
            users = await db.query("SELECT id, email, fullname, role FROM users WHERE email = ?", [email]);
        } catch (dbError) {
            console.error("Database query error:", dbError);
            if (dbError.code === 'ER_NO_SUCH_TABLE' || dbError.code === 'ER_BAD_FIELD_ERROR') {
                return res.status(500).json({
                    success: false,
                    message: "Veritabanı yapılandırma hatası. Lütfen veritabanını kontrol edin."
                });
            }
            throw dbError;
        }

        // Kullanıcı yoksa hata mesajı döndür
        if (!users || users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Kayıtlı mail bulunamadı."
            });
        }

        const user = users[0];

        // İzin verilen roller (yalnızca bu roller için reset e-posta'sı gönder)
        const allowedRoles = ['buyer', 'seller', 'courier', 'admin'];

        if (!user.role || !allowedRoles.includes(user.role)) {
            return res.status(404).json({
                success: false,
                message: "Kayıtlı mail bulunamadı."
            });
        }

        // SECRET zorunlu kontrolü
        let secret;
        try {
            secret = ensureSecret();
        } catch (e) {
            // Secret yoksa hata döndür
            console.error("JWT Secret hatası:", e);
            return res.status(500).json({
                success: false,
                message: "Sunucu hatası. Lütfen tekrar deneyin."
            });
        }

        // Kısa ömürlü sıfırlama token'ı oluştur (örn. 1 saat)
        let resetToken;
        try {
            resetToken = jwt.sign(
                { id: user.id, email: user.email },
                secret,
                { expiresIn: "1h", algorithm: "HS256" }
            );
        } catch (err) {
            console.error("Reset token generation error:", err);
            return res.status(500).json({
                success: false,
                message: "Sunucu hatası. Lütfen tekrar deneyin."
            });
        }

        // Token'ı veritabanına kaydet
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // 1 saat geçerli
        
        await db.execute(
            "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
            [user.id, resetToken, expiresAt]
        );
        
        // Reset linki oluştur
        const resetLink = `${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}`;

        // E-posta gönderimi
        try {
            await sendPasswordResetLink(user.email, resetLink);
        } catch (mailErr) {
            console.error("Reset email send error:", mailErr);
        }

        // Başarılı - şifre sıfırlama linki gönderildi
        res.json({
            success: true,
            message: "Şifre sıfırlama linki gönderildi. Email adresinizi kontrol edin."
        });

    } catch (error) {
        console.error("Forgot password error:", {
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: "Sunucu hatası. İşlem yapılamadı.",
            ...(process.env.NODE_ENV === 'development' && { error: error.message })
        });
    }
});

// ============================================
// VERIFY EMAIL ENDPOINT (Kayıt doğrulama)
// ============================================
router.post("/verify-email", async (req, res) => {
    const { email, code, name, fullname, password, role = "buyer" } = req.body;
    const displayName = (name || fullname || '').trim();

    try {
        // Kodu normalize et
        const normalizedCode = code ? String(code).trim().replace(/\s+/g, '') : '';
        
        if (!email || !normalizedCode || !displayName || !password) {
            return res.status(400).json({
                success: false,
                message: "Tüm alanlar gereklidir."
            });
        }
        
        if (normalizedCode.length !== 6) {
            return res.status(400).json({
                success: false,
                message: "Doğrulama kodu 6 haneli olmalıdır."
            });
        }

        // Kodu doğrula
        const isValid = await verifyCode(email, normalizedCode, 'registration');
        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: "Girdiğiniz kod yanlış."
            });
        }

        // Kullanıcıyı kaydet
        const hashedPassword = await hashPassword(password);
        const result = await db.execute(
            "INSERT INTO users (email, password, fullname, role, email_verified) VALUES (?, ?, ?, ?, ?)",
            [email, hashedPassword, displayName, role, true]
        );

        const userId = result.insertId;
        const user = {
            id: userId,
            email: email,
            fullname: displayName,
            role: role
        };
        
        const token = generateToken(user);
        req.session.user = user;
        req.session.isAuthenticated = true;

        res.status(201).json({
            success: true,
            user: user,
            token: token
        });

    } catch (error) {
        console.error("Verify email error:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası. Kayıt yapılamadı."
        });
    }
});

// ============================================
// VERIFY 2FA ENDPOINT
// ============================================
router.post("/verify-2fa", async (req, res) => {
    const { email, code } = req.body;

    try {
        // Kodu normalize et
        const normalizedCode = code ? String(code).trim().replace(/\s+/g, '') : '';
        
        if (!email || !normalizedCode) {
            return res.status(400).json({
                success: false,
                message: "Email ve kod gereklidir."
            });
        }
        
        if (normalizedCode.length !== 6) {
            return res.status(400).json({
                success: false,
                message: "Doğrulama kodu 6 haneli olmalıdır."
            });
        }

        // Kodu doğrula
        const isValid = await verifyCode(email, normalizedCode, 'two_factor');
        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: "Girdiğiniz kod yanlış."
            });
        }

        // Kullanıcıyı bul
        const users = await db.query(
            "SELECT id, email, password, fullname, role FROM users WHERE email = ?",
            [email]
        );

        if (users.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Kullanıcı bulunamadı."
            });
        }

        const user = users[0];
        const token = generateToken(user);
        const userData = {
            id: user.id,
            email: user.email,
            fullname: user.fullname,
            role: user.role
        };

        // Seller bilgilerini ekle
        if (user.role === 'seller') {
            const sellerInfo = await db.query(
                "SELECT id, shop_name FROM sellers WHERE user_id = ?",
                [user.id]
            );
            if (sellerInfo && sellerInfo.length > 0) {
                userData.sellerId = sellerInfo[0].id;
                userData.shopName = sellerInfo[0].shop_name;
            }
        }

        // Courier bilgilerini ekle
        if (user.role === 'courier') {
            userData.courierId = user.id;
        }

        req.session.user = userData;
        req.session.isAuthenticated = true;

        req.session.save((err) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Session oluşturulamadı."
                });
            }
            
            res.json({
                success: true,
                user: userData,
                token: token
            });
        });

    } catch (error) {
        console.error("Verify 2FA error:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

// ============================================
// RESET PASSWORD ENDPOINT
// ============================================
router.post("/reset-password", async (req, res) => {
    const { token, password } = req.body;

    try {
        if (!token || !password) {
            return res.status(400).json({
                success: false,
                message: "Token ve yeni şifre gereklidir."
            });
        }

        // Token'ı veritabanından kontrol et
        const tokens = await db.query(
            `SELECT user_id FROM password_reset_tokens 
             WHERE token = ? AND used = FALSE AND expires_at > NOW()`,
            [token]
        );

        if (tokens.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Geçersiz veya süresi dolmuş token."
            });
        }

        const userId = tokens[0].user_id;

        // Şifreyi güncelle
        const hashedPassword = await hashPassword(password);
        await db.execute(
            "UPDATE users SET password = ? WHERE id = ?",
            [hashedPassword, userId]
        );

        // Token'ı kullanıldı olarak işaretle
        await db.execute(
            "UPDATE password_reset_tokens SET used = TRUE WHERE token = ?",
            [token]
        );

        res.json({
            success: true,
            message: "Şifreniz başarıyla sıfırlandı."
        });

    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

// ============================================
// TOGGLE 2FA ENDPOINT
// ============================================
router.put("/toggle-2fa", async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Giriş yapmanız gerekiyor."
            });
        }

        const userId = req.session.user.id;
        const { enabled } = req.body;

        await db.execute(
            "UPDATE users SET two_factor_enabled = ? WHERE id = ?",
            [enabled ? 1 : 0, userId]
        );

        res.json({
            success: true,
            message: `İki faktörlü kimlik doğrulama ${enabled ? 'açıldı' : 'kapatıldı'}.`
        });

    } catch (error) {
        console.error("Toggle 2FA error:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

// ============================================
// GET CURRENT USER ENDPOINT
// ============================================
router.get("/me", async (req, res) => {
    // Önce session kontrolü yap
    if (req.session && req.session.isAuthenticated && req.session.user) {
        
        // Kullanıcının 2FA durumunu veritabanından al
        try {
            const userInfo = await db.query(
                "SELECT two_factor_enabled FROM users WHERE id = ?",
                [req.session.user.id]
            );
            if (userInfo && userInfo.length > 0) {
                req.session.user.two_factor_enabled = userInfo[0].two_factor_enabled === 1 || userInfo[0].two_factor_enabled === true;
            }
        } catch (error) {
            console.error("2FA durumu alınamadı:", error);
        }
        
        // Eğer seller ise, seller ID'yi de ekle
        let userData = { ...req.session.user };
        if (req.session.user.role === 'seller' && !req.session.user.sellerId) {
            try {
                const sellerQuery = await db.query(
                    "SELECT id FROM sellers WHERE user_id = ?",
                    [req.session.user.id]
                );
                if (sellerQuery && sellerQuery.length > 0) {
                    userData.sellerId = sellerQuery[0].id;
                    // Session'ı da güncelle
                    req.session.user.sellerId = sellerQuery[0].id;
                }
            } catch (sellerError) {
            }
        }
        
        // Eğer courier ise, courier ID'yi de ekle
        if (req.session.user.role === 'courier' && !req.session.user.courierId) {
            try {
                // Courier bilgileri users tablosunda, courierId = user.id
                userData.courierId = req.session.user.id;
                // Session'ı da güncelle
                req.session.user.courierId = req.session.user.id;
            } catch (courierError) {
            }
        }
        
        return res.json({
            success: true,
            user: userData
        });
    }
    
    // Session yoksa JWT token kontrolü yap (geriye dönük uyumluluk için)
    const jwt = require('jsonwebtoken');
    const { getTokenFromRequest } = require('../../middleware/auth');
    const token = getTokenFromRequest(req);
    
    if (token) {
        try {
            const secret = process.env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex');
            const payload = jwt.verify(token, secret);
            const user = {
                id: payload.id || payload.userId || payload.sub,
                email: payload.email,
                fullname: payload.fullname || '',
                role: payload.role || 'buyer'
            };
            
            // Session oluştur (JWT'den session'a geçiş)
            req.session.user = user;
            req.session.isAuthenticated = true;
            
            return res.json({
                success: true,
                user: user
            });
        } catch (err) {
            // JWT token geçersiz - sessizce devam et
        }
    }
    
    // Session ve token bulunamadı - 401 döndür (normal durum, kullanıcı login olmamış)
    // Console'a log yazma, sadece 401 döndür
    res.status(401).json({
        success: false,
        message: "Kullanıcı giriş yapmamış."
    });
});

// ============================================
// LOGOUT ENDPOINT
// ============================================
router.post("/logout", (req, res) => {
    // ÖNEMLİ: Cookie'yi destroy'dan ÖNCE temizle
    // Express-session bazen cookie'yi otomatik temizlemiyor
    
    const cookieName = 'yemek-sepeti-session';
    const expireDate = new Date(0);
    const cookieOptions = {
        path: '/',
        httpOnly: true,
        secure: false
    };
    
    // 1. clearCookie ile temizle
    res.clearCookie(cookieName, cookieOptions);
    
    // 2. expires ile temizle (yedek)
    res.cookie(cookieName, '', {
        path: '/',
        httpOnly: true,
        secure: false,
        expires: expireDate,
        maxAge: 0
    });
    
    // 3. Response header'ına manuel olarak Set-Cookie ekle (en agresif yöntem)
    // Bu, tarayıcının cookie'yi kesinlikle silmesini sağlar
    // Express'te birden fazla Set-Cookie göndermek için res.append() kullanılır
    const expireDateStr = 'Thu, 01 Jan 1970 00:00:00 GMT';
    
    // Ana cookie'yi temizle (path ve expires ile)
    res.append('Set-Cookie', `${cookieName}=; Path=/; Expires=${expireDateStr}; HttpOnly; SameSite=Lax`);
    
    // Localhost için özel temizleme
    const hostname = req.get('host') || req.hostname || '';
    if (hostname === 'localhost' || hostname.includes('localhost')) {
        res.append('Set-Cookie', `${cookieName}=; Path=/; Expires=${expireDateStr}; HttpOnly; Domain=localhost; SameSite=Lax`);
    }
    
    // MaxAge ile de temizle (yedek)
    res.append('Set-Cookie', `${cookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
    
    // 5. Session'ı destroy et
    req.session.destroy((err) => {
        if (err) {
            console.error("Logout error:", err);
        }
        
        // 6. Diğer olası session cookie'lerini de temizle
        res.clearCookie('connect.sid', cookieOptions);
        res.clearCookie('session', cookieOptions);
        
        // 7. Response gönder
        res.json({
            success: true,
            message: "Başarıyla çıkış yapıldı."
        });
    });
});

module.exports = router;
