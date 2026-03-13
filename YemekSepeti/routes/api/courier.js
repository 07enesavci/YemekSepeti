const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const { requireRole, requireCourierApproved } = require("../../middleware/auth");
const { User, Order, Seller, Address, CourierTask } = require("../../models");

router.use(requireRole('courier'), requireCourierApproved);
const { Op, Sequelize, QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/database");
const { createNotification } = require("../../lib/notificationHelper");

async function emitSellerOrderStatusChanged(orderId) {
    if (!global.io || !orderId) return;

    try {
        const order = await Order.findByPk(orderId, {
            attributes: ['id', 'status', 'courier_id', 'seller_id', 'updated_at']
        });

        if (!order || !order.seller_id) return;

        const seller = await Seller.findByPk(order.seller_id, {
            attributes: ['user_id']
        });

        if (!seller || !seller.user_id) return;

        global.io.to(`seller-${seller.user_id}`).emit('seller_order_status_changed', {
            orderId: order.id,
            status: order.status,
            courierId: order.courier_id || null,
            updatedAt: order.updated_at || new Date().toISOString()
        });
    } catch (error) {
        console.error('Seller sipariş durumu emit hatası:', error);
    }
}

function emitCourierPoolOrderTaken(orderId, courierId, source = 'courier_accept') {
    if (!global.io || !orderId) return;

    global.io.to('couriers-available').emit('courier_order_taken', {
        orderId,
        courierId: courierId || null,
        source,
        claimedAt: new Date().toISOString()
    });

    if (courierId) {
        global.io.to(`courier-${courierId}`).emit('courier_active_task_updated', {
            orderId,
            courierId,
            source,
            updatedAt: new Date().toISOString()
        });
    }
}

router.get("/available", async (req, res) => {
    try {
        const courierId = req.session.user.id || req.session.user.courierId;

        // courier_status kolonunu raw SQL ile çek (Sequelize model tanımı gerektirmez)
        let courierStatus = 'online';
        try {
            const statusRes = await sequelize.query(
                "SELECT courier_status FROM users WHERE id = ?",
                { replacements: [courierId], type: QueryTypes.SELECT }
            );
            if (statusRes.length > 0 && statusRes[0].courier_status) {
                courierStatus = statusRes[0].courier_status;
            }
        } catch (statusErr) {
            // kolon yoksa varsayılan 'online' kullan
            console.warn('courier_status kolonu okunamadı, varsayılan online:', statusErr.message);
        }

        if (courierStatus === 'offline') {
            return res.json({
                success: true,
                tasks: [],
                message: "Pasif durumdasınız. Görev almak için durumunuzu aktif yapın."
            });
        }

        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

        const tasks = await Order.findAll({
            where: {
                courier_id: null,
                status: 'ready',
                created_at: { [Op.gte]: twoHoursAgo }
            },
            include: [
                {
                    model: Seller,
                    as: 'seller',
                    attributes: ['shop_name'],
                    required: false
                },
                {
                    model: Address,
                    as: 'address',
                    attributes: ['district', 'city', 'full_address', 'latitude', 'longitude'],
                    required: false
                },
                {
                    model: User,
                    as: 'buyer',
                    attributes: ['fullname', 'phone'],
                    required: false
                }
            ],
            order: [['created_at', 'DESC']]
        });

        const formattedTasks = tasks.map(task => {
            const deliveryLocation = task.address
                ? `${task.address.district || ''}, ${task.address.city || ''}`.replace(/^,\s*|,\s*$/g, '')
                : 'Adres bilgisi yok';

            const phoneStr = task.buyer?.phone || '000';
            const customerName = task.buyer
                ? `${task.buyer.fullname || 'Müşteri'} (${phoneStr.substring(0, 3)}***)`
                : 'Müşteri';

            return {
                id: task.id,
                orderNumber: task.order_number || `SIP-${task.id}`,
                pickup: task.seller?.shop_name || 'Restoran',
                pickupLocation: task.seller?.location || '',
                dropoff: deliveryLocation,
                dropoffFullAddress: task.address?.full_address || deliveryLocation,
                dropoffLat: task.address?.latitude ? parseFloat(task.address.latitude) : null,
                dropoffLng: task.address?.longitude ? parseFloat(task.address.longitude) : null,
                customer: customerName,
                payout: parseFloat(task.delivery_fee) || 25.00,
                estimatedTime: task.estimated_delivery_time || '30 dakika',
                createdAt: task.created_at
            };
        });

        res.json({
            success: true,
            tasks: formattedTasks,
            message: formattedTasks.length === 0 ? "Henüz aktif görev bulunmamaktadır." : null
        });
    } catch (error) {
        console.error('AVAILABLE ENDPOINT HATA:', error);
        res.status(500).json({
            success: false,
            message: "Görevler yüklenirken bir hata oluştu.",
            error: error.message
        });
    }
});

router.post("/tasks/:id/accept", async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const courierId = req.session.user.id || req.session.user.courierId;
        const orderRecord = await Order.findByPk(orderId, {
            attributes: ['id', 'seller_id', 'courier_id', 'status', 'delivery_fee', 'estimated_delivery_time'],
            include: [
                { model: Seller, as: 'seller', attributes: ['shop_name'], required: false },
                { model: Address, as: 'address', attributes: ['district', 'city'], required: false }
            ]
        });

        if (!orderRecord) {
            return res.status(404).json({ success: false, message: "Sipariş bulunamadı." });
        }

        if (orderRecord.courier_id !== null) {
            return res.status(400).json({ success: false, message: "Bu sipariş zaten bir kuryeye atanmış." });
        }

        if (orderRecord.status !== 'ready') {
            return res.status(400).json({ success: false, message: "Bu sipariş henüz hazır değil." });
        }

        const t = await sequelize.transaction();
        try {
            await Order.update({ courier_id: courierId, status: 'on_delivery' }, { where: { id: orderId }, transaction: t });
            const pickup = orderRecord.seller?.shop_name || 'Restoran';
            const deliveryLoc = orderRecord.address
                ? `${orderRecord.address.district || ''}, ${orderRecord.address.city || ''}`.replace(/^,\s*|,\s*$/g, '')
                : '';
            const estimatedPayout = parseFloat(orderRecord.delivery_fee) || 25.00;

            await CourierTask.create({
                order_id: orderId,
                courier_id: courierId,
                pickup_location: pickup,
                delivery_location: deliveryLoc,
                estimated_payout: estimatedPayout,
                status: 'assigned'
            }, { transaction: t });

            await t.commit();
        } catch (err) {
            await t.rollback();
            console.error('GÖREV KABUL HATA:', err);
            return res.status(500).json({ success: false, message: 'Görev kabul edilirken hata oluştu.' });
        }

        emitCourierPoolOrderTaken(orderId, courierId);
        await emitSellerOrderStatusChanged(orderId);

        res.json({ success: true, message: 'Görev başarıyla kabul edildi.' });
    } catch (error) {
        console.error('ACCEPT ENDPOINT HATA:', error);
        res.status(500).json({ success: false, message: "Sunucu hatası." });
    }
});

router.get("/tasks/active", async (req, res) => {
    try {
        const courierId = req.session.user?.id || req.session.user?.courierId;
        if (!courierId) return res.status(401).json({ success: false, message: "Oturum bulunamadı." });

        const tasksRaw = await Order.findAll({
            where: {
                courier_id: courierId,
                status: { [Op.in]: ['on_delivery', 'ready'] }
            },
            include: [
                { model: Seller, as: 'seller', attributes: ['shop_name'], required: false },
                { model: Address, as: 'address', attributes: ['district', 'city', 'full_address', 'latitude', 'longitude'], required: false },
                { model: User, as: 'buyer', attributes: ['fullname', 'phone'], required: false },
                { model: CourierTask, as: 'courierTask', attributes: ['picked_up_at', 'delivered_at'], required: false }
            ],
            order: [['created_at', 'DESC']]
        });

        const formattedTasks = (tasksRaw || []).map(task => {
            const seller = task.seller || {};
            const address = task.address || {};
            const buyer = task.buyer || {};
            const ct = task.courierTask || {};
            const dropoffStr = [address.district, address.city].filter(Boolean).join(', ') || 'Adres bilgisi yok';
            return {
                id: task.id,
                orderNumber: task.order_number || `SIP-${task.id}`,
                pickup: seller.shop_name || 'Restoran',
                pickupLocation: seller.location || '',
                dropoff: dropoffStr,
                dropoffFullAddress: address.full_address || dropoffStr,
                dropoffLat: address.latitude != null ? parseFloat(address.latitude) : null,
                dropoffLng: address.longitude != null ? parseFloat(address.longitude) : null,
                customer: buyer.fullname ? `${buyer.fullname} (${(buyer.phone || '000').toString().substring(0, 3)}***)` : 'Müşteri',
                payout: parseFloat(task.delivery_fee) || 25.00,
                status: task.status,
                estimatedTime: task.estimated_delivery_time,
                pickedUpAt: ct.picked_up_at || null,
                deliveredAt: ct.delivered_at || null,
                createdAt: task.created_at
            };
        });

        res.json({ success: true, tasks: formattedTasks });
    } catch (error) {
        console.error('ACTIVE TASKS HATA:', error);
        res.status(500).json({ success: false, message: "Sunucu hatası.", error: error.message });
    }
});

router.put("/tasks/:id/pickup", async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const courierId = req.session.user.id;
        const orderCheck = await Order.findByPk(orderId, { attributes: ['id', 'courier_id', 'status'] });

        if (!orderCheck) return res.status(404).json({ success: false, message: "Sipariş bulunamadı." });
        if (orderCheck.courier_id !== courierId) return res.status(403).json({ success: false, message: "Bu sipariş size ait değil." });
        if (orderCheck.status !== 'on_delivery' && orderCheck.status !== 'ready') {
            return res.status(400).json({ success: false, message: "Bu sipariş alınabilir durumda değil." });
        }

        await CourierTask.update(
            { status: 'picked_up', picked_up_at: new Date() },
            { where: { order_id: orderId, courier_id: courierId } }
        );

        res.json({ success: true, message: 'Sipariş başarıyla alındı olarak işaretlendi.' });
    } catch (error) {
        console.error('PICKUP HATA:', error);
        res.status(500).json({ success: false, message: "Sunucu hatası." });
    }
});

router.put("/tasks/:id/complete", async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const courierId = req.session.user.id;
        const orderCheck = await Order.findByPk(orderId, { attributes: ['id', 'user_id', 'courier_id', 'status'] });

        if (!orderCheck) return res.status(404).json({ success: false, message: "Sipariş bulunamadı." });
        if (orderCheck.courier_id !== courierId) return res.status(403).json({ success: false, message: "Bu sipariş size ait değil." });

        await Order.update({ status: 'delivered', delivered_at: new Date() }, { where: { id: orderId } });
        const taskRow = await CourierTask.findOne({ where: { order_id: orderId, courier_id: courierId }, attributes: ['id', 'estimated_payout'] });
        if (taskRow) {
            await CourierTask.update(
                { status: 'delivered', delivered_at: new Date(), actual_payout: taskRow.estimated_payout },
                { where: { order_id: orderId, courier_id: courierId } }
            );
        }

        if (orderCheck && orderCheck.user_id) {
            createNotification(
                orderCheck.user_id, 
                'order', 
                'Sipariş teslim edildi', 
                `Sipariş #${orderId} teslim edilmiştir. Afiyet olsun!`, 
                orderId
            ).catch(() => {});
        }

        await emitSellerOrderStatusChanged(orderId);
        emitCourierPoolOrderTaken(orderId, courierId, 'courier_complete');

        res.json({ success: true, message: 'Görev başarıyla tamamlandı.' });
    } catch (error) {
        console.error('COMPLETE HATA:', error);
        res.status(500).json({ success: false, message: "Sunucu hatası." });
    }
});

// Satıcıdan otomatik atanan görevi kurye tarafında kabul etme
router.put("/tasks/:id/accept-assigned", async (req, res) => {
    try {
        const courierId = req.session.user.id;
        const taskId = parseInt(req.params.id);
        if (!taskId) return res.status(400).json({ success: false, message: "Geçersiz görev ID." });

        const task = await CourierTask.findOne({
            where: { id: taskId, courier_id: courierId },
            attributes: ['id', 'status']
        });
        if (!task) return res.status(404).json({ success: false, message: "Görev bulunamadı." });

        if (task.status !== 'assigned') {
            return res.json({ success: true, message: "Görev zaten işlenmiş." });
        }

        await CourierTask.update(
            { status: 'on_way' },
            { where: { id: taskId, courier_id: courierId } }
        );

        return res.json({ success: true, message: "Görev kabul edildi." });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Görev kabul edilirken hata oluştu." });
    }
});

// Satıcıdan otomatik atanan görevi kurye tarafında reddetme ve başka kuryeye atama
router.put("/tasks/:id/reject-assigned", async (req, res) => {
    try {
        const courierId = req.session.user.id;
        const taskId = parseInt(req.params.id);
        if (!taskId) return res.status(400).json({ success: false, message: "Geçersiz görev ID." });

        const task = await CourierTask.findOne({
            where: { id: taskId, courier_id: courierId },
            attributes: ['id', 'order_id', 'status']
        });
        if (!task) return res.status(404).json({ success: false, message: "Görev bulunamadı." });

        if (task.status !== 'assigned') {
            return res.json({ success: true, message: "Görev zaten işlenmiş." });
        }

        const order = await Order.findByPk(task.order_id, {
            attributes: ['id', 'seller_id', 'user_id', 'delivery_fee', 'status', 'address_id'],
            include: [
                { model: Seller, as: 'seller', attributes: ['shop_name'], required: false },
                { model: Address, as: 'address', attributes: ['district', 'city'], required: false }
            ]
        });
        if (!order) {
            await CourierTask.update(
                { status: 'cancelled' },
                { where: { id: taskId, courier_id: courierId } }
            );
            return res.status(404).json({ success: false, message: "Sipariş bulunamadı." });
        }

        // Mevcut kuryeyi siparişten düşür
        await Order.update(
            { courier_id: null, status: 'ready' },
            { where: { id: order.id } }
        );
        await CourierTask.update(
            { status: 'cancelled' },
            { where: { id: taskId, courier_id: courierId } }
        );

        const activeCouriersQuery = `
            SELECT DISTINCT u.id, u.fullname, u.email
            FROM users u
            WHERE u.role = 'courier'
            AND u.is_active = TRUE
            AND u.id <> ?
            AND u.id NOT IN (
                SELECT DISTINCT o.courier_id 
                FROM orders o 
                WHERE o.status = 'on_delivery' 
                AND o.courier_id IS NOT NULL
            )
            ORDER BY RAND()
            LIMIT 10
        `;

        const candidates = await sequelize.query(activeCouriersQuery, {
            type: QueryTypes.SELECT,
            replacements: [courierId]
        });

        if (!candidates || candidates.length === 0) {
            return res.json({
                success: true,
                message: "Görev reddedildi ancak şu anda başka uygun kurye bulunamadı. Sipariş 'hazır' durumuna alındı."
            });
        }

        const selected = candidates[Math.floor(Math.random() * candidates.length)];
        const newCourierId = selected.id;

        await Order.update(
            { courier_id: newCourierId, status: 'on_delivery' },
            { where: { id: order.id } }
        );

        const deliveryLocation = order.address
            ? `${order.address.district || ''}, ${order.address.city || ''}`.replace(/^,\\s*|,\\s*$/g, '') || 'Adres'
            : (order.seller?.shop_name || 'Restoran');

        const newTask = await CourierTask.create({
            order_id: order.id,
            courier_id: newCourierId,
            pickup_location: order.seller?.shop_name || 'Restoran',
            delivery_location: deliveryLocation,
            estimated_payout: parseFloat(order.delivery_fee) || 25.00,
            status: 'assigned'
        });

        if (global.io) {
            global.io.to(`courier-${newCourierId}`).emit('courier_task_assigned', {
                orderId: order.id,
                courierId: newCourierId,
                taskId: newTask.id,
                source: 'courier_reject_reassign',
                assignedAt: new Date().toISOString()
            });
        }

        return res.json({
            success: true,
            message: "Görev reddedildi ve başka kuryeye atandı."
        });
    } catch (error) {
        console.error('REJECT-ASSIGNED HATA:', error);
        return res.status(500).json({ success: false, message: "Görev reddedilirken hata oluştu." });
    }
});

router.get("/tasks/history", async (req, res) => {
    try {
        const courierId = req.session.user.id || req.session.user.courierId;
        const { page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        if (!courierId) return res.status(400).json({ success: false, message: "Kurye ID bulunamadı." });

        const result = await Order.findAndCountAll({
            where: { courier_id: courierId, status: 'delivered' },
            include: [
                { model: Seller, as: 'seller', attributes: ['shop_name'], required: false },
                { model: Address, as: 'address', attributes: ['district', 'city'], required: false },
                { model: User, as: 'buyer', attributes: ['fullname', 'phone'], required: false },
                { model: CourierTask, as: 'courierTask', attributes: ['delivered_at', 'actual_payout'], required: false }
            ],
            attributes: ['id', 'order_number', 'total_amount', 'delivery_fee', 'status', 'created_at'],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit) || 20,
            offset: offset || 0
        });

        const tasks = (result.rows || []).sort((a, b) => {
            const dateA = a.courierTask?.delivered_at || a.created_at;
            const dateB = b.courierTask?.delivered_at || b.created_at;
            return new Date(dateB) - new Date(dateA);
        });

        const formattedTasks = tasks.map(task => {
            const deliveryLocation = task.address
                ? `${task.address.district || ''}, ${task.address.city || ''}`.replace(/^,\s*|,\s*$/g, '').trim() || 'Adres bilgisi yok'
                : 'Adres bilgisi yok';
            const phoneStr = task.buyer?.phone || '000';
            const customerName = task.buyer
                ? `${task.buyer.fullname || 'Müşteri'} (${phoneStr.substring(0, 3)}***)`
                : 'Müşteri';

            return {
                id: task.id,
                orderNumber: task.order_number || `SIP-${task.id}`,
                pickup: task.seller?.shop_name || 'Restoran',
                dropoff: deliveryLocation,
                customer: customerName,
                payout: parseFloat(task.courierTask?.actual_payout || task.delivery_fee) || 25.00,
                status: task.status || 'delivered',
                deliveredAt: task.courierTask?.delivered_at || task.created_at,
                createdAt: task.created_at
            };
        });

        res.json({
            success: true,
            tasks: formattedTasks,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: result.count,
                totalPages: Math.ceil(result.count / parseInt(limit))
            },
            message: formattedTasks.length === 0 ? "Henüz teslimat geçmişi bulunmamaktadır." : null
        });
    } catch (error) {
        console.error('HISTORY HATA:', error);
        res.status(500).json({
            success: false,
            message: "Geçmiş görevler yüklenirken bir hata oluştu.",
            error: error.message
        });
    }
});

router.get("/earnings", async (req, res) => {
    try {
        const courierId = req.session.user.id || req.session.user.courierId;
        if (!courierId) return res.status(400).json({ success: false, message: "Kurye oturumu bulunamadı." });
        const { period = 'month' } = req.query;

        const whereBase = { courier_id: courierId, status: 'delivered' };
        let whereDeliveredAt = {};
        if (period === 'day') {
            const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
            whereDeliveredAt = { [Op.gte]: startOfDay };
        } else if (period === 'week') {
            whereDeliveredAt = { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
        } else if (period === 'month') {
            whereDeliveredAt = { [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
        }
        const whereClause = whereDeliveredAt && Object.keys(whereDeliveredAt).length ? { ...whereBase, delivered_at: whereDeliveredAt } : whereBase;

        const statsRaw = await CourierTask.findAll({
            attributes: [
                [sequelize.fn('COUNT', sequelize.col('id')), 'total_deliveries'],
                [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('actual_payout')), 0), 'total_earnings'],
                [sequelize.fn('COALESCE', sequelize.fn('AVG', sequelize.col('actual_payout')), 0), 'avg_earnings_per_delivery']
            ],
            where: whereClause,
            raw: true
        });

        const stats = statsRaw[0] || {};
        const totalDeliveries = parseInt(stats.total_deliveries, 10) || 0;
        const totalEarnings = parseFloat(stats.total_earnings) || 0;
        const avgEarningsPerDelivery = totalDeliveries > 0 ? (totalEarnings / totalDeliveries) : 0;

        res.json({
            success: true,
            period: period,
            stats: {
                totalDeliveries,
                totalEarnings,
                avgEarningsPerDelivery
            }
        });
    } catch (error) {
        console.error('EARNINGS HATA:', error);
        res.json({
            success: true,
            period: req.query.period || 'month',
            stats: { totalDeliveries: 0, totalEarnings: 0, avgEarningsPerDelivery: 0 }
        });
    }
});

router.put("/profile", async (req, res) => {
    try {
        const courierId = req.session.user.id || req.session.user.courierId;
        const { fullname, phone, status, vehicleType } = req.body;

        const validStatuses = ['online', 'offline'];
        const validVehicleTypes = ['motorcycle', 'car', 'bicycle'];

        let updateFields = [];
        let updateValues = [];

        if (fullname) { updateFields.push("fullname = ?"); updateValues.push(fullname); }
        if (phone) { updateFields.push("phone = ?"); updateValues.push(phone); }
        if (status && validStatuses.includes(status)) { updateFields.push("courier_status = ?"); updateValues.push(status); }
        if (vehicleType && validVehicleTypes.includes(vehicleType)) { updateFields.push("vehicle_type = ?"); updateValues.push(vehicleType); }

        if (updateFields.length === 0) {
            return res.status(400).json({ success: false, message: "Güncellenecek alan belirtilmedi." });
        }

        updateValues.push(courierId);

        try {
            await db.execute(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
        } catch (dbError) {
            if (dbError.code === 'ER_BAD_FIELD_ERROR') {
                try {
                    const columnsCheck = await db.query(`
                        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
                        AND COLUMN_NAME IN ('courier_status', 'vehicle_type')
                    `);
                    const existingColumns = columnsCheck.map(col => col.COLUMN_NAME);
                    if (!existingColumns.includes('courier_status')) {
                        await db.execute("ALTER TABLE users ADD COLUMN courier_status ENUM('online', 'offline') DEFAULT 'online'");
                    }
                    if (!existingColumns.includes('vehicle_type')) {
                        await db.execute("ALTER TABLE users ADD COLUMN vehicle_type ENUM('motorcycle', 'car', 'bicycle') DEFAULT 'motorcycle'");
                    }
                    await db.execute(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
                } catch (alterError) {
                    const fallbackFields = [];
                    const fallbackValues = [];
                    if (fullname) { fallbackFields.push("fullname = ?"); fallbackValues.push(fullname); }
                    if (phone) { fallbackFields.push("phone = ?"); fallbackValues.push(phone); }
                    if (fallbackFields.length > 0) {
                        fallbackValues.push(courierId);
                        await db.execute(`UPDATE users SET ${fallbackFields.join(', ')} WHERE id = ?`, fallbackValues);
                    }
                }
            } else {
                throw dbError;
            }
        }

        if (req.session.user) {
            if (fullname) req.session.user.fullname = fullname;
            if (phone) req.session.user.phone = phone;
            if (status) req.session.user.courierStatus = status;
            if (vehicleType) req.session.user.vehicleType = vehicleType;
        }

        const statusText = status === 'online' ? 'Aktif (Görev Alabilir)' : status === 'offline' ? 'Pasif (Görev Alamaz)' : null;
        res.json({
            success: true,
            message: statusText ? `Durumunuz başarıyla "${statusText}" olarak ayarlandı.` : "Profil başarıyla güncellendi."
        });
    } catch (error) {
        console.error('PROFILE PUT HATA:', error);
        res.status(500).json({ success: false, message: "Sunucu hatası." });
    }
});

router.get("/profile", async (req, res) => {
    try {
        const courierId = req.session.user.id || req.session.user.courierId;
        if (!courierId) return res.status(400).json({ success: false, message: "Kurye ID bulunamadı." });

        const user = await User.findByPk(courierId, { attributes: ['id', 'email', 'fullname', 'phone', 'role'] });
        if (!user) return res.status(404).json({ success: false, message: "Kurye bulunamadı." });

        let courierStatus = 'online';
        let vehicleType = 'motorcycle';

        try {
            const statusRes = await sequelize.query(
                "SELECT courier_status, vehicle_type FROM users WHERE id = ?",
                { replacements: [courierId], type: QueryTypes.SELECT }
            );
            if (statusRes.length > 0) {
                courierStatus = statusRes[0].courier_status || 'online';
                vehicleType = statusRes[0].vehicle_type || 'motorcycle';
            }
        } catch (statusError) {
            console.warn('courier_status/vehicle_type okunamadı:', statusError.message);
        }

        let totalDeliveries = 0;
        let totalEarnings = 0;
        try {
            totalDeliveries = await Order.count({ where: { courier_id: courierId, status: 'delivered' } });
            totalEarnings = await CourierTask.sum('actual_payout', { where: { courier_id: courierId, status: 'delivered' } }) || 0;
        } catch (statsError) {
            console.warn('İstatistik okunamadı:', statsError.message);
        }

        if (req.session.user) {
            req.session.user.courierStatus = courierStatus;
            req.session.user.vehicleType = vehicleType;
        }

        res.json({
            success: true,
            courier: {
                id: user.id,
                email: user.email,
                fullname: user.fullname,
                phone: user.phone,
                role: user.role,
                status: courierStatus,
                vehicleType: vehicleType,
                totalDeliveries: totalDeliveries,
                totalEarnings: totalEarnings
            }
        });
    } catch (error) {
        console.error('PROFILE GET HATA:', error);
        res.status(500).json({ success: false, message: "Sunucu hatası: " + error.message });
    }
});

router.options("/profile", (req, res) => {
    res.header("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.sendStatus(200);
});
module.exports = router;