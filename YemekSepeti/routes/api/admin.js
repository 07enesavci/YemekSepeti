const express=require("express");
const router=express.Router();
const db=require("../../config/database");
const bcrypt=require("bcryptjs");
const { requireAuth, requireRole }=require("../../middleware/auth");
const { User, Seller, Courier }=require("../../models");
const { Op }=require("sequelize");
const { sendSellerApprovalEmail, sendSellerRejectionEmail, sendCourierApprovalEmail, sendCourierRejectionEmail }=require("../../config/email");

router.use((req,res,next)=>{ requireAuth(req,res,next); });

router.use((req,res,next)=>{ requireRole('admin')(req,res,next); });

router.get("/users", async (req, res) => {
    try 
    {
        let userId = null;
        let userRole = null;
        let sessionId = req.sessionID;
        let hasSession = false;
        let isAuthenticated = null;

        if (req.user) 
        {
            userId = req.user.id;
            userRole = req.user.role;
        }
        if (req.session)
        {
            hasSession = true;
            if (typeof req.session.isAuthenticated !== "undefined") 
            {
                isAuthenticated = req.session.isAuthenticated;
            }
        }

        const users = await User.findAll({
            where: {
                role: { [Op.in]: ['seller', 'courier'] }
            },
            attributes: ['id', 'fullname', 'email', 'role', 'is_active', 'created_at'],
            order: [['created_at', 'DESC']]
        });
        const formattedUsers = users.map(user => {
            let status;
            if (user.is_active)
            {
                status = 'active';
            } 
            else
            {
                status = 'suspended';
            }
            return {
                id: user.id,
                fullname: user.fullname,
                email: user.email,
                role: user.role,
                is_active: user.is_active,
                created_at: user.created_at,
                status: status
            };
        });
        res.json(formattedUsers);
    } 
    catch (error) 
    {
        res.status(500).json({ success: false, message: "Veritabanı hatası." });
    }
});


router.post("/users", async (req, res) => {
    try 
    {
        const { fullname, email, password, role } = req.body;

        if (!fullname || !email || !password || !role) 
        {
            return res.status(400).json({ success: false, message: "Tüm alanlar gereklidir." });
        }

        const existingUser = await User.findOne({
            where: { email: email },
            attributes: ['id']
        });

        if (existingUser)
        {
            return res.status(400).json({ success: false, message: "Bu e-posta adresi zaten kayıtlı." });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await User.create({
            fullname: fullname,
            email: email,
            password: hashedPassword,
            role: role,
            is_active: true
        });

        const newUserId = newUser.id;

        if (role === 'seller')
        {
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

    } 
    catch (error) 
    {
        res.status(500).json({ success: false, message: "Kullanıcı oluşturulurken hata oluştu." });
    }
});


router.put("/users/:id/suspend", async (req, res) => {
    try 
    {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId) || userId <= 0)
        {
            return res.status(400).json({ success: false, message: "Geçersiz kullanıcı ID'si." });
        }

        const user = await User.findByPk(userId);
        
        if (!user) 
        {
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
        }

        const currentStatus = user.is_active;
        
        await user.update({ 
            is_active: !currentStatus 
        });

        await user.reload();
        
        let newStatus;
        if (user.is_active) 
        {
            newStatus = 'active';
        }
        else 
        {
            newStatus = 'suspended';
        }
        res.json({ success: true, status: newStatus });
    } 
    catch (error) 
    {
        res.status(500).json({ success: false, message: "İşlem başarısız." });
    }
});

router.delete("/users/:id", async (req, res) => {
    try 
    {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId) || userId <= 0) 
        {
            return res.status(400).json({ success: false, message: "Geçersiz kullanıcı ID'si." });
        }

        const user = await User.findByPk(userId);
        
        if (!user) 
        {
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
        }

        await user.destroy();
        res.json({ success: true, message: "Kullanıcı silindi." });
    } 
    catch (error) 
    {
        res.status(500).json({ success: false, message: "Kullanıcı silinemedi." });
    }
});

router.get("/sellers", async (req, res) => {
    try 
    {
        const sql = `
            SELECT s.*, u.fullname as owner_name, u.email 
            FROM sellers s 
            JOIN users u ON s.user_id = u.id
        `;
        const sellers = await db.query(sql);
        res.json(sellers);
    }
    catch (error) 
    {
        res.status(500).json({ success: false, message: "Veritabanı hatası." });
    }
});

router.get("/coupons", async (req, res) => {
    try 
    {
        const sql = "SELECT id, code, description, discount_type, discount_value, min_order_amount, max_discount_amount, applicable_seller_ids, usage_limit, used_count, valid_from, valid_until, is_active, created_at FROM coupons ORDER BY created_at DESC";
        const rows = await db.query(sql);
        if (!Array.isArray(rows)) {
            return res.json([]);
        }
        const formattedCoupons = rows.map(c => {
            let sellerIds = c.applicable_seller_ids;
            if (typeof sellerIds === 'string') {
                try { sellerIds = JSON.parse(sellerIds); } catch (e) { sellerIds = null; }
            }
            return {
                id: c.id,
                code: c.code,
                description: c.description,
                discount_type: c.discount_type,
                discountType: c.discount_type,
                discount_value: c.discount_value,
                discountValue: parseFloat(c.discount_value) || 0,
                amount: parseFloat(c.discount_value) || 0,
                min_order_amount: parseFloat(c.min_order_amount) || 0,
                minOrderAmount: parseFloat(c.min_order_amount) || 0,
                max_discount_amount: c.max_discount_amount != null ? parseFloat(c.max_discount_amount) : null,
                maxDiscountAmount: c.max_discount_amount != null ? parseFloat(c.max_discount_amount) : null,
                applicable_seller_ids: sellerIds,
                sellerIds: sellerIds,
                usage_limit: c.usage_limit != null ? parseInt(c.usage_limit) : -1,
                usageLimit: c.usage_limit != null ? parseInt(c.usage_limit) : -1,
                used_count: parseInt(c.used_count) || 0,
                usedCount: parseInt(c.used_count) || 0,
                valid_from: c.valid_from,
                valid_until: c.valid_until,
                validFrom: c.valid_from,
                validUntil: c.valid_until,
                is_active: c.is_active,
                created_at: c.created_at
            };
        });
        res.json(formattedCoupons);
    } 
    catch (error) 
    {
        console.error("Admin coupons list hatası:", error);
        res.status(500).json({ success: false, message: "Veritabanı hatası." });
    }
});

router.post("/coupons", async (req, res) => {
    try 
    {
        const { code, description, discountType, discountValue, minOrderAmount, maxDiscountAmount, sellerIds, validDays } = req.body;
        
        if (!code || (discountValue === undefined && req.body.amount === undefined)) 
        {
            return res.status(400).json({ success: false, message: "Kupon kodu ve indirim değeri gereklidir." });
        }
        
        const amount = parseFloat(discountValue ?? req.body.amount);
        if (isNaN(amount) || amount <= 0) 
        {
            return res.status(400).json({ success: false, message: "Geçerli bir indirim değeri girin." });
        }
        
        const type = (discountType === 'percentage' || discountType === 'fixed') ? discountType : 'fixed';
        const validDaysNum = Math.max(1, parseInt(validDays, 10) || 30);
        const validUntilExpr = `DATE_ADD(NOW(), INTERVAL ${validDaysNum} DAY)`;
        
        const sellerIdsArray = Array.isArray(sellerIds) ? sellerIds : (Array.isArray(req.body.sellerIds) ? req.body.sellerIds : []);
        const sellerIdsJson = sellerIdsArray.length === 0 ? null : JSON.stringify(sellerIdsArray);
        
        const minOrder = (minOrderAmount != null && minOrderAmount !== '') ? parseFloat(minOrderAmount) : 0;
        const maxDiscount = (maxDiscountAmount != null && maxDiscountAmount !== '') ? parseFloat(maxDiscountAmount) : null;
        const createdBy = (req.user && req.user.id != null) ? req.user.id : null;
        
        const sql = `
            INSERT INTO coupons 
            (code, description, discount_type, discount_value, min_order_amount, max_discount_amount, 
             applicable_seller_ids, valid_from, valid_until, created_by, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ${validUntilExpr}, ?, NOW(), NOW())
        `;
        
        await db.execute(sql, [
            String(code).trim(),
            description ? String(description).trim() : null,
            type,
            amount,
            isNaN(minOrder) ? 0 : minOrder,
            (maxDiscount != null && !isNaN(maxDiscount)) ? maxDiscount : null,
            sellerIdsJson,
            createdBy
        ]);
        
        res.json({ success: true, message: "Kupon başarıyla oluşturuldu." });
    } 
    catch (error) 
    {
        console.error("Kupon oluşturma hatası:", error);
        if (error.code === 'ER_DUP_ENTRY') 
        {
            return res.status(400).json({ success: false, message: "Bu kupon kodu zaten kullanılıyor." });
        }
        if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_BAD_FIELD_ERROR') 
        {
            return res.status(500).json({ success: false, message: "Veritabanı yapılandırma hatası. Lütfen coupons tablosunu kontrol edin." });
        }
        if (error.code === 'ER_NO_DEFAULT_FOR_FIELD') 
        {
            return res.status(500).json({ success: false, message: "Veritabanı created_at/updated_at varsayılan değer hatası. Lütfen sunucuyu yeniden başlatın veya coupons tablosuna DEFAULT ekleyin." });
        }
        res.status(500).json({ success: false, message: "Kupon oluşturulamadı." });
    }
});

router.delete("/coupons/:id", async (req, res) => {
    try 
    {
        const couponId = req.params.id;
        const sql = "DELETE FROM coupons WHERE id = ?";
        const result = await db.execute(sql, [couponId]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Kupon bulunamadı." });
        res.json({ success: true, message: "Kupon silindi." });
    } 
    catch (error) 
    {
        res.status(500).json({ success: false, message: "İşlem başarısız." });
    }
});
/// --- SATICI ONAY SİSTEMİ BAŞLANGIÇ ---

// 1. Onay Bekleyen Satıcıları Listele (GET)
router.get("/pending-sellers", requireRole('admin'), async (req, res) => {
    try {
        const pending = await Seller.findAll({ 
            where: { is_active: false }, 
            include: [{
                model: User,
                as: 'user', // BURASI: 'User' yerine 'user' (küçük harf) olmalı
                attributes: ['email', 'fullname'] 
            }]
        });
        console.log("Onay bekleyen satıcı sayısı:", pending.length);
        res.json({ success: true, data: pending });
    } catch (error) {
        console.error("Liste Hatası Detayı:", error);
        res.status(500).json({ success: false, message: "Liste çekilemedi." });
    }
});
// 2. Satıcıyı Onayla (POST) — Onay e-postası gönderilir
router.post("/approve-seller/:id", requireRole('admin'), async (req, res) => {
    try {
        const seller = await Seller.findByPk(req.params.id, { include: [{ model: User, as: 'user', attributes: ['email'] }] });
        if (!seller) return res.status(404).json({ success: false, message: "Satıcı bulunamadı." });

        await seller.update({ is_active: true });
        const user = seller.user || await User.findByPk(seller.user_id);
        if (user && user.email) {
            await sendSellerApprovalEmail(user.email, seller.shop_name).catch(err => console.error('Onay e-postası gönderilemedi:', err));
        }
        res.json({ success: true, message: "Satıcı onaylandı ve mağaza aktif edildi!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Onaylama işlemi sırasında hata oluştu." });
    }
});

// 3. Satıcıyı Reddet ve Sil (POST) — Red e-postası gönderilir, sonra satıcı + kullanıcı silinir
router.post("/reject-seller/:id", requireRole('admin'), async (req, res) => {
    try {
        const seller = await Seller.findByPk(req.params.id);
        if (!seller) return res.status(404).json({ success: false, message: "Satıcı bulunamadı." });

        const user = await User.findByPk(seller.user_id);
        if (user && user.email) {
            await sendSellerRejectionEmail(user.email).catch(err => console.error('Red e-postası gönderilemedi:', err));
        }
        const userId = seller.user_id;
        await seller.destroy();
        await User.destroy({ where: { id: userId } });
        res.json({ success: true, message: "Başvuru reddedildi ve sistemden silindi." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Reddetme işlemi sırasında hata oluştu." });
    }
});

// --- SATICI ONAY SİSTEMİ BİTİŞ ---

// --- KURYE ONAY SİSTEMİ ---
router.get("/pending-couriers", requireRole('admin'), async (req, res) => {
    try {
        const pending = await Courier.findAll({
            where: { is_active: false },
            include: [{ model: User, as: 'user', attributes: ['email', 'fullname'] }]
        });
        res.json({ success: true, data: pending });
    } catch (error) {
        console.error("Kurye listesi hatası:", error);
        res.status(500).json({ success: false, message: "Liste çekilemedi." });
    }
});
router.post("/approve-courier/:id", requireRole('admin'), async (req, res) => {
    try {
        const courier = await Courier.findByPk(req.params.id, { include: [{ model: User, as: 'user', attributes: ['email'] }] });
        if (!courier) return res.status(404).json({ success: false, message: "Kurye bulunamadı." });
        await courier.update({ is_active: true });
        const user = courier.user || await User.findByPk(courier.user_id);
        if (user && user.email) await sendCourierApprovalEmail(user.email).catch(err => console.error('Onay e-postası gönderilemedi:', err));
        res.json({ success: true, message: "Kurye onaylandı!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Onaylama işlemi sırasında hata oluştu." });
    }
});
router.post("/reject-courier/:id", requireRole('admin'), async (req, res) => {
    try {
        const courier = await Courier.findByPk(req.params.id);
        if (!courier) return res.status(404).json({ success: false, message: "Kurye bulunamadı." });
        const user = await User.findByPk(courier.user_id);
        if (user && user.email) await sendCourierRejectionEmail(user.email).catch(err => console.error('Red e-postası gönderilemedi:', err));
        const userId = courier.user_id;
        await courier.destroy();
        await User.destroy({ where: { id: userId } });
        res.json({ success: true, message: "Kurye başvurusu reddedildi ve sistemden silindi." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Reddetme işlemi sırasında hata oluştu." });
    }
});
// --- KURYE ONAY SİSTEMİ BİTİŞ ---

module.exports = router;
