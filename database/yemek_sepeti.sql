-- Yemek Sepeti veritabanı şeması (MySQL)
-- UTF8MB4 ve InnoDB kullanılır

-- Veritabanını oluştur
CREATE DATABASE IF NOT EXISTS yemek_sepeti CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE yemek_sepeti;

-- 1. Kullanıcılar (users)
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    fullname VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role ENUM('buyer', 'seller', 'courier', 'admin') NOT NULL DEFAULT 'buyer',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Satıcılar (sellers)
CREATE TABLE sellers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    shop_name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url VARCHAR(500),
    banner_url VARCHAR(500),
    rating DECIMAL(3,2) DEFAULT 0.00,
    total_reviews INT DEFAULT 0,
    opening_hours JSON, -- {"monday": "09:00-22:00", "tuesday": "09:00-22:00", ...}
    delivery_fee DECIMAL(10,2) DEFAULT 15.00,
    min_order_amount DECIMAL(10,2) DEFAULT 50.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_location (location),
    INDEX idx_rating (rating),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Yemekler/Menü (meals)
CREATE TABLE meals (
    id INT PRIMARY KEY AUTO_INCREMENT,
    seller_id INT NOT NULL,
    category VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image_url VARCHAR(500),
    is_available BOOLEAN DEFAULT TRUE,
    stock_quantity INT DEFAULT -1, -- -1 = sınırsız
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE,
    INDEX idx_seller_id (seller_id),
    INDEX idx_category (category),
    INDEX idx_is_available (is_available)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Adresler (addresses)
CREATE TABLE addresses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(100) NOT NULL, -- "Ev", "İş", "Anne Evi" gibi
    full_address TEXT NOT NULL,
    district VARCHAR(100),
    city VARCHAR(100) DEFAULT 'İstanbul',
    postal_code VARCHAR(10),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_is_default (is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Sepet (cart_items)
CREATE TABLE cart_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    meal_id INT,
    quantity INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_meal (user_id, meal_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Siparişler (orders)
CREATE TABLE orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_number VARCHAR(50) UNIQUE NOT NULL, -- "ORD-2025-001234" formatında
    user_id INT NOT NULL,
    seller_id INT NOT NULL,
    courier_id INT NULL, -- Sipariş kuryeye atandığında doldurulur
    address_id INT NOT NULL,
    payment_method ENUM('credit_card', 'cash', 'wallet') NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 15.00,
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    coupon_code VARCHAR(50) NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'confirmed', 'preparing', 'ready', 'on_delivery', 'delivered', 'cancelled') DEFAULT 'pending',
    notes TEXT, -- Müşteri notları
    estimated_delivery_time TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE RESTRICT,
    FOREIGN KEY (courier_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE RESTRICT,
    INDEX idx_user_id (user_id),
    INDEX idx_seller_id (seller_id),
    INDEX idx_courier_id (courier_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Sipariş detayları (order_items)
CREATE TABLE order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    meal_id INT ,
    meal_name VARCHAR(255) NOT NULL, -- Yemek silinse bile siparişte görünsün
    meal_price DECIMAL(10,2) NOT NULL, -- O anki fiyat
    quantity INT NOT NULL DEFAULT 1,
    subtotal DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE SET NULL,
    INDEX idx_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Kuponlar (coupons)
CREATE TABLE coupons (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    discount_type ENUM('fixed', 'percentage') NOT NULL DEFAULT 'fixed',
    discount_value DECIMAL(10,2) NOT NULL,
    min_order_amount DECIMAL(10,2) DEFAULT 0.00,
    max_discount_amount DECIMAL(10,2) NULL, -- Yüzde indirimlerde maksimum limit
    applicable_seller_ids JSON NULL, -- NULL = tüm satıcılar, [1,2,3] = belirli satıcılar
    usage_limit INT DEFAULT -1, -- -1 = sınırsız
    used_count INT DEFAULT 0,
    valid_from TIMESTAMP NOT NULL,
    valid_until TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT NULL, -- Admin kullanıcı ID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_code (code),
    INDEX idx_is_active (is_active),
    INDEX idx_valid_dates (valid_from, valid_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Kupon kullanımları (coupon_usages)
CREATE TABLE coupon_usages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    coupon_id INT NOT NULL,
    order_id INT NOT NULL,
    user_id INT NOT NULL,
    discount_amount DECIMAL(10,2) NOT NULL,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE RESTRICT,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    UNIQUE KEY unique_order_coupon (order_id, coupon_id),
    INDEX idx_user_id (user_id),
    INDEX idx_coupon_id (coupon_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Yorumlar/Değerlendirmeler (reviews)
CREATE TABLE reviews (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    user_id INT NOT NULL,
    seller_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    meal_ratings JSON NULL, -- {"meal_id": 5, "meal_id2": 4} formatında
    is_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_order_review (order_id),
    INDEX idx_seller_id (seller_id),
    INDEX idx_rating (rating),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Cüzdan/Bakiye (wallet_transactions)
CREATE TABLE wallet_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    transaction_type ENUM('deposit', 'withdrawal', 'order_payment', 'refund', 'coupon_bonus') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL, -- İşlem sonrası bakiye
    description TEXT,
    related_order_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (related_order_id) REFERENCES orders(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_transaction_type (transaction_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Kurye görevleri (courier_tasks)
CREATE TABLE courier_tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    courier_id INT NOT NULL,
    pickup_location VARCHAR(255) NOT NULL,
    delivery_location VARCHAR(255) NOT NULL,
    estimated_payout DECIMAL(10,2) NOT NULL,
    status ENUM('assigned', 'picked_up', 'on_way', 'delivered', 'cancelled') DEFAULT 'assigned',
    picked_up_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    actual_payout DECIMAL(10,2) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (courier_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_courier_id (courier_id),
    INDEX idx_status (status),
    INDEX idx_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Ödeme işlemleri (payments)
CREATE TABLE payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    payment_method ENUM('credit_card', 'cash', 'wallet') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
    transaction_id VARCHAR(255) NULL, -- Ödeme gateway'den gelen ID
    card_last_four VARCHAR(4) NULL, -- Kredi kartı son 4 hanesi
    payment_date TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_order_id (order_id),
    INDEX idx_status (status),
    INDEX idx_payment_date (payment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Bildirimler (notifications)
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'order_status', 'new_message', 'promotion', etc.
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_id INT NULL, -- İlgili kayıt ID (order_id, coupon_id, vb.)
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Örnek veriler (INSERT)

-- Admin kullanıcı
INSERT INTO users (email, password, fullname, role) VALUES
('admin@yemeksepeti.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin Kullanıcı', 'admin');

-- Test kullanıcıları
INSERT INTO users (email, password, fullname, role) VALUES
('enes@mail.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Enes Avcı', 'buyer'),
('ahmet@mail.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Ahmet Eren', 'buyer'),
('satici@mail.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Ayşe Satıcı', 'seller'),
('kurye@mail.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Şükrü Kurye', 'courier');

-- Satıcılar
INSERT INTO sellers (user_id, shop_name, location, rating, total_reviews, delivery_fee) VALUES
(4, 'Vegan Lezzetler', 'Moda', 4.8, 45, 12.00);

-- Yemekler (görsel URL'leri ile)
INSERT INTO meals (seller_id, category, name, description, price, image_url) VALUES
(1, 'Ana Yemekler', 'Ev Mantısı (Porsiyon)', 'Kayseri usulü, yoğurt ve sos ile.', 110.00, 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&q=80'),
(1, 'Ana Yemekler', 'Kuru Fasulye', 'Geleneksel usulde, yanında pilav ile.', 85.00, 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=800&q=80'),
(1, 'Tatlılar', 'Fırın Sütlaç', 'Ev yapımı, bol fındıklı.', 60.00, 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800&q=80'),
(1, 'Kebaplar', 'Adana Kebap', 'Acılı, porsiyon.', 130.00, 'https://images.unsplash.com/photo-1562967914-608f82629710?w=800&q=80'),
(1, 'Pide', 'Kıymalı Pide', 'Bol malzemeli.', 90.00, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80');

-- Yardımcı görünümler (VIEW)

-- Satıcı detay görünümü
CREATE VIEW v_seller_details AS
SELECT 
    s.id,
    s.shop_name,
    s.location,
    s.rating,
    s.total_reviews,
    s.delivery_fee,
    s.min_order_amount,
    u.email,
    u.fullname as owner_name,
    u.phone,
    COUNT(DISTINCT m.id) as meal_count
FROM sellers s
INNER JOIN users u ON s.user_id = u.id
LEFT JOIN meals m ON s.id = m.seller_id AND m.is_available = TRUE
WHERE s.is_active = TRUE
GROUP BY s.id;

-- Sipariş özet görünümü
CREATE VIEW v_order_summary AS
SELECT 
    o.id,
    o.order_number,
    o.user_id,
    u.fullname as customer_name,
    o.seller_id,
    s.shop_name,
    o.courier_id,
    courier.fullname as courier_name,
    o.status,
    o.total_amount,
    o.created_at,
    COUNT(oi.id) as item_count
FROM orders o
INNER JOIN users u ON o.user_id = u.id
INNER JOIN sellers s ON o.seller_id = s.id
LEFT JOIN users courier ON o.courier_id = courier.id
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id;

-- Tetikleyiciler (TRIGGER)
-- Not: DELIMITER MySQL içindir; farklı istemcilerde uyarlayın

-- Sipariş numarası otomatik oluşturma
DELIMITER //
CREATE TRIGGER trg_generate_order_number
BEFORE INSERT ON orders
FOR EACH ROW
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        SET NEW.order_number = CONCAT('ORD-', YEAR(NOW()), '-', LPAD((SELECT COALESCE(MAX(CAST(SUBSTRING(order_number, -6) AS UNSIGNED)), 0) + 1 FROM orders WHERE YEAR(created_at) = YEAR(NOW())), 6, '0'));
    END IF;
END//
DELIMITER ;

-- Yorum eklendiğinde satıcı rating'ini güncelle
DELIMITER //
CREATE TRIGGER trg_update_seller_rating
AFTER INSERT ON reviews
FOR EACH ROW
BEGIN
    UPDATE sellers s
    SET 
        s.rating = (
            SELECT AVG(rating) 
            FROM reviews 
            WHERE seller_id = NEW.seller_id AND is_visible = TRUE
        ),
        s.total_reviews = (
            SELECT COUNT(*) 
            FROM reviews 
            WHERE seller_id = NEW.seller_id AND is_visible = TRUE
        )
    WHERE s.id = NEW.seller_id;
END//
DELIMITER ;

-- Kupon kullanım sayısını güncelle
DELIMITER //
CREATE TRIGGER trg_update_coupon_usage
AFTER INSERT ON coupon_usages
FOR EACH ROW
BEGIN
    UPDATE coupons
    SET used_count = used_count + 1
    WHERE id = NEW.coupon_id;
END//
DELIMITER ;

-- Saklı yordamlar (PROCEDURE)
-- Not: DELIMITER MySQL içindir; farklı istemcilerde uyarlayın

-- Kullanıcı cüzdan bakiyesini hesapla
DELIMITER //
CREATE PROCEDURE sp_get_user_wallet_balance(IN p_user_id INT)
BEGIN
    SELECT 
        COALESCE(SUM(CASE WHEN transaction_type IN ('deposit', 'refund', 'coupon_bonus') THEN amount ELSE -amount END), 0) as balance
    FROM wallet_transactions
    WHERE user_id = p_user_id;
END//
DELIMITER ;

-- Satıcı günlük kazancını hesapla
DELIMITER //
CREATE PROCEDURE sp_get_seller_daily_earnings(IN p_seller_id INT, IN p_date DATE)
BEGIN
    SELECT 
        COUNT(*) as order_count,
        SUM(total_amount) as total_earnings,
        SUM(delivery_fee) as delivery_fees
    FROM orders
    WHERE seller_id = p_seller_id
    AND DATE(created_at) = p_date
    AND status IN ('delivered', 'on_delivery');
END//
DELIMITER ;

-- Sonuç: şema hazır. MySQL ile çalıştırabilirsiniz.

