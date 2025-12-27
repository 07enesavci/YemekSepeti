const express=require("express");
const router=express.Router();
const multer=require("multer");
const path=require("path");
const fs=require("fs");
const {requireRole}=require("../../middleware/auth");


const uploadsDir = path.join(__dirname, "../../public/uploads");
const sellersDir = path.join(uploadsDir, "sellers");

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(sellersDir)) {
    fs.mkdirSync(sellersDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, sellersDir);
    },
    filename: function (req, file, cb) {
        const fieldName = file.fieldname;
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        const filename = `${fieldName}_${timestamp}${ext}`;
        cb(null, filename);
    }
});
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Sadece resim dosyaları yüklenebilir (jpeg, jpg, png, gif, webp)'));
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: fileFilter
});

router.post("/seller/logo", requireRole('seller'), upload.single('logo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Logo dosyası yüklenmedi."
            });
        }
        
        const userId = req.session.user.id;
        const { Seller } = require('../../models');
        const sellerRecord = await Seller.findOne({ where: { user_id: userId }, attributes: ['id', 'logo_url'] });
        if (!sellerRecord) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ success: false, message: 'Satıcı kaydı bulunamadı.' });
        }
        
        const sellerId = sellerRecord.id;
        const oldLogoUrl = sellerRecord.logo_url || null;
        const sellerUploadDir = path.join(sellersDir, sellerId.toString());
        if (!fs.existsSync(sellerUploadDir)) {
            fs.mkdirSync(sellerUploadDir, { recursive: true });
        }
        
        const oldPath = req.file.path;
        const newPath = path.join(sellerUploadDir, req.file.filename);
        try {
            fs.renameSync(oldPath, newPath);
        } catch (moveError) {}
        const fileUrl = `/uploads/sellers/${sellerId}/${req.file.filename}`;
        await Seller.update({ logo_url: fileUrl }, { where: { id: sellerId } });
        if (oldLogoUrl && oldLogoUrl !== fileUrl) {
            try {
                const oldFilePath = path.join(__dirname, '../../public', oldLogoUrl);
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                }
            } catch (deleteError) {}
        }
        
        
        res.json({
            success: true,
            message: "Logo başarıyla yüklendi.",
            url: fileUrl
        });
    } catch (error) {
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (e) {}
        }
        
        res.status(500).json({
            success: false,
            message: "Logo yüklenirken hata oluştu."
        });
    }
});

router.post("/seller/banner", requireRole('seller'), upload.single('banner'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Banner dosyası yüklenmedi." });
        }

        const userId = req.session.user.id;
        const { Seller } = require('../../models');
        const sellerRecord = await Seller.findOne({ where: { user_id: userId }, attributes: ['id', 'banner_url'] });
        if (!sellerRecord) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ success: false, message: 'Satıcı kaydı bulunamadı.' });
        }

        const sellerId = sellerRecord.id;
        const oldBannerUrl = sellerRecord.banner_url || null;
        const sellerUploadDir = path.join(sellersDir, sellerId.toString());
        if (!fs.existsSync(sellerUploadDir)) {
            fs.mkdirSync(sellerUploadDir, { recursive: true });
        }

        const oldPath = req.file.path;
        const newPath = path.join(sellerUploadDir, req.file.filename);
        try {
            fs.renameSync(oldPath, newPath);
        } catch (moveError) {}
        const fileUrl = `/uploads/sellers/${sellerId}/${req.file.filename}`;
        await Seller.update({ banner_url: fileUrl }, { where: { id: sellerId } });
        if (oldBannerUrl && oldBannerUrl !== fileUrl) {
            try {
                const oldFilePath = path.join(__dirname, '../../public', oldBannerUrl);
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                }
            } catch (deleteError) {}
        }

        res.json({ success: true, message: 'Banner başarıyla yüklendi.', url: fileUrl });
    } catch (error) {
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (e) {}
        }
        
        res.status(500).json({
            success: false,
            message: "Banner yüklenirken hata oluştu."
        });
    }
});

router.post("/meal/image", requireRole('seller'), upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Resim dosyası yüklenmedi.' });
        }

        const userId = req.session.user.id;
        const { Seller } = require('../../models');
        const sellerRecord = await Seller.findOne({ where: { user_id: userId }, attributes: ['id'] });
        if (!sellerRecord) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ success: false, message: 'Satıcı kaydı bulunamadı.' });
        }

        const sellerId = sellerRecord.id;
        const sellerUploadDir = path.join(sellersDir, sellerId.toString());
        if (!fs.existsSync(sellerUploadDir)) {
            fs.mkdirSync(sellerUploadDir, { recursive: true });
        }

        const oldPath = req.file.path;
        const newPath = path.join(sellerUploadDir, req.file.filename);
        try {
            fs.renameSync(oldPath, newPath);
        } catch (moveError) {}
        const fileUrl = `/uploads/sellers/${sellerId}/${req.file.filename}`;

        res.json({ success: true, message: 'Resim başarıyla yüklendi.', url: fileUrl });
    } catch (error) {
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (e) {}
        }
        
        res.status(500).json({
            success: false,
            message: "Resim yüklenirken hata oluştu."
        });
    }
});

module.exports = router;

