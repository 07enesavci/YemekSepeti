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

module.exports = router;

