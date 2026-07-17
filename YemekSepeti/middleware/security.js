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

// Rate limit key: TCP bağlantısının gerçek IP'si.
// req.ip, trust proxy ayarına göre X-Forwarded-For'dan gelir ve istemci tarafından
// sahte header ekleyerek manipüle edilebilir (IP spoofing ile rate limit bypass).
// req.socket.remoteAddress ise TCP katmanından gelir — istemci bunu değiştiremez.
function socketIpKey(req) {
    return (req.socket && req.socket.remoteAddress) || req.ip || 'unknown';
}

// Genel API rate limit (dakikada 200 istek)
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    keyGenerator: socketIpKey,
    message: { success: false, message: 'Çok fazla istek. Lütfen biraz bekleyin.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    skip: (req) => req.method === 'OPTIONS'
});

// Auth endpoint'leri: 15 dakikada 10 deneme (brute-force önleme)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: socketIpKey,
    message: { success: false, message: 'Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    skip: (req) => req.method === 'OPTIONS'
});

// Kritik endpoint'ler: 1 dakikada 5 deneme (şifre sıfırlama, kayıt, doğrulama)
const strictLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    keyGenerator: socketIpKey,
    message: { success: false, message: 'Çok fazla deneme. Lütfen 1 dakika bekleyin.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    skip: (req) => req.method === 'OPTIONS'
});

// Excel export endpoint'leri: her biri DB'de ağır bir sorgu + dosya üretimi tetikler.
// 5 dakikada 10 istekle sınırlandırarak art arda tetiklenen export'ların sunucuyu
// (DB bağlantı havuzu + CPU) zorlamasının önüne geçer.
const exportLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 10,
    keyGenerator: socketIpKey,
    message: { success: false, message: 'Çok fazla rapor indirme isteği. Lütfen birkaç dakika bekleyin.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    skip: (req) => req.method === 'OPTIONS'
});

// CSRF token oluştur ve doğrula (Double-Submit Cookie pattern)
function generateCsrfToken() {
    return crypto.randomBytes(32).toString('hex');
}

function csrfProtection(req, res, next) {
    // GET, HEAD, OPTIONS — salt okuma, CSRF gerekmez
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        if (req.session && !req.session.csrfToken) {
            req.session.csrfToken = generateCsrfToken();
        }
        if (req.session) res.locals.csrfToken = req.session.csrfToken;
        return next();
    }

    // OAuth dış yönlendirmesi — muaf
    if (req.path && req.path.startsWith('/api/auth/google/')) return next();

    // ── Katman 1: CSRF Token eşleşmesi (double-submit, birincil koruma) ──
    const sessionToken = req.session && req.session.csrfToken;
    const requestToken =
        (req.headers && req.headers['x-csrf-token']) ||
        (req.body && req.body._csrf) ||
        (req.query && req.query._csrf);

    if (sessionToken && requestToken && sessionToken === requestToken) {
        return next(); // ✅ Token eşleşti
    }

    // ── Katman 2: Origin / Referer same-site doğrulaması ──────────
    // ÖNEMLİ: Origin/Referer VARSA ve FARKLI site ise → oturum açık olsa bile
    // kesin CSRF kabul edilir ve reddedilir. Eskiden "req.session.user varsa serbest"
    // mantığı vardı; bu, token taşımayan cross-origin isteklerin (örn. saldırgan
    // sayfasından fetch + ele geçmiş/yan-kanal cookie) geçmesine yol açıyordu.
    // Artık tek koruma SameSite=Lax değil; origin doğrulaması da zorunlu.
    const origin  = (req.headers && req.headers['origin'])  || '';
    const referer = (req.headers && req.headers['referer']) || '';
    const host    = ((req.headers && req.headers['host']) || '').split(':')[0].toLowerCase();

    const getRootDomain = (h) => {
        const parts = h.replace(/:\d+$/, '').split('.');
        return parts.length >= 2 ? parts.slice(-2).join('.') : h;
    };
    const isSameSite = (value) => {
        try {
            const hn = new URL(value).hostname.toLowerCase();
            return hn === host || getRootDomain(hn) === getRootDomain(host);
        } catch (_) {
            return false; // ayrıştırılamayan origin/referer → güvenli tarafta reddet
        }
    };

    const denyCsrf = () => res.status(403).json({
        success: false,
        message: 'Güvenlik doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin.'
    });

    if (origin) {
        return isSameSite(origin) ? next() : denyCsrf();   // farklı origin → reddet
    }
    if (referer) {
        return isSameSite(referer) ? next() : denyCsrf();  // farklı referer → reddet
    }

    // ── Origin ve Referer YOK ─────────────────────────────────────
    // Tarayıcı, cross-site fetch/XHR'de Origin başlığını DAİMA gönderir ve
    // SameSite=Lax cookie'yi cross-site POST'ta zaten göndermez. Dolayısıyla
    // başlıksız istek tarayıcı kaynaklı bir CSRF değildir (server-to-server veya
    // same-origin gezinme). Oturum açıksa izin ver, yoksa reddet.
    if (req.session && req.session.user) {
        return next();
    }
    return denyCsrf();
}

// CSRF token endpoint'i (frontend'den alınır)
function csrfTokenRoute(req, res) {
    if (!req.session.csrfToken) {
        req.session.csrfToken = generateCsrfToken();
    }
    const token = req.session.csrfToken;
    // Session'ı explicit kaydet — production'da timing sorununu önler
    req.session.save((err) => {
        if (err) console.error('[CSRF] Session save hatası:', err);
        res.json({ token });
    });
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
                    "https://cdn.jsdelivr.net",
                    "https://nominatim.openstreetmap.org",
                    "https://router.project-osrm.org",
                    "https://*.tile.openstreetmap.org",
                    "https://*.kaspersky-labs.com"
                ],
                mediaSrc: ["'self'"],
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
    exportLimiter,
    csrfProtection,
    csrfTokenRoute,
    helmetMiddleware,
    getClientIp
};
