const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const Iyzipay = require("iyzipay");
const { authenticateToken, requireAuth, requireRole } = require("../../middleware/auth");
const { sequelize } = require("../../config/database");
const { Meal, Seller, Address, Order, OrderItem, User, Coupon, CouponUsage, CourierTask, Review, Courier } = require("../../models");
const { Op, QueryTypes } = require("sequelize");
const { createNotification } = require("../../lib/notificationHelper");
const { refundIyzicoPaymentForOrder, refundIyzicoPaymentPartial } = require("../../lib/iyzicoRefund");
const { decryptText } = require("../../lib/cardCrypto");
const { sendPickupReadyEmail } = require("../../config/email");
const { computeCargoFee } = require("../../lib/cargoPricing");
const { buildCargoTracking, isKnownCarrier } = require("../../lib/cargoCarriers");
const { evaluateCargo } = require("../../lib/cargoGeo");

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
        const { cart, address, paymentMethod, couponCode, iyzicoCard, iyzicoSavedCardId, iyzicoSavedCardCvc, deliveryType, cashPaymentMethod } = req.body;
        // isCargoOrder (ürünlerin uzak mesafe olması) belirlendikten sonra 'cargo'ya sabitlenir
        let finalDeliveryType = (deliveryType === 'pickup') ? 'pickup' : (deliveryType === 'cargo') ? 'cargo' : 'delivery';
        const finalCashPaymentMethod = paymentMethod === 'cash'
            ? (cashPaymentMethod === 'card' ? 'card' : 'cash')
            : null;

        const userId = req.session.user.id;

        if (!cart || !Array.isArray(cart) || cart.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Sepet boş olamaz."
            });
        }

        for (const cartItem of cart) {
            const q = Number(cartItem?.adet ?? cartItem?.quantity ?? 1);
            if (!Number.isInteger(q) || q < 1 || q > 50) {
                return res.status(400).json({
                    success: false,
                    message: "Sepetteki ürün adetleri 1-50 arasında tam sayı olmalıdır."
                });
            }
        }

        // Wallet ödeme yöntemi henüz desteklenmiyor
        if ((paymentMethod || '') === 'wallet') {
            return res.status(400).json({
                success: false,
                message: "Cüzdan ile ödeme şu an aktif değil. Lütfen başka bir ödeme yöntemi seçin."
            });
        }

        if (!address && finalDeliveryType !== 'pickup' && finalDeliveryType !== 'cargo') {
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
                        // Sahte adres oluşturmak yerine kullanıcıyı bilgilendir
                        return res.status(400).json({
                            success: false,
                            message: "Teslimat adresi bulunamadı. Lütfen önce profilinizden bir adres ekleyin."
                        });
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
                    is_available: true,
                    is_approved: true
                },
                attributes: ['id', 'name', 'price', 'is_uzak_mesafe', 'seller_id', 'stock_quantity', 'cargo_weight_desi']
            });

            const mealPriceMap = {};
            const mealNameMap = {};
            const mealStockMap = {};
            const mealWeightMap = {};
            meals.forEach(meal => {
                mealPriceMap[meal.id] = parseFloat(meal.price);
                mealNameMap[meal.id] = meal.name;
                mealStockMap[meal.id] = meal.stock_quantity;
                mealWeightMap[meal.id] = parseFloat(meal.cargo_weight_desi) || 0;
            });

            // Karışık sepet kontrolü
            if (meals.length > 0) {
                const firstIsUzakMesafe = !!meals[0].is_uzak_mesafe;
                const mixedProducts = meals.filter(m => !!m.is_uzak_mesafe !== firstIsUzakMesafe);
                if (mixedProducts.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: "Kargo ürünleri (Uzak Mesafe) ile normal ürünler aynı siparişte bulunamaz. Lütfen sepetinizi düzenleyin."
                    });
                }
            }

            // Karışık satıcı kontrolü
            if (meals.length > 0) {
                const firstSellerId = meals[0].seller_id;
                const mixedSellers = meals.filter(m => m.seller_id !== firstSellerId);
                if (mixedSellers.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: "Farklı restoranlardan ürünler aynı siparişte bulunamaz. Lütfen sepetinizi düzenleyin."
                    });
                }
            }
            
            const isCargoOrder = meals.length > 0 && !!meals[0].is_uzak_mesafe;
            // Uzak mesafe ürünü içeren sipariş her zaman kargo olmalı — kurye akışına düşmesin
            if (isCargoOrder) finalDeliveryType = 'cargo';

            const missingMeals = mealIds.filter(id => !mealPriceMap[id]);
            if (missingMeals.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Bazı ürünler bulunamadı veya satışta değil. Ürün ID'leri: ${missingMeals.join(', ')}` 
                });
            }

            const seller = await Seller.findByPk(sellerId, {
                attributes: ['delivery_fee', 'is_open', 'pickup_enabled', 'opening_hours', 'location', 'latitude', 'longitude',
                    'cargo_pricing_mode', 'cargo_fee', 'cargo_free_threshold', 'cargo_fee_per_100km', 'cargo_regions', 'cargo_max_distance_km', 'cargo_fee_per_desi']
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

            // Çalışma saatleri kontrolü (opening_hours JSON: { monday: { open: "09:00", close: "22:00" }, ... })
            if (seller.opening_hours) {
                try {
                    const hours = typeof seller.opening_hours === 'string'
                        ? JSON.parse(seller.opening_hours)
                        : seller.opening_hours;
                    const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
                    const now = new Date();
                    const dayKey = dayNames[now.getDay()];
                    const daySchedule = hours[dayKey];
                    if (daySchedule && daySchedule.open && daySchedule.close && !daySchedule.closed) {
                        const [openH, openM] = daySchedule.open.split(':').map(Number);
                        const [closeH, closeM] = daySchedule.close.split(':').map(Number);
                        const currentMinutes = now.getHours() * 60 + now.getMinutes();
                        const openMinutes = openH * 60 + openM;
                        const closeMinutes = closeH * 60 + closeM;
                        if (currentMinutes < openMinutes || currentMinutes > closeMinutes) {
                            return res.status(400).json({
                                success: false,
                                message: `Bu dükkan şu an kapalı. Çalışma saatleri: ${daySchedule.open} - ${daySchedule.close}`
                            });
                        }
                    } else if (daySchedule && daySchedule.closed) {
                        return res.status(400).json({
                            success: false,
                            message: "Bu dükkan bugün kapalı."
                        });
                    }
                } catch (e) { /* opening_hours parse hatası — geç */ }
            }

            const pickupAllowed = seller.pickup_enabled !== false && seller.pickup_enabled !== 0;
            if (finalDeliveryType === 'pickup' && !pickupAllowed) {
                return res.status(400).json({
                    success: false,
                    message: "Bu restoran mağazadan teslim (Gel Al) siparişi kabul etmiyor."
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

                const stockQty = mealStockMap[mealId];
                if (stockQty !== -1 && stockQty != null && stockQty < quantity) {
                    return res.status(400).json({
                        success: false,
                        message: `${mealNameMap[mealId] || 'Ürün'} için yeterli stok yok (mevcut: ${stockQty}).`
                    });
                }

                subtotal += mealPrice * quantity;
            }
            subtotal = Math.round(subtotal * 100) / 100;
            if (finalDeliveryType === 'pickup') {
                deliveryFee = 0; // gel al — teslimat ücreti yok
            } else if (finalDeliveryType === 'cargo' || isCargoOrder) {
                // Kargo ücreti + bölge/mesafe uygunluğu satıcının ayarına göre değerlendirilir
                let destForCargo = null;
                if (addressId) {
                    const cargoAddr = await Address.findByPk(addressId, {
                        attributes: ['city', 'district', 'latitude', 'longitude']
                    });
                    if (cargoAddr) {
                        destForCargo = {
                            city: cargoAddr.city,
                            lat: cargoAddr.latitude,
                            lng: cargoAddr.longitude
                        };
                    }
                }
                // Ağırlık bazlı (by_weight) için sepetteki toplam desiyi hesapla
                let totalDesi = 0;
                for (const item of cart) {
                    const mid = item.urun?.id || item.urun?.meal_id || item.meal_id;
                    const qty = item.adet || item.quantity || 1;
                    totalDesi += (mealWeightMap[mid] || 0) * qty;
                }
                totalDesi = Math.round(totalDesi * 100) / 100;
                const cargoEval = evaluateCargo(seller, destForCargo || {}, subtotal, totalDesi);
                if (!cargoEval.eligible) {
                    return res.status(400).json({ success: false, message: cargoEval.message || "Bu adrese kargo gönderilemiyor." });
                }
                deliveryFee = cargoEval.fee;
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
                    
                    // Kullanım limiti kontrolü (-1 = sınırsız, 0 = devre dışı, >0 = limitli)
                    if (coupon.usage_limit === 0) {
                        return res.status(400).json({
                            success: false,
                            message: "Bu kupon artık kullanılamaz."
                        });
                    }
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

                    // Kişi başı kullanım limiti kontrolü
                    const perUserLimit = coupon.per_user_limit !== undefined && coupon.per_user_limit !== null ? coupon.per_user_limit : 1;
                    if (perUserLimit !== -1) {
                        const userUsageCount = await CouponUsage.count({
                            where: { coupon_id: coupon.id, user_id: userId }
                        });
                        if (userUsageCount >= perUserLimit) {
                            return res.status(400).json({
                                success: false,
                                message: perUserLimit === 1
                                    ? "Bu kuponu daha önce kullandınız."
                                    : `Bu kuponu en fazla ${perUserLimit} kez kullanabilirsiniz.`
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
                    discountAmount = Math.max(0, discountAmount); // negatif max_discount_amount güvenlik sınırı
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

            // İdempotency: aynı kullanıcı/satıcı için son 30 saniyede aynı tutarda oluşturulmuş bir
            // sipariş varsa (çift tıklama / istemci retry'ı), yeniden ödeme almadan o siparişi döndür.
            try {
                const recentDuplicate = await Order.findOne({
                    where: {
                        user_id: userId,
                        seller_id: sellerId,
                        total_amount: finalTotal.toFixed(2),
                        created_at: { [Op.gte]: new Date(Date.now() - 30 * 1000) }
                    },
                    order: [['created_at', 'DESC']],
                    attributes: ['id', 'order_number']
                });
                if (recentDuplicate) {
                    return res.json({
                        success: true,
                        message: "Bu sipariş zaten oluşturuldu.",
                        order: { id: recentDuplicate.id, orderNumber: recentDuplicate.order_number }
                    });
                }
            } catch (idemErr) {
                console.error('İdempotency kontrolü hatası (yok sayıldı):', idemErr.message);
            }

            let iyzicoPaymentData = null;

            if ((paymentMethod || "credit_card") === "iyzico") {
                if (!process.env.IYZICO_API_KEY || !process.env.IYZICO_SECRET_KEY) {
                    return res.status(500).json({
                        success: false,
                        message: "iyzico yapılandırması eksik. API anahtarlarını .env dosyasına ekleyin."
                    });
                }

                let effectiveCard = iyzicoCard || null;
                if (!effectiveCard && iyzicoSavedCardId) {
                    const [rows] = await db.pool.query(
                        `SELECT id, card_name, card_number_encrypted, card_expiry_month, card_expiry_year FROM payment_cards WHERE id = ? AND user_id = ? LIMIT 1`,
                        [parseInt(iyzicoSavedCardId, 10), userId]
                    );
                    const saved = rows && rows[0];
                    const cardNumber = saved ? decryptText(saved.card_number_encrypted) : null;
                    if (!saved || !cardNumber) {
                        return res.status(400).json({ success: false, message: "Kayıtlı kart güvenli olarak çözülemedi." });
                    }
                    if (!iyzicoSavedCardCvc) {
                        return res.status(400).json({ success: false, message: "Kayıtlı kart için CVC gerekli." });
                    }
                    effectiveCard = {
                        cardHolderName: saved.card_name,
                        cardNumber,
                        expireMonth: String(saved.card_expiry_month).padStart(2, '0'),
                        expireYear: String(saved.card_expiry_year).length === 2
                            ? String(new Date().getFullYear()).slice(0, 2) + String(saved.card_expiry_year)
                            : String(saved.card_expiry_year),
                        cvc: String(iyzicoSavedCardCvc).replace(/\D/g, '').slice(0, 4)
                    };
                }
                if (!effectiveCard || !effectiveCard.cardHolderName || !effectiveCard.cardNumber || !effectiveCard.expireMonth || !effectiveCard.expireYear || !effectiveCard.cvc) {
                    return res.status(400).json({ success: false, message: "iyzico kart bilgileri eksik." });
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
                        cardHolderName: effectiveCard.cardHolderName,
                        cardNumber: String(effectiveCard.cardNumber).replace(/\s/g, ""),
                        expireMonth: String(effectiveCard.expireMonth).padStart(2, '0'),
                        expireYear: String(effectiveCard.expireYear).slice(-2),
                        cvc: String(effectiveCard.cvc),
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
                        if (couponRow.usage_limit === 0) {
                            await transaction.rollback();
                            return res.status(400).json({ success: false, message: "Bu kupon artık kullanılamaz." });
                        }
                        if (couponRow.usage_limit > 0) {
                            // Race condition önlemi: transaction içinde FOR UPDATE ile kilitle
                            const usageNow = await CouponUsage.count({
                                where: { coupon_id: appliedCouponId },
                                transaction,
                                lock: transaction.LOCK.UPDATE
                            });
                            if (usageNow >= couponRow.usage_limit) {
                                await transaction.rollback();
                                return res.status(400).json({
                                    success: false,
                                    message: "Bu kupon kullanım limiti dolmuş."
                                });
                            }
                        }
                        // Kişi başı — transaction içinde de kontrol et
                        const couponForLimit = await Coupon.findByPk(appliedCouponId, { attributes: ['per_user_limit'], transaction });
                        const txPerUserLimit = (couponForLimit && couponForLimit.per_user_limit !== undefined && couponForLimit.per_user_limit !== null) ? couponForLimit.per_user_limit : 1;
                        if (txPerUserLimit !== -1) {
                            const userUsageNow = await CouponUsage.count({
                                where: { coupon_id: appliedCouponId, user_id: userId },
                                transaction,
                                lock: transaction.LOCK.UPDATE
                            });
                            if (userUsageNow >= txPerUserLimit) {
                                await transaction.rollback();
                                return res.status(400).json({
                                    success: false,
                                    message: txPerUserLimit === 1
                                        ? "Bu kuponu daha önce kullandınız."
                                        : `Bu kuponu en fazla ${txPerUserLimit} kez kullanabilirsiniz.`
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
                        cash_payment_method: finalCashPaymentMethod,
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

                        // Stok düşümü atomik: WHERE'de stock_quantity >= quantity koşulu ile
                        // eşzamanlı siparişlerin stoğu negatife düşürmesi (overselling) önlenir.
                        // stock_quantity = -1 sınırsız stok anlamına gelir, dokunulmaz.
                        const stockQtyForItem = mealStockMap[mealId];
                        if (stockQtyForItem !== -1 && stockQtyForItem != null) {
                            const [stockUpdated] = await Meal.update(
                                { stock_quantity: sequelize.literal(`stock_quantity - ${quantity}`) },
                                { where: { id: mealId, stock_quantity: { [Op.gte]: quantity } }, transaction }
                            );
                            if (stockUpdated === 0) {
                                throw new Error(`STOCK_INSUFFICIENT:${mealName}`);
                            }
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
                console.error('Sipariş oluşturma DB hatası:', lastDbError?.message);

                const stockMatch = /^STOCK_INSUFFICIENT:(.*)$/.exec(lastDbError?.message || '');

                if (iyzicoPaymentData) {
                    // Ödeme zaten alınmış ama sipariş DB'ye yazılamadı — müşterinin parasını
                    // kaybetmemesi için ödemeyi otomatik iade et.
                    try {
                        await refundIyzicoPaymentForOrder(
                            { id: 0, order_number: `FAILED-${userId}-${Date.now()}`, iyzico_payment_data: iyzicoPaymentData },
                            req.ip || '127.0.0.1'
                        );
                        console.error('⚠️ Sipariş DB hatası sonrası otomatik iade tetiklendi (ödeme alınmıştı). user:', userId);
                        return res.status(stockMatch ? 400 : 500).json({
                            success: false,
                            message: stockMatch
                                ? `${stockMatch[1]} için stok kalmadı. Ödemeniz iade edildi, lütfen tekrar deneyin.`
                                : "Ödemeniz alındı ancak siparişiniz kaydedilemedi. Ödemeniz otomatik olarak iade edildi. Lütfen tekrar deneyin."
                        });
                    } catch (refundErr) {
                        console.error('🚨 KRİTİK: Ödeme alındı, sipariş kaydedilemedi VE otomatik iade de başarısız oldu!', {
                            userId, sellerId, finalTotal, refundError: refundErr.message
                        });
                        return res.status(500).json({
                            success: false,
                            message: "Ödemeniz alındı ancak siparişiniz kaydedilemedi. İade işleminiz için lütfen destek ekibimizle iletişime geçin."
                        });
                    }
                }

                return res.status(stockMatch ? 400 : 500).json({
                    success: false,
                    message: stockMatch
                        ? `${stockMatch[1]} için stok kalmadı. Lütfen sepetinizi güncelleyin.`
                        : "Sipariş oluşturulurken bir hata oluştu. Lütfen tekrar deneyin."
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

                            // Admin sipariş sayfası canlı güncellensin
                            global.io.to('admin').emit('admin_orders_updated', { reason: 'new_order' });
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
            console.error('Sipariş route hatası:', routeError?.message);
            return res.status(500).json({
                success: false,
                message: "Sipariş oluşturulurken bir hata oluştu. Lütfen tekrar deneyin."
            });
        }

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası. Sipariş oluşturulamadı." 
        });
    }
});


router.get("/active/:userId", requireAuth, async (req, res) => {
    try {
        const requestedId = parseInt(req.params.userId);
        const sessionUserId = req.session?.user?.id;
        const sessionRole = req.session?.user?.role;
        // Yalnızca kendi siparişleri veya admin görebilir
        if (!['admin','super_admin','support'].includes(sessionRole) && requestedId !== sessionUserId) {
            return res.status(403).json({ success: false, message: "Bu siparişleri görüntüleme yetkiniz yok." });
        }
        const userId = requestedId;

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
                canCancel: ['pending', 'confirmed'].includes(order.status),
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

router.get("/past/:userId", requireAuth, async (req, res) => {
    try {
        const requestedId = parseInt(req.params.userId);
        const sessionUserId = req.session?.user?.id;
        const sessionRole = req.session?.user?.role;
        if (!['admin','super_admin','support'].includes(sessionRole) && requestedId !== sessionUserId) {
            return res.status(403).json({ success: false, message: "Bu siparişleri görüntüleme yetkiniz yok." });
        }
        const userId = requestedId;

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
        const userId = req.session?.user?.id;
        if (!userId) return res.status(401).json({ success: false, orders: [], message: "Oturum bulunamadı." });
        const { tab = 'new' } = req.query;
        const sellerRecord = await Seller.findOne({ where: { user_id: userId }, attributes: ['id', 'has_own_couriers'] });
        if (!sellerRecord) {
            return res.status(404).json({
                success: false,
                orders: [],
                message: "Satıcı kaydı bulunamadı."
            });
        }
        const shopId = sellerRecord.id;
        const hasOwnCouriers = !!sellerRecord.has_own_couriers;
        let statuses = [];
        if (tab === 'new') {
            statuses = ['pending', 'confirmed'];
        } else if (tab === 'preparing') {
            statuses = ['preparing'];
        } else if (tab === 'ready') {
            // Hazır siparişler — tüm teslimat tipleri (kurye/gel al/kargo bekleyen)
            statuses = ['ready'];
        } else if (tab === 'shipped') {
            statuses = ['on_delivery'];
        } else if (tab === 'history') {
            statuses = ['delivered', 'cancelled'];
        }
        const orderWhere = { seller_id: shopId, status: { [Op.in]: statuses } };

        const ordersRaw = await Order.findAll({
            where: orderWhere,
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
            const isCargo = order.delivery_type === 'cargo';
            const customerName = isCargo ? fullname : `${(fullname.charAt(0) || '')}*** ${(fullname.charAt(fullname.length - 1) || '')}`;
            let deliveryTypeBadge = '';
            if (order.delivery_type === 'pickup') deliveryTypeBadge = '<span class="badge badge-warning" style="background:#f39c12;color:white;padding:2px 6px;border-radius:4px;font-size:0.8rem;">Gel Al</span>';
            else if (isCargo) deliveryTypeBadge = '<span class="badge" style="background:#8e44ad;color:white;padding:2px 6px;border-radius:4px;font-size:0.8rem;">📦 Kargo</span>';
            // Kargo siparişlerde tam adres zorunlu — boş bırakılmamalı
            const cargoAddr = order.address
                ? (order.address.full_address || `${order.address.district || ''}, ${order.address.city || ''}`.replace(/^,\s*|,\s*$/g, '') || 'Adres belirtilmemiş')
                : (order.address_id ? `Adres ID: ${order.address_id}` : 'Adres bilgisi yok');
            const deliveryAddress = order.delivery_type === 'pickup'
                ? 'Gel Al (Mağazadan Teslim)'
                : isCargo
                    ? cargoAddr
                    : (order.address ? `${order.address.district || ''}, ${order.address.city || ''}`.replace(/^,\s*|,\s*$/g, '') || order.address.full_address : `Adres ID: ${order.address_id}`);
            const customerNameWithBadge = deliveryTypeBadge ? `${customerName} ${deliveryTypeBadge}` : customerName;
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
                couponCode: order.coupon_code || null,
                cargoCompany: order.cargo_company || null,
                cargoTrackingNumber: order.cargo_tracking_number || null,
                cargoTrackingUrl: order.cargo_tracking_url || null,
                paymentMethod: order.payment_method || 'credit_card',
                cashPaymentMethod: order.cash_payment_method || null
            };
        });
        
        
        res.json({
            success: true,
            orders: formattedOrders,
            tab: tab,
            hasOwnCouriers: hasOwnCouriers
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
        // Satıcının geçiş yapabileceği statüler
        // delivered: pickup ve cargo siparişlerinde satıcı işaretler
        const sellerAllowedStatuses = ['confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
        if (!sellerAllowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Bu durum değişikliğini yapamazsınız."
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

        const orderCheck = await Order.findOne({
            where: { id: orderId, seller_id: shopId },
            attributes: ['id', 'status', 'coupon_code']
        });

        if (!orderCheck) {
            return res.status(404).json({
                success: false,
                message: "Sipariş bulunamadı veya size ait değil."
            });
        }

        // Statü geçiş matrisi — mantıksız geçişleri engelle
        // Delivery tipi: pickup ve cargo'da satıcı 'delivered' yapabilir, normal teslimat kurye akışına aittir
        const currentStatus = orderCheck.status;
        const orderForType = await Order.findByPk(orderId, { attributes: ['delivery_type'] });
        const delivType = orderForType ? orderForType.delivery_type : 'delivery';

        const allowedTransitions = {
            pending:   ['confirmed', 'cancelled'],
            confirmed: ['preparing', 'cancelled'],
            preparing: ['ready', 'cancelled'],
            // ready → delivered: yalnızca pickup ve cargo siparişlerinde satıcı yapabilir
            ready: delivType === 'pickup' || delivType === 'cargo'
                ? ['delivered', 'cancelled']
                : ['cancelled'],
            // on_delivery → delivered: cargo'da kargo firması teslim ettiğinde satıcı işaretler
            on_delivery: delivType === 'cargo' ? ['delivered', 'cancelled'] : ['cancelled']
        };
        const allowed = allowedTransitions[currentStatus];
        if (!allowed || !allowed.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `"${currentStatus}" durumundan "${status}" durumuna geçiş yapılamaz.`
            });
        }
        let fullOrder = null;
        if (status === 'cancelled') {
            const t = await sequelize.transaction();
            try {
                // Satırı kilitle ve iade durumunu TEKRAR kontrol et — eşzamanlı iki iptal isteğinin
                // ikisinin de iade tetiklemesini (çift iade) önler.
                fullOrder = await Order.findByPk(orderId, {
                    attributes: ['id', 'courier_id', 'payment_method', 'iyzico_payment_data', 'iyzico_refunded_at', 'order_number', 'seller_id', 'coupon_code'],
                    transaction: t,
                    lock: t.LOCK.UPDATE
                });
                if (fullOrder && fullOrder.seller_id === shopId) {
                    if (fullOrder.courier_id) {
                        await CourierTask.update({ status: 'cancelled' }, { where: { order_id: orderId }, transaction: t });
                    }
                    if (fullOrder.payment_method === 'iyzico' && fullOrder.iyzico_payment_data && !fullOrder.iyzico_refunded_at) {
                        try {
                            await refundIyzicoPaymentForOrder(fullOrder, req.ip);
                        } catch (refErr) {
                            await t.rollback();
                            console.error('iyzico iade hatası (satıcı iptal):', refErr);
                            return res.status(502).json({
                                success: false,
                                message: "Ödeme iadesi tamamlanamadı. Sipariş iptal edilmedi. " + (refErr.message || '')
                            });
                        }
                        await Order.update(
                            { iyzico_refunded_at: new Date() },
                            { where: { id: orderId }, transaction: t }
                        );
                    }
                    // Kupon kurtarma — satıcı iptali sonrası kuponu geri ver
                    if (fullOrder.coupon_code) {
                        try {
                            const usageRow = await CouponUsage.findOne({ where: { order_id: orderId }, transaction: t });
                            if (usageRow) {
                                await CouponUsage.destroy({ where: { order_id: orderId }, transaction: t });
                                await Coupon.decrement('used_count', {
                                    by: 1,
                                    where: { id: usageRow.coupon_id, used_count: { [Op.gt]: 0 } },
                                    transaction: t
                                });
                            }
                        } catch (couponErr) {
                            console.error('Kupon kurtarma hatası (satıcı iptal):', couponErr);
                        }
                    }
                }
                await Order.update({ status: 'cancelled' }, { where: { id: orderId, seller_id: shopId }, transaction: t });
                await t.commit();

                if (fullOrder && fullOrder.seller_id === shopId && fullOrder.courier_id && global.io) {
                    global.io.to(`courier-${fullOrder.courier_id}`).emit('order_cancelled', {
                        id: fullOrder.id,
                        orderNumber: fullOrder.order_number,
                        status: 'cancelled',
                        message: 'Sipariş iptal edildi.'
                    });
                }
            } catch (err) {
                try { await t.rollback(); } catch (_) {}
                console.error('Sipariş iptal hatası (satıcı):', err);
                return res.status(500).json({ success: false, message: "Sipariş iptal edilirken bir hata oluştu." });
            }
        }
        const updateData = { status };
        if (status === 'delivered') {
            updateData.delivered_at = new Date();
        }
        if (status !== 'cancelled') {
            await Order.update(updateData, { where: { id: orderId, seller_id: shopId } });
        }
        const updatedOrder = await Order.findByPk(orderId, { attributes: ['user_id', 'order_number', 'courier_id', 'delivery_type'] });
        const isPickupOrder = updatedOrder && updatedOrder.delivery_type === 'pickup';
        
        if (status === 'ready' && updatedOrder && updatedOrder.courier_id === null && !isPickupOrder && global.io) {
            // Kendi kuryesi olan satıcılar için havuza atma — satıcı kendi atayacak veya kuryeler kendisi seçecek
            const sellerForPool = await Seller.findByPk(shopId, { attributes: ['has_own_couriers'] });
            if (!sellerForPool || !sellerForPool.has_own_couriers) {
                global.io.emit('order_pool_added', { orderId: orderId });
            } else {
                // Sadece kendi kuryelerine havuza eklendi bilgisini gönder (Uygun Siparişler'de görmeleri için)
                const ownCouriers = await Courier.findAll({ where: { seller_id: shopId, is_active: true } });
                ownCouriers.forEach(c => {
                    global.io.to(`courier-${c.user_id}`).emit('order_pool_added', { orderId: orderId });
                });
            }
        }
        const statusTitles = isPickupOrder ? {
            confirmed: 'Sipariş onaylandı',
            preparing: 'Sipariş hazırlanıyor',
            ready: 'Siparişiniz hazır',
            delivered: 'Sipariş teslim alındı',
            cancelled: 'Sipariş iptal edildi'
        } : {
            confirmed: 'Sipariş onaylandı',
            preparing: 'Sipariş hazırlanıyor',
            ready: 'Sipariş hazır',
            on_delivery: 'Sipariş yolda',
            delivered: 'Sipariş teslim edildi',
            cancelled: 'Sipariş iptal edildi'
        };
        if (updatedOrder && statusTitles[status]) {
            const isPickupStatusReady = isPickupOrder && status === 'ready';
            const notificationTitle = isPickupStatusReady ? 'Siparişiniz Teslim Alınabilir' : statusTitles[status];
            const notificationMessage = isPickupStatusReady
                ? `Sipariş #${orderId} hazır. Lütfen restorandan teslim alın.`
                : `Sipariş #${orderId} durumu: ${statusTitles[status]}.`;
            
            createNotification(updatedOrder.user_id, 'order', notificationTitle, notificationMessage, orderId).catch(() => {});
            
            // "Gel Al" siparişi hazır olduğunda e-posta gönder
            if (isPickupStatusReady) {
                (async () => {
                    try {
                        const buyerUser = await User.findByPk(updatedOrder.user_id, { attributes: ['email'] });
                        const shop = await Seller.findByPk(shopId, { attributes: ['shop_name'] });
                        if (buyerUser && buyerUser.email && shop) {
                            await sendPickupReadyEmail(buyerUser.email, updatedOrder.order_number, shop.shop_name);
                        }
                    } catch (emailErr) {
                        console.error('Gel Al hazır e-postası gönderilemedi:', emailErr);
                    }
                })();
            }

            if (global.io) {
                global.io.to(`buyer-${updatedOrder.user_id}`).emit('order_status_updated', {
                    orderId: orderId,
                    status: status,
                    orderNumber: updatedOrder.order_number,
                    deliveryType: updatedOrder.delivery_type,
                    message: notificationMessage
                });
                // Admin sipariş sayfası canlı güncellensin
                global.io.to('admin').emit('admin_orders_updated', { reason: 'status', orderId: orderId, status: status });
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
        const order = await Order.findOne({ where: { id: orderId, seller_id: shopId }, attributes: ['id', 'courier_id', 'status', 'delivery_type'] });

        if (!order) {
            return res.status(404).json({ success: false, message: "Sipariş bulunamadı veya size ait değil." });
        }
        
        if (order.status !== 'ready') {
            return res.status(400).json({ success: false, message: "Sipariş hazır durumunda değil. Önce siparişi hazır durumuna getirin." });
        }

        if (order.delivery_type === 'pickup') {
            return res.status(400).json({ success: false, message: "Gel Al siparişlerde kuryeye bildirim gönderilmez. Müşteriye hazır bildirimi gönderilir." });
        }

        if (order.delivery_type === 'cargo') {
            return res.status(400).json({ success: false, message: "Uzak mesafe kargo siparişleri kurye ile taşınmaz. Anlaşmalı kargo firmanızla 'Kargoya Ver' işlemini kullanın." });
        }

        if (order.courier_id !== null) {
            return res.status(400).json({ success: false, message: "Bu sipariş zaten bir kuryeye atanmış." });
        }

        await Order.update(
            { is_pool_requested: true },
            { where: { id: orderId } }
        );
        
        if (global.io) {
            // Tüm aktif kuryeler bu olayı dinler (Yeni iş havuzu)
            global.io.emit('order_pool_added', { orderId: orderId });
            console.log(`🚨 Kurye bildirim yayıldı - order_pool_added: sipariş #${orderId}`);
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

// ═══════════════════════════════════════════════════════════
// KENDİ KURYESİNE SİPARİŞ ATA (Zincir Restoran)
// ═══════════════════════════════════════════════════════════
router.post("/seller/assign-own-courier/:id", requireRole('seller'), async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const userId = req.session.user.id;
        const { courierId } = req.body;

        if (!courierId) {
            return res.status(400).json({ success: false, message: "Kurye seçimi gereklidir." });
        }

        const sellerRecord = await Seller.findOne({
            where: { user_id: userId },
            attributes: ['id', 'has_own_couriers', 'shop_name']
        });
        if (!sellerRecord) {
            return res.status(404).json({ success: false, message: "Satıcı kaydı bulunamadı." });
        }
        if (!sellerRecord.has_own_couriers) {
            return res.status(400).json({ success: false, message: "Kendi kurye özelliği aktif değil." });
        }

        const shopId = sellerRecord.id;

        // Siparişi kontrol et
        const order = await Order.findOne({
            where: { id: orderId, seller_id: shopId },
            attributes: ['id', 'courier_id', 'status', 'delivery_type', 'order_number']
        });
        if (!order) {
            return res.status(404).json({ success: false, message: "Sipariş bulunamadı veya size ait değil." });
        }
        if (order.status !== 'ready') {
            return res.status(400).json({ success: false, message: "Kurye yalnızca sipariş 'hazır' durumundayken atanabilir. Önce siparişi hazır durumuna getirin." });
        }
        if (order.courier_id !== null) {
            return res.status(400).json({ success: false, message: "Bu sipariş zaten bir kuryeye atanmış." });
        }
        if (order.delivery_type === 'pickup') {
            return res.status(400).json({ success: false, message: "Gel Al siparişlerde kurye atanamaz." });
        }

        // Kargo siparişleri kendi kuryeyle teslim edilemez — kargo firmasına verilmeli
        if (order.delivery_type === 'cargo') {
            return res.status(400).json({
                success: false,
                message: "Kargo siparişleri 'Kendi Kuryem' ile gönderilemez. 'Kargoya Verildi' butonunu kullanın."
            });
        }

        // Kuryenin bu satıcıya ait olduğunu kontrol et
        const courier = await Courier.findOne({
            where: { id: parseInt(courierId), seller_id: shopId },
            include: [{ model: User, as: 'user', attributes: ['id', 'fullname'] }]
        });
        if (!courier) {
            return res.status(404).json({ success: false, message: "Bu kurye kadronuzda bulunamadı." });
        }

        // Siparişe kurye ata — durum 'on_delivery' olarak güncellenir (kurye yola çıkıyor).
        // WHERE'e courier_id:null eklenerek atomik hale getirildi (TOCTOU önlemi — iki eşzamanlı
        // atama isteğinden sadece biri başarılı olur).
        const [assignedRows] = await Order.update(
            { courier_id: courier.user.id, status: 'on_delivery' },
            { where: { id: orderId, courier_id: null, status: 'ready' } }
        );
        if (assignedRows === 0) {
            return res.status(400).json({ success: false, message: "Bu sipariş zaten bir kuryeye atanmış." });
        }

        // CourierTask oluştur ve ID'yi al (socket'e CourierTask.id gönderilmeli)
        let newTaskId = null;
        try {
            const newTask = await CourierTask.create({
                order_id: orderId,
                courier_id: courier.user.id,
                status: 'assigned'
            });
            newTaskId = newTask.id;
        } catch (taskErr) {
            console.error('CourierTask oluşturma hatası:', taskErr);
        }

        // Socket.IO ile kuryeye bildir
        // taskId = CourierTask.id (accept-assigned endpoint'i CourierTask.id bekler)
        if (global.io) {
            global.io.to(`courier-${courier.user.id}`).emit('courier_task_assigned', {
                taskId: newTaskId || orderId,  // CourierTask.id gönderilir
                orderId: orderId,
                orderNumber: order.order_number,
                message: `${sellerRecord.shop_name} size sipariş #${order.order_number} atadı.`
            });

            // Alıcıya bildir
            const buyerOrder = await Order.findByPk(orderId, { attributes: ['user_id', 'delivery_type'] });
            if (buyerOrder) {
                global.io.to(`buyer-${buyerOrder.user_id}`).emit('order_status_updated', {
                    orderId: orderId,
                    status: 'on_delivery',
                    deliveryType: buyerOrder.delivery_type,
                    message: `Siparişiniz kuryeye atandı. Kurye: ${courier.user.fullname}`
                });
            }

            // Satıcıya bildir (diğer sekmeler için)
            global.io.to(`seller-${userId}`).emit('order_status_updated', {
                orderId: orderId,
                status: 'on_delivery',
                deliveryType: order.delivery_type
            });
            // Admin sipariş sayfası canlı güncellensin
            global.io.to('admin').emit('admin_orders_updated', { reason: 'status', orderId: orderId, status: 'on_delivery' });
        }

        res.json({
            success: true,
            message: `Sipariş #${order.order_number} kuryeye ${courier.user.fullname} atandı.`,
            courierName: courier.user.fullname
        });
    } catch (error) {
        console.error('assign-own-courier error:', error);
        res.status(500).json({ success: false, message: error.message || "Sunucu hatası." });
    }
});

// Kargo teklifi — checkout için uygunluk + ücret önizlemesi (alıcı)
router.get("/cargo-quote", requireRole('buyer'), async (req, res) => {
    try {
        const sellerId = parseInt(req.query.sellerId);
        const addressId = req.query.addressId ? parseInt(req.query.addressId) : null;
        const subtotal = parseFloat(req.query.subtotal) || 0;
        const totalDesi = parseFloat(req.query.totalDesi) || 0;
        if (!sellerId) {
            return res.status(400).json({ success: false, message: "Satıcı bilgisi gerekli." });
        }

        const seller = await Seller.findByPk(sellerId, {
            attributes: ['location', 'latitude', 'longitude', 'cargo_pricing_mode', 'cargo_fee',
                'cargo_free_threshold', 'cargo_fee_per_100km', 'cargo_regions', 'cargo_max_distance_km', 'cargo_fee_per_desi']
        });
        if (!seller) {
            return res.status(404).json({ success: false, message: "Satıcı bulunamadı." });
        }

        let dest = {};
        if (addressId) {
            const addr = await Address.findOne({
                where: { id: addressId, user_id: req.session.user.id },
                attributes: ['city', 'district', 'latitude', 'longitude']
            });
            if (addr) dest = { city: addr.city, lat: addr.latitude, lng: addr.longitude };
        }

        const result = evaluateCargo(seller, dest, subtotal, totalDesi);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('cargo-quote error:', error?.message);
        res.status(500).json({ success: false, message: "Kargo teklifi hesaplanamadı." });
    }
});

router.post("/seller/cargo-ship/:id", requireRole('seller'), async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const userId = req.session.user.id;
        const { cargoCompany, cargoTrackingNumber } = req.body;

        if (!cargoCompany || !cargoCompany.trim()) {
            return res.status(400).json({ success: false, message: "Kargo firması zorunludur." });
        }

        const sellerRecord = await Seller.findOne({ where: { user_id: userId }, attributes: ['id'] });
        if (!sellerRecord) {
            return res.status(404).json({ success: false, message: "Satıcı kaydı bulunamadı." });
        }

        const shopId = sellerRecord.id;
        const order = await Order.findOne({
            where: { id: orderId, seller_id: shopId, delivery_type: 'cargo' },
            attributes: ['id', 'status', 'delivery_type']
        });

        if (!order) {
            return res.status(404).json({ success: false, message: "Kargo siparişi bulunamadı." });
        }

        if (!['confirmed', 'preparing', 'ready'].includes(order.status)) {
            return res.status(400).json({ success: false, message: "Sipariş kargoya verilemez durumda." });
        }

        // Bilinen firma ise takip linki üretilir; serbest metin firma da kabul edilir
        const tracking = buildCargoTracking(cargoCompany, cargoTrackingNumber);
        if (!tracking.companyName) {
            return res.status(400).json({ success: false, message: "Kargo firması zorunludur." });
        }

        await db.execute(
            `UPDATE orders SET cargo_company=?, cargo_tracking_number=?, cargo_tracking_url=?, status='on_delivery' WHERE id=?`,
            [tracking.companyName, tracking.trackingNumber, tracking.trackingUrl, orderId]
        );

        if (global.io) {
            // Satıcıya güncelleme - sipariş listesi yenilensin
            const cargoOrder = await Order.findByPk(orderId, { attributes: ['user_id', 'order_number'] });
            if (cargoOrder) {
                global.io.to(`buyer-${cargoOrder.user_id}`).emit('order_status_updated', {
                    orderId,
                    status: 'on_delivery',
                    cargoCompany: tracking.companyName,
                    cargoTrackingNumber: tracking.trackingNumber,
                    cargoTrackingUrl: tracking.trackingUrl,
                    message: `Siparişiniz ${tracking.companyName} ile kargoya verildi. Takip no: ` + (tracking.trackingNumber || 'Belirtilmedi')
                });
            }
            // Admin sipariş sayfası canlı güncellensin
            global.io.to('admin').emit('admin_orders_updated', { reason: 'status', orderId: orderId, status: 'on_delivery' });
        }

        res.json({ success: true, message: "Sipariş kargoya verildi." });
    } catch (error) {
        console.error('cargo-ship error:', error?.message);
        res.status(500).json({ success: false, message: "Sunucu hatası. Kargo işlemi tamamlanamadı." });
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

        let order = await Order.findOne({
            where: {
                id: orderId,
                user_id: userId
            },
            attributes: ['id', 'status', 'courier_id', 'payment_method', 'iyzico_payment_data', 'iyzico_refunded_at', 'order_number', 'coupon_code']
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

        const cancelTx = await sequelize.transaction();
        try {
            // Satırı kilitle ve durum/iade bilgisini TEKRAR kontrol et — eşzamanlı iki iptal
            // isteğinin ikisinin de iade tetiklemesini (çift iade) önler.
            order = await Order.findOne({
                where: { id: orderId, user_id: userId },
                attributes: ['id', 'status', 'courier_id', 'payment_method', 'iyzico_payment_data', 'iyzico_refunded_at', 'order_number', 'coupon_code'],
                transaction: cancelTx,
                lock: cancelTx.LOCK.UPDATE
            });
            if (!order || !cancellableStatuses.includes(order.status)) {
                await cancelTx.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Bu sipariş ${getStatusText(order ? order.status : 'bilinmeyen')} durumunda olduğu için tarafınızca iptal edilemez. Lütfen destek talebi oluşturun.`
                });
            }

            if (order.payment_method === 'iyzico' && order.iyzico_payment_data && !order.iyzico_refunded_at) {
                try {
                    await refundIyzicoPaymentForOrder(order, req.ip);
                } catch (refErr) {
                    await cancelTx.rollback();
                    console.error('iyzico iade hatası:', refErr);
                    return res.status(502).json({
                        success: false,
                        message: "Ödeme iadesi tamamlanamadı. Sipariş iptal edilmedi. " + (refErr.message || '')
                    });
                }
                await Order.update(
                    { iyzico_refunded_at: new Date() },
                    { where: { id: orderId, user_id: userId }, transaction: cancelTx }
                );
            }

            await Order.update(
                { status: 'cancelled' },
                { where: { id: orderId, user_id: userId }, transaction: cancelTx }
            );

            // Kupon kurtarma — iptal edilen siparişteki kupon kullanım hakkını geri ver
            if (order.coupon_code) {
                try {
                    const usageRow = await CouponUsage.findOne({ where: { order_id: orderId }, transaction: cancelTx });
                    if (usageRow) {
                        await CouponUsage.destroy({ where: { order_id: orderId }, transaction: cancelTx });
                        await Coupon.decrement('used_count', {
                            by: 1,
                            where: { id: usageRow.coupon_id, used_count: { [Op.gt]: 0 } },
                            transaction: cancelTx
                        });
                    }
                } catch (couponErr) {
                    console.error('Kupon kurtarma hatası (alıcı iptal):', couponErr);
                }
            }

            if (order.courier_id) {
                await CourierTask.update({ status: 'cancelled' }, { where: { order_id: orderId }, transaction: cancelTx });
            }

            await cancelTx.commit();
        } catch (err) {
            try { await cancelTx.rollback(); } catch (_) {}
            console.error('Sipariş iptal hatası (alıcı):', err);
            return res.status(500).json({ success: false, message: "Sipariş iptal edilirken bir hata oluştu." });
        }

        if (order.courier_id && global.io) {
            global.io.to(`courier-${order.courier_id}`).emit('order_cancelled', { id: orderId, orderNumber: order.order_number, status: 'cancelled' });
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
                    if (sellerUser) {
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
                    }
                }
            } catch (socketError) {
                console.error('Socket.IO emit hatası:', socketError);
            }
            // Admin sipariş sayfası canlı güncellensin
            global.io.to('admin').emit('admin_orders_updated', { reason: 'cancelled', orderId: orderId });
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

// Admin: Kısmi iade
router.post("/:id/partial-refund", requireAuth, async (req, res) => {
    try {
        const userRole = req.session?.user?.role;
        if (!['admin', 'super_admin'].includes(userRole)) {
            return res.status(403).json({ success: false, message: "Bu işlem için admin yetkisi gereklidir." });
        }

        const orderId = parseInt(req.params.id);
        if (isNaN(orderId) || orderId <= 0) {
            return res.status(400).json({ success: false, message: "Geçersiz sipariş ID'si." });
        }

        const { refundAmount, reason } = req.body;
        const amount = parseFloat(refundAmount);
        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: "Geçerli bir iade tutarı girin." });
        }

        // Nakit ödeme için sadece not kaydı alınır (fiziksel iade admin tarafından yapılır) — para
        // hareketi yok, kilitsiz hızlı yol yeterli.
        const cashCheck = await Order.findByPk(orderId, { attributes: ['id', 'payment_method'] });
        if (!cashCheck) {
            return res.status(404).json({ success: false, message: "Sipariş bulunamadı." });
        }
        if (cashCheck.payment_method === 'cash') {
            if (!reason || !reason.trim()) {
                return res.status(400).json({ success: false, message: "Nakit iade için açıklama notu zorunludur." });
            }
            const refAmount = parseFloat(refundAmount);
            if (!refAmount || refAmount <= 0) {
                return res.status(400).json({ success: false, message: "Geçerli bir iade tutarı girin." });
            }
            await Order.update(
                { cash_refund_note: `${reason} — Tutar: ${refAmount.toFixed(2)} TL — Admin: ${req.session?.user?.id} — ${new Date().toISOString()}` },
                { where: { id: orderId } }
            );
            const { writeLog } = require('../../config/logger');
            writeLog('INFO', 'Nakit iade notu kaydedildi', { orderId, amount: refAmount, reason, adminId: req.session?.user?.id });
            return res.json({ success: true, message: `Nakit iade notu kaydedildi: ${refAmount.toFixed(2)} TL` });
        }

        // Satırı kilitle ve kalan iade edilebilir tutarı TEKRAR kontrol et — eşzamanlı iki kısmi
        // iade isteğinin toplam iade tutarını sınırın üzerine çıkarmasını önler.
        const refundTx = await sequelize.transaction();
        let order, alreadyRefunded, totalPaid, newRefundTotal;
        try {
            order = await Order.findByPk(orderId, {
                attributes: ['id', 'status', 'payment_method', 'iyzico_payment_data', 'iyzico_refunded_at',
                            'order_number', 'total_amount', 'partial_refund_amount'],
                transaction: refundTx,
                lock: refundTx.LOCK.UPDATE
            });

            if (!order || order.payment_method !== 'iyzico' || !order.iyzico_payment_data) {
                await refundTx.rollback();
                return res.status(400).json({ success: false, message: "Bu sipariş için iade yapılamaz (ödeme yöntemi uyumsuz)." });
            }

            alreadyRefunded = parseFloat(order.partial_refund_amount || 0);
            totalPaid = parseFloat(order.total_amount || 0);
            const maxRefundable = totalPaid - alreadyRefunded;

            if (amount > maxRefundable) {
                await refundTx.rollback();
                return res.status(400).json({
                    success: false,
                    message: `İade edilebilir maksimum tutar: ${maxRefundable.toFixed(2)} TL`
                });
            }

            await refundIyzicoPaymentPartial(order, amount, req.ip, reason || 'Admin kısmi iade');

            newRefundTotal = alreadyRefunded + amount;
            const updateData = { partial_refund_amount: newRefundTotal.toFixed(2) };
            if (newRefundTotal >= totalPaid) {
                updateData.iyzico_refunded_at = new Date();
            }
            await Order.update(updateData, { where: { id: orderId }, transaction: refundTx });

            await refundTx.commit();
        } catch (err) {
            try { await refundTx.rollback(); } catch (_) {}
            console.error('Kısmi iade hatası:', err?.message);
            return res.status(500).json({ success: false, message: "İade işlemi sırasında hata oluştu. Lütfen tekrar deneyin." });
        }

        const { writeLog } = require('../../config/logger');
        writeLog('INFO', 'Kısmi iade yapıldı', {
            orderId, amount, reason, adminId: req.session?.user?.id
        });

        res.json({
            success: true,
            message: `${amount.toFixed(2)} TL iade başarıyla yapıldı.`,
            refundedAmount: amount,
            totalRefunded: newRefundTotal
        });
    } catch (error) {
        console.error('Kısmi iade hatası:', error?.message);
        res.status(500).json({ success: false, message: "İade işlemi sırasında hata oluştu. Lütfen tekrar deneyin." });
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
                    o.cash_payment_method,
                    o.delivery_type,
                    o.cargo_company,
                    o.cargo_tracking_number,
                    o.cargo_tracking_url,
                    o.address_id,
                    o.user_id,
                    o.seller_id,
                    s.shop_name as seller_name,
                    s.location as seller_location,
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

            const normalizedStatus = order.status;

            const orderDetail = {
                id: order.id,
                orderNumber: order.order_number,
                status: normalizedStatus,
                statusText: getStatusText(normalizedStatus),
                date: new Date(order.date).toLocaleString('tr-TR'),
                total: parseFloat(order.total) || 0,
                subtotal: parseFloat(order.subtotal) || 0,
                deliveryFee: parseFloat(order.delivery_fee) || 0,
                discount: parseFloat(order.discount_amount) || 0,
                deliveryType: order.delivery_type || 'delivery',
                paymentMethod: order.payment_method || 'credit_card',
                cashPaymentMethod: order.cash_payment_method || null,
                seller: {
                    id: order.seller_id,
                    name: order.seller_name || "Ev Lezzetleri",
                    phone: order.seller_phone,
                    location: order.seller_location || null
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
                cargoCompany: order.cargo_company || null,
                cargoTrackingNumber: order.cargo_tracking_number || null,
                cargoTrackingUrl: order.cargo_tracking_url || null,
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