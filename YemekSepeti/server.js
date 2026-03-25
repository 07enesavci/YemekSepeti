try {
    const express = require("express");
    const path = require("path");
    const session = require("express-session");
    const expressLayouts = require('express-ejs-layouts');
    const fs = require('fs');
    const http = require('http');
    const net = require('net');
    const { Server: SocketIOServer } = require('socket.io');
    const app = express();
    require("dotenv").config();

    // IIS / Cloudflare proxy arkasında req.ip ve X-Forwarded-For doğru çalışsın (rate-limit 520 hatasını önler)
    app.set("trust proxy", 1);

    // Global io objesi - routes dosyalarından erişilebilir
    global.io = null;

    // --- LOGLAMA (rotasyon: 14 gün, günlük dosya) ---
    const { writeLog } = require('./config/logger');

    // --- HATA VE UYARI YÖNETİMİ ---
    const originalEmitWarning = process.emitWarning;
    process.emitWarning = function(warning, type, code, ctor) {
        if (type === 'DeprecationWarning' && (warning && warning.toString().includes('Buffer()'))) {
            return;
        }
        return originalEmitWarning.apply(process, arguments);
    };

    process.on('uncaughtException', (error) => {
        writeLog('ERROR', 'Uncaught Exception', { message: error.message, stack: error.stack });
    });

    process.on('unhandledRejection', (reason, promise) => {
        writeLog('ERROR', 'Unhandled Rejection', { 
            reason: reason ? reason.toString() : 'unknown',
            stack: reason && reason.stack ? reason.stack : 'no stack'
        });
    });

    // --- VERİTABANI BAĞLANTILARI ---
    let db;
    try {
        db = require("./config/database");
        if(db.testConnection) {
            db.testConnection().then(() => {
                writeLog('INFO', 'Veritabanı bağlantısı başarılı (mysql2)');
            }).catch((err) => {
                writeLog('ERROR', 'Veritabanı bağlantı hatası (mysql2)', { error: err.message });
            });
        }
    } catch (err) {
        writeLog('ERROR', 'Veritabanı modülü yüklenemedi', { error: err.message });
    }

    try {
        // Modelleri ve Sequelize nesnesini içe aktar
        const models = require("./models");
        const sequelize = models.sequelize; 

        if (sequelize) {
            // alter: true -> Modellerdeki yeni sütunları SQL'e otomatik ekler.
            // "Too many keys" hatası: unique alanlar artık indexes içinde tanımlı; hâlâ oluşursa alter olmadan sync yapılır.
            const { ensureOrderPaymentMethodEnum } = require('./config/sequelize');
            sequelize.sync({ alter: true })
                .then(async () => {
                    if (process.env.SKIP_ORDER_PAYMENT_ENUM_FIX !== 'true') {
                        await ensureOrderPaymentMethodEnum();
                    }
                    writeLog('INFO', 'Sequelize: Tablolar ve yeni sütunlar SQL tarafında güncellendi ✅');
                    console.log("✅ SQL Tabloları ve Sütunlar Başarıyla Senkronize Edildi!");
                })
                .catch((err) => {
                    const isTooManyKeys = err.message && err.message.includes('Too many keys');
                    if (isTooManyKeys) {
                        writeLog('WARN', 'Sequelize alter atlandı (çok fazla indeks). Tablolar mevcut haliyle kullanılıyor.', { error: err.message });
                        console.warn("⚠️ SQL alter atlandı (çok fazla indeks). Tablolar mevcut haliyle kullanılıyor. Veritabanında gereksiz indeksleri temizleyebilirsiniz.");
                        return sequelize.sync({ alter: false }).then(async () => {
                            if (process.env.SKIP_ORDER_PAYMENT_ENUM_FIX !== 'true') {
                                await ensureOrderPaymentMethodEnum();
                            }
                            console.log("✅ Sequelize sync (alter olmadan) tamamlandı.");
                        });
                    }
                    writeLog('ERROR', 'Sequelize Sync Hatası', { error: err.message });
                    console.error("❌ SQL Güncelleme Hatası:", err.message);
                });
        }

        const { sequelizeTestConnection } = require("./config/database");
        if(sequelizeTestConnection) {
            sequelizeTestConnection().then(() => {
                writeLog('INFO', 'Sequelize bağlantısı başarılı');
            }).catch((err) => {
                writeLog('ERROR', 'Sequelize bağlantı hatası', { error: err.message });
            });
        }
    } catch (err) {
        writeLog('ERROR', 'Sequelize modülü yüklenemedi veya senkronize edilemedi', { error: err.message });
    }

    // --- VIEW ENGINE VE LAYOUT ---
    let viewsPath;
    try {
        viewsPath = path.resolve(__dirname, 'views');
        if (!fs.existsSync(viewsPath)) {
            writeLog('ERROR', 'Views klasörü bulunamadı', { path: viewsPath });
        } else {
            app.use(expressLayouts);
            app.set('layout', 'layouts/main');
            app.set('view engine', 'ejs');
            app.set('views', viewsPath);
            writeLog('INFO', 'Views klasörü yüklendi', { path: viewsPath });
        }
    } catch (err) {
        writeLog('ERROR', 'EJS yapılandırma hatası', { error: err.message });
    }

    // --- LOGLAMA MIDDLEWARE ---
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
                } catch (logError) {}
            });
            next();
        } catch (middlewareError) {
            next();
        }
    });

    // --- CORS VE HEADERLAR ---
    app.use((req, res, next) => {
        const origin = req.headers.origin || req.headers.referer?.split('/').slice(0, 3).join('/') || 'http://localhost:3000';
        res.header("Access-Control-Allow-Origin", origin);
        res.header("Access-Control-Allow-Credentials", "true");
        res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
        if (req.method === "OPTIONS") return res.sendStatus(200);
        next();
    });

    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // --- PWA: manifest.json ve sw.js EN BAŞTA (session/DB'den önce; production 404 önleme) ---
    const manifestPath = path.resolve(__dirname, 'public', 'manifest.json');
    const swPath = path.resolve(__dirname, 'public', 'sw.js');
    app.get('/manifest.json', (req, res) => {
        res.set('Cache-Control', 'public, max-age=0');
        res.type('application/manifest+json');
        if (fs.existsSync(manifestPath)) {
            res.sendFile(manifestPath);
        } else {
            res.json({ name: 'Ev Lezzetleri', short_name: 'Ev Lezzetleri', start_url: '/', display: 'standalone', icons: [] });
        }
    });
    app.get('/sw.js', (req, res) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.type('application/javascript');
        if (fs.existsSync(swPath)) {
            res.sendFile(swPath);
        } else {
            res.send('self.addEventListener("install",function(e){self.skipWaiting();});self.addEventListener("activate",function(e){e.waitUntil(self.clients.claim());});');
        }
    });

    // --- SESSION YAPILANDIRMASI ---
    let sessionStore = null;
    if (process.env.NODE_ENV === 'production' || process.env.USE_MYSQL_SESSION === 'true') {
        let mysqlSessionModule = null;
        try {
            // express-mysql-session daha stabildir, yoksa connect-mysql2 dener
            try {
                mysqlSessionModule = require.resolve('express-mysql-session');
            } catch(e) {
                mysqlSessionModule = require.resolve('connect-mysql2');
            }
        } catch (resolveError) {}
        
        if (mysqlSessionModule) {
            try {
                const MySQLStore = require(mysqlSessionModule)(session);
                const isCloudDB = process.env.DB_HOST && (process.env.DB_HOST.includes('aivencloud.com') || process.env.DB_SSL === 'true');
                const storeConfig = {
                    host: process.env.DB_HOST || 'localhost',
                    port: parseInt(process.env.DB_PORT, 10) || 3306,
                    user: process.env.DB_USER || 'root',
                    password: process.env.DB_PASSWORD || '',
                    database: process.env.DB_NAME || 'yemek_sepeti',
                    createTableIfNotExists: true,
                    ...(isCloudDB ? {
                        ssl: { rejectUnauthorized: false, minVersion: 'TLSv1.2' }
                    } : {}),
                    connectionLimit: 10,
                    charset: 'utf8mb4'
                };
                sessionStore = new MySQLStore(storeConfig);
            } catch (error) {
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
            secure: false, // HTTPS kullanıyorsan true yap
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000
        }
    };

    // Bellek sızıntısı uyarısını gizle
    const originalWarn = console.warn;
    console.warn = function(...args) {
        if (args[0] && typeof args[0] === 'string' && args[0].includes('MemoryStore')) return;
        originalWarn.apply(console, args);
    };

    try {
        app.use(session(sessionConfig));
    } catch (sessionError) {
        app.use((req, res, next) => { req.session = {}; next(); });
    }
    console.warn = originalWarn;

    // --- LOCALS MIDDLEWARE ---
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

    // Satıcı/Kurye onay durumunu güncelle.
    // Not: statik dosya ve socket isteklerinde DB sorgusu çalıştırma; aksi halde bağlantı havuzu dolup
    // JS/CSS dosyaları 500 dönebilir ve panelde canlı güncelleme bozulur.
    app.use(async (req, res, next) => {
        try {
            const p = req.path || '';
            const isStaticOrSocketRequest =
                p.startsWith('/assets') ||
                p.startsWith('/public') ||
                p.startsWith('/uploads') ||
                p.startsWith('/socket.io') ||
                p === '/manifest.json' ||
                p === '/sw.js' ||
                p === '/favicon.ico';
            if (isStaticOrSocketRequest) return next();

            const accept = (req.headers && req.headers.accept) ? String(req.headers.accept) : '';
            const isLikelyHtmlPage = accept.includes('text/html');
            if (!isLikelyHtmlPage && !p.startsWith('/api/')) return next();

            const user = res.locals.user;
            if (user && user.role === 'seller' && user.sellerId) {
                const { Seller } = require('./models');
                const seller = await Seller.findByPk(user.sellerId);
                if (!seller) {
                    req.session.user = null;
                    req.session.isAuthenticated = false;
                    res.locals.user = null;
                    return next();
                }
                const approved = !!seller.is_active;
                res.locals.user = { ...user, sellerApproved: approved };
                if (req.session && req.session.user) req.session.user.sellerApproved = approved;
            } else if (user && user.role === 'courier') {
                const { Courier } = require('./models');
                const courier = await Courier.findOne({ where: { user_id: user.id } });
                if (!courier) {
                    res.locals.user = { ...user, courierId: null, courierApproved: false };
                    if (req.session && req.session.user) {
                        req.session.user.courierId = null;
                        req.session.user.courierApproved = false;
                    }
                    return next();
                }
                const approved = !!courier.is_active;
                res.locals.user = { ...user, courierId: courier.id, courierApproved: approved };
                if (req.session && req.session.user) {
                    req.session.user.courierId = courier.id;
                    req.session.user.courierApproved = approved;
                }
            }
            next();
        } catch (err) {
            next();
        }
    });

    // Belgeleri göndermemiş satıcı/kurye sadece /register/documents, logout ve submit-documents'a erişebilir
    app.use((req, res, next) => {
        const user = res.locals.user;
        const needsDocuments = user && (
            (user.role === 'seller' && !user.sellerId) ||
            (user.role === 'courier' && !user.courierId)
        );
        if (!needsDocuments) return next();

        const p = req.path;
        const isDocumentsPage = p === '/register/documents';
        const isLogout = p === '/api/auth/logout';
        const isSubmitDocs = p === '/api/auth/submit-documents' || p === '/api/auth/submit-documents-json';
        const isStatic = p.startsWith('/assets') || p.startsWith('/public') || p.startsWith('/uploads') || p.startsWith('/socket.io') || p === '/manifest.json' || p === '/sw.js';

        if (isDocumentsPage || isLogout || isSubmitDocs || isStatic) return next();

        if (p.startsWith('/api/')) {
            return res.status(403).json({ redirect: '/register/documents' });
        }
        return res.redirect(302, '/register/documents');
    });

    const { requireRole, requireSellerApproved, requireCourierApproved } = require('./middleware/auth');
    const { requireEnv, apiLimiter, helmetMiddleware } = require('./middleware/security');

    app.use(requireEnv);
    app.use(helmetMiddleware());
    app.use('/api', apiLimiter);

    // --- HEALTH CHECK (yük dengeleyici / izleme) ---
    app.get('/health', (req, res) => {
        res.status(200).json({ ok: true, timestamp: new Date().toISOString(), service: 'ev-lezzetleri' });
    });
    app.get('/api/health', (req, res) => {
        res.status(200).json({ ok: true, timestamp: new Date().toISOString(), service: 'ev-lezzetleri' });
    });

    // --- API ROUTE'LARI (statik dosyalardan önce; böylece /api/sellers vb. kesin eşleşir) ---
    app.use('/api/auth', require('./routes/api/auth'));
    const routeFiles = [
        "/api/sellers", "/api/seller", "/api/orders",
        "/api/admin", "/api/cart", "/api/courier", "/api/buyer", "/api/upload",
        "/api/notifications", "/api/favorites", "/api/reviews"
    ];

    routeFiles.forEach(route => {
        try {
            const routePath = path.resolve(__dirname, `routes${route}.js`);
            if (fs.existsSync(routePath)) {
                const routeModule = require(routePath);
                if (routeModule) {
                    app.use(route, routeModule);
                    writeLog('INFO', `Route yüklendi: ${route}`, { path: routePath });
                } else {
                    writeLog('ERROR', `Route modülü geçersiz: ${route}`, { path: routePath, moduleType: typeof routeModule });
                }
            } else {
                writeLog('ERROR', `Route dosyası bulunamadı: ${route}`, { path: routePath });
            }
        } catch (error) {
            writeLog('ERROR', `Route yüklenirken hata: ${route}`, {
                error: error.message,
                stack: error.stack,
                path: path.resolve(__dirname, `routes${route}.js`)
            });
        }
    });

    // --- STATİK DOSYALAR (API route'larından sonra) ---
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
        } catch (err) {}
    }

    // Socket.IO client library manual serve (npm paketinden)
    app.get('/socket.io/socket.io.js', (req, res) => {
        try {
            const socketIOClientPath = path.resolve(__dirname, 'node_modules/socket.io-client/dist/socket.io.min.js');
            if (fs.existsSync(socketIOClientPath)) {
                res.sendFile(socketIOClientPath);
            } else {
                res.status(404).send('Socket.IO client library not found');
            }
        } catch (err) {
            res.status(500).send('Error loading Socket.IO client library');
        }
    });

    // --- SAYFA ROUTE'LARI ---
    app.get("/", (req, res) => {
        try { res.render("index", { title: "Ana Sayfa", pageCss: "home.css", pageJs: "home.js" }); } 
        catch (error) { renderError(res, error, "Ana Sayfa"); }
    });

    app.get("/login", (req, res) => {
        try { res.render("common/login", { title: "Giriş Yap", pageCss: "auth.css", pageJs: "auth.js" }); } 
        catch (error) { renderError(res, error, "Login"); }
    });

    app.get("/register", (req, res) => {
        try { res.render("common/register", { title: "Kayıt Ol", pageCss: "auth.css", pageJs: "auth.js" }); } 
        catch (error) { renderError(res, error, "Register"); }
    });
    app.get("/register/documents", requireRole(['seller', 'courier']), async (req, res) => {
        try {
            const user = req.session && req.session.user;
            if (!user || (user.role !== 'seller' && user.role !== 'courier')) return res.redirect('/');
            const { Seller, Courier } = require('./models');
            if (user.role === 'seller') {
                const existing = await Seller.findOne({ where: { user_id: user.id } });
                if (existing) return res.redirect('/seller/pending-approval');
            } else {
                const existing = await Courier.findOne({ where: { user_id: user.id } });
                if (existing) return res.redirect('/courier/pending-approval');
            }
            res.render("common/register-documents", { title: "Belgeleri Yükleyin", pageCss: "auth.css", role: user.role, documentsOnlyNav: true });
        } catch (err) {
            renderError(res, err, "Belgeler");
        }
    });

    app.get("/about", (req, res) => res.render("common/about", { title: "Hakkımızda" }));
    app.get("/contact", (req, res) => res.render("common/contact", { title: "İletişim" }));
    app.get("/terms", (req, res) => res.render("common/terms", { title: "Kullanım Koşulları" }));
    app.get("/forgot-password", (req, res) => res.render("common/forgot-password", { title: "Şifremi Unuttum" }));
    app.get("/reset-password", (req, res) => res.render("common/reset-password", { title: "Şifre Sıfırla" }));

    // --- ALICI (BUYER) ROUTE'LARI ---
    app.get("/buyer/cart", requireRole('buyer'), (req, res) => res.render("buyer/cart", { title: "Sepetim", pageCss: "cart.css", pageJs: "cart.js" }));
    app.get("/buyer/checkout", requireRole('buyer'), (req, res) => res.render("buyer/checkout", { title: "Ödeme", pageCss: "checkout.css", pageJs: "checkout.js" }));
    app.get("/buyer/orders", requireRole('buyer'), (req, res) => res.render("buyer/orders", { title: "Siparişlerim", pageCss: "orders.css", pageJs: "orders.js", user: req.session.user || null }));
    app.get("/buyer/order-confirmation/:orderId", requireRole('buyer'), (req, res) => res.render("buyer/order-confirmation", { title: "Sipariş Onayı", pageCss: "order-confirmation.css", orderId: req.params.orderId }));
    app.get("/buyer/profile", requireRole('buyer'), (req, res) => res.render("buyer/profile", { title: "Profilim", pageCss: "profile.css", pageJs: "profile.js", user: req.session.user || null }));
    app.get("/buyer/addresses", requireRole('buyer'), (req, res) => res.render("buyer/addresses", { title: "Adreslerim", pageCss: "profile.css", pageJs: "addresses.js", user: req.session.user || null }));
    app.get("/buyer/security", requireRole('buyer'), (req, res) => res.render("buyer/security", { title: "Güvenlik", pageCss: "profile.css", pageJs: "security.js", user: req.session.user || null }));
    app.get("/buyer/wallet", requireRole('buyer'), (req, res) => res.render("buyer/wallet", { title: "Cüzdan & Kuponlar", pageCss: "profile.css", pageJs: "wallet.js", user: req.session.user || null }));
    app.get("/buyer/favorites", requireRole('buyer'), (req, res) => res.render("buyer/favorites", { title: "Favori Restoranlar", pageCss: "profile.css", pageJs: "favorites.js", user: req.session.user || null }));
    app.get("/buyer/seller-profile/:id", (req, res) => res.render("buyer/seller-profile", { title: "Satıcı Profili", pageCss: "seller-profile.css", pageJs: "seller-profile.js", sellerId: req.params.id }));
    app.get("/buyer/:id/profile", requireRole('buyer'), (req, res) => res.render("buyer/profile", { title: "Profilim", pageCss: "profile.css", pageJs: "profile.js", user: req.session.user || null, buyerId: req.params.id }));

    // --- SATICI (SELLER) ROUTE'LARI ---
    app.get("/seller/pending-approval", requireRole('seller'), async (req, res) => {
        try {
            const { Seller } = require('./models');
            const sellerId = req.session && req.session.user && req.session.user.sellerId;
            if (!sellerId) return res.redirect('/');
            const seller = await Seller.findByPk(sellerId);
            if (seller && seller.is_active) return res.redirect('/seller/dashboard');
            res.render("common/seller-pending", { title: "Başvuru Değerlendiriliyor", pageCss: "auth.css" });
        } catch (err) {
            renderError(res, err, "Bekleme");
        }
    });
    app.get("/seller/dashboard", requireRole('seller'), requireSellerApproved, (req, res) => res.render("seller/dashboard", { title: "Satıcı Paneli", pageCss: "seller-dashboard.css", pageJs: "seller.js" }));
    app.get("/seller/orders", requireRole('seller'), requireSellerApproved, (req, res) => res.render("seller/orders", { title: "Gelen Siparişler", pageCss: "seller-orders.css", pageJs: "seller.js" }));
    app.get("/seller/menu", requireRole('seller'), requireSellerApproved, (req, res) => res.render("seller/menu", { title: "Menü Yönetimi", pageCss: "seller-menu.css", pageJs: "seller.js" }));
    app.get("/seller/earnings", requireRole('seller'), requireSellerApproved, (req, res) => res.render("seller/earnings", { title: "Kazanç Raporları", pageCss: "seller-earnings.css", pageJs: "seller.js" }));
    app.get("/seller/profile", requireRole('seller'), requireSellerApproved, (req, res) => res.render("seller/profile", { title: "Restoran Profili", pageCss: "seller-profile.css", pageJs: "seller.js" }));
    app.get("/seller/coupons", requireRole('seller'), requireSellerApproved, (req, res) => res.render("seller/coupons", { title: "Kupon Yönetimi", pageCss: "seller-dashboard.css", pageJs: "seller.js" }));

    app.get("/seller/:id/dashboard", requireRole('seller'), requireSellerApproved, (req, res) => res.render("seller/dashboard", { title: "Satıcı Paneli", pageCss: "seller-dashboard.css", pageJs: "seller.js", sellerId: req.params.id }));
    app.get("/seller/:id/orders", requireRole('seller'), requireSellerApproved, (req, res) => res.render("seller/orders", { title: "Gelen Siparişler", pageCss: "seller-orders.css", pageJs: "seller.js", sellerId: req.params.id }));
    app.get("/seller/:id/menu", requireRole('seller'), requireSellerApproved, (req, res) => res.render("seller/menu", { title: "Menü Yönetimi", pageCss: "seller-menu.css", pageJs: "seller.js", sellerId: req.params.id }));
    app.get("/seller/:id/earnings", requireRole('seller'), requireSellerApproved, (req, res) => res.render("seller/earnings", { title: "Kazanç Raporları", pageCss: "seller-earnings.css", pageJs: "seller.js", sellerId: req.params.id }));
    app.get("/seller/:id/profile", requireRole('seller'), requireSellerApproved, (req, res) => res.render("seller/profile", { title: "Restoran Profili", pageCss: "seller-profile.css", pageJs: "seller.js", sellerId: req.params.id }));
    app.get("/seller/:id/coupons", requireRole('seller'), requireSellerApproved, (req, res) => res.render("seller/coupons", { title: "Kupon Yönetimi", pageCss: "seller-dashboard.css", pageJs: "seller.js", sellerId: req.params.id }));

    // --- KURYE (COURIER) ROUTE'LARI ---
    app.get("/courier/pending-approval", requireRole('courier'), async (req, res) => {
        try {
            const { Courier } = require('./models');
            const userId = req.session && req.session.user && req.session.user.id;
            if (!userId) return res.redirect('/');
            const courier = await Courier.findOne({ where: { user_id: userId } });
            if (courier && courier.is_active) return res.redirect('/courier/dashboard');
            res.render("common/courier-pending", { title: "Başvuru Değerlendiriliyor", pageCss: "auth.css" });
        } catch (err) {
            renderError(res, err, "Bekleme");
        }
    });
    app.get("/courier/:id/dashboard", requireRole('courier'), requireCourierApproved, (req, res) => res.render("courier/dashboard", { title: "Kurye Paneli", pageCss: "courier.css", pageJs: "courier.js", courierId: req.params.id }));
    app.get("/courier/:id/available", requireRole('courier'), requireCourierApproved, (req, res) => res.render("courier/available", { title: "Müsait Siparişler", pageCss: "courier.css", pageJs: "courier.js", courierId: req.params.id }));
    app.get("/courier/:id/history", requireRole('courier'), requireCourierApproved, (req, res) => res.render("courier/history", { title: "Teslimat Geçmişi", pageCss: "courier.css", pageJs: "courier.js", courierId: req.params.id }));
    app.get("/courier/:id/profile", requireRole('courier'), requireCourierApproved, (req, res) => res.render("courier/profile", { title: "Kurye Profili", pageCss: "courier.css", pageJs: "courier.js", courierId: req.params.id }));

    // ID'siz kurye URL'leri için otomatik yönlendirme (F5 / manuel URL ihtiyacını azaltır)
    app.get("/courier/dashboard", requireRole('courier'), requireCourierApproved, (req, res) => {
        const courierId = req.session?.user?.courierId || req.session?.user?.id;
        if (!courierId) return res.redirect("/");
        return res.redirect(`/courier/${courierId}/dashboard`);
    });
    app.get("/courier/available", requireRole('courier'), requireCourierApproved, (req, res) => {
        const courierId = req.session?.user?.courierId || req.session?.user?.id;
        if (!courierId) return res.redirect("/");
        return res.redirect(`/courier/${courierId}/available`);
    });
    app.get("/courier/history", requireRole('courier'), requireCourierApproved, (req, res) => {
        const courierId = req.session?.user?.courierId || req.session?.user?.id;
        if (!courierId) return res.redirect("/");
        return res.redirect(`/courier/${courierId}/history`);
    });
    app.get("/courier/profile", requireRole('courier'), requireCourierApproved, (req, res) => {
        const courierId = req.session?.user?.courierId || req.session?.user?.id;
        if (!courierId) return res.redirect("/");
        return res.redirect(`/courier/${courierId}/profile`);
    });

    // --- ADMIN ROUTE'LARI ---
    app.get("/admin/users", requireRole(['admin','super_admin','support']), (req, res) => res.render("admin/user-management", { title: "Kullanıcı Yönetimi", pageCss: "admin.css", pageJs: "admin.js" }));
    app.get("/admin/coupons", requireRole(['admin','super_admin','support']), (req, res) => res.render("admin/coupons", { title: "Kupon Yönetimi", pageCss: "admin.css", pageJs: "admin.js" }));
    app.get("/admin/sellers", requireRole(['admin','super_admin','support']), (req, res) => res.render("admin/sellers", { title: "Satıcı Onayları", pageCss: "admin.css", pageJs: "admin.js" }));
    app.get("/admin/couriers", requireRole(['admin','super_admin','support']), (req, res) => res.render("admin/couriers", { title: "Kurye Onayları", pageCss: "admin.css", pageJs: "admin.js" }));
    app.get("/admin/reports", requireRole(['admin','super_admin','support']), (req, res) => res.render("admin/reports", { title: "Raporlar", pageCss: "admin.css", pageJs: "admin.js" }));

    // --- HATA YAKALAMA FONKSİYONLARI ---
    function renderError(res, error, pageName) {
        writeLog('ERROR', `${pageName} render hatası`, { error: error.message });
        res.status(500).send(`<h1>500 - Render Hatası (${pageName})</h1><p>${error.message}</p>`);
    }

    // --- 404 VE GENEL HATA YAKALAMA ---
    app.use((req, res) => {
        if (!req.path.includes('.well-known')) writeLog('WARN', `404: ${req.url}`);
        if (req.path.startsWith('/api/')) {
            return res.status(404).json({ success: false, message: 'Kaynak bulunamadı.', code: 404 });
        }
        res.status(404).render('common/404', { layout: false });
    });

    app.use((err, req, res, next) => {
        writeLog('ERROR', 'Server error occurred', { message: err.message, stack: err.stack });
        res.status(500).send(`<h1>500 - Sunucu Hatası</h1><p>${err.message}</p>`);
    });

    // --- SERVER BAŞLATMA (KRİTİK DÜZELTME BURADA YAPILDI) ---
    // IISNode, process.env.PORT içine Named Pipe yolu atar. 
    // Bu yüzden direkt bunu dinlemeliyiz. Karmaşık port kontrollerine gerek yoktur.
    const PORT = process.env.PORT || 3000;

    // HTTP server ve Socket.IO oluştur
    const server = http.createServer(app);
    global.io = new SocketIOServer(server, {
        cors: {
            origin: true,
            credentials: true,
            methods: ["GET", "POST"]
        },
        transports: ['polling', 'websocket']
    });

    // Socket.IO connection handling
    global.io.on('connection', (socket) => {
        const userId = socket.handshake.query.userId;
        const userRole = socket.handshake.query.role;
        console.log(`🟢 Socket.IO client bağlandı - Socket ID: ${socket.id}, User ID: ${userId}, Role: ${userRole || 'unknown'}`);
        
        if (userId) {
            socket.join(`user-${userId}`);
            const roomName = `seller-${userId}`;
            socket.join(roomName);
            console.log(`   ✅ Room'a katıldı: ${roomName}`);

            if (userRole === 'courier') {
                const courierRoom = `courier-${userId}`;
                socket.join(courierRoom);
                console.log(`   ✅ Room'a katıldı: ${courierRoom}`);
            }
            if (userRole === 'buyer') {
                const buyerRoom = `buyer-${userId}`;
                socket.join(buyerRoom);
                console.log(`   ✅ Room'a katıldı: ${buyerRoom}`);
            }
        } else {
            console.warn(`   ⚠️ User ID geçilmedi`);
        }
        
        socket.on('disconnect', () => {
            console.log(`🔴 Socket.IO client disconnect - Socket ID: ${socket.id}, User ID: ${userId}`);
        });
        
        socket.on('error', (error) => {
            console.error(`❌ Socket.IO error - Socket ID: ${socket.id}:`, error);
        });
    });

    const isIisnode = !!process.env.IISNODE_VERSION;
    const isNumericPort = /^\d+$/.test(String(PORT));

    const listenServer = (portToUse) => {
        server.listen(portToUse, () => {
            writeLog('INFO', 'Server başarıyla başlatıldı', {
                port: portToUse,
                mode: isIisnode ? 'IISNode' : 'Standalone',
                nodeVersion: process.version,
                socketIO: 'enabled'
            });
            console.log(`Sunucu ${portToUse} portunda çalışıyor (Socket.IO etkin)...`);
        });
    };

    const findAvailablePort = (startPort, maxAttempts = 5) => {
        return new Promise((resolve) => {
            const tryPort = (port, attemptsLeft) => {
                const tester = net.createServer();

                tester.once('error', () => {
                    tester.close(() => {});
                    if (attemptsLeft > 0) {
                        tryPort(port + 1, attemptsLeft - 1);
                    } else {
                        resolve(startPort);
                    }
                });

                tester.once('listening', () => {
                    tester.close(() => resolve(port));
                });

                tester.listen(port);
            };

            tryPort(startPort, maxAttempts);
        });
    };

    if (!isIisnode && isNumericPort) {
        const preferredPort = Number(PORT);
        findAvailablePort(preferredPort, 5).then((selectedPort) => {
            if (selectedPort !== preferredPort) {
                console.warn(`Port ${preferredPort} kullanımda. ${selectedPort} portu kullanılacak...`);
                writeLog('WARN', 'Port kullanımda, alternatif porta geçiliyor', {
                    fromPort: preferredPort,
                    toPort: selectedPort
                });
            }
            listenServer(selectedPort);
        });
    } else {
        listenServer(PORT);
    }

    module.exports = app;

} catch (startupError) {
    const express = require("express");
    const errorApp = express();
    errorApp.get("*", (req, res) => res.status(500).send(`<h1>Kritik Başlatma Hatası</h1><pre>${startupError.stack}</pre>`));
    module.exports = errorApp;
}