const { Notification } = require('../models');

let pushHelper = null;
try { pushHelper = require('./pushHelper'); } catch (_) { pushHelper = null; }

async function createNotification(userId, type, title, message, relatedId = null) {
    try {
        const notif = await Notification.create({
            user_id: userId,
            type: type || 'info',
            title: title || 'Bildirim',
            message: message || '',
            related_id: relatedId,
            is_read: false
        });

        if (global.io) {
            global.io.to(`user-${userId}`).emit('notification', {
                id: notif.id,
                type: notif.type,
                title: notif.title,
                message: notif.message,
                relatedId: notif.related_id,
                createdAt: notif.created_at
            });
        }

        // Web Push (yapılandırılmışsa) — fire and forget
        if (pushHelper && pushHelper.isAvailable && pushHelper.isAvailable()) {
            const pushPayload = {
                title: title || 'Bildirim',
                body: message || '',
                tag: `notif-${notif.id}`,
                data: { url: notificationUrlForType(type, relatedId), notificationId: notif.id }
            };
            pushHelper.sendPushToUser(userId, pushPayload).catch(() => {});
        }

        return notif;
    } catch (err) {
        console.error('createNotification error:', err);
        return null;
    }
}

function notificationUrlForType(type, relatedId) {
    if (!type) return '/';
    if (type.startsWith('order') && relatedId) return `/buyer/order-confirmation/${relatedId}`;
    if (type === 'new_order' && relatedId) return `/seller/orders`;
    if (type === 'courier_task' && relatedId) return `/courier/dashboard`;
    if (type === 'review_reply' && relatedId) return `/buyer/orders`;
    return '/';
}

module.exports = { createNotification };
