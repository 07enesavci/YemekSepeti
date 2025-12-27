const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const { requireRole } = require("../../middleware/auth");
const { Seller, Meal } = require("../../models");

router.get("/menu", requireRole('seller'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        const seller = await Seller.findOne({
            where: { user_id: userId },
            attributes: ['id']
        });
        if (!seller) {
            return res.status(404).json({
                success: false,
                message: "Satıcı kaydı bulunamadı."
            });
        }
        const meals = await Meal.findAll({
            where: { seller_id: seller.id },
            attributes: ['id', 'category', 'name', 'description', 'price', 'image_url', 'is_available'],
            order: [['category', 'ASC'], ['name', 'ASC']]
        });
        
        const menu = meals.map(meal => {
            let mealImageUrl = meal.image_url;
            if (!mealImageUrl || mealImageUrl.trim() === '' || 
                mealImageUrl.includes('placeholder')) {
                mealImageUrl = null;
            }
            
            return {
                id: meal.id,
                category: meal.category,
                name: meal.name,
                description: meal.description || "",
                price: parseFloat(meal.price) || 0,
                imageUrl: mealImageUrl,
                isAvailable: meal.is_available
            };
        });
        
        res.json({ success: true, menu });
    } catch (error) {
        res.status(500).json({ success: false, message: "Sunucu hatası." });
    }
});

router.post("/menu", requireRole('seller'), async (req, res) => {
    try {
        const sellerId = req.session.user.id;
        const { category, name, description, price, imageUrl, isAvailable = true } = req.body;
        if (!category || !name || !price) {
            return res.status(400).json({
                success: false,
                message: "Kategori, isim ve fiyat gereklidir."
            });
        }
        
        let finalImageUrl = null;
        if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim() !== '') {
            finalImageUrl = imageUrl.trim();
            if (finalImageUrl.length > 1000) {
                return res.status(400).json({
                    success: false,
                    message: "Resim URL'si çok uzun. Maksimum 1000 karakter."
                });
            }
        }
        
        const sellerQuery = await db.query(
            "SELECT id FROM sellers WHERE user_id = ?",
            [sellerId]
        );
        
        if (sellerQuery.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Satıcı kaydı bulunamadı."
            });
        }
        
        const shopId = sellerQuery[0].id;
        const result = await db.execute(
            `INSERT INTO meals (seller_id, category, name, description, price, image_url, is_available)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [shopId, category, name, description || null, price, finalImageUrl, isAvailable]
        );
        
        res.status(201).json({
            success: true,
            message: "Yemek başarıyla eklendi.",
            meal: {
                id: result.insertId,
                category, name, description, price,
                imageUrl: finalImageUrl,
                isAvailable
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

router.put("/menu/:id", requireRole('seller'), async (req, res) => {
    try {
        const mealId = parseInt(req.params.id);
        const userId = req.session.user.id;
        const { category, name, description, price, imageUrl, isAvailable } = req.body;
        const sellerQuery = await db.query(
            "SELECT id FROM sellers WHERE user_id = ?",
            [userId]
        );
        
        if (sellerQuery.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Satıcı kaydı bulunamadı."
            });
        }
        
        const shopId = sellerQuery[0].id;
        const mealCheck = await db.query(
            "SELECT id FROM meals WHERE id = ? AND seller_id = ?",
            [mealId, shopId]
        );
        
        if (mealCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Yemek bulunamadı veya size ait değil."
            });
        }
        
        const updateFields = [];
        const updateValues = [];
        
        if (category !== undefined) {
            updateFields.push("category = ?");
            updateValues.push(category);
        }
        if (name !== undefined) {
            updateFields.push("name = ?");
            updateValues.push(name);
        }
        if (description !== undefined) {
            updateFields.push("description = ?");
            updateValues.push(description);
        }
        if (price !== undefined) {
            updateFields.push("price = ?");
            updateValues.push(price);
        }
        if (imageUrl !== undefined) {
            let finalImageUrl = null;
            if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim() !== '') {
                finalImageUrl = imageUrl.trim();
                if (finalImageUrl.length > 1000) {
                    return res.status(400).json({
                        success: false,
                        message: "Resim URL'si çok uzun. Maksimum 1000 karakter."
                    });
                }
            }
            updateFields.push("image_url = ?");
            updateValues.push(finalImageUrl);
        }
        if (isAvailable !== undefined) {
            updateFields.push("is_available = ?");
            updateValues.push(isAvailable);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Güncellenecek alan belirtilmedi."
            });
        }
        
        updateValues.push(mealId, shopId);
        const updateQuery = `UPDATE meals SET ${updateFields.join(", ")}, updated_at = NOW() WHERE id = ? AND seller_id = ?`;
        await db.execute(updateQuery, updateValues);
        
        res.json({ success: true, message: "Yemek başarıyla güncellendi." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Sunucu hatası." });
    }
});

router.delete("/menu/:id", requireRole('seller'), async (req, res) => {
    try {
        const mealId = parseInt(req.params.id);
        const sellerId = req.session.user.id;
        
        const sellerQuery = await db.query(
            "SELECT id FROM sellers WHERE user_id = ?",
            [sellerId]
        );
        
        if (sellerQuery.length === 0) {
            return res.status(404).json({ success: false, message: "Satıcı kaydı bulunamadı." });
        }
        
        const shopId = sellerQuery[0].id;
        const mealCheck = await db.query(
            "SELECT id FROM meals WHERE id = ? AND seller_id = ?",
            [mealId, shopId]
        );
        
        if (mealCheck.length === 0) {
            return res.status(404).json({ success: false, message: "Yemek bulunamadı veya size ait değil." });
        }
        
        await db.execute("DELETE FROM meals WHERE id = ? AND seller_id = ?", [mealId, shopId]);
        res.json({ success: true, message: "Yemek başarıyla silindi." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Sunucu hatası." });
    }
});

router.get("/earnings", requireRole('seller'), async (req, res) => {
    try {
        const sellerId = req.session.user.id;
        const { period = 'month' } = req.query;
        
        const sellerQuery = await db.query(
            "SELECT id FROM sellers WHERE user_id = ?",
            [sellerId]
        );
        
        if (sellerQuery.length === 0) {
            return res.status(404).json({ success: false, message: "Satıcı kaydı bulunamadı." });
        }
        
        const shopId = sellerQuery[0].id;
        let dateFilter = '';
        if (period === 'day') {
            dateFilter = "DATE(o.created_at) = CURDATE()";
        } else if (period === 'week') {
            dateFilter = "o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
        } else if (period === 'month') {
            dateFilter = "o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
        }
        
        const query = `
            SELECT 
                COUNT(*) as total_orders,
                COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.subtotal ELSE 0 END), 0) as total_revenue,
                COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.delivery_fee ELSE 0 END), 0) as total_delivery_fees,
                COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.discount_amount ELSE 0 END), 0) as total_discounts,
                COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.total_amount ELSE 0 END), 0) as total_earnings,
                COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) as completed_orders,
                COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as cancelled_orders
            FROM orders o
            WHERE o.seller_id = ?
            ${dateFilter ? `AND ${dateFilter}` : ''}
        `;
        
        const stats = await db.query(query, [shopId]);
        
        res.json({
            success: true,
            period: period,
            stats: {
                totalOrders: parseInt(stats[0].total_orders) || 0,
                totalRevenue: parseFloat(stats[0].total_revenue) || 0,
                totalDeliveryFees: parseFloat(stats[0].total_delivery_fees) || 0,
                totalDiscounts: parseFloat(stats[0].total_discounts) || 0,
                totalEarnings: parseFloat(stats[0].total_earnings) || 0,
                completedOrders: parseInt(stats[0].completed_orders) || 0,
                cancelledOrders: parseInt(stats[0].cancelled_orders) || 0
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

router.get("/dashboard", requireRole('seller'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        const sellerQuery = await db.query(
            "SELECT id, shop_name FROM sellers WHERE user_id = ?",
            [userId]
        );
        
        if (sellerQuery.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Satıcı kaydı bulunamadı."
            });
        }
        
        const shopId = sellerQuery[0].id;
        const shopName = sellerQuery[0].shop_name;
        const userInfo = await db.query(
            "SELECT fullname FROM users WHERE id = ?",
            [userId]
        );
        const fullname = (userInfo && userInfo.length > 0) ? userInfo[0].fullname : '';
        const todayStats = await db.query(`
            SELECT 
                COUNT(CASE WHEN o.status IN ('pending', 'confirmed') THEN 1 END) as new_orders,
                COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) as completed_orders,
                COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.total_amount ELSE 0 END), 0) as today_earnings,
                COALESCE(AVG(s.rating), 0) as shop_rating
            FROM orders o
            LEFT JOIN sellers s ON s.id = o.seller_id
            WHERE o.seller_id = ?
            AND DATE(o.created_at) = CURDATE()
        `, [shopId]);
        const recentOrders = await db.query(`
            SELECT 
                o.id,
                o.order_number,
                o.status,
                o.total_amount as total,
                o.created_at as date,
                CONCAT(SUBSTRING(u.fullname, 1, 1), '*** ', SUBSTRING(u.fullname, -1)) as customer_name,
                GROUP_CONCAT(CONCAT(oi.quantity, ' x ', oi.meal_name) SEPARATOR ', ') as items
            FROM orders o
            INNER JOIN users u ON o.user_id = u.id
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.seller_id = ?
            GROUP BY o.id
            ORDER BY o.created_at DESC
            LIMIT 5
        `, [shopId]);
        
        const stats = todayStats[0] || {};
        
        res.json({
            success: true,
            shopName: shopName,
            fullname: fullname,
            stats: {
                newOrders: parseInt(stats.new_orders) || 0,
                completedOrders: parseInt(stats.completed_orders) || 0,
                todayEarnings: parseFloat(stats.today_earnings) || 0,
                shopRating: parseFloat(stats.shop_rating) || 0
            },
            recentOrders: recentOrders.map(order => ({
                id: order.id,
                orderNumber: order.order_number,
                customer: order.customer_name,
                items: order.items || 'Belirtilmemiş',
                total: parseFloat(order.total) || 0,
                status: order.status,
                date: new Date(order.date).toLocaleString('tr-TR')
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

router.put("/profile", requireRole('seller'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { email, fullname, shopName, description, location, workingHours, logoUrl, bannerUrl } = req.body;
        const sellerQuery = await db.query(
            "SELECT id FROM sellers WHERE user_id = ?",
            [userId]
        );
        
        if (sellerQuery.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Satıcı kaydı bulunamadı."
            });
        }
        
        const shopId = sellerQuery[0].id;
        if (email !== undefined) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: "Geçerli bir e-posta adresi giriniz."
                });
            }
            const existingEmail = await db.query(
                "SELECT id FROM users WHERE email = ? AND id != ?",
                [email, userId]
            );
            
            if (existingEmail && existingEmail.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Bu e-posta adresi zaten kullanılıyor."
                });
            }
            await db.execute(
                "UPDATE users SET email = ? WHERE id = ?",
                [email, userId]
            );
        }
        if (fullname !== undefined) {
            if (!fullname || typeof fullname !== 'string' || fullname.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: "Ad soyad boş olamaz."
                });
            }
            await db.execute(
                "UPDATE users SET fullname = ? WHERE id = ?",
                [fullname.trim(), userId]
            );
            if (req.session && req.session.user) {
                req.session.user.fullname = fullname.trim();
            }
        }
        const updateFields = [];
        const updateValues = [];
        
        if (shopName !== undefined) {
            updateFields.push("shop_name = ?");
            updateValues.push(shopName);
        }
        if (description !== undefined) {
            updateFields.push("description = ?");
            updateValues.push(description);
        }
        if (location !== undefined) {
            updateFields.push("location = ?");
            updateValues.push(location);
        }
        if (workingHours !== undefined) {
            let hoursValue = null;
            if (workingHours === '' || workingHours === null || workingHours === undefined) {
                hoursValue = null;
            } else {
                const trimmed = typeof workingHours === 'string' ? workingHours.trim() : String(workingHours).trim();
                if (trimmed !== '' && trimmed !== 'null' && trimmed !== 'undefined') {
                    if (typeof workingHours === 'string') {
                        try {
                            const parsed = JSON.parse(workingHours);
                            hoursValue = JSON.stringify(parsed);
                        } catch (e) {
                            hoursValue = JSON.stringify({ hours: workingHours });
                        }
                    } else if (typeof workingHours === 'object') {
                        hoursValue = JSON.stringify(workingHours);
                    } else {
                        hoursValue = JSON.stringify({ hours: String(workingHours) });
                    }
                } else {
                    hoursValue = null;
                }
            }
            updateFields.push("opening_hours = ?");
            updateValues.push(hoursValue);
        }
        if (logoUrl !== undefined) {
            if (logoUrl === null) {
                const currentSeller = await db.query(
                    "SELECT logo_url FROM sellers WHERE id = ?",
                    [shopId]
                );
                if (currentSeller && currentSeller.length > 0 && currentSeller[0].logo_url) {
                    const oldLogoUrl = currentSeller[0].logo_url;
                    try {
                        const fs = require('fs');
                        const path = require('path');
                        const oldFilePath = path.join(__dirname, '../../public', oldLogoUrl);
                        if (fs.existsSync(oldFilePath)) {
                            fs.unlinkSync(oldFilePath);
                        }
                    } catch (deleteError) {}
                }
            }
            updateFields.push("logo_url = ?");
            updateValues.push(logoUrl);
        }
        if (bannerUrl !== undefined) {
            if (bannerUrl === null) {
                const currentSeller = await db.query(
                    "SELECT banner_url FROM sellers WHERE id = ?",
                    [shopId]
                );
                if (currentSeller && currentSeller.length > 0 && currentSeller[0].banner_url) {
                    const oldBannerUrl = currentSeller[0].banner_url;
                    try {
                        const fs = require('fs');
                        const path = require('path');
                        const oldFilePath = path.join(__dirname, '../../public', oldBannerUrl);
                        if (fs.existsSync(oldFilePath)) {
                            fs.unlinkSync(oldFilePath);
                        }
                    } catch (deleteError) {}
                }
            }
            updateFields.push("banner_url = ?");
            updateValues.push(bannerUrl);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Güncellenecek alan belirtilmedi."
            });
        }
        
        updateValues.push(shopId);
        await db.execute(
            `UPDATE sellers SET ${updateFields.join(", ")} WHERE id = ?`,
            updateValues
        );
        
        res.json({
            success: true,
            message: "Profil başarıyla güncellendi."
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

router.get("/profile", requireRole('seller'), async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Oturum bulunamadı."
            });
        }
        
        const userId = req.session.user.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Oturum bulunamadı."
            });
        }
        
        const sellerQuery = await db.query(
            "SELECT id FROM sellers WHERE user_id = ?",
            [userId]
        );
        if (!sellerQuery || sellerQuery.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Satıcı kaydı bulunamadı."
            });
        }
        
        const shopId = sellerQuery[0].id;
        const userInfo = await db.query(
            "SELECT email, fullname FROM users WHERE id = ?",
            [userId]
        );
        
        const profile = await db.query(
            `SELECT 
                shop_name as shopName,
                description,
                location,
                opening_hours as workingHours,
                logo_url as logoUrl,
                banner_url as bannerUrl
            FROM sellers 
            WHERE id = ?`,
            [shopId]
        );
        if (!profile || profile.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Profil bulunamadı."
            });
        }
        const profileData = { ...profile[0] };
        profileData.email = (userInfo && userInfo.length > 0) ? userInfo[0].email : '';
        profileData.fullname = (userInfo && userInfo.length > 0) ? userInfo[0].fullname : '';
        profileData.shopName = profileData.shopName || '';
        profileData.description = profileData.description || '';
        profileData.location = profileData.location || '';
        profileData.logoUrl = profileData.logoUrl || null;
        profileData.bannerUrl = profileData.bannerUrl || null;
        if (profileData.workingHours === null || profileData.workingHours === undefined) {
            profileData.workingHours = '';
        } else if (typeof profileData.workingHours === 'string') {
            if (profileData.workingHours.trim() === '') {
                profileData.workingHours = '';
            } else {
                try {
                    const parsed = JSON.parse(profileData.workingHours);
                    profileData.workingHours = parsed;
                } catch (e) {}
            }
        } else if (typeof profileData.workingHours === 'object') {}
        res.json({
            success: true,
            profile: profileData
        });
    } catch (error) {
        const errorMessage = process.env.NODE_ENV === 'development' ? error.message : "Sunucu hatası.";
        res.status(500).json({
            success: false,
            message: "Sunucu hatası.",
            error: errorMessage
        });
    }
});

router.get("/coupons", requireRole('seller'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        const sellerQuery = await db.query(
            "SELECT id FROM sellers WHERE user_id = ?",
            [userId]
        );
        
        if (sellerQuery.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Satıcı kaydı bulunamadı."
            });
        }
        
        const sellerId = sellerQuery[0].id;
        const sql = `
            SELECT 
                id,
                code,
                description,
                discount_type,
                discount_value,
                min_order_amount,
                max_discount_amount,
                applicable_seller_ids,
                usage_limit,
                used_count,
                valid_from,
                valid_until,
                is_active,
                created_at
            FROM coupons
            WHERE (applicable_seller_ids IS NULL OR JSON_CONTAINS(applicable_seller_ids, ?))
            AND is_active = TRUE
            ORDER BY created_at DESC
        `;
        
        const coupons = await db.query(sql, [JSON.stringify([sellerId])]);
        
        const formattedCoupons = coupons.map(c => {
            let applicableSellers = null;
            try {
                if (c.applicable_seller_ids) {
                    applicableSellers = JSON.parse(c.applicable_seller_ids);
                }
            } catch (e) {
                applicableSellers = null;
            }
            
            return {
                id: c.id,
                code: c.code,
                description: c.description || '',
                discountType: c.discount_type,
                discountValue: parseFloat(c.discount_value) || 0,
                minOrderAmount: parseFloat(c.min_order_amount) || 0,
                maxDiscountAmount: c.max_discount_amount ? parseFloat(c.max_discount_amount) : null,
                applicableSellerIds: applicableSellers,
                usageLimit: c.usage_limit,
                usedCount: c.used_count,
                validFrom: c.valid_from,
                validUntil: c.valid_until,
                isActive: c.is_active,
                createdAt: c.created_at
            };
        });
        
        res.json({ success: true, coupons: formattedCoupons });
    } catch (error) {
        res.status(500).json({ success: false, message: "Kuponlar yüklenemedi." });
    }
});

router.post("/coupons", requireRole('seller'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { code, description, discountType, discountValue, minOrderAmount, maxDiscountAmount, validDays } = req.body;
        
        if (!code || !discountValue) {
            return res.status(400).json({
                success: false,
                message: "Kupon kodu ve indirim değeri gereklidir."
            });
        }
        
        const sellerQuery = await db.query(
            "SELECT id FROM sellers WHERE user_id = ?",
            [userId]
        );
        
        if (sellerQuery.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Satıcı kaydı bulunamadı."
            });
        }
        
        const sellerId = sellerQuery[0].id;
        const applicableSellerIds = JSON.stringify([sellerId]);
        const validUntil = validDays ? `DATE_ADD(NOW(), INTERVAL ${validDays} DAY)` : 'DATE_ADD(NOW(), INTERVAL 30 DAY)';
        
        const sql = `
            INSERT INTO coupons 
            (code, description, discount_type, discount_value, min_order_amount, max_discount_amount, 
             applicable_seller_ids, valid_from, valid_until, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ${validUntil}, ?)
        `;
        
        await db.execute(sql, [
            code,
            description || null,
            discountType || 'fixed',
            discountValue,
            minOrderAmount || 0,
            maxDiscountAmount || null,
            applicableSellerIds,
            userId
        ]);
        
        res.json({
            success: true,
            message: "Kupon başarıyla oluşturuldu."
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
                success: false,
                message: "Bu kupon kodu zaten kullanılıyor."
            });
        }
        res.status(500).json({
            success: false,
            message: "Kupon oluşturulamadı."
        });
    }
});


router.options("/profile", (req, res) => {
    res.header("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.sendStatus(200);
});

module.exports = router;

