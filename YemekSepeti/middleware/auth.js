var jwt=require('jsonwebtoken');
require('dotenv').config();

function getTokenFromRequest(req) 
{
	var xAuth=null;
	if (req.get) 
	{
		var xAuthLower=req.get('x-auth-token');
		if (xAuthLower) 
		{
			xAuth=xAuthLower;
		} 
		else 
		{
			xAuth=req.get('X-Auth-Token');
		}
	}
	if (xAuth) 
	{
		return xAuth;
	}

	var authHeader=null;
	if (req.headers) 
	{
		if (req.headers['authorization']) 
		{
			authHeader=req.headers['authorization'];
		} 
		else if (req.headers['Authorization']) 
		{
			authHeader=req.headers['Authorization'];
		}
	}
	if (authHeader) 
	{
		var parts=authHeader.split(' ');
		if (parts.length===2) 
		{
			if (/^Bearer$/i.test(parts[0])) 
			{
				return parts[1];
			}
		}
		if (parts.length===1) 
		{
			return parts[0];
		}
	}

	if (req.cookies) 
	{
		if (req.cookies.token) 
		{
			return req.cookies.token;
		}
	}

	if (req.query) 
	{
		if (req.query.token) 
		{
			return req.query.token;
		}
	}

	return null;
}

function authenticateToken(req, res, next) 
{
	if (req.session) 
	{
		if (req.session.isAuthenticated) 
		{
			if (req.session.user) 
			{
				req.user=req.session.user;
				return next();
			}
		}
	}

	var token=getTokenFromRequest(req);

	if (!token) 
	{
		return res.status(401).json({
			success: false,
			message: "Erişim token'ı bulunamadı. Lütfen giriş yapın."
		});
	}

	var secret=process.env.JWT_SECRET;
	if (!secret) 
	{
		return res.status(500).json({
			success: false,
			message: 'Sunucu yapılandırması hatası: JWT gizli anahtarı bulunamadı.'
		});
	}

	jwt.verify(token, secret, (err, payload)=>{
		if (err) 
		{
			return res.status(401).json({
				success: false,
				message: 'Token geçersiz veya süresi dolmuş. Lütfen tekrar giriş yapın.'
			});
		}

		var userId;
		if (payload.id) 
		{
			userId=payload.id;
		} 
		else if (payload.userId) 
		{
			userId=payload.userId;
		} 
		else if (payload.sub) 
		{
			userId=payload.sub;
		} 
		else 
		{
			userId=null;
		}

		var userRole;
		if (payload.role) 
		{
			userRole=payload.role;
		} 
		else 
		{
			userRole='user';
		}

		var userEmail;
		if (payload.email) 
		{
			userEmail=payload.email;
		} 
		else 
		{
			userEmail=null;
		}

		req.user={
			id: userId,
			role: userRole,
			email: userEmail
		};

		next();
	});
}

function requireAdmin(req, res, next) {
	if (req.session) 
	{
		if (req.session.user) 
		{
			req.user=req.session.user;
		}
	}
	
	if (!req.user) 
	{
		return res.status(403).json({
			success: false,
			message: 'Bu işlem için admin yetkisi gereklidir.'
		});
	}
	if (req.user.role!=='admin') 
	{
		return res.status(403).json({
			success: false,
			message: 'Bu işlem için admin yetkisi gereklidir.'
		});
	}
	next();
}

function requireAuth(req, res, next) 
{
	if (!req.session) 
	{
		return res.status(401).json({
			success: false,
			message: "Bu işlem için giriş yapmanız gerekiyor."
		});
	}
	
	if (!req.session.isAuthenticated) 
	{
		return res.status(401).json({
			success: false,
			message: "Bu işlem için giriş yapmanız gerekiyor."
		});
	}
	if (!req.session.user) 
	{
		return res.status(401).json({
			success: false,
			message: "Bu işlem için giriş yapmanız gerekiyor."
		});
	}
	
	req.user=req.session.user;
	next();
}

function requireRole(allowedRoles) 
{
	var roles;
	if (Array.isArray(allowedRoles)) 
	{
		roles=allowedRoles;
	} 
	else 
	{
		roles=[allowedRoles];
	}
	
	return (req, res, next)=>{
		if (!req.session) 
		{
			if (req.method==='GET') 
			{
				if (!req.path.startsWith('/api/')) 
				{
					var redirectUrl=req.originalUrl;
					if (!redirectUrl) 
					{
						redirectUrl=req.url;
					}
					return res.redirect('/login?redirect=' + encodeURIComponent(redirectUrl));
				}
			}
			return res.status(401).json({
				success: false,
				message: "Bu işlem için giriş yapmanız gerekiyor."
			});
		}

		if (!req.session.isAuthenticated) 
		{
			if (req.method==='GET') 
			{
				if (!req.path.startsWith('/api/')) 
				{
					var redirectUrl2=req.originalUrl;
					if (!redirectUrl2) 
					{
						redirectUrl2=req.url;
					}
					return res.redirect('/login?redirect=' + encodeURIComponent(redirectUrl2));
				}
			}
			return res.status(401).json({
				success: false,
				message: "Bu işlem için giriş yapmanız gerekiyor."
			});
		}

		if (!req.session.user) 
		{
			if (req.method==='GET') 
			{
				if (!req.path.startsWith('/api/')) 
				{
					var redirectUrl3=req.originalUrl;
					if (!redirectUrl3) 
					{
						redirectUrl3=req.url;
					}
					return res.redirect('/login?redirect=' + encodeURIComponent(redirectUrl3));
				}
			}
			return res.status(401).json({
				success: false,
				message: "Bu işlem için giriş yapmanız gerekiyor."
			});
		}

		var userRole=req.session.user.role;
		var roleFound=false;
		for (var i=0; i<roles.length; i++) 
		{
			if (roles[i]===userRole) 
			{
				roleFound=true;
				break;
			}
		}
		
		if (!roleFound) 
		{
			var redirectPath='/';
			
			if (userRole==='buyer') 
			{
				redirectPath='/';
			} 
			else if (userRole==='seller') 
			{
				redirectPath='/seller/dashboard';
			} 
			else if (userRole==='admin') 
			{
				redirectPath='/admin/users';
			} 
			else if (userRole==='courier') 
			{
				var courierId=req.session.user.courierId;
				if (!courierId) 
				{
					courierId=req.session.user.id;
				}
				redirectPath='/courier/' + courierId + '/dashboard';
			}
			
			if (req.path) 
			{
				if (req.path.endsWith('.html')) 
				{
					return res.redirect(redirectPath);
				}
			}
			
			return res.status(403).json({
				success: false,
				message: "Bu sayfaya erişim yetkiniz yok.",
				redirect: redirectPath
			});
		}

		req.user=req.session.user;
		next();
	};
}

function getDomainType(req) {
    const host = String((req.headers && req.headers.host) || '').split(':')[0].toLowerCase();
    const buyerDomain = String(process.env.BUYER_DOMAIN || 'evlezzetleri.site').toLowerCase();
    const partnerDomain = String(process.env.PARTNER_DOMAIN || 'partner.evlezzetleri.site').toLowerCase();
    const adminDomain = String(process.env.ADMIN_DOMAIN || 'admin.evlezzetleri.site').toLowerCase();
    if (!host || host === 'localhost' || host === '127.0.0.1') return 'local';
    if (host === adminDomain) return 'admin';
    if (host === partnerDomain) return 'partner';
    if (host === buyerDomain) return 'buyer';
    return 'unknown';
}

function roleAllowedOnDomain(role, domainType) {
    if (domainType === 'local' || domainType === 'unknown') return true;
    if (domainType === 'buyer') return role === 'buyer';
    if (domainType === 'partner') return role === 'seller' || role === 'courier';
    if (domainType === 'admin') return role === 'admin' || role === 'super_admin' || role === 'support';
    return true;
}

function enforceRoleDomain(req, res, next) {
    const user = req.session && req.session.user;
    if (!user || !user.role) return next();
    const dt = getDomainType(req);
    if (roleAllowedOnDomain(user.role, dt)) return next();
    const isApi = req.originalUrl && String(req.originalUrl).indexOf('/api/') === 0;
    if (isApi) {
        return res.status(403).json({ success: false, message: 'Bu rolde bu domainden erişim izni yok.' });
    }
    if (dt === 'admin') return res.redirect(302, '/admin/users');
    if (dt === 'partner') return res.redirect(302, '/login');
    return res.redirect(302, '/');
}

/**
 * admin.* → yalnızca admin paneli; partner.* → yalnızca satıcı/kurye panelleri (ana sayfa / alıcı sayfalarına çıkış yok).
 */
function restrictPanelNavigation(req, res, next) {
    try {
        const dt = getDomainType(req);
        if (dt !== 'admin' && dt !== 'partner') return next();

        const rawPath = req.path || '';
        const p = rawPath.split('?')[0];
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();

        const isStatic =
            p.startsWith('/assets') ||
            p.startsWith('/public') ||
            p.startsWith('/uploads') ||
            p.startsWith('/socket.io') ||
            p === '/manifest.json' ||
            p === '/sw.js' ||
            p === '/favicon.ico' ||
            p === '/favicon.svg' ||
            p === '/favicon.png';
        if (isStatic) return next();

        if (dt === 'admin') {
            res.locals.logoHomeHref = '/admin/users';
            const adminUser =
                req.session &&
                req.session.user &&
                ['admin', 'super_admin', 'support'].indexOf(req.session.user.role) !== -1;
            if (p === '/') {
                if (!adminUser) return res.redirect(302, '/login');
                return res.redirect(302, '/admin/users');
            }
            if (p.startsWith('/buyer') || p.startsWith('/seller') || p.startsWith('/courier')) {
                return res.redirect(302, adminUser ? '/admin/users' : '/login');
            }
            if (p === '/register') return res.redirect(302, '/login');
            return next();
        }

        const u = (res.locals && res.locals.user) || (req.session && req.session.user);

        if (u && u.role === 'seller') {
            res.locals.logoHomeHref = u.sellerId
                ? `/seller/${u.sellerId}/dashboard`
                : '/seller/dashboard';
        } else if (u && u.role === 'courier') {
            const cid = u.courierId || u.id;
            res.locals.logoHomeHref = `/courier/${cid}/dashboard`;
        } else {
            res.locals.logoHomeHref = '/';
        }

        if (p === '/') {
            if (!u) return next();
            if (u.role === 'seller') {
                if (u.sellerId) return res.redirect(302, `/seller/${u.sellerId}/dashboard`);
                return res.redirect(302, '/seller/dashboard');
            }
            if (u.role === 'courier') {
                const cid = u.courierId || u.id;
                return res.redirect(302, `/courier/${cid}/dashboard`);
            }
            return res.redirect(302, '/login');
        }
        if (p.startsWith('/buyer')) {
            const fallback = res.locals.logoHomeHref || '/login';
            return res.redirect(302, fallback);
        }
        return next();
    } catch (e) {
        return next();
    }
}

/** Alıcı / sepet / vitrin API’leri admin ve partner hostlarında kapalı */
function blockShoppingApisOnPanelHosts(req, res, next) {
    try {
        const dt = getDomainType(req);
        if (dt !== 'admin' && dt !== 'partner') return next();
        const full = (req.originalUrl && String(req.originalUrl).split('?')[0]) || req.path || '';
        if (full.indexOf('/api/') !== 0) return next();
        if (
            full.startsWith('/api/buyer') ||
            full.startsWith('/api/cart') ||
            full === '/api/sellers' ||
            full.startsWith('/api/sellers/') ||
            full.startsWith('/api/favorites') ||
            full.startsWith('/api/reviews')
        ) {
            return res.status(403).json({
                success: false,
                message: 'Bu API bu alan adında kullanılamaz. Müşteri sitesini kullanın.'
            });
        }
        if (full.startsWith('/api/orders') && full.indexOf('/seller') === -1 && full.indexOf('/courier') === -1) {
            return res.status(403).json({
                success: false,
                message: 'Bu API bu alan adında kullanılamaz. Müşteri sitesini kullanın.'
            });
        }
        return next();
    } catch (e) {
        return next();
    }
}

function requireSellerApproved(req, res, next) 
{
	var isApi = req.originalUrl && req.originalUrl.indexOf('/api/') === 0;
	var sellerId = req.session && req.session.user && req.session.user.sellerId;
	if (!sellerId) 
	{
		if (!isApi) return res.redirect('/seller/pending-approval');
		return res.status(403).json({
			success: false,
			message: 'Başvurunuz henüz onaylanmadı.',
			redirect: '/seller/pending-approval'
		});
	}
	var { Seller } = require('../models');
	Seller.findByPk(sellerId)
		.then(function(seller) 
		{
			if (!seller || !seller.is_active) 
			{
				if (!isApi) return res.redirect('/seller/pending-approval');
				return res.status(403).json({
					success: false,
					message: 'Başvurunuz henüz onaylanmadı.',
					redirect: '/seller/pending-approval'
				});
			}
			next();
		})
		.catch(function(err) 
		{
			return res.status(500).json({ success: false, message: 'Sunucu hatası.' });
		});
}

function requireCourierApproved(req, res, next) 
{
	var isApi = req.originalUrl && req.originalUrl.indexOf('/api/') === 0;
	var courierId = req.session && req.session.user && (req.session.user.courierId || req.session.user.id);
	if (!courierId) 
	{
		if (!isApi) return res.redirect('/courier/pending-approval');
		return res.status(403).json({
			success: false,
			message: 'Başvurunuz henüz onaylanmadı.',
			redirect: '/courier/pending-approval'
		});
	}
	var { Courier } = require('../models');
	Courier.findOne({ where: { user_id: req.session.user.id } })
		.then(function(courier) 
		{
			if (!courier || !courier.is_active) 
			{
				if (!isApi) return res.redirect('/courier/pending-approval');
				return res.status(403).json({
					success: false,
					message: 'Başvurunuz henüz onaylanmadı.',
					redirect: '/courier/pending-approval'
				});
			}
			next();
		})
		.catch(function(err) 
		{
			return res.status(500).json({ success: false, message: 'Sunucu hatası.' });
		});
}

module.exports = {
	getTokenFromRequest,
	authenticateToken,
	requireAdmin,
	requireAuth,
	requireRole,
    getDomainType,
    roleAllowedOnDomain,
    enforceRoleDomain,
    restrictPanelNavigation,
    blockShoppingApisOnPanelHosts,
	requireSellerApproved,
	requireCourierApproved
};