const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const { Seller } = require("../../models");

router.get("/", async (req, res) => {
    try {
        const { location, rating } = req.query;
        const dbSellers = await Seller.findAll({
            where: { is_active: true },
            attributes: [
                'id', 'shop_name', 'location', 'rating', 'logo_url', 
                'banner_url', 'description', 'delivery_fee', 
                'min_order_amount', 'total_reviews', 'is_active'
            ],
            order: [['rating', 'DESC'], ['total_reviews', 'DESC']]
        });
        const sellers = dbSellers.map(seller => {
            let imageUrl = seller.logo_url;
            if (!imageUrl || imageUrl.trim() === '' || imageUrl.includes('placeholder')) {
                imageUrl = null;
            }
            let bannerUrl = seller.banner_url;
            if (!bannerUrl || bannerUrl.trim() === '' || bannerUrl.includes('placeholder')) {
                bannerUrl = null;
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
                totalReviews: parseInt(seller.total_reviews) || 0
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

        if (req.query.limit) {
            const limit = parseInt(req.query.limit);
            if (!isNaN(limit) && limit > 0) {
                filteredSellers = filteredSellers.slice(0, limit);
            }
        }
        
        res.json({
            success: true,
            sellers: filteredSellers
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Sunucu hatası.",
            sellers: []
        });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const sellerId = parseInt(req.params.id);
        const seller = await Seller.findOne({
            where: { id: sellerId, is_active: true },
            attributes: [
                'id', 'shop_name', 'location', 'rating', 'logo_url',
                'banner_url', 'description', 'delivery_fee',
                'min_order_amount', 'total_reviews', 'is_active'
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
            totalReviews: parseInt(seller.total_reviews) || 0
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

router.get("/:id/menu", async (req, res) => {
    try {
        const sellerId = parseInt(req.params.id);
        const { Meal } = require("../../models");

        const meals = await Meal.findAll({
            where: { seller_id: sellerId, is_available: true },
            attributes: ['id', 'category', 'name', 'description', 'price', 'image_url'],
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
                imageUrl: mealImageUrl
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
