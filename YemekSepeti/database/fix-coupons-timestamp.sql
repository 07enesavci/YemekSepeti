-- coupons tablosunda created_at / updated_at için DEFAULT yoksa ekler (500 hatasını önler)
-- Çalıştırma: mysql -u root -p yemek_sepeti < database/fix-coupons-timestamp.sql
-- veya MySQL client'ta: USE yemek_sepeti; sonra bu ALTER'ı yapıştırın.

ALTER TABLE coupons
  MODIFY COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  MODIFY COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
