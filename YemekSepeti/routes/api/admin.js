const express=require("express");
const router=express.Router();
const db=require("../../config/database");
const bcrypt=require("bcryptjs");
const { requireAuth, requireRole }=require("../../middleware/auth");
const { User, Seller, Courier, Order, OrderItem, Meal, Review, Address, Coupon, CouponUsage, CourierTask, Feedback }=require("../../models");
const { recalculateSellerRatings } = require("../../lib/sellerRatingHelper");
const { Op, Sequelize }=require("sequelize");
const { sequelize }=require("../../models");
const { sendSellerApprovalEmail, sendSellerRejectionEmail, sendCourierApprovalEmail, sendCourierRejectionEmail }=require("../../config/email");
const { createCouponValidation, idParam, handleValidationErrors }=require("../../middleware/validate");
const { validatePassword }=require("../../lib/passwordPolicy");

router.use((req,res,next)=>{ requireAuth(req,res,next); });

router.use((req,res,next)=>{ requireRole(['admin','super_admin','support'])(req,res,next); });

router.get("/users", async (req, res) => {
    try
    {
        const { role, search, status: statusFilter, page = 1, limit = 100 } = req.query;
        const safeLimit = Math.max(1, Math.min(500, parseInt(limit) || 100));
        const offset = (Math.max(1, parseInt(page)) - 1) * safeLimit;

        const where = { role: { [Op.in]: ['seller', 'courier', 'user', 'buyer'] } };
        if (role && ['seller','courier','buyer','user'].includes(role)) {
            where.role = role === 'buyer' ? { [Op.in]: ['buyer','user'] } : role;
        }
        // Durum filtresi
        if (statusFilter === 'active') {
            where.is_active = true;
        } else if (statusFilter === 'suspended') {
            where.is_active = false;
            where.fullname = { [Op.ne]: 'Silinmiş Kullanıcı' };
        } else if (statusFilter === 'deleted') {
            where.is_active = false;
            where.fullname = 'Silinmiş Kullanıcı';
        }
        if (search && search.trim()) {
            where[Op.or] = [
                { fullname: { [Op.like]: `%${search.trim()}%` } },
                { email: { [Op.like]: `%${search.trim()}%` } }
            ];
        }

        const result = await User.findAndCountAll({
            where,
            attributes: ['id', 'fullname', 'email', 'role', 'is_active', 'created_at'],
            order: [['created_at', 'DESC']],
            limit: safeLimit,
            offset: offset || 0
        });

        const formattedUsers = result.rows.map(u => {
            let status = 'active';
            if (!u.is_active) {
                status = u.fullname === 'Silinmiş Kullanıcı' ? 'deleted' : 'suspended';
            }
            return {
                id: u.id,
                fullname: u.fullname,
                email: u.email,
                role: u.role,
                is_active: u.is_active,
                created_at: u.created_at,
                status
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

        // Güvenlik: Admin/super_admin/support rolleri bu endpoint üzerinden oluşturulamaz
        const ALLOWED_ROLES = ['buyer', 'seller', 'courier'];
        if (!ALLOWED_ROLES.includes(role)) {
            return res.status(400).json({ success: false, message: "Geçersiz rol. Yalnızca buyer, seller veya courier oluşturulabilir." });
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

        if (global.io) global.io.to('admin').emit('admin_users_updated', {});
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

        // Admin/super_admin hesapları support tarafından askıya alınamaz
        const requestingRole = req.session?.user?.role;
        const PROTECTED_ROLES = ['admin', 'super_admin', 'support'];
        if (PROTECTED_ROLES.includes(user.role) && requestingRole !== 'super_admin') {
            return res.status(403).json({ success: false, message: "Sistem kullanıcıları askıya alınamaz." });
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
        if (global.io) global.io.to('admin').emit('admin_users_updated', {});
        res.json({ success: true, status: newStatus });
    } 
    catch (error) 
    {
        res.status(500).json({ success: false, message: "İşlem başarısız." });
    }
});

// Kullanıcı silme kalıcı/geri döndürülemez bir işlemdir — support rolü için kapsam dışı.
router.delete("/users/:id", requireRole(['admin','super_admin']), async (req, res) => {
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

        // Admin/super_admin/support hesapları silinemez; admin kendi hesabını silemez
        const requestingUserId = req.session?.user?.id;
        const requestingRole = req.session?.user?.role;
        if (['admin', 'super_admin', 'support'].includes(user.role)) {
            return res.status(403).json({ success: false, message: "Sistem kullanıcı hesapları bu panel üzerinden silinemez." });
        }
        if (requestingUserId === userId) {
            return res.status(403).json({ success: false, message: "Kendi hesabınızı silemezsiniz." });
        }

        // Aktif siparişi olan kullanıcı silinemez — geçmiş korunur
        const activeOrderCount = await Order.count({
            where: {
                user_id: userId,
                status: { [Op.in]: ['pending', 'confirmed', 'preparing', 'ready', 'on_delivery'] }
            }
        });
        if (activeOrderCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Kullanıcının ${activeOrderCount} aktif siparişi var. Siparişler tamamlanmadan hesap silinemez.`
            });
        }

        const userReviews = await Review.findAll({ where: { user_id: userId }, attributes: ['seller_id'] });

        // Soft-delete: e-posta korunur, isim "Silinmiş Kullanıcı" olarak değiştirilir
        await user.update({
            is_active: false,
            fullname: 'Silinmiş Kullanıcı',
            phone: null
        });

        // Kurye/Satıcı kaydı da devre dışı bırakılsın (raporlarda aktif sayılmasın)
        if (user.role === 'courier') {
            await Courier.update({ is_active: false }, { where: { user_id: userId } });
        }
        if (user.role === 'seller') {
            await Seller.update({ is_active: false }, { where: { user_id: userId } });
        }

        if (userReviews.length > 0) {
            const sellerIds = userReviews.map(r => r.seller_id);
            await recalculateSellerRatings(sellerIds);
        }

        if (global.io) global.io.to('admin').emit('admin_users_updated', {});
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
        const { status, search, page = 1, limit = 100 } = req.query;
        const safeLimit = Math.max(1, Math.min(500, parseInt(limit) || 100));
        const offset = (Math.max(1, parseInt(page)) - 1) * safeLimit;
        const sellerWhere = {};
        if (status === 'active') sellerWhere.is_active = true;
        else if (status === 'inactive') sellerWhere.is_active = false;

        const sellers = await Seller.findAll({
            where: sellerWhere,
            include: [{
                model: User,
                as: 'user',
                attributes: ['fullname', 'email', 'phone'],
                ...(search && search.trim() ? {
                    where: {
                        [Op.or]: [
                            { fullname: { [Op.like]: `%${search.trim()}%` } },
                            { email: { [Op.like]: `%${search.trim()}%` } }
                        ]
                    },
                    required: true
                } : {})
            }],
            order: [['created_at', 'DESC']],
            limit: safeLimit,
            offset: offset || 0
        });
        const formatted = sellers.map(s => ({
            id: s.id,
            shop_name: s.shop_name,
            location: s.location,
            is_active: s.is_active,
            is_open: s.is_open,
            has_own_couriers: !!s.has_own_couriers,
            logo_url: s.logo_url || null,
            created_at: s.created_at,
            user_id: s.user_id,
            owner_name: s.user ? s.user.fullname : null,
            email: s.user ? s.user.email : null,
            phone: s.user ? s.user.phone : null
        }));
        res.json(formatted);
    }
    catch (error)
    {
        res.status(500).json({ success: false, message: "Veritabanı hatası." });
    }
});

router.get("/coupons", async (req, res) => {
    try
    {
        const { page = 1, limit = 50, search, filter } = req.query;
        const safeLimit = Math.max(1, Math.min(200, parseInt(limit) || 50));
        const safeOffset = (Math.max(1, parseInt(page)) - 1) * safeLimit;
        let sql = "SELECT id, code, description, discount_type, discount_value, min_order_amount, max_discount_amount, applicable_seller_ids, usage_limit, used_count, valid_from, valid_until, is_active, created_at FROM coupons";
        const params = [];
        const conditions = [];

        // Durum filtresi: active, inactive (pasifleştirilmiş), expired (süresi dolmuş)
        if (filter === 'active') {
            conditions.push("is_active = 1 AND valid_until >= NOW()");
        } else if (filter === 'inactive') {
            conditions.push("is_active = 0");
        } else if (filter === 'expired') {
            conditions.push("valid_until < NOW()");
        }
        // Varsayılan: tümünü göster (geçmiş dahil)

        if (search && search.trim()) {
            conditions.push("(code LIKE ? OR description LIKE ?)");
            params.push(`%${search.trim()}%`, `%${search.trim()}%`);
        }
        if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
        // LIMIT/OFFSET integer olarak doğrudan gömülür (mysql2 prepared stmt uyumsuzluğu)
        sql += ` ORDER BY created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`;
        const rows = await db.query(sql, params);
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

// Kupon CRUD finansal etkilidir — support rolü için kapsam dışı (sadece admin/super_admin).
router.post("/coupons", requireRole(['admin','super_admin']), createCouponValidation, handleValidationErrors, async (req, res) => {
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
        
        if (global.io) global.io.to('admin').emit('admin_coupons_updated', {});
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

router.put("/coupons/:id", requireRole(['admin','super_admin']), idParam, handleValidationErrors, async (req, res) => {
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
        if (global.io) global.io.to('admin').emit('admin_coupons_updated', {});
        res.json({ success: true, message: "Kupon güncellendi." });
    } 
    catch (error) 
    {
        console.error("Kupon güncelleme hatası:", error);
        res.status(500).json({ success: false, message: "Kupon güncellenemedi." });
    }
});

router.delete("/coupons/:id", requireRole(['admin','super_admin']), idParam, handleValidationErrors, async (req, res) => {
    try 
    {
        const couponId = parseInt(req.params.id, 10);
        const sql = "DELETE FROM coupons WHERE id = ?";
        const result = await db.execute(sql, [couponId]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Kupon bulunamadı." });
        if (global.io) global.io.to('admin').emit('admin_coupons_updated', {});
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
        if (global.io) {
            global.io.to('admin').emit('admin_sellers_updated', {});
            global.io.to(`user-${seller.user_id}`).emit('account_approved', {
                message: 'Hesabınız onaylandı! Mağazanızı yönetmeye başlayabilirsiniz.'
            });
        }
        res.json({ success: true, message: "Satıcı onaylandı ve mağaza aktif edildi!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Onaylama işlemi sırasında hata oluştu." });
    }
});

// 3. Satıcıyı Reddet ve Sil (POST) — Red e-postası gönderilir, sonra satıcı + kullanıcı silinir
// Kalıcı silme işlemi — support rolü için kapsam dışı (yalnızca admin/super_admin).
router.post("/reject-seller/:id", requireRole(['admin','super_admin']), async (req, res) => {
    try {
        const seller = await Seller.findByPk(req.params.id);
        if (!seller) return res.status(404).json({ success: false, message: "Satıcı bulunamadı." });

        const user = await User.findByPk(seller.user_id);
        if (user && user.email) {
            await sendSellerRejectionEmail(user.email).catch(err => console.error('Red e-postası gönderilemedi:', err));
        }
        const userId = seller.user_id;
        // Kullanıcıya bildir, sonra sil
        if (global.io) {
            global.io.to(`user-${userId}`).emit('account_rejected', {
                message: 'Başvurunuz reddedildi. Detaylar için destek ile iletişime geçin.'
            });
        }
        await seller.destroy();
        // Kullanıcıyı yalnızca seller rolündeyse sil
        const userToDelete = await User.findByPk(userId, { attributes: ['id', 'role'] });
        if (userToDelete && userToDelete.role === 'seller') {
            await User.destroy({ where: { id: userId } });
        }
        if (global.io) global.io.to('admin').emit('admin_sellers_updated', {});
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
            ordersDateFilter = " AND o.created_at >= ? AND o.created_at <= ?";
            ordersReplacements.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
        }
        const recentOrdersQuery = `
            SELECT o.id, o.order_number, o.total_amount, o.status, o.created_at, o.payment_method, o.delivery_type, u.fullname as customer_name, c.fullname as courier_name 
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN users c ON o.courier_id = c.id
            WHERE o.seller_id = ?${ordersDateFilter}
            ORDER BY o.created_at DESC 
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
        if (global.io) {
            global.io.to('admin').emit('admin_couriers_updated', {});
            global.io.to(`user-${courier.user_id}`).emit('account_approved', {
                message: 'Hesabınız onaylandı! Artık teslimat görevleri alabilirsiniz.'
            });
        }
        res.json({ success: true, message: "Kurye onaylandı!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Onaylama işlemi sırasında hata oluştu." });
    }
});
// Kalıcı silme işlemi — support rolü için kapsam dışı (yalnızca admin/super_admin).
router.post("/reject-courier/:id", requireRole(['admin','super_admin']), async (req, res) => {
    try {
        const courier = await Courier.findByPk(req.params.id);
        if (!courier) return res.status(404).json({ success: false, message: "Kurye bulunamadı." });
        const user = await User.findByPk(courier.user_id);
        if (user && user.email) await sendCourierRejectionEmail(user.email).catch(err => console.error('Red e-postası gönderilemedi:', err));
        const userId = courier.user_id;
        if (global.io) {
            global.io.to(`user-${userId}`).emit('account_rejected', {
                message: 'Kurye başvurunuz reddedildi. Destek ile iletişime geçebilirsiniz.'
            });
        }
        await courier.destroy();
        // Kullanıcıyı sadece başka bir rolü yoksa sil (buyer rollü de olmadığından emin ol)
        const userCheck = await User.findByPk(userId, { attributes: ['id', 'role'] });
        if (userCheck && userCheck.role === 'courier') {
            await User.destroy({ where: { id: userId } });
        }
        if (global.io) global.io.to('admin').emit('admin_couriers_updated', {});
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

        // Raw SQL ile güvenli kurye listesi — sütun bağımlılığını minimize et
        let sql = `
            SELECT
                u.id, u.fullname, u.email, u.phone, u.is_active, u.created_at,
                COALESCE(u.courier_status, 'offline') as courier_status,
                u.last_latitude, u.last_longitude,
                c.id as courier_id, c.is_active as courier_is_active,
                u.vehicle_type, c.seller_id
            FROM users u
            LEFT JOIN couriers c ON c.user_id = u.id
            WHERE u.role = 'courier'
              AND u.fullname != 'Silinmiş Kullanıcı'
        `;
        const replacements = [];

        if (status === 'online' || status === 'offline') {
            sql += ` AND COALESCE(u.courier_status, 'offline') = ?`;
            replacements.push(status);
        } else if (status === 'pending') {
            sql += ` AND (c.is_active = 0 OR c.id IS NULL)`;
        } else if (status === 'active') {
            sql += ` AND u.is_active = 1 AND c.is_active = 1`;
        }

        if (vehicleType && vehicleType !== 'all') {
            sql += ` AND c.vehicle_type = ?`;
            replacements.push(vehicleType);
        }

        if (search && search.trim()) {
            sql += ` AND (u.fullname LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)`;
            const s = `%${search.trim()}%`;
            replacements.push(s, s, s);
        }

        sql += ` ORDER BY u.created_at DESC LIMIT 200`;

        const rows = await sequelize.query(sql, {
            replacements,
            type: require('sequelize').QueryTypes.SELECT
        });

        const formatted = (rows || []).map(u => ({
            id: u.id,
            fullname: u.fullname,
            email: u.email,
            phone: u.phone,
            courier_status: u.courier_status || 'offline',
            is_active: !!u.is_active,
            last_latitude: u.last_latitude,
            last_longitude: u.last_longitude,
            created_at: u.created_at,
            courier: u.courier_id ? {
                id: u.courier_id,
                is_active: !!u.courier_is_active,
                vehicle_type: u.vehicle_type,
                seller_id: u.seller_id
            } : null
        }));

        res.json({ success: true, data: formatted });
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

// --- ADMİN SİPARİŞ YÖNETİMİ ---
// Gruplu durum filtreleri — admin panelindeki "Beklemede / Hazır / Kuryede" sekmeleri.
// Sipariş yaşam döngüsü: pending → confirmed → preparing → ready → on_delivery → delivered
const ORDER_STATUS_GROUPS = {
    beklemede: ['pending', 'confirmed', 'preparing'], // henüz hazırlanıyor / bekliyor
    hazir: ['ready'],                                  // hazır, alınmayı bekliyor
    kuryede: ['on_delivery'],                          // kuryede / yolda
    teslim: ['delivered'],                             // teslim edildi
    iptal: ['cancelled']                               // iptal edildi
};

router.get("/orders", requireRole(['admin','super_admin','support']), async (req, res) => {
    try {
        const { status, group, search, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        // Öncelik gruplu filtrede (beklemede/hazir/kuryede/teslim/iptal); yoksa tekil status
        if (group && ORDER_STATUS_GROUPS[group]) {
            where.status = { [Op.in]: ORDER_STATUS_GROUPS[group] };
        } else if (status && status !== 'all') {
            where.status = status;
        }
        if (search && search.trim()) {
            where[Op.or] = [
                { order_number: { [Op.like]: `%${search}%` } }
            ];
        }

        const result = await Order.findAndCountAll({
            where,
            include: [
                { model: User, as: 'buyer', attributes: ['fullname', 'email', 'phone'], required: false },
                { model: Seller, as: 'seller', attributes: ['shop_name'], required: false },
                { model: User, as: 'courier', attributes: ['fullname', 'phone'], required: false },
                { model: Address, as: 'address', attributes: ['title', 'full_address', 'district', 'city'], required: false },
                { model: OrderItem, as: 'items', attributes: ['meal_name', 'quantity', 'meal_price'], required: false }
            ],
            order: [['created_at', 'DESC']],
            distinct: true,
            limit: parseInt(limit) || 50,
            offset: offset || 0
        });

        res.json({
            success: true,
            data: result.rows.map(o => ({
                id: o.id,
                orderNumber: o.order_number,
                status: o.status,
                totalAmount: parseFloat(o.total_amount) || 0,
                deliveryFee: parseFloat(o.delivery_fee) || 0,
                paymentMethod: o.payment_method,
                deliveryType: o.delivery_type,
                cargoCompany: o.cargo_company || null,
                cargoTrackingNumber: o.cargo_tracking_number || null,
                cargoTrackingUrl: o.cargo_tracking_url || null,
                createdAt: o.created_at,
                deliveredAt: o.delivered_at,
                courierId: o.courier_id,
                buyer: o.buyer ? { fullname: o.buyer.fullname, email: o.buyer.email, phone: o.buyer.phone } : null,
                seller: o.seller ? { shopName: o.seller.shop_name } : null,
                courier: o.courier ? { fullname: o.courier.fullname, phone: o.courier.phone } : null,
                address: o.address ? {
                    title: o.address.title,
                    fullAddress: o.address.full_address,
                    district: o.address.district,
                    city: o.address.city
                } : null,
                items: Array.isArray(o.items) ? o.items.map(it => ({
                    name: it.meal_name,
                    quantity: it.quantity,
                    price: parseFloat(it.meal_price) || 0
                })) : []
            })),
            total: result.count,
            page: parseInt(page),
            totalPages: Math.ceil(result.count / (parseInt(limit) || 50))
        });
    } catch (err) {
        console.error("Admin orders error:", err);
        res.status(500).json({ success: false, message: "Siparişler yüklenemedi." });
    }
});

router.put("/orders/:id/status", requireRole(['admin','super_admin']), async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const { status } = req.body;
        const VALID = ['pending','confirmed','preparing','ready','on_delivery','delivered','cancelled'];
        if (!status || !VALID.includes(status)) {
            return res.status(400).json({ success: false, message: "Geçersiz durum." });
        }
        const order = await Order.findByPk(orderId);
        if (!order) return res.status(404).json({ success: false, message: "Sipariş bulunamadı." });

        // Admin iptali: iyzico iade + kupon kurtarma
        if (status === 'cancelled' && order.status !== 'cancelled') {
            // iyzico iadesi
            if (order.payment_method === 'iyzico' && order.iyzico_payment_data && !order.iyzico_refunded_at) {
                try {
                    const { refundIyzicoPaymentForOrder } = require('../../lib/iyzicoRefund');
                    await refundIyzicoPaymentForOrder(order, req.ip);
                    await order.update({ iyzico_refunded_at: new Date() });
                } catch (refErr) {
                    console.error('Admin iyzico iade hatası:', refErr);
                    return res.status(502).json({ success: false, message: "Ödeme iadesi tamamlanamadı." });
                }
            }
            // Kupon kurtarma
            if (order.coupon_code) {
                try {
                    const { CouponUsage, Coupon } = require('../../models');
                    const { Op } = require('sequelize');
                    const usageRow = await CouponUsage.findOne({ where: { order_id: orderId } });
                    if (usageRow) {
                        await CouponUsage.destroy({ where: { order_id: orderId } });
                        await Coupon.decrement('used_count', {
                            by: 1,
                            where: { id: usageRow.coupon_id, used_count: { [Op.gt]: 0 } }
                        });
                    }
                } catch (couponErr) {
                    console.error('Admin kupon kurtarma hatası:', couponErr);
                }
            }
            // Aktif kurye görevini iptal et
            if (order.courier_id) {
                await CourierTask.update({ status: 'cancelled' }, { where: { order_id: orderId } });
                if (global.io) {
                    global.io.to(`courier-${order.courier_id}`).emit('order_cancelled', {
                        id: order.id, orderNumber: order.order_number, status: 'cancelled'
                    });
                }
            }
        }

        const updateData = { status };
        if (status === 'delivered') updateData.delivered_at = new Date();
        await order.update(updateData);

        const { writeLog } = require('../../config/logger');
        writeLog('INFO', 'Admin sipariş durumu değiştirdi', {
            orderId, status, adminId: req.session?.user?.id
        });

        if (global.io) {
            // Alıcıya bildir
            global.io.to(`buyer-${order.user_id}`).emit('order_status_updated', {
                orderId, status, message: `Siparişinizin durumu güncellendi.`
            });
            // Satıcıya bildir (panelinin güncellenmesi için seller_id → user_id)
            try {
                const sellerRow = order.seller_id ? await Seller.findByPk(order.seller_id, { attributes: ['user_id'] }) : null;
                if (sellerRow && sellerRow.user_id) {
                    const evt = status === 'cancelled' ? 'order_cancelled' : 'order_status_updated';
                    global.io.to(`seller-${sellerRow.user_id}`).emit(evt, {
                        id: order.id, orderId, orderNumber: order.order_number, status
                    });
                }
            } catch (sellerNotifyErr) {
                console.error('Admin → satıcı bildirim hatası:', sellerNotifyErr.message);
            }
            // Diğer admin panelleri de canlı güncellensin
            global.io.to('admin').emit('admin_orders_updated', { reason: 'admin_status', orderId, status });
        }

        res.json({ success: true, message: "Sipariş durumu güncellendi." });
    } catch (err) {
        console.error("Admin order status error:", err);
        res.status(500).json({ success: false, message: "Durum güncellenemedi." });
    }
});
// --- ADMİN SİPARİŞ YÖNETİMİ BİTİŞ ---

// --- ADMİN ÖNERİ / ŞİKAYET YÖNETİMİ ---
const FEEDBACK_VALID_STATUS = ['open', 'in_review', 'resolved'];

// Tüm öneri/şikayetleri listele (rol/tür/durum filtreleri + arama)
router.get("/feedback", requireRole(['admin','super_admin','support']), async (req, res) => {
    try {
        const { role, type, status, search, page = 1, limit = 100 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        if (role && role !== 'all') where.role = role;
        if (type && type !== 'all') where.type = type;
        if (status && status !== 'all') where.status = status;
        if (search && search.trim()) {
            where[Op.or] = [
                { subject: { [Op.like]: `%${search.trim()}%` } },
                { message: { [Op.like]: `%${search.trim()}%` } }
            ];
        }

        const result = await Feedback.findAndCountAll({
            where,
            include: [{ model: User, as: 'user', attributes: ['fullname', 'email'], required: false }],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit) || 100,
            offset: offset || 0
        });

        // Özet sayaçlar (üstte rozet göstermek için)
        const openCount = await Feedback.count({ where: { status: 'open' } });

        res.json({
            success: true,
            openCount,
            data: result.rows.map(f => ({
                id: f.id,
                role: f.role,
                type: f.type,
                subject: f.subject,
                message: f.message,
                status: f.status,
                adminNote: f.admin_note,
                createdAt: f.created_at,
                user: f.user ? { fullname: f.user.fullname, email: f.user.email } : null
            })),
            total: result.count,
            page: parseInt(page),
            totalPages: Math.ceil(result.count / (parseInt(limit) || 100))
        });
    } catch (err) {
        console.error("Admin feedback list error:", err);
        res.status(500).json({ success: false, message: "Talepler yüklenemedi." });
    }
});

// Talebi güncelle: durum değiştir ve/veya yanıt ekle
router.put("/feedback/:id", requireRole(['admin','super_admin','support']), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { status, adminNote } = req.body;

        const feedback = await Feedback.findByPk(id);
        if (!feedback) return res.status(404).json({ success: false, message: "Talep bulunamadı." });

        const updateData = {};
        if (status !== undefined) {
            if (!FEEDBACK_VALID_STATUS.includes(status)) {
                return res.status(400).json({ success: false, message: "Geçersiz durum." });
            }
            updateData.status = status;
        }
        if (adminNote !== undefined) {
            updateData.admin_note = typeof adminNote === 'string' ? adminNote.trim().slice(0, 3000) : null;
        }
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ success: false, message: "Güncellenecek veri yok." });
        }

        await feedback.update(updateData);

        // Kullanıcıya bildirim gönder (yanıt eklendiğinde veya çözüldüğünde)
        try {
            const { createNotification } = require('../../lib/notificationHelper');
            const typeLabel = feedback.type === 'complaint' ? 'Şikayetiniz' : 'Öneriniz';
            if (updateData.admin_note) {
                await createNotification(feedback.user_id, 'feedback',
                    `${typeLabel} yanıtlandı`,
                    `"${feedback.subject}" başlıklı talebinize yanıt verildi.`, feedback.id);
            } else if (updateData.status === 'resolved') {
                await createNotification(feedback.user_id, 'feedback',
                    `${typeLabel} çözüldü`,
                    `"${feedback.subject}" başlıklı talebiniz çözüldü olarak işaretlendi.`, feedback.id);
            }
        } catch (notifyErr) {
            console.error('Feedback bildirim hatası:', notifyErr.message);
        }

        const { writeLog } = require('../../config/logger');
        writeLog('INFO', 'Admin öneri/şikayet güncelledi', { feedbackId: id, status: updateData.status, adminId: req.session?.user?.id });

        // Canlı güncelleme: kullanıcının "Taleplerim" sayfası + diğer adminlerin listesi otomatik yenilensin
        if (global.io) {
            global.io.to(`user-${feedback.user_id}`).emit('feedback_updated', { id: feedback.id, status: feedback.status });
            global.io.to('admin').emit('feedback_updated', { id: feedback.id, status: feedback.status });
        }

        res.json({ success: true, message: "Talep güncellendi." });
    } catch (err) {
        console.error("Admin feedback update error:", err);
        res.status(500).json({ success: false, message: "Talep güncellenemedi." });
    }
});
// --- ADMİN ÖNERİ / ŞİKAYET YÖNETİMİ BİTİŞ ---

// --- ADMİN RAPORLARI ---
// Tam ciro/finansal rapor — support rolü için kapsam dışı (sadece admin/super_admin).
router.get("/reports/summary", requireRole(['admin','super_admin']), async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        // İptal edilmemiş siparişleri say (cancelled hariç)
        const ACTIVE_STATUSES = { status: { [Op.ne]: 'cancelled' } };
        const totalOrders = await Order.count({ where: ACTIVE_STATUSES });
        const ordersToday = await Order.count({ where: { ...ACTIVE_STATUSES, created_at: { [Op.gte]: today } } });
        const ordersThisWeek = await Order.count({ where: { ...ACTIVE_STATUSES, created_at: { [Op.gte]: startOfWeek } } });
        const deliveredOrders = await Order.count({ where: { status: 'delivered' } });
        const revenueResult = await Order.findOne({
            where: { status: 'delivered' },
            attributes: [[Sequelize.fn('SUM', Sequelize.col('total_amount')), 'total']],
            raw: true
        });
        const totalRevenue = revenueResult && revenueResult.total != null ? parseFloat(revenueResult.total) : 0;
        const activeSellers = await Seller.count({ where: { is_active: true } });
        // Silinmiş kullanıcıları hariç tut: User.is_active=false olanların Courier kaydı sayılmaz
        const activeCouriers = await Courier.count({
            where: { is_active: true },
            include: [{ model: User, as: 'user', where: { is_active: true, fullname: { [Op.ne]: 'Silinmiş Kullanıcı' } }, attributes: [] }]
        });
        const totalUsers = await User.count({
            where: {
                role: { [Op.in]: ['buyer', 'seller', 'courier'] },
                is_active: true,
                fullname: { [Op.ne]: 'Silinmiş Kullanıcı' }
            }
        });

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

// Son 7 gün sipariş ve ciro verisi — tek GROUP BY sorgusuyla (N+1 yerine 2 sorgu)
router.get("/reports/chart", requireRole(['admin','super_admin']), async (req, res) => {
    try {
        const { sequelize: seq } = require('../../models');
        const since = new Date();
        since.setDate(since.getDate() - 6);
        since.setHours(0, 0, 0, 0);

        // Tüm günleri tek sorguda al
        const [orderRows] = await seq.query(
            `SELECT DATE(created_at) as day, COUNT(*) as orders FROM orders WHERE created_at >= ? GROUP BY DATE(created_at)`,
            { replacements: [since] }
        );
        const [revenueRows] = await seq.query(
            `SELECT DATE(created_at) as day, SUM(total_amount) as revenue FROM orders WHERE status='delivered' AND created_at >= ? GROUP BY DATE(created_at)`,
            { replacements: [since] }
        );

        const ordersMap = {};
        (orderRows || []).forEach(r => { ordersMap[r.day] = parseInt(r.orders) || 0; });
        const revenueMap = {};
        (revenueRows || []).forEach(r => { revenueMap[r.day] = parseFloat(r.revenue) || 0; });

        const result = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);
            const dayKey = d.toISOString().slice(0, 10);
            result.push({
                date: dayKey,
                label: d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
                orders: ordersMap[dayKey] || 0,
                revenue: Math.round((revenueMap[dayKey] || 0) * 100) / 100
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
        const { sellerId, search, isAvailable, isApproved, province, district, isUzakMesafe } = req.query;

        let whereClause = {};
        if (sellerId) whereClause.seller_id = parseInt(sellerId);
        if (isAvailable === 'true') whereClause.is_available = true;
        else if (isAvailable === 'false') whereClause.is_available = false;
        if (isApproved === 'true') whereClause.is_approved = true;
        else if (isApproved === 'false') whereClause.is_approved = false;
        
        // Uzak mesafe filtresi — sadece açıkça belirtilirse uygula, varsayılan olarak tümünü göster
        if (isUzakMesafe === 'true') {
            whereClause.is_uzak_mesafe = true;
        } else if (isUzakMesafe === 'false') {
            whereClause.is_uzak_mesafe = false;
        }
        // isUzakMesafe parametresi yoksa filtre uygulanmaz — admin tüm ürünleri görür
        
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
        const { name, category, description, price, image_url, is_available, is_approved, stock_quantity } = req.body;

        const meal = await Meal.findByPk(mealId);
        if (!meal) return res.status(404).json({ success: false, message: "Ürün bulunamadı." });

        const updates = {};
        if (name !== undefined) updates.name = String(name).trim();
        if (category !== undefined) updates.category = String(category).trim();
        if (description !== undefined) updates.description = description;
        if (price !== undefined) {
            const priceNum = parseFloat(price);
            if (isNaN(priceNum) || priceNum < 0) return res.status(400).json({ success: false, message: "Geçersiz fiyat." });
            updates.price = priceNum;
        }
        if (image_url !== undefined) updates.image_url = image_url;
        if (is_available !== undefined) updates.is_available = !!is_available;
        if (is_approved !== undefined) updates.is_approved = !!is_approved;  // Admin onay durumunu değiştirebilir
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

// --- YORUM SİLME İSTEKLERİ ---
router.get("/review-deletion-requests", async (req, res) => {
    try {
        const [rows] = await sequelize.query(`
            SELECT r.id, r.rating, r.comment, r.created_at, r.seller_id,
                   u.fullname AS user_name, s.shop_name AS seller_name
            FROM reviews r
            LEFT JOIN users u ON r.user_id = u.id
            LEFT JOIN sellers s ON r.seller_id = s.id
            WHERE r.deletion_requested = 1 AND r.is_visible = 1
            ORDER BY r.created_at DESC
        `);
        res.json({ success: true, requests: rows });
    } catch (err) {
        console.error("Admin review deletion requests error:", err);
        res.status(500).json({ success: false, message: "Veriler alınamadı.", _debug: err.message });
    }
});

router.post("/reviews/:id/approve-deletion", async (req, res) => {
    try {
        const reviewId = parseInt(req.params.id);
        const review = await Review.findOne({ where: { id: reviewId, deletion_requested: 1, is_visible: true } });
        if (!review) return res.status(404).json({ success: false, message: "Yorum bulunamadı veya istek aktif değil." });
        await review.update({ is_visible: false, deletion_requested: 0 });
        await recalculateSellerRatings([review.seller_id]);
        res.json({ success: true, message: "Yorum silindi." });
    } catch (err) {
        console.error("Admin approve deletion error:", err);
        res.status(500).json({ success: false, message: "İşlem başarısız." });
    }
});

router.post("/reviews/:id/reject-deletion", async (req, res) => {
    try {
        const reviewId = parseInt(req.params.id);
        const review = await Review.findOne({ where: { id: reviewId, deletion_requested: 1, is_visible: true } });
        if (!review) return res.status(404).json({ success: false, message: "Yorum bulunamadı veya istek aktif değil." });
        await review.update({ deletion_requested: 0, deletion_rejected: 1 });
        res.json({ success: true, message: "Silme isteği reddedildi." });
    } catch (err) {
        console.error("Admin reject deletion error:", err);
        res.status(500).json({ success: false, message: "İşlem başarısız." });
    }
});
// --- YORUM SİLME İSTEKLERİ BİTİŞ ---

// --- ADMIN AYARLARI ---
router.post("/settings/change-password", async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword)
            return res.status(400).json({ success: false, message: "Tüm alanlar zorunludur." });
        const pwCheck = validatePassword(newPassword);
        if (!pwCheck.ok)
            return res.status(400).json({ success: false, message: pwCheck.message });

        const user = await User.findByPk(req.session.user.id, { attributes: ['id', 'password'] });
        if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });

        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) return res.status(401).json({ success: false, message: "Mevcut şifre yanlış." });

        const hashed = await bcrypt.hash(newPassword, 10);
        await user.update({ password: hashed });

        req.session.destroy(() => {});
        res.json({ success: true, message: "Şifre güncellendi. Lütfen tekrar giriş yapın." });
    } catch (err) {
        console.error("Admin change-password error:", err);
        res.status(500).json({ success: false, message: "Şifre değiştirilemedi." });
    }
});

router.post("/settings/update-profile", async (req, res) => {
    try {
        const { fullname, email } = req.body;
        if (!fullname || !email)
            return res.status(400).json({ success: false, message: "Ad ve e-posta zorunludur." });

        const emailTrimmed = email.trim().toLowerCase();
        const existing = await User.findOne({ where: { email: emailTrimmed } });
        if (existing && existing.id !== req.session.user.id)
            return res.status(400).json({ success: false, message: "Bu e-posta başka bir hesapta kullanılıyor." });

        await User.update({ fullname: fullname.trim(), email: emailTrimmed }, { where: { id: req.session.user.id } });

        req.session.user.fullname = fullname.trim();
        req.session.user.email = emailTrimmed;
        req.session.save(() => {});

        res.json({ success: true, message: "Profil güncellendi." });
    } catch (err) {
        console.error("Admin update-profile error:", err);
        res.status(500).json({ success: false, message: "Profil güncellenemedi." });
    }
});
// --- ADMIN AYARLARI BİTİŞ ---

module.exports = router;
