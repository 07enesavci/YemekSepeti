const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const { Seller } = require("../../models");

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/sellers
 * Satıcıları listele (filtreleme ile)
 */
router.get("/", async (req, res) => {
    const requestId = Date.now();
    console.log(`✅ [${requestId}] /api/sellers endpoint çağrıldı`);
    console.log(`📥 [${requestId}] Request URL:`, req.originalUrl || req.url);
    console.log(`📥 [${requestId}] Request method:`, req.method);
    console.log(`📥 [${requestId}] Request query:`, req.query);
    try {
        const { location, rating } = req.query;
        
        // Aktif satıcıları getir (Sequelize)
        let dbSellers = [];
        try {
            dbSellers = await Seller.findAll({
                where: { is_active: true },
                attributes: [
                    'id', 
                    'shop_name', 
                    'location', 
                    'rating', 
                    'logo_url', 
                    'banner_url', 
                    'description', 
                    'delivery_fee', 
                    'min_order_amount', 
                    'total_reviews', 
                    'is_active'
                ],
                order: [['rating', 'DESC'], ['total_reviews', 'DESC']]
            });
            
            console.log(`✅ Veritabanı sorgusu başarılı: ${dbSellers ? dbSellers.length : 0} satıcı bulundu`);
        } catch (dbError) {
            console.error("❌ Veritabanı sorgu hatası:", dbError);
            console.error("❌ Hata detayı:", dbError.message);
            console.error("❌ Hata stack:", dbError.stack);
            dbSellers = [];
        }
        
        if (dbSellers && dbSellers.length > 0) {
            try {
                console.log(`📋 ${dbSellers.length} satıcı bulundu:`);
                dbSellers.forEach((s, index) => {
                    console.log(`  ${index + 1}. ${s.shop_name || 'İsimsiz'} (ID: ${s.id || 'N/A'}, Aktif: ${s.is_active || false})`);
                });
            } catch (logError) {
                console.error("Log hatası:", logError);
            }
        } else {
            console.warn('⚠️ Veritabanında hiç satıcı bulunamadı!');
        }
        
        // Veritabanı formatını frontend formatına çevir
        let sellers = [];
        try {
            if (dbSellers && Array.isArray(dbSellers)) {
                console.log(`🔄 ${dbSellers.length} satıcı frontend formatına çevriliyor...`);
                
                if (dbSellers.length === 0) {
                    console.warn('⚠️ Veritabanından 0 satıcı geldi! Veritabanında satıcı var mı kontrol edin.');
                }
                
                // Promise.all yerine basit map kullan (async gerekmiyor çünkü hepsi sync işlemler)
                sellers = dbSellers.map((seller, index) => {
                    try {
                        if (!seller || typeof seller !== 'object') {
                            console.warn(`⚠️ Satıcı ${index} geçersiz:`, seller);
                            return null;
                        }
                        
                        // Resim URL'lerini kontrol et - via.placeholder.com ve geçersiz URL'leri temizle
                        let imageUrl = seller.imageUrl;
                        // Relative path'leri de kabul et (/uploads/... gibi)
                        if (!imageUrl || 
                            (typeof imageUrl === 'string' && imageUrl.trim() === '') || 
                            (typeof imageUrl === 'string' && imageUrl.includes('via.placeholder.com')) ||
                            (typeof imageUrl === 'string' && imageUrl.includes('placeholder.com')) ||
                            (typeof imageUrl === 'string' && imageUrl.includes('400x200.png')) ||
                            (typeof imageUrl === 'string' && imageUrl.includes('1920x400.png'))) {
                            imageUrl = null; // Frontend'de SVG placeholder kullanılacak
                        } else if (typeof imageUrl === 'string' && imageUrl.trim() !== '') {
                            imageUrl = imageUrl.trim();
                        }
                        
                        let bannerUrl = seller.bannerUrl;
                        // Relative path'leri de kabul et (/uploads/... gibi)
                        if (!bannerUrl || 
                            (typeof bannerUrl === 'string' && bannerUrl.trim() === '') || 
                            (typeof bannerUrl === 'string' && bannerUrl.includes('via.placeholder.com')) ||
                            (typeof bannerUrl === 'string' && bannerUrl.includes('placeholder.com')) ||
                            (typeof bannerUrl === 'string' && bannerUrl.includes('400x200.png')) ||
                            (typeof bannerUrl === 'string' && bannerUrl.includes('1920x400.png'))) {
                            bannerUrl = null; // Frontend'de SVG placeholder kullanılacak
                        } else if (typeof bannerUrl === 'string' && bannerUrl.trim() !== '') {
                            bannerUrl = bannerUrl.trim();
                        }
                        
                        // Rating değerini güvenli şekilde parse et
                        let sellerRating = 0;
                        try {
                            if (seller.rating !== null && seller.rating !== undefined) {
                                sellerRating = parseFloat(seller.rating);
                                if (isNaN(sellerRating)) {
                                    sellerRating = 0;
                                }
                            }
                        } catch (ratingError) {
                            console.error("Rating parse hatası:", ratingError, seller);
                            sellerRating = 0;
                        }
                        
                        const mappedSeller = {
                            id: seller.id || 0,
                            name: (seller.shop_name && typeof seller.shop_name === 'string') ? seller.shop_name : 'İsimsiz Satıcı',
                            location: (seller.location && typeof seller.location === 'string') ? seller.location : 'Konum belirtilmemiş',
                            rating: sellerRating,
                            imageUrl: imageUrl,
                            bannerUrl: bannerUrl,
                            description: (seller.description && typeof seller.description === 'string') ? seller.description : "",
                            deliveryFee: parseFloat(seller.delivery_fee) || 15.00,
                            minOrderAmount: parseFloat(seller.min_order_amount) || 50.00,
                            totalReviews: parseInt(seller.total_reviews) || 0
                        };
                        
                        if (index < 3) { // İlk 3 satıcıyı logla
                            console.log(`  ✅ Satıcı ${index + 1} map edildi:`, {
                                id: mappedSeller.id,
                                name: mappedSeller.name,
                                location: mappedSeller.location
                            });
                        }
                        
                        return mappedSeller;
                    } catch (mapError) {
                        console.error(`❌ Satıcı ${index} map hatası:`, mapError);
                        console.error("❌ Hatalı seller:", seller);
                        return null; // Hatalı satıcıyı atla
                    }
                }).filter(seller => seller !== null && seller !== undefined); // Null ve undefined değerleri filtrele
                
                console.log(`✅ Map işlemi tamamlandı: ${sellers.length} satıcı başarıyla map edildi (${dbSellers.length - sellers.length} satıcı filtrelendi)`);
                
            }
        } catch (transformError) {
            console.error("❌ Veri dönüşüm hatası:", transformError);
            console.error("❌ Hata stack:", transformError.stack);
            sellers = [];
        }

        // Limit parametresi kontrolü (try-catch dışında tanımla)
        let limit = null;
        if (req.query.limit && !isNaN(parseInt(req.query.limit))) {
            limit = parseInt(req.query.limit);
        }

        // Filtreleme
        try {
            if (location && typeof location === 'string' && location.trim() !== '') {
                const locationLower = location.toLowerCase().trim();
                const beforeCount = sellers.length;
                sellers = sellers.filter(s => {
                    try {
                        return s && s.location && typeof s.location === 'string' && s.location.toLowerCase().includes(locationLower);
                    } catch (e) {
                        console.error("Location filtreleme hatası:", e);
                        return false;
                    }
                });
            }

            if (rating !== undefined && rating !== null && rating !== '') {
                let minRating;
                
                if (typeof rating === 'string') {
                    minRating = parseFloat(rating);
                } else if (typeof rating === 'number') {
                    minRating = rating;
                } else {
                    console.warn(`⚠️ Rating değeri beklenmeyen tip: ${typeof rating}`);
                    minRating = NaN;
                }
                
                if (!isNaN(minRating) && minRating >= 0 && minRating <= 5) {
                    const beforeCount = sellers.length;
                    sellers = sellers.filter(s => {
                        try {
                            if (!s || s === null) {
                                return false;
                            }
                            const sellerRating = parseFloat(s.rating);
                            if (isNaN(sellerRating)) {
                                return false;
                            }
                            const result = sellerRating >= minRating;
                            return result;
                        } catch (e) {
                            console.error("Rating filtreleme hatası:", e, s);
                            return false;
                        }
                    });
                }
            }
            
        } catch (filterError) {
            console.error("❌ Filtreleme hatası:", filterError);
            console.error("❌ Filtreleme hata stack:", filterError.stack);
            // Filtreleme hatası durumunda tüm satıcıları gönder
        }

        // Debug: Filtreleme sonrası kaç satıcı kaldı?
        console.log(`🔍 [${requestId}] Filtreleme sonrası: ${sellers.length} satıcı kaldı`);
        
        // Limit uygula
        if (limit && limit > 0 && Array.isArray(sellers)) {
            const beforeLimit = sellers.length;
            sellers = sellers.slice(0, limit);
            console.log(`📏 [${requestId}] Limit uygulandı: ${beforeLimit} -> ${sellers.length}`);
        }
        
        // Güvenli JSON yanıtı
        if (!Array.isArray(sellers)) {
            console.warn("⚠️ Sellers array değil, boş array döndürülüyor");
            sellers = [];
        }
        
        console.log(`📤 [${requestId}] Frontend'e ${sellers.length} satıcı gönderiliyor`);
        if (sellers.length > 0) {
            console.log(`📋 [${requestId}] Gönderilen satıcılar: ${sellers.map(s => s.name || 'İsimsiz').join(', ')}`);
        } else {
            console.warn(`⚠️ [${requestId}] UYARI: Frontend'e 0 satıcı gönderiliyor!`);
        }
        res.json(sellers);
    } catch (error) {
        console.error("❌ Satıcılar listeleme hatası:", error);
        console.error("❌ Hata mesajı:", error.message);
        console.error("❌ Hata stack:", error.stack);
        console.error("❌ Hata name:", error.name);
        console.error("❌ Hata code:", error.code);
        
        // Hata durumunda boş array döndür (frontend uyumluluğu için)
        res.status(200).json([]);
    }
});

/**
 * GET /api/sellers/:id
 * Belirli bir satıcının detaylarını getir
 */
router.get("/:id", async (req, res) => {
    try {
        const sellerId = parseInt(req.params.id);
        
        // Sadece veritabanında olan satıcıları göster
        const query = `
            SELECT 
                s.id,
                s.shop_name as name,
                s.location,
                s.rating,
                s.logo_url as imageUrl,
                s.banner_url as bannerUrl,
                s.description,
                s.delivery_fee,
                s.min_order_amount,
                s.total_reviews,
                u.fullname as ownerName,
                u.phone as ownerPhone
            FROM sellers s
            INNER JOIN users u ON s.user_id = u.id
            WHERE s.id = ?
        `;
        
        const dbSellers = await db.query(query, [sellerId]);
        
        console.log('📥 SQL sorgusu sonucu:', dbSellers.length, 'kayıt bulundu');
        if (dbSellers.length > 0) {
            console.log('📥 İlk kayıt:', {
                id: dbSellers[0].id,
                name: dbSellers[0].name,
                imageUrl: dbSellers[0].imageUrl,
                bannerUrl: dbSellers[0].bannerUrl
            });
        }
        
        if (dbSellers.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Satıcı bulunamadı." 
            });
        }
        
        const dbSeller = dbSellers[0];
        
        // Resim URL'lerini kontrol et - relative path'leri de kabul et (/uploads/...)
        let imageUrl = dbSeller.imageUrl;
        
        if (!imageUrl) {
            imageUrl = null;
        } else if (typeof imageUrl === 'string') {
            const trimmed = imageUrl.trim();
            if (trimmed === '') {
                imageUrl = null;
            } else if (trimmed.includes('via.placeholder.com') ||
                       trimmed.includes('placeholder.com') ||
                       trimmed.includes('400x200.png') ||
                       trimmed.includes('1920x400.png')) {
                imageUrl = null;
            } else {
                imageUrl = trimmed;
            }
        } else {
            imageUrl = null;
        }
        
        let bannerUrl = dbSeller.bannerUrl;
        
        if (!bannerUrl) {
            bannerUrl = null;
        } else if (typeof bannerUrl === 'string') {
            const trimmed = bannerUrl.trim();
            if (trimmed === '') {
                bannerUrl = null;
            } else if (trimmed.includes('via.placeholder.com') ||
                       trimmed.includes('placeholder.com') ||
                       trimmed.includes('400x200.png') ||
                       trimmed.includes('1920x400.png')) {
                bannerUrl = null;
            } else {
                bannerUrl = trimmed;
            }
        } else {
            bannerUrl = null;
        }
        
        const seller = {
            id: dbSeller.id,
            name: dbSeller.name,
            location: dbSeller.location,
            rating: parseFloat(dbSeller.rating) || 0,
            imageUrl: imageUrl,
            bannerUrl: bannerUrl,
            description: dbSeller.description || "",
            deliveryFee: parseFloat(dbSeller.delivery_fee) || 15.00,
            minOrderAmount: parseFloat(dbSeller.min_order_amount) || 50.00,
            totalReviews: dbSeller.total_reviews || 0,
            ownerName: dbSeller.ownerName,
            ownerPhone: dbSeller.ownerPhone
        };

        res.json(seller);
    } catch (error) {
        console.error("Satıcı detay getirme hatası:", error);
        res.status(500).json({ error: "Satıcı detayları yüklenemedi." });
    }
});

/**
 * GET /api/sellers/:id/reviews
 * Satıcının yorumlarını getir
 */
router.get("/:id/reviews", async (req, res) => {
    try {
        const sellerId = parseInt(req.params.id);
        const { page = 1, limit = 10 } = req.query;
        
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        const sql = `
            SELECT 
                r.id,
                r.rating,
                r.comment,
                r.created_at,
                u.fullname as userName,
                o.order_number
            FROM reviews r
            INNER JOIN users u ON r.user_id = u.id
            INNER JOIN orders o ON r.order_id = o.id
            WHERE r.seller_id = ?
            AND r.is_visible = TRUE
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        `;
        
        const reviews = await db.query(sql, [sellerId, parseInt(limit), offset]);
        
        // Toplam yorum sayısı
        const countResult = await db.query(
            "SELECT COUNT(*) as total FROM reviews WHERE seller_id = ? AND is_visible = TRUE",
            [sellerId]
        );
        const totalReviews = countResult[0].total;
        
        res.json({
            success: true,
            reviews: reviews.map(r => ({
                id: r.id,
                rating: r.rating,
                comment: r.comment,
                createdAt: r.created_at,
                userName: r.userName,
                orderNumber: r.order_number
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalReviews,
                totalPages: Math.ceil(totalReviews / parseInt(limit))
            }
        });
    } catch (error) {
        console.error("Yorumlar getirme hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası." 
        });
    }
});

/**
 * GET /api/sellers/:id/menu
 * Belirli bir satıcının menüsünü getir
 */
router.get("/:id/menu", async (req, res) => {
    try {
        const sellerId = parseInt(req.params.id);
        
        // Sadece veritabanında olan menüleri göster
        const query = `
            SELECT 
                id,
                category,
                name,
                description,
                price,
                image_url as imageUrl,
                is_available as isAvailable
            FROM meals
            WHERE seller_id = ? AND is_available = TRUE
            ORDER BY category, name
        `;
        
        const dbMeals = await db.query(query, [sellerId]);
        
        const menu = dbMeals.map(meal => {
            // Resim URL'ini kontrol et - via.placeholder.com içeriyorsa veya geçersiz URL'leri temizle
            let mealImageUrl = meal.imageUrl;
            if (!mealImageUrl || 
                mealImageUrl.trim() === '' || 
                mealImageUrl.includes('via.placeholder.com') ||
                mealImageUrl.includes('placeholder.com') ||
                mealImageUrl.includes('400x200.png') ||
                mealImageUrl.includes('250x150.png')) {
                mealImageUrl = null; // Frontend'de SVG placeholder kullanılacak
            } else {
                // Relative path'leri de kabul et (/uploads/... gibi)
                mealImageUrl = mealImageUrl.trim();
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

        res.json(menu);
    } catch (error) {
        console.error("Menü getirme hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası." 
        });
    }
});

/**
 * DELETE /api/sellers/:id
 * Satıcıyı veritabanından tamamen sil
 * NOT: Bu işlem geri alınamaz!
 */
router.delete("/:id", async (req, res) => {
    try {
        const sellerId = parseInt(req.params.id);
        
        if (isNaN(sellerId)) {
            return res.status(400).json({
                success: false,
                message: "Geçersiz satıcı ID"
            });
        }
        
        console.log(`🗑️ Satıcı silme işlemi başlatıldı - Seller ID: ${sellerId}`);
        
        // 1. Satıcıyı kontrol et
        const sellerCheck = await db.query("SELECT id, shop_name, user_id FROM sellers WHERE id = ?", [sellerId]);
        if (sellerCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Satıcı bulunamadı"
            });
        }
        
        const seller = sellerCheck[0];
        console.log(`📋 Silinecek satıcı: ${seller.shop_name} (ID: ${seller.id}, User ID: ${seller.user_id})`);
        
        // 2. İlişkili verileri kontrol et
        const ordersCheck = await db.query("SELECT COUNT(*) as count FROM orders WHERE seller_id = ?", [sellerId]);
        const ordersCount = ordersCheck[0]?.count || 0;
        
        const mealsCheck = await db.query("SELECT COUNT(*) as count FROM meals WHERE seller_id = ?", [sellerId]);
        const mealsCount = mealsCheck[0]?.count || 0;
        
        const earningsCheck = await db.query("SELECT COUNT(*) as count FROM seller_earnings WHERE seller_id = ?", [sellerId]);
        const earningsCount = earningsCheck[0]?.count || 0;
        
        console.log(`📊 İlişkili veriler:`, {
            orders: ordersCount,
            meals: mealsCount,
            earnings: earningsCount
        });
        
        // 3. Eğer sipariş varsa, seller'ı silemeyiz (ON DELETE RESTRICT)
        if (ordersCount > 0) {
            console.log(`⚠️ Bu satıcıya ait ${ordersCount} sipariş bulundu. Seller silinemez.`);
            return res.status(400).json({
                success: false,
                message: `Bu satıcıya ait ${ordersCount} sipariş bulunduğu için silinemez. Önce siparişleri silmeniz veya seller'ı pasif yapmanız gerekir.`,
                ordersCount: ordersCount
            });
        }
        
        // 4. Transaction başlat
        await db.query("START TRANSACTION");
        
        try {
            // 5. Seller earnings kayıtlarını sil (CASCADE olmalı ama emin olmak için)
            if (earningsCount > 0) {
                await db.query("DELETE FROM seller_earnings WHERE seller_id = ?", [sellerId]);
                console.log(`✅ ${earningsCount} seller_earnings kaydı silindi`);
            }
            
            // 6. Meals otomatik silinecek (CASCADE) ama manuel de silebiliriz
            if (mealsCount > 0) {
                await db.query("DELETE FROM meals WHERE seller_id = ?", [sellerId]);
                console.log(`✅ ${mealsCount} meal kaydı silindi`);
            }
            
            // 7. Coupons tablosundaki applicable_seller_ids JSON'undan bu seller_id'yi kaldır
            const couponsCheck = await db.query("SELECT id, code, applicable_seller_ids FROM coupons WHERE applicable_seller_ids IS NOT NULL");
            for (const coupon of couponsCheck) {
                try {
                    const sellerIds = JSON.parse(coupon.applicable_seller_ids || '[]');
                    if (Array.isArray(sellerIds) && sellerIds.includes(sellerId)) {
                        const updatedIds = sellerIds.filter(id => id !== sellerId);
                        await db.query("UPDATE coupons SET applicable_seller_ids = ? WHERE id = ?", [
                            updatedIds.length > 0 ? JSON.stringify(updatedIds) : null,
                            coupon.id
                        ]);
                        console.log(`✅ Kupon ${coupon.code} güncellendi (seller_id kaldırıldı)`);
                    }
                } catch (parseError) {
                    console.error(`⚠️ Kupon ${coupon.id} parse hatası:`, parseError);
                }
            }
            
            // 8. Seller'ı sil
            await db.query("DELETE FROM sellers WHERE id = ?", [sellerId]);
            console.log(`✅ Satıcı silindi: ${seller.shop_name}`);
            
            // 9. User'ı kontrol et - eğer sadece bu seller'a aitse ve role 'seller' ise, user'ı da silebiliriz
            // Ancak burada user_id 5 bir kurye hesabı, o yüzden user'ı silmeyeceğiz
            const userCheck = await db.query("SELECT id, role FROM users WHERE id = ?", [seller.user_id]);
            if (userCheck.length > 0) {
                const user = userCheck[0];
                if (user.role === 'seller') {
                    // Başka seller var mı kontrol et
                    const otherSellers = await db.query("SELECT COUNT(*) as count FROM sellers WHERE user_id = ?", [seller.user_id]);
                    if (otherSellers[0]?.count === 0) {
                        console.log(`ℹ️ User ${seller.user_id} başka seller'a sahip değil, ancak role kontrolü yapılmadı - user silinmedi`);
                        // User'ı silmeyiz çünkü kurye hesabı olabilir
                    }
                }
            }
            
            // 10. Transaction commit
            await db.query("COMMIT");
            
            res.json({
                success: true,
                message: `"${seller.shop_name}" restoranı başarıyla silindi`,
                deleted: {
                    seller: seller.shop_name,
                    meals: mealsCount,
                    earnings: earningsCount
                }
            });
            
        } catch (deleteError) {
            await db.query("ROLLBACK");
            console.error("❌ Silme işlemi hatası:", deleteError);
            throw deleteError;
        }
        
    } catch (error) {
        console.error("❌ Satıcı silme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Satıcı silinirken hata oluştu",
            error: error.message
        });
    }
});

module.exports = router;

