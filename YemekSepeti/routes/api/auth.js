const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../../config/database");
const { User, EmailVerificationCode, Seller } = require("../../models");
const { Op } = require("sequelize");
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

// Doğrulama kodunu veritabanına kaydet (Sequelize)
async function saveVerificationCode(email, code, type) {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 5 dakika geçerli
    
    try {
        // Kodu normalize et: string'e çevir, trim et, boşlukları temizle
        const normalizedCode = String(code).trim().replace(/\s+/g, '');
        
        // Önce eski kodları sil (aynı email ve type için)
        await EmailVerificationCode.destroy({
            where: {
                email: email,
                type: type
            }
        });
        
        // Yeni kodu kaydet
        await EmailVerificationCode.create({
            email: email,
            code: normalizedCode,
            type: type,
            expires_at: expiresAt,
            used: false
        });
    } catch (error) {
        console.error("Verification code save error:", error);
        throw error;
    }
}

// Doğrulama kodunu kontrol et (Sequelize)
async function verifyCode(email, code, type) {
    try {
        // Kodu normalize et: string'e çevir, trim et, boşlukları temizle
        const normalizedCode = String(code).trim().replace(/\s+/g, '');
        
        if (!normalizedCode || normalizedCode.length !== 6) {
            console.error("Verification code invalid format:", { code, normalizedCode, length: normalizedCode?.length });
            return false;
        }
        
        // Veritabanından email ve type'a göre tüm kodları çek
        const allCodes = await EmailVerificationCode.findAll({
            where: {
                email: email,
                type: type
            },
            order: [['created_at', 'DESC']]
        });
        
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
            
            // Kodu string olarak karşılaştır
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
                await dbCode.update({ used: true });
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

        // Kullanıcıyı veritabanından bul (Sequelize)
        let user;
        try {
            user = await User.findOne({
                where: { email: email },
                attributes: ['id', 'email', 'password', 'fullname', 'role', 'two_factor_enabled', 'phone']
            });

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "Geçersiz kimlik bilgileri."
                });
            }
        } catch (dbError) {
            console.error("Database query error:", dbError);
            return res.status(500).json({ 
                success: false, 
                message: "Veritabanı yapılandırma hatası. Lütfen veritabanını kontrol edin." 
            });
        }

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

        // Eğer seller ise, seller bilgilerini de ekle (Sequelize)
        if (user.role === 'seller') {
            try {
                const { Seller } = require("../../models");
                const sellerInfo = await Seller.findOne({
                    where: { user_id: user.id },
                    attributes: ['id', 'shop_name']
                });
                if (sellerInfo) {
                    userData.sellerId = sellerInfo.id;
                    userData.shopName = sellerInfo.shop_name;
                }
            } catch (sellerError) {
                console.error("Seller info error:", sellerError.message);
                // Seller bilgisi alınamazsa devam et, kritik değil
            }
        }

        // Eğer courier ise, courier bilgilerini de ekle
        if (user.role === 'courier') {
            // Courier bilgileri users tablosunda, courierId = user.id
            userData.courierId = user.id;
            if (user.phone) {
                userData.phone = user.phone;
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

        // E-posta kontrolü (Sequelize)
        try {
            const existingUser = await User.findOne({
                where: { email: email },
                attributes: ['id']
            });

            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: "Bu e-posta adresi zaten kayıtlı."
                });
            }
        } catch (dbError) {
            console.error("Database query error:", dbError);
            return res.status(500).json({
                success: false,
                message: "Veritabanı yapılandırma hatası. Lütfen veritabanını kontrol edin."
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
        // Kullanıcıyı bul (Sequelize)
        const user = await User.findOne({
            where: { email: email },
            attributes: ['id', 'email', 'fullname', 'role']
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Kayıtlı mail bulunamadı."
            });
        }

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

        // Token'ı veritabanına kaydet (User modelinde password_reset_token ve password_reset_expires alanlarını kullan)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // 1 saat geçerli
        
        await user.update({
            password_reset_token: resetToken,
            password_reset_expires: expiresAt
        });
        
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

        // Kullanıcıyı kaydet (Sequelize)
        const hashedPassword = await hashPassword(password);
        const user = await User.create({
            email: email,
            password: hashedPassword,
            fullname: displayName,
            role: role,
            email_verified: true
        });
        
        const userData = {
            id: user.id,
            email: user.email,
            fullname: user.fullname,
            role: user.role
        };
        
        // Eğer seller ise, seller kaydı oluştur (Sequelize)
        if (role === 'seller') {
            try {
                const seller = await Seller.create({
                    user_id: user.id,
                    shop_name: `${displayName}'nın Mutfağı`,
                    location: 'İstanbul',
                    is_active: true
                });
                userData.sellerId = seller.id;
                console.log(`✅ Seller kaydı oluşturuldu - User ID: ${user.id}, Seller ID: ${seller.id}`);
            } catch (sellerError) {
                console.error("❌ Seller kaydı oluşturma hatası:", sellerError);
                // Seller kaydı oluşturulamazsa kullanıcıyı sil
                await user.destroy();
                return res.status(500).json({
                    success: false,
                    message: "Satıcı kaydı oluşturulurken bir hata oluştu."
                });
            }
        }
        
        // Eğer courier ise, courierId = user.id (courier bilgileri users tablosunda)
        if (role === 'courier') {
            userData.courierId = user.id;
        }
        
        const token = generateToken(userData);
        req.session.user = userData;
        req.session.isAuthenticated = true;

        res.status(201).json({
            success: true,
            user: userData,
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

        // Kullanıcıyı bul (Sequelize)
        const user = await User.findOne({
            where: { email: email },
            attributes: ['id', 'email', 'password', 'fullname', 'role']
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Kullanıcı bulunamadı."
            });
        }
        const userData = {
            id: user.id,
            email: user.email,
            fullname: user.fullname,
            role: user.role
        };

        // Seller bilgilerini ekle (Sequelize)
        if (user.role === 'seller') {
            try {
                const sellerInfo = await Seller.findOne({
                    where: { user_id: user.id },
                    attributes: ['id', 'shop_name']
                });
                if (sellerInfo) {
                    userData.sellerId = sellerInfo.id;
                    userData.shopName = sellerInfo.shop_name;
                }
            } catch (sellerError) {
                console.error("Seller info error:", sellerError.message);
            }
        }

        // Courier bilgilerini ekle
        if (user.role === 'courier') {
            userData.courierId = user.id;
        }

        const token = generateToken(userData);

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

        // Token'ı veritabanından kontrol et (User modelindeki password_reset_token alanını kullan)
        const user = await User.findOne({
            where: {
                password_reset_token: token,
                password_reset_expires: {
                    [Op.gt]: new Date() // expires_at > NOW()
                }
            },
            attributes: ['id']
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Geçersiz veya süresi dolmuş token."
            });
        }

        // Şifreyi güncelle ve token'ı temizle
        const hashedPassword = await hashPassword(password);
        await user.update({
            password: hashedPassword,
            password_reset_token: null,
            password_reset_expires: null
        });

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

        // 2FA durumunu güncelle (Sequelize)
        await User.update(
            { two_factor_enabled: enabled },
            { where: { id: userId } }
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
        
        // Kullanıcının 2FA durumunu veritabanından al (Sequelize)
        try {
            const userInfo = await User.findByPk(req.session.user.id, {
                attributes: ['two_factor_enabled']
            });
            if (userInfo) {
                req.session.user.two_factor_enabled = userInfo.two_factor_enabled === true || userInfo.two_factor_enabled === 1;
            }
        } catch (error) {
            console.error("2FA durumu alınamadı:", error);
        }
        
        // Eğer seller ise, seller ID'yi de ekle (Sequelize)
        let userData = { ...req.session.user };
        if (req.session.user.role === 'seller' && !req.session.user.sellerId) {
            try {
                const sellerInfo = await Seller.findOne({
                    where: { user_id: req.session.user.id },
                    attributes: ['id']
                });
                if (sellerInfo) {
                    userData.sellerId = sellerInfo.id;
                    // Session'ı da güncelle
                    req.session.user.sellerId = sellerInfo.id;
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
