/**
 * Header yönetimi - Login durumuna göre butonları göster/gizle
 */

// Mevcut kullanıcı bilgisini al
async function getCurrentUser() {
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const response = await fetch(`${baseUrl}/api/auth/me`, {
            credentials: 'include' // Session cookie'yi gönder
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.user) {
                return data.user;
            }
        }
        // 401 normal (kullanıcı login olmamış), hata log'lamaya gerek yok
        return null;
    } catch (error) {
        // Network hatası gibi gerçek hatalar için log
        console.error('getCurrentUser hatası:', error);
        return null;
    }
}

// Logout işlemi
async function logout() {
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        
        // Backend'e logout isteği gönder (session'ı temizler)
        const response = await fetch(`${baseUrl}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include' // Cookie'leri gönder
        });
        
        // Tüm localStorage verilerini temizle
        try {
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            localStorage.removeItem('ugid'); // Eski token (varsa)
            localStorage.removeItem('admin_token'); // Eski admin token (varsa)
            localStorage.removeItem('admin_id'); // Eski admin ID (varsa)
        } catch (storageError) {
            console.warn('LocalStorage temizleme hatası:', storageError);
        }
        
        // Tüm sessionStorage verilerini temizle
        try {
            sessionStorage.clear();
        } catch (storageError) {
            console.warn('SessionStorage temizleme hatası:', storageError);
        }
        
        // Tüm cookie'leri temizle
        try {
            const cookies = document.cookie.split(";");
            cookies.forEach(function(cookie) {
                const eqPos = cookie.indexOf("=");
                const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
                // Tüm path'ler için cookie'yi temizle
                document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
                document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
            });
        } catch (cookieError) {
            console.warn('Cookie temizleme hatası:', cookieError);
        }
        
        // Başarılı çıkış - ana sayfaya yönlendir
        window.location.href = `${baseUrl}/index.html`;
    } catch (error) {
        console.error('Logout hatası:', error);
        
        // Hata durumunda bile tüm verileri temizle
        try {
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            localStorage.removeItem('ugid');
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_id');
            sessionStorage.clear();
        } catch (storageError) {
            console.warn('Temizleme hatası:', storageError);
        }
        
        // Ana sayfaya yönlendir
        window.location.href = window.getBaseUrl ? `${window.getBaseUrl()}/index.html` : '/index.html';
    }
}

// Header'ı güncelle
async function updateHeader() {
    const user = await getCurrentUser();
    const header = document.querySelector('.site-header .main-nav ul');
    
    if (!header) {
        console.warn('Header bulunamadı');
        return;
    }
    
    // Mevcut login/register butonlarını bul
    const loginBtn = header.querySelector('a[href*="login.html"]');
    const registerBtn = header.querySelector('a[href*="register.html"]');
    
    if (user) {
        // Kullanıcı giriş yapmış
        // Login ve Register butonlarını gizle
        if (loginBtn) loginBtn.parentElement.style.display = 'none';
        if (registerBtn) registerBtn.parentElement.style.display = 'none';
        
        // Çıkış Yap ve Hesabım butonlarını ekle (eğer yoksa)
        let logoutBtn = header.querySelector('a[data-action="logout"]');
        let accountBtn = header.querySelector('a[data-action="account"]');
        
        if (!logoutBtn) {
            logoutBtn = document.createElement('li');
            logoutBtn.innerHTML = `<a href="#" class="btn btn-secondary" data-action="logout">Çıkış Yap</a>`;
            logoutBtn.querySelector('a').addEventListener('click', (e) => {
                e.preventDefault();
                logout();
            });
            header.appendChild(logoutBtn);
        }
        
        if (!accountBtn) {
            accountBtn = document.createElement('li');
            const accountText = user.role === 'buyer' ? 'Hesabım' : 
                               user.role === 'seller' ? 'Satıcı Paneli' :
                               user.role === 'admin' ? 'Admin Paneli' :
                               user.role === 'courier' ? 'Kurye Paneli' : 'Hesabım';
            
            let accountUrl = '#';
            if (user.role === 'buyer') {
                accountUrl = 'pages/buyer/profile.html';
            } else if (user.role === 'seller') {
                accountUrl = 'pages/seller/dashboard.html';
            } else if (user.role === 'admin') {
                accountUrl = 'pages/admin/user-management.html';
            } else if (user.role === 'courier') {
                accountUrl = 'pages/courier/dashboard.html';
            }
            
            accountBtn.innerHTML = `<a href="${accountUrl}" class="btn btn-primary" data-action="account">${accountText}</a>`;
            header.appendChild(accountBtn);
        }
    } else {
        // Kullanıcı giriş yapmamış
        // Login ve Register butonlarını göster
        if (loginBtn) loginBtn.parentElement.style.display = '';
        if (registerBtn) registerBtn.parentElement.style.display = '';
        
        // Çıkış Yap ve Hesabım butonlarını kaldır
        const logoutBtn = header.querySelector('a[data-action="logout"]');
        const accountBtn = header.querySelector('a[data-action="account"]');
        if (logoutBtn) logoutBtn.parentElement.remove();
        if (accountBtn) accountBtn.parentElement.remove();
    }
}

// Sayfa yüklendiğinde eski token'ları temizle ve header'ı güncelle
document.addEventListener('DOMContentLoaded', async () => {
    // Önce session kontrolü yap - eğer session yoksa eski token'ları temizle
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const response = await fetch(`${baseUrl}/api/auth/me`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            // Session yok - eski token'ları temizle (401 normal, hata değil)
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            localStorage.removeItem('ugid');
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_id');
        }
    } catch (error) {
        // Network hatası gibi gerçek hatalar için log
        console.error('Session kontrolü hatası:', error);
        // Hata durumunda eski token'ları temizle
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('ugid');
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_id');
    }
    
    // Header'ı güncelle
    updateHeader();
});

// Global olarak erişilebilir yap
window.updateHeader = updateHeader;
window.getCurrentUser = getCurrentUser;
window.logout = logout;

