-- Uzak Mesafe Kargo: ücretlendirme alanları (Faz 1)
-- Not: Normalde Sequelize sync (alter) bu kolonları otomatik ekler.
-- Bu script, sync'in çalışmadığı ortamlar için elle çalıştırılabilir.
-- Kolon zaten varsa ilgili ALTER hata verebilir; her satırı ayrı çalıştırın.

-- sellers: kargo ücret modu + sabit ücret + ücretsiz eşiği
ALTER TABLE `sellers`
    ADD COLUMN `cargo_pricing_mode` ENUM('free','flat','by_region','by_weight') NOT NULL DEFAULT 'free' AFTER `uzak_mesafe_enabled`;

ALTER TABLE `sellers`
    ADD COLUMN `cargo_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER `cargo_pricing_mode`;

ALTER TABLE `sellers`
    ADD COLUMN `cargo_free_threshold` DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER `cargo_fee`;

-- ENUM zaten varsa ileri fazlar için genişlet (idempotent güvence)
ALTER TABLE `sellers`
    MODIFY COLUMN `cargo_pricing_mode` ENUM('free','flat','by_region','by_weight') NOT NULL DEFAULT 'free';

-- Faz 2: mesafe/bölge alanları
ALTER TABLE `sellers`
    ADD COLUMN `cargo_fee_per_100km` DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER `cargo_free_threshold`;

ALTER TABLE `sellers`
    ADD COLUMN `cargo_regions` JSON DEFAULT NULL AFTER `cargo_fee_per_100km`;

ALTER TABLE `sellers`
    ADD COLUMN `cargo_max_distance_km` INT NOT NULL DEFAULT 0 AFTER `cargo_regions`;

-- Faz 5: ağırlık bazlı ücret alanları
ALTER TABLE `sellers`
    ADD COLUMN `cargo_fee_per_desi` DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER `cargo_fee_per_100km`;

ALTER TABLE `meals`
    ADD COLUMN `cargo_weight_desi` DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER `is_uzak_mesafe`;

-- orders: kargo takip linki (Faz 3)
ALTER TABLE `orders`
    ADD COLUMN `cargo_tracking_url` VARCHAR(500) DEFAULT NULL AFTER `cargo_tracking_number`;
