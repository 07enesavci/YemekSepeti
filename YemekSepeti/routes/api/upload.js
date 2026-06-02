const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { requireRole, requireSellerApproved } = require("../../middleware/auth");

const uploadsDir = path.join(__dirname, "../../public/uploads");
const sellersDir = path.join(uploadsDir, "sellers");

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(sellersDir)) fs.mkdirSync(sellersDir, { recursive: true });

// İzin verilen resim formatlarının magic bytes imzaları
const IMAGE_SIGNATURES = [
    { ext: 'jpg',  magic: [0xFF, 0xD8, 0xFF] },
    { ext: 'png',  magic: [0x89, 0x50, 0x4E, 0x47] },
    { ext: 'gif',  magic: [0x47, 0x49, 0x46, 0x38] },
    { ext: 'webp', magic: [0x52, 0x49, 0x46, 0x46], offset: 0, secondCheck: [0x57, 0x45, 0x42, 0x50], secondOffset: 8 }
];

function checkMagicBytes(filePath) {
    try {
        const fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(12);
        fs.readSync(fd, buf, 0, 12, 0);
        fs.closeSync(fd);

        for (const sig of IMAGE_SIGNATURES) {
            const offset = sig.offset || 0;
            const magic = sig.magic;
            let match = true;
            for (let i = 0; i < magic.length; i++) {
                if (buf[offset + i] !== magic[i]) { match = false; break; }
            }
            if (match) {
                // WEBP için ek kontrol
                if (sig.secondCheck) {
                    let second = true;
                    for (let i = 0; i < sig.secondCheck.length; i++) {
                        if (buf[sig.secondOffset + i] !== sig.secondCheck[i]) { second = false; break; }
                    }
                    if (!second) continue;
                }
                return true;
            }
        }
        return false;
    } catch (_) {
        return false;
    }
}

// Güvenli rastgele dosya adı (tahmin edilemez)
function safeFilename(fieldName, originalExt) {
    const rand = crypto.randomBytes(16).toString('hex');
    const ts = Date.now();
    return `${fieldName}_${ts}_${rand}${originalExt}`;
}

const ALLOWED_MIMETYPES = /^image\/(jpeg|jpg|png|gif|webp)$/i;
const ALLOWED_EXTS = /\.(jpeg|jpg|png|gif|webp)$/i;

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, sellersDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, safeFilename(file.fieldname, ext));
    }
});

const fileFilter = (req, file, cb) => {
    const extOk = ALLOWED_EXTS.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = ALLOWED_MIMETYPES.test(file.mimetype);
    if (extOk && mimeOk) return cb(null, true);
    cb(new Error('Sadece resim dosyaları yüklenebilir (jpeg, jpg, png, gif, webp)'));
};

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter
});

// Magic bytes doğrulaması yapan post-upload middleware
function verifyUploadedFile(req, res, next) {
    if (!req.file) return next();
    if (!checkMagicBytes(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch (_) {}
        return res.status(400).json({ success: false, message: 'Yüklenen dosya geçerli bir resim değil.' });
    }
    next();
}

function handleUploadError(err, req, res, next) {
    if (req.file && req.file.path) {
        try { fs.unlinkSync(req.file.path); } catch (_) {}
    }
    if (err && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'Dosya boyutu 5MB\'ı aşamaz.' });
    }
    if (err) {
        return res.status(400).json({ success: false, message: err.message || 'Dosya yükleme hatası.' });
    }
    next();
}

async function moveToSellerDir(sellerId, file) {
    const sellerUploadDir = path.join(sellersDir, String(sellerId));
    if (!fs.existsSync(sellerUploadDir)) fs.mkdirSync(sellerUploadDir, { recursive: true });
    const newPath = path.join(sellerUploadDir, file.filename);
    try { fs.renameSync(file.path, newPath); } catch (_) {}
    return `/uploads/sellers/${sellerId}/${file.filename}`;
}

function deleteOldFile(oldUrl) {
    if (!oldUrl) return;
    try {
        const oldFilePath = path.join(__dirname, '../../public', oldUrl);
        if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
    } catch (_) {}
}

router.post("/seller/logo", requireRole('seller'), requireSellerApproved,
    (req, res, next) => upload.single('logo')(req, res, err => err ? handleUploadError(err, req, res, next) : next()),
    verifyUploadedFile,
    async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ success: false, message: "Logo dosyası yüklenmedi." });
            const userId = req.session.user.id;
            const { Seller } = require('../../models');
            const sellerRecord = await Seller.findOne({ where: { user_id: userId }, attributes: ['id', 'logo_url'] });
            if (!sellerRecord) {
                try { fs.unlinkSync(req.file.path); } catch (_) {}
                return res.status(404).json({ success: false, message: 'Satıcı kaydı bulunamadı.' });
            }
            const fileUrl = await moveToSellerDir(sellerRecord.id, req.file);
            deleteOldFile(sellerRecord.logo_url);
            await Seller.update({ logo_url: fileUrl }, { where: { id: sellerRecord.id } });
            res.json({ success: true, message: "Logo başarıyla yüklendi.", url: fileUrl });
        } catch (error) {
            if (req.file && req.file.path) try { fs.unlinkSync(req.file.path); } catch (_) {}
            res.status(500).json({ success: false, message: "Logo yüklenirken hata oluştu." });
        }
    }
);

router.post("/seller/banner", requireRole('seller'), requireSellerApproved,
    (req, res, next) => upload.single('banner')(req, res, err => err ? handleUploadError(err, req, res, next) : next()),
    verifyUploadedFile,
    async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ success: false, message: "Banner dosyası yüklenmedi." });
            const userId = req.session.user.id;
            const { Seller } = require('../../models');
            const sellerRecord = await Seller.findOne({ where: { user_id: userId }, attributes: ['id', 'banner_url'] });
            if (!sellerRecord) {
                try { fs.unlinkSync(req.file.path); } catch (_) {}
                return res.status(404).json({ success: false, message: 'Satıcı kaydı bulunamadı.' });
            }
            const fileUrl = await moveToSellerDir(sellerRecord.id, req.file);
            deleteOldFile(sellerRecord.banner_url);
            await Seller.update({ banner_url: fileUrl }, { where: { id: sellerRecord.id } });
            res.json({ success: true, message: "Banner başarıyla yüklendi.", url: fileUrl });
        } catch (error) {
            if (req.file && req.file.path) try { fs.unlinkSync(req.file.path); } catch (_) {}
            res.status(500).json({ success: false, message: "Banner yüklenirken hata oluştu." });
        }
    }
);

router.post("/admin/seller-logo/:sellerId", requireRole(['admin', 'super_admin']),
    (req, res, next) => upload.single('logo')(req, res, err => err ? handleUploadError(err, req, res, next) : next()),
    verifyUploadedFile,
    async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ success: false, message: "Logo dosyası yüklenmedi." });
            const sellerId = parseInt(req.params.sellerId);
            if (!sellerId) {
                try { fs.unlinkSync(req.file.path); } catch (_) {}
                return res.status(400).json({ success: false, message: "Geçersiz satıcı ID." });
            }
            const { Seller } = require('../../models');
            const seller = await Seller.findByPk(sellerId, { attributes: ['id', 'logo_url'] });
            if (!seller) {
                try { fs.unlinkSync(req.file.path); } catch (_) {}
                return res.status(404).json({ success: false, message: "Satıcı bulunamadı." });
            }
            const fileUrl = await moveToSellerDir(sellerId, req.file);
            deleteOldFile(seller.logo_url);
            await Seller.update({ logo_url: fileUrl }, { where: { id: sellerId } });
            res.json({ success: true, message: "Logo başarıyla yüklendi.", url: fileUrl });
        } catch (error) {
            if (req.file && req.file.path) try { fs.unlinkSync(req.file.path); } catch (_) {}
            res.status(500).json({ success: false, message: "Logo yüklenirken hata oluştu." });
        }
    }
);

router.post("/admin/seller-banner/:sellerId", requireRole(['admin', 'super_admin']),
    (req, res, next) => upload.single('banner')(req, res, err => err ? handleUploadError(err, req, res, next) : next()),
    verifyUploadedFile,
    async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ success: false, message: "Banner dosyası yüklenmedi." });
            const sellerId = parseInt(req.params.sellerId);
            if (!sellerId) {
                try { fs.unlinkSync(req.file.path); } catch (_) {}
                return res.status(400).json({ success: false, message: "Geçersiz satıcı ID." });
            }
            const { Seller } = require('../../models');
            const seller = await Seller.findByPk(sellerId, { attributes: ['id', 'banner_url'] });
            if (!seller) {
                try { fs.unlinkSync(req.file.path); } catch (_) {}
                return res.status(404).json({ success: false, message: "Satıcı bulunamadı." });
            }
            const fileUrl = await moveToSellerDir(sellerId, req.file);
            deleteOldFile(seller.banner_url);
            await Seller.update({ banner_url: fileUrl }, { where: { id: sellerId } });
            res.json({ success: true, message: "Banner başarıyla yüklendi.", url: fileUrl });
        } catch (error) {
            if (req.file && req.file.path) try { fs.unlinkSync(req.file.path); } catch (_) {}
            res.status(500).json({ success: false, message: "Banner yüklenirken hata oluştu." });
        }
    }
);

router.post("/meal/image", requireRole('seller'), requireSellerApproved,
    (req, res, next) => upload.single('image')(req, res, err => err ? handleUploadError(err, req, res, next) : next()),
    verifyUploadedFile,
    async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ success: false, message: 'Resim dosyası yüklenmedi.' });
            const userId = req.session.user.id;
            const { Seller } = require('../../models');
            const sellerRecord = await Seller.findOne({ where: { user_id: userId }, attributes: ['id'] });
            if (!sellerRecord) {
                try { fs.unlinkSync(req.file.path); } catch (_) {}
                return res.status(404).json({ success: false, message: 'Satıcı kaydı bulunamadı.' });
            }
            const fileUrl = await moveToSellerDir(sellerRecord.id, req.file);
            res.json({ success: true, message: 'Resim başarıyla yüklendi.', url: fileUrl });
        } catch (error) {
            if (req.file && req.file.path) try { fs.unlinkSync(req.file.path); } catch (_) {}
            res.status(500).json({ success: false, message: "Resim yüklenirken hata oluştu." });
        }
    }
);

module.exports = router;
