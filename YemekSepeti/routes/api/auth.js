const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const db = require("../../config/database");
const { User, EmailVerificationCode, Seller, Courier, Address } = require("../../models");
const { Op } = require("sequelize");
const { sendVerificationCode, sendPasswordResetLink } = require("../../config/email");
const { body, validationResult } = require('express-validator');
const { authLimiter } = require('../../middleware/security');
const { submitDocumentsJsonValidation, handleValidationErrors: handleValidate } = require('../../middleware/validate');
const { getDomainType, roleAllowedOnDomain } = require('../../middleware/auth');
const { isGoogleOAuthConfigured } = require('../../config/google-oauth');

// --- MULTER YAPILANDIRMASI (DOSYA YÜKLEME) ---
const uploadDir = path.resolve(__dirname, '..', '..', 'public', 'uploads', 'merchants');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// --- YARDIMCI FONKSİYONLAR ---
let _devTempSecret = null;
function ensureSecret() {
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET tanımlı değil.');
    }
    if (!_devTempSecret) {
        _devTempSecret = require('crypto').randomBytes(32).toString('hex');
    }
    process.env.JWT_SECRET = _devTempSecret;
    return _devTempSecret;
}

function generateToken(user) {
    const secret = ensureSecret();
    const payload = { id: user.id, email: user.email, role: user.role };
    return jwt.sign(payload, secret, { expiresIn: "7d", algorithm: "HS256" });
}

async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}

async function comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
}

function getBaseUrl(req) {
    const configuredBaseUrl = (process.env.BASE_URL || '').trim();
    if (configuredBaseUrl) return configuredBaseUrl.replace(/\/+$/, '');
    return `${req.protocol}://${req.get('host')}`;
}

function getGoogleOAuthConfig(req) {
    const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
    const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
    const fallbackRedirect = `${getBaseUrl(req)}/api/auth/google/callback`;
    /** Boş bırakılırsa her host (localhost, partner.localhost) için doğru callback kullanılır; Google Console'da her URI yetkilendirilmeli. */
    const redirectUri = ((process.env.GOOGLE_REDIRECT_URI || '').trim() || fallbackRedirect);

    return {
        clientId,
        clientSecret,
        redirectUri,
        configured: isGoogleOAuthConfigured()
    };
}

function parseGoogleOAuthState(state) {
    try {
        const decoded = Buffer.from(String(state), 'base64').toString('utf8');
        const parsed = JSON.parse(decoded);
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed;
    } catch {
        return null;
    }
}

function clearGoogleOAuthSession(req) {
    if (req.session) {
        delete req.session.googleOAuth;
    }
}

function getPostLoginRedirect(userData) {
    if (!userData) return '/';
    if (userData.role === 'admin' || userData.role === 'super_admin' || userData.role === 'support') return '/admin/users';
    if (userData.role === 'seller') {
        if (!userData.sellerId) return '/register/documents';
        if (!userData.sellerApproved) return '/seller/pending-approval';
        if (userData.sellerId) return `/seller/${userData.sellerId}/dashboard`;
        return '/seller/dashboard';
    }
    if (userData.role === 'courier') {
        if (!userData.courierId) return '/register/documents';
        if (!userData.courierApproved) return '/courier/pending-approval';
        const courierId = userData.courierId || userData.id;
        return `/courier/${courierId}/dashboard`;
    }
    return '/';
}

async function buildSessionUserData(user) {
    const userData = { id: user.id, email: user.email, fullname: user.fullname, role: user.role };

    try {
        if (user.role === 'seller') {
            const seller = await Seller.findOne({ where: { user_id: user.id } });
            if (seller) {
                userData.sellerId = seller.id;
                userData.sellerApproved = !!seller.is_active;
            } else {
                userData.sellerApproved = false;
            }
        } else if (user.role === 'courier') {
            const courier = await Courier.findOne({ where: { user_id: user.id } });
            if (courier) {
                userData.courierId = courier.id;
                userData.courierApproved = !!courier.is_active;
            } else {
                userData.courierApproved = false;
            }
        }
    } catch (_) {
        // Eski şema/kolon eksikliği nedeniyle login tamamen fail etmesin.
        if (user.role === 'seller') userData.sellerApproved = false;
        if (user.role === 'courier') userData.courierApproved = false;
    }

    return userData;
}

function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function saveVerificationCode(email, code, type) {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);
    const normalizedCode = String(code).trim().replace(/\s+/g, '');
    await EmailVerificationCode.destroy({ where: { email: email, type: type } });
    await EmailVerificationCode.create({
        email: email,
        code: normalizedCode,
        type: type,
        expires_at: expiresAt,
        used: false
    });
}

async function verifyCode(email, code, type) {
    const normalizedCode = String(code).trim().replace(/\s+/g, '');
    const dbCode = await EmailVerificationCode.findOne({
        where: { email: email, code: normalizedCode, type: type, used: false, expires_at: { [Op.gt]: new Date() } }
    });
    if (dbCode) {
        await dbCode.update({ used: true });
        return true;
    }
    return false;
}

function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const msg = errors.array()[0]?.msg || 'Geçersiz veri.';
        return res.status(400).json({ success: false, message: msg });
    }
    next();
}

// --- ROTALAR ---

// LOGIN (rate limit sadece giriş denemeleri için; /me, logout vb. sayılmaz)
router.post("/login", authLimiter, [
    body('email').isEmail().withMessage('Geçerli bir e-posta girin.'),
    body('password').notEmpty().withMessage('Şifre gerekli.')
], handleValidationErrors, async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({
            where: { email },
            attributes: ['id', 'email', 'password', 'fullname', 'phone', 'role', 'is_active']
        });
        if (!user || !(await comparePassword(password, user.password))) {
            return res.status(401).json({ success: false, message: "Hatalı e-posta veya şifre." });
        }
        if (user.is_active === false) {
            return res.status(403).json({ success: false, message: "Hesabınız pasif veya silinmiş görünüyor." });
        }
        const domainType = getDomainType(req);
        if (!roleAllowedOnDomain(user.role, domainType)) {
            return res.status(403).json({ success: false, message: "Bu hesap bu domain üzerinden giriş yapamaz." });
        }
        const token = generateToken(user);
        const userData = await buildSessionUserData(user);
        req.session.user = userData;
        req.session.isAuthenticated = true;
        if (req.body.remember_me) {
            req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 gün
        }
        res.json({ success: true, user: userData, token });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ success: false, message: "Giriş hatası." });
    }
});

function startGoogleOAuth(req, res, intent) {
    const safeIntent = intent === 'register' ? 'register' : 'login';
    const oauthConfig = getGoogleOAuthConfig(req);

    if (!oauthConfig.configured) {
        const page = safeIntent === 'register' ? '/register' : '/login';
        return res.redirect(`${page}?googleError=not_configured`);
    }

    const dt = getDomainType(req);
    if (dt === 'admin') {
        return res.redirect('/login?googleError=not_configured');
    }
    /** partner.* → satıcı/kurye; diğer → alıcı (buyer) akışı */
    const portal = dt === 'partner' ? 'partner' : 'buyer';

    const csrfToken = crypto.randomBytes(24).toString('hex');
    const statePayload = Buffer.from(JSON.stringify({ csrf: csrfToken, intent: safeIntent, portal }), 'utf8').toString('base64');

    req.session.googleOAuth = {
        state: csrfToken,
        intent: safeIntent,
        portal,
        createdAt: Date.now()
    };

    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', oauthConfig.clientId);
    googleAuthUrl.searchParams.set('redirect_uri', oauthConfig.redirectUri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('state', statePayload);
    googleAuthUrl.searchParams.set('prompt', 'select_account');
    googleAuthUrl.searchParams.set('access_type', 'offline');

    return res.redirect(googleAuthUrl.toString());
}

router.get('/google/login', (req, res) => startGoogleOAuth(req, res, 'login'));
router.get('/google/register', (req, res) => startGoogleOAuth(req, res, 'register'));

router.get('/google/callback', async (req, res) => {
    const fallbackIntent = req.session?.googleOAuth?.intent === 'register' ? 'register' : 'login';
    const fallbackPage = fallbackIntent === 'register' ? '/register' : '/login';
    const fallbackWithError = (errorCode) => `${fallbackPage}?googleError=${encodeURIComponent(errorCode)}`;

    try {
        const { code, state, error } = req.query;
        if (error) {
            clearGoogleOAuthSession(req);
            return res.redirect(fallbackWithError('access_denied'));
        }

        if (!code || !state || !req.session?.googleOAuth) {
            clearGoogleOAuthSession(req);
            return res.redirect(fallbackWithError('invalid_state'));
        }

        const parsedState = parseGoogleOAuthState(state);
        const sessionState = req.session.googleOAuth;
        const isStateValid = parsedState && parsedState.csrf && parsedState.csrf === sessionState.state;

        if (!isStateValid) {
            clearGoogleOAuthSession(req);
            return res.redirect(fallbackWithError('invalid_state'));
        }

        const intent = parsedState.intent === 'register' ? 'register' : 'login';
        const portal = parsedState.portal === 'partner' ? 'partner' : 'buyer';
        const oauthConfig = getGoogleOAuthConfig(req);
        const redirectWithIntentError = (errorCode) => `/${intent}?googleError=${encodeURIComponent(errorCode)}`;

        if (!oauthConfig.configured) {
            clearGoogleOAuthSession(req);
            return res.redirect(redirectWithIntentError('not_configured'));
        }
        const domainTypeCb = getDomainType(req);
        if (domainTypeCb === 'admin') {
            clearGoogleOAuthSession(req);
            return res.redirect('/login?googleError=not_configured');
        }

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                code: String(code),
                client_id: oauthConfig.clientId,
                client_secret: oauthConfig.clientSecret,
                redirect_uri: oauthConfig.redirectUri,
                grant_type: 'authorization_code'
            })
        });

        if (!tokenResponse.ok) {
            clearGoogleOAuthSession(req);
            return res.redirect(redirectWithIntentError('token_exchange_failed'));
        }

        const tokenData = await tokenResponse.json();
        if (!tokenData.access_token) {
            clearGoogleOAuthSession(req);
            return res.redirect(redirectWithIntentError('token_missing'));
        }

        const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`
            }
        });

        if (!profileResponse.ok) {
            clearGoogleOAuthSession(req);
            return res.redirect(redirectWithIntentError('profile_fetch_failed'));
        }

        const profileData = await profileResponse.json();
        const email = String(profileData.email || '').trim().toLowerCase();
        if (!email) {
            clearGoogleOAuthSession(req);
            return res.redirect(redirectWithIntentError('email_missing'));
        }

        let user = await User.findOne({ where: { email } });

        if (intent === 'login') {
            if (!user) {
                clearGoogleOAuthSession(req);
                return res.redirect('/register?googleError=account_not_found');
            }
            if (portal === 'partner') {
                if (user.role !== 'seller' && user.role !== 'courier') {
                    clearGoogleOAuthSession(req);
                    return res.redirect('/login?googleError=wrong_role_partner');
                }
            } else if (user.role !== 'buyer') {
                clearGoogleOAuthSession(req);
                return res.redirect('/login?googleError=wrong_role_buyer');
            }
        } else {
            if (!user) {
                if (portal === 'partner') {
                    clearGoogleOAuthSession(req);
                    return res.redirect('/register?googleError=partner_use_email');
                }
                const generatedPassword = crypto.randomBytes(32).toString('hex');
                const fallbackName = email.split('@')[0] || 'Google Kullanıcısı';
                const fullname = String(profileData.name || fallbackName).trim().slice(0, 255) || 'Google Kullanıcısı';

                user = await User.create({
                    email,
                    password: await hashPassword(generatedPassword),
                    fullname,
                    role: 'buyer',
                    email_verified: true
                });
            } else {
                if (portal === 'partner') {
                    if (user.role !== 'seller' && user.role !== 'courier') {
                        clearGoogleOAuthSession(req);
                        return res.redirect('/login?googleError=account_not_found');
                    }
                } else if (user.role !== 'buyer') {
                    clearGoogleOAuthSession(req);
                    return res.redirect('/login?googleError=account_not_found');
                }
            }
        }

        if (user.email_verified !== true) {
            await user.update({ email_verified: true });
        }

        if (user.is_active === false) {
            clearGoogleOAuthSession(req);
            return res.redirect('/login?googleError=inactive_account');
        }

        const userData = await buildSessionUserData(user);
        req.session.user = userData;
        req.session.isAuthenticated = true;

        clearGoogleOAuthSession(req);
        return res.redirect(getPostLoginRedirect(userData));
    } catch (error) {
        clearGoogleOAuthSession(req);
        return res.redirect(fallbackWithError('oauth_failed'));
    }
});

// REGISTER (Önce kod gönderir)
router.post("/register", [
    body('email').isEmail().withMessage('Geçerli bir e-posta girin.')
], handleValidationErrors, async (req, res) => {
    const { email } = req.body;
    try {
        const domainType = getDomainType(req);
        if (domainType === 'admin') {
            return res.status(403).json({ success: false, message: "Admin domaininde kayıt kapalıdır." });
        }
        const existingUser = await User.findOne({ where: { email }, attributes: ['id', 'email'] });
        if (existingUser) return res.status(400).json({ success: false, message: "Bu e-posta kayıtlı." });

        const code = generateVerificationCode();
        await saveVerificationCode(email, code, 'registration');
        await sendVerificationCode(email, code, 'registration');
        
        res.json({ success: true, requiresVerification: true, message: "Kod gönderildi." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Kayıt başlatılamadı." });
    }
});

// VERIFY EMAIL & HESAP OLUŞTUR (3. adım: belgeler ayrı sayfada)
router.post("/verify-email", async (req, res) => {
    const { email, code, fullname, password, role = "buyer" } = req.body;

    try {
        const domainType = getDomainType(req);
        if (domainType === 'admin') {
            return res.status(403).json({ success: false, message: "Admin domaininde kayıt kapalıdır." });
        }
        const isValid = await verifyCode(email, code, 'registration');
        if (!isValid) return res.status(400).json({ success: false, message: "Geçersiz veya süresi dolmuş kod." });

        if (!roleAllowedOnDomain(role, domainType)) {
            return res.status(403).json({ success: false, message: "Bu domain üzerinde bu rol ile kayıt olamazsınız." });
        }
        const hashedPassword = await hashPassword(password);
        const user = await User.create({
            email,
            password: hashedPassword,
            fullname,
            role,
            email_verified: true
        });

        const userData = { id: user.id, email, fullname, role };
        const token = generateToken(user);
        req.session.user = userData;
        req.session.isAuthenticated = true;

        if (role === 'seller' || role === 'courier') {
            return res.status(201).json({
                success: true,
                user: userData,
                token,
                needsDocuments: true,
                redirectUrl: '/register/documents'
            });
        }

        res.status(201).json({ success: true, user: userData, token });
    } catch (error) {
        console.error("Kayıt Hatası:", error);
        res.status(500).json({ success: false, message: "Kayıt tamamlanamadı." });
    }
});

// BELGE YÜKLE (Satıcı/Kurye — 3. adım, giriş yapmış kullanıcı)
// Prod ortamda çalışma dizini farklı olabildiği için absolute path kullan.
const docsUploadDir = path.resolve(__dirname, '..', '..', 'public', 'uploads', 'merchants');
if (!fs.existsSync(docsUploadDir)) fs.mkdirSync(docsUploadDir, { recursive: true });
const documentStorage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, docsUploadDir); },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname || ''));
    }
});

const documentsUpload = multer({
    storage: documentStorage,
    limits: {
        // 5MB/dosya: IIS/Cloudflare timeout ve 520 riskini azaltır
        fileSize: 5 * 1024 * 1024
    }
}).fields([
    { name: 'taxPlate', maxCount: 1 },
    { name: 'idCard', maxCount: 1 },
    { name: 'activityCert', maxCount: 1 },
    { name: 'businessLicense', maxCount: 1 },
    { name: 'driverLicense', maxCount: 1 }
]);

router.post("/submit-documents", (req, res, next) => {
    console.log("[submit-documents] İstek alındı, body yükleniyor (multer)...");
    documentsUpload(req, res, (err) => {
        if (!err) {
            console.log("[submit-documents] Dosyalar alındı, işleniyor.");
            return next();
        }
        console.error("[submit-documents] Multer hatası:", err.code || err.message, err);
        const msg =
            err.code === 'LIMIT_FILE_SIZE'
                ? 'Dosya boyutu çok büyük. Lütfen daha küçük dosya yükleyin.'
                : (err.message || 'Dosya yükleme hatası.');
        return res.status(400).json({ success: false, message: msg });
    });
}, async (req, res) => {
    try {
        if (!req.session || !req.session.user || !req.session.isAuthenticated) {
            console.warn("[submit-documents] 401: Oturum yok.");
            return res.status(401).json({ success: false, message: "Oturum bulunamadı. Lütfen giriş yapın." });
        }
        const { role } = req.session.user;
        const userId = req.session.user.id;
        const files = req.files || {};
        const getPath = (name) => (files[name] && files[name][0] && files[name][0].path) ? `/uploads/merchants/${path.basename(files[name][0].path)}` : null;

        if (role === 'seller') {
            const existing = await Seller.findOne({ where: { user_id: userId } });
            if (existing) return res.status(400).json({ success: false, message: "Belgeler zaten gönderildi." });
            const user = await User.findByPk(userId);
            if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
            const taxPlate = getPath('taxPlate');
            const idCard = getPath('idCard');
            const activityCert = getPath('activityCert');
            const businessLicense = getPath('businessLicense');
            if (!taxPlate || !idCard || !activityCert || !businessLicense) {
                return res.status(400).json({ success: false, message: "Satıcı için 4 belge zorunludur." });
            }

            // Adres bilgisi (multipart endpoint için body'den alıyoruz)
            const addrCity = (req.body && req.body.city) || '';
            const addrDistrict = (req.body && req.body.district) || '';
            const addrNeighborhood = (req.body && req.body.neighborhood) || '';
            const addrFull = (req.body && req.body.full_address) || '';
            const locationText = (addrDistrict && addrCity) ? `${addrDistrict}, ${addrCity}` : 'Belirtilmedi';

            const seller = await Seller.create({
                user_id: userId,
                shop_name: user.fullname + "'nın Mutfağı",
                location: locationText,
                is_active: false,
                is_open: true,
                tax_plate: taxPlate,
                id_card: idCard,
                activity_cert: activityCert,
                business_license: businessLicense
            });

            if (addrCity && addrFull) {
                try {
                    const fullAddressText = [addrNeighborhood, addrFull].filter(Boolean).join(', ');
                    await Address.create({
                        user_id: userId,
                        title: 'İşyeri Adresi',
                        full_address: fullAddressText,
                        district: addrDistrict || null,
                        city: addrCity,
                        is_default: true
                    });
                } catch (addrErr) {
                    console.error("[submit-documents] Adres kaydı:", addrErr.message);
                }
            }

            req.session.user.sellerId = seller.id;
            req.session.user.sellerApproved = false;
            console.log("[submit-documents] Satıcı belgeleri kaydedildi, userId:", req.session.user.id);
            return res.status(201).json({ success: true, redirectUrl: '/seller/pending-approval' });
        }

        if (role === 'courier') {
            const existing = await Courier.findOne({ where: { user_id: userId } });
            if (existing) return res.status(400).json({ success: false, message: "Belgeler zaten gönderildi." });
            const idCard = getPath('idCard');
            const driverLicense = getPath('driverLicense');
            if (!idCard || !driverLicense) {
                return res.status(400).json({ success: false, message: "Kurye için Kimlik ve Ehliyet belgeleri zorunludur." });
            }
            const courier = await Courier.create({
                user_id: userId,
                id_card: idCard,
                driver_license: driverLicense,
                is_active: false
            });
            req.session.user.courierId = courier.id;
            req.session.user.courierApproved = false;
            console.log("[submit-documents] Kurye belgeleri kaydedildi, userId:", req.session.user.id);
            return res.status(201).json({ success: true, redirectUrl: '/courier/pending-approval' });
        }

        return res.status(403).json({ success: false, message: "Bu işlem sadece satıcı veya kurye için geçerlidir." });
    } catch (error) {
        console.error("[submit-documents] Hata:", error.message, error.stack);
        res.status(500).json({ success: false, message: "Belgeler yüklenemedi." });
    }
});

// Yöntem 2: JSON ile base64 belge yükleme (multipart 520 alıyorsa kullanılır)
function base64ToExt(dataUrlOrBase64) {
    if (typeof dataUrlOrBase64 !== 'string') return '.png';
    const m = dataUrlOrBase64.match(/^data:([^;]+);base64,/);
    if (m) {
        const mime = (m[1] || '').toLowerCase();
        if (mime.includes('pdf')) return '.pdf';
        if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
        if (mime.includes('png')) return '.png';
    }
    return '.png';
}
function saveBase64ToFile(fieldName, dataUrlOrBase64, destDir) {
    if (!dataUrlOrBase64 || typeof dataUrlOrBase64 !== 'string') return null;
    const base64 = dataUrlOrBase64.replace(/^data:[^;]+;base64,/, '');
    const buf = Buffer.from(base64, 'base64');
    if (buf.length > 5 * 1024 * 1024) return null;
    const ext = base64ToExt(dataUrlOrBase64);
    const filename = fieldName + '-' + Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
    const fullPath = path.join(destDir, filename);
    fs.writeFileSync(fullPath, buf);
    return '/uploads/merchants/' + filename;
}

router.post("/submit-documents-json", submitDocumentsJsonValidation, handleValidate, async (req, res) => {
    try {
        if (!req.session || !req.session.user || !req.session.isAuthenticated) {
            return res.status(401).json({ success: false, message: "Oturum bulunamadı. Lütfen giriş yapın." });
        }
        const role = req.session.user.role;
        const userId = req.session.user.id;
        const docs = (req.body && req.body.documents) || {};
        const saved = {};
        const fieldNames = role === 'seller'
            ? ['taxPlate', 'idCard', 'activityCert', 'businessLicense']
            : ['idCard', 'driverLicense'];
        for (const name of fieldNames) {
            const webPath = saveBase64ToFile(name, docs[name], docsUploadDir);
            if (webPath) saved[name] = webPath;
        }
        const missing = fieldNames.filter(function(n) { return !saved[n]; });
        if (missing.length > 0) {
            return res.status(400).json({ success: false, message: "Eksik belge: " + missing.join(', ') });
        }
        if (role === 'seller') {
            const existing = await Seller.findOne({ where: { user_id: userId } });
            if (existing) return res.status(400).json({ success: false, message: "Belgeler zaten gönderildi." });
            const user = await User.findByPk(userId);
            if (!user) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });

            // Adres bilgisi
            const addr = (req.body && req.body.address) || {};
            const addrCity = (addr.city || '').trim();
            const addrDistrict = (addr.district || '').trim();
            const addrNeighborhood = (addr.neighborhood || '').trim();
            const addrFull = (addr.full_address || '').trim();
            const locationText = (addrDistrict && addrCity) ? `${addrDistrict}, ${addrCity}` : 'Belirtilmedi';

            const seller = await Seller.create({
                user_id: userId,
                shop_name: user.fullname + "'nın Mutfağı",
                location: locationText,
                is_active: false,
                is_open: true,
                tax_plate: saved.taxPlate,
                id_card: saved.idCard,
                activity_cert: saved.activityCert,
                business_license: saved.businessLicense
            });

            // Adres kaydı oluştur (başarısız olsa bile satıcı kaydı tamam sayılır)
            if (addrCity && addrFull) {
                try {
                    const fullAddressText = [addrNeighborhood, addrFull].filter(Boolean).join(', ');
                    await Address.create({
                        user_id: userId,
                        title: 'İşyeri Adresi',
                        full_address: fullAddressText,
                        district: addrDistrict || null,
                        city: addrCity,
                        is_default: true
                    });
                } catch (addrErr) {
                    console.error("[submit-documents-json] Adres kaydı:", addrErr.message);
                }
            }

            req.session.user.sellerId = seller.id;
            req.session.user.sellerApproved = false;
            return res.status(201).json({ success: true, redirectUrl: '/seller/pending-approval' });
        }
        if (role === 'courier') {
            const existing = await Courier.findOne({ where: { user_id: userId } });
            if (existing) return res.status(400).json({ success: false, message: "Belgeler zaten gönderildi." });
            const courier = await Courier.create({
                user_id: userId,
                id_card: saved.idCard,
                driver_license: saved.driverLicense,
                is_active: false
            });
            req.session.user.courierId = courier.id;
            req.session.user.courierApproved = false;
            return res.status(201).json({ success: true, redirectUrl: '/courier/pending-approval' });
        }
        return res.status(403).json({ success: false, message: "Bu işlem sadece satıcı veya kurye için geçerlidir." });
    } catch (error) {
        console.error("[submit-documents-json] Hata:", error.message, error.stack);
        res.status(500).json({ success: false, message: "Belgeler yüklenemedi." });
    }
});

// Şifre Sıfırlama - Link Gönder
router.post("/forgot-password", async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ where: { email }, attributes: ['id', 'email', 'role'] });
        if (!user) {
            // Güvenlik: kullanıcı var mı belli etme
            return res.json({ success: true, message: "Eğer bu e-posta kayıtlıysa sıfırlama bağlantısı gönderildi." });
        }
        const token = generateToken(user);
        const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
        const resetLink = `${baseUrl}/reset-password?token=${token}`;
        await sendPasswordResetLink(email, resetLink);
        res.json({ success: true, message: "Şifre sıfırlama bağlantısı gönderildi." });
    } catch (error) {
        console.error('Forgot password hatası:', error);
        res.status(500).json({ success: false, message: "İşlem sırasında hata oluştu." });
    }
});

// Şifre Sıfırlama - Yeni Şifre Kaydet
router.post("/reset-password", async (req, res) => {
    const { token, password } = req.body;
    try {
        if (!token || !password) {
            return res.status(400).json({ success: false, message: "Token ve yeni şifre gereklidir." });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: "Şifre en az 6 karakter olmalıdır." });
        }

        const secret = ensureSecret();
        let decoded;
        try {
            decoded = jwt.verify(token, secret);
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(400).json({ success: false, message: "Sıfırlama bağlantısının süresi dolmuş. Lütfen yeni bir bağlantı isteyin." });
            }
            return res.status(400).json({ success: false, message: "Geçersiz sıfırlama bağlantısı." });
        }

        const user = await User.findByPk(decoded.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
        }

        const hashedPassword = await hashPassword(password);
        await user.update({ password: hashedPassword });

        res.json({ success: true, message: "Şifreniz başarıyla güncellendi. Şimdi giriş yapabilirsiniz." });
    } catch (error) {
        console.error('Reset password hatası:', error);
        res.status(500).json({ success: false, message: "Şifre sıfırlama sırasında hata oluştu." });
    }
});

// Mevcut Kullanıcı Bilgisi
router.get("/me", async (req, res) => {
    try {
        if (req.session && req.session.user && req.session.isAuthenticated) {
            const sessionUser = req.session.user;
            const dbUser = await User.findByPk(sessionUser.id, {
                attributes: ['id', 'email', 'fullname', 'phone', 'role', 'is_active']
            });
            if (!dbUser) {
                return res.status(401).json({ success: false, message: "Oturum bulunamadı." });
            }
            const fresh = await buildSessionUserData(dbUser);
            req.session.user = { ...sessionUser, ...fresh };
            const user = req.session.user;
            let sellerApproved = null;
            let courierApproved = null;
            if (user.role === 'seller' && user.sellerId) {
                const seller = await Seller.findByPk(user.sellerId);
                sellerApproved = !!(seller && seller.is_active);
            } else if (user.role === 'seller' && !user.sellerId) {
                sellerApproved = false;
            }
            if (user.role === 'courier') {
                const { Courier } = require("../../models");
                const courier = await Courier.findOne({ where: { user_id: user.id } });
                courierApproved = !!(courier && courier.is_active);
            }
            return res.json({
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    fullname: user.fullname,
                    role: user.role,
                    sellerId: user.sellerId || null,
                    courierId: user.courierId || (user.role === 'courier' ? user.id : null),
                    sellerApproved,
                    courierApproved
                }
            });
        }
        return res.status(401).json({ success: false, message: "Oturum bulunamadı." });
    } catch (error) {
        console.error('Me endpoint hatası:', error);
        return res.status(500).json({ success: false, message: "Sunucu hatası." });
    }
});

// Çıkış
router.post("/logout", (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destroy hatası:', err);
                return res.status(500).json({ success: false, message: "Çıkış yapılırken hata oluştu." });
            }
            res.clearCookie('connect.sid');
            res.clearCookie('yemek-sepeti-session');
            res.json({ success: true, message: "Başarıyla çıkış yapıldı." });
        });
    } catch (error) {
        console.error('Logout hatası:', error);
        res.status(500).json({ success: false, message: "Çıkış yapılırken hata oluştu." });
    }
});

// Hesap silme (admin hariç tüm roller)
router.delete("/delete-account", async (req, res) => {
    try {
        const sessionUser = req.session.user;
        if (!sessionUser) {
            return res.status(401).json({ success: false, message: "Oturum bulunamadı." });
        }
        if (sessionUser.role === 'admin' || sessionUser.role === 'super_admin' || sessionUser.role === 'support') {
            return res.status(403).json({ success: false, message: "Admin/destek hesabı bu uç nokta ile silinemez." });
        }

        const user = await User.findByPk(sessionUser.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
        }

        // Kullanıcıyı tamamen sil
        await user.destroy();

        req.session.destroy(() => {});
        res.clearCookie('connect.sid');
        res.clearCookie('yemek-sepeti-session');

        return res.json({
            success: true,
            message: "Hesabınız tamamen silindi ve oturumunuz kapatıldı."
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Hesap silinirken bir hata oluştu." });
    }
});

module.exports = router;