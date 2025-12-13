const express = require("express");
const router = express.Router();
const db = require("../../config/database");

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/sellers
 * Satıcıları listele (filtreleme ile)
 */
router.get("/", async (req, res) => {
    try {
        const { location, rating } = req.query;
        
        // Veritabanından TÜM satıcıları çek (aktif + pasif) - Limit yok, hepsi gösterilecek
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
                s.is_active
            FROM sellers s
            ORDER BY s.is_active DESC, s.rating DESC, s.total_reviews DESC
        `;
        
        let dbSellers = [];
        try {
            dbSellers = await db.query(query);
        } catch (dbError) {
            console.error("❌ Veritabanı sorgu hatası:", dbError);
            console.error("❌ Hata detayı:", dbError.message);
            console.error("❌ Hata stack:", dbError.stack);
            // Veritabanı hatası durumunda boş array döndür
            dbSellers = [];
            // Hata durumunda bile devam et, boş liste döndür
        }
        
        if (dbSellers && dbSellers.length > 0) {
            try {
                console.log(`📋 Satıcılar: ${dbSellers.map(s => `${s.name || 'İsimsiz'} (ID: ${s.id || 'N/A'}, Aktif: ${s.is_active || false})`).join(', ')}`);
            } catch (logError) {
                console.error("Log hatası:", logError);
            }
        }
        
        // Veritabanı formatını frontend formatına çevir
        let sellers = [];
        try {
            if (dbSellers && Array.isArray(dbSellers)) {
                console.log(`🔄 ${dbSellers.length} satıcı frontend formatına çevriliyor...`);
                sellers = dbSellers.map(seller => {
                    try {
                        if (!seller || typeof seller !== 'object') {
                            return null;
                        }
                        
                        // Resim URL'lerini kontrol et - via.placeholder.com ve geçersiz URL'leri temizle
                        let imageUrl = seller.imageUrl;
                        // via.placeholder.com içeriyorsa veya geçerli bir HTTP URL değilse null yap
                        if (!imageUrl || 
                            (typeof imageUrl === 'string' && imageUrl.trim() === '') || 
                            (typeof imageUrl === 'string' && !imageUrl.startsWith('http')) ||
                            (typeof imageUrl === 'string' && imageUrl.includes('via.placeholder.com')) ||
                            (typeof imageUrl === 'string' && imageUrl.includes('placeholder.com')) ||
                            (typeof imageUrl === 'string' && imageUrl.includes('400x200.png')) ||
                            (typeof imageUrl === 'string' && imageUrl.includes('1920x400.png'))) {
                            imageUrl = null; // Frontend'de SVG placeholder kullanılacak
                        }
                        
                        let bannerUrl = seller.bannerUrl;
                        // via.placeholder.com içeriyorsa veya geçerli bir HTTP URL değilse null yap
                        if (!bannerUrl || 
                            (typeof bannerUrl === 'string' && bannerUrl.trim() === '') || 
                            (typeof bannerUrl === 'string' && !bannerUrl.startsWith('http')) ||
                            (typeof bannerUrl === 'string' && bannerUrl.includes('via.placeholder.com')) ||
                            (typeof bannerUrl === 'string' && bannerUrl.includes('placeholder.com')) ||
                            (typeof bannerUrl === 'string' && bannerUrl.includes('400x200.png')) ||
                            (typeof bannerUrl === 'string' && bannerUrl.includes('1920x400.png'))) {
                            bannerUrl = null; // Frontend'de SVG placeholder kullanılacak
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
                        
                        return {
                            id: seller.id || 0,
                            name: (seller.name && typeof seller.name === 'string') ? seller.name : 'İsimsiz Satıcı',
                            location: (seller.location && typeof seller.location === 'string') ? seller.location : 'Konum belirtilmemiş',
                            rating: sellerRating,
                            imageUrl: imageUrl,
                            bannerUrl: bannerUrl,
                            description: (seller.description && typeof seller.description === 'string') ? seller.description : "",
                            deliveryFee: parseFloat(seller.delivery_fee) || 15.00,
                            minOrderAmount: parseFloat(seller.min_order_amount) || 50.00,
                            totalReviews: parseInt(seller.total_reviews) || 0
                        };
                    } catch (mapError) {
                        console.error("❌ Satıcı map hatası:", mapError);
                        console.error("❌ Hatalı seller:", seller);
                        return null; // Hatalı satıcıyı atla
                    }
                }).filter(seller => seller !== null && seller !== undefined); // Null ve undefined değerleri filtrele
                
            }
        } catch (transformError) {
            console.error("❌ Veri dönüşüm hatası:", transformError);
            console.error("❌ Hata stack:", transformError.stack);
            sellers = [];
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
        
        // Güvenli JSON yanıtı
        if (!Array.isArray(sellers)) {
            console.warn("⚠️ Sellers array değil, boş array döndürülüyor");
            sellers = [];
        }
        
        res.json(sellers);
    } catch (error) {
        console.error("❌ Satıcılar listeleme hatası:", error);
        console.error("❌ Hata mesajı:", error.message);
        console.error("❌ Hata stack:", error.stack);
        console.error("❌ Hata name:", error.name);
        console.error("❌ Hata code:", error.code);
        
        // Hata durumunda bile boş array döndür, 500 hatası verme
        res.status(200).json({ 
            success: false, 
            message: "Satıcılar yüklenirken bir hata oluştu.",
            sellers: [],
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
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

module.exports = router;

