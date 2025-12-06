/* ==================================== */
/* GLOBAL SCRIPT (main.js)              */
/* assets/js/main.js                    */
/* ==================================== */

/**
 * Not: getBaseUrl ve cleanPath fonksiyonları api.js'de tanımlı (window objesine eklenmiş)
 * Bu dosyada window.getBaseUrl() ve window.cleanPath() kullanıyoruz
 */

/**
 * Sidebar'daki linkleri base URL ile güncelle
 */
const updateSidebarLinks = () => {
    const baseUrl = window.getBaseUrl();
    const sidebar = document.getElementById('sidebar-placeholder');
    if (!sidebar) {
        console.warn('⚠️ Sidebar placeholder bulunamadı');
        return;
    }
    
    // Tüm linkleri bul
    const allLinks = sidebar.querySelectorAll('a[href]');
    console.log(`🔗 ${allLinks.length} link bulundu, baseUrl: ${baseUrl}`);
    
    let updatedCount = 0;
    allLinks.forEach(link => {
        const originalHref = link.getAttribute('href');
        if (!originalHref || originalHref.startsWith('http') || originalHref.startsWith('#')) {
            return; // Zaten tam URL veya anchor link
        }
        
        let newHref = originalHref;
        
        // Admin sidebar linklerini güncelle
        if (originalHref === 'user-management.html') {
            newHref = `${baseUrl}/pages/admin/user-management.html`;
        } else if (originalHref === 'coupons.html') {
            newHref = `${baseUrl}/pages/admin/coupons.html`;
        }
        // Relative path'leri güncelle
        else if (originalHref.includes('index.html')) {
            newHref = `${baseUrl}/index.html`;
        }
        // ../pages/... formatındaki linkler için
        else if (originalHref.startsWith('../pages/')) {
            const cleanedPath = window.cleanPath(originalHref.replace(/^\.\.\//, ''));
            newHref = `${baseUrl}${cleanedPath}`;
        }
        // /pages/... formatındaki linkler için
        else if (originalHref.startsWith('/pages/')) {
            const cleanedPath = window.cleanPath(originalHref);
            newHref = `${baseUrl}${cleanedPath}`;
        }
        // pages/... formatındaki linkler için (başında / yok)
        else if (originalHref.startsWith('pages/')) {
            const cleanedPath = window.cleanPath('/' + originalHref);
            newHref = `${baseUrl}${cleanedPath}`;
        }
        
        // Eğer href değiştiyse güncelle
        if (newHref !== originalHref) {
            link.href = newHref;
            updatedCount++;
            console.log(`  ✓ ${originalHref} → ${newHref}`);
        }
    });
    
    console.log(`✅ ${updatedCount} link güncellendi`);
};

/**
 * Bir HTML bileşenini (header, footer vb.) 
 * ID'sine göre ilgili yere yükler.
 */
const loadComponent = (componentPath, elementId) => {
    const element = document.getElementById(elementId);
    
    // Eğer bu ID sayfada yoksa dur (Hata verme)
    if (!element) {
        return;
    }

    // fetch API kullanarak component'in içeriğini al
    fetch(componentPath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`${componentPath} yüklenemedi.`);
            }
            return response.text();
        })
        .then(html => {
            // Gelen HTML'i placeholder'ın içine bas
            element.innerHTML = html;
            
            // ÖNEMLİ: Header yüklendikten sonra sepet sayısını güncellemek için
            // eğer cart.js yüklüyse ve sepetiYenile fonksiyonu varsa onu çalıştır
            if (elementId === 'header-placeholder' && typeof sepetiYenile === 'function') {
                sepetiYenile();
            }
            
            // Sidebar yüklendikten sonra linkleri güncelle
            if (elementId === 'sidebar-placeholder') {
                // DOM'un tam olarak render edilmesi için kısa bir gecikme
                // Ayrıca MutationObserver ile dinamik değişiklikleri de yakala
                setTimeout(() => {
                    updateSidebarLinks();
                    
                    // Eğer linkler hala güncellenmediyse tekrar dene
                    const sidebarElement = document.getElementById('sidebar-placeholder');
                    if (sidebarElement) {
                        const observer = new MutationObserver(() => {
                            updateSidebarLinks();
                        });
                        
                        observer.observe(sidebarElement, { childList: true, subtree: true });
                        
                        // 1 saniye sonra observer'ı durdur (sonsuz döngüyü önle)
                        setTimeout(() => {
                            observer.disconnect();
                        }, 1000);
                    }
                }, 50);
            }
        })
        .catch(error => {
            console.error(error);
            // Sadece geliştirme aşamasında hatayı ekrana bas
            // element.innerHTML = `<p style="color:red;">Hata: ${componentPath} bulunamadı.</p>`;
        });
};

/**
 * Tüm global bileşenleri, bulunulan sayfaya göre otomatik yükler.
 */
const loadAllComponents = () => {
    // Sayfanın nerede olduğunu anla
    // Eğer URL içinde "/pages/" geçiyorsa alt klasördeyiz demektir.
    // Bu durumda 2 klasör yukarı çıkmalıyız (../../)
    const isInnerPage = window.location.pathname.includes('/pages/');
    const pathPrefix = isInnerPage ? '../../' : '';

    const path = window.location.pathname;

    // --- 1. PANEL SAYFALARI (Sidebar Yükle) ---
    // Sidebar'ın yükleneceği <aside id="sidebar-placeholder"> var mı kontrol et
    if (document.getElementById('sidebar-placeholder')) {
        if (path.includes("admin")) {
            // Admin Paneli
            loadComponent(pathPrefix + 'components/admin-sidebar.html', 'sidebar-placeholder');
        } else if (path.includes("seller") || path.includes("courier")) {
            // Satıcı veya Kurye Paneli
            loadComponent(pathPrefix + 'components/dashboard-sidebar.html', 'sidebar-placeholder');
        }
    }

    // --- 2. NORMAL SAYFALAR (Header ve Footer Yükle) ---
    // Header veya Footer placeholder'ı varsa yükle
    // (Not: Senin HTML dosyalarında header zaten elle yazılı olduğu için 
    // bu kısım çalışsa bile mevcut header'ın üzerine yazmaz çünkü id="header-placeholder" yok.
    // Bu kod, ileride placeholder kullanmak istersen hazır dursun.)
    if (document.getElementById('header-placeholder')) {
        loadComponent(pathPrefix + 'components/header.html', 'header-placeholder');
    }
    if (document.getElementById('footer-placeholder')) {
        loadComponent(pathPrefix + 'components/footer.html', 'footer-placeholder');
    }
};

// -------------------------------------------
// Global link güncelleme - Tüm sayfalarda çalışır
// -------------------------------------------
const updateAllPageLinks = () => {
    const baseUrl = window.getBaseUrl();
    if (!baseUrl) return; // Production'da gerek yok
    
    // Sayfadaki tüm linkleri bul (sidebar dışında)
    const allPageLinks = document.querySelectorAll('a[href]:not(#sidebar-placeholder a)');
    
    allPageLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
            return;
        }
        
        // Eğer zaten baseUrl içeriyorsa atla
        if (href.includes('localhost:3000')) {
            return;
        }
        
        // Relative path'leri güncelle
        if (href.startsWith('/')) {
            const cleanedPath = window.cleanPath(href);
            link.href = `${baseUrl}${cleanedPath}`;
        } else if (href.startsWith('../')) {
            // Relative path'leri base URL'e çevir
            const currentPath = window.cleanPath(window.location.pathname);
            const pathParts = currentPath.split('/').filter(p => p && p !== 'Yemek-Sepeti' && p !== 'YemekSepeti');
            const relativeParts = href.split('/').filter(p => p && p !== '..');
            
            // .. sayısını hesapla
            const upLevels = (href.match(/\.\.\//g) || []).length;
            const newPathParts = pathParts.slice(0, -upLevels - 1);
            const newPath = '/' + newPathParts.join('/') + '/' + relativeParts.join('/');
            const cleanedPath = window.cleanPath(newPath);
            link.href = `${baseUrl}${cleanedPath}`;
        }
    });
};

// -------------------------------------------
// Sayfa yüklendiğinde (DOM hazır olduğunda)
// -------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    loadAllComponents();
    
    // Tüm sayfa linklerini güncelle (sidebar dışında)
    setTimeout(() => {
        updateAllPageLinks();
    }, 100);
});