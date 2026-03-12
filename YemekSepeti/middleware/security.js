const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Production'da kritik env değişkenlerini kontrol et
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

// Genel API rate limit (dakikada 200 istek)
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    message: { success: false, message: 'Çok fazla istek. Lütfen biraz bekleyin.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Auth endpoint'leri için daha sıkı (brute-force önleme)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { success: false, message: 'Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Helmet güvenlik başlıkları (CSP'yi EJS için gevşek tutuyoruz)
function helmetMiddleware() {
    return helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.socket.io", "https://cdnjs.cloudflare.com", "https://unpkg.com"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com", "https://unpkg.com"],
                imgSrc: ["'self'", "data:", "https:", "http:", "blob:"],
                connectSrc: ["'self'", "https://cdn.socket.io", "wss:", "ws:", "https://unpkg.com", "https://nominatim.openstreetmap.org", "https://router.project-osrm.org", "https://*.tile.openstreetmap.org"],
                workerSrc: ["'self'", "blob:"]
            }
        },
        crossOriginEmbedderPolicy: false
    });
}

module.exports = {
    requireEnv,
    apiLimiter,
    authLimiter,
    helmetMiddleware
};
