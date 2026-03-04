const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const { Meal, Seller, Coupon, CouponUsage } = require("../../models");
const { Op } = require("sequelize");

router.get("/product/:id", async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const meal = await Meal.findOne({
            where: { id: productId, is_available: true },
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
        res.status(500).json({ success: false, message: "Sunucu hatası." });
    }
});

router.post("/validate-coupon", async (req, res) => {
    try {
        const { code, subtotal, sellerId } = req.body;
        
        if (!code || !subtotal) {
            return res.status(400).json({
                success: false,
                message: "Kupon kodu ve ara toplam gereklidir."
            });
        }
        
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
        
        if (parseFloat(subtotal) < parseFloat(coupon.min_order_amount || 0)) {
            return res.status(400).json({
                success: false,
                message: `Bu kupon minimum ${parseFloat(coupon.min_order_amount)} TL sipariş için geçerlidir.`
            });
        }
        
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
        
        // usage_limit > 0 ise kontrol yap, -1 veya 0 ise sınırsız kullanım
        if (coupon.usage_limit > 0) {
            // Gerçek kullanım sayısını CouponUsage tablosundan say
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
        
        let discountAmount = 0;
        if (coupon.discount_type === 'percentage') {
            discountAmount = (parseFloat(subtotal) * parseFloat(coupon.discount_value)) / 100;
            if (coupon.max_discount_amount) {
                discountAmount = Math.min(discountAmount, parseFloat(coupon.max_discount_amount));
            }
        } else {
            discountAmount = parseFloat(coupon.discount_value);
        }
        
        discountAmount = Math.min(discountAmount, parseFloat(subtotal));
        
        res.json({
            success: true,
            message: "Kupon geçerli!",
            coupon: {
                code: coupon.code,
                discountAmount: parseFloat(discountAmount.toFixed(2)),
                discountType: coupon.discount_type,
                discountValue: parseFloat(coupon.discount_value)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Sunucu hatası." });
    }
});

module.exports = router;
