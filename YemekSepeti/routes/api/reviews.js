const express = require('express');
const router = express.Router();
const { Sequelize } = require('sequelize');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { handleValidationErrors, createReviewValidation } = require('../../middleware/validate');
const { Review, Order, User, Seller } = require('../../models');
const { recalculateSellerRatings } = require('../../lib/sellerRatingHelper');

// Ad + soyad baş harfi: "Emirhan Ç." — tam ad yerine kısmi PII
function maskFullname(fullname) {
    if (!fullname) return 'Anonim';
    const parts = fullname.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    const lastName = parts[parts.length - 1];
    return parts.slice(0, -1).join(' ') + ' ' + lastName.charAt(0).toUpperCase() + '.';
}

// Satıcıya ait yorumları listele (herkese açık)
router.get('/seller/:sellerId', async (req, res) => {
    try {
        const sellerId = parseInt(req.params.sellerId);
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const reviews = await Review.findAll({
            where: { seller_id: sellerId, is_visible: true },
            include: [{ model: User, as: 'user', attributes: ['fullname'], where: { is_active: true } }],
            order: [['created_at', 'DESC']],
            limit,
            attributes: ['id', 'rating', 'comment', 'created_at', 'seller_reply', 'seller_reply_at']
        });
        const list = reviews.map(r => ({
            id: r.id,
            rating: r.rating,
            comment: r.comment,
            userName: maskFullname(r.user ? r.user.fullname : null),
            createdAt: r.created_at,
            sellerReply: r.seller_reply || null,
            sellerReplyAt: r.seller_reply_at || null
        }));
        const avgResult = await Review.findOne({
            where: { seller_id: sellerId, is_visible: true },
            include: [{ model: User, as: 'user', attributes: [], where: { is_active: true } }],
            attributes: [[Sequelize.fn('AVG', Sequelize.col('Review.rating')), 'avg']],
            raw: true
        });
        const averageRating = avgResult && avgResult.avg != null ? parseFloat(Number(avgResult.avg).toFixed(2)) : 0;
        res.json({ success: true, reviews: list, averageRating });
    } catch (err) {
        console.error('Reviews list error:', err);
        res.status(500).json({ success: false, message: 'Yorumlar yüklenemedi.', reviews: [] });
    }
});

// Satıcının kendi yorumlarını listele (yanıt yazmak için panelden çekilir)
router.get('/mine', requireAuth, requireRole('seller'), async (req, res) => {
    try {
        const seller = await Seller.findOne({ where: { user_id: req.session.user.id }, attributes: ['id'] });
        if (!seller) return res.status(404).json({ success: false, message: 'Satıcı kaydı bulunamadı.' });
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const reviews = await Review.findAll({
            where: { seller_id: seller.id, is_visible: true },
            include: [{ model: User, as: 'user', attributes: ['fullname'] }],
            order: [['created_at', 'DESC']],
            limit,
            attributes: ['id', 'rating', 'comment', 'created_at', 'seller_reply', 'seller_reply_at']
        });
        const list = reviews.map(r => ({
            id: r.id,
            rating: r.rating,
            comment: r.comment,
            userName: maskFullname(r.user ? r.user.fullname : null),
            createdAt: r.created_at,
            sellerReply: r.seller_reply || null,
            sellerReplyAt: r.seller_reply_at || null
        }));
        res.json({ success: true, reviews: list });
    } catch (err) {
        console.error('Seller own reviews error:', err);
        res.status(500).json({ success: false, message: 'Yorumlar yüklenemedi.', reviews: [] });
    }
});

// Satıcı: yoruma yanıt yaz (sadece kendi yorumlarına)
router.post('/:id/reply', requireAuth, requireRole('seller'), async (req, res) => {
    try {
        const reviewId = parseInt(req.params.id);
        const reply = (req.body && req.body.reply || '').toString().trim();
        if (!reviewId) return res.status(400).json({ success: false, message: 'Geçersiz yorum ID.' });
        if (!reply) return res.status(400).json({ success: false, message: 'Yanıt boş olamaz.' });
        if (reply.length > 1000) return res.status(400).json({ success: false, message: 'Yanıt 1000 karakteri geçemez.' });

        const seller = await Seller.findOne({ where: { user_id: req.session.user.id }, attributes: ['id'] });
        if (!seller) return res.status(403).json({ success: false, message: 'Satıcı yetkisi yok.' });

        const review = await Review.findByPk(reviewId, { attributes: ['id', 'seller_id', 'user_id'] });
        if (!review) return res.status(404).json({ success: false, message: 'Yorum bulunamadı.' });
        if (review.seller_id !== seller.id) {
            return res.status(403).json({ success: false, message: 'Bu yoruma yanıt verme yetkiniz yok.' });
        }

        await Review.update(
            { seller_reply: reply, seller_reply_at: new Date() },
            { where: { id: reviewId } }
        );

        // Müşteriye bildirim (var ise notificationHelper)
        try {
            const helper = require('../../lib/notificationHelper');
            await helper.createNotification(
                review.user_id,
                'review_reply',
                'Yorumunuza yanıt geldi',
                'Bir satıcı yorumunuza yanıt yazdı.',
                reviewId
            );
        } catch (_) {}

        res.json({ success: true, message: 'Yanıt kaydedildi.', reply, replyAt: new Date() });
    } catch (err) {
        console.error('Review reply error:', err);
        res.status(500).json({ success: false, message: 'Yanıt kaydedilemedi.' });
    }
});

// Satıcı: kendi yanıtını sil
router.delete('/:id/reply', requireAuth, requireRole('seller'), async (req, res) => {
    try {
        const reviewId = parseInt(req.params.id);
        if (!reviewId) return res.status(400).json({ success: false, message: 'Geçersiz yorum ID.' });

        const seller = await Seller.findOne({ where: { user_id: req.session.user.id }, attributes: ['id'] });
        if (!seller) return res.status(403).json({ success: false, message: 'Satıcı yetkisi yok.' });

        const review = await Review.findByPk(reviewId, { attributes: ['id', 'seller_id'] });
        if (!review) return res.status(404).json({ success: false, message: 'Yorum bulunamadı.' });
        if (review.seller_id !== seller.id) {
            return res.status(403).json({ success: false, message: 'Yetki yok.' });
        }

        await Review.update(
            { seller_reply: null, seller_reply_at: null },
            { where: { id: reviewId } }
        );
        res.json({ success: true, message: 'Yanıt silindi.' });
    } catch (err) {
        console.error('Review reply delete error:', err);
        res.status(500).json({ success: false, message: 'Yanıt silinemedi.' });
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
            await recalculateSellerRatings([seller.id]);
        }
        res.status(201).json({ success: true, review: { id: review.id, rating: review.rating, comment: review.comment } });
    } catch (err) {
        console.error('Review create error:', err);
        res.status(500).json({ success: false, message: 'Değerlendirme kaydedilemedi.' });
    }
});

module.exports = router;
