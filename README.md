# 🍽️ Ev Lezzetleri - Yemek Sepeti Projesi

Modern, güvenli ve ölçeklenebilir bir yemek siparişi ve teslimat platformu. Express.js, Sequelize ORM ve MySQL kullanılarak geliştirilmiştir.

![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![Express](https://img.shields.io/badge/Express-4.22-blue.svg)
![Sequelize](https://img.shields.io/badge/Sequelize-6.37-blue.svg)
![MySQL](https://img.shields.io/badge/MySQL-8.0-orange.svg)

---

## 📋 İçindekiler

- [Genel Bakış](#genel-bakış)
- [Test Kullanıcıları ve Giriş Bilgileri](#test-kullanıcıları-ve-giriş-bilgileri)
- [Kullanıcı Rolleri ve Yetkileri](#kullanıcı-rolleri-ve-yetkileri)
- [Genel İşlevler](#genel-işlevler)
- [Kurulum](#kurulum)
- [Yapılandırma](#yapılandırma)
- [API Dokümantasyonu](#api-dokümantasyonu)
- [Proje Yapısı](#proje-yapısı)
- [Geliştirme](#geliştirme)

---

## 🎯 Genel Bakış

Ev Lezzetleri, müşterilerin restoranlardan yemek siparişi verebileceği, satıcıların menülerini yönetebileceği ve kuryelerin teslimat yapabileceği kapsamlı bir platformdur. Proje, modern web teknolojileri kullanılarak geliştirilmiş, güvenli, ölçeklenebilir ve bakımı kolay bir yapıya sahiptir.

### Ana Bileşenler

- **Müşteri Paneli**: Yemek arama, sipariş verme, sipariş takibi
- **Satıcı Paneli**: Menü yönetimi, sipariş yönetimi, kazanç takibi
- **Kurye Paneli**: Teslimat görevleri, kazanç takibi, geçmiş teslimatlar
- **Admin Paneli**: Kullanıcı yönetimi, kupon yönetimi, sistem yönetimi

---

## 👥 Test Kullanıcıları ve Giriş Bilgileri

Projeyi test etmek için hazır kullanıcı hesapları:

### 🔑 Admin Kullanıcısı

- **Email**: `admin@gmail.com`
- **Şifre**: `123456`
- **Rol**: Admin
- **Erişim**: Tüm sistem yönetimi yetkileri

### 🛒 Müşteri (Buyer) Kullanıcıları

1. **Enes Avcı**
   - **Email**: `enes@mail.com`
   - **Şifre**: `123456`
   - **Rol**: Buyer

### 🏪 Satıcı (Seller) Kullanıcısı

- **Email**: `veganlezzetler@mail.com`
- **Şifre**: `123456`
- **Rol**: Seller
- **Satıcı Adı**: "Vegan Lezzetler"
- **Konum**: Moda

### 🚴 Kurye (Courier) Kullanıcısı

- **Email**: `kurye@mail.com`
- **Şifre**: `123456`
- **Rol**: Courier

> **Not**: Tüm test kullanıcıları için şifre: `password` (küçük harf)

---

## 🎭 Kullanıcı Rolleri ve Yetkileri

### 👤 Buyer (Müşteri) - `/buyer/*`

**Yapabildikleri:**
- ✅ Restoranları görüntüleme ve arama
- ✅ Menü öğelerini görüntüleme
- ✅ Sepete ürün ekleme/çıkarma
- ✅ Sipariş verme
- ✅ Sipariş takibi (aktif ve geçmiş siparişler)
- ✅ Adres yönetimi (ekleme, düzenleme, silme)
- ✅ Profil bilgilerini güncelleme
- ✅ Şifre değiştirme
- ✅ Cüzdan işlemleri (bakiye görüntüleme, geçmiş)
- ✅ Kupon kullanma
- ✅ Sipariş iptali

**Erişemeyecekleri:**
- ❌ Admin paneline erişim
- ❌ Satıcı paneline erişim
- ❌ Kurye paneline erişim

---

### 🏪 Seller (Satıcı) - `/seller/:id/*`

**Yapabildikleri:**
- ✅ Menü yönetimi (yemek ekleme, düzenleme, silme)
- ✅ Kategori oluşturma ve yönetimi
- ✅ Menü öğelerinin görselini yükleme
- ✅ Sipariş görüntüleme ve yönetimi
- ✅ Sipariş durumu güncelleme (onaylama, hazırlama, hazır)
- ✅ Satıcı profil yönetimi (logo, banner, açıklama, çalışma saatleri)
- ✅ Kupon oluşturma ve yönetimi
- ✅ Kazanç takibi ve raporlama
- ✅ Günlük/haftalık/aylık istatistikler

**Erişemeyecekleri:**
- ❌ Admin paneline erişim
- ❌ Diğer satıcıların menülerini düzenleme
- ❌ Kurye paneline erişim
- ❌ Müşteri sipariş verme işlemleri (sadece kendi siparişlerini görür)

---

### 🚴 Courier (Kurye) - `/courier/:id/*`

**Yapabildikleri:**
- ✅ Mevcut teslimat görevlerini görüntüleme
- ✅ Teslimat görevini kabul etme
- ✅ Teslimat durumunu güncelleme
- ✅ Teslimat tamamlama
- ✅ Geçmiş teslimatları görüntüleme
- ✅ Kazanç takibi (günlük, haftalık, aylık)
- ✅ Profil yönetimi
- ✅ Teslimat istatistikleri

**Erişemeyecekleri:**
- ❌ Admin paneline erişim
- ❌ Satıcı paneline erişim
- ❌ Sipariş verme veya menü görüntüleme (normal müşteri gibi)

---

### 👨‍💻 Admin - `/admin/*`

**Yapabildikleri:**
- ✅ Tüm kullanıcıları görüntüleme
- ✅ Yeni kullanıcı ekleme (seller, courier)
- ✅ Kullanıcıları dondurma/aktifleştirme
- ✅ Kullanıcı silme
- ✅ Tüm kuponları görüntüleme ve yönetme
- ✅ Kupon oluşturma, düzenleme, silme
- ✅ Satıcı yönetimi
- ✅ Sistem izleme ve log görüntüleme
- ✅ Sistem ayarları

**Erişemeyecekleri:**
- ❌ Kendi sipariş verme (normal bir müşteri olarak kayıt olması gerekir)
- ❌ Satıcı menü düzenleme (sadece kullanıcı yönetimi)

---

## 🚀 Genel İşlevler

### 🔐 Kimlik Doğrulama Sistemi

- **Email Doğrulamalı Kayıt**: Yeni kullanıcılar email doğrulama kodu ile kayıt olur
- **Güvenli Giriş**: JWT token ve session tabanlı kimlik doğrulama
- **Şifre Sıfırlama**: Email ile şifre sıfırlama linki gönderimi
- **2FA Desteği**: İsteğe bağlı iki faktörlü kimlik doğrulama

### 🛒 Sipariş Sistemi

**Sipariş Durumları:**
1. `pending` - Beklemede (müşteri sipariş verdi, satıcı henüz onaylamadı)
2. `confirmed` - Onaylandı (satıcı siparişi onayladı)
3. `preparing` - Hazırlanıyor (satıcı siparişi hazırlıyor)
4. `ready` - Hazır (sipariş hazır, kurye bekleniyor)
5. `on_delivery` - Yolda (kurye teslimata gitti)
6. `delivered` - Teslim Edildi (sipariş teslim edildi)
7. `cancelled` - İptal Edildi

**Sipariş Akışı:**
```
Müşteri → Sipariş Verir → Satıcı Onaylar → Hazırlanır → Hazır Olur 
→ Kurye Alır → Teslimata Gider → Teslim Edilir
```

### 💰 Ödeme ve Cüzdan Sistemi

- Kullanıcı cüzdanı ile ödeme
- Kredi kartı ile ödeme (altyapı hazır)
- Kupon indirimleri
- Otomatik bakiye güncelleme
- İşlem geçmişi

### 🎟️ Kupon Sistemi

**Kupon Tipleri:**
- Sabit tutar indirimi (örn: 50 TL indirim)
- Yüzde indirimi (örn: %20 indirim)
- Maksimum indirim limiti
- Minimum sipariş tutarı
- Belirli satıcılarda geçerlilik
- Geçerlilik süresi

### 📊 Raporlama ve İstatistikler

**Satıcı için:**
- Günlük kazanç
- Haftalık/aylık raporlar
- Sipariş istatistikleri
- Popüler ürünler

**Kurye için:**
- Günlük teslimat sayısı
- Günlük kazanç
- Geçmiş teslimatlar
- Performans metrikleri

**Admin için:**
- Toplam kullanıcı sayısı
- Aktif sipariş sayısı
- Sistem durumu

---

## 🛠️ Teknoloji Yığını

### Backend
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js 4.22
- **ORM**: Sequelize 6.37
- **Database**: MySQL 8.0+ (Aiven Cloud uyumlu)
- **Session**: express-session + MySQL session store
- **Authentication**: JWT + Session-based
- **File Upload**: Multer 2.0

### Frontend
- **Template Engine**: EJS (Embedded JavaScript)
- **Styling**: Vanilla CSS (CSS Variables, Flexbox, Grid)
- **JavaScript**: Vanilla JavaScript (ES6+)
- **Build Tool**: None (Vanilla JS)

### Güvenlik
- **Password Hashing**: bcryptjs
- **Email**: Nodemailer
- **Validation**: Express middleware

---

## 📦 Kurulum

### Gereksinimler

- Node.js v18 veya üzeri
- MySQL 8.0+ veya Aiven Cloud
- npm veya yarn
- Git

### Adım 1: Projeyi Klonlayın

```bash
git clone <repository-url>
cd Yemek-Sepeti
```

### Adım 2: Bağımlılıkları Yükleyin

```bash
npm install
```

### Adım 3: Environment Variables (.env) Oluşturun

Proje kök dizininde `.env` dosyası oluşturun:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=yemek_sepeti
DB_SSL=false

# JWT Secret (ÖNEMLİ: Production'da güçlü bir secret kullanın)
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

# Email Configuration (Gmail örneği)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=noreply@evlezzetleri.com

# Session Secret
SESSION_SECRET=your_session_secret_change_this_in_production

# Application URL
BASE_URL=http://localhost:3000
```

### Adım 4: Veritabanını Kurun

```bash
mysql -u root -p < database/yemek_sepeti.sql
```

veya MySQL içinde:

```sql
source database/yemek_sepeti.sql;
```

### Adım 5: Sunucuyu Başlatın

Development modunda:
```bash
npm run dev
```

Production modunda:
```bash
npm start
```

Uygulama `http://localhost:3000` adresinde çalışacaktır.

---

## ⚙️ Yapılandırma

### Veritabanı Yapılandırması

#### Yerel MySQL

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=yemek_sepeti
DB_SSL=false
```

#### Aiven Cloud / Bulut Veritabanı

```env
DB_HOST=your-project-name.i.aivencloud.com
DB_PORT=14973
DB_USER=avnadmin
DB_PASSWORD=your_password
DB_NAME=yemek_sepeti
DB_SSL=true
```

**Not**: Aiven Cloud için SSL bağlantısı zorunludur. `.env` dosyasında `DB_SSL=true` olarak ayarlayın.

### Email Yapılandırması

#### Gmail

1. Google Hesabınızda "2 Adımlı Doğrulama"yı etkinleştirin
2. "Uygulama Şifreleri" oluşturun
3. `.env` dosyasında kullanın:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

---

## 📚 API Dokümantasyonu

### Authentication Endpoints

#### POST `/api/auth/register`
Kullanıcı kaydı

**Request:**
```json
{
  "fullname": "Ahmet Yılmaz",
  "email": "ahmet@example.com",
  "password": "securePassword123",
  "role": "buyer"
}
```

#### POST `/api/auth/verify-email`
Email doğrulama

#### POST `/api/auth/login`
Kullanıcı girişi

**Request:**
```json
{
  "email": "admin@yemeksepeti.com",
  "password": "password"
}
```

#### POST `/api/auth/forgot-password`
Şifre sıfırlama isteği

#### POST `/api/auth/reset-password`
Şifre sıfırlama

### Seller Endpoints

- `GET /api/seller/menu` - Menüyü getir
- `POST /api/seller/menu` - Yemek ekle
- `PUT /api/seller/menu/:id` - Yemek güncelle
- `DELETE /api/seller/menu/:id` - Yemek sil
- `GET /api/seller/dashboard` - Dashboard verileri
- `GET /api/seller/orders` - Siparişler

### Courier Endpoints

- `GET /api/courier/tasks/available` - Mevcut görevler
- `GET /api/courier/tasks/active` - Aktif görevler
- `GET /api/courier/tasks/history` - Geçmiş görevler
- `PUT /api/courier/tasks/:id/accept` - Görev kabul
- `PUT /api/courier/tasks/:id/complete` - Görev tamamla

### Admin Endpoints

- `GET /api/admin/users` - Tüm kullanıcılar
- `POST /api/admin/users` - Kullanıcı ekle
- `PUT /api/admin/users/:id/suspend` - Kullanıcı dondur/aktifleştir
- `DELETE /api/admin/users/:id` - Kullanıcı sil
- `GET /api/admin/coupons` - Tüm kuponlar
- `POST /api/admin/coupons` - Kupon ekle

### Public Endpoints

- `GET /api/sellers` - Tüm satıcılar
- `GET /api/sellers/:id` - Satıcı detayları
- `GET /api/sellers/:id/menu` - Satıcı menüsü

---

## 📁 Proje Yapısı

```
Yemek-Sepeti/
├── assets/                  # Frontend kaynakları
│   ├── css/                # Stil dosyaları
│   └── js/                 # JavaScript dosyaları
│       └── modules/        # Modül dosyaları
├── config/                  # Yapılandırma dosyaları
│   ├── database.js         # Veritabanı yapılandırması
│   ├── sequelize.js        # Sequelize ORM yapılandırması
│   └── email.js            # Email yapılandırması
├── database/                # Veritabanı dosyaları
│   └── yemek_sepeti.sql    # SQL şema dosyası
├── middleware/              # Express middleware'leri
│   └── auth.js             # Kimlik doğrulama middleware'leri
├── models/                  # Sequelize modelleri
├── routes/                  # Route tanımları
│   └── api/                # API route'ları
├── views/                   # EJS template dosyaları
│   ├── admin/              # Admin sayfaları
│   ├── buyer/              # Müşteri sayfaları
│   ├── seller/             # Satıcı sayfaları
│   └── courier/            # Kurye sayfaları
├── public/                  # Statik dosyalar
│   └── uploads/            # Yüklenen dosyalar
├── server.js               # Ana sunucu dosyası
└── package.json            # Proje bağımlılıkları
```

---

## 💻 Geliştirme

### Kodlama Standartları

- JavaScript: ES6+ özellikleri
- Indentation: 4 spaces
- Naming: camelCase (JavaScript), snake_case (SQL)
- Comments: Türkçe açıklamalar

### Yeni Özellik Ekleme

1. Route'u `routes/api/` altında oluşturun
2. Gerekli modeli `models/` altında oluşturun
3. Frontend kodunu `assets/js/modules/` altında ekleyin
4. View dosyasını `views/` altında oluşturun

---

## 🔒 Güvenlik

### Uygulanan Güvenlik Önlemleri

1. **Password Hashing**: bcryptjs ile şifre hashleme
2. **JWT Tokens**: Güvenli token tabanlı kimlik doğrulama
3. **Session Management**: Güvenli session yönetimi
4. **SQL Injection**: Sequelize ORM ile korunma
5. **XSS Protection**: EJS template engine ile otomatik escape
6. **CSRF Protection**: Session tabanlı koruma
7. **Input Validation**: Express middleware ile validasyon

---

## 🐛 Sorun Giderme

### Veritabanı Bağlantı Sorunları

**Hata**: `ER_ACCESS_DENIED_ERROR`
- `.env` dosyasındaki `DB_USER` ve `DB_PASSWORD` değerlerini kontrol edin

**Hata**: `ECONNREFUSED`
- MySQL sunucusunun çalıştığından emin olun
- `.env` dosyasındaki `DB_HOST` ve `DB_PORT` değerlerini kontrol edin

**Hata**: `ER_BAD_DB_ERROR`
- Veritabanının oluşturulduğundan emin olun: `database/yemek_sepeti.sql` dosyasını çalıştırın

### Email Gönderim Sorunları

**Gmail ile sorun yaşıyorsanız**:
1. Google Hesabınızda "2 Adımlı Doğrulama"yı etkinleştirin
2. "Uygulama Şifreleri" oluşturun
3. `.env` dosyasında bu şifreyi kullanın

---

## 📝 Notlar

- Tüm test kullanıcıları için şifre: `password`
- İlk kurulumda veritabanı script'i çalıştırıldığında test kullanıcıları otomatik oluşturulur
- Production ortamında mutlaka güçlü şifreler kullanın
- JWT_SECRET ve SESSION_SECRET değerlerini production'da değiştirin

---

## 📄 Lisans

Bu proje ISC lisansı altında lisanslanmıştır.

---

**Son Güncelleme**: 2025-01-23  
**Versiyon**: 1.0.0

Made with ❤️ for food lovers
