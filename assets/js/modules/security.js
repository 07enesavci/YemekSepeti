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
    }
};

// Sayfa yüklendiğinde çalışacak fonksiyon
document.addEventListener('DOMContentLoaded', () => {
    const changePasswordForm = document.getElementById('change-password-form');
    const changePasswordBtn = document.getElementById('change-password-btn');
    const logoutBtn = document.getElementById('logout-btn');

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

