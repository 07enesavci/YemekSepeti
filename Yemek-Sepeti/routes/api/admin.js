const express = require("express");
const router = express.Router();

// ============================================
// MOCK VERİTABANI
// ============================================
let MOCK_USERS = [
    { id: 1, email: "enes@mail.com", password: "123", role: "buyer", fullname: "Enes Avcı" },
    { id: 2, email: "ahmet@mail.com", password: "123", role: "buyer", fullname: "Ahmet Eren" },
    { id: 3, email: "satici@mail.com", password: "123", role: "seller", fullname: "Ayşe Satıcı", shopId: 1, status: "active" },
    { id: 4, email: "kurye@mail.com", password: "123", role: "courier", fullname: "Şükrü Kurye", status: "suspended" },
    { id: 999, email: "admin@mail.com", password: "admin123", role: "admin", fullname: "Sistem Yöneticisi" }
];

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

let MOCK_COUPONS = [];

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/admin/users
 * Tüm satıcı ve kuryeleri getir
 */
router.get("/users", (req, res) => {
    try {
        const users = MOCK_USERS.filter(u => u.role === "seller" || u.role === "courier");
        res.json(users);
    } catch (error) {
        console.error("Kullanıcılar getirme hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası." 
        });
    }
});

/**
 * GET /api/admin/sellers
 * Tüm satıcıları getir
 */
router.get("/sellers", (req, res) => {
    try {
        res.json(MOCK_SELLERS);
    } catch (error) {
        console.error("Satıcılar getirme hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası." 
        });
    }
});

/**
 * POST /api/admin/users
 * Yeni kullanıcı (satıcı/kurye) ekle
 */
router.post("/users", (req, res) => {
    try {
        const { fullname, email, password, role } = req.body;

        if (!fullname || !email || !password || !role) {
            return res.status(400).json({ 
                success: false, 
                message: "Tüm alanlar gereklidir." 
            });
        }

        // Aynı e-posta kontrolü
        const existingUser = MOCK_USERS.find(u => u.email === email);
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: "Bu e-posta adresi zaten kayıtlı." 
            });
        }

        const newId = MOCK_USERS.length > 0 
            ? Math.max(...MOCK_USERS.map(u => u.id)) + 1 
            : 1;

        const newUser = {
            id: newId,
            email,
            password,
            role,
            fullname,
            status: "active"
        };

        // Satıcı ise shopId ekle
        if (role === "seller") {
            const newShopId = MOCK_SELLERS.length > 0 
                ? Math.max(...MOCK_SELLERS.map(s => s.id)) + 1 
                : 1;
            newUser.shopId = newShopId;
            
            // Yeni satıcıyı MOCK_SELLERS'a ekle
            MOCK_SELLERS.push({
                id: newShopId,
                name: fullname + " Mutfağı",
                location: "İstanbul",
                rating: 0,
                imageUrl: "https://via.placeholder.com/400x200.png?text=Yeni+Satıcı",
                bannerUrl: "https://via.placeholder.com/1920x400.png?text=Satıcı+Banner"
            });
        }

        MOCK_USERS.push(newUser);

        const { password: _, ...userWithoutPassword } = newUser;
        res.json({ 
            success: true, 
            user: userWithoutPassword 
        });
    } catch (error) {
        console.error("Kullanıcı ekleme hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası. Kullanıcı eklenemedi." 
        });
    }
});

/**
 * PUT /api/admin/users/:id/suspend
 * Kullanıcıyı dondur/aktif et
 */
router.put("/users/:id/suspend", (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = MOCK_USERS.find(u => u.id === userId);

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "Kullanıcı bulunamadı." 
            });
        }

        if (!user.status) {
            user.status = "active";
        }

        user.status = user.status === "active" ? "suspended" : "active";

        res.json({ 
            success: true, 
            user: { ...user, password: undefined } 
        });
    } catch (error) {
        console.error("Kullanıcı durumu güncelleme hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası." 
        });
    }
});

/**
 * DELETE /api/admin/users/:id
 * Kullanıcıyı sil
 */
router.delete("/users/:id", (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const userIndex = MOCK_USERS.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: "Kullanıcı bulunamadı." 
            });
        }

        MOCK_USERS.splice(userIndex, 1);

        res.json({ 
            success: true, 
            message: "Kullanıcı silindi." 
        });
    } catch (error) {
        console.error("Kullanıcı silme hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası." 
        });
    }
});

/**
 * GET /api/admin/coupons
 * Tüm kuponları getir
 */
router.get("/coupons", (req, res) => {
    try {
        res.json(MOCK_COUPONS);
    } catch (error) {
        console.error("Kuponlar getirme hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası." 
        });
    }
});

/**
 * POST /api/admin/coupons
 * Yeni kupon ekle
 */
router.post("/coupons", (req, res) => {
    try {
        const { code, amount, sellerIds } = req.body;

        if (!code || !amount || !sellerIds || !Array.isArray(sellerIds)) {
            return res.status(400).json({ 
                success: false, 
                message: "Kupon kodu, tutar ve satıcı ID'leri gereklidir." 
            });
        }

        const newId = Date.now();
        
        // Satıcı ID'lerini isimlere dönüştür
        const sellerNames = sellerIds.map(id => {
            const seller = MOCK_SELLERS.find(s => s.id === id);
            return seller ? seller.name : "Bilinmeyen Satıcı";
        });

        const newCoupon = {
            id: newId,
            code,
            amount,
            sellers: sellerNames
        };

        MOCK_COUPONS.push(newCoupon);

        res.json({ 
            success: true, 
            coupon: newCoupon 
        });
    } catch (error) {
        console.error("Kupon ekleme hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası. Kupon eklenemedi." 
        });
    }
});

/**
 * DELETE /api/admin/coupons/:id
 * Kuponu sil
 */
router.delete("/coupons/:id", (req, res) => {
    try {
        const couponId = parseInt(req.params.id);
        const couponIndex = MOCK_COUPONS.findIndex(c => c.id === couponId);

        if (couponIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: "Kupon bulunamadı." 
            });
        }

        MOCK_COUPONS.splice(couponIndex, 1);

        res.json({ 
            success: true, 
            message: "Kupon silindi." 
        });
    } catch (error) {
        console.error("Kupon silme hatası:", error);
        res.status(500).json({ 
            success: false, 
            message: "Sunucu hatası." 
        });
    }
});

module.exports = router;

