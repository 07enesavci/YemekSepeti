// ============================================================
// ŞİFRE POLİTİKASI — TEK STANDART
// Tüm proje (frontend + backend) bu kuralı kullanır:
//   • En az 8 karakter
//   • En az bir büyük harf
//   • En az bir rakam
// Frontend karşılığı: assets/js/modules/ys-ui.js -> YsUI.validatePassword
// ============================================================

const PASSWORD_MIN_LENGTH = 8;

// İnsan tarafından okunabilir kural açıklaması (mesajlarda kullanılır)
const PASSWORD_RULE_TEXT = 'Şifre en az 8 karakter olmalı ve en az bir büyük harf ile bir rakam içermelidir.';

/**
 * Şifreyi standart politikaya göre doğrular.
 * @param {string} password
 * @returns {{ ok: boolean, message: string }} ok=true ise message boş.
 */
function validatePassword(password) {
    if (!password || typeof password !== 'string') {
        return { ok: false, message: 'Şifre gerekli.' };
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
        return { ok: false, message: 'Şifre en az 8 karakter olmalıdır.' };
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
        return { ok: false, message: 'Şifre en az bir büyük harf ve bir rakam içermelidir.' };
    }
    return { ok: true, message: '' };
}

module.exports = { PASSWORD_MIN_LENGTH, PASSWORD_RULE_TEXT, validatePassword };
