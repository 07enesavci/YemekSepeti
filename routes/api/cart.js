const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const { Meal, Seller, Coupon } = require("../../models");
const { Op } = require("sequelize");


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
        
        // Veritabanından ürünü bul (Sequelize)
        const meal = await Meal.findOne({
            where: {
                id: productId,
                is_available: true
            },
            include: [{
                model: Seller,
                as: 'seller',
                attributes: ['id', 'shop_name']
            }],
            attributes: ['id', 'name', 'description', 'price', 'image_url', 'category']
        });
        
        if (!meal) {
            return res.status(404).json({ 
                success: false, 
                message: "Ürün bulunamadı." 
            });
        }
        
        res.json({
            id: meal.id,
            name: meal.name,
            description: meal.description,
            price: parseFloat(meal.price),
            imageUrl: meal.image_url,
            category: meal.category,
            satici: meal.seller?.shop_name || "Ev Lezzetleri",
            fiyat: parseFloat(meal.price),
            gorsel: meal.image_url,
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
        
        // Kupon kodunu veritabanından bul (Sequelize)
        const coupon = await Coupon.findOne({
            where: {
                code: code.toUpperCase().trim(),
                is_active: true
            }
        });
        
        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: "Geçersiz kupon kodu."
            });
        }
        
        // Tarih kontrolü (Sequelize Date objesi döner)
        const now = new Date();
        const validFrom = new Date(coupon.valid_from);
        const validUntil = new Date(coupon.valid_until);
        
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
                // Sequelize JSON alanını otomatik parse eder
                const applicableSellers = Array.isArray(coupon.applicable_seller_ids) 
                    ? coupon.applicable_seller_ids 
                    : JSON.parse(coupon.applicable_seller_ids);
                    
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

