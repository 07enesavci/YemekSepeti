const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const crypto = require('crypto');

function requireEnv(req, res, next) {
    if (process.env.NODE_ENV !== 'production') return next();
    const required = ['SESSION_SECRET', 'DB_HOST', 'DB_NAME'];
    const missing = required.filter(key => !process.env[key] || process.env[key].trim() === '');
    if (missing.length > 0) {
        console.error('[Security] Eksik env:', missing.join(', '));
        return res.status(500).json({ success: false, message: 'Sunucu yapılandırma hatası.' });
    }
    next();
}

// Proxy arkasındayken gerçek IP'yi al
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return String(forwarded).split(',')[0].trim();
    }
    return req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
}

// express-rate-limit v8+ ipKeyGenerator helper (IPv6 uyumlu)
// validate: { ip: false } ile custom keyGenerator'ı birlikte kullanıyoruz
// (trust proxy=1 ile req.ip doğru gelir; biz sadece X-Forwarded-For prefix'ini de kontrol ediyoruz)

// Genel API rate limit (dakikada 200 istek)
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    message: { success: false, message: 'Çok fazla istek. Lütfen biraz bekleyin.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { ip: false },
    skip: (req) => req.method === 'OPTIONS'
});

// Auth endpoint'leri: 15 dakikada 10 deneme (brute-force önleme)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { ip: false },
    skip: (req) => req.method === 'OPTIONS'
});

// Kritik endpoint'ler: 1 dakikada 5 deneme (şifre sıfırlama, kayıt, doğrulama)
const strictLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { success: false, message: 'Çok fazla deneme. Lütfen 1 dakika bekleyin.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { ip: false },
    skip: (req) => req.method === 'OPTIONS'
});

// CSRF token oluştur ve doğrula (Double-Submit Cookie pattern)
function generateCsrfToken() {
    return crypto.randomBytes(32).toString('hex');
}

function csrfProtection(req, res, next) {
    // GET, HEAD, OPTIONS isteklerine CSRF uygulanmaz
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        // Her GET isteğinde token yoksa set et
        if (!req.session.csrfToken) {
            req.session.csrfToken = generateCsrfToken();
        }
        res.locals.csrfToken = req.session.csrfToken;
        return next();
    }

    // OAuth callback'leri CSRF'den muaf (dış redirect)
    if (req.path && req.path.startsWith('/api/auth/google/')) {
        return next();
    }

    const sessionToken = req.session && req.session.csrfToken;
    const requestToken =
        (req.headers && req.headers['x-csrf-token']) ||
        (req.body && req.body._csrf) ||
        (req.query && req.query._csrf);

    if (!sessionToken || !requestToken || sessionToken !== requestToken) {
        return res.status(403).json({
            success: false,
            message: 'Güvenlik doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin.'
        });
    }
    next();
}

// CSRF token endpoint'i (frontend'den alınır)
function csrfTokenRoute(req, res) {
    if (!req.session.csrfToken) {
        req.session.csrfToken = generateCsrfToken();
    }
    res.json({ token: req.session.csrfToken });
}

function helmetMiddleware() {
    return helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https://cdn.socket.io",
                    "https://cdnjs.cloudflare.com",
                    "https://unpkg.com",
                    "https://static.cloudflareinsights.com",
                    "https://cdn.jsdelivr.net",
                    "https://*.kaspersky-labs.com"
                ],
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https://fonts.googleapis.com",
                    "https://unpkg.com"
                ],
                fontSrc: [
                    "'self'",
                    "https://fonts.gstatic.com",
                    "https://unpkg.com"
                ],
                imgSrc: ["'self'", "data:", "https:", "http:", "blob:"],
                connectSrc: [
                    "'self'",
                    "http://localhost:3000",
                    "http://127.0.0.1:3000",
                    "https://cdn.socket.io",
                    "wss:",
                    "ws:",
                    "https://unpkg.com",
                    "https://nominatim.openstreetmap.org",
                    "https://router.project-osrm.org",
                    "https://*.tile.openstreetmap.org",
                    "https://*.kaspersky-labs.com"
                ],
                workerSrc: ["'self'", "blob:"],
                frameSrc: ["'self'", "https://www.openstreetmap.org"]
            }
        },
        crossOriginEmbedderPolicy: false
    });
}

module.exports = {
    requireEnv,
    apiLimiter,
    authLimiter,
    strictLimiter,
    csrfProtection,
    csrfTokenRoute,
    helmetMiddleware,
    getClientIp
};
