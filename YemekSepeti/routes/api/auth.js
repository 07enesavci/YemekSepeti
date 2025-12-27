const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../../config/database");
const { User, EmailVerificationCode, Seller } = require("../../models");
const { Op } = require("sequelize");
const { sendVerificationCode, sendPasswordResetLink } = require("../../config/email");

let _devTempSecret = null;
function ensureSecret() {
	if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
	if (process.env.NODE_ENV === 'production') {
		const msg = 'JWT_SECRET tanımlı değil. Lütfen process.env.JWT_SECRET ayarlayın.';
		throw new Error(msg);
	}
	if (!_devTempSecret) {
		const crypto = require('crypto');
		_devTempSecret = crypto.randomBytes(32).toString('hex');
	}
	process.env.JWT_SECRET = _devTempSecret;
	return _devTempSecret;
}

function generateToken(user) {
    const secret = ensureSecret();
    const payload = {
        id: user.id,
        email: user.email,
        role: user.role
    };
    try {
        return jwt.sign(payload, secret, { expiresIn: "7d", algorithm: "HS256" });
    } catch (err) {
        throw err;
    }
}

async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}

async function comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
}

function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function saveVerificationCode(email, code, type) {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);
    try {
        const normalizedCode = String(code).trim().replace(/\s+/g, '');
        await EmailVerificationCode.destroy({
            where: { email: email, type: type }
        });
        await EmailVerificationCode.create({
            email: email,
            code: normalizedCode,
            type: type,
            expires_at: expiresAt,
            used: false
        });
    } catch (error) {
        throw error;
    }
}

async function verifyCode(email, code, type) {
    try {
        const normalizedCode = String(code).trim().replace(/\s+/g, '');
        if (!normalizedCode || normalizedCode.length !== 6) {
            return false;
        }
        const allCodes = await EmailVerificationCode.findAll({
            where: { email: email, type: type },
            order: [['created_at', 'DESC']]
        });
        if (!allCodes || allCodes.length === 0) {
            return false;
        }
        const now = new Date();
        for (const dbCode of allCodes) {
            const expiresAt = new Date(dbCode.expires_at);
            if (expiresAt <= now) continue;
            if (dbCode.used) continue;
            const dbCodeStr = String(dbCode.code).trim().replace(/\s+/g, '');
            if (dbCodeStr === normalizedCode) {
                await dbCode.update({ used: true });
                return true;
            }
        }
        return false;
    } catch (error) {
        return false;
    }
}

router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Geçersiz kimlik bilgileri."
            });
        }
        let user;
        try {
            if (!User) {
                return res.status(500).json({ 
                    success: false, 
                    message: "Veritabanı modeli yüklenemedi. Lütfen sunucuyu yeniden başlatın." 
                });
            }
            user = await User.findOne({
                where: { email: email },
                attributes: ['id', 'email', 'password', 'fullname', 'role', 'two_factor_enabled', 'phone']
            });
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "Geçersiz kimlik bilgileri."
                });
            }
        } catch (dbError) {
            let errorMessage = "Veritabanı yapılandırma hatası. Lütfen veritabanını kontrol edin.";
            if (dbError.name === 'SequelizeConnectionError' || dbError.name === 'SequelizeConnectionRefusedError') {
                errorMessage = "Veritabanı bağlantısı kurulamadı. Lütfen veritabanı sunucusunun çalıştığından emin olun.";
            } else if (dbError.name === 'SequelizeDatabaseError') {
                errorMessage = "Veritabanı hatası. Lütfen veritabanı yapılandırmasını kontrol edin.";
            } else if (dbError.name === 'SequelizeValidationError') {
                errorMessage = "Veri doğrulama hatası.";
            }
            return res.status(500).json({ 
                success: false, 
                message: errorMessage,
                ...(process.env.NODE_ENV === 'development' && { 
                    error: dbError.message,
                    errorType: dbError.name
                })
            });
        }
        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Geçersiz kimlik bilgileri."
            });
        }
        const twoFactorEnabled = user.two_factor_enabled === 1 || user.two_factor_enabled === true;
        if (twoFactorEnabled) {
            const code = generateVerificationCode();
            await saveVerificationCode(user.email, code, 'two_factor');
            await sendVerificationCode(user.email, code, 'two_factor');
            return res.json({
                success: true,
                requires2FA: true,
                message: "Doğrulama kodu email adresinize gönderildi."
            });
        }
        const token = generateToken(user);
        const userData = {
            id: user.id,
            email: user.email,
            fullname: user.fullname,
            role: user.role
        };
        if (user.role === 'seller') {
            try {
                const { Seller } = require("../../models");
                const sellerInfo = await Seller.findOne({
                    where: { user_id: user.id },
                    attributes: ['id', 'shop_name']
                });
                if (sellerInfo) {
                    userData.sellerId = sellerInfo.id;
                    userData.shopName = sellerInfo.shop_name;
                }
            } catch (sellerError) {}
        }
        if (user.role === 'courier') {
            userData.courierId = user.id;
            if (user.phone) {
                userData.phone = user.phone;
            }
        }
        req.session.user = userData;
        req.session.isAuthenticated = true;
        req.session.save((err) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Session oluşturulamadı."
                });
            }
            res.json({
                success: true,
                user: userData,
                token: token
            });
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Sunucu hatası. Giriş yapılamadı.",
            ...(process.env.NODE_ENV === 'development' && { error: error.message })
        });
    }
});

router.post("/register", async (req, res) => {
    const { name, fullname, email, password, role = "buyer" } = req.body;
    const displayName = (name || fullname || '').trim();
    try {
        if (!displayName || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Tüm alanlar gereklidir."
            });
        }
        try {
            if (!User) {
                return res.status(500).json({
                    success: false,
                    message: "Veritabanı modeli yüklenemedi. Lütfen sunucuyu yeniden başlatın."
                });
            }
            const existingUser = await User.findOne({
                where: { email: email },
                attributes: ['id']
            });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: "Bu e-posta adresi zaten kayıtlı."
                });
            }
        } catch (dbError) {
            let errorMessage = "Veritabanı yapılandırma hatası. Lütfen veritabanını kontrol edin.";
            if (dbError.name === 'SequelizeConnectionError' || dbError.name === 'SequelizeConnectionRefusedError') {
                errorMessage = "Veritabanı bağlantısı kurulamadı. Lütfen veritabanı sunucusunun çalıştığından emin olun.";
            } else if (dbError.name === 'SequelizeDatabaseError') {
                errorMessage = "Veritabanı hatası. Lütfen veritabanı yapılandırmasını kontrol edin.";
            }
            return res.status(500).json({
                success: false,
                message: errorMessage,
                ...(process.env.NODE_ENV === 'development' && { 
                    error: dbError.message,
                    errorType: dbError.name
                })
            });
        }
        const code = generateVerificationCode();
        await saveVerificationCode(email, code, 'registration');
        const emailResult = await sendVerificationCode(email, code, 'registration');
        if (!emailResult.success) {
            return res.status(500).json({
                success: false,
                message: "Doğrulama kodu gönderilemedi. Lütfen tekrar deneyin."
            });
        }
        res.status(200).json({
            success: true,
            requiresVerification: true,
            message: "Doğrulama kodu email adresinize gönderildi. Lütfen kodu girin."
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Sunucu hatası. Kayıt yapılamadı.",
            ...(process.env.NODE_ENV === 'development' && { error: error.message })
        });
    }
});

router.post("/forgot-password", async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({
            where: { email: email },
            attributes: ['id', 'email', 'fullname', 'role']
        });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Kayıtlı mail bulunamadı."
            });
        }
        const allowedRoles = ['buyer', 'seller', 'courier', 'admin'];
        if (!user.role || !allowedRoles.includes(user.role)) {
            return res.status(404).json({
                success: false,
                message: "Kayıtlı mail bulunamadı."
            });
        }
        let secret;
        try {
            secret = ensureSecret();
        } catch (e) {
            return res.status(500).json({
                success: false,
                message: "Sunucu hatası. Lütfen tekrar deneyin."
            });
        }
        let resetToken;
        try {
            resetToken = jwt.sign(
                { id: user.id, email: user.email },
                secret,
                { expiresIn: "1h", algorithm: "HS256" }
            );
        } catch (err) {
            return res.status(500).json({
                success: false,
                message: "Sunucu hatası. Lütfen tekrar deneyin."
            });
        }
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);
        await user.update({
            password_reset_token: resetToken,
            password_reset_expires: expiresAt
        });
        const resetLink = req.protocol + '://' + req.get('host') + '/reset-password?token=' + resetToken;
        try {
            await sendPasswordResetLink(user.email, resetLink);
        } catch (mailErr) {}
        res.json({
            success: true,
            message: "Şifre sıfırlama linki gönderildi. Email adresinizi kontrol edin."
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Sunucu hatası. İşlem yapılamadı.",
            ...(process.env.NODE_ENV === 'development' && { error: error.message })
        });
    }
});

router.post("/verify-email", async (req, res) => {
    const { email, code, name, fullname, password, role = "buyer" } = req.body;
    const displayName = (name || fullname || '').trim();
    try {
        let normalizedCode = '';
        if (code) {
            normalizedCode = String(code).trim().replace(/\s+/g, '');
        }
        if (!email || !normalizedCode || !displayName || !password) {
            return res.status(400).json({
                success: false,
                message: "Tüm alanlar gereklidir."
            });
        }
        if (normalizedCode.length !== 6) {
            return res.status(400).json({
                success: false,
                message: "Doğrulama kodu 6 haneli olmalıdır."
            });
        }
        const isValid = await verifyCode(email, normalizedCode, 'registration');
        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: "Girdiğiniz kod yanlış."
            });
        }
        const hashedPassword = await hashPassword(password);
        const user = await User.create({
            email: email,
            password: hashedPassword,
            fullname: displayName,
            role: role,
            email_verified: true
        });
        const userData = {
            id: user.id,
            email: user.email,
            fullname: user.fullname,
            role: user.role
        };
        if (role === 'seller') {
            try {
                const seller = await Seller.create({
                    user_id: user.id,
                    shop_name: displayName + '\'nın Mutfağı',
                    location: 'İstanbul',
                    is_active: true
                });
                userData.sellerId = seller.id;
            } catch (sellerError) {
                await user.destroy();
                return res.status(500).json({
                    success: false,
                    message: "Satıcı kaydı oluşturulurken bir hata oluştu."
                });
            }
        }
        if (role === 'courier') {
            userData.courierId = user.id;
        }
        const token = generateToken(userData);
        req.session.user = userData;
        req.session.isAuthenticated = true;
        res.status(201).json({
            success: true,
            user: userData,
            token: token
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Sunucu hatası. Kayıt yapılamadı."
        });
    }
});

router.post("/verify-2fa", async (req, res) => {
    const { email, code } = req.body;
    try {
        let normalizedCode = '';
        if (code) {
            normalizedCode = String(code).trim().replace(/\s+/g, '');
        }
        if (!email || !normalizedCode) {
            return res.status(400).json({
                success: false,
                message: "Email ve kod gereklidir."
            });
        }
        if (normalizedCode.length !== 6) {
            return res.status(400).json({
                success: false,
                message: "Doğrulama kodu 6 haneli olmalıdır."
            });
        }
        const isValid = await verifyCode(email, normalizedCode, 'two_factor');
        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: "Girdiğiniz kod yanlış."
            });
        }
        const user = await User.findOne({
            where: { email: email },
            attributes: ['id', 'email', 'password', 'fullname', 'role']
        });
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Kullanıcı bulunamadı."
            });
        }
        const userData = {
            id: user.id,
            email: user.email,
            fullname: user.fullname,
            role: user.role
        };
        if (user.role === 'seller') {
            try {
                const sellerInfo = await Seller.findOne({
                    where: { user_id: user.id },
                    attributes: ['id', 'shop_name']
                });
                if (sellerInfo) {
                    userData.sellerId = sellerInfo.id;
                    userData.shopName = sellerInfo.shop_name;
                }
            } catch (sellerError) {}
        }
        if (user.role === 'courier') {
            userData.courierId = user.id;
        }
        const token = generateToken(userData);
        req.session.user = userData;
        req.session.isAuthenticated = true;
        req.session.save((err) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Session oluşturulamadı."
                });
            }
            res.json({
                success: true,
                user: userData,
                token: token
            });
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

router.post("/reset-password", async (req, res) => {
    const { token, password } = req.body;
    try {
        if (!token || !password) {
            return res.status(400).json({
                success: false,
                message: "Token ve yeni şifre gereklidir."
            });
        }
        const user = await User.findOne({
            where: {
                password_reset_token: token,
                password_reset_expires: {
                    [Op.gt]: new Date()
                }
            },
            attributes: ['id']
        });
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Geçersiz veya süresi dolmuş token."
            });
        }
        const hashedPassword = await hashPassword(password);
        await user.update({
            password: hashedPassword,
            password_reset_token: null,
            password_reset_expires: null
        });
        res.json({
            success: true,
            message: "Şifreniz başarıyla sıfırlandı."
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

router.put("/toggle-2fa", async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Giriş yapmanız gerekiyor."
            });
        }
        const userId = req.session.user.id;
        const { enabled } = req.body;
        await User.update(
            { two_factor_enabled: enabled },
            { where: { id: userId } }
        );
        let twoFaText = enabled ? 'açıldı' : 'kapatıldı';
        res.json({
            success: true,
            message: 'İki faktörlü kimlik doğrulama ' + twoFaText + '.'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Sunucu hatası."
        });
    }
});

router.get("/me", async (req, res) => {
    if (req.session && req.session.isAuthenticated && req.session.user) {
        try {
            const userInfo = await User.findByPk(req.session.user.id, {
                attributes: ['two_factor_enabled']
            });
            if (userInfo) {
                req.session.user.two_factor_enabled = userInfo.two_factor_enabled === true || userInfo.two_factor_enabled === 1;
            }
        } catch (error) {}
        let userData = { ...req.session.user };
        if (req.session.user.role === 'seller' && !req.session.user.sellerId) {
            try {
                const sellerInfo = await Seller.findOne({
                    where: { user_id: req.session.user.id },
                    attributes: ['id']
                });
                if (sellerInfo) {
                    userData.sellerId = sellerInfo.id;
                    req.session.user.sellerId = sellerInfo.id;
                }
            } catch (sellerError) {}
        }
        if (req.session.user.role === 'courier' && !req.session.user.courierId) {
            try {
                userData.courierId = req.session.user.id;
                req.session.user.courierId = req.session.user.id;
            } catch (courierError) {}
        }
        return res.json({
            success: true,
            user: userData
        });
    }
    const jwt = require('jsonwebtoken');
    const { getTokenFromRequest } = require('../../middleware/auth');
    const token = getTokenFromRequest(req);
    if (token) {
        try {
            const secret = process.env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex');
            const payload = jwt.verify(token, secret);
            const user = {
                id: payload.id || payload.userId || payload.sub,
                email: payload.email,
                fullname: payload.fullname || '',
                role: payload.role || 'buyer'
            };
            req.session.user = user;
            req.session.isAuthenticated = true;
            return res.json({
                success: true,
                user: user
            });
        } catch (err) {}
    }
    res.status(401).json({
        success: false,
        message: "Kullanıcı giriş yapmamış."
    });
});

router.post("/logout", (req, res) => {
    const cookieName = 'yemek-sepeti-session';
    const expireDate = new Date(0);
    const cookieOptions = {
        path: '/',
        httpOnly: true,
        secure: false
    };
    res.clearCookie(cookieName, cookieOptions);
    res.cookie(cookieName, '', {
        path: '/',
        httpOnly: true,
        secure: false,
        expires: expireDate,
        maxAge: 0
    });
    const expireDateStr = 'Thu, 01 Jan 1970 00:00:00 GMT';
    res.append('Set-Cookie', `${cookieName}=; Path=/; Expires=${expireDateStr}; HttpOnly; SameSite=Lax`);
    const hostname = req.get('host') || req.hostname || '';
    if (hostname === 'localhost' || hostname.includes('localhost')) {
        res.append('Set-Cookie', `${cookieName}=; Path=/; Expires=${expireDateStr}; HttpOnly; Domain=localhost; SameSite=Lax`);
    }
    res.append('Set-Cookie', `${cookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
    req.session.destroy((err) => {
        if (err) {}
        res.clearCookie('connect.sid', cookieOptions);
        res.clearCookie('session', cookieOptions);
        res.json({
            success: true,
            message: "Başarıyla çıkış yapıldı."
        });
    });
});

module.exports = router;
