const express=require("express");
const router=express.Router();
const db=require("../../config/database");
const bcrypt=require("bcryptjs");
const { requireAuth, requireRole }=require("../../middleware/auth");
const { User, Seller }=require("../../models");
const { Op }=require("sequelize");

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
        const sql = "SELECT * FROM coupons ORDER BY created_at DESC";
        const coupons = await db.query(sql);
        const formattedCoupons = coupons.map(c => ({
            ...c,
            sellerIds: c.applicable_seller_ids,
            amount: c.discount_value
        }));
        res.json(formattedCoupons);
    } 
    catch (error) 
    {
        res.status(500).json({ success: false, message: "Veritabanı hatası." });
    }
});

router.post("/coupons", async (req, res) => {
    try 
    {
        const { code, description, discountType, discountValue, minOrderAmount, maxDiscountAmount, sellerIds, validDays } = req.body;
        
        if (!code || !discountValue) 
        {
            return res.status(400).json({ success: false, message: "Kupon kodu ve indirim değeri gereklidir." });
        }
        
        const amount = discountValue || req.body.amount;
        const type = discountType || 'fixed';
        let validUntil;
        if (validDays) 
        {
            validUntil = `DATE_ADD(NOW(), INTERVAL ${validDays} DAY)`;
        }
        else 
        {
            validUntil = 'DATE_ADD(NOW(), INTERVAL 30 DAY)';
        }
        
        const sellerIdsArray = sellerIds || req.body.sellerIds || [];
        let sellerIdsJson;
        if (sellerIdsArray.length === 0) 
        {
            sellerIdsJson = null;
        }
        else 
        {
            sellerIdsJson = JSON.stringify(sellerIdsArray);
        }
        
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
    } 
    catch (error) 
    {
        if (error.code === 'ER_DUP_ENTRY') 
        {
            return res.status(400).json({ success: false, message: "Bu kupon kodu zaten kullanılıyor." });
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

module.exports = router;