const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const { authenticateToken, requireAuth, requireRole } = require("../../middleware/auth");
const { sequelize } = require("../../config/database");
const { Meal, Seller, Address, Order, OrderItem, User, Coupon, CouponUsage, CourierTask } = require("../../models");
const { Op, QueryTypes } = require("sequelize");

router.post("/", requireRole('buyer'), async (req, res) => {
    try {
        const { cart, address, paymentMethod } = req.body;
        
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

        const transaction = await sequelize.transaction();
        try {
            const firstCartItem = cart[0];
            let sellerId = null;
            if (firstCartItem?.urun?.sellerId) {
                sellerId = parseInt(firstCartItem.urun.sellerId);
            } else if (firstCartItem?.urun?.seller_id) {
                sellerId = parseInt(firstCartItem.urun.seller_id);
            } else if (firstCartItem?.sellerId) {
                sellerId = parseInt(firstCartItem.sellerId);
            }
            if (!sellerId) {
                const firstMealId = firstCartItem?.urun?.id || firstCartItem?.meal_id;
                if (firstMealId) {
                    const meal = await Meal.findByPk(firstMealId, {
                        attributes: ['seller_id'],
                        transaction
                    });
                    if (meal) {
                        sellerId = meal.seller_id;
                    }
                }
            }
            if (!sellerId) {
                await transaction.rollback();
                return res.status(400).json({ 
                    success: false, 
                    message: "Satıcı bilgisi bulunamadı. Lütfen sepete ürün ekleyin." 
                });
            }

            let addressId = typeof address === 'number' ? address : (typeof address === 'string' ? parseInt(address) : null);
            if (addressId) {
                const addressCheck = await Address.findOne({
                    where: { id: addressId, user_id: userId },
                    attributes: ['id'],
                    transaction
                });
                if (!addressCheck) {
                    addressId = null;
                }
            }
            if (!addressId) {
                const defaultAddress = await Address.findOne({
                    where: { user_id: userId, is_default: true },
                    attributes: ['id'],
                    transaction
                });
                
                if (defaultAddress) {
                    addressId = defaultAddress.id;
                } else {
                    const userInfo = await User.findByPk(userId, {
                        attributes: ['fullname', 'phone'],
                        transaction
                    });
                    
                    const newAddress = await Address.create({
                        user_id: userId,
                        title: 'Ev Adresi',
                        full_address: 'Adres bilgisi girilmemiş, lütfen profil sayfanızdan güncelleyin',
                        district: 'İstanbul',
                        city: 'İstanbul',
                        is_default: true
                    }, { transaction });
                    
                    addressId = newAddress.id;
                }
            }
            const mealIds = cart
                .map(item => item.urun?.id || item.urun?.meal_id || item.meal_id)
                .filter(id => id != null);
            
            if (mealIds.length === 0) {
                await transaction.rollback();
                return res.status(400).json({ 
                    success: false, 
                    message: "Geçersiz sepet içeriği." 
                });
            }

            const meals = await Meal.findAll({
                where: {
                    id: { [Op.in]: mealIds },
                    is_available: true
                },
                attributes: ['id', 'name', 'price'],
                transaction
            });

            const mealPriceMap = {};
            const mealNameMap = {};
            meals.forEach(meal => {
                mealPriceMap[meal.id] = parseFloat(meal.price);
                mealNameMap[meal.id] = meal.name;
            });

            const missingMeals = mealIds.filter(id => !mealPriceMap[id]);
            if (missingMeals.length > 0) {
                await transaction.rollback();
                return res.status(400).json({ 
                    success: false, 
                    message: `Bazı ürünler bulunamadı veya satışta değil. Ürün ID'leri: ${missingMeals.join(', ')}` 
                });
            }

            const seller = await Seller.findByPk(sellerId, {
                attributes: ['delivery_fee'],
                transaction
            });

            if (!seller) {
                await transaction.rollback();
                return res.status(400).json({ 
                    success: false, 
                    message: "Satıcı bilgisi bulunamadı." 
                });
            }

            let deliveryFee = parseFloat(seller.delivery_fee) || 15.00;
            let subtotal = 0;
            for (const item of cart) {
                const mealId = item.urun?.id || item.urun?.meal_id || item.meal_id;
                const quantity = item.adet || item.quantity || 1;
                const mealPrice = mealPriceMap[mealId];
                
                if (!mealPrice) {
                    await transaction.rollback();
                    return res.status(400).json({ 
                        success: false, 
                        message: `Ürün ID ${mealId} için fiyat bulunamadı.` 
                    });
                }
                
                subtotal += mealPrice * quantity;
            }
            subtotal = Math.round(subtotal * 100) / 100;
            deliveryFee = Math.round(deliveryFee * 100) / 100;
            const totalAmount = Math.round((subtotal + deliveryFee) * 100) / 100;
            const timestamp = Date.now().toString().slice(-6);
            const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
            const orderNumber = `ORD-${new Date().getFullYear()}-${timestamp}${random}`;
            const order = await Order.create({
                order_number: orderNumber,
                user_id: userId,
                seller_id: sellerId,
                address_id: addressId,
                payment_method: paymentMethod || 'credit_card',
                subtotal: subtotal.toFixed(2),
                delivery_fee: deliveryFee.toFixed(2),
                total_amount: totalAmount.toFixed(2),
                status: 'pending'
            }, { transaction });

            const orderId = order.id;
            const orderItems = [];
            for (const item of cart) {
                const mealId = item.urun?.id || item.urun?.meal_id || item.meal_id;
                const quantity = item.adet || item.quantity || 1;
                const mealPrice = mealPriceMap[mealId];
                const mealName = mealNameMap[mealId] || item.urun?.name || item.urun?.ad || "Belirtilmemiş";
                if (!mealPrice) {
                    continue;
                }
                
                const itemSubtotal = (mealPrice * quantity).toFixed(2);

                orderItems.push({
                    order_id: orderId,
                    meal_id: mealId,
                    meal_name: mealName,
                    meal_price: mealPrice.toFixed(2),
                    quantity: quantity,
                    subtotal: itemSubtotal
                });
            }
            if (orderItems.length > 0) {
                await OrderItem.bulkCreate(orderItems, { transaction });
            }
            await transaction.commit();

            res.json({ 
                success: true, 
                orderId: order.id,
                orderNumber: orderNumber,
                sellerId: sellerId,
                subtotal: subtotal.toFixed(2),
                deliveryFee: deliveryFee.toFixed(2),
                total: totalAmount.toFixed(2),
                message: "Sipariş başarıyla oluşturuldu."
            });

        } catch (dbError) {
            if (transaction && !transaction.finished) {
                await transaction.rollback();
            }
            return res.status(500).json({ 
                success: false, 
                message: "Sipariş oluşturulurken veritabanı hatası oluştu: " + dbError.message,
                error: process.env.NODE_ENV === 'development' ? dbError.message : undefined
            });
        }

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası. Sipariş oluşturulamadı." 
        });
    }
});


router.get("/active/:userId", async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        try {
            const activeOrdersData = await Order.findAll({
                where: {
                    user_id: userId,
                    status: { [Op.in]: ['pending', 'confirmed', 'preparing', 'ready', 'on_delivery'] }
                },
                include: [
                    {
                        model: Seller,
                        as: 'seller',
                        attributes: ['shop_name']
                    },
                    {
                        model: OrderItem,
                        as: 'items',
                        attributes: ['meal_name']
                    }
                ],
                order: [['created_at', 'DESC']]
            });
            const activeOrders = activeOrdersData.map(order => ({
                id: order.id,
                orderNumber: order.order_number,
                status: order.status,
                statusText: getStatusText(order.status),
                date: new Date(order.created_at).toLocaleString('tr-TR'),
                seller: order.seller?.shop_name || "Ev Lezzetleri",
                total: parseFloat(order.total_amount) || 0,
                items: order.items.map(item => item.meal_name).join(', ') || "Belirtilmemiş",
                canCancel: ['pending', 'confirmed', 'preparing', 'ready'].includes(order.status),
                canDetail: true,
                type: 'active'
            }));

            res.json({
                success: true,
                data: activeOrders
            });

        } catch (dbError) {
            res.status(500).json({ 
                success: false, 
                message: "Veritabanı hatası. Siparişler yüklenemedi." 
            });
        }

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası." 
        });
    }
});

router.get("/past/:userId", async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        try {
            const pastOrdersData = await Order.findAll({
                where: {
                    user_id: userId,
                    status: { [Op.in]: ['delivered', 'cancelled'] }
                },
                include: [
                    {
                        model: Seller,
                        as: 'seller',
                        attributes: ['shop_name']
                    },
                    {
                        model: OrderItem,
                        as: 'items',
                        attributes: ['meal_name']
                    }
                ],
                order: [['created_at', 'DESC']]
            });

            const pastOrders = pastOrdersData.map(order => ({
                id: order.id,
                orderNumber: order.order_number,
                status: order.status,
                statusText: getStatusText(order.status),
                date: new Date(order.created_at).toLocaleString('tr-TR'),
                seller: order.seller?.shop_name || "Ev Lezzetleri",
                total: parseFloat(order.total_amount) || 0,
                items: order.items.map(item => item.meal_name).join(', ') || "Belirtilmemiş",
                canRepeat: order.status === 'delivered',
                canRate: order.status === 'delivered',
                type: 'past'
            }));

            res.json({
                success: true,
                data: pastOrders
            });

        } catch (dbError) {
            res.status(500).json({ 
                success: false, 
                message: "Veritabanı hatası. Siparişler yüklenemedi." 
            });
        }

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası." 
        });
    }
});

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

router.get("/seller/orders", requireRole('seller'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { tab = 'new' } = req.query;
        const sellerRecord = await Seller.findOne({ where: { user_id: userId }, attributes: ['id'] });
        if (!sellerRecord) {
            return res.status(404).json({
                success: false,
                message: "Satıcı kaydı bulunamadı."
            });
        }
        const shopId = sellerRecord.id;
        let statuses = [];
        if (tab === 'new') {
            statuses = ['pending', 'confirmed'];
        } else if (tab === 'preparing') {
            statuses = ['preparing', 'ready'];
        } else if (tab === 'history') {
            statuses = ['delivered', 'cancelled', 'on_delivery'];
        }
        const ordersRaw = await Order.findAll({
            where: {
                seller_id: shopId,
                status: { [Op.in]: statuses }
            },
            include: [
                { model: User, as: 'buyer', attributes: ['fullname'] },
                { model: Address, as: 'address', attributes: ['district', 'city', 'full_address'], required: false },
                { model: OrderItem, as: 'items', attributes: ['quantity', 'meal_name'] },
                { model: User, as: 'courier', attributes: ['fullname'], required: false }
            ],
            order: [['created_at', 'DESC']]
        });
        const formattedOrders = ordersRaw.map(order => {
            const fullname = order.buyer?.fullname || 'Müşteri';
            const customerName = `${(fullname.charAt(0) || '')}*** ${(fullname.charAt(fullname.length - 1) || '')}`;
            const deliveryAddress = order.address ? `${order.address.district || ''}, ${order.address.city || ''}`.replace(/^,\s*|,\s*$/g, '') || order.address.full_address : `Adres ID: ${order.address_id}`;
            const itemsStr = (order.items || []).map(i => `${i.quantity} x ${i.meal_name}`).join(', ') || 'Belirtilmemiş';

            return {
                id: order.id,
                orderNumber: order.order_number,
                status: order.status,
                statusText: getStatusText(order.status),
                courierId: order.courier_id || null,
                courierName: order.courier?.fullname || null,
                date: new Date(order.created_at).toLocaleString('tr-TR'),
                customer: customerName,
                address: deliveryAddress,
                items: itemsStr,
                total: parseFloat(order.total_amount) || 0,
                subtotal: parseFloat(order.subtotal) || 0,
                deliveryFee: parseFloat(order.delivery_fee) || 0,
                discount: parseFloat(order.discount_amount) || 0
            };
        });
        
        
        res.json({
            success: true,
            orders: formattedOrders,
            tab: tab
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

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
        const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Geçersiz durum."
            });
        }
        const sellerRecord = await Seller.findOne({ where: { user_id: sellerId }, attributes: ['id'] });
        if (!sellerRecord) {
            return res.status(404).json({
                success: false,
                message: "Satıcı kaydı bulunamadı."
            });
        }
        
        const shopId = sellerRecord.id;
        
        const orderCheck = await Order.findOne({ where: { id: orderId, seller_id: shopId }, attributes: ['id'] });
        
        if (!orderCheck) {
            return res.status(404).json({
                success: false,
                message: "Sipariş bulunamadı veya size ait değil."
            });
        }
        
        if (status === 'ready') {
            try {
                    const currentOrder = await Order.findByPk(orderId, { attributes: ['courier_id', 'status'] });

                    if (currentOrder && currentOrder.courier_id !== null) {
                        await Order.update({ status }, { where: { id: orderId, seller_id: shopId } });

                        res.json({
                            success: true,
                            message: "Sipariş durumu güncellendi."
                        });
                        return;
                    }
                
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
                
                const activeCouriers = await sequelize.query(activeCouriersQuery, { type: QueryTypes.SELECT });
                
                if (activeCouriers && activeCouriers.length > 0) {
                    const randomIndex = Math.floor(Math.random() * activeCouriers.length);
                    const selectedCourier = activeCouriers[randomIndex];
                    const courierId = selectedCourier.id;
                    
                    const orderInfoRecord = await Order.findByPk(orderId, {
                        attributes: ['delivery_fee'],
                        include: [
                            { model: Seller, as: 'seller', attributes: ['shop_name'] },
                            { model: Address, as: 'address', attributes: ['district', 'city'] }
                        ]
                    });
                    await Order.update({ courier_id: courierId, status: 'on_delivery' }, { where: { id: orderId, seller_id: shopId } });
                    const existingTask = await CourierTask.findOne({ where: { order_id: orderId }, attributes: ['id'] });
                    
                    if (!existingTask && orderInfoRecord) {
                        const deliveryLocation = orderInfoRecord.seller && orderInfoRecord.address ? `${orderInfoRecord.address.district || ''}, ${orderInfoRecord.address.city || ''}`.replace(/^,\s*|,\s*$/g, '') : (orderInfoRecord.seller?.shop_name || 'Restoran');
                        await CourierTask.create({
                            order_id: orderId,
                            courier_id: courierId,
                            pickup_location: orderInfoRecord.seller?.shop_name || 'Restoran',
                            delivery_location: deliveryLocation,
                            estimated_payout: parseFloat(orderInfoRecord.delivery_fee) || 25.00,
                            status: 'assigned'
                        });
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
                } else {}
            } catch (courierError) {}
        }
        await Order.update({ status }, { where: { id: orderId, seller_id: shopId } });
        
        res.json({
            success: true,
            message: "Sipariş durumu güncellendi."
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

router.post("/seller/assign-courier/:id", requireRole('seller'), async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const userId = req.session.user.id;
        const sellerRecord = await Seller.findOne({ where: { user_id: userId }, attributes: ['id'] });
        
        if (!sellerRecord) {
            return res.status(404).json({
                success: false,
                message: "Satıcı kaydı bulunamadı."
            });
        }
        
        const shopId = sellerRecord.id;
        
        const order = await Order.findOne({ where: { id: orderId, seller_id: shopId }, attributes: ['id', 'courier_id', 'status'] });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Sipariş bulunamadı veya size ait değil."
            });
        }
        
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
        
        const activeCouriers = await sequelize.query(activeCouriersQuery, { type: QueryTypes.SELECT });
        
        if (!activeCouriers || activeCouriers.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Aktif ve boşta olan kurye bulunamadı. Lütfen daha sonra tekrar deneyin."
            });
        }
        
        const randomIndex = Math.floor(Math.random() * activeCouriers.length);
        const selectedCourier = activeCouriers[randomIndex];
        const courierId = selectedCourier.id;
        const orderInfoRecord = await Order.findByPk(orderId, {
            attributes: ['delivery_fee'],
            include: [
                { model: Seller, as: 'seller', attributes: ['shop_name'] },
                { model: Address, as: 'address', attributes: ['district', 'city'] }
            ]
        });
        
        await Order.update({ courier_id: courierId, status: 'on_delivery' }, { where: { id: orderId, seller_id: shopId } });
        
        const existingTask = await CourierTask.findOne({ where: { order_id: orderId }, attributes: ['id'] });
        
        if (!existingTask && orderInfoRecord) {
            const deliveryLocation = orderInfoRecord.seller && orderInfoRecord.address ? `${orderInfoRecord.address.district || ''}, ${orderInfoRecord.address.city || ''}`.replace(/^,\s*|,\s*$/g, '') : (orderInfoRecord.seller?.shop_name || 'Restoran');
            await CourierTask.create({
                order_id: orderId,
                courier_id: courierId,
                pickup_location: orderInfoRecord.seller?.shop_name || 'Restoran',
                delivery_location: deliveryLocation,
                estimated_payout: parseFloat(orderInfoRecord.delivery_fee) || 25.00,
                status: 'assigned'
            });
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
        res.status(500).json({
            success: false,
            message: error.message || "Sunucu hatası."
        });
    }
});

router.get("/:id", requireAuth, async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const userId = req.session?.user?.id || req.user?.id || null;
        if (isNaN(orderId) || orderId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Geçersiz sipariş ID'si."
            });
        }

        let connection;
        try {
            connection = await db.pool.getConnection();

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

            const orderUserId = order.user_id || null;
            const orderSellerId = order.seller_id || null;
            const userRole = req.session?.user?.role || req.user?.role;
            
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
            res.status(500).json({ 
                success: false, 
                message: "Veritabanı hatası. Sipariş detayı yüklenemedi.",
                error: process.env.NODE_ENV === 'development' ? dbError.message : undefined
            });
        } finally {
            if (connection) {
                connection.release();
            }
        }

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası." 
        });
    }
});

module.exports = router;