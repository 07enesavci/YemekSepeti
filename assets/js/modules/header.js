/**
 * Header yönetimi - Login durumuna göre butonları göster/gizle
 */

// Mevcut kullanıcı bilgisini al
async function getCurrentUser() {
    // Login sayfasındaysak hiç API çağrısı yapma
    const isLoginPage = window.location.pathname.includes('/login');
    if (isLoginPage) {
        return null;
    }
    
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
        
        // 401 veya 403 normal (kullanıcı login olmamış), hata log'lamaya gerek yok
        // Sadece 401 ve 403 dışındaki hataları log'la
        if (response.status !== 401 && response.status !== 403) {
            console.warn('getCurrentUser: Beklenmeyen durum kodu:', response.status);
        }
        
        return null;
    } catch (error) {
        // Network hatası gibi gerçek hatalar için log (sadece gerçek network hataları)
        if (error.name !== 'TypeError' || !error.message.includes('fetch')) {
            console.error('getCurrentUser hatası:', error);
        }
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
        window.location.href = `${baseUrl}/`;
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
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        window.location.href = `${baseUrl}/`;
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
        
        // Çıkış Yap butonunu ekle (eğer yoksa)
        let logoutBtn = header.querySelector('a[data-action="logout"]');
        
        if (!logoutBtn) {
            logoutBtn = document.createElement('li');
            logoutBtn.innerHTML = `<a href="#" class="btn btn-secondary" data-action="logout">Çıkış Yap</a>`;
            logoutBtn.querySelector('a').addEventListener('click', (e) => {
                e.preventDefault();
                logout();
            });
            header.appendChild(logoutBtn);
        }
        
        // Panel butonları zaten header.ejs'de var, burada ekleme yapmıyoruz
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

// Mobil menü toggle
function initMobileMenu() {
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const mainNav = document.getElementById('main-nav');
    const navOverlay = document.getElementById('nav-overlay');
    
    if (mobileMenuToggle && mainNav) {
        mobileMenuToggle.addEventListener('click', () => {
            mainNav.classList.toggle('active');
            if (navOverlay) {
                navOverlay.classList.toggle('active');
            }
            // Hamburger animasyonu
            const spans = mobileMenuToggle.querySelectorAll('span');
            if (mainNav.classList.contains('active')) {
                spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
                spans[1].style.opacity = '0';
                spans[2].style.transform = 'rotate(-45deg) translate(7px, -6px)';
            } else {
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            }
        });
        
        // Overlay'e tıklanınca menüyü kapat
        if (navOverlay) {
            navOverlay.addEventListener('click', () => {
                mainNav.classList.remove('active');
                navOverlay.classList.remove('active');
                const spans = mobileMenuToggle.querySelectorAll('span');
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            });
        }
        
        // Menü linklerine tıklanınca menüyü kapat
        const navLinks = mainNav.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                mainNav.classList.remove('active');
                if (navOverlay) {
                    navOverlay.classList.remove('active');
                }
                const spans = mobileMenuToggle.querySelectorAll('span');
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            });
        });
    }
}

// Sayfa yüklendiğinde eski token'ları temizle ve header'ı güncelle
document.addEventListener('DOMContentLoaded', async () => {
    // Mobil menüyü başlat
    initMobileMenu();
    // Login sayfasındaysak session kontrolü yapma (gereksiz)
    const isLoginPage = window.location.pathname.includes('/login');
    
    if (!isLoginPage) {
        // Önce session kontrolü yap - eğer session yoksa eski token'ları temizle
        try {
            const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
            const response = await fetch(`${baseUrl}/api/auth/me`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                // 401 ve 403 normal durumlar (kullanıcı giriş yapmamış), sessizce handle et
                if (response.status === 401 || response.status === 403) {
                    // Sessizce temizle, log yapma - bu normal bir durum
                    localStorage.removeItem('user');
                    localStorage.removeItem('token');
                } else {
                    // Diğer hatalar için log
                    console.warn('Session kontrolü: Beklenmeyen durum kodu:', response.status);
                    localStorage.removeItem('user');
                    localStorage.removeItem('token');
                }
                localStorage.removeItem('ugid');
                localStorage.removeItem('admin_token');
                localStorage.removeItem('admin_id');
            }
        } catch (error) {
            // Network hatası gibi gerçek hatalar için log (sadece gerçek network hataları)
            if (error.name !== 'TypeError' || !error.message.includes('fetch')) {
                console.error('Session kontrolü hatası:', error);
            }
            // Hata durumunda eski token'ları temizle
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            localStorage.removeItem('ugid');
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_id');
        }
    } else {
        // Login sayfasındaysak sadece eski token'ları temizle
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('ugid');
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_id');
    }
    
    // Sidebar logout butonuna event listener ekle
    const sidebarLogoutBtn = document.getElementById('sidebar-logout-btn');
    if (sidebarLogoutBtn) {
        sidebarLogoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.logout) {
                window.logout();
            }
        });
    }
    
    // Header'ı güncelle (login sayfasında değilse)
    if (!isLoginPage) {
        updateHeader();
    }
});

// Global olarak erişilebilir yap
window.updateHeader = updateHeader;
window.getCurrentUser = getCurrentUser;
window.logout = logout;

