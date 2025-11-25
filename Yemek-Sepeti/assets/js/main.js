/* ==================================== */
/* GLOBAL SCRIPT (main.js)              */
/* assets/js/main.js                    */
/* ==================================== */

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
// Sayfa yüklendiğinde (DOM hazır olduğunda)
// -------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    loadAllComponents();
});