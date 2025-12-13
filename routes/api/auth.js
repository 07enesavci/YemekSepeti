const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../../config/database");

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
            users = await db.query("SELECT id, email, password, fullname, role FROM users WHERE email = ?", [email]);
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

        // Şifreyi hashle
        const hashedPassword = await hashPassword(password);

        // Kullanıcıyı kaydet
        let result;
        try {
            result = await db.execute(
                "INSERT INTO users (email, password, fullname, role) VALUES (?, ?, ?, ?)",
                [email, hashedPassword, displayName, role]
            );
        } catch (dbError) {
            console.error("User registration error:", dbError);
            if (dbError.code === 'ER_NO_SUCH_TABLE' || dbError.code === 'ER_BAD_FIELD_ERROR') {
                return res.status(500).json({
                    success: false,
                    message: "Veritabanı yapılandırma hatası. Lütfen veritabanını kontrol edin."
                });
            }
            throw dbError;
        }

        const userId = result.insertId;

        // Kullanıcı bilgilerini hazırla
        const user = {
            id: userId,
            email: email,
            fullname: displayName,
            role: role
        };
        
        // Token oluştur (geriye dönük uyumluluk için)
        const token = generateToken(user);
        
        // Session oluştur (otomatik login için)
        req.session.user = user;
        req.session.isAuthenticated = true;


        res.status(201).json({
            success: true,
            user: user,
            token: token
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

        // Güvenlik: kullanıcı yoksa da aynı genel mesajı döndür; token/link üretme veya e-posta gönderme yapılmaz
        if (!users || users.length === 0) {
            return res.json({
                success: true,
                message: "Eğer bu e-posta adresi kayıtlıysa, şifre sıfırlama bağlantısı gönderildi."
            });
        }

        const user = users[0];

        // İzin verilen roller (yalnızca bu roller için reset e-posta'sı gönder)
        const allowedRoles = ['buyer', 'seller', 'courier', 'admin'];

        if (!user.role || !allowedRoles.includes(user.role)) {
            return res.json({
                success: true,
                message: "Eğer bu e-posta adresi kayıtlıysa, şifre sıfırlama bağlantısı gönderildi."
            });
        }

        // SECRET zorunlu kontrolü
        let secret;
        try {
            secret = ensureSecret();
        } catch (e) {
            // Secret yoksa already logged inside ensureSecret; yine kullanıcıya genel mesaj dönüyoruz
            return res.json({
                success: true,
                message: "Eğer bu e-posta adresi kayıtlıysa, şifre sıfırlama bağlantısı gönderildi."
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
            return res.json({
                success: true,
                message: "Eğer bu e-posta adresi kayıtlıysa, şifre sıfırlama bağlantısı gönderildi."
            });
        }

        // Reset linki oluştur
        const resetLink = `${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}`;

        // Sunucu tarafında logla (geliştirme/izleme amaçlı)

        // E-posta gönderimi yalnızca kayıtlı ve izin verilen roller için yapılır
        try {
            await sendResetEmail(user.email, resetLink);
        } catch (mailErr) {
            console.error("Reset email send error:", mailErr);
        }

        // Her durumda aynı genel mesaj dönülür; link/token asla response'a eklenmez
        res.json({
            success: true,
            message: "Eğer bu e-posta adresi kayıtlıysa, şifre sıfırlama bağlantısı gönderildi."
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

// Yardımcı: reset e-postası gönderme (gerçek gönderim için TODO)
async function sendResetEmail(toEmail, resetLink) {
	// Eğer gerçek e-posta gönderimi istenmiyorsa ENV ile engelle
	if (process.env.SEND_EMAILS !== 'true') {
		return;
	}

	// TODO: Buraya nodemailer veya başka bir e-posta servisi ile gerçek gönderim ekle
	// Örnek: await transporter.sendMail({ to: toEmail, subject: 'Şifre sıfırlama', html: `<a href="${resetLink}">Sıfırla</a>` });
}

// ============================================
// GET CURRENT USER ENDPOINT
// ============================================
router.get("/me", async (req, res) => {
    // Önce session kontrolü yap
    if (req.session && req.session.isAuthenticated && req.session.user) {
        
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
    // Session'ı temizle
    req.session.destroy((err) => {
        if (err) {
            console.error("Logout error:", err);
            return res.status(500).json({
                success: false,
                message: "Çıkış yapılırken bir hata oluştu."
            });
        }
        
        // Tüm session cookie'lerini temizle
        res.clearCookie('connect.sid', { path: '/' }); // Express-session cookie
        res.clearCookie('session', { path: '/' }); // Genel session cookie (varsa)
        
        res.json({
            success: true,
            message: "Başarıyla çıkış yapıldı."
        });
    });
});

module.exports = router;
