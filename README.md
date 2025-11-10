# YemekSepeti
Yemek sipariş uygulaması 

Harika fikir. README.md dosyası (genellikle .md uzantılıdır, .html değil, çünkü bu bir dökümantasyon dosyasıdır) projenizin "Giriş Kapısı"dır. 5 kişilik bir ekip için bu dosyanın net olması çok önemlidir.

Aşağıdaki metni kopyalayıp projenizin kök dizinindeki README.md dosyasına yapıştırabilirsiniz.

🚀 Ev Yemeği Platformu - Proje Mimarisi
Bu döküman, projemizde yer alan temel dosya ve klasör yapısını ve 5 kişilik ekibimiz için bu dosyaların sorumluluklarını açıklar. Amacımız, "frontend-first" (önce-frontend) yaklaşımıyla, api.js dosyasını sahte (mock) backend olarak kullanarak tüm arayüzü geliştirmektir.

🏛️ Proje Dizin Yapısı ve Görevleri
/ev-yemek-projesi
│
├── index.html                 (Alıcının gördüğü ana sayfa / Vitrin)
├── README.md                  (Proje dökümantasyonu - Şu an okuduğunuz dosya)
│
├── assets/                    (Tüm statik varlıklar: CSS, JS, Resimler)
│   ├── css/                   (Stil dosyaları)
│   │   ├── main.css           (TASARIM ANAYASASI: Renkler, fontlar, :root)
│   │   ├── layout.css         (İSKELET: Header, footer, .container yerleşimi)
│   │   ├── components.css     (LEGO PARÇALARI: .btn, .card, .form-input stilleri)
│   │   └── pages/             (Sayfaya özel stiller)
│   │       ├── home.css       (Sadece index.html'e özel stiller)
│   │       ├── auth.css       (Sadece login/register/forgot-password sayfaları için)
│   │       ├── profile.css    (Alıcı 'Hesabım' panelinin 2 sütunlu yerleşimi)
│   │       ├── cart.css       (Sepet sayfası stilleri)
│   │       ├── checkout.css   (Ödeme sayfası stilleri)
│   │       ├── orders.css     (Siparişlerim sayfası kart stilleri)
│   │       ├── search.css     ('Satıcı Bul' sayfasının 2 sütunlu yerleşimi)
│   │       ├── seller-profile.css (Satıcı vitrininin (menü) stilleri)
│   │       └── seller-dashboard.css (Satıcı paneli ana sayfa stilleri)
│   │
│   ├── js/                    (JavaScript dosyaları - )
│   │   ├── main.js            (Global script: Header/Footer yükleyici, mobil menü)
│   │   ├── auth.js            (Giriş/Kayıt formlarının doğrulaması, şifre kontrolü)
│   │   ├── api.js             (SAHTE BACKEND: Tüm sahte veriler ve fonksiyonlar)
│   │   └── modules/           (Sayfaya özel JS mantığı)
│   │       ├── cart.js        (Sepet mantığı: Ekleme, çıkarma, localStorage)
│   │       ├── search.js      (Arama/filtreleme sayfasının mantığı)
│   │       └── seller.js      (Satıcı panelinin tüm mantığı)
│   │
│   ├── images/                (Resimler, logolar, banner'lar)
│   │   ├── icons/             (SVG ikonlar)
│   │   └── placeholders/      (Yer tutucu görseller - örn: yüklenmemiş yemek resmi)
│   │
│   └── fonts/                 (Kullanılacak özel font dosyaları)
│
├── components/                (Tekrar kullanılabilir HTML parçaları - Şablonlar)
│   ├── header.html            (Şablon: Sitenin üst menüsü)
│   ├── footer.html            (Şablon: Sitenin alt bilgisi)
│   ├── seller-card.html       (Şablon: Arama sayfasındaki tek bir satıcı kartı)
│   ├── meal-card.html         (Şablon: Menüdeki tek bir yemek kartı)
│   └── dashboard-sidebar.html (Şablon: Satıcı/Kurye paneli sol menüsü)
│
└── pages/                     (Tüm HTML sayfaları)
    │
    ├── common/                (Herkes için ortak sayfalar)
    │   ├── login.html         (Giriş sayfası)
    │   ├── register.html      (Kayıt sayfası - Rol seçimiyle)
    │   ├── forgot-password.html (Şifre sıfırlama sayfası)
    │   ├── about.html         (Hakkımızda sayfası)
    │   └── contact.html       (İletişim sayfası)
    │
    ├── buyer/                 (ALICI ROLÜ - Müşteri Akışı)
    │   ├── search.html        (Satıcı arama ve filtreleme sayfası)
    │   ├── seller-profile.html(Satıcı vitrini - Menü listesi)
    │   ├── cart.html          (Alışveriş sepeti sayfası)
    │   ├── checkout.html      (Ödeme sayfası - Adres/Kart girişi)
    │   ├── profile.html       (Alıcı 'Hesabım' paneli - Ayarlar, Cüzdan vb.)
    │   └── orders.html        (Alıcı 'Siparişlerim' listesi)
    │
    ├── seller/                (SATICI ROLÜ - Dükkan Sahibi Paneli)
    │   ├── dashboard.html     (Satıcı ana paneli - İstatistikler, yeni siparişler)
    │   ├── orders.html        (Tüm siparişleri yönetme sayfası)
    │   ├── menu.html          (Yemek ekleme/düzenleme/silme sayfası)
    │   ├── profile.html       (Dükkan ayarları sayfası - Logo, ad, saatler)
    │   └── earnings.html      (Kazanç raporları sayfası)
    │
    └── courier/               (KURYE ROLÜ - Teslimatçı Paneli)
        ├── dashboard.html     (Kurye ana paneli - Harita, aktif görev)
        ├── available.html     (Alınabilir siparişlerin listelendiği havuz)
        ├── history.html       (Tamamlanan teslimatlar ve kazançlar)
        └── profile.html       (Kurye ayarları - Müsaitlik durumu vb.)
