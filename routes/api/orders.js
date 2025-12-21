const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const { authenticateToken, requireAuth, requireRole } = require("../../middleware/auth");

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/orders
 * Yeni sipariş oluştur - Veritabanına kaydet
 */
router.post("/", requireRole('buyer'), async (req, res) => {
    try {
        const { cart, address, paymentMethod } = req.body;
        
        // Session'dan user_id al (requireRole tarafından set edilecek)
        const userId = req.session.user.id;

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

        let connection = null;
        try {
            connection = await db.pool.getConnection();

            // Sepetten ilk yemek kaynağında seller_id bul
            const firstCartItem = cart[0];
            
            let sellerId = null;
            
            // Önce sellerId'yi kontrol et (yeni format)
            if (firstCartItem?.urun?.sellerId) {
                sellerId = parseInt(firstCartItem.urun.sellerId);
            } else if (firstCartItem?.urun?.seller_id) {
                sellerId = parseInt(firstCartItem.urun.seller_id);
            } else if (firstCartItem?.sellerId) {
                sellerId = parseInt(firstCartItem.sellerId);
            }
            
            // Eğer hala bulunamadıysa, meal_id'den seller_id'yi bul
            if (!sellerId) {
                const firstMealId = firstCartItem?.urun?.id || firstCartItem?.meal_id;
                if (firstMealId) {
                    const [mealRows] = await connection.execute(
                        "SELECT seller_id FROM meals WHERE id = ?",
                        [firstMealId]
                    );
                    if (mealRows && mealRows.length > 0) {
                        sellerId = mealRows[0].seller_id;
                    }
                }
            }
            
            // Seller ID bulunamadıysa hata ver
            if (!sellerId) {
                if (connection) {
                    connection.release();
                }
                return res.status(400).json({ 
                    success: false, 
                    message: "Satıcı bilgisi bulunamadı. Lütfen sepete ürün ekleyin." 
                });
            }

            // Address ID'yi kontrol et ve geçerli değilse varsayılan adres oluştur
            let addressId = typeof address === 'number' ? address : (typeof address === 'string' ? parseInt(address) : null);
            
            // Address ID geçerli mi kontrol et
            if (addressId) {
                const [addressCheck] = await connection.execute(
                    "SELECT id FROM addresses WHERE id = ? AND user_id = ?",
                    [addressId, userId]
                );
                
                if (!addressCheck || addressCheck.length === 0) {
                    // Address ID geçersiz, varsayılan adres oluştur
                    addressId = null;
                }
            }
            
            // Eğer address ID yoksa, kullanıcı için varsayılan adres oluştur
            if (!addressId) {
                // Önce kullanıcının varsayılan adresini kontrol et
                const [defaultAddress] = await connection.execute(
                    "SELECT id FROM addresses WHERE user_id = ? AND is_default = TRUE LIMIT 1",
                    [userId]
                );
                
                if (defaultAddress && defaultAddress.length > 0) {
                    addressId = defaultAddress[0].id;
                } else {
                    // Varsayılan adres yoksa, yeni bir adres oluştur
                    const [userInfo] = await connection.execute(
                        "SELECT fullname, phone FROM users WHERE id = ?",
                        [userId]
                    );
                    
                    const userName = userInfo && userInfo.length > 0 ? userInfo[0].fullname : 'Kullanıcı';
                    
                    const [newAddressResult] = await connection.execute(
                        `INSERT INTO addresses (user_id, title, full_address, district, city, is_default) 
                         VALUES (?, ?, ?, ?, ?, TRUE)`,
                        [
                            userId,
                            'Ev Adresi',
                            'Adres bilgisi girilmemiş, lütfen profil sayfanızdan güncelleyin',
                            'İstanbul',
                            'İstanbul'
                        ]
                    );
                    
                    addressId = newAddressResult.insertId;
                }
            }

            // Meal ID'lerini topla ve veritabanından güncel fiyatları çek
            const mealIds = cart
                .map(item => item.urun?.id || item.urun?.meal_id || item.meal_id)
                .filter(id => id != null);
            
            if (mealIds.length === 0) {
                connection.release();
                return res.status(400).json({ 
                    success: false, 
                    message: "Geçersiz sepet içeriği." 
                });
            }

            // Veritabanından meal fiyatlarını çek
            const mealPlaceholders = mealIds.map(() => '?').join(',');
            const [mealRows] = await connection.execute(
                `SELECT id, name, price FROM meals WHERE id IN (${mealPlaceholders}) AND is_available = TRUE`,
                mealIds
            );

            // Meal fiyatlarını map'e çevir (hızlı erişim için)
            const mealPriceMap = {};
            const mealNameMap = {};
            mealRows.forEach(meal => {
                mealPriceMap[meal.id] = parseFloat(meal.price);
                mealNameMap[meal.id] = meal.name;
            });

            // Eksik meal kontrolü
            const missingMeals = mealIds.filter(id => !mealPriceMap[id]);
            if (missingMeals.length > 0) {
                connection.release();
                return res.status(400).json({ 
                    success: false, 
                    message: `Bazı ürünler bulunamadı veya satışta değil. Ürün ID'leri: ${missingMeals.join(', ')}` 
                });
            }

            // Seller'ın delivery fee'sini veritabanından çek
            const [sellerRows] = await connection.execute(
                "SELECT delivery_fee FROM sellers WHERE id = ?",
                [sellerId]
            );

            if (!sellerRows || sellerRows.length === 0) {
                connection.release();
                return res.status(400).json({ 
                    success: false, 
                    message: "Satıcı bilgisi bulunamadı." 
                });
            }

            let deliveryFee = parseFloat(sellerRows[0].delivery_fee) || 15.00;

            // Subtotal'i veritabanından gelen fiyatlarla hesapla
            let subtotal = 0;
            for (const item of cart) {
                const mealId = item.urun?.id || item.urun?.meal_id || item.meal_id;
                const quantity = item.adet || item.quantity || 1;
                const mealPrice = mealPriceMap[mealId];
                
                if (!mealPrice) {
                    connection.release();
                    return res.status(400).json({ 
                        success: false, 
                        message: `Ürün ID ${mealId} için fiyat bulunamadı.` 
                    });
                }
                
                subtotal += mealPrice * quantity;
            }
            
            // Yuvarlama hatası önlemek için 2 ondalık basamağa yuvarla
            subtotal = Math.round(subtotal * 100) / 100;
            deliveryFee = Math.round(deliveryFee * 100) / 100;
            const totalAmount = Math.round((subtotal + deliveryFee) * 100) / 100;

            // Sipariş numarası oluştur (ORD-2025-000001 formatında)
            // Rastgele bir ID oluştur (timestamp + random)
            const timestamp = Date.now().toString().slice(-6);
            const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
            const orderNumber = `ORD-${new Date().getFullYear()}-${timestamp}${random}`;

            // 1. Orders tablosuna sipariş ekle
            const orderQuery = `
                INSERT INTO orders 
                (order_number, user_id, seller_id, address_id, payment_method, subtotal, delivery_fee, total_amount, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            `;
            
            const orderValues = [
                orderNumber,
                userId,
                sellerId,
                addressId,
                paymentMethod || 'credit_card',
                subtotal.toFixed(2),
                deliveryFee.toFixed(2),
                totalAmount.toFixed(2)
            ];
            
            const [orderResult] = await connection.execute(orderQuery, orderValues);

            const orderId = orderResult.insertId;

            // 2. Order_items tablosuna ürünleri ekle (veritabanından gelen fiyatlarla)
            for (const item of cart) {
                const mealId = item.urun?.id || item.urun?.meal_id || item.meal_id;
                const quantity = item.adet || item.quantity || 1;
                
                // Veritabanından gelen fiyat ve ismi kullan
                const mealPrice = mealPriceMap[mealId];
                const mealName = mealNameMap[mealId] || item.urun?.name || item.urun?.ad || "Belirtilmemiş";
                
                if (!mealPrice) {
                    console.error(`❌ Meal ID ${mealId} için fiyat bulunamadı!`);
                    continue; // Bu ürünü atla ve devam et
                }
                
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
                    mealPrice.toFixed(2),
                    quantity,
                    itemSubtotal
                ]);
            }
            
            if (connection) {
                connection.release();
            }

            res.json({ 
                success: true, 
                orderId: orderId,
                orderNumber: orderNumber,
                sellerId: sellerId,
                subtotal: subtotal.toFixed(2),
                deliveryFee: deliveryFee.toFixed(2),
                total: totalAmount.toFixed(2),
                message: "Sipariş başarıyla oluşturuldu."
            });

        } catch (dbError) {
            // Connection'ı her durumda release et
            if (connection) {
                try {
                    connection.release();
                } catch (releaseError) {
                    console.error('Connection release hatası:', releaseError);
                }
            }
            
            console.error("❌ Veritabanı hatası:", dbError.message);
            console.error("❌ Hata detayı:", dbError);
            console.error("❌ Hata stack:", dbError.stack);
            console.error("❌ Hata kodu:", dbError.code);
            
            // Veritabanı hatasını kullanıcıya bildir
            return res.status(500).json({ 
                success: false, 
                message: "Sipariş oluşturulurken veritabanı hatası oluştu: " + dbError.message,
                error: process.env.NODE_ENV === 'development' ? dbError.message : undefined
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
            console.error("❌ Veritabanı hatası:", dbError.message);
            console.error("❌ Hata stack:", dbError.stack);
            res.status(500).json({ 
                success: false, 
                message: "Veritabanı hatası. Siparişler yüklenemedi." 
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
                canRate: row.status === 'delivered', // Frontend'de API'den kontrol edilecek
                type: 'past'
            }));

            res.json({
                success: true,
                data: pastOrders
            });

        } catch (dbError) {
            console.error("❌ Veritabanı hatası:", dbError.message);
            console.error("❌ Hata stack:", dbError.stack);
            res.status(500).json({ 
                success: false, 
                message: "Veritabanı hatası. Siparişler yüklenemedi." 
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

// ============================================
// SELLER ORDERS ENDPOINTS (SPESİFİK ROUTE'LAR ÖNCE TANIMLANMALI)
// ============================================

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

// ============================================
// SELLER ORDERS ENDPOINTS
// ============================================
// requireRole zaten yukarıda import edildi (satır 4)

/**
 * GET /api/orders/seller/orders
 * Satıcının siparişlerini getir (tab'a göre: new, preparing, history)
 */
router.get("/seller/orders", requireRole('seller'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { tab = 'new' } = req.query; // new, preparing, history
        
        
        // Kullanıcının seller_id'sini bul
        const sellerQuery = await db.query(
            "SELECT id FROM sellers WHERE user_id = ?",
            [userId]
        );
        
        if (sellerQuery.length === 0) {
            console.log(`❌ Satıcı kaydı bulunamadı - User ID: ${userId}`);
            return res.status(404).json({
                success: false,
                message: "Satıcı kaydı bulunamadı."
            });
        }
        
        const shopId = sellerQuery[0].id;
        
        // Önce bu seller_id'ye ait tüm siparişleri kontrol et (debug için)
        const allOrdersCheck = await db.query(
            "SELECT id, order_number, seller_id, status, created_at FROM orders WHERE seller_id = ? ORDER BY created_at DESC LIMIT 10",
            [shopId]
        );
        
        let statusFilter = '';
        if (tab === 'new') {
            statusFilter = "o.status IN ('pending', 'confirmed')";
        } else if (tab === 'preparing') {
            // Hazırlanan ve hazır durumundaki siparişler
            statusFilter = "o.status IN ('preparing', 'ready')";
        } else if (tab === 'history') {
            statusFilter = "o.status IN ('delivered', 'cancelled', 'on_delivery')";
        }
        
        const query = `
            SELECT 
                o.id,
                o.order_number,
                o.status,
                o.courier_id,
                o.created_at as date,
                o.total_amount as total,
                o.subtotal,
                o.delivery_fee,
                o.discount_amount,
                o.seller_id,
                CONCAT(SUBSTRING(u.fullname, 1, 1), '*** ', SUBSTRING(u.fullname, -1)) as customer_name,
                COALESCE(CONCAT(a.district, ', ', a.city), a.full_address, CONCAT('Adres ID: ', o.address_id)) as delivery_address,
                GROUP_CONCAT(CONCAT(oi.quantity, ' x ', oi.meal_name) SEPARATOR ', ') as items,
                courier.fullname as courier_name
            FROM orders o
            INNER JOIN users u ON o.user_id = u.id
            LEFT JOIN addresses a ON o.address_id = a.id
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN users courier ON o.courier_id = courier.id
            WHERE o.seller_id = ?
            ${statusFilter ? `AND ${statusFilter}` : ''}
            GROUP BY o.id, o.order_number, o.status, o.courier_id, o.created_at, o.total_amount, o.subtotal, o.delivery_fee, o.discount_amount, o.seller_id, u.fullname, a.district, a.city, a.full_address, courier.fullname
            ORDER BY o.created_at DESC
        `;
        
        const orders = await db.query(query, [shopId]);
        if (orders.length > 0) {
            console.log(`📋 İlk sipariş örneği:`, {
                id: orders[0].id,
                order_number: orders[0].order_number,
                seller_id: orders[0].seller_id,
                status: orders[0].status
            });
        }
        
        const formattedOrders = orders.map(order => ({
            id: order.id,
            orderNumber: order.order_number,
            status: order.status,
            statusText: getStatusText(order.status),
            courierId: order.courier_id || null,
            courierName: order.courier_name || null,
            date: new Date(order.date).toLocaleString('tr-TR'),
            customer: order.customer_name,
            address: order.delivery_address,
            items: order.items || "Belirtilmemiş",
            total: parseFloat(order.total) || 0,
            subtotal: parseFloat(order.subtotal) || 0,
            deliveryFee: parseFloat(order.delivery_fee) || 0,
            discount: parseFloat(order.discount_amount) || 0
        }));
        
        
        res.json({
            success: true,
            orders: formattedOrders,
            tab: tab
        });
    } catch (error) {
        console.error("❌ Satıcı siparişleri getirme hatası:", error);
        console.error("❌ Hata detayı:", error.stack);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

/**
 * PUT /api/seller/orders/:id/status
 * Sipariş durumunu güncelle
 */
router.put("/seller/orders/:id/status", requireRole('seller'), async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const sellerId = req.session.user.id;
        const { status } = req.body;
        
        if (!status) {
            return res.status(400).json({
                success: false,
                message: "Durum belirtilmedi."
            });
        }
        
        // Geçerli durumlar
        const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Geçersiz durum."
            });
        }
        
        // Kullanıcının seller_id'sini bul
        const sellerQuery = await db.query(
            "SELECT id FROM sellers WHERE user_id = ?",
            [sellerId]
        );
        
        if (sellerQuery.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Satıcı kaydı bulunamadı."
            });
        }
        
        const shopId = sellerQuery[0].id;
        
        // Siparişin bu satıcıya ait olduğunu kontrol et
        const orderCheck = await db.query(
            "SELECT id FROM orders WHERE id = ? AND seller_id = ?",
            [orderId, shopId]
        );
        
        if (orderCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Sipariş bulunamadı veya size ait değil."
            });
        }
        
        // Eğer durum "ready" ise, aktif bir kuryeye rastgele ata
        if (status === 'ready') {
            try {
                // Önce siparişin zaten bir kuryeye atanmış olup olmadığını kontrol et
                const currentOrder = await db.query(
                    "SELECT courier_id, status FROM orders WHERE id = ?",
                    [orderId]
                );
                
                if (currentOrder.length > 0 && currentOrder[0].courier_id !== null) {
                    console.log(`ℹ️ Sipariş zaten bir kuryeye atanmış (Courier ID: ${currentOrder[0].courier_id})`);
                    // Sadece durumu güncelle, kurye ataması yapma
                    await db.execute(
                        "UPDATE orders SET status = ? WHERE id = ? AND seller_id = ?",
                        [status, orderId, shopId]
                    );
                    
                    res.json({
                        success: true,
                        message: "Sipariş durumu güncellendi."
                    });
                    return;
                }
                
                // Aktif kuryeleri bul (şu anda aktif görevi olmayan veya az görevi olan)
                // Aktif görev: on_delivery durumunda siparişi olan kuryeler
                // courier_status = 'online' olan ve aktif görevi olmayan kuryeler
                const activeCouriersQuery = `
                    SELECT DISTINCT u.id, u.fullname, u.email
                    FROM users u
                    WHERE u.role = 'courier'
                    AND (u.courier_status = 'online' OR u.courier_status IS NULL)
                    AND u.is_active = TRUE
                    AND u.id NOT IN (
                        SELECT DISTINCT o.courier_id 
                        FROM orders o 
                        WHERE o.status = 'on_delivery' 
                        AND o.courier_id IS NOT NULL
                    )
                    ORDER BY RAND()
                    LIMIT 10
                `;
                
                const activeCouriers = await db.query(activeCouriersQuery);
                
                if (activeCouriers && activeCouriers.length > 0) {
                    // Rastgele bir kurye seç
                    const randomIndex = Math.floor(Math.random() * activeCouriers.length);
                    const selectedCourier = activeCouriers[randomIndex];
                    const courierId = selectedCourier.id;
                    
                    console.log(`✅ Aktif kurye bulundu ve seçildi: ${selectedCourier.fullname} (ID: ${courierId})`);
                    
                    // Sipariş bilgilerini al (courier task için)
                    const orderInfo = await db.query(
                        `SELECT o.delivery_fee, s.shop_name, CONCAT(a.district, ', ', a.city) as delivery_location
                         FROM orders o
                         INNER JOIN sellers s ON o.seller_id = s.id
                         INNER JOIN addresses a ON o.address_id = a.id
                         WHERE o.id = ?`,
                        [orderId]
                    );
                    
                    // Siparişi kuryeye ata ve durumu "on_delivery" yap
                    await db.execute(
                        "UPDATE orders SET courier_id = ?, status = 'on_delivery' WHERE id = ? AND seller_id = ?",
                        [courierId, orderId, shopId]
                    );
                    
                    // Courier task kaydı oluştur (eğer yoksa)
                    const existingTask = await db.query(
                        "SELECT id FROM courier_tasks WHERE order_id = ?",
                        [orderId]
                    );
                    
                    if (existingTask.length === 0 && orderInfo && orderInfo.length > 0) {
                        await db.execute(
                            `INSERT INTO courier_tasks (order_id, courier_id, pickup_location, delivery_location, estimated_payout, status)
                             VALUES (?, ?, ?, ?, ?, 'assigned')`,
                            [
                                orderId,
                                courierId,
                                orderInfo[0].shop_name,
                                orderInfo[0].delivery_location,
                                parseFloat(orderInfo[0].delivery_fee) || 25.00
                            ]
                        );
                    }
                    
                    res.json({
                        success: true,
                        message: "Sipariş durumu güncellendi ve kuryeye atandı.",
                        courier: {
                            id: courierId,
                            name: selectedCourier.fullname
                        }
                    });
                    return;
                } else {
                    console.log("⚠️ Aktif kurye bulunamadı, sipariş ready durumunda bırakıldı.");
                    // Aktif kurye yoksa, siparişi ready durumunda bırak (kuryeler manuel alabilir)
                }
            } catch (courierError) {
                console.error("❌ Kurye atama hatası:", courierError);
                // Hata durumunda siparişi ready durumunda bırak
            }
        }
        
        // Normal durum güncellemesi (ready değilse veya kurye bulunamadıysa)
        await db.execute(
            "UPDATE orders SET status = ? WHERE id = ? AND seller_id = ?",
            [status, orderId, shopId]
        );
        
        res.json({
            success: true,
            message: "Sipariş durumu güncellendi."
        });
    } catch (error) {
        console.error("Sipariş durumu güncelleme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

/**
 * POST /api/orders/seller/assign-courier/:id
 * Hazır durumundaki siparişi aktif ve boşta olan bir kuryeye rastgele ata
 */
router.post("/seller/assign-courier/:id", requireRole('seller'), async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const userId = req.session.user.id;
        
        
        // Kullanıcının seller_id'sini bul
        const sellerQuery = await db.query(
            "SELECT id FROM sellers WHERE user_id = ?",
            [userId]
        );
        
        if (sellerQuery.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Satıcı kaydı bulunamadı."
            });
        }
        
        const shopId = sellerQuery[0].id;
        
        // Siparişin bu satıcıya ait olduğunu ve ready durumunda olduğunu kontrol et
        const orderCheck = await db.query(
            "SELECT id, courier_id, status FROM orders WHERE id = ? AND seller_id = ?",
            [orderId, shopId]
        );
        
        if (orderCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Sipariş bulunamadı veya size ait değil."
            });
        }
        
        const order = orderCheck[0];
        
        if (order.status !== 'ready') {
            return res.status(400).json({
                success: false,
                message: "Sipariş hazır durumunda değil. Önce siparişi hazır durumuna getirin."
            });
        }
        
        if (order.courier_id !== null) {
            return res.status(400).json({
                success: false,
                message: "Bu sipariş zaten bir kuryeye atanmış."
            });
        }
        
        // Aktif ve boşta olan kuryeleri bul
        // - courier_status = 'online' veya NULL (eski kayıtlar için)
        // - is_active = TRUE
        // - Şu anda on_delivery durumunda siparişi olmayan
        const activeCouriersQuery = `
            SELECT DISTINCT u.id, u.fullname, u.email
            FROM users u
            WHERE u.role = 'courier'
            AND (u.courier_status = 'online' OR u.courier_status IS NULL)
            AND u.is_active = TRUE
            AND u.id NOT IN (
                SELECT DISTINCT o.courier_id 
                FROM orders o 
                WHERE o.status = 'on_delivery' 
                AND o.courier_id IS NOT NULL
            )
            ORDER BY RAND()
            LIMIT 10
        `;
        
        const activeCouriers = await db.query(activeCouriersQuery);
        
        if (!activeCouriers || activeCouriers.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Aktif ve boşta olan kurye bulunamadı. Lütfen daha sonra tekrar deneyin."
            });
        }
        
        // Rastgele bir kurye seç
        const randomIndex = Math.floor(Math.random() * activeCouriers.length);
        const selectedCourier = activeCouriers[randomIndex];
        const courierId = selectedCourier.id;
        
        console.log(`✅ Aktif kurye bulundu ve seçildi: ${selectedCourier.fullname} (ID: ${courierId})`);
        
        // Sipariş bilgilerini al (courier task için)
        const orderInfo = await db.query(
            `SELECT o.delivery_fee, s.shop_name, CONCAT(a.district, ', ', a.city) as delivery_location
             FROM orders o
             INNER JOIN sellers s ON o.seller_id = s.id
             INNER JOIN addresses a ON o.address_id = a.id
             WHERE o.id = ?`,
            [orderId]
        );
        
        // Siparişi kuryeye ata ve durumu "on_delivery" yap
        await db.execute(
            "UPDATE orders SET courier_id = ?, status = 'on_delivery' WHERE id = ? AND seller_id = ?",
            [courierId, orderId, shopId]
        );
        
        // Courier task kaydı oluştur (eğer yoksa)
        const existingTask = await db.query(
            "SELECT id FROM courier_tasks WHERE order_id = ?",
            [orderId]
        );
        
        if (existingTask.length === 0 && orderInfo && orderInfo.length > 0) {
            await db.execute(
                `INSERT INTO courier_tasks (order_id, courier_id, pickup_location, delivery_location, estimated_payout, status)
                 VALUES (?, ?, ?, ?, ?, 'assigned')`,
                [
                    orderId,
                    courierId,
                    orderInfo[0].shop_name,
                    orderInfo[0].delivery_location,
                    parseFloat(orderInfo[0].delivery_fee) || 25.00
                ]
            );
            console.log(`✅ Courier task kaydı oluşturuldu - Order ID: ${orderId}, Courier ID: ${courierId}`);
        }
        
        res.json({
            success: true,
            message: `Sipariş ${selectedCourier.fullname} kuryesine atandı.`,
            courier: {
                id: courierId,
                name: selectedCourier.fullname
            }
        });
        
    } catch (error) {
        console.error("❌ Kurye atama hatası:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Sunucu hatası."
        });
    }
});

// ============================================
// GET ORDER BY ID ENDPOINT (GENEL ROUTE - SONA EKLENMELI)
// ============================================

/**
 * GET /api/orders/:id
 * Sipariş detayını getir
 * NOT: Bu endpoint /seller/orders gibi spesifik route'lardan SONRA tanımlanmalı
 */
router.get("/:id", requireAuth, async (req, res) => {
    console.log('📦 ========== GET /api/orders/:id ENDPOINT ==========');
    console.log('📦 Order ID (raw):', req.params.id);
    console.log('📦 Request path:', req.path);
    console.log('📦 Request url:', req.url);
    
    try {
        const orderId = parseInt(req.params.id);
        const userId = req.session?.user?.id || req.user?.id || null;
        console.log('📦 Parsed Order ID:', orderId);
        console.log('📦 User ID:', userId);
        
        if (isNaN(orderId) || orderId <= 0) {
            console.error('❌ Geçersiz Order ID:', req.params.id);
            return res.status(400).json({
                success: false,
                message: "Geçersiz sipariş ID'si."
            });
        }

        let connection;
        try {
            connection = await db.pool.getConnection();

            // Sipariş bilgilerini çek
            const orderQuery = `
                SELECT 
                    o.id,
                    o.order_number,
                    o.status,
                    o.created_at as date,
                    o.total_amount as total,
                    o.subtotal,
                    o.delivery_fee,
                    o.discount_amount,
                    o.payment_method,
                    o.address_id,
                    o.user_id,
                    o.seller_id,
                    s.shop_name as seller_name,
                    u_seller.phone as seller_phone,
                    u.fullname as customer_name,
                    u.email as customer_email,
                    u.phone as customer_phone,
                    a.district,
                    a.city,
                    a.full_address,
                    a.postal_code
                FROM orders o
                LEFT JOIN sellers s ON o.seller_id = s.id
                LEFT JOIN users u ON o.user_id = u.id
                LEFT JOIN users u_seller ON s.user_id = u_seller.id
                LEFT JOIN addresses a ON o.address_id = a.id
                WHERE o.id = ?
            `;

            const [orderRows] = await connection.execute(orderQuery, [orderId]);

            if (orderRows.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: "Sipariş bulunamadı."
                });
            }

            const order = orderRows[0];

            // Kullanıcı kontrolü (sadece sipariş sahibi, satıcı veya admin görebilir)
            const orderUserId = order.user_id || null;
            const orderSellerId = order.seller_id || null;
            const userRole = req.session?.user?.role || req.user?.role;
            
            // Seller kontrolü - seller_id'yi users tablosundan bul
            let isSeller = false;
            if (userRole === 'seller' && orderSellerId) {
                const [sellerCheck] = await connection.execute(
                    "SELECT user_id FROM sellers WHERE id = ? AND user_id = ?",
                    [orderSellerId, userId]
                );
                isSeller = sellerCheck && sellerCheck.length > 0;
            }
            
            if (userId && orderUserId !== userId && !isSeller && userRole !== 'admin') {
                return res.status(403).json({ 
                    success: false, 
                    message: "Bu siparişi görüntüleme yetkiniz yok." 
                });
            }

            // Sipariş öğelerini çek
            const itemsQuery = `
                SELECT 
                    oi.id,
                    oi.meal_id,
                    oi.meal_name,
                    oi.meal_price,
                    oi.quantity,
                    oi.subtotal
                FROM order_items oi
                WHERE oi.order_id = ?
                ORDER BY oi.id
            `;

            const [itemsRows] = await connection.execute(itemsQuery, [orderId]);

            // Sonuçları formatla
            const orderDetail = {
                id: order.id,
                orderNumber: order.order_number,
                status: order.status,
                statusText: getStatusText(order.status),
                date: new Date(order.date).toLocaleString('tr-TR'),
                total: parseFloat(order.total) || 0,
                subtotal: parseFloat(order.subtotal) || 0,
                deliveryFee: parseFloat(order.delivery_fee) || 0,
                discount: parseFloat(order.discount_amount) || 0,
                paymentMethod: order.payment_method || 'credit_card',
                seller: {
                    id: order.seller_id,
                    name: order.seller_name || "Ev Lezzetleri",
                    phone: order.seller_phone
                },
                customer: {
                    name: order.customer_name,
                    email: order.customer_email,
                    phone: order.customer_phone
                },
                address: {
                    district: order.district,
                    city: order.city,
                    addressLine: order.full_address,
                    postalCode: order.postal_code,
                    full: order.full_address || (order.district && order.city 
                        ? `${order.district}, ${order.city} ${order.postal_code ? `(${order.postal_code})` : ''}`
                        : 'Adres bilgisi yok')
                },
                items: (itemsRows || []).map(item => ({
                    id: item.id,
                    mealId: item.meal_id,
                    mealName: item.meal_name,
                    mealPrice: parseFloat(item.meal_price) || 0,
                    quantity: item.quantity,
                    subtotal: parseFloat(item.subtotal) || 0
                }))
            };


            res.json({
                success: true,
                data: orderDetail
            });

        } catch (dbError) {
            console.error("❌ Veritabanı hatası:", dbError.message);
            console.error("❌ Hata stack:", dbError.stack);
            res.status(500).json({ 
                success: false, 
                message: "Veritabanı hatası. Sipariş detayı yüklenemedi.",
                error: process.env.NODE_ENV === 'development' ? dbError.message : undefined
            });
        } finally {
            // Connection'ı her durumda release et
            if (connection) {
                connection.release();
            }
        }

    } catch (error) {
        console.error("Sipariş detay getirme hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası." 
        });
    }
});

module.exports = router;