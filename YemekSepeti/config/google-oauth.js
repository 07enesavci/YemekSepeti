/**
 * Google OAuth sunucu tarafı: yetkilendirme + token değişimi için hem Client ID hem Secret gerekir.
 */
function isGoogleOAuthConfigured() {
    const id = (process.env.GOOGLE_CLIENT_ID || '').trim();
    const secret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
    return !!(id && secret);
}

module.exports = { isGoogleOAuthConfigured };
