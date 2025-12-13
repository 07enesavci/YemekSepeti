const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { requireRole } = require("../../middleware/auth");


// Uploads klasörünü oluştur
const uploadsDir = path.join(__dirname, "../../public/uploads");
const sellersDir = path.join(uploadsDir, "sellers");

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(sellersDir)) {
    fs.mkdirSync(sellersDir, { recursive: true });
}

// Multer storage konfigürasyonu
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Geçici olarak uploads klasörüne kaydet, sonra seller ID'yi bulup taşıyacağız
        // requireRole middleware'den sonra session'a erişebiliriz
        cb(null, sellersDir);
    },
    filename: function (req, file, cb) {
        // Dosya adı: {type}_{timestamp}.{extension}
        // type: logo veya banner
        const fieldName = file.fieldname; // 'logo' veya 'banner'
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        const filename = `${fieldName}_${timestamp}${ext}`;
        cb(null, filename);
    }
});

// File filter - sadece resim dosyaları
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
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: fileFilter
});

/**
 * POST /api/upload/seller/logo
 * Satıcı logosu yükle
 */
router.post("/seller/logo", requireRole('seller'), upload.single('logo'), async (req, res) => {
    console.log('📥 POST /api/upload/seller/logo - İstek alındı');
    console.log('📥 File:', req.file ? 'var' : 'yok');
    console.log('📥 Session user:', req.session?.user?.id);
    console.log('📥 Request path:', req.path);
    console.log('📥 Request method:', req.method);
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Logo dosyası yüklenmedi."
            });
        }
        
        const userId = req.session.user.id;
        const db = require("../../config/database");
        
        // Seller ID'yi bul
        const sellerQuery = await db.query(
            "SELECT id FROM sellers WHERE user_id = ?",
            [userId]
        );
        
        if (sellerQuery.length === 0) {
            // Yüklenen dosyayı sil
            fs.unlinkSync(req.file.path);
            return res.status(404).json({
                success: false,
                message: "Satıcı kaydı bulunamadı."
            });
        }
        
        const sellerId = sellerQuery[0].id;
        
        // Seller klasörüne taşı
        const sellerUploadDir = path.join(sellersDir, sellerId.toString());
        if (!fs.existsSync(sellerUploadDir)) {
            fs.mkdirSync(sellerUploadDir, { recursive: true });
        }
        
        const oldPath = req.file.path;
        const newPath = path.join(sellerUploadDir, req.file.filename);
        
        // Dosyayı taşı
        try {
            fs.renameSync(oldPath, newPath);
        } catch (moveError) {
            console.error('❌ Dosya taşıma hatası:', moveError);
            // Dosya zaten doğru yerde olabilir
        }
        
        // URL oluştur
        const fileUrl = `/uploads/sellers/${sellerId}/${req.file.filename}`;
        
        // Veritabanına kaydet
        await db.execute(
            "UPDATE sellers SET logo_url = ? WHERE id = ?",
            [fileUrl, sellerId]
        );
        
        
        res.json({
            success: true,
            message: "Logo başarıyla yüklendi.",
            url: fileUrl
        });
    } catch (error) {
        console.error("Logo yükleme hatası:", error);
        
        // Hata durumunda dosyayı sil
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (e) {
                console.error("Dosya silme hatası:", e);
            }
        }
        
        res.status(500).json({
            success: false,
            message: "Logo yüklenirken hata oluştu."
        });
    }
});

/**
 * POST /api/upload/seller/banner
 * Satıcı banner'ı yükle
 */
router.post("/seller/banner", requireRole('seller'), upload.single('banner'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Banner dosyası yüklenmedi."
            });
        }
        
        const userId = req.session.user.id;
        const db = require("../../config/database");
        
        // Seller ID'yi bul
        const sellerQuery = await db.query(
            "SELECT id FROM sellers WHERE user_id = ?",
            [userId]
        );
        
        if (sellerQuery.length === 0) {
            // Yüklenen dosyayı sil
            fs.unlinkSync(req.file.path);
            return res.status(404).json({
                success: false,
                message: "Satıcı kaydı bulunamadı."
            });
        }
        
        const sellerId = sellerQuery[0].id;
        
        // Seller klasörüne taşı
        const sellerUploadDir = path.join(sellersDir, sellerId.toString());
        if (!fs.existsSync(sellerUploadDir)) {
            fs.mkdirSync(sellerUploadDir, { recursive: true });
        }
        
        const oldPath = req.file.path;
        const newPath = path.join(sellerUploadDir, req.file.filename);
        
        // Dosyayı taşı
        try {
            fs.renameSync(oldPath, newPath);
        } catch (moveError) {
            console.error('❌ Dosya taşıma hatası:', moveError);
            // Dosya zaten doğru yerde olabilir
        }
        
        // URL oluştur
        const fileUrl = `/uploads/sellers/${sellerId}/${req.file.filename}`;
        
        // Veritabanına kaydet
        await db.execute(
            "UPDATE sellers SET banner_url = ? WHERE id = ?",
            [fileUrl, sellerId]
        );
        
        
        res.json({
            success: true,
            message: "Banner başarıyla yüklendi.",
            url: fileUrl
        });
    } catch (error) {
        console.error("Banner yükleme hatası:", error);
        
        // Hata durumunda dosyayı sil
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (e) {
                console.error("Dosya silme hatası:", e);
            }
        }
        
        res.status(500).json({
            success: false,
            message: "Banner yüklenirken hata oluştu."
        });
    }
});

/**
 * POST /api/upload/meal/image
 * Yemek resmi yükle
 */
router.post("/meal/image", requireRole('seller'), upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Resim dosyası yüklenmedi."
            });
        }
        
        const userId = req.session.user.id;
        const db = require("../../config/database");
        
        // Seller ID'yi bul
        const sellerQuery = await db.query(
            "SELECT id FROM sellers WHERE user_id = ?",
            [userId]
        );
        
        if (sellerQuery.length === 0) {
            // Yüklenen dosyayı sil
            fs.unlinkSync(req.file.path);
            return res.status(404).json({
                success: false,
                message: "Satıcı kaydı bulunamadı."
            });
        }
        
        const sellerId = sellerQuery[0].id;
        
        // Seller klasörüne taşı
        const sellerUploadDir = path.join(sellersDir, sellerId.toString());
        if (!fs.existsSync(sellerUploadDir)) {
            fs.mkdirSync(sellerUploadDir, { recursive: true });
        }
        
        const oldPath = req.file.path;
        const newPath = path.join(sellerUploadDir, req.file.filename);
        
        // Dosyayı taşı
        try {
            fs.renameSync(oldPath, newPath);
        } catch (moveError) {
            console.error('❌ Dosya taşıma hatası:', moveError);
            // Dosya zaten doğru yerde olabilir
        }
        
        // URL oluştur
        const fileUrl = `/uploads/sellers/${sellerId}/${req.file.filename}`;
        
        
        res.json({
            success: true,
            message: "Resim başarıyla yüklendi.",
            url: fileUrl
        });
    } catch (error) {
        console.error("Meal resim yükleme hatası:", error);
        
        // Hata durumunda dosyayı sil
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (e) {
                console.error("Dosya silme hatası:", e);
            }
        }
        
        res.status(500).json({
            success: false,
            message: "Resim yüklenirken hata oluştu."
        });
    }
});

module.exports = router;

