const { Notification } = require('../models');

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
        return notif;
    } catch (err) {
        console.error('createNotification error:', err);
        return null;
    }
}

module.exports = { createNotification };
