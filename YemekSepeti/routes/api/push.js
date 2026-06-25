const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');
const { sequelize } = require('../../config/sequelize');
const pushHelper = require('../../lib/pushHelper');

// Public VAPID anahtarını döndür (frontend abone olurken kullanır)
router.get('/public-key', (req, res) => {
    const key = pushHelper.getPublicKey();
    if (!key) return res.status(503).json({ success: false, message: 'Push servisi yapılandırılmamış.' });
    res.json({ success: true, publicKey: key });
});

// Aboneliği kaydet
router.post('/subscribe', requireAuth, async (req, res) => {
    try {
        const userId = req.session?.user?.id || req.user?.id;
        if (!userId) return res.status(401).json({ success: false, message: 'Oturum gerekli.' });

        const { endpoint, keys } = req.body || {};
        if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
            return res.status(400).json({ success: false, message: 'Geçersiz abonelik verisi.' });
        }
        // SSRF koruması: yalnızca HTTPS Web Push servis URL'lerine izin ver
        try {
            const epUrl = new URL(endpoint);
            if (epUrl.protocol !== 'https:') throw new Error('HTTPS zorunlu');
            const host = epUrl.hostname.toLowerCase();
            const isPrivate = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.');
            if (isPrivate) throw new Error('Özel ağ adresleri yasak');
        } catch (urlErr) {
            return res.status(400).json({ success: false, message: 'Geçersiz push endpoint URL\'si.' });
        }

        await sequelize.query(
            `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth)`,
            { replacements: [userId, endpoint, keys.p256dh, keys.auth] }
        );

        res.json({ success: true, message: 'Bildirim aboneliği kaydedildi.' });
    } catch (err) {
        console.error('Push subscribe error:', err);
        res.status(500).json({ success: false, message: 'Abonelik kaydedilemedi.' });
    }
});

// Aboneliği sil
router.post('/unsubscribe', requireAuth, async (req, res) => {
    try {
        const userId = req.session?.user?.id || req.user?.id;
        const { endpoint } = req.body || {};
        if (!endpoint) return res.status(400).json({ success: false, message: 'Endpoint gerekli.' });

        await sequelize.query(
            'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
            { replacements: [userId, endpoint] }
        );
        res.json({ success: true, message: 'Abonelik kaldırıldı.' });
    } catch (err) {
        console.error('Push unsubscribe error:', err);
        res.status(500).json({ success: false, message: 'Abonelik silinemedi.' });
    }
});

// Aboneliği test et (manuel)
router.post('/test', requireAuth, async (req, res) => {
    try {
        const userId = req.session?.user?.id || req.user?.id;
        const result = await pushHelper.sendPushToUser(userId, {
            title: 'Test Bildirimi',
            body: 'Push bildirimleri çalışıyor 🎉',
            icon: '/favicon.png',
            tag: 'test'
        });
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
