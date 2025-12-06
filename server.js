const express = require("express");
const path = require("path");
const session = require("express-session");
const expressLayouts = require('express-ejs-layouts');
const app = express();
require("dotenv").config();

// Veritabanı bağlantısını test et
const db = require("./config/database");
db.testConnection();

// ============================================
// 1. EJS VE LAYOUT AYARLARI
// ============================================
app.use(expressLayouts);
app.set('layout', 'layouts/main'); // Varsayılan layout
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ============================================
// MIDDLEWARE
// ============================================

// CORS
app.use((req, res, next) => {
    const origin = req.headers.origin || req.headers.referer?.split('/').slice(0, 3).join('/') || 'http://localhost:3000';
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});

// Body Parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session({
    name: 'yemek-sepeti-session',
    secret: process.env.SESSION_SECRET || 'yemek-sepeti-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // HTTPS olmadığı için false
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 gün
    }
}));

// Global User ve Path Değişkeni (Server.js içinde)
app.use((req, res, next) => {
    // 1. Kullanıcı Bilgilerini Gönderme (user, role)
    res.locals.user = req.session.user || null; 
    res.locals.path = req.path; // Hangi sayfada olduğumuzu belirtir (Breadcrumb için)

    // 2. Sepet ve Bildirim Sayısı İçin MOCK (SAHTE) Veri Tanımlama
    res.locals.cartCount = 3; 
    res.locals.notificationsCount = 2; 

    next();
});
// ============================================
// STATİK DOSYALAR
// ============================================
app.use(express.static(__dirname));

// ============================================
// API ROUTES (Backend)
// ============================================
const authRoutes = require("./routes/api/auth");
const sellersRoutes = require("./routes/api/sellers");
const ordersRoutes = require("./routes/api/orders");
const adminRoutes = require("./routes/api/admin");
const cartRoutes = require("./routes/api/cart");
const { requireRole } = require("./middleware/auth"); // Yetki kontrolü

app.use("/api/auth", authRoutes);
app.use("/api/sellers", sellersRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/cart", cartRoutes);

// ============================================
// FRONTEND ROUTES (Sayfalar)
// ============================================

// --- Ana Sayfa ---
app.get("/", (req, res) => {
    res.render("index", { 
        title: "Ana Sayfa",
        pageCss: "home.css",
        pageJs: "home.js"
    });
});

// --- Common (Ortak) Sayfalar ---
app.get("/login", (req, res) => res.render("common/login", { title: "Giriş Yap", pageCss: "auth.css", pageJs: "auth-check.js" }));
app.get("/register", (req, res) => res.render("common/register", { title: "Kayıt Ol", pageCss: "auth.css", pageJs: "auth.js" }));
app.get("/forgot-password", (req, res) => res.render("common/forgot-password", { title: "Şifremi Unuttum", pageCss: "auth.css", pageJs: null }));
app.get("/about", (req, res) => res.render("common/about", { title: "Hakkımızda", pageCss: null, pageJs: null }));
app.get("/contact", (req, res) => res.render("common/contact", { title: "İletişim", pageCss: "auth.css", pageJs: null }));
app.get("/terms", (req, res) => res.render("common/terms", { title: "Kullanım Koşulları", pageCss: null, pageJs: null }));

// --- Buyer (Alıcı) Sayfaları ---
app.get("/buyer/search", (req, res) => res.render("buyer/search", { title: "Arama Sonuçları", pageCss: "search.css", pageJs: "search.js" }));

// GÜVENLİK: Aşağıdaki sayfalar giriş gerektirir!
app.get("/buyer/cart", requireRole('buyer'), (req, res) => res.render("buyer/cart", { title: "Sepetim", pageCss: "cart.css", pageJs: "cart.js" }));
app.get("/buyer/checkout", requireRole('buyer'), (req, res) => res.render("buyer/checkout", { title: "Ödeme", pageCss: "checkout.css", pageJs: "checkout.js" }));
app.get("/buyer/orders", requireRole('buyer'), (req, res) => res.render("buyer/orders", { title: "Siparişlerim", pageCss: "orders.css", pageJs: "orders.js" }));
app.get("/buyer/profile", requireRole('buyer'), (req, res) => res.render("buyer/profile", { title: "Profilim", pageCss: "profile.css", pageJs: "profile.js" }));
app.get("/buyer/seller-profile/:id", (req, res) => res.render("buyer/seller-profile", { title: "Restoran Detayı", pageCss: "seller-profile.css", pageJs: "seller-profile.js" }));

// --- Seller (Satıcı) Sayfaları ---
app.get("/seller/dashboard", requireRole('seller'), (req, res) => res.render("seller/dashboard", { title: "Satıcı Paneli", pageCss: "seller-dashboard.css", pageJs: "seller.js" }));
app.get("/seller/orders", requireRole('seller'), (req, res) => res.render("seller/orders", { title: "Gelen Siparişler", pageCss: "seller-orders.css", pageJs: "seller.js" }));
app.get("/seller/menu", requireRole('seller'), (req, res) => res.render("seller/menu", { title: "Menü Yönetimi", pageCss: "seller-menu.css", pageJs: "seller.js" }));
app.get("/seller/earnings", requireRole('seller'), (req, res) => res.render("seller/earnings", { title: "Kazanç Raporları", pageCss: "seller-earnings.css", pageJs: "seller.js" }));
app.get("/seller/profile", requireRole('seller'), (req, res) => res.render("seller/profile", { title: "Restoran Profili", pageCss: "seller-profile-admin.css", pageJs: "seller-profile.js" }));

// --- Courier (Kurye) Sayfaları ---
app.get("/courier/dashboard", requireRole('courier'), (req, res) => res.render("courier/dashboard", { title: "Kurye Paneli", pageCss: "courier-dashboard.css", pageJs: "courier.js" }));
app.get("/courier/available", requireRole('courier'), (req, res) => res.render("courier/available", { title: "Uygun Siparişler", pageCss: "courier-available.css", pageJs: "courier.js" }));
app.get("/courier/history", requireRole('courier'), (req, res) => res.render("courier/history", { title: "Geçmiş Siparişler", pageCss: "courier-history.css", pageJs: "courier.js" }));
app.get("/courier/profile", requireRole('courier'), (req, res) => res.render("courier/profile", { title: "Kurye Profili", pageCss: "profile.css", pageJs: "profile.js" }));

// --- Admin Sayfaları ---
app.get("/admin/users", requireRole('admin'), (req, res) => res.render("admin/user-management", { title: "Kullanıcı Yönetimi", pageCss: "admin.css", pageJs: "admin.js" }));
app.get("/admin/coupons", requireRole('admin'), (req, res) => res.render("admin/coupons", { title: "Kupon Yönetimi", pageCss: "admin.css", pageJs: "admin.js" }));

// ============================================
// ERROR HANDLING
// ============================================

app.use((req, res) => {
    if (!req.path.includes('.well-known') && !req.path.includes('devtools')) {
        console.error(`❌ 404 - Sayfa Bulunamadı: ${req.url}`);
    }
    res.status(404).send(`
        <div style="text-align:center; padding:50px; font-family:sans-serif;">
            <h1 style="color:#FF6B35; font-size:4rem;">404</h1>
            <h2>Aradığınız sayfa bulunamadı</h2>
            <p>Gitmek istediğiniz sayfa silinmiş veya taşınmış olabilir.</p>
            <a href="/" style="color:white; background:#FF6B35; padding:10px 20px; text-decoration:none; border-radius:5px;">Ana Sayfaya Dön</a>
        </div>
    `);
});

app.use((err, req, res, next) => {
    console.error("❌ Sunucu hatası:", err);
    res.status(500).send("<h1>500 - Sunucu Hatası</h1>");
});

// ============================================
// SERVER START
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server ${PORT} portunda çalışıyor...`);
    console.log(`🌐 Link: http://localhost:${PORT}`);
});