const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const { requireRole } = require("../../middleware/auth");
const { User, Order, Seller, Address, CourierTask } = require("../../models");
const { Op, Sequelize, QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

router.get("/available", requireRole('courier'), async (req, res) => {
    try {
        const courierId = req.session.user.id || req.session.user.courierId;
        const courier = await User.findByPk(courierId, {
            attributes: ['courier_status']
        });
        
        const courierStatus = courier?.courier_status || 'online';
        
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
                    attributes: ['shop_name']
                },
                {
                    model: Address,
                    as: 'address',
                    attributes: ['district', 'city']
                },
                {
                    model: User,
                    as: 'buyer',
                    attributes: ['fullname', 'phone']
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
                dropoff: deliveryLocation,
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
        res.status(500).json({
            success: false,
            message: "Görevler yüklenirken bir hata oluştu.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.post("/tasks/:id/accept", requireRole('courier'), async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const courierId = req.session.user.id || req.session.user.courierId;
        const orderRecord = await Order.findByPk(orderId, {
            attributes: ['id', 'courier_id', 'status', 'delivery_fee', 'estimated_delivery_time'],
            include: [
                { model: Seller, as: 'seller', attributes: ['shop_name'] },
                { model: Address, as: 'address', attributes: ['district', 'city'] }
            ]
        });

        if (!orderRecord) {
            return res.status(404).json({
                success: false,
                message: "Sipariş bulunamadı."
            });
        }

        if (orderRecord.courier_id !== null) {
            return res.status(400).json({
                success: false,
                message: "Bu sipariş zaten bir kuryeye atanmış."
            });
        }

        if (orderRecord.status !== 'ready') {
            return res.status(400).json({
                success: false,
                message: "Bu sipariş henüz hazır değil."
            });
        }
        


        // Transaction ile güncelleme ve courier_task oluştur
        const t = await sequelize.transaction();
        try {
            await Order.update({ courier_id: courierId, status: 'on_delivery' }, { where: { id: orderId }, transaction: t });
            const pickup = orderRecord.seller?.shop_name || 'Restoran';
            const deliveryLoc = orderRecord.address ? `${orderRecord.address.district || ''}, ${orderRecord.address.city || ''}`.replace(/^,\s*|,\s*$/g, '') : '';
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
            return res.status(500).json({ success: false, message: 'Görev kabul edilirken hata oluştu.' });
        }
        res.json({ success: true, message: 'Görev başarıyla kabul edildi.' });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

router.get("/tasks/active", requireRole('courier'), async (req, res) => {
    try {
        const courierId = req.session.user.id || req.session.user.courierId;
        const tasksRaw = await Order.findAll({
            where: {
                courier_id: courierId,
                status: { [Op.in]: ['on_delivery', 'ready'] }
            },
            include: [
                { model: Seller, as: 'seller', attributes: ['shop_name'], required: true },
                { model: Address, as: 'address', attributes: ['district', 'city'], required: true },
                { model: User, as: 'buyer', attributes: ['fullname', 'phone'], required: true },
                { model: CourierTask, as: 'courierTask', attributes: ['picked_up_at', 'delivered_at'], required: false }
            ],
            order: [['created_at', 'DESC']]
        });
        
        const formattedTasks = tasksRaw.map(task => ({
            id: task.id,
            orderNumber: task.order_number,
            pickup: task.seller?.shop_name || 'Restoran',
            dropoff: task.address ? `${task.address.district || ''}, ${task.address.city || ''}`.replace(/^,\s*|,\s*$/g, '') : 'Adres bilgisi yok',
            customer: task.buyer ? `${task.buyer.fullname || 'Müşteri'} (${(task.buyer.phone || '000').substring(0,3)}***)` : 'Müşteri',
            payout: parseFloat(task.delivery_fee) || 25.00,
            status: task.status,
            estimatedTime: task.estimated_delivery_time,
            pickedUpAt: task.courierTask?.picked_up_at || null,
            deliveredAt: task.courierTask?.delivered_at || null,
            createdAt: task.created_at
        }));
        
        res.json({
            success: true,
            tasks: formattedTasks
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

router.put("/tasks/:id/pickup", requireRole('courier'), async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const courierId = req.session.user.id;
        const orderCheck = await Order.findByPk(orderId, { attributes: ['id', 'courier_id', 'status'] });

        if (!orderCheck) {
            return res.status(404).json({
                success: false,
                message: "Sipariş bulunamadı."
            });
        }

        if (orderCheck.courier_id !== courierId) {
            return res.status(403).json({
                success: false,
                message: "Bu sipariş size ait değil."
            });
        }

        if (orderCheck.status !== 'on_delivery' && orderCheck.status !== 'ready') {
            return res.status(400).json({
                success: false,
                message: "Bu sipariş alınabilir durumda değil."
            });
        }
        await CourierTask.update(
            { status: 'picked_up', picked_up_at: new Date() },
            { where: { order_id: orderId, courier_id: courierId } }
        );

        res.json({ success: true, message: 'Sipariş başarıyla alındı olarak işaretlendi.' });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

router.put("/tasks/:id/complete", requireRole('courier'), async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const courierId = req.session.user.id;
        const orderCheck = await Order.findByPk(orderId, { attributes: ['id', 'courier_id', 'status'] });

        if (!orderCheck) {
            return res.status(404).json({
                success: false,
                message: "Sipariş bulunamadı."
            });
        }

        if (orderCheck.courier_id !== courierId) {
            return res.status(403).json({
                success: false,
                message: "Bu sipariş size ait değil."
            });
        }
        await Order.update({ status: 'delivered', delivered_at: new Date() }, { where: { id: orderId } });

        await CourierTask.update(
            { status: 'delivered', delivered_at: new Date(), actual_payout: sequelize.literal('estimated_payout') },
            { where: { order_id: orderId, courier_id: courierId } }
        );

        res.json({ success: true, message: 'Görev başarıyla tamamlandı.' });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

router.get("/tasks/history", requireRole('courier'), async (req, res) => {
    try {
        const courierId = req.session.user.id || req.session.user.courierId;
        const { page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        if (!courierId) {
            return res.status(400).json({
                success: false,
                message: "Kurye ID bulunamadı."
            });
        }
        let count, tasks;
        try {
            const result = await Order.findAndCountAll({
                where: {
                    courier_id: courierId,
                    status: 'delivered'
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
                        attributes: ['district', 'city'],
                        required: false
                    },
                    {
                        model: User,
                        as: 'buyer',
                        attributes: ['fullname', 'phone'],
                        required: false
                    },
                    {
                        model: CourierTask,
                        as: 'courierTask',
                        attributes: ['delivered_at', 'actual_payout'],
                        required: false
                    }
                ],
                attributes: ['id', 'order_number', 'total_amount', 'delivery_fee', 'status', 'created_at'],
                order: [['created_at', 'DESC']],
                limit: parseInt(limit) || 20,
                offset: offset || 0
            });
            count = result.count;
            tasks = result.rows || [];
        } catch (dbError) {
            throw dbError;
        }
        tasks.sort((a, b) => {
            const dateA = a.courierTask?.delivered_at || a.created_at;
            const dateB = b.courierTask?.delivered_at || b.created_at;
            return new Date(dateB) - new Date(dateA);
        });
        
        const total = count;
        
        const formattedTasks = tasks.map(task => {
            const deliveryLocation = task.address 
                ? `${task.address.district || ''}, ${task.address.city || ''}`.replace(/^,\s*|,\s*$/g, '').trim() || 'Adres bilgisi yok'
                : 'Adres bilgisi yok';
            const phoneStr = task.buyer?.phone || '000';
            const phonePrefix = phoneStr.substring(0, 3);
            const customerName = task.buyer 
                ? `${task.buyer.fullname || 'Müşteri'} (${phonePrefix}***)`
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
                total: total,
                totalPages: Math.ceil(total / parseInt(limit))
            },
            message: formattedTasks.length === 0 ? "Henüz teslimat geçmişi bulunmamaktadır." : null
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Geçmiş görevler yüklenirken bir hata oluştu.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.get("/earnings", requireRole('courier'), async (req, res) => {
    try {
        const courierId = req.session.user.id || req.session.user.courierId;
        const { period = 'month' } = req.query;
        
        let dateFilter = '';
        if (period === 'day') {
            dateFilter = "DATE(ct.delivered_at) = CURDATE()";
        } else if (period === 'week') {
            dateFilter = "ct.delivered_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
        } else if (period === 'month') {
            dateFilter = "ct.delivered_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
        }
        const whereClause = { courier_id: courierId, status: 'delivered' };
        if (period === 'day') {
            const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
            whereClause.delivered_at = { [Op.gte]: startOfDay };
        } else if (period === 'week') {
            whereClause.delivered_at = { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
        } else if (period === 'month') {
            whereClause.delivered_at = { [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
        }

        const statsRaw = await CourierTask.findAll({
            attributes: [
                [sequelize.fn('COUNT', sequelize.col('id')), 'total_deliveries'],
                [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('actual_payout')), 0), 'total_earnings'],
                [sequelize.fn('COALESCE', sequelize.fn('AVG', sequelize.col('actual_payout')), 0), 'avg_earnings_per_delivery']
            ],
            where: whereClause,
            raw: true
        });

        const stats = statsRaw[0] || { total_deliveries: 0, total_earnings: 0, avg_earnings_per_delivery: 0 };

        res.json({
            success: true,
            period: period,
            stats: {
                totalDeliveries: parseInt(stats.total_deliveries) || 0,
                totalEarnings: parseFloat(stats.total_earnings) || 0,
                avgEarningsPerDelivery: parseFloat(stats.avg_earnings_per_delivery) || 0
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

router.put("/profile", requireRole('courier'), async (req, res) => {
    try {
        const courierId = req.session.user.id || req.session.user.courierId;
        const { fullname, phone, status, vehicleType } = req.body;
        
        const validStatuses = ['online', 'offline'];
        const validVehicleTypes = ['motorcycle', 'car', 'bicycle'];
        
        let updateFields = [];
        let updateValues = [];
        if (fullname) {
            updateFields.push("fullname = ?");
            updateValues.push(fullname);
        }
        
        if (phone) {
            updateFields.push("phone = ?");
            updateValues.push(phone);
        }
        if (updateFields.length === 0 && !status && !vehicleType) {
            return res.status(400).json({
                success: false,
                message: "Güncellenecek alan belirtilmedi."
            });
        }
        
        if (status && validStatuses.includes(status)) {
            updateFields.push("courier_status = ?");
            updateValues.push(status);
        }
        
        if (vehicleType && validVehicleTypes.includes(vehicleType)) {
            updateFields.push("vehicle_type = ?");
            updateValues.push(vehicleType);
        }
        
        updateValues.push(courierId);
        try {
            await db.execute(
                `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
                updateValues
            );
        } catch (dbError) {
            if (dbError.code === 'ER_BAD_FIELD_ERROR') {
                try {
                    const columnsCheck = await db.query(`
                        SELECT COLUMN_NAME 
                        FROM INFORMATION_SCHEMA.COLUMNS 
                        WHERE TABLE_SCHEMA = DATABASE() 
                        AND TABLE_NAME = 'users' 
                        AND COLUMN_NAME IN ('courier_status', 'vehicle_type')
                    `);
                    const existingColumns = columnsCheck.map(col => col.COLUMN_NAME);
                    if (!existingColumns.includes('courier_status')) {
                        await db.execute("ALTER TABLE users ADD COLUMN courier_status ENUM('online', 'offline') DEFAULT 'online'");
                    }
                    if (!existingColumns.includes('vehicle_type')) {
                        await db.execute("ALTER TABLE users ADD COLUMN vehicle_type ENUM('motorcycle', 'car', 'bicycle') DEFAULT 'motorcycle'");
                    }
                    await db.execute(
                        `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
                        updateValues
                    );
                } catch (alterError) {
                    const fallbackFields = [];
                    const fallbackValues = [];
                    
                    if (fullname) {
                        fallbackFields.push("fullname = ?");
                        fallbackValues.push(fullname);
                    }
                    if (phone) {
                        fallbackFields.push("phone = ?");
                        fallbackValues.push(phone);
                    }
                    
                    if (fallbackFields.length > 0) {
                        fallbackValues.push(courierId);
                        await db.execute(
                            `UPDATE users SET ${fallbackFields.join(', ')} WHERE id = ?`,
                            fallbackValues
                        );
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
        let message = "Profil başarıyla güncellendi.";
        if (status) {
            const statusText = status === 'online' ? 'Aktif (Görev Alabilir)' : 'Pasif (Görev Alamaz)';
            message = `Durumunuz başarıyla "${statusText}" olarak ayarlandı.`;
        }
        
        res.json({
            success: true,
            message: message
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

router.get("/profile", requireRole('courier'), async (req, res) => {
    try {
        const courierId = req.session.user.id || req.session.user.courierId;
        if (!courierId) {
            return res.status(400).json({
                success: false,
                message: "Kurye ID bulunamadı."
            });
        }
        const user = await User.findByPk(courierId, { attributes: ['id', 'email', 'fullname', 'phone', 'role'] });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Kurye bulunamadı."
            });
        }
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
        } catch (statusError) {}
        let totalDeliveries = 0;
        let totalEarnings = 0;
        
        try {
            totalDeliveries = await Order.count({ where: { courier_id: courierId, status: 'delivered' } });
            totalEarnings = await CourierTask.sum('actual_payout', { where: { courier_id: courierId, status: 'delivered' } }) || 0;
        } catch (statsError) {}
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
        res.status(500).json({
            success: false,
            message: "Sunucu hatası: " + error.message
        });
    }
});

router.options("/profile", (req, res) => {
    res.header("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.sendStatus(200);
});

module.exports = router;

