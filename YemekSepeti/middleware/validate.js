const { body, query, param, validationResult } = require('express-validator');

function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const firstMsg = errors.array()[0]?.msg || 'Geçersiz veri.';
        return res.status(400).json({ success: false, message: firstMsg, errors: errors.array() });
    }
    next();
}

// --- Param/Query sanitization (SQL injection önlemi: sayısal ID'ler doğrulanır) ---
const idParam = [param('id').isInt({ min: 1 }).withMessage('Geçerli ID gerekli.').toInt()];
const orderIdParam = [param('orderId').isInt({ min: 1 }).withMessage('Geçerli sipariş ID gerekli.').toInt()];
const sellerIdParam = [param('sellerId').isInt({ min: 1 }).withMessage('Geçerli satıcı ID gerekli.').toInt()];
const userIdParam = [param('userId').isInt({ min: 1 }).withMessage('Geçerli kullanıcı ID gerekli.').toInt()];
const optionalLimit = [query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit 1-100 arası olmalı.').toInt()];
const optionalOffset = [query('offset').optional().isInt({ min: 0 }).withMessage('Offset 0 veya pozitif olmalı.').toInt()];

// --- Auth ---
const loginValidation = [
    body('email').isEmail().withMessage('Geçerli bir e-posta girin.'),
    body('password').notEmpty().withMessage('Şifre gerekli.')
];
const registerValidation = [
    body('email').isEmail().withMessage('Geçerli bir e-posta girin.')
];
const verifyEmailValidation = [
    body('email').isEmail(),
    body('code').notEmpty().withMessage('Doğrulama kodu gerekli.'),
    body('fullname').optional().trim().isLength({ min: 2 }).withMessage('Ad en az 2 karakter olmalı.'),
    body('password').optional().isLength({ min: 6 }).withMessage('Şifre en az 6 karakter olmalı.')
];

// --- Cart ---
const addToCartValidation = [
    body('meal_id').isInt({ min: 1 }).withMessage('Geçerli yemek ID gerekli.'),
    body('quantity').optional().isInt({ min: 1 }).withMessage('Miktar en az 1 olmalı.')
];
const updateCartValidation = [
    param('id').isInt({ min: 1 }),
    body('quantity').isInt({ min: 0 }).withMessage('Miktar 0 veya pozitif olmalı.')
];

// --- Orders ---
const createOrderValidation = [
    body('address_id').isInt({ min: 1 }).withMessage('Adres seçin.'),
    body('payment_method').isIn(['credit_card', 'cash', 'wallet', 'iyzico']).withMessage('Geçerli ödeme yöntemi seçin.'),
    body('notes').optional().trim()
];

// --- Favorites ---
const favoriteSellerIdValidation = [param('sellerId').isInt({ min: 1 }).withMessage('Geçerli satıcı ID gerekli.')];

// --- Review ---
const createReviewValidation = [
    body('order_id').isInt({ min: 1 }).withMessage('Sipariş ID gerekli.'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Puan 1-5 arası olmalı.'),
    body('comment').optional().trim().isLength({ max: 1000 }).withMessage('Yorum en fazla 1000 karakter.')
];

// --- Belge (submit-documents-json) ---
const submitDocumentsJsonValidation = [
    body('documents').isObject().withMessage('Belgeler nesnesi gerekli.'),
    body('documents').custom((documents) => {
        if (!documents || typeof documents !== 'object') return true;
        const keys = Object.keys(documents);
        for (const k of keys) {
            if (typeof documents[k] !== 'string' || !documents[k].startsWith('data:')) {
                throw new Error('Her belge base64 data URL olmalı.');
            }
        }
        return true;
    })
];

// --- Admin kupon ---
const createCouponValidation = [
    body('code').trim().notEmpty().withMessage('Kupon kodu gerekli.').isLength({ max: 50 }).withMessage('Kod en fazla 50 karakter.'),
    body('discountType').optional().isIn(['percentage', 'fixed']).withMessage('İndirim türü: percentage veya fixed.'),
    body('discountValue').optional().isFloat({ min: 0 }).withMessage('İndirim değeri 0 veya pozitif olmalı.'),
    body('amount').optional().isFloat({ min: 0 }).withMessage('Tutar 0 veya pozitif olmalı.'),
    body('sellerIds').optional().isArray().withMessage('sellerIds dizi olmalı.'),
    body('sellerIds.*').optional().isInt({ min: 1 }).withMessage('Geçersiz satıcı ID.'),
    body('validDays').optional().isInt({ min: 1, max: 365 }).withMessage('Geçerlilik günü 1-365 arası olmalı.').toInt(),
    body().custom((_, { req }) => {
        const v = req.body.discountValue != null ? req.body.discountValue : req.body.amount;
        if (v === undefined || v === null || v === '') throw new Error('İndirim değeri veya tutar gerekli.');
        const n = parseFloat(v);
        if (isNaN(n) || n <= 0) throw new Error('Geçerli bir indirim değeri girin.');
        return true;
    })
];

module.exports = {
    handleValidationErrors,
    loginValidation,
    registerValidation,
    verifyEmailValidation,
    addToCartValidation,
    updateCartValidation,
    createOrderValidation,
    favoriteSellerIdValidation,
    createReviewValidation,
    submitDocumentsJsonValidation,
    createCouponValidation,
    idParam,
    orderIdParam,
    sellerIdParam,
    userIdParam,
    optionalLimit,
    optionalOffset
};
