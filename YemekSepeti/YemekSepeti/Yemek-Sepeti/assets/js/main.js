/* ==================================== */
/* GLOBAL SCRIPT (main.js)              */
/* assets/js/main.js                    */
/* Görev: Enes                          */
/* ==================================== */

/**
 * Bir HTML bileşenini (header, footer vb.) 
 * ID'sine göre ilgili yere yükler.
 * @param {string} componentPath - Kök dizinden yol (örn: /components/header.html)
 * @param {string} elementId - Yükleneceği elementin ID'si (örn: header-placeholder)
 */
const loadComponent = (componentPath, elementId) => {
    const element = document.getElementById(elementId);
    
    // Eğer bu ID sayfada yoksa (örn: satıcı panelinde header-placeholder yoksa)
    // hiçbir şey yapma, hatayı engelle.
    if (!element) {
        return;
    }

    // fetch API kullanarak component'in içeriğini al
    fetch(componentPath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`${componentPath} yüklenemedi. (404 Not Found)`);
            }
            return response.text();
        })
        .then(html => {
            // Gelen HTML'i placeholder'ın içine bas
            element.innerHTML = html;
        })
        .catch(error => {
            console.error(error);
            // Hata olursa kullanıcıya bildir
            element.innerHTML = `<p style="color:red; text-align:center;">Hata: ${elementId} yüklenemedi.</p>`;
        });
};

/**
 * Tüm global bileşenleri yükler.
 */
const loadAllComponents = () => {
    // Alıcı (Buyer) ve Ortak (Common) sayfalar için:
    // (index.html, login.html, cart.html vb.)
    loadComponent('/components/header.html', 'header-placeholder');
    loadComponent('/components/footer.html', 'footer-placeholder');

    // Satıcı (Seller) ve Kurye (Courier) panelleri için:
    // (dashboard.html, orders.html vb.)
    loadComponent('/components/dashboard-sidebar.html', 'sidebar-placeholder');
};

// -------------------------------------------
// Sayfa yüklendiğinde (DOM hazır olduğunda)
// -------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    // Tüm bileşenleri (Header, Footer, Sidebar) yükle
    loadAllComponents();

    // TODO (İkinci Adım): Mobil menü (hamburger) tıklama
    // olayını buraya ekleyin. (Event Delegation kullanarak)
});