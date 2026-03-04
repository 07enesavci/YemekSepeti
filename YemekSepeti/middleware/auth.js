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

module.exports = {
	getTokenFromRequest,
	authenticateToken,
	requireAdmin,
	requireAuth,
	requireRole
};