const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * İstekten olası token kaynaklarını kontrol eder:
 * - Authorization header ("Bearer <token>")
 * - req.cookies.token (varsa)
 * - req.query.token (varsa)
 */
function getTokenFromRequest(req) {
	// Express'in req.get ile daha güvenli başlık okuma (case-insensitive)
	const xAuth = req.get && (req.get('x-auth-token') || req.get('X-Auth-Token'));
	if (xAuth) return xAuth;

	// Header kontrolü (diğer Authorization formları)
	const authHeader = req.headers && (req.headers['authorization'] || req.headers['Authorization']);
	if (authHeader) {
		const parts = authHeader.split(' ');
		if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
			return parts[1];
		}
		if (parts.length === 1) {
			return parts[0];
		}
	}

	// Cookie (express cookie-parser ile kullanılıyorsa)
	if (req.cookies && req.cookies.token) {
		return req.cookies.token;
	}

	// Query parametre olarak
	if (req.query && req.query.token) {
		return req.query.token;
	}

	return null;
}

/**
 * JWT Token doğrulama middleware'i
 * Korumalı route'larda kullanılır
 */
function authenticateToken(req, res, next) {
	// Token'ı al
	const token = getTokenFromRequest(req);

	if (!token) {
		return res.status(401).json({
			success: false,
			message: "Erişim token'ı bulunamadı. Lütfen giriş yapın."
		});
	}

	const secret = process.env.JWT_SECRET;
	if (!secret) {
		return res.status(500).json({
			success: false,
			message: 'Sunucu yapılandırması hatası: JWT gizli anahtarı bulunamadı.'
		});
	}

	// Token'ı doğrula - doğrulama hatalarında 401 dön
	jwt.verify(token, secret, (err, payload) => {
		if (err) {
			// Tüm doğrulama hatalarını yetkisiz olarak değerlendir
			console.warn('⚠️ JWT doğrulama hatası:', err.message);
			return res.status(401).json({
				success: false,
				message: 'Token geçersiz veya süresi dolmuş. Lütfen tekrar giriş yapın.'
			});
		}

		// Güvenlik: payload'tan sadece gerekli alanları al
		req.user = {
			id: payload.id ?? payload.userId ?? payload.sub ?? null,
			role: payload.role ?? 'user',
			email: payload.email ?? null,
		};

		next();
	});
}

/**
 * Admin kontrolü middleware'i
 * Sadece admin kullanıcıların erişebileceği route'larda kullanılır
 */
function requireAdmin(req, res, next) {
	if (!req.user || req.user.role !== 'admin') {
		return res.status(403).json({
			success: false,
			message: 'Bu işlem için admin yetkisi gereklidir.'
		});
	}
	next();
}

module.exports = {
	authenticateToken,
	requireAdmin
};

