/**
 * Periyodik (cron benzeri) görevler:
 *  1) Satıcı çalışma saatlerine göre otomatik aç/kapa
 *  2) Onaylanmayan siparişleri otomatik iptal + iade
 *
 * Her görev kendi try-catch'i içinde — biri patlasa diğeri devam eder.
 * setInterval ile çalışır (node-cron bağımlılığı eklenmedi).
 */

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

async function applyScheduleAutoToggle() {
    let Seller, Op;
    try {
        const models = require('../models');
        const sequelize = require('sequelize');
        Seller = models.Seller;
        Op = sequelize.Op;
    } catch (e) {
        return;
    }

    const now = new Date();
    const currentDayKey = DAY_KEYS[now.getDay()];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let sellers = [];
    try {
        sellers = await Seller.findAll({
            where: { opening_hours: { [Op.ne]: null } },
            attributes: ['id', 'opening_hours', 'is_open']
        });
    } catch (e) {
        return;
    }

    for (const seller of sellers) {
        try {
            let schedule = seller.opening_hours;
            if (typeof schedule === 'string') {
                try { schedule = JSON.parse(schedule); } catch (e) { continue; }
            }
            if (!schedule || !schedule.days || schedule.autoToggle === false) continue;

            const dayConfig = schedule.days[currentDayKey];
            if (!dayConfig) continue;

            let shouldBeOpen = false;
            if (dayConfig.enabled) {
                const openParts = (dayConfig.open || '09:00').split(':').map(Number);
                const closeParts = (dayConfig.close || '21:00').split(':').map(Number);
                const openMin = (openParts[0] || 0) * 60 + (openParts[1] || 0);
                const closeMin = (closeParts[0] || 0) * 60 + (closeParts[1] || 0);

                if (closeMin > openMin) {
                    shouldBeOpen = currentMinutes >= openMin && currentMinutes < closeMin;
                } else {
                    // Gece yarısını geçen vardiya (örn. 18:00 - 02:00)
                    shouldBeOpen = currentMinutes >= openMin || currentMinutes < closeMin;
                }
            }

            if (!!seller.is_open !== shouldBeOpen) {
                await Seller.update({ is_open: shouldBeOpen }, { where: { id: seller.id } });
                if (global.io) {
                    global.io.emit('seller_status_updated', {
                        sellerId: seller.id,
                        isOpen: shouldBeOpen,
                        auto: true
                    });
                }
                console.log(`🕒 Otomatik ${shouldBeOpen ? 'açıldı' : 'kapatıldı'}: seller ${seller.id}`);
            }
        } catch (e) {
            console.error('Schedule auto-toggle error for seller', seller.id, e.message);
        }
    }
}

async function applyOrderTimeout() {
    let Order, Seller, CourierTask, User, Op;
    let refundIyzicoPaymentForOrder, createNotification;
    try {
        const models = require('../models');
        const sequelize = require('sequelize');
        Order = models.Order;
        Seller = models.Seller;
        CourierTask = models.CourierTask;
        User = models.User;
        Op = sequelize.Op;
        ({ refundIyzicoPaymentForOrder } = require('./iyzicoRefund'));
        ({ createNotification } = require('./notificationHelper'));
    } catch (e) {
        return;
    }

    const TIMEOUT_MINUTES = parseInt(process.env.ORDER_TIMEOUT_MINUTES || '15', 10);
    if (TIMEOUT_MINUTES <= 0) return; // 0 veya negatif = devre dışı

    const cutoff = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000);

    let expiredOrders = [];
    try {
        expiredOrders = await Order.findAll({
            where: {
                status: 'pending',
                created_at: { [Op.lt]: cutoff }
            },
            attributes: [
                'id', 'status', 'courier_id', 'payment_method',
                'iyzico_payment_data', 'iyzico_refunded_at', 'order_number',
                'seller_id', 'user_id', 'total_amount', 'created_at'
            ]
        });
    } catch (e) {
        return;
    }

    for (const order of expiredOrders) {
        try {
            // iyzico iadesi (varsa)
            if (order.payment_method === 'iyzico' && order.iyzico_payment_data && !order.iyzico_refunded_at) {
                try {
                    await refundIyzicoPaymentForOrder(order, '127.0.0.1');
                    await Order.update({ iyzico_refunded_at: new Date() }, { where: { id: order.id } });
                } catch (refErr) {
                    console.error('Otomatik iptal iadesi başarısız, sipariş iptal edilmedi:', order.id, refErr.message);
                    continue;
                }
            }

            await Order.update({ status: 'cancelled' }, { where: { id: order.id } });

            if (order.courier_id) {
                try {
                    await CourierTask.update({ status: 'cancelled' }, { where: { order_id: order.id } });
                } catch (_) {}
            }

            // Socket bildirimleri
            if (global.io) {
                try {
                    const sellerRecord = await Seller.findByPk(order.seller_id, { attributes: ['user_id'] });
                    if (sellerRecord) {
                        global.io.to(`seller-${sellerRecord.user_id}`).emit('order_cancelled', {
                            id: order.id,
                            orderNumber: order.order_number,
                            status: 'cancelled',
                            cancelledBy: 'system',
                            reason: 'timeout',
                            totalAmount: parseFloat(order.total_amount),
                            createdAt: order.created_at
                        });
                    }
                } catch (_) {}

                global.io.to(`buyer-${order.user_id}`).emit('order_status_updated', {
                    orderId: order.id,
                    status: 'cancelled',
                    reason: 'timeout'
                });

                if (order.courier_id) {
                    global.io.to(`courier-${order.courier_id}`).emit('order_cancelled', {
                        id: order.id,
                        orderNumber: order.order_number,
                        status: 'cancelled'
                    });
                }
            }

            // Müşteri bildirimi
            try {
                await createNotification(
                    order.user_id,
                    'order_cancelled',
                    'Siparişiniz iptal edildi',
                    `Restoran ${TIMEOUT_MINUTES} dk içinde onaylamadığı için siparişiniz otomatik iptal edildi.${order.payment_method === 'iyzico' ? ' Ödemeniz iade edildi.' : ''}`,
                    order.id
                );
            } catch (_) {}

            console.log('⏱️ Otomatik iptal (timeout):', order.order_number);
        } catch (e) {
            console.error('Otomatik iptal hatası:', order.id, e.message);
        }
    }
}

let _tasksStarted = false;
let _intervals = [];

function startScheduledTasks() {
    if (_tasksStarted) return;
    _tasksStarted = true;

    // Her 60 saniyede bir tüm görevleri çalıştır
    const tick = async () => {
        try { await applyScheduleAutoToggle(); } catch (_) {}
        try { await applyOrderTimeout(); } catch (_) {}
    };

    // İlk çalıştırma: server start sonrası 10 sn bekle (DB hazır olsun)
    setTimeout(tick, 10000);
    _intervals.push(setInterval(tick, 60 * 1000));

    console.log('🕒 Zamanlanmış görevler başlatıldı (her 60s: çalışma saati senkronu + sipariş timeout).');
}

function stopScheduledTasks() {
    _intervals.forEach(i => clearInterval(i));
    _intervals = [];
    _tasksStarted = false;
}

module.exports = {
    startScheduledTasks,
    stopScheduledTasks,
    applyScheduleAutoToggle,
    applyOrderTimeout
};
