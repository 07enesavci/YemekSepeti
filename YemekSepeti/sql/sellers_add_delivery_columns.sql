-- sellers tablosuna API / Sequelize Seller modeli ile uyumlu sütunlar
-- Eski veritabanlarında eksikse çalıştırın: npm run migrate:sellers

ALTER TABLE sellers ADD COLUMN is_open TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Mağaza acik mi';
ALTER TABLE sellers ADD COLUMN delivery_radius_km INT NOT NULL DEFAULT 0 COMMENT 'Teslimat yaricapi km, 0=sinirsiz';
ALTER TABLE sellers ADD COLUMN latitude DECIMAL(10,8) NULL COMMENT 'Satıcı enlem';
ALTER TABLE sellers ADD COLUMN longitude DECIMAL(11,8) NULL COMMENT 'Satıcı boylam';
