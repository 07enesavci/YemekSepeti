-- Süper admin ve destek rolleri için users.role ENUM güncellemesi.
-- Çalıştırma: mysql -u kullanici -p veritabani < sql/users_add_roles.sql

ALTER TABLE users
  MODIFY COLUMN role ENUM('buyer','seller','courier','admin','super_admin','support') NOT NULL DEFAULT 'buyer';
