const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const db = require("../../config/database");
const { User, EmailVerificationCode, Seller, Courier } = require("../../models");
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
        if (user.role === 'seller') {
            const seller = await Seller.findOne({ where: { user_id: user.id } });
            if (seller) {
                userData.sellerId = seller.id;
                userData.sellerApproved = !!seller.is_active;
            } else {
                userData.sellerApproved = false;
            }
        } else if (user.role === 'courier') {
            const courier = await Courier.findOne({ where: { user_id: user.id } });
            if (courier) {
                userData.courierId = courier.id;
                userData.courierApproved = !!courier.is_active;
            } else {
                userData.courierApproved = false;
            }
        }
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

// VERIFY EMAIL & HESAP OLUŞTUR (3. adım: belgeler ayrı sayfada)
router.post("/verify-email", async (req, res) => {
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
        const token = generateToken(user);
        req.session.user = userData;
        req.session.isAuthenticated = true;

        if (role === 'seller' || role === 'courier') {
            return res.status(201).json({
                success: true,
                user: userData,
                token,
                needsDocuments: true,
                redirectUrl: '/register/documents'
            });
        }

        res.status(201).json({ success: true, user: userData, token });
    } catch (error) {
        console.error("Kayıt Hatası:", error);
        res.status(500).json({ success: false, message: "Kayıt tamamlanamadı." });
    }
});

// BELGE YÜKLE (Satıcı/Kurye — 3. adım, giriş yapmış kullanıcı)
const docsUploadDir = 'public/uploads/merchants';
if (!fs.existsSync(docsUploadDir)) fs.mkdirSync(docsUploadDir, { recursive: true });
const documentStorage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, docsUploadDir); },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname || ''));
    }
});
router.post("/submit-documents", multer({ storage: documentStorage }).fields([
    { name: 'taxPlate', maxCount: 1 },
    { name: 'idCard', maxCount: 1 },
    { name: 'activityCert', maxCount: 1 },
    { name: 'businessLicense', maxCount: 1 },
    { name: 'driverLicense', maxCount: 1 }
]), async (req, res) => {
    try {
        if (!req.session || !req.session.user || !req.session.isAuthenticated) {
            return res.status(401).json({ success: false, message: "Oturum bulunamadı. Lütfen giriş yapın." });
        }
        const { role } = req.session.user;
        const userId = req.session.user.id;
        const files = req.files || {};
        const getPath = (name) => (files[name] && files[name][0]) ? `/uploads/merchants/${path.basename(files[name][0].path)}` : null;

        if (role === 'seller') {
            const existing = await Seller.findOne({ where: { user_id: userId } });
            if (existing) return res.status(400).json({ success: false, message: "Belgeler zaten gönderildi." });
            const user = await User.findByPk(userId);
            if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
            const taxPlate = getPath('taxPlate');
            const idCard = getPath('idCard');
            const activityCert = getPath('activityCert');
            const businessLicense = getPath('businessLicense');
            if (!taxPlate || !idCard || !activityCert || !businessLicense) {
                return res.status(400).json({ success: false, message: "Satıcı için 4 belge zorunludur." });
            }
            const seller = await Seller.create({
                user_id: userId,
                shop_name: user.fullname + "'nın Mutfağı",
                location: 'Belirtilmedi',
                is_active: false,
                tax_plate: taxPlate,
                id_card: idCard,
                activity_cert: activityCert,
                business_license: businessLicense
            });
            req.session.user.sellerId = seller.id;
            req.session.user.sellerApproved = false;
            return res.status(201).json({ success: true, redirectUrl: '/seller/pending-approval' });
        }

        if (role === 'courier') {
            const existing = await Courier.findOne({ where: { user_id: userId } });
            if (existing) return res.status(400).json({ success: false, message: "Belgeler zaten gönderildi." });
            const idCard = getPath('idCard');
            const driverLicense = getPath('driverLicense');
            if (!idCard || !driverLicense) {
                return res.status(400).json({ success: false, message: "Kurye için Kimlik ve Ehliyet belgeleri zorunludur." });
            }
            const courier = await Courier.create({
                user_id: userId,
                id_card: idCard,
                driver_license: driverLicense,
                is_active: false
            });
            req.session.user.courierId = courier.id;
            req.session.user.courierApproved = false;
            return res.status(201).json({ success: true, redirectUrl: '/courier/pending-approval' });
        }

        return res.status(403).json({ success: false, message: "Bu işlem sadece satıcı veya kurye için geçerlidir." });
    } catch (error) {
        console.error("Belge yükleme hatası:", error);
        res.status(500).json({ success: false, message: "Belgeler yüklenemedi." });
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
            let sellerApproved = null;
            let courierApproved = null;
            if (user.role === 'seller' && user.sellerId) {
                const seller = await Seller.findByPk(user.sellerId);
                sellerApproved = !!(seller && seller.is_active);
            }
            if (user.role === 'courier') {
                const { Courier } = require("../../models");
                const courier = await Courier.findOne({ where: { user_id: user.id } });
                courierApproved = !!(courier && courier.is_active);
            }
            return res.json({
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    fullname: user.fullname,
                    role: user.role,
                    sellerId: user.sellerId || null,
                    courierId: user.courierId || user.id,
                    sellerApproved,
                    courierApproved
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