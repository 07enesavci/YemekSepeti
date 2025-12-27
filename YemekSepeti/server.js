try {
    const express = require("express");
    const path = require("path");
    const session = require("express-session");
    const expressLayouts = require('express-ejs-layouts');
    const fs = require('fs');
    const app = express();
    require("dotenv").config();

    const logsDir = path.resolve(__dirname, 'logs');
    if (!fs.existsSync(logsDir)) {
        try {
            fs.mkdirSync(logsDir, { recursive: true });
        } catch (err) {}
    }

    function getLogFilePath() {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        return path.resolve(logsDir, `app-${dateStr}.log`);
    }

    function writeLog(level, message, data = null) {
        try {
            const timestamp = new Date().toISOString();
            const logFile = getLogFilePath();
            const logLine = `[${timestamp}] [${level}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
            fs.appendFile(logFile, logLine, (err) => {});
            if (level === 'ERROR') {
                console.error(`[${timestamp}] ${message}`, data || '');
            } else if (level === 'WARN') {
                console.warn(`[${timestamp}] ${message}`, data || '');
            }
        } catch (err) {}
    }

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

    let db;
    try {
        db = require("./config/database");
        db.testConnection().then(() => {
            writeLog('INFO', 'Veritabanı bağlantısı başarılı (mysql2)');
        }).catch((err) => {
            writeLog('ERROR', 'Veritabanı bağlantı hatası (mysql2)', { error: err.message });
        });
    } catch (err) {
        writeLog('ERROR', 'Veritabanı modülü yüklenemedi', { error: err.message });
    }

    try {
        require("./models");
        const { sequelizeTestConnection } = require("./config/database");
        sequelizeTestConnection().then(() => {
            writeLog('INFO', 'Sequelize bağlantısı başarılı');
        }).catch((err) => {
            writeLog('ERROR', 'Sequelize bağlantı hatası', { error: err.message });
        });
    } catch (err) {
        writeLog('ERROR', 'Sequelize modülü yüklenemedi', { error: err.message });
    }

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

    let sessionStore = null;
    if (process.env.NODE_ENV === 'production' || process.env.USE_MYSQL_SESSION === 'true') {
        let mysqlSessionModule = null;
        try {
            mysqlSessionModule = require.resolve('connect-mysql2');
        } catch (resolveError) {}
        
        if (mysqlSessionModule) {
            try {
                const MySQLStore = require('connect-mysql2')(session);
                const isCloudDB = process.env.DB_HOST && (process.env.DB_HOST.includes('aivencloud.com') || process.env.DB_SSL === 'true');
                const sslConfig = isCloudDB ? {
                    rejectUnauthorized: false,
                    minVersion: 'TLSv1.2'
                } : false;
                
                const storeConfig = {
                    host: 'yemek-sepeti-yemeksepeti.i.aivencloud.com',
                    port: 14973,
                    user: 'avnadmin',
                    password: 'AVNS_KngOGLfNZbx-76xa9YT',
                    database: 'defaultdb',
                    createTableIfNotExists: true,
                    ssl: {
                        rejectUnauthorized: false,
                        minVersion: 'TLSv1.2'
                    },
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
            secure: false,
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000
        }
    };

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

    const { requireRole, requireAuth } = require('./middleware/auth');

    const routeFiles = [
        "/api/auth", "/api/sellers", "/api/seller", "/api/orders",
        "/api/admin", "/api/cart", "/api/courier", "/api/buyer", "/api/upload"
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

    app.get("/", (req, res) => {
        try {
            res.render("index", { title: "Ana Sayfa", pageCss: "home.css", pageJs: "home.js" });
        } catch (error) { renderError(res, error, "Ana Sayfa"); }
    });

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

    app.get("/about", (req, res) => res.render("common/about", { title: "Hakkımızda" }));
    app.get("/contact", (req, res) => res.render("common/contact", { title: "İletişim" }));
    app.get("/terms", (req, res) => res.render("common/terms", { title: "Kullanım Koşulları" }));
    app.get("/forgot-password", (req, res) => res.render("common/forgot-password", { title: "Şifremi Unuttum" }));
    app.get("/reset-password", (req, res) => res.render("common/reset-password", { title: "Şifre Sıfırla" }));

    app.get("/buyer/cart", requireRole('buyer'), (req, res) => res.render("buyer/cart", { title: "Sepetim", pageCss: "cart.css", pageJs: "cart.js" }));
    app.get("/buyer/checkout", requireRole('buyer'), (req, res) => res.render("buyer/checkout", { title: "Ödeme", pageCss: "checkout.css", pageJs: "checkout.js" }));
    app.get("/buyer/orders", requireRole('buyer'), (req, res) => res.render("buyer/orders", { title: "Siparişlerim", pageCss: "orders.css", pageJs: "orders.js" }));
    app.get("/buyer/order-confirmation/:orderId", requireRole('buyer'), (req, res) => res.render("buyer/order-confirmation", { title: "Sipariş Onayı", pageCss: "order-confirmation.css", orderId: req.params.orderId }));
    app.get("/buyer/profile", requireRole('buyer'), (req, res) => res.render("buyer/profile", { title: "Profilim", pageCss: "profile.css", pageJs: "profile.js", user: req.session.user || null }));
    app.get("/buyer/addresses", requireRole('buyer'), (req, res) => res.render("buyer/addresses", { title: "Adreslerim", pageCss: "profile.css", pageJs: "addresses.js", user: req.session.user || null }));
    app.get("/buyer/security", requireRole('buyer'), (req, res) => res.render("buyer/security", { title: "Güvenlik", pageCss: "profile.css", pageJs: "security.js", user: req.session.user || null }));
    app.get("/buyer/wallet", requireRole('buyer'), (req, res) => res.render("buyer/wallet", { title: "Cüzdan & Kuponlar", pageCss: "profile.css", pageJs: "wallet.js", user: req.session.user || null }));
    app.get("/buyer/seller-profile/:id", (req, res) => res.render("buyer/seller-profile", { title: "Satıcı Profili", pageCss: "seller-profile.css", pageJs: "seller-profile.js", sellerId: req.params.id }));
    app.get("/buyer/:id/profile", requireRole('buyer'), (req, res) => res.render("buyer/profile", { title: "Profilim", pageCss: "profile.css", pageJs: "profile.js", user: req.session.user || null, buyerId: req.params.id }));

    app.get("/seller/dashboard", requireRole('seller'), (req, res) => res.render("seller/dashboard", { title: "Satıcı Paneli", pageCss: "seller-dashboard.css", pageJs: "seller.js" }));
    app.get("/seller/orders", requireRole('seller'), (req, res) => res.render("seller/orders", { title: "Gelen Siparişler", pageCss: "seller-orders.css", pageJs: "seller.js" }));
    app.get("/seller/menu", requireRole('seller'), (req, res) => res.render("seller/menu", { title: "Menü Yönetimi", pageCss: "seller-menu.css", pageJs: "seller.js" }));
    app.get("/seller/earnings", requireRole('seller'), (req, res) => res.render("seller/earnings", { title: "Kazanç Raporları", pageCss: "seller-earnings.css", pageJs: "seller.js" }));
    app.get("/seller/profile", requireRole('seller'), (req, res) => res.render("seller/profile", { title: "Restoran Profili", pageCss: "seller-profile.css", pageJs: "seller.js" }));
    app.get("/seller/coupons", requireRole('seller'), (req, res) => res.render("seller/coupons", { title: "Kupon Yönetimi", pageCss: "seller-dashboard.css", pageJs: "seller.js" }));

    app.get("/seller/:id/dashboard", requireRole('seller'), (req, res) => res.render("seller/dashboard", { title: "Satıcı Paneli", pageCss: "seller-dashboard.css", pageJs: "seller.js", sellerId: req.params.id }));
    app.get("/seller/:id/orders", requireRole('seller'), (req, res) => res.render("seller/orders", { title: "Gelen Siparişler", pageCss: "seller-orders.css", pageJs: "seller.js", sellerId: req.params.id }));
    app.get("/seller/:id/menu", requireRole('seller'), (req, res) => res.render("seller/menu", { title: "Menü Yönetimi", pageCss: "seller-menu.css", pageJs: "seller.js", sellerId: req.params.id }));
    app.get("/seller/:id/earnings", requireRole('seller'), (req, res) => res.render("seller/earnings", { title: "Kazanç Raporları", pageCss: "seller-earnings.css", pageJs: "seller.js", sellerId: req.params.id }));
    app.get("/seller/:id/profile", requireRole('seller'), (req, res) => res.render("seller/profile", { title: "Restoran Profili", pageCss: "seller-profile.css", pageJs: "seller.js", sellerId: req.params.id }));
    app.get("/seller/:id/coupons", requireRole('seller'), (req, res) => res.render("seller/coupons", { title: "Kupon Yönetimi", pageCss: "seller-dashboard.css", pageJs: "seller.js", sellerId: req.params.id }));

    app.get("/courier/:id/dashboard", requireRole('courier'), (req, res) => res.render("courier/dashboard", { title: "Kurye Paneli", pageCss: "courier.css", pageJs: "courier.js", courierId: req.params.id }));
    app.get("/courier/:id/available", requireRole('courier'), (req, res) => res.render("courier/available", { title: "Müsait Siparişler", pageCss: "courier.css", pageJs: "courier.js", courierId: req.params.id }));
    app.get("/courier/:id/history", requireRole('courier'), (req, res) => res.render("courier/history", { title: "Teslimat Geçmişi", pageCss: "courier.css", pageJs: "courier.js", courierId: req.params.id }));
    app.get("/courier/:id/profile", requireRole('courier'), (req, res) => res.render("courier/profile", { title: "Kurye Profili", pageCss: "courier.css", pageJs: "courier.js", courierId: req.params.id }));

    app.get("/admin/users", requireRole('admin'), (req, res) => res.render("admin/user-management", { title: "Kullanıcı Yönetimi", pageCss: "admin.css", pageJs: "admin.js" }));
    app.get("/admin/coupons", requireRole('admin'), (req, res) => res.render("admin/coupons", { title: "Kupon Yönetimi", pageCss: "admin.css", pageJs: "admin.js" }));

    function renderError(res, error, pageName) {
        writeLog('ERROR', `${pageName} render hatası`, { error: error.message });
        res.status(500).send(`<h1>500 - Render Hatası (${pageName})</h1><p>${error.message}</p>`);
    }

    app.use((req, res) => {
        if (!req.path.includes('.well-known')) writeLog('WARN', `404: ${req.url}`);
        res.status(404).send(`<h1>404 - Sayfa Bulunamadı</h1><a href="/">Ana Sayfaya Dön</a>`);
    });

    app.use((err, req, res, next) => {
        writeLog('ERROR', 'Server error occurred', { message: err.message, stack: err.stack });
        res.status(500).send(`<h1>500 - Sunucu Hatası</h1><p>${err.message}</p>`);
    });

    const INITIAL_PORT = parseInt(process.env.PORT, 10) || 3000;

    function startServer(port, attemptedFallback = false) {
        const server = app.listen(port, () => {
            const isIisnode = !!process.env.IISNODE_VERSION;
            writeLog('INFO', 'Server başarıyla başlatıldı', {
                port: port,
                mode: isIisnode ? 'IISNode' : 'Standalone',
                nodeVersion: process.version
            });
        });

        server.on('error', (err) => {
            if (err && err.code === 'EADDRINUSE' && !attemptedFallback) {
                const nextPort = port + 1;
                writeLog('WARN', 'Port kullanımda, fallback port deneniyor', { from: port, to: nextPort });
                return startServer(nextPort, true);
            }
            writeLog('ERROR', 'Server Listen Hatası', { error: err.message, code: err.code, port: port });
        });
    }

    startServer(INITIAL_PORT);

    module.exports = app;

} catch (startupError) {
    const express = require("express");
    const errorApp = express();
    errorApp.get("*", (req, res) => res.status(500).send(`<h1>Kritik Başlatma Hatası</h1><pre>${startupError.stack}</pre>`));
    module.exports = errorApp;
}
