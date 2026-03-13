const { body, query, param, validationResult } = require('express-validator');

function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const firstMsg = errors.array()[0]?.msg || 'Geçersiz veri.';
        return res.status(400).json({ success: false, message: firstMsg, errors: errors.array() });
    }
    next();
}

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
    body('payment_method').isIn(['credit_card', 'cash', 'wallet']).withMessage('Geçerli ödeme yöntemi seçin.'),
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

module.exports = {
    handleValidationErrors,
    loginValidation,
    registerValidation,
    verifyEmailValidation,
    addToCartValidation,
    updateCartValidation,
    createOrderValidation,
    favoriteSellerIdValidation,
    createReviewValidation
};
