const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

/**
 * SQL injection önlemi: Uygulama Sequelize ORM kullanıyor; ham SQL yazılacaksa
 * mutlaka parametre binding kullanın: sequelize.query(sql, { replacements: { id: req.params.id } })
 * veya Model.findByPk(id) / Model.findOne({ where: { id } }) kullanın.
 * Kullanıcı girişi (req.body, req.query, req.params) doğrulama için express-validator kullanılıyor.
 */

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

// trust proxy server.js'te açık; validate: { ip: false } proxy/upload sırasında undefined ip hatasını önler
// (Özel keyGenerator kullanmıyoruz; kütüphanenin varsayılan IPv6-uyumlu key'i kullanılıyor.)

// Genel API rate limit (dakikada 200 istek)
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    message: { success: false, message: 'Çok fazla istek. Lütfen biraz bekleyin.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { ip: false }
});

// Auth endpoint'leri için daha sıkı (brute-force önleme)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { success: false, message: 'Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { ip: false }
});

// Helmet güvenlik başlıkları (CSP'yi EJS için gevşek tutuyoruz)
function helmetMiddleware() {
    return helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.socket.io", "https://cdnjs.cloudflare.com", "https://unpkg.com", "https://static.cloudflareinsights.com"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com", "https://unpkg.com"],
                imgSrc: ["'self'", "data:", "https:", "http:", "blob:"],
                connectSrc: ["'self'", "https://cdn.socket.io", "wss:", "ws:", "https://unpkg.com", "https://nominatim.openstreetmap.org", "https://router.project-osrm.org", "https://*.tile.openstreetmap.org"],
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
    helmetMiddleware
};
