const express = require("express");
const router = express.Router();

// ============================================
// MOCK VERİTABANI
// ============================================
let MOCK_ORDERS = [
    { id: 1052, userId: 1, sellerName: "Ayşe'nin Mutfağı", date: "12 Kasım 2025, 21:00", total: 259.99, status: "preparing", items: "1 x Ev Mantısı, 2 x Fırın Sütlaç" },
    { id: 1051, userId: 1, sellerName: "Ali'nin Kebapları", date: "10 Kasım 2025, 12:15", total: 85.00, status: "delivered", items: "1 x Adana Kebap" },
    { id: 1050, userId: 2, sellerName: "Vegan Lezzetler", date: "9 Kasım 2025, 17:30", total: 60.00, status: "cancelled", items: "1 x Vegan Burger" },
];

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/orders
 * Yeni sipariş oluştur
 */
router.post("/", (req, res) => {
    try {
        const { cart, address } = req.body;

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

        // Yeni sipariş oluştur
        const newOrderId = MOCK_ORDERS.length > 0 
            ? Math.max(...MOCK_ORDERS.map(o => o.id)) + 1 
            : 1000;

        // Sepetten toplam tutarı hesapla
        const total = cart.reduce((sum, item) => {
            const itemPrice = item.urun?.price || item.urun?.fiyat || 0;
            const quantity = item.adet || 1;
            return sum + (itemPrice * quantity);
        }, 0) + 29.99; // Teslimat ücreti

        const newOrder = {
            id: newOrderId,
            userId: 1, // Gerçek uygulamada req.user'dan alınacak
            sellerName: cart[0]?.urun?.satici || "Ev Lezzetleri",
            date: new Date().toLocaleString("tr-TR"),
            total: total.toFixed(2),
            status: "preparing",
            items: cart.map(item => 
                `${item.adet} x ${item.urun?.ad || item.urun?.name}`
            ).join(", ")
        };

        MOCK_ORDERS.unshift(newOrder); // Başa ekle

        res.json({ 
            success: true, 
            orderId: newOrderId,
            order: newOrder
        });
    } catch (error) {
        console.error("Sipariş oluşturma hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası. Sipariş oluşturulamadı." 
        });
    }
});

/**
 * GET /api/orders/active/:userId
 * Aktif siparişleri getir
 */
router.get("/active/:userId", (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const activeOrders = MOCK_ORDERS.filter(
            o => o.userId === userId && o.status === "preparing"
        );

        res.json(activeOrders);
    } catch (error) {
        console.error("Aktif siparişler getirme hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası." 
        });
    }
});

/**
 * GET /api/orders/past/:userId
 * Geçmiş siparişleri getir
 */
router.get("/past/:userId", (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const pastOrders = MOCK_ORDERS.filter(
            o => o.userId === userId && (o.status === "delivered" || o.status === "cancelled")
        );

        res.json(pastOrders);
    } catch (error) {
        console.error("Geçmiş siparişler getirme hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası." 
        });
    }
});

/**
 * GET /api/orders/:id
 * Belirli bir siparişin detaylarını getir
 */
router.get("/:id", (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const order = MOCK_ORDERS.find(o => o.id === orderId);

        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: "Sipariş bulunamadı." 
            });
        }

        res.json(order);
    } catch (error) {
        console.error("Sipariş detay getirme hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası." 
        });
    }
});

module.exports = router;

