/**
 * Header yönetimi - Login durumuna göre butonları göster/gizle
 */

// Mevcut kullanıcı bilgisini al
async function getCurrentUser() {
    // Auth sayfalarındaysak hiç API çağrısı yapma
    const isAuthPage = window.location.pathname.includes('/login') || 
                       window.location.pathname.includes('/register') ||
                       window.location.pathname.includes('/forgot-password') ||
                       window.location.pathname.includes('/reset-password');
    if (isAuthPage) {
        return null;
    }
    
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const response = await fetch(`${baseUrl}/api/auth/me`, {
            credentials: 'include' // Session cookie'yi gönder
        }).catch(() => null); // Network hatalarını sessizce handle et
        
        if (response && response.ok) {
            const data = await response.json();
            if (data.success && data.user) {
                return data.user;
            }
        }
        
        // 401 veya 403 normal (kullanıcı login olmamış), hata log'lamaya gerek yok
        // Sadece 401 ve 403 dışındaki hataları log'la
        if (response && response.status !== 401 && response.status !== 403) {
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
        const apiUrl = baseUrl || window.location.origin;
        
        // Backend'e logout isteği gönder (session'ı temizler)
        console.log('🚪 Logout işlemi başlatıldı');
        try {
            console.log('📡 Logout API çağrısı yapılıyor:', `${apiUrl}/api/auth/logout`);
            const response = await fetch(`${apiUrl}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include', // Cookie'leri gönder
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('📥 Logout API yanıtı:', response.status, response.statusText);
            
            // Response header'larını kontrol et
            const setCookieHeaders = response.headers.get('Set-Cookie');
            if (setCookieHeaders) {
                console.log('🍪 Set-Cookie header\'ları:', setCookieHeaders);
            }
            
            // Response'u oku (başarılı olsa da olmasa da)
            if (response.ok) {
                const data = await response.json().catch(() => ({}));
                console.log('✅ Logout başarılı:', data.message || 'Çıkış yapıldı');
            } else {
                console.warn('⚠️ Logout API hatası:', response.status, response.statusText);
            }
        } catch (fetchError) {
            console.error('❌ Logout API hatası:', fetchError);
            // API hatası olsa bile devam et
        }
        
        // Tüm client-side verileri temizle
        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch (storageError) {
            console.warn('Storage temizleme hatası:', storageError);
        }
        
        // Tüm cookie'leri temizle (httpOnly cookie'ler JavaScript ile temizlenemez ama deneyelim)
        try {
            // Önce mevcut cookie'leri al
            const cookies = document.cookie.split(";");
            const cookieNames = new Set();
            
            // Cookie isimlerini topla
            cookies.forEach(function(cookie) {
                const eqPos = cookie.indexOf("=");
                const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
                if (name) {
                    cookieNames.add(name);
                }
            });
            
            // Bilinen cookie isimlerini de ekle
            cookieNames.add('yemek-sepeti-session');
            cookieNames.add('connect.sid');
            cookieNames.add('session');
            cookieNames.add('sessionid');
            cookieNames.add('auth_token');
            cookieNames.add('token');
            
            // Tüm cookie'leri temizle
            cookieNames.forEach(function(name) {
                if (name) {
                    // Farklı path'ler için temizle
                    const paths = ['/', '/api', '/buyer', '/seller', '/courier', '/admin'];
                    const domains = [
                        window.location.hostname,
                        '.' + window.location.hostname,
                        'localhost',
                        '.localhost'
                    ];
                    
                    paths.forEach(path => {
                        domains.forEach(domain => {
                            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path}`;
                            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};domain=${domain}`;
                            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};domain=${domain};secure`;
                            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};domain=${domain};secure;samesite=none`;
                        });
                    });
                }
            });
            
            console.log('🍪 Tüm cookie\'ler temizlendi');
        } catch (cookieError) {
            console.warn('Cookie temizleme hatası:', cookieError);
        }
        
        // Kısa bir gecikme ekle (cookie temizleme işleminin tamamlanması için)
        console.log('⏳ Yönlendirme için bekleniyor...');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Ana sayfaya yönlendir (hard reload ile, hash'i kaldır)
        const redirectUrl = baseUrl ? `${baseUrl}/` : '/';
        console.log('🔄 Ana sayfaya yönlendiriliyor:', redirectUrl);
        // Hash varsa kaldır - href kullanarak hard reload yap
        window.location.href = redirectUrl;
    } catch (error) {
        console.error('Logout hatası:', error);
        
        // Hata durumunda bile tüm verileri temizle ve yönlendir
        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch (storageError) {
            console.warn('Temizleme hatası:', storageError);
        }
        
        // Ana sayfaya yönlendir
        const redirectUrl = window.getBaseUrl ? `${window.getBaseUrl()}/` : '/';
        window.location.replace(redirectUrl);
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
    
    // Çıkış Yap butonunu bul
    const logoutBtn = header.querySelector('#header-logout-btn');
    const logoutBtnParent = logoutBtn ? logoutBtn.parentElement : null;
    
    if (user) {
        // Kullanıcı giriş yapmış - Herhangi bir rol ile login olunduysa çıkış yap butonunu göster
        if (logoutBtnParent) {
            logoutBtnParent.style.display = '';
        }
    } else {
        // Kullanıcı giriş yapmamış - Çıkış yap butonunu gizle
        if (logoutBtnParent) {
            logoutBtnParent.style.display = 'none';
        }
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
    // Login/Register sayfalarındaysak session kontrolü yapma (gereksiz)
    const isAuthPage = window.location.pathname.includes('/login') || 
                       window.location.pathname.includes('/register') ||
                       window.location.pathname.includes('/forgot-password') ||
                       window.location.pathname.includes('/reset-password');
    
    if (!isAuthPage) {
        // Önce session kontrolü yap - eğer session yoksa eski token'ları temizle
        try {
            const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
            const response = await fetch(`${baseUrl}/api/auth/me`, {
                credentials: 'include'
            }).catch(() => null); // Network hatalarını sessizce handle et
            
            if (!response || !response.ok) {
                // 401 ve 403 normal durumlar (kullanıcı giriş yapmamış), sessizce handle et
                if (!response || response.status === 401 || response.status === 403) {
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
    
    // Header'ı güncelle (auth sayfalarında değilse)
    const isAuthPageForUpdate = window.location.pathname.includes('/login') || 
                                 window.location.pathname.includes('/register') ||
                                 window.location.pathname.includes('/forgot-password') ||
                                 window.location.pathname.includes('/reset-password');
    if (!isAuthPageForUpdate) {
        updateHeader();
    }
    
    // Header'daki çıkış yap butonuna event listener ekle (tüm sayfalarda)
    // Event delegation kullanarak dinamik olarak eklenen butonları da yakala
    document.addEventListener('click', function(e) {
        const target = e.target.closest('#header-logout-btn');
        if (target) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🚪 Çıkış yap butonuna tıklandı');
            if (window.logout) {
                window.logout();
            } else {
                // Fallback - eğer logout fonksiyonu yoksa
                console.warn('⚠️ window.logout fonksiyonu bulunamadı, fallback kullanılıyor');
                localStorage.clear();
                sessionStorage.clear();
                
                // Tüm cookie'leri temizle
                document.cookie.split(";").forEach(function(cookie) {
                    const eqPos = cookie.indexOf("=");
                    const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
                    if (name) {
                        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
                    }
                });
                
                const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                window.location.href = `${baseUrl}/`;
            }
        }
    });
    
    // Ayrıca mevcut butona da direkt event listener ekle (eski tarayıcılar için)
    const headerLogoutBtn = document.getElementById('header-logout-btn');
    if (headerLogoutBtn) {
        headerLogoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🚪 Çıkış yap butonuna tıklandı (direkt listener)');
            if (window.logout) {
                window.logout();
            }
        });
    }
});

// Global olarak erişilebilir yap
window.updateHeader = updateHeader;
window.getCurrentUser = getCurrentUser;
window.logout = logout;

