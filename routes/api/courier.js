const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const { requireRole } = require("../../middleware/auth");

// ============================================
// COURIER API ROUTES
// ============================================

/**
 * GET /api/courier/available
 * Alınabilir görevleri getir (courier_id olmayan ve ready status'ünde olan siparişler)
 */
router.get("/available", requireRole('courier'), async (req, res) => {
    try {
        const courierId = req.session.user.id || req.session.user.courierId;
        console.log("✅ Alınabilir görevler isteği - Courier ID:", courierId, "User:", req.session.user);
        
        // Kuryenin aktif olup olmadığını kontrol et
        const courierStatusQuery = await db.query(
            "SELECT COALESCE(courier_status, 'online') as status FROM users WHERE id = ?",
            [courierId]
        );
        
        const courierStatus = courierStatusQuery.length > 0 ? courierStatusQuery[0].status : 'online';
        
        if (courierStatus === 'offline') {
            return res.json({
                success: true,
                tasks: [],
                message: "Pasif durumdasınız. Görev almak için durumunuzu aktif yapın."
            });
        }
        
        const query = `
            SELECT 
                o.id,
                o.order_number,
                o.total_amount,
                o.delivery_fee,
                s.shop_name as pickup_location,
                CONCAT(COALESCE(a.district, ''), ', ', COALESCE(a.city, '')) as delivery_location,
                CONCAT(COALESCE(u.fullname, 'Müşteri'), ' (', SUBSTRING(COALESCE(u.phone, '000'), 1, 3), '***)') as customer_name,
                o.estimated_delivery_time,
                o.created_at
            FROM orders o
            LEFT JOIN sellers s ON o.seller_id = s.id
            LEFT JOIN addresses a ON o.address_id = a.id
            LEFT JOIN users u ON o.user_id = u.id
            WHERE o.courier_id IS NULL 
            AND o.status = 'ready'
            AND o.created_at >= DATE_SUB(NOW(), INTERVAL 2 HOUR)
            ORDER BY o.created_at DESC
        `;
        
        const tasks = await db.query(query);
        
        // Format response
        const formattedTasks = (tasks || []).map(task => ({
            id: task.id,
            orderNumber: task.order_number || `SIP-${task.id}`,
            pickup: task.pickup_location || 'Restoran',
            dropoff: task.delivery_location || 'Adres bilgisi yok',
            customer: task.customer_name || 'Müşteri',
            payout: parseFloat(task.delivery_fee) || 25.00,
            estimatedTime: task.estimated_delivery_time || '30 dakika',
            createdAt: task.created_at
        }));
        
        res.json({
            success: true,
            tasks: formattedTasks,
            message: formattedTasks.length === 0 ? "Henüz aktif görev bulunmamaktadır." : null
        });
    } catch (error) {
        console.error("❌ Alınabilir görevler getirme hatası:", error);
        console.error("Hata detayı:", error.message);
        console.error("Stack trace:", error.stack);
        res.status(500).json({
            success: false,
            message: "Görevler yüklenirken bir hata oluştu.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * POST /api/courier/tasks/:id/accept
 * Görevi kabul et
 */
router.post("/tasks/:id/accept", requireRole('courier'), async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const courierId = req.session.user.id || req.session.user.courierId;
        console.log("✅ Görev kabul isteği - Courier ID:", courierId, "Order ID:", orderId, "User:", req.session.user);
        
        // Siparişin durumunu kontrol et
        const orderCheck = await db.query(
            "SELECT id, courier_id, status FROM orders WHERE id = ?",
            [orderId]
        );
        
        if (orderCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Sipariş bulunamadı."
            });
        }
        
        if (orderCheck[0].courier_id !== null) {
            return res.status(400).json({
                success: false,
                message: "Bu sipariş zaten bir kuryeye atanmış."
            });
        }
        
        if (orderCheck[0].status !== 'ready') {
            return res.status(400).json({
                success: false,
                message: "Bu sipariş henüz hazır değil."
            });
        }
        
        // Siparişi kuryeye ata
        await db.execute(
            "UPDATE orders SET courier_id = ?, status = 'on_delivery' WHERE id = ?",
            [courierId, orderId]
        );
        
        // Courier task kaydı oluştur
        const order = await db.query(
            `SELECT o.delivery_fee, s.shop_name, CONCAT(a.district, ', ', a.city) as delivery_location
             FROM orders o
             INNER JOIN sellers s ON o.seller_id = s.id
             INNER JOIN addresses a ON o.address_id = a.id
             WHERE o.id = ?`,
            [orderId]
        );
        
        if (order.length > 0) {
            await db.execute(
                `INSERT INTO courier_tasks (order_id, courier_id, pickup_location, delivery_location, estimated_payout, status)
                 VALUES (?, ?, ?, ?, ?, 'assigned')`,
                [
                    orderId,
                    courierId,
                    order[0].shop_name,
                    order[0].delivery_location,
                    parseFloat(order[0].delivery_fee) || 25.00
                ]
            );
        }
        
        res.json({
            success: true,
            message: "Görev başarıyla kabul edildi."
        });
    } catch (error) {
        console.error("Görev kabul etme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

/**
 * GET /api/courier/tasks/active
 * Aktif görevleri getir
 */
router.get("/tasks/active", requireRole('courier'), async (req, res) => {
    try {
        const courierId = req.session.user.id || req.session.user.courierId;
        console.log("✅ Aktif görevler isteği - Courier ID:", courierId, "User:", req.session.user);
        
        const query = `
            SELECT 
                o.id,
                o.order_number,
                o.total_amount,
                o.delivery_fee,
                s.shop_name as pickup_location,
                CONCAT(a.district, ', ', a.city) as delivery_location,
                CONCAT(u.fullname, ' (', SUBSTRING(u.phone, 1, 3), '***)') as customer_name,
                o.status,
                o.estimated_delivery_time,
                ct.picked_up_at,
                ct.delivered_at,
                o.created_at
            FROM orders o
            INNER JOIN sellers s ON o.seller_id = s.id
            INNER JOIN addresses a ON o.address_id = a.id
            INNER JOIN users u ON o.user_id = u.id
            LEFT JOIN courier_tasks ct ON o.id = ct.order_id
            WHERE o.courier_id = ?
            AND o.status IN ('on_delivery', 'ready')
            ORDER BY o.created_at DESC
        `;
        
        const tasks = await db.query(query, [courierId]);
        
        const formattedTasks = tasks.map(task => ({
            id: task.id,
            orderNumber: task.order_number,
            pickup: task.pickup_location,
            dropoff: task.delivery_location,
            customer: task.customer_name,
            payout: parseFloat(task.delivery_fee) || 25.00,
            status: task.status,
            estimatedTime: task.estimated_delivery_time,
            pickedUpAt: task.picked_up_at,
            deliveredAt: task.delivered_at,
            createdAt: task.created_at
        }));
        
        res.json({
            success: true,
            tasks: formattedTasks
        });
    } catch (error) {
        console.error("Aktif görevler getirme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

/**
 * PUT /api/courier/tasks/:id/pickup
 * Siparişi restorandan al (picked up)
 */
router.put("/tasks/:id/pickup", requireRole('courier'), async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const courierId = req.session.user.id;
        
        // Siparişin bu kuryeye ait olduğunu kontrol et
        const orderCheck = await db.query(
            "SELECT id, courier_id, status FROM orders WHERE id = ?",
            [orderId]
        );
        
        if (orderCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Sipariş bulunamadı."
            });
        }
        
        if (orderCheck[0].courier_id !== courierId) {
            return res.status(403).json({
                success: false,
                message: "Bu sipariş size ait değil."
            });
        }
        
        if (orderCheck[0].status !== 'on_delivery' && orderCheck[0].status !== 'ready') {
            return res.status(400).json({
                success: false,
                message: "Bu sipariş alınabilir durumda değil."
            });
        }
        
        // Courier task'ı güncelle
        await db.execute(
            `UPDATE courier_tasks 
             SET status = 'picked_up', picked_up_at = NOW()
             WHERE order_id = ? AND courier_id = ?`,
            [orderId, courierId]
        );
        
        res.json({
            success: true,
            message: "Sipariş başarıyla alındı olarak işaretlendi."
        });
    } catch (error) {
        console.error("Sipariş alma hatası:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

/**
 * PUT /api/courier/tasks/:id/complete
 * Görevi tamamla
 */
router.put("/tasks/:id/complete", requireRole('courier'), async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const courierId = req.session.user.id;
        
        // Siparişin bu kuryeye ait olduğunu kontrol et
        const orderCheck = await db.query(
            "SELECT id, courier_id, status FROM orders WHERE id = ?",
            [orderId]
        );
        
        if (orderCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Sipariş bulunamadı."
            });
        }
        
        if (orderCheck[0].courier_id !== courierId) {
            return res.status(403).json({
                success: false,
                message: "Bu sipariş size ait değil."
            });
        }
        
        // Siparişi tamamla
        await db.execute(
            "UPDATE orders SET status = 'delivered', delivered_at = NOW() WHERE id = ?",
            [orderId]
        );
        
        // Courier task'ı güncelle
        await db.execute(
            `UPDATE courier_tasks 
             SET status = 'delivered', delivered_at = NOW(), actual_payout = estimated_payout
             WHERE order_id = ? AND courier_id = ?`,
            [orderId, courierId]
        );
        
        res.json({
            success: true,
            message: "Görev başarıyla tamamlandı."
        });
    } catch (error) {
        console.error("Görev tamamlama hatası:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

/**
 * GET /api/courier/tasks/history
 * Geçmiş görevleri getir
 */
router.get("/tasks/history", requireRole('courier'), async (req, res) => {
    try {
        const courierId = req.session.user.id || req.session.user.courierId;
        console.log("✅ Geçmiş görevler isteği - Courier ID:", courierId, "User:", req.session.user);
        const { page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        const query = `
            SELECT 
                o.id,
                o.order_number,
                o.total_amount,
                o.delivery_fee,
                s.shop_name as pickup_location,
                CONCAT(COALESCE(a.district, ''), ', ', COALESCE(a.city, '')) as delivery_location,
                CONCAT(COALESCE(u.fullname, 'Müşteri'), ' (', SUBSTRING(COALESCE(u.phone, '000'), 1, 3), '***)') as customer_name,
                o.status,
                ct.delivered_at,
                ct.actual_payout,
                o.created_at
            FROM orders o
            LEFT JOIN sellers s ON o.seller_id = s.id
            LEFT JOIN addresses a ON o.address_id = a.id
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN courier_tasks ct ON o.id = ct.order_id
            WHERE o.courier_id = ?
            AND o.status = 'delivered'
            ORDER BY COALESCE(ct.delivered_at, o.created_at) DESC
            LIMIT ? OFFSET ?
        `;
        
        const tasks = await db.query(query, [courierId, parseInt(limit), offset]);
        
        // Toplam sayıyı al
        const countQuery = `
            SELECT COUNT(*) as total
            FROM orders
            WHERE courier_id = ? AND status = 'delivered'
        `;
        const countResult = await db.query(countQuery, [courierId]);
        const total = countResult && countResult.length > 0 ? countResult[0].total : 0;
        
        const formattedTasks = (tasks || []).map(task => ({
            id: task.id,
            orderNumber: task.order_number || `SIP-${task.id}`,
            pickup: task.pickup_location || 'Restoran',
            dropoff: task.delivery_location || 'Adres bilgisi yok',
            customer: task.customer_name || 'Müşteri',
            payout: parseFloat(task.actual_payout || task.delivery_fee) || 25.00,
            status: task.status || 'delivered',
            deliveredAt: task.delivered_at || task.created_at,
            createdAt: task.created_at
        }));
        
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
        console.error("❌ Geçmiş görevler getirme hatası:", error);
        console.error("Hata detayı:", error.message);
        console.error("Stack trace:", error.stack);
        res.status(500).json({
            success: false,
            message: "Geçmiş görevler yüklenirken bir hata oluştu.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/courier/earnings
 * Kazanç istatistikleri
 */
router.get("/earnings", requireRole('courier'), async (req, res) => {
    try {
        const courierId = req.session.user.id || req.session.user.courierId;
        console.log("✅ Kurye kazanç isteği - Courier ID:", courierId, "User:", req.session.user);
        const { period = 'month' } = req.query; // day, week, month
        
        let dateFilter = '';
        if (period === 'day') {
            dateFilter = "DATE(ct.delivered_at) = CURDATE()";
        } else if (period === 'week') {
            dateFilter = "ct.delivered_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
        } else if (period === 'month') {
            dateFilter = "ct.delivered_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
        }
        
        const query = `
            SELECT 
                COUNT(*) as total_deliveries,
                COALESCE(SUM(ct.actual_payout), 0) as total_earnings,
                COALESCE(AVG(ct.actual_payout), 0) as avg_earnings_per_delivery
            FROM courier_tasks ct
            INNER JOIN orders o ON ct.order_id = o.id
            WHERE ct.courier_id = ?
            AND ct.status = 'delivered'
            ${dateFilter ? `AND ${dateFilter}` : ''}
        `;
        
        const stats = await db.query(query, [courierId]);
        
        res.json({
            success: true,
            period: period,
            stats: {
                totalDeliveries: parseInt(stats[0].total_deliveries) || 0,
                totalEarnings: parseFloat(stats[0].total_earnings) || 0,
                avgEarningsPerDelivery: parseFloat(stats[0].avg_earnings_per_delivery) || 0
            }
        });
    } catch (error) {
        console.error("Kazanç istatistikleri getirme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

/**
 * PUT /api/courier/profile
 * Kurye profil bilgilerini güncelle
 * ÖNEMLİ: GET'ten ÖNCE tanımlanmalı!
 */
router.put("/profile", requireRole('courier'), async (req, res) => {
    try {
        const courierId = req.session.user.id || req.session.user.courierId;
        const { fullname, phone, status, vehicleType } = req.body;
        
        console.log("✅ Profil güncelleme isteği - Courier ID:", courierId, "Data:", { fullname, phone, status, vehicleType });
        
        // Status ve vehicleType kontrolü
        const validStatuses = ['online', 'offline'];
        const validVehicleTypes = ['motorcycle', 'car', 'bicycle'];
        
        let updateFields = [];
        let updateValues = [];
        
        // Eğer sadece status güncelleniyorsa, fullname ve phone zorunlu değil
        if (fullname) {
            updateFields.push("fullname = ?");
            updateValues.push(fullname);
        }
        
        if (phone) {
            updateFields.push("phone = ?");
            updateValues.push(phone);
        }
        
        // Eğer hiçbir alan gönderilmemişse hata döndür
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
        
        // Veritabanında courier_status ve vehicle_type kolonları yoksa ekle
        try {
            await db.execute(
                `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
                updateValues
            );
        } catch (dbError) {
            // Eğer kolon yoksa, önce ekle
            if (dbError.code === 'ER_BAD_FIELD_ERROR') {
                console.log("⚠️ courier_status veya vehicle_type kolonu yok, ekleniyor...");
                try {
                    // Önce kolonların var olup olmadığını kontrol et
                    const columnsCheck = await db.query(`
                        SELECT COLUMN_NAME 
                        FROM INFORMATION_SCHEMA.COLUMNS 
                        WHERE TABLE_SCHEMA = DATABASE() 
                        AND TABLE_NAME = 'users' 
                        AND COLUMN_NAME IN ('courier_status', 'vehicle_type')
                    `);
                    
                    const existingColumns = columnsCheck.map(col => col.COLUMN_NAME);
                    
                    // Eksik kolonları ekle
                    if (!existingColumns.includes('courier_status')) {
                        await db.execute("ALTER TABLE users ADD COLUMN courier_status ENUM('online', 'offline') DEFAULT 'online'");
                        console.log("✅ courier_status kolonu eklendi");
                    }
                    
                    if (!existingColumns.includes('vehicle_type')) {
                        await db.execute("ALTER TABLE users ADD COLUMN vehicle_type ENUM('motorcycle', 'car', 'bicycle') DEFAULT 'motorcycle'");
                        console.log("✅ vehicle_type kolonu eklendi");
                    }
                    
                    // Tekrar güncelle
                    await db.execute(
                        `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
                        updateValues
                    );
                } catch (alterError) {
                    console.error("❌ ALTER TABLE hatası:", alterError);
                    // MySQL'de IF NOT EXISTS yok, bu yüzden hata olabilir
                    // Sadece gönderilen alanları güncelle (fullname ve phone zorunlu değil)
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
        
        // Session'ı güncelle
        if (req.session.user) {
            if (fullname) req.session.user.fullname = fullname;
            if (phone) req.session.user.phone = phone;
            if (status) req.session.user.courierStatus = status;
            if (vehicleType) req.session.user.vehicleType = vehicleType;
        }
        
        // Durum mesajı oluştur
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
        console.error("Profil güncelleme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

/**
 * GET /api/courier/profile
 * Kurye profil bilgilerini getir
 */
router.get("/profile", requireRole('courier'), async (req, res) => {
    try {
        const courierId = req.session.user.id || req.session.user.courierId;
        console.log("✅ Kurye profil isteği - Courier ID:", courierId, "User:", req.session.user);
        
        if (!courierId) {
            return res.status(400).json({
                success: false,
                message: "Kurye ID bulunamadı."
            });
        }
        
        // Önce kullanıcıyı basit bir sorgu ile al
        let userQuery = `
            SELECT 
                id,
                email,
                fullname,
                phone,
                role
            FROM users
            WHERE id = ?
        `;
        
        const userResult = await db.query(userQuery, [courierId]);
        
        if (userResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Kurye bulunamadı."
            });
        }
        
        const user = userResult[0];
        
        // courier_status ve vehicle_type kolonlarını kontrol et ve al
        let courierStatus = 'online';
        let vehicleType = 'motorcycle';
        
        try {
            const statusQuery = await db.query(
                "SELECT courier_status, vehicle_type FROM users WHERE id = ?",
                [courierId]
            );
            if (statusQuery.length > 0) {
                courierStatus = statusQuery[0].courier_status || 'online';
                vehicleType = statusQuery[0].vehicle_type || 'motorcycle';
            }
        } catch (statusError) {
            // Kolonlar yoksa varsayılan değerleri kullan
            console.log("⚠️ courier_status veya vehicle_type kolonu bulunamadı, varsayılan değerler kullanılıyor:", statusError.message);
        }
        
        // Teslimat istatistiklerini al
        let totalDeliveries = 0;
        let totalEarnings = 0;
        
        try {
            const deliveriesQuery = await db.query(
                "SELECT COUNT(*) as count FROM orders WHERE courier_id = ? AND status = 'delivered'",
                [courierId]
            );
            if (deliveriesQuery.length > 0) {
                totalDeliveries = parseInt(deliveriesQuery[0].count) || 0;
            }
            
            const earningsQuery = await db.query(
                "SELECT COALESCE(SUM(actual_payout), 0) as total FROM courier_tasks WHERE courier_id = ? AND status = 'delivered'",
                [courierId]
            );
            if (earningsQuery.length > 0) {
                totalEarnings = parseFloat(earningsQuery[0].total) || 0;
            }
        } catch (statsError) {
            console.log("⚠️ İstatistik sorgusu hatası (devam ediliyor):", statsError.message);
        }
        
        // Session'ı güncelle (durum bilgisi için)
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
        console.error("❌ Kurye profil getirme hatası:", error);
        console.error("Hata detayı:", error.message);
        console.error("Stack trace:", error.stack);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası: " + error.message
        });
    }
});

/**
 * OPTIONS /api/courier/profile
 * CORS preflight için
 * NOT: Bu route en sonda tanımlanmalı (GET ve PUT'ten sonra)
 */
router.options("/profile", (req, res) => {
    res.header("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.sendStatus(200);
});

module.exports = router;

