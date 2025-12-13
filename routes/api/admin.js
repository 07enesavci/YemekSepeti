const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const bcrypt = require("bcryptjs"); 
const { requireAuth, requireRole } = require("../../middleware/auth");

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
        
        const sql = `
            SELECT id, fullname, email, role, is_active, created_at 
            FROM users 
            WHERE role IN ('seller', 'courier') 
            ORDER BY created_at DESC
        `;
        const users = await db.query(sql);

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

        const checkSql = "SELECT id FROM users WHERE email = ?";
        const existingUsers = await db.query(checkSql, [email]);

        if (existingUsers.length > 0) {
            return res.status(400).json({ success: false, message: "Bu e-posta adresi zaten kayıtlı." });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        // ----------------------------------------------

        const insertUserSql = `
            INSERT INTO users (fullname, email, password, role, is_active) 
            VALUES (?, ?, ?, ?, 1)
        `;
        const result = await db.execute(insertUserSql, [fullname, email, hashedPassword, role]);
        const newUserId = result.insertId;

        if (role === 'seller') {
            const insertSellerSql = `
                INSERT INTO sellers (user_id, shop_name, location, is_active) 
                VALUES (?, ?, ?, 1)
            `;
            await db.execute(insertSellerSql, [newUserId, `${fullname}'nın Mutfağı`, 'İstanbul']);
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
        const userId = req.params.id;
        const sql = "UPDATE users SET is_active = NOT is_active WHERE id = ?";
        const result = await db.execute(sql, [userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
        }
        const userResult = await db.query("SELECT is_active FROM users WHERE id = ?", [userId]);
        const newStatus = userResult[0].is_active ? 'active' : 'suspended';
        res.json({ success: true, status: newStatus });
    } catch (error) {
        console.error("Hata:", error);
        res.status(500).json({ success: false, message: "İşlem başarısız." });
    }
});


router.delete("/users/:id", async (req, res) => {
    try {
        const userId = req.params.id;
        const sql = "DELETE FROM users WHERE id = ?";
        const result = await db.execute(sql, [userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
        }
        res.json({ success: true, message: "Kullanıcı silindi." });
    } catch (error) {
        console.error("Hata:", error);
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
        const { code, amount, sellerIds } = req.body;
        if (!code || !amount) {
            return res.status(400).json({ success: false, message: "Eksik bilgi." });
        }
        const sql = `
            INSERT INTO coupons 
            (code, discount_value, discount_type, applicable_seller_ids, valid_from, valid_until, created_by) 
            VALUES (?, ?, 'fixed', ?, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), ?)
        `;
        const sellerIdsJson = JSON.stringify(sellerIds || []);
        await db.execute(sql, [code, amount, sellerIdsJson, req.user.id]);
        res.json({ success: true, coupon: { code, amount, sellerIds } });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: "Kupon kodu zaten var." });
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