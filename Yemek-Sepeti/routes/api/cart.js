const express = require("express");
const router = express.Router();

// ============================================
// MOCK VERİTABANI
// ============================================
const MOCK_MENUS = {
    "1": [
        { id: 101, category: "Ana Yemekler", name: "Ev Mantısı (Porsiyon)", description: "Kayseri usulü, yoğurt ve sos ile.", price: 110.00, imageUrl: "https://via.placeholder.com/400x200.png?text=Ev+Mantısı" },
        { id: 102, category: "Ana Yemekler", name: "Kuru Fasulye", description: "Geleneksel usulde, yanında pilav ile.", price: 85.00, imageUrl: "https://via.placeholder.com/400x200.png?text=Kuru+Fasulye" },
        { id: 103, category: "Tatlılar", name: "Fırın Sütlaç", description: "Ev yapımı, bol fındıklı.", price: 60.00, imageUrl: "https://via.placeholder.com/400x200.png?text=Sütlaç" },
    ],
    "2": [
        { id: 201, category: "Kebaplar", name: "Adana Kebap", description: "Acılı, porsiyon.", price: 130.00, imageUrl: "https://via.placeholder.com/400x200.png?text=Adana+Kebap" },
        { id: 202, category: "Pide", name: "Kıymalı Pide", description: "Bol malzemeli.", price: 90.00, imageUrl: "https://via.placeholder.com/400x200.png?text=Kıymalı+Pide" },
    ],
    "3": [],
};

let MOCK_SELLERS = [
    { id: 1, name: "Ayşe'nin Mutfağı" },
    { id: 2, name: "Ali'nin Kebapları" },
    { id: 3, name: "Vegan Lezzetler" },
];

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/cart/menus
 * Tüm menüleri getir (frontend için)
 */
router.get("/menus", (req, res) => {
    res.json(MOCK_MENUS);
});

/**
 * GET /api/cart/sellers
 * Tüm satıcıları getir (frontend için)
 */
router.get("/sellers", (req, res) => {
    res.json(MOCK_SELLERS);
});

/**
 * GET /api/cart/product/:id
 * Belirli bir ürünü getir
 */
router.get("/product/:id", (req, res) => {
    const productId = parseInt(req.params.id);
    
    // Tüm menülerde ara
    for (const sellerId in MOCK_MENUS) {
        const menu = MOCK_MENUS[sellerId];
        const product = menu.find(p => p.id === productId);
        
        if (product) {
            const seller = MOCK_SELLERS.find(s => s.id == sellerId);
            return res.json({
                ...product,
                satici: seller ? seller.name : "Ev Lezzetleri",
                fiyat: product.price,
                gorsel: product.imageUrl,
                ad: product.name
            });
        }
    }

    res.status(404).json({ 
        success: false, 
        message: "Ürün bulunamadı." 
    });
});

module.exports = router;

