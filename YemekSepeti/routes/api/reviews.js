const express = require('express');
const router = express.Router();
const { Sequelize } = require('sequelize');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { handleValidationErrors, createReviewValidation } = require('../../middleware/validate');
const { Review, Order, User, Seller } = require('../../models');

// Satıcıya ait yorumları listele (herkese açık)
router.get('/seller/:sellerId', async (req, res) => {
    try {
        const sellerId = parseInt(req.params.sellerId);
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const reviews = await Review.findAll({
            where: { seller_id: sellerId, is_visible: true },
            include: [{ model: User, as: 'user', attributes: ['fullname'] }],
            order: [['created_at', 'DESC']],
            limit,
            attributes: ['id', 'rating', 'comment', 'created_at']
        });
        const list = reviews.map(r => ({
            id: r.id,
            rating: r.rating,
            comment: r.comment,
            userName: r.user ? r.user.fullname : 'Anonim',
            createdAt: r.created_at
        }));
        const avgResult = await Review.findOne({
            where: { seller_id: sellerId, is_visible: true },
            attributes: [[Sequelize.fn('AVG', Sequelize.col('rating')), 'avg']],
            raw: true
        });
        const averageRating = avgResult && avgResult.avg != null ? parseFloat(Number(avgResult.avg).toFixed(2)) : 0;
        res.json({ success: true, reviews: list, averageRating });
    } catch (err) {
        console.error('Reviews list error:', err);
        res.status(500).json({ success: false, message: 'Yorumlar yüklenemedi.', reviews: [] });
    }
});

// Yorum ekle (alıcı, siparişi teslim edilmiş olmalı)
router.post('/', requireAuth, requireRole('buyer'), createReviewValidation, handleValidationErrors, async (req, res) => {
    try {
        const userId = req.user.id;
        const { order_id, rating, comment } = req.body;
        const order = await Order.findOne({
            where: { id: order_id, user_id: userId, status: 'delivered' }
        });
        if (!order) return res.status(404).json({ success: false, message: 'Sipariş bulunamadı veya henüz teslim edilmedi.' });
        const existing = await Review.findOne({ where: { order_id } });
        if (existing) return res.status(400).json({ success: false, message: 'Bu sipariş için zaten değerlendirme yaptınız.' });
        const review = await Review.create({
            order_id,
            user_id: userId,
            seller_id: order.seller_id,
            rating: parseInt(rating, 10),
            comment: (comment || '').trim() || null,
            is_visible: true
        });
        const seller = await Seller.findByPk(order.seller_id);
        if (seller) {
            const count = await Review.count({ where: { seller_id: seller.id, is_visible: true } });
            const avgRow = await Review.findOne({
                where: { seller_id: seller.id, is_visible: true },
                attributes: [[Sequelize.fn('AVG', Sequelize.col('rating')), 'avg']],
                raw: true
            });
            const newAvg = avgRow && avgRow.avg != null ? parseFloat(Number(avgRow.avg).toFixed(2)) : 0;
            await seller.update({ rating: newAvg, total_reviews: count });
        }
        res.status(201).json({ success: true, review: { id: review.id, rating: review.rating, comment: review.comment } });
    } catch (err) {
        console.error('Review create error:', err);
        res.status(500).json({ success: false, message: 'Değerlendirme kaydedilemedi.' });
    }
});

module.exports = router;
