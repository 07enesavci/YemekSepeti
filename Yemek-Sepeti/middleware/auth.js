const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * JWT Token doğrulama middleware'i
 * Korumalı route'larda kullanılır
 */
function authenticateToken(req, res, next) {
    // Header'dan token'ı al
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN" formatı

    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Erişim token\'ı bulunamadı. Lütfen giriş yapın.' 
        });
    }

    // Token'ı doğrula
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ 
                success: false, 
                message: 'Token geçersiz veya süresi dolmuş.' 
            });
        }
        
        // Kullanıcı bilgisini request'e ekle
        req.user = user;
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

