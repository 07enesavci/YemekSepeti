const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');
const { Notification } = require('../../models');
const { Op } = require('sequelize');

router.use(requireAuth);

// Listele (okunmamış önce, sonra tarih)
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const offset = parseInt(req.query.offset) || 0;
        const unreadOnly = req.query.unread === 'true';

        const where = { user_id: userId };
        if (unreadOnly) where.is_read = false;

        const notifications = await Notification.findAll({
            where,
            order: [['is_read', 'ASC'], ['created_at', 'DESC']],
            limit,
            offset,
            attributes: ['id', 'type', 'title', 'message', 'related_id', 'is_read', 'created_at']
        });

        const unreadCount = await Notification.count({ where: { user_id: userId, is_read: false } });

        res.json({
            success: true,
            notifications: notifications.map(n => ({
                id: n.id,
                type: n.type,
                title: n.title,
                message: n.message,
                relatedId: n.related_id,
                isRead: n.is_read,
                createdAt: n.created_at
            })),
            unreadCount
        });
    } catch (err) {
        console.error('Notifications list error:', err);
        res.status(500).json({ success: false, message: 'Bildirimler yüklenemedi.' });
    }
});

// Tekil okundu işaretle
router.put('/:id/read', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const userId = req.user.id;
        const notif = await Notification.findOne({ where: { id, user_id: userId } });
        if (!notif) return res.status(404).json({ success: false, message: 'Bildirim bulunamadı.' });
        await notif.update({ is_read: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'İşlem başarısız.' });
    }
});

// Hepsini okundu işaretle
router.post('/read-all', async (req, res) => {
    try {
        const userId = req.user.id;
        await Notification.update({ is_read: true }, { where: { user_id: userId } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'İşlem başarısız.' });
    }
});

// Okunmamış sayısı (hafif endpoint)
router.get('/unread-count', async (req, res) => {
    try {
        const userId = req.user.id;
        const count = await Notification.count({ where: { user_id: userId, is_read: false } });
        res.json({ success: true, unreadCount: count });
    } catch (err) {
        res.status(500).json({ success: false, unreadCount: 0 });
    }
});

module.exports = router;
