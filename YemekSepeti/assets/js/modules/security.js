// ============================================
// GÜVENLİK SAYFASI MODÜLÜ (security.js)
// ============================================

// API fonksiyonları
const BUYER_API = {
    // Şifre değiştir
    changePassword: async (currentPassword, newPassword) => {
        try {
            const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
            const response = await fetch(`${baseUrl}/api/buyer/password`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Şifre değiştirilemedi');
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Şifre değiştirme hatası:', error);
            throw error;
        }
    },
    // 2FA durumunu getir
    get2FAStatus: async () => {
        try {
            const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
            const response = await fetch(`${baseUrl}/api/auth/me`, {
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error('Kullanıcı bilgileri alınamadı');
            }
            const data = await response.json();
            return data.user?.two_factor_enabled || false;
        } catch (error) {
            console.error('2FA durumu alma hatası:', error);
            return false;
        }
    },
    // 2FA aç/kapat
    toggle2FA: async (enabled) => {
        try {
            const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
            const response = await fetch(`${baseUrl}/api/auth/toggle-2fa`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || '2FA ayarı değiştirilemedi');
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('2FA değiştirme hatası:', error);
            throw error;
        }
    }
};

// Sayfa yüklendiğinde çalışacak fonksiyon
document.addEventListener('DOMContentLoaded', async () => {
    const changePasswordForm = document.getElementById('change-password-form');
    const changePasswordBtn = document.getElementById('change-password-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const twoFactorToggle = document.getElementById('2fa-toggle');
    const twoFactorStatusText = document.getElementById('2fa-status-text');

    // 2FA durumunu yükle
    if (twoFactorToggle && twoFactorStatusText) {
        try {
            const isEnabled = await BUYER_API.get2FAStatus();
            twoFactorToggle.checked = isEnabled;
            twoFactorStatusText.textContent = isEnabled ? '✅ Açık' : '❌ Kapalı';
        } catch (error) {
            console.error('2FA durumu yüklenemedi:', error);
            twoFactorStatusText.textContent = '❌ Yüklenemedi';
        }

        // 2FA toggle event
        twoFactorToggle.addEventListener('change', async (e) => {
            const enabled = e.target.checked;
            const originalChecked = !enabled;
            
            // Onay iste
            const confirmMessage = enabled 
                ? 'İki faktörlü kimlik doğrulamayı açmak istediğinize emin misiniz? Giriş yaparken email adresinize kod gönderilecektir.'
                : 'İki faktörlü kimlik doğrulamayı kapatmak istediğinize emin misiniz?';
            
            if (!confirm(confirmMessage)) {
                e.target.checked = originalChecked;
                return;
            }

            try {
                const response = await BUYER_API.toggle2FA(enabled);
                if (response.success) {
                    twoFactorStatusText.textContent = enabled ? '✅ Açık' : '❌ Kapalı';
                    alert(response.message || `2FA ${enabled ? 'açıldı' : 'kapatıldı'}.`);
                } else {
                    e.target.checked = originalChecked;
                    alert(response.message || '2FA ayarı değiştirilemedi.');
                }
            } catch (error) {
                e.target.checked = originalChecked;
                alert('2FA ayarı değiştirilemedi: ' + error.message);
            }
        });
    }

    // Şifre değiştirme formu
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            // Validasyonlar
            if (!currentPassword || !newPassword || !confirmPassword) {
                alert('Lütfen tüm alanları doldurun.');
                return;
            }

            if (newPassword.length < 6) {
                alert('Yeni şifre en az 6 karakter olmalıdır.');
                return;
            }

            if (newPassword !== confirmPassword) {
                alert('Yeni şifre ve şifre tekrarı eşleşmiyor.');
                return;
            }

            if (currentPassword === newPassword) {
                alert('Yeni şifre mevcut şifrenizle aynı olamaz.');
                return;
            }

            const originalText = changePasswordBtn.textContent;
            changePasswordBtn.textContent = 'Değiştiriliyor...';
            changePasswordBtn.disabled = true;

            try {
                const response = await BUYER_API.changePassword(currentPassword, newPassword);

                if (response.success) {
                    alert(response.message || 'Şifreniz başarıyla değiştirildi. Lütfen yeni şifrenizle tekrar giriş yapın.');
                    // Formu temizle
                    changePasswordForm.reset();
                    // İsteğe bağlı: Kullanıcıyı logout yap
                    // if (window.logout) {
                    //     window.logout();
                    // }
                } else {
                    alert('Şifre değiştirilemedi: ' + (response.message || 'Bilinmeyen hata'));
                }
            } catch (error) {
                console.error('Şifre değiştirme hatası:', error);
                alert('Şifre değiştirilemedi: ' + error.message);
            } finally {
                changePasswordBtn.textContent = originalText;
                changePasswordBtn.disabled = false;
            }
        });
    }

    // Logout butonu
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.logout) {
                window.logout();
            } else {
                alert("Başarıyla çıkış yaptınız.");
                const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                window.location.href = `${baseUrl}/`;
            }
        });
    }
});

