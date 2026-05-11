/**
 * Web Push Notification yardımcısı.
 *
 * Kurulum:
 *   1) npm install web-push
 *   2) VAPID anahtarları üret:
 *        npx web-push generate-vapid-keys
 *   3) .env dosyasına ekle:
 *        VAPID_PUBLIC_KEY=...
 *        VAPID_PRIVATE_KEY=...
 *        VAPID_CONTACT=mailto:admin@example.com
 *
 * Eğer web-push paketi yüklü değilse veya VAPID anahtarları yoksa,
 * sendPushToUser() sessizce no-op çalışır — uygulamayı çökertmez.
 */

let webpush = null;
let isConfigured = false;

try {
    webpush = require('web-push');
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const contact = process.env.VAPID_CONTACT || 'mailto:admin@example.com';
    if (publicKey && privateKey) {
        webpush.setVapidDetails(contact, publicKey, privateKey);
        isConfigured = true;
        console.log('🔔 Web Push: VAPID yapılandırıldı.');
    } else {
        console.warn('⚠️ Web Push: VAPID anahtarları .env içinde yok. Push devre dışı.');
    }
} catch (e) {
    console.warn('⚠️ Web Push: web-push paketi yüklü değil. `npm install web-push` çalıştırın.');
}

function isAvailable() {
    return isConfigured && !!webpush;
}

function getPublicKey() {
    return process.env.VAPID_PUBLIC_KEY || null;
}

async function sendPushToUser(userId, payload) {
    if (!isAvailable()) return { skipped: true };

    let sequelize;
    try {
        sequelize = require('../config/sequelize').sequelize;
    } catch (e) {
        return { skipped: true };
    }

    let subs = [];
    try {
        const [rows] = await sequelize.query(
            'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?',
            { replacements: [userId] }
        );
        subs = rows || [];
    } catch (e) {
        return { skipped: true, error: e.message };
    }

    if (subs.length === 0) return { sent: 0 };

    const payloadStr = JSON.stringify(payload || {});
    let sent = 0;
    let removed = 0;

    for (const sub of subs) {
        try {
            await webpush.sendNotification({
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth }
            }, payloadStr);
            sent++;
        } catch (err) {
            const code = err && err.statusCode;
            if (code === 404 || code === 410) {
                // Subscription expired/gone — sil
                try {
                    await sequelize.query('DELETE FROM push_subscriptions WHERE id = ?', { replacements: [sub.id] });
                    removed++;
                } catch (_) {}
            }
        }
    }

    return { sent, removed };
}

module.exports = {
    isAvailable,
    getPublicKey,
    sendPushToUser
};
