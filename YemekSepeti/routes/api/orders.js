const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const Iyzipay = require("iyzipay");
const { authenticateToken, requireAuth, requireRole } = require("../../middleware/auth");
const { sequelize } = require("../../config/database");
const { Meal, Seller, Address, Order, OrderItem, User, Coupon, CouponUsage, CourierTask, Review } = require("../../models");
const { Op, QueryTypes } = require("sequelize");
const { createNotification } = require("../../lib/notificationHelper");
const { refundIyzicoPaymentForOrder } = require("../../lib/iyzicoRefund");

const iyzipay = new Iyzipay({
    apiKey: process.env.IYZICO_API_KEY || "",
    secretKey: process.env.IYZICO_SECRET_KEY || "",
    uri: process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com"
});

/**
 * iyzico: price / paidPrice, sepet kalemlerinin toplamına (2 ondalık) birebir eşit olmalıdır.
 * Ürün satırları + teslimat; kupon indirimi ürün tutarlarına orantılı yansıtılır.
 */
function buildIyzicoBasketItems({ cart, mealPriceMap, mealNameMap, deliveryFee, discountAmount, subtotal }) {
    const lines = [];
    cart.forEach((item, index) => {
        const mealId = item.urun?.id || item.urun?.meal_id || item.meal_id;
        const quantity = item.adet || item.quantity || 1;
        const unitPrice = Number(mealPriceMap[mealId] || 0);
        const mealName = mealNameMap[mealId] || item.urun?.name || item.urun?.ad || `Urun ${index + 1}`;
        const lineTotal = Math.round(unitPrice * quantity * 100) / 100;
        lines.push({
            id: String(mealId || index + 1),
            name: mealName,
            lineTotal
        });
    });

    const foodAfterDiscount = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
    const basketItems = [];

    if (subtotal > 0 && discountAmount > 0) {
        let allocated = 0;
        lines.forEach((line, idx) => {
            const isLast = idx === lines.length - 1;
            const share = isLast
                ? Math.round((foodAfterDiscount - allocated) * 100) / 100
                : Math.round((line.lineTotal / subtotal) * foodAfterDiscount * 100) / 100;
            allocated += share;
            basketItems.push({
                id: line.id,
                name: line.name,
                category1: "Yemek",
                itemType: "PHYSICAL",
                price: share.toFixed(2)
            });
        });
    } else {
        lines.forEach((line) => {
            basketItems.push({
                id: line.id,
                name: line.name,
                category1: "Yemek",
                itemType: "PHYSICAL",
                price: line.lineTotal.toFixed(2)
            });
        });
    }

    if (deliveryFee > 0) {
        basketItems.push({
            id: "delivery-fee",
            name: "Teslimat Ucreti",
            category1: "Hizmet",
            itemType: "PHYSICAL",
            price: deliveryFee.toFixed(2)
        });
    }

    const target = Math.round((subtotal - discountAmount + deliveryFee) * 100) / 100;
    let sumBasket = basketItems.reduce((s, x) => s + parseFloat(x.price), 0);
    sumBasket = Math.round(sumBasket * 100) / 100;
    const drift = Math.round((target - sumBasket) * 100) / 100;
    if (Math.abs(drift) >= 0.001 && basketItems.length > 0) {
        const last = basketItems[basketItems.length - 1];
        last.price = (parseFloat(last.price) + drift).toFixed(2);
    }

    return basketItems;
}

function isDeadlockError(err) {
    const code = err?.parent?.code || err?.original?.code;
    const errno = err?.parent?.errno ?? err?.original?.errno ?? err?.errno;
    const msg = String(err?.message || "");
    return code === "ER_LOCK_DEADLOCK" || errno === 1213 || msg.includes("Deadlock");
}

router.post("/", requireRole('buyer'), async (req, res) => {
    try {
        const { cart, address, paymentMethod, couponCode, iyzicoCard, deliveryType } = req.body;
    const finalDeliveryType = (deliveryType === 'pickup') ? 'pickup' : 'delivery';

        
        const userId = req.session.user.id;

        if (!cart || !Array.isArray(cart) || cart.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Sepet boş olamaz." 
            });
        }

        if (!address && finalDeliveryType !== 'pickup') {
            return res.status(400).json({ 
                success: false, 
                message: "Adres bilgisi gereklidir." 
            });
        }

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
                        attributes: ['seller_id']
                    });
                    if (meal) {
                        sellerId = meal.seller_id;
                    }
                }
            }
            if (!sellerId) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Satıcı bilgisi bulunamadı. Lütfen sepete ürün ekleyin." 
                });
            }

            let addressId = typeof address === 'number' ? address : (typeof address === 'string' ? parseInt(address) : null);
            if (finalDeliveryType === 'pickup') {
                addressId = null;
            } else {
                if (addressId) {
                    const addressCheck = await Address.findOne({
                        where: { id: addressId, user_id: userId },
                        attributes: ['id']
                    });
                    if (!addressCheck) {
                        addressId = null;
                    }
                }
                if (!addressId) {
                    const defaultAddress = await Address.findOne({
                        where: { user_id: userId, is_default: true },
                        attributes: ['id']
                    });
                    
                    if (defaultAddress) {
                        addressId = defaultAddress.id;
                    } else {
                        const userInfo = await User.findByPk(userId, {
                            attributes: ['fullname', 'phone']
                        });
                        
                        const newAddress = await Address.create({
                            user_id: userId,
                            title: 'Ev Adresi',
                            full_address: 'Adres bilgisi girilmemiş, lütfen profil sayfanızdan güncelleyin',
                            district: 'İstanbul',
                            city: 'İstanbul',
                            is_default: true
                        });
                        
                        addressId = newAddress.id;
                    }
                }
            }
            const mealIds = cart
                .map(item => item.urun?.id || item.urun?.meal_id || item.meal_id)
                .filter(id => id != null);
            
            if (mealIds.length === 0) {
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
                attributes: ['id', 'name', 'price']
            });

            const mealPriceMap = {};
            const mealNameMap = {};
            meals.forEach(meal => {
                mealPriceMap[meal.id] = parseFloat(meal.price);
                mealNameMap[meal.id] = meal.name;
            });

            const missingMeals = mealIds.filter(id => !mealPriceMap[id]);
            if (missingMeals.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Bazı ürünler bulunamadı veya satışta değil. Ürün ID'leri: ${missingMeals.join(', ')}` 
                });
            }

            const seller = await Seller.findByPk(sellerId, {
                attributes: ['delivery_fee', 'is_open']
            });

            if (!seller) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Satıcı bilgisi bulunamadı." 
                });
            }

            if (seller.is_open === false || seller.is_open === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Üzgünüz, bu dükkan şu an kapalı olduğu için sipariş alamıyor." 
                });
            }

            let deliveryFee = parseFloat(seller.delivery_fee) || 15.00;
            let subtotal = 0;
            for (const item of cart) {
                const mealId = item.urun?.id || item.urun?.meal_id || item.meal_id;
                const quantity = item.adet || item.quantity || 1;
                const mealPrice = mealPriceMap[mealId];
                
                if (!mealPrice) {
                    return res.status(400).json({ 
                        success: false, 
                        message: `Ürün ID ${mealId} için fiyat bulunamadı.` 
                    });
                }
                
                subtotal += mealPrice * quantity;
            }
            subtotal = Math.round(subtotal * 100) / 100;
            if (finalDeliveryType === 'pickup') {
                deliveryFee = 0;
            } else {
                deliveryFee = Math.round(deliveryFee * 100) / 100;
            }
            const totalAmount = Math.round((subtotal + deliveryFee) * 100) / 100;
            
            // Kupon validasyonu ve uygulaması
            let discountAmount = 0;
            let appliedCouponCode = null;
            let appliedCouponId = null;
            
            if (couponCode && couponCode.trim() !== '') {
                try {
                    const coupon = await Coupon.findOne({
                        where: {
                            code: couponCode.toUpperCase().trim(),
                            is_active: true
                        }
                    });
                    
                    if (!coupon) {
                        return res.status(400).json({
                            success: false,
                            message: "Geçersiz kupon kodu."
                        });
                    }
                    
                    // Zaman validasyonu
                    const now = new Date();
                    const validFrom = new Date(coupon.valid_from);
                    const validUntil = new Date(coupon.valid_until);
                    validUntil.setHours(23, 59, 59, 999);
                    
                    if (now < validFrom) {
                        return res.status(400).json({
                            success: false,
                            message: "Bu kupon henüz geçerli değil."
                        });
                    }
                    
                    if (now > validUntil) {
                        return res.status(400).json({
                            success: false,
                            message: "Bu kupon süresi dolmuş."
                        });
                    }
                    
                    // Minimum tutar kontrolü
                    if (parseFloat(subtotal) < parseFloat(coupon.min_order_amount || 0)) {
                        return res.status(400).json({
                            success: false,
                            message: `Bu kupon minimum ${parseFloat(coupon.min_order_amount)} TL sipariş için geçerlidir.`
                        });
                    }
                    
                    // Satıcı kontrolü - tüm roller için uygulanabilir (applicable_seller_ids null ise)
                    if (coupon.applicable_seller_ids && sellerId) {
                        let applicableSellers = [];
                        try {
                            applicableSellers = typeof coupon.applicable_seller_ids === 'string' 
                                ? JSON.parse(coupon.applicable_seller_ids) 
                                : coupon.applicable_seller_ids;
                        } catch (e) {
                            applicableSellers = [];
                        }
                        
                        if (Array.isArray(applicableSellers) && applicableSellers.length > 0) {
                            const sellerIdNum = parseInt(sellerId);
                            if (!applicableSellers.includes(sellerIdNum)) {
                                return res.status(400).json({
                                    success: false,
                                    message: "Bu kupon bu satıcı için geçerli değil."
                                });
                            }
                        }
                    }
                    
                    // Kullanım limiti kontrolü
                    if (coupon.usage_limit > 0) {
                        const actualUsageCount = await CouponUsage.count({
                            where: { coupon_id: coupon.id }
                        });
                        
                        if (actualUsageCount >= coupon.usage_limit) {
                            return res.status(400).json({
                                success: false,
                                message: "Bu kupon kullanım limiti dolmuş."
                            });
                        }
                    }
                    
                    // İndirim tutarı hesapla
                    if (coupon.discount_type === 'percentage') {
                        discountAmount = (parseFloat(subtotal) * parseFloat(coupon.discount_value)) / 100;
                        if (coupon.max_discount_amount) {
                            discountAmount = Math.min(discountAmount, parseFloat(coupon.max_discount_amount));
                        }
                    } else {
                        discountAmount = parseFloat(coupon.discount_value);
                    }
                    
                    discountAmount = Math.min(discountAmount, parseFloat(subtotal));
                    discountAmount = Math.round(discountAmount * 100) / 100;
                    
                    appliedCouponCode = coupon.code;
                    appliedCouponId = coupon.id;
                    
                    console.log(`✅ Kupon uygulandı: ${coupon.code}, İndirim: ${discountAmount} TL`);
                } catch (couponError) {
                    console.error('Kupon işleme hatası:', couponError.message);
                    // Kupon hatası sipariş oluşturmayı durdurmaz (warning olarak davran)
                    if (couponError.name === 'SequelizeError' || couponError.name === 'ValidationError') {
                        return res.status(500).json({
                            success: false,
                            message: "Kupon validasyonu sırasında bir hata oluştu."
                        });
                    }
                }
            }
            
            const finalTotal = Math.round((totalAmount - discountAmount) * 100) / 100;
            let iyzicoPaymentData = null;

            if ((paymentMethod || "credit_card") === "iyzico") {
                if (!process.env.IYZICO_API_KEY || !process.env.IYZICO_SECRET_KEY) {
                    return res.status(500).json({
                        success: false,
                        message: "iyzico yapılandırması eksik. API anahtarlarını .env dosyasına ekleyin."
                    });
                }

                if (!iyzicoCard || !iyzicoCard.cardHolderName || !iyzicoCard.cardNumber || !iyzicoCard.expireMonth || !iyzicoCard.expireYear || !iyzicoCard.cvc) {
                    return res.status(400).json({
                        success: false,
                        message: "iyzico kart bilgileri eksik."
                    });
                }

                const selectedAddress = await Address.findByPk(addressId);
                const buyerUser = await User.findByPk(userId, {
                    attributes: ['fullname', 'phone', 'email', 'created_at']
                });

                const fullname = (buyerUser?.fullname || "Musteri").trim();
                const [firstName, ...surnameParts] = fullname.split(" ");
                const surname = surnameParts.length ? surnameParts.join(" ") : "Musteri";
                const gsmNumber = (buyerUser?.phone || "+905555555555").startsWith("+")
                    ? buyerUser.phone
                    : `+9${(buyerUser?.phone || "05555555555").replace(/\D/g, "")}`;

                const basketItems = buildIyzicoBasketItems({
                    cart,
                    mealPriceMap,
                    mealNameMap,
                    deliveryFee,
                    discountAmount,
                    subtotal
                });

                const paymentRequest = {
                    locale: Iyzipay.LOCALE.TR,
                    conversationId: `ORDER-${userId}-${Date.now()}`,
                    price: finalTotal.toFixed(2),
                    paidPrice: finalTotal.toFixed(2),
                    currency: Iyzipay.CURRENCY.TRY,
                    installment: "1",
                    basketId: `BASKET-${userId}-${Date.now()}`,
                    paymentChannel: Iyzipay.PAYMENT_CHANNEL.WEB,
                    paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
                    paymentCard: {
                        cardHolderName: iyzicoCard.cardHolderName,
                        cardNumber: String(iyzicoCard.cardNumber).replace(/\s/g, ""),
                        expireMonth: String(iyzicoCard.expireMonth).padStart(2, '0'),
                        expireYear: String(iyzicoCard.expireYear).slice(-2),
                        cvc: String(iyzicoCard.cvc),
                        registerCard: '0'
                    },
                    buyer: {
                        id: String(userId),
                        name: firstName || "Musteri",
                        surname,
                        gsmNumber,
                        email: buyerUser?.email || "test@example.com",
                        identityNumber: "11111111111",
                        lastLoginDate: new Date().toISOString().replace("T", " ").slice(0, 19),
                        registrationDate: new Date(buyerUser?.created_at || Date.now()).toISOString().replace("T", " ").slice(0, 19),
                        registrationAddress: selectedAddress?.full_address || selectedAddress?.detail || "Adres",
                        ip: req.ip || "85.34.78.112",
                        city: selectedAddress?.city || "Istanbul",
                        country: "Turkey",
                        zipCode: selectedAddress?.postal_code || "34000"
                    },
                    shippingAddress: {
                        contactName: fullname,
                        city: selectedAddress?.city || "Istanbul",
                        country: "Turkey",
                        address: selectedAddress?.full_address || selectedAddress?.detail || "Adres",
                        zipCode: selectedAddress?.postal_code || "34000"
                    },
                    billingAddress: {
                        contactName: fullname,
                        city: selectedAddress?.city || "Istanbul",
                        country: "Turkey",
                        address: selectedAddress?.full_address || selectedAddress?.detail || "Adres",
                        zipCode: selectedAddress?.postal_code || "34000"
                    },
                    basketItems
                };

                const paymentResult = await new Promise((resolve, reject) => {
                    iyzipay.payment.create(paymentRequest, (err, result) => {
                        if (err) return reject(err);
                        return resolve(result);
                    });
                });

                if (!paymentResult || paymentResult.status !== "success") {
                    return res.status(400).json({
                        success: false,
                        message: paymentResult?.errorMessage || "iyzico ödeme başarısız."
                    });
                }
                iyzicoPaymentData = JSON.stringify({
                    paymentId: paymentResult.paymentId,
                    conversationId: paymentResult.conversationId,
                    itemTransactions: (paymentResult.itemTransactions || []).map((t) => ({
                        paymentTransactionId: t.paymentTransactionId,
                        paidPrice: t.paidPrice != null ? String(t.paidPrice) : String(t.price)
                    }))
                });
            }
            const MAX_ORDER_ATTEMPTS = 3;
            let order = null;
            let orderNumber = null;
            let lastDbError = null;

            for (let attempt = 0; attempt < MAX_ORDER_ATTEMPTS; attempt++) {
                const transaction = await sequelize.transaction();
                try {
                    if (appliedCouponId && discountAmount > 0) {
                        const couponRow = await Coupon.findByPk(appliedCouponId, { transaction });
                        if (!couponRow) {
                            await transaction.rollback();
                            return res.status(400).json({
                                success: false,
                                message: "Kupon bulunamadı."
                            });
                        }
                        if (couponRow.usage_limit > 0) {
                            const usageNow = await CouponUsage.count({
                                where: { coupon_id: appliedCouponId },
                                transaction
                            });
                            if (usageNow >= couponRow.usage_limit) {
                                await transaction.rollback();
                                return res.status(400).json({
                                    success: false,
                                    message: "Bu kupon kullanım limiti dolmuş."
                                });
                            }
                        }
                    }

                    const timestamp = Date.now().toString().slice(-6);
                    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                    orderNumber = `ORD-${new Date().getFullYear()}-${timestamp}${random}`;
                    order = await Order.create({
                        order_number: orderNumber,
                        user_id: userId,
                        seller_id: sellerId,
                        address_id: addressId,
                        delivery_type: finalDeliveryType,
                        payment_method: paymentMethod || 'credit_card',
                        subtotal: subtotal.toFixed(2),
                        delivery_fee: deliveryFee.toFixed(2),
                        discount_amount: discountAmount.toFixed(2),
                        coupon_code: appliedCouponCode,
                        total_amount: finalTotal.toFixed(2),
                        status: 'pending',
                        iyzico_payment_data: iyzicoPaymentData
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

                    if (appliedCouponId && discountAmount > 0) {
                        await CouponUsage.create({
                            coupon_id: appliedCouponId,
                            order_id: orderId,
                            user_id: userId,
                            discount_amount: discountAmount.toFixed(2)
                        }, { transaction });

                        await Coupon.increment('used_count', {
                            by: 1,
                            where: { id: appliedCouponId },
                            transaction
                        });

                        console.log(`✅ CouponUsage kaydı oluşturuldu - Order: ${orderId}, Discount: ${discountAmount} TL`);
                    }

                    await transaction.commit();
                    lastDbError = null;
                    break;
                } catch (dbErr) {
                    await transaction.rollback();
                    if (isDeadlockError(dbErr) && attempt < MAX_ORDER_ATTEMPTS - 1) {
                        lastDbError = dbErr;
                        await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
                        continue;
                    }
                    lastDbError = dbErr;
                    break;
                }
            }

            if (lastDbError || !order) {
                return res.status(500).json({
                    success: false,
                    message: "Sipariş oluşturulurken veritabanı hatası oluştu: " + (lastDbError && lastDbError.message ? lastDbError.message : "Bilinmeyen hata"),
                    error: process.env.NODE_ENV === 'development' && lastDbError ? lastDbError.message : undefined
                });
            }

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
                                discountAmount: newOrder.discount_amount,
                                couponCode: newOrder.coupon_code,
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
                discountAmount: discountAmount.toFixed(2),
                couponCode: appliedCouponCode,
                total: finalTotal.toFixed(2),
                message: "Sipariş başarıyla oluşturuldu."
            });

        } catch (routeError) {
            return res.status(500).json({ 
                success: false, 
                message: "Sipariş oluşturulurken veritabanı hatası oluştu: " + (routeError && routeError.message ? routeError.message : String(routeError)),
                error: process.env.NODE_ENV === 'development' ? (routeError && routeError.message) : undefined
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
            const deliveryTypeDisplay = order.delivery_type === 'pickup' ? '<span class="badge badge-warning" style="background:#f39c12;color:white;padding:2px 6px;border-radius:4px;font-size:0.8rem;">Gel Al</span>' : '';
            const deliveryAddress = order.delivery_type === 'pickup' ? 'Gel Al (Mağazadan Teslim)' : (order.address ? `${order.address.district || ''}, ${order.address.city || ''}`.replace(/^,\s*|,\s*$/g, '') || order.address.full_address : `Adres ID: ${order.address_id}`);
            const customerNameWithBadge = deliveryTypeDisplay ? `${customerName} ${deliveryTypeDisplay}` : customerName;
            const itemsStr = (order.items || []).map(i => `${i.quantity} x ${i.meal_name}`).join(', ') || 'Belirtilmemiş';

            return {
                id: order.id,
                orderNumber: order.order_number,
                status: order.status,
                deliveryType: order.delivery_type,
                statusText: getStatusText(order.status),
                courierId: order.courier_id || null,
                courierName: order.courier?.fullname || null,
                date: new Date(order.created_at).toLocaleString('tr-TR'),
                customer: customerNameWithBadge,
                address: deliveryAddress,
                items: itemsStr,
                total: parseFloat(order.total_amount) || 0,
                subtotal: parseFloat(order.subtotal) || 0,
                deliveryFee: parseFloat(order.delivery_fee) || 0,
                discount: parseFloat(order.discount_amount) || 0,
                couponCode: order.coupon_code || null
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
        const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
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
            } catch (courierError) {
                console.error('Kurye kontrol hatası:', courierError);
            }
        }
        if (status === 'cancelled') {
            const fullOrder = await Order.findByPk(orderId, {
                attributes: ['id', 'courier_id', 'payment_method', 'iyzico_payment_data', 'iyzico_refunded_at', 'order_number', 'seller_id']
            });
            if (fullOrder && fullOrder.seller_id === shopId) {
                if (fullOrder.courier_id) {
                    await CourierTask.update({ status: 'cancelled' }, { where: { order_id: orderId } });
                    if (global.io) {
                        global.io.to(`courier-${fullOrder.courier_id}`).emit('order_cancelled', {
                            id: fullOrder.id,
                            orderNumber: fullOrder.order_number,
                            status: 'cancelled',
                            message: 'Sipariş iptal edildi.'
                        });
                    }
                }
                if (fullOrder.payment_method === 'iyzico' && fullOrder.iyzico_payment_data && !fullOrder.iyzico_refunded_at) {
                    try {
                        await refundIyzicoPaymentForOrder(fullOrder, req.ip);
                        await Order.update(
                            { iyzico_refunded_at: new Date() },
                            { where: { id: orderId, seller_id: shopId } }
                        );
                    } catch (refErr) {
                        console.error('iyzico iade hatası (satıcı iptal):', refErr);
                        return res.status(502).json({
                            success: false,
                            message: "Ödeme iadesi tamamlanamadı. Sipariş iptal edilmedi. " + (refErr.message || '')
                        });
                    }
                }
            }
        }
        const updateData = { status };
        if (status === 'delivered') {
            updateData.delivered_at = new Date();
        }
        await Order.update(updateData, { where: { id: orderId, seller_id: shopId } });
        const updatedOrder = await Order.findByPk(orderId, { attributes: ['user_id', 'order_number', 'courier_id', 'delivery_type'] });
        
        if (status === 'ready' && updatedOrder && updatedOrder.courier_id === null && updatedOrder.delivery_type !== 'pickup' && global.io) {
            global.io.emit('order_pool_added', { orderId: orderId });
        }
        const statusTitles = { confirmed: 'Sipariş onaylandı', preparing: 'Sipariş hazırlanıyor', ready: 'Sipariş hazır', on_delivery: 'Sipariş yolda', delivered: 'Sipariş teslim edildi', cancelled: 'Sipariş iptal edildi' };
        if (updatedOrder && statusTitles[status]) {
            createNotification(updatedOrder.user_id, 'order', statusTitles[status], `Sipariş #${orderId} durumu: ${statusTitles[status]}.`, orderId).catch(() => {});
            
            if (global.io) {
                global.io.to(`buyer-${updatedOrder.user_id}`).emit('order_status_updated', {
                    orderId: orderId,
                    status: status,
                    orderNumber: updatedOrder.order_number
                });
            }
        }
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
            return res.status(404).json({ success: false, message: "Satıcı kaydı bulunamadı." });
        }
        
        const shopId = sellerRecord.id;
        const order = await Order.findOne({ where: { id: orderId, seller_id: shopId }, attributes: ['id', 'courier_id', 'status'] });

        if (!order) {
            return res.status(404).json({ success: false, message: "Sipariş bulunamadı veya size ait değil." });
        }
        
        if (order.status !== 'ready') {
            return res.status(400).json({ success: false, message: "Sipariş hazır durumunda değil. Önce siparişi hazır durumuna getirin." });
        }
        
        if (order.courier_id !== null) {
            return res.status(400).json({ success: false, message: "Bu sipariş zaten bir kuryeye atanmış." });
        }
        
        if (global.io) {
            global.io.emit('order_pool_added', { orderId: orderId });
        }
        
        res.json({
            success: true,
            message: "Sipariş havuzda yayınlanmaktadır. Çevredeki kuryelerin siparişi teslim alması bekleniyor.",
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
            attributes: ['id', 'status', 'courier_id', 'payment_method', 'iyzico_payment_data', 'iyzico_refunded_at', 'order_number']
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Sipariş bulunamadı veya size ait değil."
            });
        }

        // Sadece belirli durumlardaki siparişler iptal edilebilir
        const cancellableStatuses = ['pending', 'confirmed'];
        if (!cancellableStatuses.includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: `Bu sipariş ${getStatusText(order.status)} durumunda olduğu için tarafınızca iptal edilemez. Lütfen destek talebi oluşturun.`
            });
        }

        if (order.payment_method === 'iyzico' && order.iyzico_payment_data && !order.iyzico_refunded_at) {
            try {
                await refundIyzicoPaymentForOrder(order, req.ip);
                await Order.update(
                    { iyzico_refunded_at: new Date() },
                    { where: { id: orderId, user_id: userId } }
                );
            } catch (refErr) {
                console.error('iyzico iade hatası:', refErr);
                return res.status(502).json({
                    success: false,
                    message: "Ödeme iadesi tamamlanamadı. Sipariş iptal edilmedi. " + (refErr.message || '')
                });
            }
        }

        await Order.update(
            { status: 'cancelled' },
            { where: { id: orderId, user_id: userId } }
        );

        if (order.courier_id) {
            await CourierTask.update({ status: 'cancelled' }, { where: { order_id: orderId } });
            if (global.io) {
                global.io.to(`courier-${order.courier_id}`).emit('order_cancelled', { id: orderId, orderNumber: order.order_number, status: 'cancelled' });
            }
        }

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
                    o.delivery_type,
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
                    a.postal_code,
                    a.latitude as address_latitude,
                    a.longitude as address_longitude,
                    ct.courier_latitude,
                    ct.courier_longitude
                FROM orders o
                LEFT JOIN sellers s ON o.seller_id = s.id
                LEFT JOIN users u ON o.user_id = u.id
                LEFT JOIN users u_seller ON s.user_id = u_seller.id
                LEFT JOIN addresses a ON o.address_id = a.id
                LEFT JOIN courier_tasks ct ON ct.order_id = o.id
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
                deliveryType: order.delivery_type || 'delivery',
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
                        : 'Adres bilgisi yok'),
                    latitude: order.address_latitude != null ? parseFloat(order.address_latitude) : null,
                    longitude: order.address_longitude != null ? parseFloat(order.address_longitude) : null
                },
                courierLatitude: order.courier_latitude != null ? parseFloat(order.courier_latitude) : null,
                courierLongitude: order.courier_longitude != null ? parseFloat(order.courier_longitude) : null,
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