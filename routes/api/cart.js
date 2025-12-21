const express = require("express");
const router = express.Router();
const db = require("../../config/database");


// ============================================
// ROUTES
// ============================================

/**
 * GET /api/cart/product/:id
 * Belirli bir ürünü getir (veritabanından)
 */
router.get("/product/:id", async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        
        // Veritabanından ürünü bul
        const mealQuery = `
            SELECT 
                m.id,
                m.name,
                m.description,
                m.price,
                m.image_url as imageUrl,
                m.category,
                s.id as seller_id,
                s.shop_name as seller_name
            FROM meals m
            INNER JOIN sellers s ON m.seller_id = s.id
            WHERE m.id = ? AND m.is_available = TRUE
        `;
        
        const meals = await db.query(mealQuery, [productId]);
        
        if (meals.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Ürün bulunamadı." 
            });
        }
        
        const meal = meals[0];
        
        res.json({
            id: meal.id,
            name: meal.name,
            description: meal.description,
            price: parseFloat(meal.price),
            imageUrl: meal.imageUrl,
            category: meal.category,
            satici: meal.seller_name || "Ev Lezzetleri",
            fiyat: parseFloat(meal.price),
            gorsel: meal.imageUrl,
            ad: meal.name
        });
    } catch (error) {
        console.error("Ürün getirme hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası." 
        });
    }
});

/**
 * POST /api/cart/validate-coupon
 * Kupon kodunu doğrula ve indirim tutarını hesapla
 */
router.post("/validate-coupon", async (req, res) => {
    try {
        const { code, subtotal, sellerId } = req.body;
        
        if (!code || !subtotal) {
            return res.status(400).json({
                success: false,
                message: "Kupon kodu ve ara toplam gereklidir."
            });
        }
        
        // Kupon kodunu veritabanından bul
        const couponQuery = `
            SELECT 
                id,
                code,
                description,
                discount_type,
                discount_value,
                min_order_amount,
                max_discount_amount,
                applicable_seller_ids,
                usage_limit,
                used_count,
                valid_from,
                valid_until,
                is_active
            FROM coupons
            WHERE code = ? AND is_active = TRUE
        `;
        
        const coupons = await db.query(couponQuery, [code.toUpperCase().trim()]);
        
        if (coupons.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Geçersiz kupon kodu."
            });
        }
        
        const coupon = coupons[0];
        
        // Tarih kontrolü - MySQL tarihlerini doğru şekilde karşılaştır
        const now = new Date();
        
        // MySQL'den gelen tarihleri parse et (TIMESTAMP formatı)
        let validFrom, validUntil;
        
        // MySQL TIMESTAMP formatını parse et
        if (coupon.valid_from instanceof Date) {
            validFrom = coupon.valid_from;
        } else if (typeof coupon.valid_from === 'string') {
            // String ise parse et
            validFrom = new Date(coupon.valid_from);
        } else {
            validFrom = new Date(coupon.valid_from);
        }
        
        if (coupon.valid_until instanceof Date) {
            validUntil = coupon.valid_until;
        } else if (typeof coupon.valid_until === 'string') {
            validUntil = new Date(coupon.valid_until);
        } else {
            validUntil = new Date(coupon.valid_until);
        }
        
        // Tarih kontrolü - valid_until dahil (gece yarısına kadar geçerli)
        const validUntilEnd = new Date(validUntil);
        validUntilEnd.setHours(23, 59, 59, 999);
        
        if (now < validFrom || now > validUntilEnd) {
            return res.status(400).json({
                success: false,
                message: "Bu kupon kodunun süresi dolmuş veya henüz geçerli değil."
            });
        }
        
        
        // Kullanım limiti kontrolü
        if (coupon.usage_limit !== -1 && coupon.used_count >= coupon.usage_limit) {
            return res.status(400).json({
                success: false,
                message: "Bu kupon kodunun kullanım limiti dolmuş."
            });
        }
        
        // Minimum sipariş tutarı kontrolü
        const subtotalNum = parseFloat(subtotal);
        if (subtotalNum < parseFloat(coupon.min_order_amount)) {
            return res.status(400).json({
                success: false,
                message: `Bu kupon için minimum ${parseFloat(coupon.min_order_amount).toFixed(2)} TL tutarında sipariş gereklidir.`
            });
        }
        
        // Satıcı kontrolü (eğer kupon belirli satıcılar için ise)
        // ÖNEMLİ: Eğer kupon belirli satıcılar için ise, sepetteki satıcı o listede olmalı
        if (coupon.applicable_seller_ids) {
            try {
                const applicableSellers = JSON.parse(coupon.applicable_seller_ids);
                if (Array.isArray(applicableSellers) && applicableSellers.length > 0) {
                    // Kupon belirli satıcılar için ise, sellerId mutlaka olmalı ve listede olmalı
                    const sellerIdNum = sellerId ? parseInt(sellerId) : null;
                    
                    if (!sellerIdNum) {
                        return res.status(400).json({
                            success: false,
                            message: "Geçersiz kupon kodu. Bu kupon bu restoran için geçerli değil."
                        });
                    }
                    
                    // Seller ID'yi integer array'e çevir
                    const applicableSellerIds = applicableSellers.map(id => parseInt(id));
                    
                    if (!applicableSellerIds.includes(sellerIdNum)) {
                        return res.status(400).json({
                            success: false,
                            message: "Geçersiz kupon kodu. Bu kupon bu restoran için geçerli değil."
                        });
                    }
                }
            } catch (e) {
                console.error("Kupon satıcı ID parse hatası:", e);
                return res.status(400).json({
                    success: false,
                    message: "Kupon kodu doğrulanırken bir hata oluştu."
                });
            }
        } else {
            // Kupon tüm satıcılar için geçerli (applicable_seller_ids NULL veya boş)
        }
        
        // İndirim tutarını hesapla
        let discountAmount = 0;
        if (coupon.discount_type === 'fixed') {
            // Sabit tutar indirimi
            discountAmount = parseFloat(coupon.discount_value);
        } else if (coupon.discount_type === 'percentage') {
            // Yüzde indirimi
            discountAmount = (subtotalNum * parseFloat(coupon.discount_value)) / 100;
            
            // Maksimum indirim tutarı kontrolü
            if (coupon.max_discount_amount && discountAmount > parseFloat(coupon.max_discount_amount)) {
                discountAmount = parseFloat(coupon.max_discount_amount);
            }
        }
        
        // İndirim tutarı ara toplamdan fazla olamaz
        discountAmount = Math.min(discountAmount, subtotalNum);
        
        res.json({
            success: true,
            coupon: {
                id: coupon.id,
                code: coupon.code,
                description: coupon.description,
                discountType: coupon.discount_type,
                discountValue: parseFloat(coupon.discount_value),
                discountAmount: Math.round(discountAmount * 100) / 100
            }
        });
    } catch (error) {
        console.error("Kupon doğrulama hatası:", error);
        res.status(500).json({
            success: false,
            message: "Kupon doğrulanırken bir hata oluştu."
        });
    }
});

module.exports = router;

