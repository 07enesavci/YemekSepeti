ALTER TABLE `orders` 
MODIFY COLUMN `address_id` INT DEFAULT NULL,
ADD COLUMN `delivery_type` ENUM('delivery', 'pickup') NOT NULL DEFAULT 'delivery' AFTER `address_id`;
