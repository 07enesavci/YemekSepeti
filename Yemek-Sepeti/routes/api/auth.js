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
		console.error('❌', msg);
		throw new Error(msg);
	}

	// Production dışında (development veya test veya undefined) geçici secret üret ve process.env'e koy
	if (!_devTempSecret) {
		const crypto = require('crypto');
		_devTempSecret = crypto.randomBytes(32).toString('hex');
		console.warn('⚠️ Development/runtime için geçici JWT_SECRET üretildi. Prod ortamında JWT_SECRET tanımlayın.');
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
        console.error('❌ Token oluşturulurken hata:', err);
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

    console.log("🔐 Login isteği alındı:", { email, password: password ? '***' : null });

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
            console.error("❌ Veritabanı sorgu hatası:", dbError);
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
            console.log("❌ Kullanıcı bulunamadı:", email);
            return res.status(400).json({
                success: false,
                message: "Geçersiz kimlik bilgileri."
            });
        }

        const user = users[0];

        // Şifre kontrolü
        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) {
            console.log("❌ Şifre hatalı:", email);
            return res.status(400).json({
                success: false,
                message: "Geçersiz kimlik bilgileri."
            });
        }

        // Başarılı giriş -> token oluştur ve döndür
        const token = generateToken(user);
        const userData = {
            id: user.id,
            email: user.email,
            fullname: user.fullname,
            role: user.role
        };

        console.log("✅ Login başarılı:", { email: user.email, role: user.role });

        res.json({
            success: true,
            user: userData,
            token: token
        });

    } catch (error) {
        console.error("❌ Login hatası - Detay:", {
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

    console.log("📝 Register isteği alındı:", { name: displayName, email, role });

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
            console.error("❌ Veritabanı sorgu hatası:", dbError);
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
            console.error("❌ Kullanıcı kaydetme hatası:", dbError);
            if (dbError.code === 'ER_NO_SUCH_TABLE' || dbError.code === 'ER_BAD_FIELD_ERROR') {
                return res.status(500).json({
                    success: false,
                    message: "Veritabanı yapılandırma hatası. Lütfen veritabanını kontrol edin."
                });
            }
            throw dbError;
        }

        const userId = result.insertId;

        // Token oluştur
        const user = {
            id: userId,
            email: email,
            fullname: displayName,
            role: role
        };
        const token = generateToken(user);

        console.log("✅ Kayıt başarılı:", { userId, email, role });

        res.status(201).json({
            success: true,
            user: user,
            token: token
        });

    } catch (error) {
        console.error("❌ Register hatası - Detay:", {
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

    console.log("🔑 Şifre sıfırlama isteği alındı:", { email });

    try {
        // Kullanıcıyı bul
        let users;
        try {
            users = await db.query("SELECT id, email, fullname, role FROM users WHERE email = ?", [email]);
        } catch (dbError) {
            console.error("❌ Veritabanı sorgu hatası:", dbError);
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
            console.log(`ℹ️ Kullanıcı bulundu fakat rolü e-posta gönderimi için uygun değil: ${user.email} (role: ${user.role})`);
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
            console.error("❌ Reset token oluşturulurken hata:", err);
            return res.json({
                success: true,
                message: "Eğer bu e-posta adresi kayıtlıysa, şifre sıfırlama bağlantısı gönderildi."
            });
        }

        // Reset linki oluştur
        const resetLink = `${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}`;

        // Sunucu tarafında logla (geliştirme/izleme amaçlı)
        console.log("✅ Şifre sıfırlama linki (sunucu logu):", resetLink);

        // E-posta gönderimi yalnızca kayıtlı ve izin verilen roller için yapılır
        try {
            await sendResetEmail(user.email, resetLink);
        } catch (mailErr) {
            console.error("❌ Reset e-postası gönderilemedi:", mailErr);
        }

        // Her durumda aynı genel mesaj dönülür; link/token asla response'a eklenmez
        res.json({
            success: true,
            message: "Eğer bu e-posta adresi kayıtlıysa, şifre sıfırlama bağlantısı gönderildi."
        });

    } catch (error) {
        console.error("❌ Forgot password hatası - Detay:", {
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
		console.log(`(Simülasyon) Reset e-postası gönderimi kapalı. To: ${toEmail}, Link: ${resetLink}`);
		return;
	}

	// TODO: Buraya nodemailer veya başka bir e-posta servisi ile gerçek gönderim ekle
	// Örnek: await transporter.sendMail({ to: toEmail, subject: 'Şifre sıfırlama', html: `<a href="${resetLink}">Sıfırla</a>` });
	console.log(`(TODO) Gerçek e-posta gönderimi yapılacak. To: ${toEmail}`);
}

module.exports = router;
