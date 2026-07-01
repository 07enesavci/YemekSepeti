const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');
const { Feedback } = require('../../models');

router.use(requireAuth);

const VALID_TYPES = ['suggestion', 'complaint'];
// buyer/seller/courier öneri-şikayet gönderebilir. Admin bu formu kullanmaz.
const ALLOWED_ROLES = ['buyer', 'seller', 'courier', 'user'];

// Rolü normalize et — bazı alıcılar 'user' rolü ile kayıtlı olabilir
function normalizeRole(role) {
    return role === 'user' ? 'buyer' : role;
}

// Yeni öneri / şikayet gönder
router.post('/', async (req, res) => {
    try {
        const user = req.user;
        if (!user || !ALLOWED_ROLES.includes(user.role)) {
            return res.status(403).json({ success: false, message: 'Bu işlem için yetkiniz yok.' });
        }

        let { type, subject, message } = req.body;
        type = typeof type === 'string' ? type.trim() : '';
        subject = typeof subject === 'string' ? subject.trim() : '';
        message = typeof message === 'string' ? message.trim() : '';

        if (!VALID_TYPES.includes(type)) {
            return res.status(400).json({ success: false, message: 'Lütfen öneri veya şikayet seçin.' });
        }
        if (subject.length < 3 || subject.length > 150) {
            return res.status(400).json({ success: false, message: 'Konu 3-150 karakter arasında olmalıdır.' });
        }
        if (message.length < 10 || message.length > 3000) {
            return res.status(400).json({ success: false, message: 'Mesaj 10-3000 karakter arasında olmalıdır.' });
        }

        const record = await Feedback.create({
            user_id: user.id,
            role: normalizeRole(user.role),
            type,
            subject,
            message,
            status: 'open'
        });

        // Adminleri bilgilendir (canlı liste güncellemesi)
        if (global.io) {
            global.io.to('admin').emit('feedback_created', { id: record.id, type, role: normalizeRole(user.role) });
        }

        return res.status(201).json({ success: true, message: 'Talebiniz alındı. En kısa sürede değerlendirilecektir.' });
    } catch (error) {
        console.error('Feedback gönderme hatası:', error.message);
        return res.status(500).json({ success: false, message: 'Talebiniz gönderilemedi. Lütfen tekrar deneyin.' });
    }
});

// Kullanıcının kendi gönderdiği talepler (durum + admin yanıtı ile)
router.get('/mine', async (req, res) => {
    try {
        const rows = await Feedback.findAll({
            where: { user_id: req.user.id },
            order: [['created_at', 'DESC']],
            limit: 50,
            attributes: ['id', 'type', 'subject', 'message', 'status', 'admin_note', 'created_at']
        });
        return res.json({
            success: true,
            data: rows.map(r => ({
                id: r.id,
                type: r.type,
                subject: r.subject,
                message: r.message,
                status: r.status,
                adminNote: r.admin_note,
                createdAt: r.created_at
            }))
        });
    } catch (error) {
        console.error('Feedback listeleme hatası:', error.message);
        return res.status(500).json({ success: false, data: [], message: 'Talepler yüklenemedi.' });
    }
});

module.exports = router;
