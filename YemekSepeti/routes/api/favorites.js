const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../../middleware/auth');
const { UserFavoriteSeller, Seller, User } = require('../../models');

router.use(requireAuth);
router.use(requireRole('buyer'));

// Favori listesi (satıcı detaylarıyla)
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const favs = await UserFavoriteSeller.findAll({
            where: { user_id: userId },
            include: [{
                model: Seller,
                as: 'seller',
                required: true,
                where: { is_active: true },
                attributes: ['id', 'shop_name', 'location', 'rating', 'logo_url', 'delivery_fee', 'min_order_amount', 'total_reviews']
            }]
        });
        const sellers = favs.map(f => {
            const s = f.seller;
            return {
                id: s.id,
                name: s.shop_name,
                location: s.location,
                rating: parseFloat(s.rating) || 0,
                imageUrl: s.logo_url || null,
                deliveryFee: parseFloat(s.delivery_fee) || 15,
                minOrderAmount: parseFloat(s.min_order_amount) || 50,
                totalReviews: parseInt(s.total_reviews) || 0
            };
        });
        res.json({ success: true, favorites: sellers });
    } catch (err) {
        console.error('Favorites list error:', err);
        res.status(500).json({ success: false, message: 'Favoriler yüklenemedi.', favorites: [] });
    }
});

// Favorilere ekle
router.post('/:sellerId', async (req, res) => {
    try {
        const userId = req.user.id;
        const sellerId = parseInt(req.params.sellerId);
        if (isNaN(sellerId)) return res.status(400).json({ success: false, message: 'Geçersiz satıcı ID.' });
        const seller = await Seller.findOne({ where: { id: sellerId, is_active: true } });
        if (!seller) return res.status(404).json({ success: false, message: 'Satıcı bulunamadı.' });
        const [fav] = await UserFavoriteSeller.findOrCreate({
            where: { user_id: userId, seller_id: sellerId },
            defaults: { user_id: userId, seller_id: sellerId }
        });
        res.status(201).json({ success: true, message: 'Favorilere eklendi.', added: fav.isNewRecord });
    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError')
            return res.json({ success: true, message: 'Zaten favorilerde.', added: false });
        res.status(500).json({ success: false, message: 'Eklenemedi.' });
    }
});

// Favorilerden çıkar
router.delete('/:sellerId', async (req, res) => {
    try {
        const userId = req.user.id;
        const sellerId = parseInt(req.params.sellerId);
        const deleted = await UserFavoriteSeller.destroy({
            where: { user_id: userId, seller_id: sellerId }
        });
        res.json({ success: true, removed: deleted > 0 });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Kaldırılamadı.' });
    }
});

// Bir satıcının favoride olup olmadığı (tekil kontrol)
router.get('/check/:sellerId', async (req, res) => {
    try {
        const userId = req.user.id;
        const sellerId = parseInt(req.params.sellerId);
        const fav = await UserFavoriteSeller.findOne({
            where: { user_id: userId, seller_id: sellerId }
        });
        res.json({ success: true, isFavorite: !!fav });
    } catch (err) {
        res.status(500).json({ success: false, isFavorite: false });
    }
});

module.exports = router;
