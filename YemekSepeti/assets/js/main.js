// Sidebar linklerini base URL ile normalize et
const updateSidebarLinks = () => {
    const baseUrl = window.getBaseUrl();
    const sidebar = document.getElementById('sidebar-placeholder');
    if (!sidebar) {
        console.warn('⚠️ Sidebar placeholder bulunamadı');
        return;
    }
    
    const allLinks = sidebar.querySelectorAll('a[href]');
    console.log(`🔗 ${allLinks.length} link bulundu, baseUrl: ${baseUrl}`);
    
    let updatedCount = 0;
    allLinks.forEach(link => {
        const originalHref = link.getAttribute('href');
        if (!originalHref || originalHref.startsWith('http') || originalHref.startsWith('#')) {
            return; 
        }
        
        let newHref = originalHref;
        
        if (originalHref === 'user-management.html') {
            newHref = `${baseUrl}/pages/admin/user-management.html`;
        } else if (originalHref === 'coupons.html') {
            newHref = `${baseUrl}/pages/admin/coupons.html`;
        }
        else if (originalHref.includes('index.html')) {
            newHref = `${baseUrl}/index.html`;
        }
        else if (originalHref.startsWith('../pages/')) {
            const cleanedPath = window.cleanPath(originalHref.replace(/^\.\.\//, ''));
            newHref = `${baseUrl}${cleanedPath}`;
        }
        else if (originalHref.startsWith('/pages/')) {
            const cleanedPath = window.cleanPath(originalHref);
            newHref = `${baseUrl}${cleanedPath}`;
        }
        else if (originalHref.startsWith('pages/')) {
            const cleanedPath = window.cleanPath('/' + originalHref);
            newHref = `${baseUrl}${cleanedPath}`;
        }
        
        if (newHref !== originalHref) {
            link.href = newHref;
            updatedCount++;
            console.log(`  ✓ ${originalHref} → ${newHref}`);
        }
    });
    
    console.log(`✅ ${updatedCount} link güncellendi`);
};

// Bileşeni (header, footer vb.) hedef elemana yükle
const loadComponent = (componentPath, elementId) => {
    const element = document.getElementById(elementId);
    
    if (!element) {
        return;
    }

    fetch(componentPath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`${componentPath} yüklenemedi.`);
            }
            return response.text();
        })
        .then(html => {
            element.innerHTML = html;
            
            if (elementId === 'header-placeholder' && typeof sepetiYenile === 'function') {
                sepetiYenile();
            }
            
            if (elementId === 'sidebar-placeholder') {
                setTimeout(() => {
                    updateSidebarLinks();
                    
                    const sidebarElement = document.getElementById('sidebar-placeholder');
                    if (sidebarElement) {
                        const observer = new MutationObserver(() => {
                            updateSidebarLinks();
                        });
                        
                        observer.observe(sidebarElement, { childList: true, subtree: true });
                        
                        setTimeout(() => {
                            observer.disconnect();
                        }, 1000);
                    }
                }, 50);
            }
        })
        .catch(error => {
            console.error(error);
        });
};

// Global bileşenleri sayfaya göre otomatik yükle
const loadAllComponents = () => {
    const isInnerPage = window.location.pathname.includes('/pages/');
    const pathPrefix = isInnerPage ? '../../' : '';

    const path = window.location.pathname;

    if (document.getElementById('sidebar-placeholder')) {
        if (path.includes("admin")) {
            loadComponent(pathPrefix + 'components/admin-sidebar.html', 'sidebar-placeholder');
        } else if (path.includes("seller") || path.includes("courier")) {
            loadComponent(pathPrefix + 'components/dashboard-sidebar.html', 'sidebar-placeholder');
        }
    }

    if (document.getElementById('header-placeholder')) {
        loadComponent(pathPrefix + 'components/header.html', 'header-placeholder');
    }
    if (document.getElementById('footer-placeholder')) {
        loadComponent(pathPrefix + 'components/footer.html', 'footer-placeholder');
    }
};

const updateAllPageLinks = () => {
    const baseUrl = window.getBaseUrl();
    if (!baseUrl) return; // Production'da gerek yok
    
    const allPageLinks = document.querySelectorAll('a[href]:not(#sidebar-placeholder a):not(.profile-nav a)');
    
    allPageLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || link.closest('.profile-nav')) {
            return;
        }
        
        if (href.includes('localhost:3000')) {
            return;
        }
        
        if (href.startsWith('/')) {
            const cleanedPath = window.cleanPath(href);
            link.href = `${baseUrl}${cleanedPath}`;
        } else if (href.startsWith('../')) {
            const currentPath = window.cleanPath(window.location.pathname);
            const pathParts = currentPath.split('/').filter(p => p && p !== 'Yemek-Sepeti' && p !== 'YemekSepeti');
            const relativeParts = href.split('/').filter(p => p && p !== '..');
            
            const upLevels = (href.match(/\.\.\//g) || []).length;
            const newPathParts = pathParts.slice(0, -upLevels - 1);
            const newPath = '/' + newPathParts.join('/') + '/' + relativeParts.join('/');
            const cleanedPath = window.cleanPath(newPath);
            link.href = `${baseUrl}${cleanedPath}`;
        }
    });
};

// Başlat: bileşenleri yükle ve linkleri güncelle
document.addEventListener("DOMContentLoaded", () => {
    loadAllComponents();
    
    setTimeout(() => {
        updateAllPageLinks();
    }, 100);
});