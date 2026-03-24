const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const { Seller, Review } = require("../../models");
const { Op, Sequelize } = require('sequelize');
const { idParam, optionalLimit, handleValidationErrors } = require("../../middleware/validate");

router.get("/", optionalLimit, handleValidationErrors, async (req, res) => {
    try {
        const { location, rating, q, min_order } = req.query;
        const dbSellers = await Seller.findAll({
            where: { is_active: true },
            attributes: [
                'id', 'shop_name', 'location', 'rating', 'logo_url', 
                'banner_url', 'description', 'delivery_fee', 
                'min_order_amount', 'total_reviews', 'is_active'
            ],
            order: [['rating', 'DESC'], ['total_reviews', 'DESC']]
        });

        const sellerIds = dbSellers.map((seller) => seller.id);
        const ratingRows = sellerIds.length > 0 ? await Review.findAll({
            where: {
                seller_id: { [Op.in]: sellerIds },
                is_visible: true
            },
            attributes: [
                'seller_id',
                [Sequelize.fn('COUNT', Sequelize.col('id')), 'review_count'],
                [Sequelize.fn('AVG', Sequelize.col('rating')), 'avg_rating']
            ],
            group: ['seller_id'],
            raw: true
        }) : [];

        const ratingMap = new Map(
            ratingRows.map((row) => [
                parseInt(row.seller_id, 10),
                {
                    reviewCount: parseInt(row.review_count, 10) || 0,
                    averageRating: row.avg_rating != null ? parseFloat(Number(row.avg_rating).toFixed(2)) : 0
                }
            ])
        );

        const sellers = dbSellers.map(seller => {
            let imageUrl = seller.logo_url;
            if (!imageUrl || imageUrl.trim() === '' || imageUrl.includes('placeholder')) {
                imageUrl = null;
            }
            let bannerUrl = seller.banner_url;
            if (!bannerUrl || bannerUrl.trim() === '' || bannerUrl.includes('placeholder')) {
                bannerUrl = null;
            }

            const ratingInfo = ratingMap.get(seller.id) || { reviewCount: 0, averageRating: 0 };

            return {
                id: seller.id,
                name: seller.shop_name || 'İsimsiz Satıcı',
                location: seller.location || 'Konum belirtilmemiş',
                rating: ratingInfo.averageRating,
                imageUrl,
                bannerUrl,
                description: seller.description || "",
                deliveryFee: parseFloat(seller.delivery_fee) || 15.00,
                minOrderAmount: parseFloat(seller.min_order_amount) || 50.00,
                totalReviews: ratingInfo.reviewCount
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

        const ratingRow = await Review.findOne({
            where: { seller_id: seller.id, is_visible: true },
            attributes: [
                [Sequelize.fn('COUNT', Sequelize.col('id')), 'review_count'],
                [Sequelize.fn('AVG', Sequelize.col('rating')), 'avg_rating']
            ],
            raw: true
        });

        const liveReviewCount = ratingRow ? (parseInt(ratingRow.review_count, 10) || 0) : 0;
        const liveAverageRating = ratingRow && ratingRow.avg_rating != null
            ? parseFloat(Number(ratingRow.avg_rating).toFixed(2))
            : 0;

        res.json({
            id: seller.id,
            name: seller.shop_name,
            location: seller.location,
            rating: liveAverageRating,
            imageUrl,
            bannerUrl,
            description: seller.description || "",
            deliveryFee: parseFloat(seller.delivery_fee) || 15.00,
            minOrderAmount: parseFloat(seller.min_order_amount) || 50.00,
            totalReviews: liveReviewCount
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
