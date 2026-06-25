-- Adım 1: address_id nullable yap (pickup siparişlerinde adres gerekmez)
ALTER TABLE `orders`
MODIFY COLUMN `address_id` INT DEFAULT NULL;

-- Adım 2: delivery_type kolonu ekle (yoksa) — 'cargo' dahil tüm değerlerle
ALTER TABLE `orders`
ADD COLUMN `delivery_type` ENUM('delivery', 'pickup', 'cargo') NOT NULL DEFAULT 'delivery' AFTER `address_id`;

-- Adım 3: Kolon zaten varsa ENUM'u genişlet ('cargo' eski şemalarda eksik olabilir)
ALTER TABLE `orders`
MODIFY COLUMN `delivery_type` ENUM('delivery', 'pickup', 'cargo') NOT NULL DEFAULT 'delivery';
