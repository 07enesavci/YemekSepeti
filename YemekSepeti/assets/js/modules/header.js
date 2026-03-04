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

    toggleBtn.removeEventListener('click', handleThemeToggle);
    toggleBtn.addEventListener('click', handleThemeToggle, true);
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

async function getCurrentUser() {
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
            credentials: 'include'
        }).catch(() => null);
        
        if (response && response.ok) {
            const data = await response.json();
            if (data.success && data.user) {
                return data.user;
            }
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

async function logout() {
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const apiUrl = baseUrl || window.location.origin;
        
        try {
            const response = await fetch(`${apiUrl}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (response.ok) {
                await response.json().catch(() => ({}));
            }
        } catch (fetchError) {
        }
        
        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch (storageError) {
        }
        
        try {
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
            
            cookieNames.add('yemek-sepeti-session');
            cookieNames.add('connect.sid');
            cookieNames.add('session');
            cookieNames.add('sessionid');
            cookieNames.add('auth_token');
            cookieNames.add('token');
            
            cookieNames.forEach(function(name) {
                if (name) {
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
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const redirectUrl = baseUrl ? `${baseUrl}/` : '/';
        window.location.href = redirectUrl;
    } catch (error) {
        
        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch (storageError) {
        }
        
        const redirectUrl = window.getBaseUrl ? `${window.getBaseUrl()}/` : '/';
        window.location.replace(redirectUrl);
    }
}

async function updateHeader() {
    const user = await getCurrentUser();
    const header = document.querySelector('.site-header .main-nav ul');
    
    if (!header) {
        return;
    }
    
    const logoutBtn = header.querySelector('#header-logout-btn');
    const logoutBtnParent = logoutBtn ? logoutBtn.parentElement : null;
    
    if (user) {
        if (logoutBtnParent) {
            logoutBtnParent.style.display = '';
        }
    } else {
        if (logoutBtnParent) {
            logoutBtnParent.style.display = 'none';
        }
    }
}

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

document.addEventListener('DOMContentLoaded', async () => {
    initMobileMenu();
    initThemeToggle();
    const isAuthPage = window.location.pathname.includes('/login') || 
                       window.location.pathname.includes('/register') ||
                       window.location.pathname.includes('/forgot-password') ||
                       window.location.pathname.includes('/reset-password');
    
    if (!isAuthPage) {
        try {
            const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
            const response = await fetch(`${baseUrl}/api/auth/me`, {
                credentials: 'include'
            }).catch(() => null);
            
            if (!response || !response.ok) {
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
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            localStorage.removeItem('ugid');
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_id');
        }
    } else {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('ugid');
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_id');
    }
    
    const sidebarLogoutBtn = document.getElementById('sidebar-logout-btn');
    if (sidebarLogoutBtn) {
        sidebarLogoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.logout) {
                window.logout();
            }
        });
    }
    
    const isAuthPageForUpdate = window.location.pathname.includes('/login') || 
                                 window.location.pathname.includes('/register') ||
                                 window.location.pathname.includes('/forgot-password') ||
                                 window.location.pathname.includes('/reset-password');
    if (!isAuthPageForUpdate) {
        updateHeader();
    }
    
    document.addEventListener('click', function(e) {
        const target = e.target.closest('#header-logout-btn');
        if (target) {
            e.preventDefault();
            e.stopPropagation();
            if (window.logout) {
                window.logout();
            } else {
                localStorage.clear();
                sessionStorage.clear();
                
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

window.updateHeader = updateHeader;
window.getCurrentUser = getCurrentUser;
window.logout = logout;

