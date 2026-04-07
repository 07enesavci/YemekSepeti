const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const { Seller } = require("../../models");
const { idParam, optionalLimit, handleValidationErrors } = require("../../middleware/validate");
const { getCityCoordinates, haversineDistance } = require("../../data/turkey-coordinates");

router.get("/", optionalLimit, handleValidationErrors, async (req, res) => {
    try {
        const { location, rating, q, min_order, userLat, userLng } = req.query;
        const dbSellers = await Seller.findAll({
            where: { is_active: true },
            attributes: [
                'id', 'shop_name', 'location', 'rating', 'logo_url', 
                'banner_url', 'description', 'delivery_fee', 
                'min_order_amount', 'total_reviews', 'is_active', 'is_open',
                'delivery_radius_km', 'latitude', 'longitude'
            ],
            order: [['rating', 'DESC'], ['total_reviews', 'DESC']]
        });
        
        // Alıcının konumunu al
        const buyerLat = userLat ? parseFloat(userLat) : null;
        const buyerLng = userLng ? parseFloat(userLng) : null;
        const hasBuyerLocation = buyerLat !== null && buyerLng !== null && !isNaN(buyerLat) && !isNaN(buyerLng);
        
        const sellers = dbSellers.map(seller => {
            let imageUrl = seller.logo_url;
            if (!imageUrl || imageUrl.trim() === '' || imageUrl.includes('placeholder')) {
                imageUrl = null;
            }
            let bannerUrl = seller.banner_url;
            if (!bannerUrl || bannerUrl.trim() === '' || bannerUrl.includes('placeholder')) {
                bannerUrl = null;
            }
            
            // Satıcının koordinatlarını belirle (DB'den veya location string'inden)
            let sellerLat = seller.latitude ? parseFloat(seller.latitude) : null;
            let sellerLng = seller.longitude ? parseFloat(seller.longitude) : null;
            
            if ((!sellerLat || !sellerLng) && seller.location) {
                const coords = getCityCoordinates(seller.location);
                if (coords) {
                    sellerLat = coords.lat;
                    sellerLng = coords.lng;
                }
            }
            
            const radiusKm = parseInt(seller.delivery_radius_km) || 0;
            
            // Mesafe hesapla ve yarıçap filtresi uygula
            let distance = null;
            if (hasBuyerLocation && sellerLat && sellerLng) {
                distance = haversineDistance(buyerLat, buyerLng, sellerLat, sellerLng);
                distance = Math.round(distance * 10) / 10; // 1 ondalık basamak
                
                // Satıcı bir yarıçap belirlediyse ve alıcı dışındaysa → gösterme
                if (radiusKm > 0 && distance > radiusKm) {
                    return null; // filtrele
                }
            }
            
            return {
                id: seller.id,
                name: seller.shop_name || 'İsimsiz Satıcı',
                location: seller.location || 'Konum belirtilmemiş',
                rating: parseFloat(seller.rating) || 0,
                imageUrl,
                bannerUrl,
                description: seller.description || "",
                deliveryFee: parseFloat(seller.delivery_fee) || 15.00,
                minOrderAmount: parseFloat(seller.min_order_amount) || 50.00,
                totalReviews: parseInt(seller.total_reviews) || 0,
                isOpen: !!seller.is_open,
                deliveryRadiusKm: radiusKm,
                distance: distance // Alıcıya mesafe (km) — null ise bilinmiyor
            };
        }).filter(Boolean);

        let filteredSellers = sellers;
        if (location) {
            const locationLower = location.toLowerCase();
            filteredSellers = filteredSellers.filter(s => 
                s.location && s.location.toLowerCase().includes(locationLower)
            );
        }

        if (rating) {
            const minRating = parseFloat(rating);
            if (!isNaN(minRating) && minRating >= 0 && minRating <= 5) {
                filteredSellers = filteredSellers.filter(s => s.rating >= minRating);
            }
        }
        if (q && String(q).trim()) {
            const qLower = String(q).trim().toLowerCase();
            filteredSellers = filteredSellers.filter(s =>
                (s.name && s.name.toLowerCase().includes(qLower)) ||
                (s.description && s.description.toLowerCase().includes(qLower)) ||
                (s.location && s.location.toLowerCase().includes(qLower))
            );
        }
        if (min_order !== undefined && min_order !== '') {
            const minOrderVal = parseFloat(min_order);
            if (!isNaN(minOrderVal) && minOrderVal >= 0) {
                filteredSellers = filteredSellers.filter(s => (s.minOrderAmount || 0) <= minOrderVal);
            }
        }
        
        // Konuma göre yakından uzağa sırala (mesafe biliniyorsa)
        if (hasBuyerLocation) {
            filteredSellers.sort((a, b) => {
                if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
                if (a.distance !== null) return -1;
                if (b.distance !== null) return 1;
                return 0;
            });
        }

        const totalCount = filteredSellers.length;
        const limit = req.query.limit != null ? Number(req.query.limit) : null;
        const offset = req.query.offset != null ? Math.max(0, Number(req.query.offset)) : 0;
        if (limit != null && !isNaN(limit) && limit > 0) {
            const max = Math.min(limit, 100);
            filteredSellers = filteredSellers.slice(offset, offset + max);
        } else if (offset > 0) {
            filteredSellers = filteredSellers.slice(offset, offset + 50);
        }
        
        res.json({
            success: true,
            sellers: filteredSellers,
            totalCount: totalCount,
            hasMore: (offset + filteredSellers.length) < totalCount
        });
    } catch (error) {
        console.error("Sellers list error:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası.",
            sellers: []
        });
    }
});

router.get("/:id", idParam, handleValidationErrors, async (req, res) => {
    try {
        const sellerId = parseInt(req.params.id, 10);
        const seller = await Seller.findOne({
            where: { id: sellerId, is_active: true },
            attributes: [
                'id', 'shop_name', 'location', 'rating', 'logo_url',
                'banner_url', 'description', 'delivery_fee',
                'min_order_amount', 'total_reviews', 'is_active', 'is_open'
            ]
        });

        if (!seller) {
            return res.status(404).json({
                success: false,
                message: "Satıcı bulunamadı."
            });
        }

        let imageUrl = seller.logo_url;
        if (!imageUrl || imageUrl.trim() === '' || imageUrl.includes('placeholder')) {
            imageUrl = null;
        }

        let bannerUrl = seller.banner_url;
        if (!bannerUrl || bannerUrl.trim() === '' || bannerUrl.includes('placeholder')) {
            bannerUrl = null;
        }

        res.json({
            id: seller.id,
            name: seller.shop_name,
            location: seller.location,
            rating: parseFloat(seller.rating) || 0,
            imageUrl,
            bannerUrl,
            description: seller.description || "",
            deliveryFee: parseFloat(seller.delivery_fee) || 15.00,
            minOrderAmount: parseFloat(seller.min_order_amount) || 50.00,
            totalReviews: parseInt(seller.total_reviews) || 0,
            isOpen: !!seller.is_open
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

router.get("/:id/menu", idParam, handleValidationErrors, async (req, res) => {
    try {
        const sellerId = parseInt(req.params.id, 10);
        const { Meal } = require("../../models");

        const meals = await Meal.findAll({
            where: { seller_id: sellerId, is_approved: true },
            attributes: ['id', 'category', 'name', 'description', 'price', 'image_url', 'is_available'],
            order: [['category', 'ASC'], ['name', 'ASC']]
        });

        const menu = meals.map(meal => {
            let mealImageUrl = meal.image_url;
            if (!mealImageUrl || mealImageUrl.trim() === '' || mealImageUrl.includes('placeholder')) {
                mealImageUrl = null;
            }
            return {
                id: meal.id,
                category: meal.category || 'Diğer',
                name: meal.name,
                description: meal.description || "",
                price: parseFloat(meal.price) || 0,
                imageUrl: mealImageUrl,
                isAvailable: !!meal.is_available
            };
        });

        res.json(menu);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

module.exports = router;
