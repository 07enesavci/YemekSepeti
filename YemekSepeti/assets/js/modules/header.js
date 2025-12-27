/**
 * Header yönetimi - Login durumuna göre butonları göster/gizle
 */

const THEME_STORAGE_KEY = 'ys-theme';

function getPreferredTheme() {
    try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'dark' || saved === 'light') {
            return saved;
        }
    } catch (error) {
    }

    const preset = document.documentElement.getAttribute('data-theme');
    if (preset === 'dark' || preset === 'light') {
        return preset;
    }

    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
}

function applyTheme(theme) {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (document.body) {
        document.body.setAttribute('data-theme', theme);
    }

    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
        toggleBtn.classList.toggle('is-dark', theme === 'dark');
        toggleBtn.setAttribute('aria-pressed', theme === 'dark');
        toggleBtn.setAttribute('aria-label', theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç');
    }
}

function initThemeToggle() {
    const toggleBtn = document.getElementById('theme-toggle');
    const initialTheme = getPreferredTheme();
    applyTheme(initialTheme);

    if (!toggleBtn) {
        return;
    }

    // Event listener ekle (birden fazla kez eklenmesini önlemek için önce kaldır)
    toggleBtn.removeEventListener('click', handleThemeToggle);
    toggleBtn.addEventListener('click', handleThemeToggle, true); // Capture phase'de dinle
}

function handleThemeToggle(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    try {
        localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch (error) {
    }
    
    return false;
}

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
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

// Logout işlemi
async function logout() {
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const apiUrl = baseUrl || window.location.origin;
        
        try {
            const response = await fetch(`${apiUrl}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include', // Cookie'leri gönder
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (response.ok) {
                await response.json().catch(() => ({}));
            }
        } catch (fetchError) {
        }
        
        // Tüm client-side verileri temizle
        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch (storageError) {
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
            
        } catch (cookieError) {
        }
        
        // Kısa bir gecikme ekle (cookie temizleme işleminin tamamlanması için)
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Ana sayfaya yönlendir (hard reload ile, hash'i kaldır)
        const redirectUrl = baseUrl ? `${baseUrl}/` : '/';
        // Hash varsa kaldır - href kullanarak hard reload yap
        window.location.href = redirectUrl;
    } catch (error) {
        
        // Hata durumunda bile tüm verileri temizle ve yönlendir
        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch (storageError) {
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
    // Tema toggle'ı başlat
    initThemeToggle();
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
            if (window.logout) {
                window.logout();
            } else {
                // Fallback - eğer logout fonksiyonu yoksa
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

