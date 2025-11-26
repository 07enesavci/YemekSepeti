const express = require("express");
const router = express.Router();

// ============================================
// MOCK VERİTABANI
// ============================================
let MOCK_SELLERS = [
    { 
        id: 1, 
        name: "Ayşe'nin Mutfağı", 
        location: "Kadıköy", 
        rating: 4.9, 
        imageUrl: "https://via.placeholder.com/400x200.png?text=Ayşe'nin+Mutfağı",
        bannerUrl: "https://via.placeholder.com/1920x400.png?text=Satıcı+Banner+1"
    },
    { 
        id: 2, 
        name: "Ali'nin Kebapları", 
        location: "Beşiktaş", 
        rating: 4.7, 
        imageUrl: "https://via.placeholder.com/400x200.png?text=Ali'nin+Kebapları",
        bannerUrl: "https://via.placeholder.com/1920x400.png?text=Satıcı+Banner+2"
    },
    { 
        id: 3, 
        name: "Vegan Lezzetler", 
        location: "Moda", 
        rating: 4.8, 
        imageUrl: "https://via.placeholder.com/400x200.png?text=Vegan+Lezzetler",
        bannerUrl: "https://via.placeholder.com/1920x400.png?text=Satıcı+Banner+3"
    },
];

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

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/sellers
 * Satıcıları listele (filtreleme ile)
 */
router.get("/", (req, res) => {
    try {
        const { location, rating } = req.query;
        let sellers = [...MOCK_SELLERS];

        // Filtreleme
        if (location) {
            sellers = sellers.filter(s => 
                s.location.toLowerCase().includes(location.toLowerCase())
            );
        }

        if (rating) {
            const minRating = parseFloat(rating);
            sellers = sellers.filter(s => s.rating >= minRating);
        }

        res.json(sellers);
    } catch (error) {
        console.error("Satıcılar listeleme hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası." 
        });
    }
});

/**
 * GET /api/sellers/:id
 * Belirli bir satıcının detaylarını getir
 */
router.get("/:id", (req, res) => {
    try {
        const sellerId = parseInt(req.params.id);
        const seller = MOCK_SELLERS.find(s => s.id === sellerId);

        if (!seller) {
            return res.status(404).json({ 
                success: false, 
                message: "Satıcı bulunamadı." 
            });
        }

        res.json(seller);
    } catch (error) {
        console.error("Satıcı detay getirme hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası." 
        });
    }
});

/**
 * GET /api/sellers/:id/menu
 * Belirli bir satıcının menüsünü getir
 */
router.get("/:id/menu", (req, res) => {
    try {
        const sellerId = req.params.id;
        const menu = MOCK_MENUS[sellerId] || [];

        res.json(menu);
    } catch (error) {
        console.error("Menü getirme hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası." 
        });
    }
});

module.exports = router;

