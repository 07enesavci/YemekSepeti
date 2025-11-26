const express = require("express");
const path = require("path");
const fs = require("fs");
const app = express();
require("dotenv").config();

// Veritabanı bağlantısını test et
const db = require("./config/database");
db.testConnection();

// ============================================
// MIDDLEWARE
// ============================================

// CORS (Cross-Origin Resource Sharing) - Frontend ve backend farklı portlarda çalışıyorsa
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});

// JSON body parser (POST istekleri için)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// /Yemek-Sepeti/ path'ini temizle (Live Server'dan gelen istekler için)
app.use((req, res, next) => {
    if (req.path.startsWith('/Yemek-Sepeti/') || req.path.startsWith('/YemekSepeti/')) {
        const cleanPath = req.path.replace(/^\/Yemek-Sepeti/, '').replace(/^\/YemekSepeti/, '');
        return res.redirect(cleanPath || '/');
    }
    next();
});

// Static dosyalar (CSS, JS, images)
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use("/components", express.static(path.join(__dirname, "components")));

// ============================================
// ROUTES
// ============================================

// API Routes
const authRoutes = require("./routes/api/auth");
const sellersRoutes = require("./routes/api/sellers");
const ordersRoutes = require("./routes/api/orders");
const adminRoutes = require("./routes/api/admin");
const cartRoutes = require("./routes/api/cart");

app.use("/api/auth", authRoutes);
app.use("/api/sellers", sellersRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/cart", cartRoutes);

// ============================================
// FRONTEND ROUTES (HTML Sayfaları)
// ============================================

// Yardımcı fonksiyon: HTML dosyası gönder
function sendHtmlFile(res, filePath) {
    const fullPath = path.join(__dirname, filePath);
    console.log(`📂 Dosya yolu: ${fullPath}`);
    
    // Dosyanın var olup olmadığını kontrol et
    if (!fs.existsSync(fullPath)) {
        console.error(`❌ Dosya bulunamadı: ${fullPath}`);
        return res.status(404).send("Sayfa bulunamadı");
    }
    
    res.sendFile(fullPath, (err) => {
        if (err) {
            console.error(`❌ Dosya gönderme hatası: ${fullPath}`, err);
            if (!res.headersSent) {
                res.status(404).send("Sayfa bulunamadı");
            }
        } else {
            console.log(`✅ Dosya başarıyla gönderildi: ${filePath}`);
        }
    });
}

// Ana sayfa
app.get("/", (req, res) => {
    sendHtmlFile(res, "index.html");
});

// index.html'e direkt erişim
app.get("/index.html", (req, res) => {
    sendHtmlFile(res, "index.html");
});

// index.php'ye erişim denemesi (yönlendirme)
app.get("/index.php", (req, res) => {
    res.redirect("/");
});

// Common sayfalar (login, register, vb.) - Hem .html ile hem uzantısız
app.get("/pages/common/:page", (req, res) => {
    let page = req.params.page;
    // Eğer zaten .html uzantısı yoksa ekle
    if (!page.endsWith(".html")) {
        page = `${page}.html`;
    }
    sendHtmlFile(res, path.join("pages", "common", page));
});

// Buyer sayfaları
app.get("/pages/buyer/:page", (req, res) => {
    let page = req.params.page;
    if (!page.endsWith(".html")) {
        page = `${page}.html`;
    }
    sendHtmlFile(res, path.join("pages", "buyer", page));
});

// Seller sayfaları
app.get("/pages/seller/:page", (req, res) => {
    let page = req.params.page;
    if (!page.endsWith(".html")) {
        page = `${page}.html`;
    }
    sendHtmlFile(res, path.join("pages", "seller", page));
});

// Courier sayfaları
app.get("/pages/courier/:page", (req, res) => {
    let page = req.params.page;
    if (!page.endsWith(".html")) {
        page = `${page}.html`;
    }
    sendHtmlFile(res, path.join("pages", "courier", page));
});

// Admin sayfaları
app.get("/pages/admin/:page", (req, res) => {
    let page = req.params.page;
    if (!page.endsWith(".html")) {
        page = `${page}.html`;
    }
    const filePath = path.join("pages", "admin", page);
    console.log(`📄 Admin sayfası isteniyor: ${filePath}`);
    sendHtmlFile(res, filePath);
});

// Admin sayfaları için .html uzantılı direkt erişim
app.get("/pages/admin/:page.html", (req, res) => {
    const page = req.params.page;
    const filePath = path.join("pages", "admin", `${page}.html`);
    console.log(`📄 Admin sayfası isteniyor (direkt): ${filePath}`);
    sendHtmlFile(res, filePath);
});

// ============================================
// ERROR HANDLING
// ============================================

// Chrome DevTools isteklerini sessizce yok say
app.use((req, res, next) => {
    if (req.path.includes('.well-known') || req.path.includes('devtools')) {
        return res.status(404).end(); // Sessizce 404 döndür, loglama
    }
    next();
});

// 404 Handler - Bulunamayan route'lar için
app.use((req, res) => {
    // Sadece gerçek route hatalarını logla (Chrome DevTools istekleri hariç)
    if (!req.path.includes('.well-known') && !req.path.includes('devtools')) {
        console.error(`❌ 404 - Route bulunamadı: ${req.method} ${req.url}`);
    }
    res.status(404).json({
        success: false,
        message: "Sayfa bulunamadı."
    });
});

// Global Error Handler - Yakalanmayan hatalar için
app.use((err, req, res, next) => {
    console.error("❌ Sunucu hatası:", err);
    console.error("Stack trace:", err.stack);
    
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Sunucu hatası oluştu.",
        ...(process.env.NODE_ENV === 'development' && { error: err.stack })
    });
});

// Unhandled Promise Rejection Handler
process.on('unhandledRejection', (err) => {
    console.error('❌ Yakalanmayan Promise Rejection:', err);
});

// Uncaught Exception Handler
process.on('uncaughtException', (err) => {
    console.error('❌ Yakalanmayan Exception:', err);
    process.exit(1);
});

// ============================================
// SERVER BAŞLATMA
// ============================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server ${PORT} portunda dinlemede...`);
    console.log(`🌐 Tarayıcıda aç: http://localhost:${PORT}`);
});

