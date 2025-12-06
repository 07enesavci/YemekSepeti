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
 * Korumalı route'larda kullanılır (geriye dönük uyumluluk için)
 * Önce session kontrolü yapar, yoksa JWT token kontrolü yapar
 */
function authenticateToken(req, res, next) {
	// Önce session kontrolü yap (birincil yöntem)
	if (req.session && req.session.isAuthenticated && req.session.user) {
		req.user = req.session.user;
		return next();
	}

	// Session yoksa JWT token kontrolü yap (geriye dönük uyumluluk için)
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
 * Önce session kontrolü yapar, yoksa req.user'dan alır
 */
function requireAdmin(req, res, next) {
	// Önce session'dan kontrol et
	if (req.session && req.session.user) {
		req.user = req.session.user;
	}
	
	if (!req.user || req.user.role !== 'admin') {
		return res.status(403).json({
			success: false,
			message: 'Bu işlem için admin yetkisi gereklidir.'
		});
	}
	next();
}

/**
 * Session kontrolü middleware'i
 * Kullanıcının giriş yapıp yapmadığını kontrol eder
 */
function requireAuth(req, res, next) {
	// Debug: Session durumunu kontrol et
	console.log('🔍 requireAuth: Session kontrolü başlatıldı', {
		hasSession: !!req.session,
		sessionID: req.sessionID,
		cookies: req.cookies,
		headers: {
			cookie: req.headers.cookie ? 'var' : 'yok',
			origin: req.headers.origin
		}
	});
	
	if (!req.session) {
		console.log('⚠️ requireAuth: req.session yok - Session oluşturulmamış');
		return res.status(401).json({
			success: false,
			message: "Bu işlem için giriş yapmanız gerekiyor."
		});
	}
	
	console.log('🔍 requireAuth: Session detayları', {
		isAuthenticated: req.session.isAuthenticated,
		hasUser: !!req.session.user,
		user: req.session.user ? { id: req.session.user.id, role: req.session.user.role } : null
	});
	
	if (!req.session.isAuthenticated || !req.session.user) {
		console.log('⚠️ requireAuth: Session var ama isAuthenticated veya user yok', {
			isAuthenticated: req.session.isAuthenticated,
			hasUser: !!req.session.user,
			sessionKeys: Object.keys(req.session)
		});
		return res.status(401).json({
			success: false,
			message: "Bu işlem için giriş yapmanız gerekiyor."
		});
	}
	
	// req.user'ı session'dan al
	req.user = req.session.user;
	console.log('✅ requireAuth: Kullanıcı doğrulandı', { userId: req.user.id, role: req.user.role });
	next();
}

/**
 * Role-based access control middleware'i
 * Belirli bir role sahip kullanıcıların erişebileceği route'larda kullanılır
 * @param {string|string[]} allowedRoles - İzin verilen roller
 */
function requireRole(allowedRoles) {
	const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
	
	return (req, res, next) => {
		// Önce authentication kontrolü
		if (!req.session || !req.session.isAuthenticated || !req.session.user) {
			// HTML sayfası isteği ise login sayfasına yönlendir
			if (req.path && req.path.endsWith('.html')) {
				return res.redirect('/pages/common/login.html');
			}
			return res.status(401).json({
				success: false,
				message: "Bu işlem için giriş yapmanız gerekiyor."
			});
		}

		const userRole = req.session.user.role;
		
		if (!roles.includes(userRole)) {
			// Yetkisiz erişim - kullanıcıyı kendi paneline yönlendir
			let redirectPath = '/';
			
			switch(userRole) {
				case 'buyer':
					redirectPath = '/pages/buyer/search.html';
					break;
				case 'seller':
					redirectPath = '/pages/seller/dashboard.html';
					break;
				case 'admin':
					redirectPath = '/pages/admin/user-management.html';
					break;
				case 'courier':
					redirectPath = '/pages/courier/dashboard.html';
					break;
			}
			
			// HTML sayfası isteği ise yönlendir
			if (req.path && req.path.endsWith('.html')) {
				return res.redirect(redirectPath);
			}
			
			return res.status(403).json({
				success: false,
				message: "Bu sayfaya erişim yetkiniz yok.",
				redirect: redirectPath
			});
		}

		req.user = req.session.user;
		next();
	};
}

module.exports = {
	getTokenFromRequest,
	authenticateToken,
	requireAdmin,
	requireAuth,
	requireRole
};

