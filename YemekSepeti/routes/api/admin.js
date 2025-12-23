const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const bcrypt = require("bcryptjs"); 
const { requireAuth, requireRole } = require("../../middleware/auth");
const { User, Seller } = require("../../models");
const { Op } = require("sequelize");

// Session tabanlı authentication - önce giriş kontrolü, sonra admin kontrolü
router.use((req, res, next) => {
    requireAuth(req, res, next);
});

router.use((req, res, next) => {
    requireRole('admin')(req, res, next);
});



router.get("/users", async (req, res) => {
    try {
        // Eğer buraya geldiyse, requireAuth ve requireRole başarılı demektir
        console.log('📊 GET /api/admin/users - İstek alındı (requireAuth ve requireRole başarılı)', {
            userId: req.user?.id,
            userRole: req.user?.role,
            sessionId: req.sessionID,
            hasSession: !!req.session,
            isAuthenticated: req.session?.isAuthenticated
        });
        
        // Kullanıcıları getir (Sequelize)
        const users = await User.findAll({
            where: {
                role: { [Op.in]: ['seller', 'courier'] }
            },
            attributes: ['id', 'fullname', 'email', 'role', 'is_active', 'created_at'],
            order: [['created_at', 'DESC']]
        });

        console.log(`✅ ${users.length} kullanıcı bulundu`);

        const formattedUsers = users.map(user => ({
            id: user.id,
            fullname: user.fullname,
            email: user.email,
            role: user.role,
            is_active: user.is_active,
            created_at: user.created_at,
            status: user.is_active ? 'active' : 'suspended'
        }));

        console.log('📤 Frontend\'e gönderilen kullanıcı sayısı:', formattedUsers.length);
        console.log('📤 İlk kullanıcı örneği:', formattedUsers[0]);

        res.json(formattedUsers);
    } catch (error) {
        console.error("❌ Kullanıcıları getirme hatası:", error);
        res.status(500).json({ success: false, message: "Veritabanı hatası." });
    }
});


router.post("/users", async (req, res) => {
    try {
        const { fullname, email, password, role } = req.body;

        if (!fullname || !email || !password || !role) {
            return res.status(400).json({ success: false, message: "Tüm alanlar gereklidir." });
        }

        // Email kontrolü (Sequelize)
        const existingUser = await User.findOne({
            where: { email: email },
            attributes: ['id']
        });

        if (existingUser) {
            return res.status(400).json({ success: false, message: "Bu e-posta adresi zaten kayıtlı." });
        }

        // Şifreyi hashle
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Kullanıcıyı oluştur (Sequelize)
        const newUser = await User.create({
            fullname: fullname,
            email: email,
            password: hashedPassword,
            role: role,
            is_active: true
        });

        const newUserId = newUser.id;

        // Eğer seller ise, seller kaydı oluştur
        if (role === 'seller') {
            await Seller.create({
                user_id: newUserId,
                shop_name: `${fullname}'nın Mutfağı`,
                location: 'İstanbul',
                is_active: true
            });
        }

        res.json({
            success: true,
            user: { id: newUserId, fullname, email, role, status: 'active' }
        });

    } catch (error) {
        console.error("Kullanıcı ekleme hatası:", error);
        res.status(500).json({ success: false, message: "Kullanıcı oluşturulurken hata oluştu." });
    }
});


router.put("/users/:id/suspend", async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId) || userId <= 0) {
            return res.status(400).json({ success: false, message: "Geçersiz kullanıcı ID'si." });
        }

        // Kullanıcıyı bul (Sequelize)
        const user = await User.findByPk(userId);
        
        if (!user) {
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
        }

        // Mevcut durumu al
        const currentStatus = user.is_active;
        
        // is_active durumunu tersine çevir (Sequelize)
        await user.update({ 
            is_active: !currentStatus 
        });

        // Kullanıcıyı yeniden yükle (güncel durumu almak için)
        await user.reload();
        
        const newStatus = user.is_active ? 'active' : 'suspended';
        
        console.log(`✅ Kullanıcı durumu güncellendi - User ID: ${userId}, Eski durum: ${currentStatus}, Yeni durum: ${newStatus}`);
        
        res.json({ success: true, status: newStatus });
    } catch (error) {
        console.error("❌ Kullanıcı durumu güncelleme hatası:", error);
        res.status(500).json({ success: false, message: "İşlem başarısız." });
    }
});


router.delete("/users/:id", async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId) || userId <= 0) {
            return res.status(400).json({ success: false, message: "Geçersiz kullanıcı ID'si." });
        }

        // Kullanıcıyı bul (Sequelize)
        const user = await User.findByPk(userId);
        
        if (!user) {
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
        }

        // Kullanıcıyı sil (Sequelize) - CASCADE ile ilişkili kayıtlar da silinecek
        await user.destroy();

        console.log(`✅ Kullanıcı silindi - User ID: ${userId}`);
        
        res.json({ success: true, message: "Kullanıcı silindi." });
    } catch (error) {
        console.error("❌ Kullanıcı silme hatası:", error);
        res.status(500).json({ success: false, message: "Kullanıcı silinemedi." });
    }
});


router.get("/sellers", async (req, res) => {
    try {
        const sql = `
            SELECT s.*, u.fullname as owner_name, u.email 
            FROM sellers s 
            JOIN users u ON s.user_id = u.id
        `;
        const sellers = await db.query(sql);
        res.json(sellers);
    } catch (error) {
        res.status(500).json({ success: false, message: "Veritabanı hatası." });
    }
});

router.get("/coupons", async (req, res) => {
    try {
        const sql = "SELECT * FROM coupons ORDER BY created_at DESC";
        const coupons = await db.query(sql);
        const formattedCoupons = coupons.map(c => ({
            ...c,
            sellerIds: c.applicable_seller_ids,
            amount: c.discount_value
        }));
        res.json(formattedCoupons);
    } catch (error) {
        res.status(500).json({ success: false, message: "Veritabanı hatası." });
    }
});

router.post("/coupons", async (req, res) => {
    try {
        const { code, description, discountType, discountValue, minOrderAmount, maxDiscountAmount, sellerIds, validDays } = req.body;
        
        if (!code || !discountValue) {
            return res.status(400).json({ success: false, message: "Kupon kodu ve indirim değeri gereklidir." });
        }
        
        // Eski format desteği
        const amount = discountValue || req.body.amount;
        const type = discountType || 'fixed';
        const validUntil = validDays ? `DATE_ADD(NOW(), INTERVAL ${validDays} DAY)` : 'DATE_ADD(NOW(), INTERVAL 30 DAY)';
        
        const sellerIdsArray = sellerIds || req.body.sellerIds || [];
        const sellerIdsJson = sellerIdsArray.length === 0 ? null : JSON.stringify(sellerIdsArray);
        
        const sql = `
            INSERT INTO coupons 
            (code, description, discount_type, discount_value, min_order_amount, max_discount_amount, 
             applicable_seller_ids, valid_from, valid_until, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ${validUntil}, ?)
        `;
        
        await db.execute(sql, [
            code,
            description || null,
            type,
            amount,
            minOrderAmount || 0,
            maxDiscountAmount || null,
            sellerIdsJson,
            req.user.id
        ]);
        
        res.json({ success: true, message: "Kupon başarıyla oluşturuldu." });
    } catch (error) {
        console.error("Kupon oluşturma hatası:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: "Bu kupon kodu zaten kullanılıyor." });
        }
        res.status(500).json({ success: false, message: "Kupon oluşturulamadı." });
    }
});

router.delete("/coupons/:id", async (req, res) => {
    try {
        const couponId = req.params.id;
        const sql = "DELETE FROM coupons WHERE id = ?";
        const result = await db.execute(sql, [couponId]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Kupon bulunamadı." });
        res.json({ success: true, message: "Kupon silindi." });
    } catch (error) {
        res.status(500).json({ success: false, message: "İşlem başarısız." });
    }
});

module.exports = router;