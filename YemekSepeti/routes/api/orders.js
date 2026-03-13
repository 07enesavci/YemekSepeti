const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const { authenticateToken, requireAuth, requireRole } = require("../../middleware/auth");
const { sequelize } = require("../../config/database");
const { Meal, Seller, Address, Order, OrderItem, User, Coupon, CouponUsage, CourierTask, Review } = require("../../models");
const { Op, QueryTypes } = require("sequelize");
const { createNotification } = require("../../lib/notificationHelper");

const courierPoolAnnounceLock = new Map();
const COURIER_POOL_ANNOUNCE_COOLDOWN_MS = 60 * 1000;

function isCourierPoolAnnounceLocked(orderId) {
    const key = String(orderId);
    const lastAnnouncedAt = courierPoolAnnounceLock.get(key);
    if (!lastAnnouncedAt) return false;

    if ((Date.now() - lastAnnouncedAt) > COURIER_POOL_ANNOUNCE_COOLDOWN_MS) {
        courierPoolAnnounceLock.delete(key);
        return false;
    }

    return true;
}

function lockCourierPoolAnnounce(orderId) {
    courierPoolAnnounceLock.set(String(orderId), Date.now());
}

function unlockCourierPoolAnnounce(orderId) {
    courierPoolAnnounceLock.delete(String(orderId));
}

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

function emitCourierPoolOrderAvailable(orderId, source = 'seller_notify') {
    if (!global.io || !orderId) return;

    global.io.to('couriers-available').emit('courier_order_available', {
        orderId,
        source,
        announcedAt: new Date().toISOString()
    });
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

            createNotification(userId, 'order', 'Siparişiniz alındı', `Sipariş #${orderNumber} oluşturuldu.`, order.id).catch(() => {});

            // Satıcıya Socket.IO ile yeni siparişi bildir
            if (global.io) {
                try {
                    console.log('🔔 Socket.IO emit başlıyor - Seller ID:', sellerId);
                    
                    const sellerUser = await Seller.findByPk(sellerId, {
                        attributes: ['user_id']
                    });
                    
                    console.log('   Seller bulunamadı mı?:', !sellerUser, '| User ID:', sellerUser?.user_id);
                    
                    if (sellerUser) {
                        const newOrder = await Order.findByPk(order.id, {
                            include: [
                                {
                                    model: User,
                                    as: 'buyer',
                                    attributes: ['fullname', 'phone']
                                },
                                {
                                    model: OrderItem,
                                    as: 'items',
                                    attributes: ['meal_name', 'quantity', 'meal_price', 'subtotal']
                                }
                            ]
                        });

                        if (newOrder) {
                            const roomName = `seller-${sellerUser.user_id}`;
                            console.log('   ✅ Socket.IO emit edilecek - Room:', roomName, '| Order:', newOrder.order_number);
                            
                            global.io.to(roomName).emit('new_order', {
                                id: newOrder.id,
                                orderNumber: newOrder.order_number,
                                status: newOrder.status,
                                buyerName: newOrder.buyer?.fullname || 'Müşteri',
                                buyerPhone: newOrder.buyer?.phone || '',
                                totalAmount: newOrder.total_amount,
                                subtotal: newOrder.subtotal,
                                deliveryFee: newOrder.delivery_fee,
                                items: newOrder.items || [],
                                createdAt: new Date(newOrder.created_at).toLocaleString('tr-TR')
                            });

                            const buyerRoom = `buyer-${userId}`;
                            global.io.to(buyerRoom).emit('order_placed', {
                                id: newOrder.id,
                                orderNumber: newOrder.order_number,
                                totalAmount: newOrder.total_amount,
                                message: 'Siparişiniz alındı.'
                            });
                        } else {
                            console.error('   ❌ Sipariş DB\'den yeniden çekilirken hata');
                        }
                    } else {
                        console.error('   ❌ Seller user ID bulunamadı (seller_id:', sellerId, ')');
                    }
                } catch (ioError) {
                    console.error('❌ Socket.IO emit hatası:', ioError.message, ioError.stack);
                }
            } else {
                console.warn('⚠️ global.io tanımlı değil');
            }

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

// Geçmiş bir siparişi tekrar sepete eklemek için
router.post("/:orderId/repeat", requireRole('buyer'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        const orderId = parseInt(req.params.orderId);

        if (!orderId || Number.isNaN(orderId)) {
            return res.status(400).json({
                success: false,
                message: "Geçersiz sipariş ID."
            });
        }

        const order = await Order.findOne({
            where: { id: orderId, user_id: userId },
            include: [
                {
                    model: OrderItem,
                    as: 'items',
                    attributes: ['meal_id', 'quantity']
                }
            ]
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Sipariş bulunamadı."
            });
        }

        if (order.status !== 'delivered') {
            return res.status(400).json({
                success: false,
                message: "Sadece teslim edilmiş siparişler tekrar edilebilir."
            });
        }

        const items = (order.items || [])
            .filter(i => i.meal_id && i.quantity > 0)
            .map(i => ({
                mealId: i.meal_id,
                quantity: i.quantity
            }));

        if (items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Bu siparişte tekrar eklenebilecek ürün bulunamadı."
            });
        }

        return res.json({
            success: true,
            orderId: order.id,
            items
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Sipariş tekrarlanırken bir hata oluştu."
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

router.get("/reviewable", requireRole('buyer'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        const sellerId = parseInt(req.query.seller_id);
        if (!sellerId) return res.json({ success: true, orders: [] });
        const delivered = await Order.findAll({
            where: { user_id: userId, seller_id: sellerId, status: 'delivered' },
            attributes: ['id', 'order_number', 'created_at'],
            order: [['created_at', 'DESC']]
        });
        const reviewed = await Review.findAll({
            where: { user_id: userId, seller_id: sellerId },
            attributes: ['order_id'],
            raw: true
        });
        const reviewedIds = new Set(reviewed.map(r => r.order_id));
        const list = delivered.filter(o => !reviewedIds.has(o.id)).map(o => ({
            order_id: o.id,
            order_number: o.order_number,
            date: new Date(o.created_at).toLocaleDateString('tr-TR')
        }));
        res.json({ success: true, orders: list });
    } catch (e) {
        res.status(500).json({ success: false, orders: [] });
    }
});

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
        
        const orderCheck = await Order.findOne({ where: { id: orderId, seller_id: shopId }, attributes: ['id', 'courier_id', 'status'] });
        
        if (!orderCheck) {
            return res.status(404).json({
                success: false,
                message: "Sipariş bulunamadı veya size ait değil."
            });
        }
        
        await Order.update({ status }, { where: { id: orderId, seller_id: shopId } });

        let courierPoolNotified = false;
        if (status === 'ready') {
            const refreshedOrder = await Order.findByPk(orderId, { attributes: ['id', 'courier_id', 'status'] });
            const canNotifyCourierPool = refreshedOrder &&
                refreshedOrder.status === 'ready' &&
                refreshedOrder.courier_id === null &&
                !isCourierPoolAnnounceLocked(orderId);

            if (canNotifyCourierPool) {
                emitCourierPoolOrderAvailable(orderId, 'seller_status_ready');
                lockCourierPoolAnnounce(orderId);
                courierPoolNotified = true;
            }
        }

        if (status !== 'ready') {
            unlockCourierPoolAnnounce(orderId);
        }
        const updatedOrder = await Order.findByPk(orderId, { attributes: ['user_id'] });
        const statusTitles = { confirmed: 'Sipariş onaylandı', preparing: 'Sipariş hazırlanıyor', ready: 'Sipariş hazır', on_delivery: 'Sipariş yolda', delivered: 'Sipariş teslim edildi', cancelled: 'Sipariş iptal edildi' };
        if (updatedOrder && statusTitles[status]) {
            createNotification(updatedOrder.user_id, 'order', statusTitles[status], `Sipariş #${orderId} durumu: ${statusTitles[status]}.`, orderId).catch(() => {});
        }
        await emitSellerOrderStatusChanged(orderId);
        // Socket.IO ile iptal bildirimini gönder
        if (status === 'cancelled' && global.io) {
            try {
                const cancelledOrder = await Order.findByPk(orderId, {
                    attributes: ['id', 'order_number', 'total_amount', 'created_at', 'user_id']
                });
                
                if (cancelledOrder) {
                    const sellerUser = await Seller.findByPk(shopId, { attributes: ['user_id'] });
                    if (sellerUser) {
                        const buyerUser = await User.findByPk(cancelledOrder.user_id, { attributes: ['fullname'] });
                        global.io.to(`seller-${sellerUser.user_id}`).emit('order_cancelled', {
                            id: cancelledOrder.id,
                            orderNumber: cancelledOrder.order_number,
                            status: 'cancelled',
                            buyerName: buyerUser?.fullname || 'Bilinmeyen',
                            totalAmount: parseFloat(cancelledOrder.total_amount),
                            cancelledBy: 'seller',
                            createdAt: cancelledOrder.created_at
                        });
                        console.log('🔴 SİPARİŞ İPTAL EDİLDİ (Satıcı tarafından):', cancelledOrder.order_number);
                    }
                }
            } catch (socketError) {
                console.error('Socket.IO emit hatası:', socketError);
            }
        }
        
        if (status === 'ready' && courierPoolNotified) {
            return res.json({
                success: true,
                message: "Sipariş hazırlandı ve kuryelere anlık bildirildi."
            });
        }

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

        if (isCourierPoolAnnounceLocked(orderId)) {
            return res.status(409).json({
                success: false,
                message: "Bu sipariş zaten kuryelere bildirildi. Lütfen kurye kabulünü bekleyin."
            });
        }
        
        emitCourierPoolOrderAvailable(orderId, 'seller_notify');
        lockCourierPoolAnnounce(orderId);
        await emitSellerOrderStatusChanged(orderId);
        
        res.json({
            success: true,
            message: "Sipariş kurye havuzuna bildirildi. Uygun kuryelerin ekranına anlık olarak düşürüldü."
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || "Sunucu hatası."
        });
    }
});

router.put("/:id/cancel", requireRole('buyer'), async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const userId = req.session.user.id;

        if (isNaN(orderId) || orderId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Geçersiz sipariş ID'si."
            });
        }

        const order = await Order.findOne({
            where: {
                id: orderId,
                user_id: userId
            },
            attributes: ['id', 'status']
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Sipariş bulunamadı veya size ait değil."
            });
        }

        // Sadece belirli durumlardaki siparişler iptal edilebilir
        const cancellableStatuses = ['pending', 'confirmed', 'preparing', 'ready'];
        if (!cancellableStatuses.includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: `Bu sipariş ${getStatusText(order.status)} durumunda olduğu için iptal edilemez.`
            });
        }

        await Order.update(
            { status: 'cancelled' },
            { where: { id: orderId, user_id: userId } }
        );

        // Socket.IO ile satıcıya iptal bildirimini gönder
        if (global.io) {
            try {
                const cancelledOrder = await Order.findByPk(orderId, {
                    attributes: ['id', 'order_number', 'total_amount', 'created_at', 'seller_id'],
                    include: []
                });
                
                if (cancelledOrder && cancelledOrder.seller_id) {
                    const sellerUser = await Seller.findByPk(cancelledOrder.seller_id, { attributes: ['user_id'] });
                    if (!sellerUser) {
                        throw new Error('Satıcı kullanıcı kaydı bulunamadı');
                    }

                    const buyerUser = await User.findByPk(userId, { attributes: ['fullname'] });

                    global.io.to(`seller-${sellerUser.user_id}`).emit('order_cancelled', {
                        id: cancelledOrder.id,
                        orderNumber: cancelledOrder.order_number,
                        status: 'cancelled',
                        buyerName: buyerUser?.fullname || 'Bilinmeyen',
                        totalAmount: parseFloat(cancelledOrder.total_amount),
                        cancelledBy: 'buyer',
                        createdAt: cancelledOrder.created_at
                    });
                    console.log('🔴 SİPARİŞ İPTAL EDİLDİ (Müşteri tarafından):', cancelledOrder.order_number);
                }
            } catch (socketError) {
                console.error('Socket.IO emit hatası:', socketError);
            }
        }

        res.json({
            success: true,
            message: "Sipariş başarıyla iptal edildi."
        });

    } catch (error) {
        console.error('Sipariş iptal hatası:', error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası. Sipariş iptal edilemedi."
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