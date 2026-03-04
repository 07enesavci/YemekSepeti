const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const db = require("../../config/database");
const { User, EmailVerificationCode, Seller } = require("../../models");
const { Op } = require("sequelize");
const { sendVerificationCode, sendPasswordResetLink } = require("../../config/email");

// --- MULTER YAPILANDIRMASI (DOSYA YÜKLEME) ---
const uploadDir = 'public/uploads/merchants';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// --- YARDIMCI FONKSİYONLAR ---
let _devTempSecret = null;
function ensureSecret() {
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET tanımlı değil.');
    }
    if (!_devTempSecret) {
        _devTempSecret = require('crypto').randomBytes(32).toString('hex');
    }
    process.env.JWT_SECRET = _devTempSecret;
    return _devTempSecret;
}

function generateToken(user) {
    const secret = ensureSecret();
    const payload = { id: user.id, email: user.email, role: user.role };
    return jwt.sign(payload, secret, { expiresIn: "7d", algorithm: "HS256" });
}

async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}

async function comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
}

function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function saveVerificationCode(email, code, type) {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);
    const normalizedCode = String(code).trim().replace(/\s+/g, '');
    await EmailVerificationCode.destroy({ where: { email: email, type: type } });
    await EmailVerificationCode.create({
        email: email,
        code: normalizedCode,
        type: type,
        expires_at: expiresAt,
        used: false
    });
}

async function verifyCode(email, code, type) {
    const normalizedCode = String(code).trim().replace(/\s+/g, '');
    const dbCode = await EmailVerificationCode.findOne({
        where: { email: email, code: normalizedCode, type: type, used: false, expires_at: { [Op.gt]: new Date() } }
    });
    if (dbCode) {
        await dbCode.update({ used: true });
        return true;
    }
    return false;
}

// --- ROTALAR ---

// LOGIN (Değişmedi)
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ where: { email } });
        if (!user || !(await comparePassword(password, user.password))) {
            return res.status(401).json({ success: false, message: "Hatalı e-posta veya şifre." });
        }
        const token = generateToken(user);
        const userData = { id: user.id, email: user.email, fullname: user.fullname, role: user.role };
        
        req.session.user = userData;
        req.session.isAuthenticated = true;
        res.json({ success: true, user: userData, token });
    } catch (error) {
        res.status(500).json({ success: false, message: "Giriş hatası." });
    }
});

// REGISTER (Önce kod gönderir)
router.post("/register", async (req, res) => {
    const { email } = req.body;
    try {
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) return res.status(400).json({ success: false, message: "Bu e-posta kayıtlı." });

        const code = generateVerificationCode();
        await saveVerificationCode(email, code, 'registration');
        await sendVerificationCode(email, code, 'registration');
        
        res.json({ success: true, requiresVerification: true, message: "Kod gönderildi." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Kayıt başlatılamadı." });
    }
});

// VERIFY EMAIL & FINALIZE REGISTER (Dosyalar burada kaydedilir)
router.post("/verify-email", upload.fields([
    { name: 'taxPlate', maxCount: 1 },
    { name: 'idCard', maxCount: 1 },
    { name: 'activityCert', maxCount: 1 },
    { name: 'businessLicense', maxCount: 1 }
]), async (req, res) => {
    const { email, code, fullname, password, role = "buyer" } = req.body;

    try {
        const isValid = await verifyCode(email, code, 'registration');
        if (!isValid) return res.status(400).json({ success: false, message: "Geçersiz veya süresi dolmuş kod." });

        const hashedPassword = await hashPassword(password);
        const user = await User.create({
            email,
            password: hashedPassword,
            fullname,
            role,
            email_verified: true
        });

        const userData = { id: user.id, email, fullname, role };

        // --- SATICI İSE BELGELERİ SELLER TABLOSUNA YAZ ---
        if (role === 'seller') {
            const getPath = (name) => req.files[name] ? `/uploads/merchants/${req.files[name][0].filename}` : null;
            
            const seller = await Seller.create({
                user_id: user.id,
                shop_name: fullname + "'nın Mutfağı",
                is_active: false, // Onay bekliyor
                // Veritabanı sütun isimlerinizle eşleşmeli:
                tax_plate: getPath('taxPlate'),
                id_card: getPath('idCard'),
                activity_cert: getPath('activityCert'),
                business_license: getPath('businessLicense')
            });
            userData.sellerId = seller.id;
        }

        const token = generateToken(user);
        req.session.user = userData;
        req.session.isAuthenticated = true;

        res.status(201).json({ success: true, user: userData, token });
    } catch (error) {
        console.error("Kayıt Hatası:", error);
        res.status(500).json({ success: false, message: "Kayıt tamamlanamadı." });
    }
});

// Şifre Sıfırlama
router.post("/forgot-password", async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            // Güvenlik: kullanıcı var mı belli etme
            return res.json({ success: true, message: "Eğer bu e-posta kayıtlıysa sıfırlama bağlantısı gönderildi." });
        }
        const token = generateToken(user);
        const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
        const resetLink = `${baseUrl}/reset-password?token=${token}`;
        await sendPasswordResetLink(email, resetLink);
        res.json({ success: true, message: "Şifre sıfırlama bağlantısı gönderildi." });
    } catch (error) {
        console.error('Forgot password hatası:', error);
        res.status(500).json({ success: false, message: "İşlem sırasında hata oluştu." });
    }
});

// Mevcut Kullanıcı Bilgisi
router.get("/me", async (req, res) => {
    try {
        if (req.session && req.session.user && req.session.isAuthenticated) {
            const user = req.session.user;
            return res.json({
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    fullname: user.fullname,
                    role: user.role,
                    sellerId: user.sellerId || null,
                    courierId: user.courierId || user.id
                }
            });
        }
        return res.status(401).json({ success: false, message: "Oturum bulunamadı." });
    } catch (error) {
        console.error('Me endpoint hatası:', error);
        return res.status(500).json({ success: false, message: "Sunucu hatası." });
    }
});

// Çıkış
router.post("/logout", (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destroy hatası:', err);
                return res.status(500).json({ success: false, message: "Çıkış yapılırken hata oluştu." });
            }
            res.clearCookie('connect.sid');
            res.clearCookie('yemek-sepeti-session');
            res.json({ success: true, message: "Başarıyla çıkış yapıldı." });
        });
    } catch (error) {
        console.error('Logout hatası:', error);
        res.status(500).json({ success: false, message: "Çıkış yapılırken hata oluştu." });
    }
});

module.exports = router;