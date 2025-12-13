const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const { requireRole } = require("../../middleware/auth");

// ============================================
// SELLER MENU ENDPOINTS (Satıcı menü yönetimi)
// ============================================

/**
 * GET /api/seller/menu
 * Satıcının kendi menüsünü getir
 */
router.get("/menu", requireRole('seller'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        console.log('📥 GET /api/seller/menu - User ID:', userId);
        
        // Kullanıcının seller_id'sini bul
        const sellerQuery = await db.query(
            "SELECT id FROM sellers WHERE user_id = ?",
            [userId]
        );
        
        if (sellerQuery.length === 0) {
            console.log('❌ Satıcı kaydı bulunamadı, user_id:', userId);
            return res.status(404).json({
                success: false,
                message: "Satıcı kaydı bulunamadı."
            });
        }
        
        const shopId = sellerQuery[0].id;
        console.log('✅ Seller ID bulundu:', shopId);
        
        const menuQuery = `
            SELECT 
                id,
                category,
                name,
                description,
                price,
                image_url as imageUrl,
                is_available as isAvailable
            FROM meals
            WHERE seller_id = ?
            ORDER BY category, name
        `;
        
        const meals = await db.query(menuQuery, [shopId]);
        console.log(`✅ ${meals.length} meal bulundu`);
        
        const menu = meals.map(meal => {
            let mealImageUrl = meal.imageUrl;
            // Relative path'leri de kabul et (/uploads/...)
            if (!mealImageUrl || 
                mealImageUrl.trim() === '' || 
                mealImageUrl.includes('via.placeholder.com') ||
                mealImageUrl.includes('placeholder.com') ||
                mealImageUrl.includes('400x200.png') ||
                mealImageUrl.includes('250x150.png')) {
                mealImageUrl = null;
            }
            
            return {
                id: meal.id,
                category: meal.category,
                name: meal.name,
                description: meal.description || "",
                price: parseFloat(meal.price) || 0,
                imageUrl: mealImageUrl,
                isAvailable: meal.isAvailable
            };
        });
        
        res.json({
            success: true,
            menu: menu
        });
    } catch (error) {
        console.error("Menü getirme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

/**
 * POST /api/seller/menu
 * Yemek ekle
 */
router.post("/menu", requireRole('seller'), async (req, res) => {
    try {
        const sellerId = req.session.user.id;
        const { category, name, description, price, imageUrl, isAvailable = true } = req.body;
        
        console.log('📥 POST /api/seller/menu - Request body:', req.body);
        
        if (!category || !name || !price) {
            return res.status(400).json({
                success: false,
                message: "Kategori, isim ve fiyat gereklidir."
            });
        }
        
        // ImageUrl validasyonu: boş string veya sadece boşluk ise null yap
        let finalImageUrl = null;
        if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim() !== '') {
            finalImageUrl = imageUrl.trim();
            
            // URL uzunluğunu kontrol et (max 1000 karakter)
            if (finalImageUrl.length > 1000) {
                console.warn('⚠️ URL çok uzun:', finalImageUrl.length, 'karakter');
                return res.status(400).json({
                    success: false,
                    message: `Resim URL'si çok uzun (${finalImageUrl.length} karakter). Maksimum 1000 karakter olmalıdır.`
                });
            }
            
            // URL formatını kontrol et (basit kontrol)
            try {
                new URL(finalImageUrl);
            } catch (urlError) {
                // Relative path kontrolü (/uploads/... gibi)
                if (!finalImageUrl.startsWith('/') && !finalImageUrl.startsWith('./')) {
                    console.warn('⚠️ Geçersiz URL formatı:', finalImageUrl);
                    // Yine de kaydet, belki relative path olabilir
                }
            }
        }
        
        console.log('📝 Final imageUrl:', finalImageUrl ? `${finalImageUrl.substring(0, 50)}... (${finalImageUrl.length} karakter)` : 'null');
        
        // Kullanıcının seller_id'sini bul
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
                category,
                name,
                description,
                price,
                imageUrl: finalImageUrl,
                isAvailable
            }
        });
    } catch (error) {
        console.error("❌ Yemek ekleme hatası:", error);
        console.error("❌ Error stack:", error.stack);
        console.error("❌ Error message:", error.message);
        res.status(500).json({
            success: false,
            message: error.message || "Sunucu hatası.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * PUT /api/seller/menu/:id
 * Yemek güncelle
 */
router.put("/menu/:id", requireRole('seller'), async (req, res) => {
    console.log('📥 PUT /api/seller/menu/:id - Meal ID:', req.params.id, 'Body:', req.body);
    try {
        const mealId = parseInt(req.params.id);
        const userId = req.session.user.id;
        const { category, name, description, price, imageUrl, isAvailable } = req.body;
        
        console.log('📥 PUT /api/seller/menu/:id - Meal ID:', mealId, 'User ID:', userId);
        console.log('📦 Request body:', req.body);
        
        // Kullanıcının seller_id'sini bul
        const sellerQuery = await db.query(
            "SELECT id FROM sellers WHERE user_id = ?",
            [userId]
        );
        
        if (sellerQuery.length === 0) {
            console.log('❌ Satıcı kaydı bulunamadı, user_id:', userId);
            return res.status(404).json({
                success: false,
                message: "Satıcı kaydı bulunamadı."
            });
        }
        
        const shopId = sellerQuery[0].id;
        console.log('✅ Seller ID bulundu:', shopId);
        
        // Yemeğin bu satıcıya ait olduğunu kontrol et
        const mealCheck = await db.query(
            "SELECT id FROM meals WHERE id = ? AND seller_id = ?",
            [mealId, shopId]
        );
        
        if (mealCheck.length === 0) {
            console.log('❌ Yemek bulunamadı veya size ait değil, meal_id:', mealId, 'shop_id:', shopId);
            return res.status(404).json({
                success: false,
                message: "Yemek bulunamadı veya size ait değil."
            });
        }
        
        console.log('✅ Yemek bulundu, güncelleme yapılıyor...');
        
        // Güncelleme için sadece gönderilen alanları güncelle
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
            // ImageUrl validasyonu: boş string veya sadece boşluk ise null yap
            let finalImageUrl = null;
            if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim() !== '') {
                finalImageUrl = imageUrl.trim();
                
                // URL uzunluğunu kontrol et (max 1000 karakter)
                if (finalImageUrl.length > 1000) {
                    console.warn('⚠️ URL çok uzun:', finalImageUrl.length, 'karakter');
                    return res.status(400).json({
                        success: false,
                        message: `Resim URL'si çok uzun (${finalImageUrl.length} karakter). Maksimum 1000 karakter olmalıdır.`
                    });
                }
                
                // URL formatını kontrol et (basit kontrol)
                try {
                    new URL(finalImageUrl);
                } catch (urlError) {
                    // Relative path kontrolü (/uploads/... gibi)
                    if (!finalImageUrl.startsWith('/') && !finalImageUrl.startsWith('./')) {
                        console.warn('⚠️ Geçersiz URL formatı:', finalImageUrl);
                        // Yine de kaydet, belki relative path olabilir
                    }
                }
            }
            updateFields.push("image_url = ?");
            updateValues.push(finalImageUrl);
            console.log('📝 Update imageUrl:', finalImageUrl ? `${finalImageUrl.substring(0, 50)}... (${finalImageUrl.length} karakter)` : 'null');
        }
        if (isAvailable !== undefined) {
            updateFields.push("is_available = ?");
            updateValues.push(isAvailable);
        }
        
        if (updateFields.length === 0) {
            console.log('❌ Güncellenecek alan belirtilmedi');
            return res.status(400).json({
                success: false,
                message: "Güncellenecek alan belirtilmedi."
            });
        }
        
        updateValues.push(mealId, shopId);
        
        const updateQuery = `UPDATE meals SET ${updateFields.join(", ")}, updated_at = NOW() WHERE id = ? AND seller_id = ?`;
        console.log('📝 SQL Query:', updateQuery);
        console.log('📝 Values:', updateValues);
        
        const result = await db.execute(updateQuery, updateValues);
        console.log('✅ Güncelleme başarılı, affected rows:', result.affectedRows);
        
        res.json({
            success: true,
            message: "Yemek başarıyla güncellendi."
        });
    } catch (error) {
        console.error("❌ Yemek güncelleme hatası:", error);
        console.error("❌ Error stack:", error.stack);
        console.error("❌ Error message:", error.message);
        res.status(500).json({
            success: false,
            message: error.message || "Sunucu hatası.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * DELETE /api/seller/menu/:id
 * Yemek sil
 */
router.delete("/menu/:id", requireRole('seller'), async (req, res) => {
    try {
        const mealId = parseInt(req.params.id);
        const sellerId = req.session.user.id;
        
        // Kullanıcının seller_id'sini bul
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
        
        // Yemeğin bu satıcıya ait olduğunu kontrol et
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
        
        await db.execute(
            "DELETE FROM meals WHERE id = ? AND seller_id = ?",
            [mealId, shopId]
        );
        
        res.json({
            success: true,
            message: "Yemek başarıyla silindi."
        });
    } catch (error) {
        console.error("Yemek silme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

/**
 * GET /api/seller/earnings
 * Kazanç raporları (günlük/haftalık/aylık)
 */
router.get("/earnings", requireRole('seller'), async (req, res) => {
    try {
        const sellerId = req.session.user.id;
        const { period = 'month' } = req.query; // day, week, month
        
        // Kullanıcının seller_id'sini bul
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
        console.error("Kazanç raporları getirme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

/**
 * GET /api/seller/dashboard
 * Dashboard istatistikleri ve son siparişler
 */
router.get("/dashboard", requireRole('seller'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        // Kullanıcının seller_id'sini bul
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
        
        // Bugünkü istatistikler
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
        
        // Son 5 sipariş
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
        console.error("Dashboard verileri getirme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

/**
 * PUT /api/seller/profile
 * Satıcı profil bilgilerini güncelle
 */
router.put("/profile", requireRole('seller'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { shopName, description, location, workingHours, logoUrl, bannerUrl } = req.body;
        
        console.log('📥 PUT /api/seller/profile - Request body:', {
            shopName,
            description,
            location,
            workingHours: workingHours !== undefined ? (typeof workingHours === 'string' ? `"${workingHours}" (length: ${workingHours.length})` : workingHours) : 'undefined',
            logoUrl,
            bannerUrl
        });
        
        console.log('📥 PUT /api/seller/profile - Request body:', {
            shopName,
            description,
            location,
            workingHours: workingHours ? (typeof workingHours === 'string' ? workingHours.substring(0, 50) : workingHours) : 'null/undefined',
            logoUrl,
            bannerUrl
        });
        
        // Kullanıcının seller_id'sini bul
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
        
        // Güncelleme için sadece gönderilen alanları güncelle
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
            // Eğer boş string, null veya undefined ise NULL gönder
            let hoursValue = null;
            
            console.log('🔍 workingHours kontrolü:', {
                type: typeof workingHours,
                value: workingHours,
                isNull: workingHours === null,
                isUndefined: workingHours === undefined,
                isEmptyString: workingHours === '',
                length: typeof workingHours === 'string' ? workingHours.length : 'N/A'
            });
            
            // Boş string, null veya undefined kontrolü - önce boş string kontrolü
            if (workingHours === '' || workingHours === null || workingHours === undefined) {
                console.log('⚠️ workingHours boş/null/undefined, NULL gönderiliyor');
                hoursValue = null;
            } else {
                const trimmed = typeof workingHours === 'string' ? workingHours.trim() : String(workingHours).trim();
                
                if (trimmed !== '' && trimmed !== 'null' && trimmed !== 'undefined') {
                    if (typeof workingHours === 'string') {
                        // String ise JSON parse etmeyi dene
                        try {
                            const parsed = JSON.parse(workingHours);
                            // Parse başarılı, geçerli JSON
                            hoursValue = JSON.stringify(parsed);
                            console.log('✅ workingHours JSON parse edildi:', hoursValue);
                        } catch (e) {
                            // JSON değilse, geçerli bir JSON objesi oluştur
                            hoursValue = JSON.stringify({ hours: workingHours });
                            console.log('⚠️ workingHours JSON değil, obje oluşturuldu:', hoursValue);
                        }
                    } else if (typeof workingHours === 'object') {
                        // Zaten object ise stringify et
                        hoursValue = JSON.stringify(workingHours);
                        console.log('✅ workingHours object, stringify edildi:', hoursValue);
                    } else {
                        // Diğer durumlar için basit bir JSON objesi oluştur
                        hoursValue = JSON.stringify({ hours: String(workingHours) });
                        console.log('⚠️ workingHours diğer tip, obje oluşturuldu:', hoursValue);
                    }
                } else {
                    console.log('⚠️ workingHours trim sonrası boş, NULL gönderiliyor');
                    hoursValue = null;
                }
            }
            
            // NULL veya geçerli JSON string gönder
            updateFields.push("opening_hours = ?");
            updateValues.push(hoursValue);
            console.log('📦 opening_hours güncelleme değeri:', hoursValue);
        }
        if (logoUrl !== undefined) {
            updateFields.push("logo_url = ?");
            updateValues.push(logoUrl);
        }
        if (bannerUrl !== undefined) {
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
        
        console.log('📝 SQL sorgusu:', `UPDATE sellers SET ${updateFields.join(", ")} WHERE id = ?`);
        console.log('📝 SQL değerleri:', updateValues);
        
        await db.execute(
            `UPDATE sellers SET ${updateFields.join(", ")} WHERE id = ?`,
            updateValues
        );
        
        res.json({
            success: true,
            message: "Profil başarıyla güncellendi."
        });
    } catch (error) {
        console.error("Profil güncelleme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

/**
 * GET /api/seller/profile
 * Satıcı profil bilgilerini getir
 */
router.get("/profile", requireRole('seller'), async (req, res) => {
    try {
        console.log('📥 GET /api/seller/profile - İstek alındı');
        console.log('📥 Session:', req.session ? 'var' : 'yok');
        console.log('📥 Session user:', req.session?.user ? 'var' : 'yok');
        console.log('📥 Session isAuthenticated:', req.session?.isAuthenticated);
        
        if (!req.session || !req.session.user) {
            console.error('❌ Session veya user bulunamadı');
            return res.status(401).json({
                success: false,
                message: "Oturum bulunamadı."
            });
        }
        
        const userId = req.session.user.id;
        console.log('📥 GET /api/seller/profile - User ID:', userId);
        
        if (!userId) {
            console.error('❌ User ID bulunamadı');
            return res.status(401).json({
                success: false,
                message: "Oturum bulunamadı."
            });
        }
        
        // Kullanıcının seller_id'sini bul
        const sellerQuery = await db.query(
            "SELECT id FROM sellers WHERE user_id = ?",
            [userId]
        );
        
        console.log('🔍 Seller query sonucu:', sellerQuery);
        
        if (!sellerQuery || sellerQuery.length === 0) {
            console.log('❌ Satıcı kaydı bulunamadı, user_id:', userId);
            return res.status(404).json({
                success: false,
                message: "Satıcı kaydı bulunamadı."
            });
        }
        
        const shopId = sellerQuery[0].id;
        console.log('✅ Seller ID bulundu:', shopId);
        
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
        
        console.log('📦 Profil sorgusu sonucu:', profile);
        
        if (!profile || profile.length === 0) {
            console.log('❌ Profil bulunamadı, shop_id:', shopId);
            return res.status(404).json({
                success: false,
                message: "Profil bulunamadı."
            });
        }
        
        // opening_hours JSON ise parse et
        const profileData = { ...profile[0] };
        
        // Tüm alanları güvenli hale getir
        profileData.shopName = profileData.shopName || '';
        profileData.description = profileData.description || '';
        profileData.location = profileData.location || '';
        profileData.logoUrl = profileData.logoUrl || null;
        profileData.bannerUrl = profileData.bannerUrl || null;
        
        // opening_hours null veya undefined ise boş string yap
        if (profileData.workingHours === null || profileData.workingHours === undefined) {
            profileData.workingHours = '';
        } else if (typeof profileData.workingHours === 'string') {
            // String ise JSON parse etmeyi dene
            if (profileData.workingHours.trim() === '') {
                profileData.workingHours = '';
            } else {
                try {
                    const parsed = JSON.parse(profileData.workingHours);
                    profileData.workingHours = parsed;
                } catch (e) {
                    // JSON parse edilemezse string olarak bırak
                    console.warn('⚠️ opening_hours JSON parse edilemedi, string olarak bırakılıyor:', e.message);
                }
            }
        } else if (typeof profileData.workingHours === 'object') {
            // Zaten object ise olduğu gibi bırak
            // MySQL JSON kolonu bazen object olarak gelebilir
        }
        
        console.log('✅ Profil başarıyla getirildi:', JSON.stringify(profileData, null, 2));
        res.json({
            success: true,
            profile: profileData
        });
    } catch (error) {
        console.error("❌ Profil getirme hatası:", error);
        console.error("❌ Hata mesajı:", error.message);
        console.error("❌ Hata stack:", error.stack);
        console.error("❌ Hata name:", error.name);
        console.error("❌ Hata code:", error.code);
        
        // Daha detaylı hata mesajı (development modunda)
        const errorMessage = process.env.NODE_ENV === 'development' 
            ? error.message 
            : "Sunucu hatası.";
        
        res.status(500).json({
            success: false,
            message: "Sunucu hatası.",
            error: errorMessage
        });
    }
});

module.exports = router;

