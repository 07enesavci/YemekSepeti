const express=require("express");
const router=express.Router();
const db=require("../../config/database");
const bcrypt=require("bcryptjs");
const { requireAuth, requireRole }=require("../../middleware/auth");
const { User, Seller, Courier, Order, Meal, Review, Address }=require("../../models");
const { recalculateSellerRatings } = require("../../lib/sellerRatingHelper");
const { Op }=require("sequelize");
const { Sequelize }=require("sequelize");
const { sendSellerApprovalEmail, sendSellerRejectionEmail, sendCourierApprovalEmail, sendCourierRejectionEmail }=require("../../config/email");
const { createCouponValidation, idParam, handleValidationErrors }=require("../../middleware/validate");

router.use((req,res,next)=>{ requireAuth(req,res,next); });

router.use((req,res,next)=>{ requireRole(['admin','super_admin','support'])(req,res,next); });

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
                role: { [Op.in]: ['seller', 'courier', 'user', 'buyer'] }
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
        else if (role === 'courier')
        {
            await Courier.create({
                user_id: newUserId,
                vehicle_type: 'Motosiklet',
                plate_number: '34 XYZ 123',
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
        
        // Recalculate seller ratings as the user's active status changed
        const userReviews = await Review.findAll({ where: { user_id: userId }, attributes: ['seller_id'] });
        if (userReviews.length > 0) {
            const sellerIds = userReviews.map(r => r.seller_id);
            await recalculateSellerRatings(sellerIds);
        }

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

        const userReviews = await Review.findAll({ where: { user_id: userId }, attributes: ['seller_id'] });

        await user.destroy();

        if (userReviews.length > 0) {
            const sellerIds = userReviews.map(r => r.seller_id);
            await recalculateSellerRatings(sellerIds);
        }

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

router.post("/coupons", createCouponValidation, handleValidationErrors, async (req, res) => {
    try 
    {
        const { code, description, discountType, discountValue, minOrderAmount, maxDiscountAmount, sellerIds, validDays } = req.body;
        const amount = parseFloat(discountValue ?? req.body.amount);
        
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

router.put("/coupons/:id", idParam, handleValidationErrors, async (req, res) => {
    try 
    {
        const couponId = parseInt(req.params.id, 10);
        const { code, description, discountType, discountValue, minOrderAmount, maxDiscountAmount, sellerIds } = req.body;
        if (!code || !(discountValue != null || req.body.amount != null)) {
            return res.status(400).json({ success: false, message: "Kupon kodu ve indirim değeri gerekli." });
        }
        const amount = parseFloat(discountValue ?? req.body.amount);
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({ success: false, message: "Geçerli indirim değeri girin." });
        }
        const type = (discountType === 'percentage' || discountType === 'fixed') ? discountType : 'fixed';
        const sellerIdsArray = Array.isArray(sellerIds) ? sellerIds : (Array.isArray(req.body.sellerIds) ? req.body.sellerIds : []);
        const sellerIdsJson = sellerIdsArray.length === 0 ? null : JSON.stringify(sellerIdsArray);
        const minOrder = (minOrderAmount != null && minOrderAmount !== '') ? parseFloat(minOrderAmount) : 0;
        const maxDiscount = (maxDiscountAmount != null && maxDiscountAmount !== '') ? parseFloat(maxDiscountAmount) : null;
        const existingRows = await db.query("SELECT id FROM coupons WHERE id = ?", [couponId]);
        if (!existingRows || existingRows.length === 0) return res.status(404).json({ success: false, message: "Kupon bulunamadı." });
        const duplicateRows = await db.query("SELECT id FROM coupons WHERE code = ? AND id != ?", [String(code).trim(), couponId]);
        if (duplicateRows && duplicateRows.length > 0) return res.status(400).json({ success: false, message: "Bu kupon kodu başka bir kuponda kullanılıyor." });
        await db.execute(
            "UPDATE coupons SET code = ?, description = ?, discount_type = ?, discount_value = ?, min_order_amount = ?, max_discount_amount = ?, applicable_seller_ids = ?, updated_at = NOW() WHERE id = ?",
            [String(code).trim(), description ? String(description).trim() : null, type, amount, isNaN(minOrder) ? 0 : minOrder, (maxDiscount != null && !isNaN(maxDiscount)) ? maxDiscount : null, sellerIdsJson, couponId]
        );
        res.json({ success: true, message: "Kupon güncellendi." });
    } 
    catch (error) 
    {
        console.error("Kupon güncelleme hatası:", error);
        res.status(500).json({ success: false, message: "Kupon güncellenemedi." });
    }
});

router.delete("/coupons/:id", idParam, handleValidationErrors, async (req, res) => {
    try 
    {
        const couponId = parseInt(req.params.id, 10);
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
router.get("/pending-sellers", requireRole(['admin','super_admin','support']), async (req, res) => {
    try {
        const pending = await Seller.findAll({ 
            where: { is_active: false }, 
            include: [{
                model: User,
                as: 'user', // BURASI: 'User' yerine 'user' (küçük harf) olmalı
                attributes: ['email', 'fullname'] 
            }]
        });

        const enrichedPending = await Promise.all((pending || []).map(async (seller) => {
            const businessAddress = await Address.findOne({
                where: {
                    user_id: seller.user_id,
                    title: 'İşyeri Adresi'
                },
                attributes: ['id', 'title', 'full_address', 'district', 'city', 'is_default', 'created_at'],
                order: [['is_default', 'DESC'], ['id', 'DESC']]
            });

            const sellerJson = seller.toJSON();
            sellerJson.business_address = businessAddress ? {
                id: businessAddress.id,
                title: businessAddress.title,
                full_address: businessAddress.full_address,
                district: businessAddress.district,
                city: businessAddress.city,
                is_default: businessAddress.is_default,
                created_at: businessAddress.created_at
            } : null;

            return sellerJson;
        }));

        console.log("Onay bekleyen satıcı sayısı:", pending.length);
        res.json({ success: true, data: enrichedPending });
    } catch (error) {
        console.error("Liste Hatası Detayı:", error);
        res.status(500).json({ success: false, message: "Liste çekilemedi." });
    }
});

// 2. Satıcıyı Onayla (POST)
router.post("/approve-seller/:id", requireRole(['admin','super_admin','support']), async (req, res) => {
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
router.post("/reject-seller/:id", requireRole(['admin','super_admin','support']), async (req, res) => {
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

// --- TÜM SATICILAR (ADMİN) BAŞLANGIÇ ---
router.get("/all-sellers", requireRole(['admin','super_admin','support']), async (req, res) => {
    try {
        const { is_open, search } = req.query;

        const sellerWhere = {};
        if (is_open === 'open') {
            sellerWhere.is_open = true;
            sellerWhere.is_active = true;
        } else if (is_open === 'closed') {
            sellerWhere[Op.or] = [{ is_open: false }, { is_active: false }];
        }

        const sellers = await Seller.findAll({
            where: Object.keys(sellerWhere).length ? sellerWhere : undefined,
            attributes: [
                'id', 'shop_name', 'location', 'is_open', 'is_active',
                'rating', 'total_reviews', 'logo_url', 'banner_url', 'created_at'
            ],
            include: [{
                model: User,
                as: 'user',
                required: true,
                attributes: ['id', 'fullname', 'email', 'phone', 'role', 'created_at']
            }],
            order: [['created_at', 'DESC']],
            subQuery: false
        });

        let list = sellers;
        if (search && String(search).trim() !== '') {
            const t = String(search).trim().toLowerCase();
            list = sellers.filter((s) => {
                const u = s.user;
                if (!u) return false;
                return (
                    (u.fullname && u.fullname.toLowerCase().includes(t)) ||
                    (u.email && u.email.toLowerCase().includes(t)) ||
                    (u.phone && String(u.phone).toLowerCase().includes(t)) ||
                    (s.shop_name && s.shop_name.toLowerCase().includes(t)) ||
                    (s.location && s.location.toLowerCase().includes(t))
                );
            });
        }

        const formattedData = list.map((s) => ({
            id: s.user.id,
            fullname: s.user.fullname,
            email: s.user.email,
            phone: s.user.phone,
            created_at: s.created_at || s.user.created_at,
            Seller: {
                id: s.id,
                shop_name: s.shop_name,
                location: s.location,
                is_open: s.is_open,
                is_active: s.is_active,
                rating: parseFloat(s.rating) || 0,
                total_reviews: s.total_reviews,
                logo_url: s.logo_url || null,
                banner_url: s.banner_url || null
            }
        }));

        res.json({ success: true, data: formattedData });
    } catch (error) {
        console.error("All sellers list error:", error);
        res.status(500).json({
            success: false,
            message: "Satıcılar getirilemedi.",
            detail: process.env.NODE_ENV !== 'production' ? error.message : undefined
        });
    }
});

router.get("/seller-stats/:id", requireRole(['admin','super_admin','support']), async (req, res) => {
    try {
        const userId = parseInt(req.params.id); // Note: frontend sends user_id
        if (!userId) return res.status(400).json({ success: false, message: "Geçersiz satıcı ID." });

        const user = await User.findByPk(userId, {
            attributes: ['id', 'fullname', 'email', 'phone', 'role', 'created_at'],
            include: [{ model: Seller, as: 'seller' }]
        });

        if (!user || user.role !== 'seller' || !user.seller) {
            return res.status(404).json({ success: false, message: "Satıcı bulunamadı." });
        }
        
        const sellerId = user.seller.id;

        // Tarih filtresi
        const { startDate, endDate } = req.query;
        let dateFilter = "";
        let dateReplacements = [sellerId];
        if (startDate && endDate) {
            dateFilter = " AND created_at >= ? AND created_at <= ?";
            dateReplacements.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
        }

        // Toplam işler ve kâr
        const statsQuery = `
            SELECT 
                COUNT(CASE WHEN status = 'delivered' THEN 1 END) as total_delivered,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as total_cancelled,
                COUNT(CASE WHEN status NOT IN ('delivered', 'cancelled') THEN 1 END) as total_active,
                COALESCE(SUM(CASE WHEN status = 'delivered' THEN total_amount ELSE 0 END), 0) as total_revenue
            FROM orders
            WHERE seller_id = ?${dateFilter}
        `;
        const metricsRaw = await db.query(statsQuery, dateReplacements);
        const metrics = Array.isArray(metricsRaw) && metricsRaw.length > 0 ? metricsRaw[0] : { total_delivered: 0, total_cancelled: 0, total_active: 0, total_revenue: 0 };

        // Sipariş Geçmişi (seçilen tarih aralığındaki tüm siparişler)
        let ordersReplacements = [sellerId];
        let ordersDateFilter = "";
        if (startDate && endDate) {
            ordersDateFilter = " AND created_at >= ? AND created_at <= ?";
            ordersReplacements.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
        }
        const recentOrdersQuery = `
            SELECT id, order_number, total_amount, status, created_at 
            FROM orders 
            WHERE seller_id = ?${ordersDateFilter}
            ORDER BY created_at DESC 
        `;
        const recentOrdersRaw = await db.query(recentOrdersQuery, ordersReplacements);
        const recentOrders = Array.isArray(recentOrdersRaw) ? recentOrdersRaw : [];

        res.json({
            success: true,
            data: {
                user: {
                    fullname: user.fullname,
                    shop_name: user.seller.shop_name,
                    rating: parseFloat(user.seller.rating) || 0
                },
                stats: {
                    totalDelivered: parseInt(metrics.total_delivered) || 0,
                    totalCancelled: parseInt(metrics.total_cancelled) || 0,
                    totalActive: parseInt(metrics.total_active) || 0,
                    totalRevenue: parseFloat(metrics.total_revenue) || 0
                },
                recentOrders: recentOrders
            }
        });
    } catch (error) {
        console.error("Seller stats error:", error);
        res.status(500).json({ success: false, message: "Satıcı detayı getirilemedi." });
    }
});
// Admin: Satıcı logo/banner sil
const path = require('path');
const fs = require('fs');

router.delete("/seller/:sellerId/remove-logo", requireRole(['admin','super_admin']), async (req, res) => {
    try {
        const sellerId = parseInt(req.params.sellerId);
        if (!sellerId) return res.status(400).json({ success: false, message: "Geçersiz satıcı ID." });
        const seller = await Seller.findByPk(sellerId, { attributes: ['id', 'logo_url'] });
        if (!seller) return res.status(404).json({ success: false, message: "Satıcı bulunamadı." });
        if (seller.logo_url) {
            try {
                const filePath = path.join(__dirname, '../../public', seller.logo_url);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            } catch (e) {}
        }
        await seller.update({ logo_url: null });
        res.json({ success: true, message: "Logo başarıyla kaldırıldı." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Logo kaldırılırken hata oluştu." });
    }
});

router.delete("/seller/:sellerId/remove-banner", requireRole(['admin','super_admin']), async (req, res) => {
    try {
        const sellerId = parseInt(req.params.sellerId);
        if (!sellerId) return res.status(400).json({ success: false, message: "Geçersiz satıcı ID." });
        const seller = await Seller.findByPk(sellerId, { attributes: ['id', 'banner_url'] });
        if (!seller) return res.status(404).json({ success: false, message: "Satıcı bulunamadı." });
        if (seller.banner_url) {
            try {
                const filePath = path.join(__dirname, '../../public', seller.banner_url);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            } catch (e) {}
        }
        await seller.update({ banner_url: null });
        res.json({ success: true, message: "Banner başarıyla kaldırıldı." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Banner kaldırılırken hata oluştu." });
    }
});
// --- TÜM SATICILAR BİTİŞ ---

// --- KURYE ONAY SİSTEMİ ---
router.get("/pending-couriers", requireRole(['admin','super_admin','support']), async (req, res) => {
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
router.post("/approve-courier/:id", requireRole(['admin','super_admin','support']), async (req, res) => {
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
router.post("/reject-courier/:id", requireRole(['admin','super_admin','support']), async (req, res) => {
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

// --- TÜM KURYELER (ADMİN) BAŞLANGIÇ ---
router.get("/all-couriers", requireRole(['admin','super_admin','support']), async (req, res) => {
    try {
        const { status, vehicleType, search } = req.query;

        let whereClause = { role: 'courier' };
        
        if (status === 'online' || status === 'offline') {
            whereClause.courier_status = status;
        }

        if (vehicleType && vehicleType !== 'all') {
            whereClause.vehicle_type = vehicleType;
        }

        if (search && search.trim() !== '') {
            whereClause[Op.or] = [
                { fullname: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } },
                { phone: { [Op.like]: `%${search}%` } }
            ];
        }

        const queryResult = await User.findAll({
            where: whereClause,
            attributes: ['id', 'fullname', 'email', 'phone', 'courier_status', 'vehicle_type', 'is_active', 'last_latitude', 'last_longitude', 'created_at'],
            include: [{
                model: Courier,
                as: 'courier',
                attributes: ['id', 'is_active']
            }],
            order: [['created_at', 'DESC']]
        });

        res.json({ success: true, data: queryResult });
    } catch (error) {
        console.error("All couriers list error:", error);
        res.status(500).json({ success: false, message: "Kuryeler getirilemedi." });
    }
});

router.get("/courier-stats/:id", requireRole(['admin','super_admin','support']), async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (!userId) return res.status(400).json({ success: false, message: "Kurye ID geçersiz." });

        const user = await User.findByPk(userId, {
            attributes: ['id', 'role', 'fullname', 'email', 'phone', 'courier_status', 'vehicle_type', 'last_latitude', 'last_longitude', 'created_at'],
            include: [{ model: Courier, as: 'courier' }]
        });

        if (!user || user.role !== 'courier') {
            return res.status(404).json({ success: false, message: "Kurye bulunamadı." });
        }

        // Toplam işler ve veriler (orders)
        const statsQuery = `
            SELECT 
                COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) as total_delivered,
                COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as total_cancelled,
                COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.delivery_fee ELSE 0 END), 0) as total_estimated_earnings
            FROM orders o
            WHERE o.courier_id = ?
        `;
        const metricsRaw = await db.query(statsQuery, [userId]);
        const metrics = metricsRaw && metricsRaw.length > 0 ? metricsRaw[0] : { total_delivered: 0, total_cancelled: 0, total_estimated_earnings: 0 };

        // Kurye Sipariş Geçmişi
        const recentOrdersQuery = `
            SELECT id, order_number, total_amount, delivery_fee, status, created_at 
            FROM orders 
            WHERE courier_id = ?
            ORDER BY created_at DESC
            LIMIT 50
        `;
        const recentOrdersRaw = await db.query(recentOrdersQuery, [userId]);
        const recentOrders = Array.isArray(recentOrdersRaw) ? recentOrdersRaw : [];

        res.json({
            success: true,
            data: {
                user: user,
                stats: {
                    totalDelivered: parseInt(metrics.total_delivered) || 0,
                    totalCancelled: parseInt(metrics.total_cancelled) || 0,
                    totalEstimatedEarnings: parseFloat(metrics.total_estimated_earnings) || 0
                },
                recentOrders: recentOrders
            }
        });
    } catch (error) {
        console.error("Courier stats error:", error);
        res.status(500).json({ success: false, message: "Kurye detayı getirilemedi." });
    }
});
// --- TÜM KURYELER BİTİŞ ---

// --- ADMİN RAPORLARI ---
router.get("/reports/summary", async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const totalOrders = await Order.count();
        const ordersToday = await Order.count({ where: { created_at: { [Op.gte]: today } } });
        const ordersThisWeek = await Order.count({ where: { created_at: { [Op.gte]: startOfWeek } } });
        const deliveredOrders = await Order.count({ where: { status: 'delivered' } });
        const revenueResult = await Order.findOne({
            where: { status: 'delivered' },
            attributes: [[Sequelize.fn('SUM', Sequelize.col('total_amount')), 'total']],
            raw: true
        });
        const totalRevenue = revenueResult && revenueResult.total != null ? parseFloat(revenueResult.total) : 0;
        const activeSellers = await Seller.count({ where: { is_active: true } });
        const activeCouriers = await Courier.count({ where: { is_active: true } });
        const totalUsers = await User.count();

        res.json({
            success: true,
            summary: {
                totalOrders,
                ordersToday,
                ordersThisWeek,
                deliveredOrders,
                totalRevenue: Math.round(totalRevenue * 100) / 100,
                activeSellers,
                activeCouriers,
                totalUsers
            }
        });
    } catch (err) {
        console.error("Admin reports error:", err);
        res.status(500).json({ success: false, message: "Rapor yüklenemedi." });
    }
});

// Son 7 gün sipariş ve ciro verisi (grafik için)
router.get("/reports/chart", async (req, res) => {
    try {
        const days = 7;
        const result = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);
            const next = new Date(d);
            next.setDate(next.getDate() + 1);
            const orderCount = await Order.count({
                where: { created_at: { [Op.gte]: d, [Op.lt]: next } }
            });
            const revRow = await Order.findOne({
                where: { status: 'delivered', created_at: { [Op.gte]: d, [Op.lt]: next } },
                attributes: [[Sequelize.fn('SUM', Sequelize.col('total_amount')), 'rev']],
                raw: true
            });
            const rev = revRow && revRow.rev != null ? parseFloat(revRow.rev) : 0;
            result.push({
                date: d.toISOString().slice(0, 10),
                label: d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
                orders: orderCount,
                revenue: Math.round(rev * 100) / 100
            });
        }
        res.json({ success: true, chart: result });
    } catch (err) {
        console.error("Admin reports chart error:", err);
        res.status(500).json({ success: false, message: "Grafik verisi yüklenemedi." });
    }
});
// --- ADMİN MENÜ KONTROL ---

// Tüm satıcıların menülerini listele (filtre: sellerId, search, isAvailable, isApproved)
router.get("/menu-items", requireRole(['admin','super_admin','support']), async (req, res) => {
    try {
        const { sellerId, search, isAvailable, isApproved, province, district } = req.query;

        let whereClause = {};
        if (sellerId) whereClause.seller_id = parseInt(sellerId);
        if (isAvailable === 'true') whereClause.is_available = true;
        else if (isAvailable === 'false') whereClause.is_available = false;
        if (isApproved === 'true') whereClause.is_approved = true;
        else if (isApproved === 'false') whereClause.is_approved = false;
        
        if (search && search.trim()) {
            whereClause[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { category: { [Op.like]: `%${search}%` } }
            ];
        }

        let sellerWhereClause = {};
        if (province) {
            if (district) {
                // Hem il hem ilçe varsa, arama "ilçe, il" veya herhangi birindeki stringi içerebilir.
                sellerWhereClause.location = {
                    [Op.and]: [
                        { [Op.like]: `%${province}%` },
                        { [Op.like]: `%${district}%` }
                    ]
                };
            } else {
                sellerWhereClause.location = { [Op.like]: `%${province}%` };
            }
        } else if (district) {
            sellerWhereClause.location = { [Op.like]: `%${district}%` };
        }

        const meals = await Meal.findAll({
            where: whereClause,
            include: [{ 
                model: Seller, 
                as: 'seller', 
                attributes: ['id', 'shop_name', 'is_active', 'is_open', 'location'],
                ...(Object.keys(sellerWhereClause).length > 0 ? { where: sellerWhereClause } : {})
            }],
            order: [['seller_id', 'ASC'], ['category', 'ASC'], ['name', 'ASC']]
        });

        const formatted = meals.map(m => ({
            id: m.id,
            name: m.name,
            category: m.category,
            description: m.description,
            price: parseFloat(m.price) || 0,
            image_url: m.image_url,
            is_available: m.is_available,
            is_approved: m.is_approved,
            stock_quantity: m.stock_quantity,
            created_at: m.created_at,
            updated_at: m.updated_at,
            seller: m.seller ? {
                id: m.seller.id,
                shop_name: m.seller.shop_name,
                is_active: m.seller.is_active,
                is_open: m.seller.is_open,
                location: m.seller.location
            } : null
        }));

        // Satıcı listesi (filtre dropdown için)
        const sellersRaw = await Seller.findAll({ attributes: ['id', 'shop_name', 'location'], order: [['shop_name', 'ASC']] });
        const sellersList = sellersRaw.map(s => ({ id: s.id, shop_name: s.shop_name, location: s.location }));

        res.json({ success: true, data: formatted, sellers: sellersList });
    } catch (error) {
        console.error("Admin menu-items error:", error);
        res.status(500).json({ success: false, message: "Menü öğeleri getirilemedi." });
    }
});

// Ürün düzenle (admin)
router.put("/menu-items/:id", requireRole(['admin','super_admin','support']), async (req, res) => {
    try {
        const mealId = parseInt(req.params.id);
        const { name, category, description, price, image_url, is_available, stock_quantity } = req.body;

        const meal = await Meal.findByPk(mealId);
        if (!meal) return res.status(404).json({ success: false, message: "Ürün bulunamadı." });

        const updates = {};
        if (name !== undefined) updates.name = name;
        if (category !== undefined) updates.category = category;
        if (description !== undefined) updates.description = description;
        if (price !== undefined) updates.price = parseFloat(price);
        if (image_url !== undefined) updates.image_url = image_url;
        if (is_available !== undefined) updates.is_available = !!is_available;
        if (stock_quantity !== undefined) updates.stock_quantity = parseInt(stock_quantity);

        await meal.update(updates);
        if (global.io) {
            global.io.emit('menu_updated', { sellerId: meal.seller_id });
        }
        res.json({ success: true, message: "Ürün güncellendi." });
    } catch (error) {
        console.error("Admin menu-item update error:", error);
        res.status(500).json({ success: false, message: "Ürün güncellenemedi." });
    }
});

// Ürün durumunu değiştir (toggle is_available)
router.patch("/menu-items/:id/toggle", requireRole(['admin','super_admin','support']), async (req, res) => {
    try {
        const mealId = parseInt(req.params.id);
        const meal = await Meal.findByPk(mealId);
        if (!meal) return res.status(404).json({ success: false, message: "Ürün bulunamadı." });

        await meal.update({ is_available: !meal.is_available });
        if (global.io) {
            global.io.emit('menu_updated', { sellerId: meal.seller_id });
        }
        res.json({ success: true, message: meal.is_available ? "Ürün aktif edildi." : "Ürün pasif edildi.", is_available: meal.is_available });
    } catch (error) {
        console.error("Admin menu-item toggle error:", error);
        res.status(500).json({ success: false, message: "Durum değiştirilemedi." });
    }
});

// Ürün onayla
router.patch("/menu-items/:id/approve", requireRole(['admin','super_admin','support']), async (req, res) => {
    try {
        const mealId = parseInt(req.params.id);
        const meal = await Meal.findByPk(mealId);
        if (!meal) return res.status(404).json({ success: false, message: "Ürün bulunamadı." });

        await meal.update({ is_approved: true });
        if (global.io) {
            global.io.emit('menu_updated', { sellerId: meal.seller_id });
        }
        res.json({ success: true, message: "Ürün onaylandı." });
    } catch (error) {
        console.error("Admin menu-item approve error:", error);
        res.status(500).json({ success: false, message: "Ürün onaylanamadı." });
    }
});

// Ürün sil (admin)
router.delete("/menu-items/:id", requireRole(['admin','super_admin','support']), async (req, res) => {
    try {
        const mealId = parseInt(req.params.id);
        const meal = await Meal.findByPk(mealId);
        if (!meal) return res.status(404).json({ success: false, message: "Ürün bulunamadı." });
        const sellerIdForEvent = meal.seller_id;
        await meal.destroy();
        if (global.io) {
            global.io.emit('menu_updated', { sellerId: sellerIdForEvent });
        }
        res.json({ success: true, message: "Ürün silindi." });
    } catch (error) {
        console.error("Admin menu-item delete error:", error);
        res.status(500).json({ success: false, message: "Ürün silinemedi." });
    }
});
// --- ADMİN MENÜ KONTROL BİTİŞ ---

module.exports = router;
