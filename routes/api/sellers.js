const express = require("express");
const router = express.Router();
const db = require("../../config/database");

// ============================================
// MOCK VERİTABANI (Fallback için)
// ============================================
let MOCK_SELLERS = [
    { 
        id: 1, 
        name: "Ayşe'nin Mutfağı", 
        location: "Kadıköy", 
        rating: 4.9, 
        imageUrl: "https://via.placeholder.com/400x200.png?text=Ayşe'nin+Mutfağı",
        bannerUrl: "https://via.placeholder.com/1920x400.png?text=Satıcı+Banner+1"
    },
    { 
        id: 2, 
        name: "Ali'nin Kebapları", 
        location: "Beşiktaş", 
        rating: 4.7, 
        imageUrl: "https://via.placeholder.com/400x200.png?text=Ali'nin+Kebapları",
        bannerUrl: "https://via.placeholder.com/1920x400.png?text=Satıcı+Banner+2"
    },
    { 
        id: 3, 
        name: "Vegan Lezzetler", 
        location: "Moda", 
        rating: 4.8, 
        imageUrl: "https://via.placeholder.com/400x200.png?text=Vegan+Lezzetler",
        bannerUrl: "https://via.placeholder.com/1920x400.png?text=Satıcı+Banner+3"
    },
];

const MOCK_MENUS = {
    "1": [
        { id: 101, category: "Ana Yemekler", name: "Ev Mantısı (Porsiyon)", description: "Kayseri usulü, yoğurt ve sos ile.", price: 110.00, imageUrl: "https://via.placeholder.com/400x200.png?text=Ev+Mantısı" },
        { id: 102, category: "Ana Yemekler", name: "Kuru Fasulye", description: "Geleneksel usulde, yanında pilav ile.", price: 85.00, imageUrl: "https://via.placeholder.com/400x200.png?text=Kuru+Fasulye" },
        { id: 103, category: "Tatlılar", name: "Fırın Sütlaç", description: "Ev yapımı, bol fındıklı.", price: 60.00, imageUrl: "https://via.placeholder.com/400x200.png?text=Sütlaç" },
    ],
    "2": [
        { id: 201, category: "Kebaplar", name: "Adana Kebap", description: "Acılı, porsiyon.", price: 130.00, imageUrl: "https://via.placeholder.com/400x200.png?text=Adana+Kebap" },
        { id: 202, category: "Pide", name: "Kıymalı Pide", description: "Bol malzemeli.", price: 90.00, imageUrl: "https://via.placeholder.com/400x200.png?text=Kıymalı+Pide" },
    ],
    "3": [],
};

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/sellers
 * Satıcıları listele (filtreleme ile)
 */
router.get("/", async (req, res) => {
    try {
        console.log("=".repeat(50));
        console.log("📥 YENİ İSTEK: GET /api/sellers");
        console.log("Query params:", req.query);
        
        const { location, rating } = req.query;
        console.log(`🔍 Satıcı listeleme isteği - Location: ${location}, Rating: ${rating}`);
        
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
            console.log("📡 Veritabanı sorgusu çalıştırılıyor...");
            dbSellers = await db.query(query);
            console.log(`✅ Veritabanı sorgusu başarılı: ${dbSellers ? dbSellers.length : 0} satıcı bulundu`);
        } catch (dbError) {
            console.error("❌ Veritabanı sorgu hatası:", dbError);
            console.error("❌ Hata detayı:", dbError.message);
            console.error("❌ Hata stack:", dbError.stack);
            // Veritabanı hatası durumunda boş array döndür
            dbSellers = [];
            // Hata durumunda bile devam et, boş liste döndür
        }
        
        // Debug: Kaç satıcı bulundu?
        console.log(`📊 Veritabanından ${dbSellers ? dbSellers.length : 0} satıcı bulundu (TÜMÜ gösterilecek)`);
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
                
                console.log(`✅ ${sellers.length} satıcı başarıyla oluşturuldu`);
            } else {
                console.warn("⚠️ dbSellers array değil veya null");
            }
        } catch (transformError) {
            console.error("❌ Veri dönüşüm hatası:", transformError);
            console.error("❌ Hata stack:", transformError.stack);
            sellers = [];
        }

        // Filtreleme
        try {
            console.log(`🔍 Filtreleme başlıyor - Location: ${location}, Rating: ${rating}, Satıcı sayısı: ${sellers.length}`);
            
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
                console.log(`📍 Location filtresi: ${beforeCount} -> ${sellers.length} satıcı`);
            }

            if (rating !== undefined && rating !== null && rating !== '') {
                console.log(`⭐ Rating filtresi uygulanıyor: ${rating} (tip: ${typeof rating})`);
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
                    console.log(`⭐ Rating filtresi: ${beforeCount} -> ${sellers.length} satıcı (minRating: ${minRating})`);
                } else {
                    console.warn(`⚠️ Geçersiz rating değeri: ${minRating}`);
                }
            }
            
            console.log(`✅ Filtreleme tamamlandı: ${sellers.length} satıcı kaldı`);
        } catch (filterError) {
            console.error("❌ Filtreleme hatası:", filterError);
            console.error("❌ Filtreleme hata stack:", filterError.stack);
            // Filtreleme hatası durumunda tüm satıcıları gönder
        }

        // Debug: Filtreleme sonrası kaç satıcı kaldı?
        console.log(`✅ ${sellers.length} satıcı frontend'e gönderiliyor`);
        
        // Güvenli JSON yanıtı
        if (!Array.isArray(sellers)) {
            console.warn("⚠️ Sellers array değil, boş array döndürülüyor");
            sellers = [];
        }
        
        console.log(`📤 ${sellers.length} satıcı frontend'e gönderiliyor`);
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
            WHERE s.id = ? AND s.is_active = TRUE
        `;
        
        const dbSellers = await db.query(query, [sellerId]);
        
        if (dbSellers.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Satıcı bulunamadı." 
            });
        }
        
        const dbSeller = dbSellers[0];
        
        // Resim URL'lerini kontrol et - via.placeholder.com içeriyorsa veya geçersiz URL'leri temizle
        let imageUrl = dbSeller.imageUrl;
        if (!imageUrl || 
            imageUrl.trim() === '' || 
            !imageUrl.startsWith('http') ||
            imageUrl.includes('via.placeholder.com') ||
            imageUrl.includes('placeholder.com') ||
            imageUrl.includes('400x200.png') ||
            imageUrl.includes('1920x400.png')) {
            imageUrl = null; // Frontend'de SVG placeholder kullanılacak
        }
        
        let bannerUrl = dbSeller.bannerUrl;
        if (!bannerUrl || 
            bannerUrl.trim() === '' || 
            !bannerUrl.startsWith('http') ||
            bannerUrl.includes('via.placeholder.com') ||
            bannerUrl.includes('placeholder.com') ||
            bannerUrl.includes('400x200.png') ||
            bannerUrl.includes('1920x400.png')) {
            bannerUrl = null; // Frontend'de SVG placeholder kullanılacak
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
                !mealImageUrl.startsWith('http') ||
                mealImageUrl.includes('via.placeholder.com') ||
                mealImageUrl.includes('placeholder.com') ||
                mealImageUrl.includes('400x200.png') ||
                mealImageUrl.includes('250x150.png')) {
                mealImageUrl = null; // Frontend'de SVG placeholder kullanılacak
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

