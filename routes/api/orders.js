const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const { authenticateToken } = require("../../middleware/auth");

// ============================================
// MOCK VERİTABANI (Fallback - Veritabanı bağlantısı yoksa)
// ============================================
let MOCK_ORDERS = [
    { id: 1052, userId: 1, sellerName: "Ayşe'nin Mutfağı", date: "12 Kasım 2025, 21:00", total: 259.99, status: "preparing", items: "1 x Ev Mantısı, 2 x Fırın Sütlaç" },
    { id: 1051, userId: 1, sellerName: "Ali'nin Kebapları", date: "10 Kasım 2025, 12:15", total: 85.00, status: "delivered", items: "1 x Adana Kebap" },
    { id: 1050, userId: 2, sellerName: "Vegan Lezzetler", date: "9 Kasım 2025, 17:30", total: 60.00, status: "cancelled", items: "1 x Vegan Burger" },
];

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/orders
 * Yeni sipariş oluştur - Veritabanına kaydet
 */
router.post("/", async (req, res) => {
    try {
        const { cart, address, paymentMethod } = req.body;
        
        // Session'dan user_id al (requireAuth tarafından set edilecek)
        const userId = req.session?.user?.id || req.user?.id || 1;

        if (!cart || !Array.isArray(cart) || cart.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Sepet boş olamaz." 
            });
        }

        if (!address) {
            return res.status(400).json({ 
                success: false, 
                message: "Adres bilgisi gereklidir." 
            });
        }

        try {
            const connection = await db.pool.getConnection();

            // Sepetten ilk yemek kaynağında seller_id bul
            const firstCartItem = cart[0];
            let sellerId = 1; // Varsayılan
            
            if (firstCartItem?.urun?.seller_id) {
                sellerId = firstCartItem.urun.seller_id;
            }

            // Siparişin toplam tutarını hesapla
            const subtotal = cart.reduce((sum, item) => {
                const itemPrice = item.urun?.price || item.urun?.fiyat || 0;
                const quantity = item.adet || 1;
                return sum + (itemPrice * quantity);
            }, 0);

            const deliveryFee = 15.00; // Sabit teslimat ücreti
            const totalAmount = subtotal + deliveryFee;

            // Sipariş numarası oluştur (ORD-2025-000001 formatında)
            const timestamp = Date.now().toString().slice(-6);
            const orderNumber = `ORD-${new Date().getFullYear()}-${timestamp}`;

            // 1. Orders tablosuna sipariş ekle
            const orderQuery = `
                INSERT INTO orders 
                (order_number, user_id, seller_id, address_id, payment_method, subtotal, delivery_fee, total_amount, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            `;

            const [orderResult] = await connection.execute(orderQuery, [
                orderNumber,
                userId,
                sellerId,
                address, // address_id olarak kullanıldı
                paymentMethod || 'credit_card',
                subtotal.toFixed(2),
                deliveryFee.toFixed(2),
                totalAmount.toFixed(2)
            ]);

            const orderId = orderResult.insertId;

            // 2. Order_items tablosuna ürünleri ekle
            for (const item of cart) {
                const mealId = item.urun?.id || item.urun?.meal_id || null;
                const mealName = item.urun?.name || item.urun?.ad || "Belirtilmemiş";
                const mealPrice = item.urun?.price || item.urun?.fiyat || 0;
                const quantity = item.adet || 1;
                const itemSubtotal = (mealPrice * quantity).toFixed(2);

                const itemQuery = `
                    INSERT INTO order_items 
                    (order_id, meal_id, meal_name, meal_price, quantity, subtotal)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;

                await connection.execute(itemQuery, [
                    orderId,
                    mealId,
                    mealName,
                    mealPrice,
                    quantity,
                    itemSubtotal
                ]);
            }

            connection.release();

            res.json({ 
                success: true, 
                orderId: orderId,
                orderNumber: orderNumber,
                message: "Sipariş başarıyla oluşturuldu."
            });

        } catch (dbError) {
            console.warn("⚠️  Veritabanı hatası:", dbError.message);
            // Fallback: Mock veritabanını kullan
            
            const newOrderId = MOCK_ORDERS.length > 0 
                ? Math.max(...MOCK_ORDERS.map(o => o.id)) + 1 
                : 1000;

            const total = cart.reduce((sum, item) => {
                const itemPrice = item.urun?.price || item.urun?.fiyat || 0;
                const quantity = item.adet || 1;
                return sum + (itemPrice * quantity);
            }, 0) + 15.00;

            const newOrder = {
                id: newOrderId,
                userId: userId,
                sellerName: cart[0]?.urun?.satici || "Ev Lezzetleri",
                date: new Date().toLocaleString("tr-TR"),
                total: total.toFixed(2),
                status: "pending",
                items: cart.map(item => 
                    `${item.adet} x ${item.urun?.ad || item.urun?.name}`
                ).join(", ")
            };

            MOCK_ORDERS.unshift(newOrder);

            res.json({ 
                success: true, 
                orderId: newOrderId,
                order: newOrder,
                message: "Sipariş (mock veritabanında) oluşturuldu."
            });
        }

    } catch (error) {
        console.error("Sipariş oluşturma hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası. Sipariş oluşturulamadı." 
        });
    }
});


/**
 * GET /api/orders/active/:userId
 * Aktif siparişleri getir - Veritabanından çek
 */
router.get("/active/:userId", async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        try {
            const connection = await db.pool.getConnection();

            const query = `
                SELECT 
                    o.id,
                    o.order_number,
                    o.status,
                    o.created_at as date,
                    o.total_amount as total,
                    s.shop_name as sellerName,
                    GROUP_CONCAT(oi.meal_name) as items
                FROM orders o
                LEFT JOIN sellers s ON o.seller_id = s.id
                LEFT JOIN order_items oi ON o.id = oi.order_id
                WHERE o.user_id = ? 
                AND o.status IN ('pending', 'confirmed', 'preparing', 'ready', 'on_delivery')
                GROUP BY o.id
                ORDER BY o.created_at DESC
            `;

            const [rows] = await connection.execute(query, [userId]);
            connection.release();

            // Sonuçları formatla
            const activeOrders = rows.map(row => ({
                id: row.id,
                orderNumber: row.order_number,
                status: row.status,
                statusText: getStatusText(row.status),
                date: new Date(row.date).toLocaleString('tr-TR'),
                seller: row.sellerName || "Ev Lezzetleri",
                total: parseFloat(row.total) || 0,
                items: row.items || "Belirtilmemiş",
                canCancel: ['pending', 'confirmed', 'preparing', 'ready'].includes(row.status),
                canDetail: true,
                type: 'active'
            }));

            res.json({
                success: true,
                data: activeOrders
            });

        } catch (dbError) {
            console.warn("⚠️  Veritabanı hatası:", dbError.message);
            // Fallback: Mock veritabanını kullan
            const activeOrders = MOCK_ORDERS.filter(
                o => o.userId === userId && o.status === "preparing"
            ).map(o => ({
                ...o,
                canCancel: true,
                canDetail: true,
                type: 'active'
            }));

            res.json({
                success: true,
                data: activeOrders
            });
        }

    } catch (error) {
        console.error("Aktif siparişler getirme hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası." 
        });
    }
});

/**
 * GET /api/orders/past/:userId
 * Geçmiş siparişleri getir - Veritabanından çek
 */
router.get("/past/:userId", async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        try {
            const connection = await db.pool.getConnection();

            const query = `
                SELECT 
                    o.id,
                    o.order_number,
                    o.status,
                    o.created_at as date,
                    o.total_amount as total,
                    s.shop_name as sellerName,
                    GROUP_CONCAT(oi.meal_name) as items
                FROM orders o
                LEFT JOIN sellers s ON o.seller_id = s.id
                LEFT JOIN order_items oi ON o.id = oi.order_id
                WHERE o.user_id = ? 
                AND o.status IN ('delivered', 'cancelled')
                GROUP BY o.id
                ORDER BY o.created_at DESC
            `;

            const [rows] = await connection.execute(query, [userId]);
            connection.release();

            // Sonuçları formatla
            const pastOrders = rows.map(row => ({
                id: row.id,
                orderNumber: row.order_number,
                status: row.status,
                statusText: getStatusText(row.status),
                date: new Date(row.date).toLocaleString('tr-TR'),
                seller: row.sellerName || "Ev Lezzetleri",
                total: parseFloat(row.total) || 0,
                items: row.items || "Belirtilmemiş",
                canRepeat: row.status === 'delivered',
                canRate: row.status === 'delivered',
                type: 'past'
            }));

            res.json({
                success: true,
                data: pastOrders
            });

        } catch (dbError) {
            console.warn("⚠️  Veritabanı hatası:", dbError.message);
            // Fallback: Mock veritabanını kullan
            const pastOrders = MOCK_ORDERS.filter(
                o => o.userId === userId && (o.status === "delivered" || o.status === "cancelled")
            ).map(o => ({
                ...o,
                canRepeat: o.status === 'delivered',
                canRate: o.status === 'delivered',
                type: 'past'
            }));

            res.json({
                success: true,
                data: pastOrders
            });
        }

    } catch (error) {
        console.error("Geçmiş siparişler getirme hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası." 
        });
    }
});

/**
 * GET /api/orders/:id
 * Belirli bir siparişin detaylarını getir
 */
router.get("/:id", (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const order = MOCK_ORDERS.find(o => o.id === orderId);

        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: "Sipariş bulunamadı." 
            });
        }

        res.json(order);
    } catch (error) {
        console.error("Sipariş detay getirme hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası." 
        });
    }
});

// ============================================
// YARDIMCI FONKSİYONLAR
// ============================================

/**
 * Sipariş durumunu Türkçe metne dönüştür
 * @param {string} status - İngilizce durum
 * @returns {string} Türkçe durum
 */
function getStatusText(status) {
    const statusMap = {
        'pending': 'Beklemede',
        'confirmed': 'Onaylandı',
        'preparing': 'Hazırlanıyor',
        'ready': 'Hazır',
        'on_delivery': 'Yolda',
        'delivered': 'Teslim Edildi',
        'cancelled': 'İptal Edildi'
    };
    return statusMap[status] || status;
}

module.exports = router;