// Tüm uygulamayı try-catch ile sar (500 hatasını önlemek için)
try {
    const express = require("express");
    const path = require("path");
    const session = require("express-session");
    const expressLayouts = require('express-ejs-layouts');
    const fs = require('fs');
    const app = express();
    require("dotenv").config();

    // ============================================
    // LOG DOSYASI AYARLARI (ÖNCE TANIMLANMALI)
    // ============================================
    // Log dosyası klasörü oluştur
    const logsDir = path.resolve(__dirname, 'logs');
    if (!fs.existsSync(logsDir)) {
        try {
            fs.mkdirSync(logsDir, { recursive: true });
            console.log('✅ Logs klasörü oluşturuldu:', logsDir);
        } catch (err) {
            console.error('❌ Logs klasörü oluşturulamadı:', err.message);
        }
    }

    // Log dosyası yolu (günlük log dosyası)
    function getLogFilePath() {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD formatı
        return path.resolve(logsDir, `app-${dateStr}.log`);
    }

    // Log yazma fonksiyonu
    function writeLog(level, message, data = null) {
        try {
            const timestamp = new Date().toISOString();
            const logFile = getLogFilePath();
            const logLine = `[${timestamp}] [${level}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
            
            // Async olarak log dosyasına yaz (blocking olmasın)
            fs.appendFile(logFile, logLine, (err) => {
                if (err) {
                    // Log yazma hatası - sadece console'a yaz
                    console.error('❌ Log yazma hatası:', err.message);
                }
            });
            
            // Console'a da yaz
            if (level === 'ERROR') {
                console.error(`[${timestamp}] ${message}`, data || '');
            } else if (level === 'WARN') {
                console.warn(`[${timestamp}] ${message}`, data || '');
            } else {
                console.log(`[${timestamp}] ${message}`, data || '');
            }
        } catch (err) {
            // Log yazma hatası - sadece console'a yaz
            console.error('❌ Log fonksiyonu hatası:', err.message);
        }
    }

    // Deprecation uyarılarını bastır (node_modules'deki eski paketlerden geliyor)
    const originalEmitWarning = process.emitWarning;
    process.emitWarning = function(warning, type, code, ctor) {
        if (type === 'DeprecationWarning' && 
            (warning && warning.toString().includes('Buffer()'))) {
            return; // Uyarıyı gösterme
        }
        return originalEmitWarning.apply(process, arguments);
    };

    // Global hata yakalama
    process.on('uncaughtException', (error) => {
        console.error('❌ UNCAUGHT EXCEPTION:', error);
        writeLog('ERROR', 'Uncaught Exception', { 
            message: error.message, 
            stack: error.stack 
        });
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('❌ UNHANDLED REJECTION:', reason);
        writeLog('ERROR', 'Unhandled Rejection', { 
            reason: reason ? reason.toString() : 'unknown',
            stack: reason && reason.stack ? reason.stack : 'no stack'
        });
    });

    // Veritabanı bağlantısını test et
    let db;
    try {
        db = require("./config/database");
        db.testConnection().then(() => {
            writeLog('INFO', 'Veritabanı bağlantısı başarılı');
        }).catch((err) => {
            writeLog('ERROR', 'Veritabanı bağlantı hatası', { error: err.message });
        });
    } catch (err) {
        console.error('❌ Veritabanı modülü yüklenemedi:', err.message);
        writeLog('ERROR', 'Veritabanı modülü yüklenemedi', { error: err.message });
    }

    // ============================================
    // 1. EJS VE LAYOUT AYARLARI
    // ============================================
    let viewsPath;
    try {
        viewsPath = path.resolve(__dirname, 'views');
        
        if (!fs.existsSync(viewsPath)) {
            console.error('❌ Views klasörü bulunamadı:', viewsPath);
            writeLog('ERROR', 'Views klasörü bulunamadı', { path: viewsPath });
        } else {
            app.use(expressLayouts);
            app.set('layout', 'layouts/main');
            app.set('view engine', 'ejs');
            app.set('views', viewsPath);
            console.log('✅ Views klasörü yüklendi:', viewsPath);
            writeLog('INFO', 'Views klasörü yüklendi', { path: viewsPath });
        }
    } catch (err) {
        console.error('❌ EJS yapılandırma hatası:', err.message);
        writeLog('ERROR', 'EJS yapılandırma hatası', { error: err.message });
    }

    // ============================================
    // MIDDLEWARE
    // ============================================

    // Request Logging Middleware
    app.use((req, res, next) => {
        try {
            const startTime = Date.now();
            res.on('finish', () => {
                try {
                    const duration = Date.now() - startTime;
                    const logData = {
                        method: req.method,
                        url: req.url,
                        statusCode: res.statusCode,
                        duration: `${duration}ms`,
                        ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
                    };
                    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
                    writeLog(level, `${req.method} ${req.path} - ${res.statusCode}`, logData);
                } catch (logError) {
                    console.error('Log yazma hatası:', logError.message);
                }
            });
            next();
        } catch (middlewareError) {
            console.error('Logging middleware hatası:', middlewareError.message);
            next();
        }
    });

    // CORS
    app.use((req, res, next) => {
        const origin = req.headers.origin || req.headers.referer?.split('/').slice(0, 3).join('/') || 'http://localhost:3000';
        res.header("Access-Control-Allow-Origin", origin);
        res.header("Access-Control-Allow-Credentials", "true");
        res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
        if (req.method === "OPTIONS") return res.sendStatus(200);
        next();
    });

    // Body Parser
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Session Ayarları
    let sessionStore = null;
    if (process.env.NODE_ENV === 'production' || process.env.USE_MYSQL_SESSION === 'true') {
        let mysqlSessionModule = null;
        try {
            mysqlSessionModule = require.resolve('connect-mysql2');
        } catch (resolveError) {
            console.log('ℹ️ connect-mysql2 paketi yüklü değil, MemoryStore kullanılıyor');
        }
        
        if (mysqlSessionModule) {
            try {
                const MySQLStore = require('connect-mysql2')(session);
                const isCloudDB = process.env.DB_HOST && (process.env.DB_HOST.includes('tidb') || process.env.DB_HOST.includes('aivencloud') || process.env.DB_SSL === 'true');
                
                const sslConfig = isCloudDB ? {
                    rejectUnauthorized: false,
                    minVersion: 'TLSv1.2'
                } : false;
                
// connect-mysql2 için yapılandırma (AIVEN CLOUD AYARLARI)
                const storeConfig = {
                    // Resimdeki "Host" bilgisi
                    host: 'yemek-sepeti-yemeksepeti.i.aivencloud.com', 
                    
                    // Resimdeki "Port" bilgisi (Standart 3306 DEĞİL)
                    port: 14973, 
                    
                    // Resimdeki "User" bilgisi
                    user: 'avnadmin', 
                    
                    // Resimdeki "Password" bilgisi
                    password: 'AVNS_KngOGLfNZbx-76xa9YT', 
                    
                    // Resimdeki "Database name". 
                    // DİKKAT: Eğer "yemek_sepeti" adında veritabanı oluşturmadıysanız "defaultdb" kalmalı.
                    database: 'defaultdb', 
                    
                    createTableIfNotExists: true,
                    
                    // Aiven Cloud için SSL ayarı ZORUNLUDUR
                    ssl: {
                        rejectUnauthorized: false,
                        minVersion: 'TLSv1.2'
                    },
                    
                    // mysql2 için ek ayarlar
                    connectionLimit: 10,
                    charset: 'utf8mb4'
                };
                sessionStore = new MySQLStore(storeConfig);
                console.log('✅ MySQL Session Store (mysql2) kullanılıyor');
            } catch (error) {
                console.warn('⚠️ MySQL Session Store başlatılamadı, MemoryStore kullanılıyor:', error.message);
                writeLog('WARN', 'MySQL Session Store başlatılamadı', { error: error.message });
            }
        }
    }

    const sessionConfig = {
        name: 'yemek-sepeti-session',
        secret: process.env.SESSION_SECRET || 'gizli-anahtar-degistirin',
        resave: false,
        saveUninitialized: false,
        store: sessionStore || undefined,
        cookie: {
            secure: false,
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000
        }
    };

    // MemoryStore uyarısını bastır
    const originalWarn = console.warn;
    console.warn = function(...args) {
        if (args[0] && typeof args[0] === 'string' && args[0].includes('MemoryStore')) return;
        originalWarn.apply(console, args);
    };

    try {
        app.use(session(sessionConfig));
    } catch (sessionError) {
        console.error('❌ Session middleware hatası:', sessionError.message);
        app.use((req, res, next) => { req.session = {}; next(); });
    }
    console.warn = originalWarn;

    // Global Değişkenler
    app.use((req, res, next) => {
        try {
            res.locals.user = req.session ? (req.session.user || null) : null; 
            res.locals.path = req.path;
            res.locals.cartCount = 0; 
            next();
        } catch (error) {
            next();
        }
    });

    // ============================================
    // STATİK DOSYALAR
    // ============================================
    const assetsPath = path.resolve(__dirname, 'assets');
    if (fs.existsSync(assetsPath)) app.use('/assets', express.static(assetsPath));

    const publicPath = path.resolve(__dirname, 'public');
    if (fs.existsSync(publicPath)) app.use('/public', express.static(publicPath));

    const uploadsPath = path.resolve(__dirname, 'public', 'uploads');
    if (fs.existsSync(uploadsPath)) {
        app.use('/uploads', express.static(uploadsPath));
    } else {
        try {
            fs.mkdirSync(uploadsPath, { recursive: true });
            app.use('/uploads', express.static(uploadsPath));
        } catch (err) {
            console.error('❌ Uploads klasörü oluşturulamadı');
        }
    }

    // ============================================
    // ROTA TANIMLAMALARI
    // ============================================

    // TEST ENDPOINT
    app.get("/test", (req, res) => {
        res.json({
            success: true,
            message: "✅ Sunucu Çalışıyor! Route'lar aktif.",
            port: process.env.PORT,
            isIisnode: !!process.env.IISNODE_VERSION
        });
    });

    // Auth Middleware
    const { requireRole, requireAuth } = require('./middleware/auth');

    // Route Dosyaları
    const routeFiles = [
        "/api/auth", "/api/sellers", "/api/seller", "/api/orders", 
        "/api/admin", "/api/cart", "/api/courier", "/api/buyer", "/api/upload"
    ];

    routeFiles.forEach(route => {
        try {
            const routePath = path.resolve(__dirname, `routes${route}.js`);
            if (fs.existsSync(routePath)) {
                app.use(route, require(routePath));
                console.log(`✅ Route yüklendi: ${route}`);
            }
        } catch (error) {
            console.error(`❌ Route yüklenirken hata: ${route}`, error.message);
        }
    });

    // --- SAYFA ROTALARI ---
    
    // Ana Sayfa
    app.get("/", (req, res) => {
        try {
            res.render("index", { title: "Ana Sayfa", pageCss: "home.css", pageJs: "home.js" });
        } catch (error) { renderError(res, error, "Ana Sayfa"); }
    });

    // Auth
    app.get("/login", (req, res) => {
        try {
            res.render("common/login", { title: "Giriş Yap", pageCss: "auth.css", pageJs: "auth.js" });
        } catch (error) { renderError(res, error, "Login"); }
    });

    app.get("/register", (req, res) => {
        try {
            res.render("common/register", { title: "Kayıt Ol", pageCss: "auth.css", pageJs: "auth.js" });
        } catch (error) { renderError(res, error, "Register"); }
    });

    // Common Pages
    app.get("/about", (req, res) => res.render("common/about", { title: "Hakkımızda" }));
    app.get("/contact", (req, res) => res.render("common/contact", { title: "İletişim" }));
    app.get("/terms", (req, res) => res.render("common/terms", { title: "Kullanım Koşulları" }));
    app.get("/forgot-password", (req, res) => res.render("common/forgot-password", { title: "Şifremi Unuttum" }));

    // Buyer Pages
    app.get("/buyer/search", (req, res) => res.render("buyer/search", { title: "Satıcı Bul", pageCss: "search.css", pageJs: "search.js" }));
    app.get("/buyer/cart", requireRole('buyer'), (req, res) => res.render("buyer/cart", { title: "Sepetim", pageCss: "cart.css", pageJs: "cart.js" }));
    app.get("/buyer/checkout", requireRole('buyer'), (req, res) => res.render("buyer/checkout", { title: "Ödeme", pageCss: "checkout.css", pageJs: "checkout.js" }));
    app.get("/buyer/orders", requireRole('buyer'), (req, res) => res.render("buyer/orders", { title: "Siparişlerim", pageCss: "orders.css", pageJs: "orders.js" }));
    app.get("/buyer/order-confirmation/:orderId", requireRole('buyer'), (req, res) => res.render("buyer/order-confirmation", { title: "Sipariş Onayı", pageCss: "order-confirmation.css", orderId: req.params.orderId }));
    app.get("/buyer/profile", requireRole('buyer'), (req, res) => res.render("buyer/profile", { title: "Profilim", pageCss: "profile.css", pageJs: "profile.js", user: req.session.user || null }));
    app.get("/buyer/addresses", requireRole('buyer'), (req, res) => res.render("buyer/addresses", { title: "Adreslerim", pageCss: "profile.css", pageJs: "addresses.js", user: req.session.user || null }));
    app.get("/buyer/security", requireRole('buyer'), (req, res) => {
        console.log('✅ /buyer/security route hit');
        res.render("buyer/security", { title: "Güvenlik", pageCss: "profile.css", pageJs: "security.js", user: req.session.user || null });
    });
    app.get("/buyer/wallet", requireRole('buyer'), (req, res) => {
        console.log('✅ /buyer/wallet route hit');
        res.render("buyer/wallet", { title: "Cüzdan & Kuponlar", pageCss: "profile.css", pageJs: "wallet.js", user: req.session.user || null });
    });
    app.get("/buyer/seller-profile/:id", (req, res) => res.render("buyer/seller-profile", { title: "Satıcı Profili", pageCss: "seller-profile.css", pageJs: "seller-profile.js", sellerId: req.params.id }));
    app.get("/buyer/:id/profile", requireRole('buyer'), (req, res) => res.render("buyer/profile", { title: "Profilim", pageCss: "profile.css", pageJs: "profile.js", user: req.session.user || null, buyerId: req.params.id }));

    // Seller Pages
    app.get("/seller/dashboard", requireRole('seller'), (req, res) => res.render("seller/dashboard", { title: "Satıcı Paneli", pageCss: "seller-dashboard.css", pageJs: "seller.js" }));
    app.get("/seller/orders", requireRole('seller'), (req, res) => res.render("seller/orders", { title: "Gelen Siparişler", pageCss: "seller-orders.css", pageJs: "seller.js" }));
    app.get("/seller/menu", requireRole('seller'), (req, res) => res.render("seller/menu", { title: "Menü Yönetimi", pageCss: "seller-menu.css", pageJs: "seller.js" }));
    app.get("/seller/earnings", requireRole('seller'), (req, res) => res.render("seller/earnings", { title: "Kazanç Raporları", pageCss: "seller-earnings.css", pageJs: "seller.js" }));
    app.get("/seller/profile", requireRole('seller'), (req, res) => res.render("seller/profile", { title: "Restoran Profili", pageCss: "seller-profile.css", pageJs: "seller.js" }));

    // Seller ID Pages
    app.get("/seller/:id/dashboard", requireRole('seller'), (req, res) => res.render("seller/dashboard", { title: "Satıcı Paneli", pageCss: "seller-dashboard.css", pageJs: "seller.js", sellerId: req.params.id }));
    app.get("/seller/:id/orders", requireRole('seller'), (req, res) => res.render("seller/orders", { title: "Gelen Siparişler", pageCss: "seller-orders.css", pageJs: "seller.js", sellerId: req.params.id }));
    app.get("/seller/:id/menu", requireRole('seller'), (req, res) => res.render("seller/menu", { title: "Menü Yönetimi", pageCss: "seller-menu.css", pageJs: "seller.js", sellerId: req.params.id }));
    app.get("/seller/:id/earnings", requireRole('seller'), (req, res) => res.render("seller/earnings", { title: "Kazanç Raporları", pageCss: "seller-earnings.css", pageJs: "seller.js", sellerId: req.params.id }));
    app.get("/seller/:id/profile", requireRole('seller'), (req, res) => res.render("seller/profile", { title: "Restoran Profili", pageCss: "seller-profile.css", pageJs: "seller.js", sellerId: req.params.id }));

    // Courier Pages
    app.get("/courier/:id/dashboard", requireRole('courier'), (req, res) => res.render("courier/dashboard", { title: "Kurye Paneli", pageCss: "courier.css", pageJs: "courier.js", courierId: req.params.id }));
    app.get("/courier/:id/available", requireRole('courier'), (req, res) => res.render("courier/available", { title: "Müsait Siparişler", pageCss: "courier.css", pageJs: "courier.js", courierId: req.params.id }));
    app.get("/courier/:id/history", requireRole('courier'), (req, res) => res.render("courier/history", { title: "Teslimat Geçmişi", pageCss: "courier.css", pageJs: "courier.js", courierId: req.params.id }));
    app.get("/courier/:id/profile", requireRole('courier'), (req, res) => res.render("courier/profile", { title: "Kurye Profili", pageCss: "courier.css", pageJs: "courier.js", courierId: req.params.id }));

    // Admin Pages
    app.get("/admin/users", requireRole('admin'), (req, res) => res.render("admin/user-management", { title: "Kullanıcı Yönetimi", pageCss: "admin.css", pageJs: "admin.js" }));
    app.get("/admin/coupons", requireRole('admin'), (req, res) => res.render("admin/coupons", { title: "Kupon Yönetimi", pageCss: "admin.css", pageJs: "admin.js" }));

    // Yardımcı Fonksiyon: Render Hatası Gösterme
    function renderError(res, error, pageName) {
        console.error(`${pageName} sayfası render hatası:`, error);
        writeLog('ERROR', `${pageName} render hatası`, { error: error.message });
        res.status(500).send(`<h1>500 - Render Hatası (${pageName})</h1><p>${error.message}</p>`);
    }

    // 404 Handler
    app.use((req, res) => {
        if (!req.path.includes('.well-known')) writeLog('WARN', `404: ${req.url}`);
        res.status(404).send(`<h1>404 - Sayfa Bulunamadı</h1><a href="/">Ana Sayfaya Dön</a>`);
    });

    // Global Error Handler
    app.use((err, req, res, next) => {
        writeLog('ERROR', 'Server error occurred', { message: err.message, stack: err.stack });
        console.error("❌ Server error:", err.message);
        res.status(500).send(`<h1>500 - Sunucu Hatası</h1><p>${err.message}</p>`);
    });

    // ============================================
    // 🚀 SUNUCUYU BAŞLAT (DÜZELTİLEN KISIM)
    // ============================================
    
    // IISNode ortamında process.env.PORT, Windows Named Pipe adresini taşır.
    // Express'in bu adresi dinlemesi ZORUNLUDUR.
    const PORT = process.env.PORT || 3000;

    const server = app.listen(PORT, () => {
        const isIisnode = !!process.env.IISNODE_VERSION;
        console.log(`✅ Sunucu Başlatıldı!`);
        console.log(`🔌 Dinleniyor (PORT/Pipe): ${PORT}`);
        console.log(`🛠️ Mod: ${isIisnode ? 'IISNode (Production)' : 'Standalone (Dev)'}`);

        writeLog('INFO', 'Server başarıyla başlatıldı', {
            port: PORT,
            mode: isIisnode ? 'IISNode' : 'Standalone',
            nodeVersion: process.version
        });
    });

    server.on('error', (err) => {
        console.error('❌ Server Listen Hatası:', err);
        writeLog('ERROR', 'Server Listen Hatası', { error: err.message });
    });

    // IISNode entegrasyonu için export
    module.exports = app;

} catch (startupError) {
    console.error('❌❌❌ KRİTİK HATA:', startupError);
    // Hata durumunda basit bir sunucu başlat ki IIS loglara yazabilsin
    const express = require("express");
    const errorApp = express();
    errorApp.get("*", (req, res) => res.status(500).send(`<h1>Kritik Başlatma Hatası</h1><pre>${startupError.stack}</pre>`));
    module.exports = errorApp;
}