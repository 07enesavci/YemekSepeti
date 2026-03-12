# Yemek Sepeti / Ev Lezzetleri

Web tabanlı yemek sipariş ve teslimat uygulaması. Alıcılar restoranlardan sipariş verir, satıcılar menü/sipariş yönetir, kuryeler teslimat yapar; admin paneli ile satıcı/kurye onayları ve raporlar yönetilir.

---

## Teknoloji

- **Backend:** Node.js, Express
- **Veritabanı:** MySQL — yerel veya bulut (mysql2 + Sequelize ORM). Bulut kullanımında SSL desteklenir (Aiven, PlanetScale vb.).
- **Oturum:** express-session (MySQL store opsiyonel)
- **Şablon:** EJS, express-ejs-layouts
- **Güvenlik:** Helmet, express-rate-limit, express-validator (auth)
- **Gerçek zamanlı:** Socket.IO
- **E-posta:** Nodemailer (kayıt doğrulama, şifre sıfırlama, onay e-postaları)

---

## Gereksinimler

- Node.js 18+
- MySQL 8 (veya 5.7) — **yerel** veya **bulut** (Aiven, PlanetScale, AWS RDS vb.)
- (Opsiyonel) SMTP veya Gmail uygulama şifresi — e-posta göndermek için

---

## Kurulum

1. Depoyu klonlayın, proje klasörüne girin:
   ```bash
   cd YemekSepeti
   ```

2. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```

3. `.env` dosyası oluşturun (`.env.example` kopyalayıp düzenleyin):
   ```bash
   cp .env.example .env
   ```
   Aşağıdaki değişkenleri doldurun:
   - **Veritabanı:** `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   - **Bulut veritabanı:** `DB_SSL=true` (ve isteğe bağlı `DB_CA_PATH=./path/to/ca.pem`)
   - **Güvenlik:** `SESSION_SECRET`, `JWT_SECRET` (üretimde mutlaka güçlü değerler)
   - **E-posta (opsiyonel):** `EMAIL_SERVICE` / `EMAIL_USER` / `EMAIL_PASS` veya `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_USER` / `EMAIL_PASS`

4. MySQL’de veritabanını oluşturun (yerel veya bulut panelinden):
   ```sql
   CREATE DATABASE yemek_sepeti CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
   Uygulama ilk çalıştırmada Sequelize ile tabloları oluşturur/senkronize eder.

5. Uygulamayı başlatın:
   ```bash
   npm run dev
   ```
   Tarayıcıda: **http://localhost:3000**

---

## Ortam Değişkenleri (.env)

| Değişken | Açıklama | Varsayılan |
|----------|----------|------------|
| DB_HOST | MySQL sunucu (yerel veya bulut host) | localhost |
| DB_PORT | MySQL port | 3306 |
| DB_USER | MySQL kullanıcı | root |
| DB_PASSWORD | MySQL şifre | (boş) |
| DB_NAME | Veritabanı adı | yemek_sepeti |
| DB_SSL | Bulut MySQL için SSL: `true` | (boş = SSL yok) |
| DB_CA_PATH | SSL CA sertifika dosya yolu (opsiyonel) | (boş) |
| SESSION_SECRET | Oturum imzası | (üretimde zorunlu) |
| JWT_SECRET | JWT imzası | (üretimde zorunlu) |
| USE_MYSQL_SESSION | Oturumu MySQL’de sakla (true/false) | (opsiyonel) |
| NODE_ENV | development / production | development |
| EMAIL_* | E-posta (Gmail veya SMTP) | Test modunda e-posta gönderilmez |

---

## Veritabanı Tabloları (Sequelize modelleri)

| Tablo | Açıklama |
|-------|----------|
| users | Kullanıcılar (alıcı, satıcı, kurye, admin) |
| sellers | Satıcı mağaza bilgisi, belgeler, location |
| couriers | Kurye bilgisi, kimlik/ehliyet belgeleri, is_active |
| meals | Ürünler (satıcıya bağlı) |
| addresses | Kullanıcı adresleri (latitude, longitude opsiyonel) |
| cart_items | Sepet kalemleri (user_id, meal_id, adet) |
| orders | Siparişler (user_id, seller_id, courier_id, address_id, status, delivery_fee, total_amount, delivered_at) |
| order_items | Sipariş kalemleri |
| coupons | Kuponlar (code, discount_type, discount_value, min_order_amount, applicable_seller_ids, valid_from, valid_until) |
| coupon_usages | Kupon kullanım kayıtları |
| reviews | Restoran/sipariş değerlendirmeleri (rating, comment) |
| wallet_transactions | Cüzdan hareketleri (ileride ödeme için) |
| courier_tasks | Kurye görevleri (order_id, courier_id, pickup/delivery location, estimated_payout, actual_payout, status, picked_up_at, delivered_at) |
| payments | Ödeme kayıtları (şu an placeholder) |
| notifications | Kullanıcı bildirimleri |
| email_verification_codes | E-posta doğrulama kodları |
| user_favorite_sellers | Alıcı favori restoranları |

Session store için `sessions` tablosu kullanılır (USE_MYSQL_SESSION=true ise express-mysql-session ile oluşturulur).

---

## Bulut veritabanı

Proje **yerel MySQL** ile birlikte **bulut MySQL** (Aiven, PlanetScale, AWS RDS, Azure Database for MySQL vb.) ile çalışacak şekilde yapılandırılmıştır:

- `.env` içinde `DB_HOST` olarak bulut sunucu adresini verin (ör. `xxx.aivencloud.com`).
- SSL zorunlu ise `DB_SSL=true` ekleyin. Kod, `DB_HOST` içinde `aivencloud.com` geçiyorsa veya `DB_SSL=true` ise otomatik SSL kullanır.
- İsteğe bağlı: `DB_CA_PATH=./path/to/ca.pem` ile CA sertifikası verin (bazı bulut sağlayıcılar bunu ister).

`config/database.js` ve `config/sequelize.js` bu ayarları okuyup bağlantıyı buna göre kurar.

---

## Proje Yapısı (özet)

```
YemekSepeti/
├── config/          # database.js, sequelize, email
├── middleware/      # auth, security (rate-limit, helmet), validate
├── models/          # Sequelize modelleri (User, Order, Seller, Courier, ...)
├── routes/api/      # auth, seller, orders, cart, admin, courier, buyer, notifications, favorites, reviews
├── views/           # EJS şablonları (common, buyer, seller, courier, admin)
├── public/          # Statik dosyalar, uploads
├── assets/          # CSS, JS (modules: cart, orders, courier, admin, ...)
├── scripts/         # seed-users, verify-seed-login (test/seed)
├── server.js        # Uygulama giriş noktası
├── .env.example
├── API_LIST.md      # Tüm API endpoint listesi
├── PROJECT_IMPROVEMENTS.md  # İyileştirme ve yol haritası
└── README.md        # Bu dosya
```

---

## Komutlar

| Komut | Açıklama |
|--------|----------|
| npm run dev | Nodemon ile geliştirme (localhost:3000) |
| npm start | Production: node server.js |

---

## Dokümantasyon

- **[API_LIST.md](API_LIST.md)** — Tüm API endpoint’leri (auth, sellers, cart, orders, courier, admin, notifications, favorites, reviews, kupon).
- **[PROJECT_IMPROVEMENTS.md](PROJECT_IMPROVEMENTS.md)** — Yapılan düzeltmeler, eklenebilecek özellikler, 3 kişilik görev dağılımı ve sprint önerisi.

---

## Eklenebilecek Özellikler (kısa)

- **Ödeme:** Stripe / Iyzico / PayTR entegrasyonu
- **Canlı konum:** Kurye konumunu haritada gösterme
- **Çoklu dil (i18n):** TR/EN
- **PWA:** Offline sepette temel destek, “Ana ekrana ekle”
- **Kampanya / flash indirim:** Zamanlı indirimler
- **Sipariş iptali ve iade:** İptal sebepleri, kısmi iade akışı
- **Gelişmiş arama/filtre:** Mutfak türü, min sipariş, teslimat ücreti, rating
- **Admin grafikleri:** Günlük/haftalık sipariş ve gelir grafikleri

Detaylı liste ve öncelikler için [PROJECT_IMPROVEMENTS.md](PROJECT_IMPROVEMENTS.md) dosyasına bakın.

---

## Lisans

ISC
