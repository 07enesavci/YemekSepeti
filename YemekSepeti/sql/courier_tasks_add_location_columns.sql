-- Kurye anlık konum takibi için courier_tasks tablosuna sütunlar.
-- Sipariş takibinde haritada kurye konumu gösterilir.
-- Çalıştırma: mysql -u kullanici -p veritabani < sql/courier_tasks_add_location_columns.sql

ALTER TABLE courier_tasks
  ADD COLUMN IF NOT EXISTS courier_latitude DECIMAL(10,7) NULL,
  ADD COLUMN IF NOT EXISTS courier_longitude DECIMAL(11,7) NULL;

-- MySQL 5.x için IF NOT EXISTS desteklenmeyebilir; o zaman aşağıdaki tek satırlık versiyonu kullanın:
-- ALTER TABLE courier_tasks ADD COLUMN courier_latitude DECIMAL(10,7) NULL, ADD COLUMN courier_longitude DECIMAL(11,7) NULL;
