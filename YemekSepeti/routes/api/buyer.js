const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const { requireRole } = require("../../middleware/auth");
const bcrypt = require("bcryptjs");
const { User } = require("../../models");


// ============================================
// BUYER API ROUTES
// ============================================

/**
 * GET /api/buyer/profile
 * Buyer profil bilgilerini getir
 */
router.get("/profile", requireRole('buyer'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        console.log("✅ Buyer profil isteği - User ID:", userId);
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "Kullanıcı ID bulunamadı."
            });
        }
        
        // Kullanıcıyı getir (Sequelize)
        const user = await User.findByPk(userId, {
            attributes: ['id', 'email', 'fullname', 'phone', 'role', 'created_at']
        });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Kullanıcı bulunamadı."
            });
        }
        
        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                fullname: user.fullname,
                phone: user.phone,
                role: user.role,
                createdAt: user.created_at
            }
        });
    } catch (error) {
        console.error("❌ Buyer profil getirme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası: " + error.message
        });
    }
});

/**
 * PUT /api/buyer/profile
 * Buyer profil bilgilerini güncelle
 */
router.put("/profile", requireRole('buyer'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { fullname, phone } = req.body;
        
        console.log("✅ Buyer profil güncelleme isteği - User ID:", userId, "Data:", { fullname, phone });
        
        if (!fullname || !fullname.trim()) {
            return res.status(400).json({
                success: false,
                message: "Ad soyad gereklidir."
            });
        }
        
        let updateFields = ["fullname = ?"];
        let updateValues = [fullname.trim()];
        
        if (phone) {
            updateFields.push("phone = ?");
            updateValues.push(phone.trim());
        }
        
        updateValues.push(userId);
        
        // Profil güncelle (Sequelize)
        const updateData = { fullname: fullname.trim() };
        if (phone) {
            updateData.phone = phone.trim();
        }
        
        await User.update(updateData, {
            where: { id: userId }
        });
        
        // Güncellenmiş kullanıcı bilgilerini al
        const updatedUser = await db.query(
            "SELECT id, email, fullname, phone, role FROM users WHERE id = ?",
            [userId]
        );
        
        // Session'ı güncelle
        if (updatedUser.length > 0) {
            req.session.user.fullname = updatedUser[0].fullname;
            req.session.user.phone = updatedUser[0].phone;
        }
        
        res.json({
            success: true,
            message: "Profil bilgileri başarıyla güncellendi.",
            user: updatedUser[0]
        });
    } catch (error) {
        console.error("❌ Buyer profil güncelleme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası: " + error.message
        });
    }
});

/**
 * GET /api/buyer/addresses
 * Buyer adreslerini getir
 */
router.get("/addresses", requireRole('buyer'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        console.log("✅ Buyer adresler isteği - User ID:", userId);
        
        const query = `
            SELECT 
                id,
                title,
                district,
                city,
                full_address,
                is_default,
                created_at
            FROM addresses
            WHERE user_id = ?
            ORDER BY is_default DESC, created_at DESC
        `;
        
        const addresses = await db.query(query, [userId]);
        
        const formattedAddresses = addresses.map(addr => {
            // full_address kullan, yoksa district ve city'den oluştur
            const fullDetail = addr.full_address || `${addr.district || ''}, ${addr.city || ''}`.replace(/^,\s*|,\s*$/g, '');
            const shortDetail = fullDetail.length > 50 ? fullDetail.substring(0, 50) + '...' : fullDetail;
            
            return {
                id: addr.id,
                title: addr.title || "Adres",
                detail: shortDetail,
                isDefault: addr.is_default === 1 || addr.is_default === true,
                district: addr.district,
                city: addr.city,
                fullDetail: fullDetail
            };
        });
        
        res.json({
            success: true,
            data: formattedAddresses
        });
    } catch (error) {
        console.error("❌ Buyer adresler getirme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası: " + error.message
        });
    }
});

/**
 * POST /api/buyer/addresses
 * Yeni adres ekle
 */
router.post("/addresses", requireRole('buyer'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { title, district, city, detail, isDefault } = req.body;
        
        console.log("✅ Yeni adres ekleme isteği - User ID:", userId, "Data:", { title, district, city, detail, isDefault });
        
        if (!title || !district || !city || !detail) {
            return res.status(400).json({
                success: false,
                message: "Tüm adres alanları gereklidir."
            });
        }
        
        // Eğer varsayılan adres yapılıyorsa, diğer adreslerin varsayılan durumunu kaldır
        if (isDefault) {
            await db.execute(
                "UPDATE addresses SET is_default = 0 WHERE user_id = ?",
                [userId]
            );
        }
        
        // full_address alanını detail ile doldur (veritabanı şemasına uygun)
        const fullAddress = `${detail.trim()}, ${district.trim()}, ${city.trim()}`;
        const result = await db.execute(
            `INSERT INTO addresses (user_id, title, district, city, full_address, is_default)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, title.trim(), district.trim(), city.trim(), fullAddress, isDefault ? 1 : 0]
        );
        
        res.json({
            success: true,
            message: "Yeni adres başarıyla kaydedildi.",
            addressId: result.insertId
        });
    } catch (error) {
        console.error("❌ Yeni adres ekleme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası: " + error.message
        });
    }
});

/**
 * PUT /api/buyer/addresses/:id
 * Adres güncelle
 */
router.put("/addresses/:id", requireRole('buyer'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        const addressId = parseInt(req.params.id);
        const { title, district, city, detail, isDefault } = req.body;
        
        console.log("✅ Adres güncelleme isteği - User ID:", userId, "Address ID:", addressId);
        
        // Adresin kullanıcıya ait olduğunu kontrol et
        const addressCheck = await db.query(
            "SELECT id FROM addresses WHERE id = ? AND user_id = ?",
            [addressId, userId]
        );
        
        if (addressCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Adres bulunamadı veya size ait değil."
            });
        }
        
        // Eğer varsayılan adres yapılıyorsa, diğer adreslerin varsayılan durumunu kaldır
        if (isDefault) {
            await db.execute(
                "UPDATE addresses SET is_default = 0 WHERE user_id = ? AND id != ?",
                [userId, addressId]
            );
        }
        
        let updateFields = [];
        let updateValues = [];
        
        if (title) {
            updateFields.push("title = ?");
            updateValues.push(title.trim());
        }
        if (district) {
            updateFields.push("district = ?");
            updateValues.push(district.trim());
        }
        if (city) {
            updateFields.push("city = ?");
            updateValues.push(city.trim());
        }
        if (detail) {
            // full_address'i güncelle
            const fullAddress = `${detail.trim()}, ${district || ''}, ${city || ''}`.replace(/^,\s*|,\s*$/g, '');
            updateFields.push("full_address = ?");
            updateValues.push(fullAddress);
        }
        if (isDefault !== undefined) {
            updateFields.push("is_default = ?");
            updateValues.push(isDefault ? 1 : 0);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Güncellenecek alan bulunamadı."
            });
        }
        
        updateValues.push(addressId);
        
        await db.execute(
            `UPDATE addresses SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );
        
        res.json({
            success: true,
            message: "Adres başarıyla güncellendi."
        });
    } catch (error) {
        console.error("❌ Adres güncelleme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası: " + error.message
        });
    }
});

/**
 * DELETE /api/buyer/addresses/:id
 * Adres sil
 */
router.delete("/addresses/:id", requireRole('buyer'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        const addressId = parseInt(req.params.id);
        
        console.log("✅ Adres silme isteği - User ID:", userId, "Address ID:", addressId);
        
        // Adresin kullanıcıya ait olduğunu kontrol et
        const addressCheck = await db.query(
            "SELECT id FROM addresses WHERE id = ? AND user_id = ?",
            [addressId, userId]
        );
        
        if (addressCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Adres bulunamadı veya size ait değil."
            });
        }
        
        await db.execute(
            "DELETE FROM addresses WHERE id = ? AND user_id = ?",
            [addressId, userId]
        );
        
        res.json({
            success: true,
            message: "Adres başarıyla silindi."
        });
    } catch (error) {
        console.error("❌ Adres silme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası: " + error.message
        });
    }
});

/**
 * GET /api/buyer/wallet
 * Buyer cüzdan ve kupon bilgilerini getir
 */
router.get("/wallet", requireRole('buyer'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        console.log("✅ Buyer cüzdan isteği - User ID:", userId);
        
        // Cüzdan bakiyesi (şimdilik 0, ileride wallet tablosu eklenebilir)
        const balance = 0;
        
        // Aktif kuponları getir
        const couponsSql = `
            SELECT 
                id,
                code,
                description,
                discount_type,
                discount_value,
                min_order_amount,
                max_discount_amount,
                applicable_seller_ids,
                valid_from,
                valid_until
            FROM coupons
            WHERE is_active = TRUE
            AND NOW() >= valid_from
            AND NOW() <= valid_until
            AND (usage_limit = -1 OR used_count < usage_limit)
            ORDER BY created_at DESC
        `;
        const coupons = await db.query(couponsSql);
        
        // Kuponları formatla ve restoran bilgilerini ekle
        const formattedCoupons = await Promise.all(coupons.map(async (c) => {
            let applicableSellers = null;
            let sellerNames = [];
            
            try {
                if (c.applicable_seller_ids) {
                    applicableSellers = JSON.parse(c.applicable_seller_ids);
                    
                    // Restoran isimlerini getir
                    if (applicableSellers && applicableSellers.length > 0) {
                        const placeholders = applicableSellers.map(() => '?').join(',');
                        const sellersQuery = `SELECT id, shop_name FROM sellers WHERE id IN (${placeholders}) AND is_active = 1`;
                        const sellers = await db.query(sellersQuery, applicableSellers);
                        sellerNames = sellers.map(s => ({ id: s.id, name: s.shop_name }));
                    }
                } else {
                    // Tüm restoranlar için geçerli
                    sellerNames = null; // null = tüm restoranlar
                }
            } catch (e) {
                applicableSellers = null;
                sellerNames = null;
            }
            
            return {
                id: c.id,
                code: c.code,
                description: c.description || '',
                discountType: c.discount_type,
                discountValue: parseFloat(c.discount_value) || 0,
                minOrderAmount: parseFloat(c.min_order_amount) || 0,
                maxDiscountAmount: c.max_discount_amount ? parseFloat(c.max_discount_amount) : null,
                applicableSellerIds: applicableSellers,
                applicableSellers: sellerNames, // Restoran isimleri
                validFrom: c.valid_from,
                validUntil: c.valid_until
            };
        }));
        
        res.json({
            success: true,
            data: {
                balance: balance,
                coupons: formattedCoupons
            }
        });
    } catch (error) {
        console.error("❌ Buyer cüzdan getirme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası: " + error.message
        });
    }
});

/**
 * PUT /api/buyer/password
 * Şifre değiştir
 */
router.put("/password", requireRole('buyer'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { currentPassword, newPassword } = req.body;
        
        console.log("✅ Şifre değiştirme isteği - User ID:", userId);
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Mevcut şifre ve yeni şifre gereklidir."
            });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Yeni şifre en az 6 karakter olmalıdır."
            });
        }
        
        // Mevcut şifreyi kontrol et
        const user = await db.query(
            "SELECT id, password FROM users WHERE id = ?",
            [userId]
        );
        
        if (user.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Kullanıcı bulunamadı."
            });
        }
        
        const isPasswordValid = await bcrypt.compare(currentPassword, user[0].password);
        
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Mevcut şifre yanlış."
            });
        }
        
        // Yeni şifreyi hashle ve güncelle
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        await db.execute(
            "UPDATE users SET password = ? WHERE id = ?",
            [hashedPassword, userId]
        );
        
        res.json({
            success: true,
            message: "Şifre başarıyla değiştirildi."
        });
    } catch (error) {
        console.error("❌ Şifre değiştirme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası: " + error.message
        });
    }
});

/**
 * GET /api/buyer/payment-cards
 * Buyer ödeme kartlarını getir
 */
router.get("/payment-cards", requireRole('buyer'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        console.log("✅ Buyer ödeme kartları isteği - User ID:", userId);
        
        // Önce payment_cards tablosunun var olup olmadığını kontrol et
        try {
            const query = `
                SELECT 
                    id,
                    card_name,
                    card_number,
                    card_expiry_month,
                    card_expiry_year,
                    card_cvc,
                    is_default,
                    created_at
                FROM payment_cards
                WHERE user_id = ?
                ORDER BY is_default DESC, created_at DESC
            `;
            
            const cards = await db.query(query, [userId]);
            
            const formattedCards = cards.map(card => ({
                id: card.id,
                cardName: card.card_name || "Kart",
                cardNumber: card.card_number ? `**** **** **** ${card.card_number.slice(-4)}` : "**** **** **** ****",
                cardLastFour: card.card_number ? card.card_number.slice(-4) : "****",
                expiryMonth: card.card_expiry_month,
                expiryYear: card.card_expiry_year,
                isDefault: card.is_default === 1 || card.is_default === true
            }));
            
            res.json({
                success: true,
                data: formattedCards
            });
        } catch (tableError) {
            // Tablo yoksa boş array döndür
            if (tableError.message.includes("doesn't exist") || tableError.message.includes("Unknown column")) {
                console.log("⚠️ payment_cards tablosu bulunamadı, boş liste döndürülüyor");
                res.json({
                    success: true,
                    data: []
                });
            } else {
                throw tableError;
            }
        }
    } catch (error) {
        console.error("❌ Buyer ödeme kartları getirme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası: " + error.message
        });
    }
});

/**
 * POST /api/buyer/payment-cards
 * Yeni ödeme kartı ekle
 */
router.post("/payment-cards", requireRole('buyer'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { cardName, cardNumber, expiryMonth, expiryYear, cvc, isDefault } = req.body;
        
        console.log("✅ Yeni ödeme kartı ekleme isteği - User ID:", userId);
        
        if (!cardName || !cardNumber || !expiryMonth || !expiryYear) {
            return res.status(400).json({
                success: false,
                message: "Tüm kart bilgileri gereklidir."
            });
        }
        
        // Kart numarasını temizle (sadece rakamlar)
        const cleanCardNumber = cardNumber.replace(/\s/g, '');
        
        if (cleanCardNumber.length < 13 || cleanCardNumber.length > 19) {
            return res.status(400).json({
                success: false,
                message: "Geçersiz kart numarası."
            });
        }
        
        // Son 4 haneyi sakla (güvenlik için)
        const cardLastFour = cleanCardNumber.slice(-4);
        
        // Eğer varsayılan kart yapılıyorsa, diğer kartların varsayılan durumunu kaldır
        if (isDefault) {
            try {
                await db.execute(
                    "UPDATE payment_cards SET is_default = 0 WHERE user_id = ?",
                    [userId]
                );
            } catch (updateError) {
                // Tablo yoksa hata verme
                if (!updateError.message.includes("doesn't exist") && !updateError.message.includes("Unknown column")) {
                    throw updateError;
                }
            }
        }
        
        try {
            const result = await db.execute(
                `INSERT INTO payment_cards (user_id, card_name, card_number, card_expiry_month, card_expiry_year, card_cvc, is_default)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [userId, cardName.trim(), cardLastFour, expiryMonth, expiryYear, cvc ? '***' : null, isDefault ? 1 : 0]
            );
            
            res.json({
                success: true,
                message: "Ödeme kartı başarıyla kaydedildi.",
                cardId: result.insertId
            });
        } catch (insertError) {
            // Tablo yoksa oluştur
            if (insertError.message.includes("doesn't exist") || insertError.message.includes("Unknown column")) {
                console.log("⚠️ payment_cards tablosu bulunamadı, oluşturuluyor...");
                
                // Tabloyu oluştur
                await db.execute(`
                    CREATE TABLE IF NOT EXISTS payment_cards (
                        id INT PRIMARY KEY AUTO_INCREMENT,
                        user_id INT NOT NULL,
                        card_name VARCHAR(100) NOT NULL,
                        card_number VARCHAR(4) NOT NULL,
                        card_expiry_month INT NOT NULL,
                        card_expiry_year INT NOT NULL,
                        card_cvc VARCHAR(3) NULL,
                        is_default BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        INDEX idx_user_id (user_id),
                        INDEX idx_is_default (is_default)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                `);
                
                // Tekrar ekle
                const result = await db.execute(
                    `INSERT INTO payment_cards (user_id, card_name, card_number, card_expiry_month, card_expiry_year, card_cvc, is_default)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [userId, cardName.trim(), cardLastFour, expiryMonth, expiryYear, cvc ? '***' : null, isDefault ? 1 : 0]
                );
                
                res.json({
                    success: true,
                    message: "Ödeme kartı başarıyla kaydedildi.",
                    cardId: result.insertId
                });
            } else {
                throw insertError;
            }
        }
    } catch (error) {
        console.error("❌ Yeni ödeme kartı ekleme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası: " + error.message
        });
    }
});

/**
 * GET /api/buyer/coupons/active
 * Aktif ve geçerli kuponları getir (herkes görebilir)
 */
router.get("/coupons/active", async (req, res) => {
    try {
        const sql = `
            SELECT 
                id,
                code,
                description,
                discount_type,
                discount_value,
                min_order_amount,
                max_discount_amount,
                applicable_seller_ids,
                valid_from,
                valid_until
            FROM coupons
            WHERE is_active = TRUE
            AND NOW() >= valid_from
            AND NOW() <= valid_until
            AND (usage_limit = -1 OR used_count < usage_limit)
            ORDER BY created_at DESC
            LIMIT 10
        `;
        const coupons = await db.query(sql);
        
        const formattedCoupons = coupons.map(c => {
            let applicableSellers = null;
            try {
                if (c.applicable_seller_ids) {
                    applicableSellers = JSON.parse(c.applicable_seller_ids);
                }
            } catch (e) {
                applicableSellers = null;
            }
            
            return {
                id: c.id,
                code: c.code,
                description: c.description || '',
                discountType: c.discount_type,
                discountValue: parseFloat(c.discount_value) || 0,
                minOrderAmount: parseFloat(c.min_order_amount) || 0,
                maxDiscountAmount: c.max_discount_amount ? parseFloat(c.max_discount_amount) : null,
                applicableSellerIds: applicableSellers,
                validFrom: c.valid_from,
                validUntil: c.valid_until
            };
        });
        
        res.json({ success: true, coupons: formattedCoupons });
    } catch (error) {
        console.error("Aktif kuponlar getirme hatası:", error);
        res.status(500).json({ success: false, message: "Kuponlar yüklenemedi."         });
    }
});

/**
 * GET /api/buyer/orders/:orderId/review
 * Sipariş için yorum var mı kontrol et
 */
router.get("/orders/:orderId/review", requireRole('buyer'), async (req, res) => {
    try {
        const orderId = parseInt(req.params.orderId);
        const userId = req.session.user.id;
        
        // Siparişin bu kullanıcıya ait olduğunu ve teslim edildiğini kontrol et
        const order = await db.query(
            "SELECT id, user_id, seller_id, status FROM orders WHERE id = ? AND user_id = ?",
            [orderId, userId]
        );
        
        if (order.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Sipariş bulunamadı."
            });
        }
        
        if (order[0].status !== 'delivered') {
            return res.status(400).json({
                success: false,
                message: "Sadece teslim edilmiş siparişler için yorum yapılabilir.",
                canReview: false
            });
        }
        
        // Yorum var mı kontrol et
        const review = await db.query(
            "SELECT id, rating, comment, created_at FROM reviews WHERE order_id = ?",
            [orderId]
        );
        
        res.json({
            success: true,
            canReview: review.length === 0,
            review: review.length > 0 ? {
                id: review[0].id,
                rating: review[0].rating,
                comment: review[0].comment,
                createdAt: review[0].created_at
            } : null,
            order: {
                id: order[0].id,
                sellerId: order[0].seller_id
            }
        });
    } catch (error) {
        console.error("Yorum kontrol hatası:", error);
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

/**
 * POST /api/buyer/orders/:orderId/review
 * Sipariş için yorum ekle
 */
router.post("/orders/:orderId/review", requireRole('buyer'), async (req, res) => {
    try {
        const orderId = parseInt(req.params.orderId);
        const userId = req.session.user.id;
        const { rating, comment } = req.body;
        
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: "Yıldız değeri 1-5 arası olmalıdır."
            });
        }
        
        // Siparişin bu kullanıcıya ait olduğunu ve teslim edildiğini kontrol et
        const order = await db.query(
            "SELECT id, user_id, seller_id, status FROM orders WHERE id = ? AND user_id = ?",
            [orderId, userId]
        );
        
        if (order.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Sipariş bulunamadı."
            });
        }
        
        if (order[0].status !== 'delivered') {
            return res.status(400).json({
                success: false,
                message: "Sadece teslim edilmiş siparişler için yorum yapılabilir."
            });
        }
        
        // Zaten yorum var mı kontrol et
        const existingReview = await db.query(
            "SELECT id FROM reviews WHERE order_id = ?",
            [orderId]
        );
        
        if (existingReview.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Bu sipariş için zaten yorum yapılmış."
            });
        }
        
        // Yorum ekle
        const sql = `
            INSERT INTO reviews (order_id, user_id, seller_id, rating, comment)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        await db.execute(sql, [
            orderId,
            userId,
            order[0].seller_id,
            parseInt(rating),
            comment || null
        ]);
        
        res.json({
            success: true,
            message: "Yorum başarıyla eklendi."
        });
    } catch (error) {
        console.error("Yorum ekleme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Yorum eklenemedi."
        });
    }
});

/**
 * GET /api/buyer/reviews/delivered-orders
 * Yorum yapılabilecek teslim edilmiş siparişleri getir
 */
router.get("/reviews/delivered-orders", requireRole('buyer'), async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        const sql = `
            SELECT 
                o.id,
                o.order_number,
                o.total_amount,
                o.delivered_at,
                s.shop_name as sellerName,
                s.id as sellerId,
                CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END as hasReview
            FROM orders o
            INNER JOIN sellers s ON o.seller_id = s.id
            LEFT JOIN reviews r ON o.id = r.order_id
            WHERE o.user_id = ?
            AND o.status = 'delivered'
            ORDER BY o.delivered_at DESC
            LIMIT 20
        `;
        
        const orders = await db.query(sql, [userId]);
        
        res.json({
            success: true,
            orders: orders.map(o => ({
                id: o.id,
                orderNumber: o.order_number,
                totalAmount: parseFloat(o.total_amount),
                deliveredAt: o.delivered_at,
                sellerName: o.sellerName,
                sellerId: o.sellerId,
                hasReview: o.hasReview === 1
            }))
        });
    } catch (error) {
        console.error("Teslim edilmiş siparişler getirme hatası:", error);
        res.status(500).json({
            success: false,
            message: "Siparişler yüklenemedi."
        });
    }
});

module.exports = router;

