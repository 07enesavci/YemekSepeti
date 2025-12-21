// ============================================
// SCROLL TO TOP BUTTON
// Sağ alt köşede sayfanın en üstüne çıkmak için buton
// ============================================

let scrollToTopButton = null;

// Scroll to top butonu oluştur
function createScrollToTopButton() {
    // Eğer buton zaten varsa, oluşturma
    if (document.getElementById('scroll-to-top-btn')) {
        return;
    }
    
    const button = document.createElement('button');
    button.id = 'scroll-to-top-btn';
    button.className = 'scroll-to-top-btn';
    button.setAttribute('aria-label', 'En üste çık');
    button.innerHTML = '↑';
    button.style.display = 'none'; // Başlangıçta gizli
    
    // Tıklama olayı
    button.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
    
    // Sayfaya ekle
    document.body.appendChild(button);
    scrollToTopButton = button;
    
    // Buton pozisyonunu ayarla
    function adjustButtonPosition() {
        const isPanelPage = document.querySelector('.panel-layout') !== null;
        const hasFloatingCart = document.getElementById('floating-cart-toggle') !== null;
        
        // Panel sayfalarında veya floating cart yoksa sağ alt köşeye yerleştir
        if (isPanelPage || !hasFloatingCart) {
            if (window.innerWidth <= 480) {
                button.style.bottom = '1rem';
            } else if (window.innerWidth <= 768) {
                button.style.bottom = '1.5rem';
            } else {
                button.style.bottom = '2rem';
            }
        } else {
            // Floating cart var, üstüne yerleştir
            if (window.innerWidth <= 480) {
                button.style.bottom = '6.5rem';
            } else if (window.innerWidth <= 768) {
                button.style.bottom = '7rem';
            } else {
                button.style.bottom = '8rem';
            }
        }
    }
    
    // İlk pozisyon ayarı
    adjustButtonPosition();
    
    // Responsive için window resize dinle
    window.addEventListener('resize', adjustButtonPosition);
    
    // Floating cart yüklendikten sonra pozisyonu güncelle (delay ile)
    setTimeout(adjustButtonPosition, 1000);
    
    // Scroll olayını dinle
    window.addEventListener('scroll', toggleScrollToTopButton);
    
    // İlk kontrol
    toggleScrollToTopButton();
}

// Butonu göster/gizle (scroll pozisyonuna göre)
function toggleScrollToTopButton() {
    if (!scrollToTopButton) return;
    
    // 300px aşağı scroll edilmişse butonu göster
    if (window.pageYOffset > 300 || document.documentElement.scrollTop > 300) {
        scrollToTopButton.style.display = 'flex';
    } else {
        scrollToTopButton.style.display = 'none';
    }
}

// Panel sayfalarında veya panel kullanıcıları için scroll-to-top butonu göster
async function checkAndShowScrollToTop() {
    const path = window.location.pathname;
    const isPanelPage = path.includes('/seller/') || path.includes('/courier/') || path.includes('/admin/');
    
    // Panel sayfalarında her zaman göster
    if (isPanelPage) {
        createScrollToTopButton();
        return;
    }
    
    // Auth sayfalarında API çağrısı yapma
    const isAuthPage = window.location.pathname.includes('/login') || 
                       window.location.pathname.includes('/register') ||
                       window.location.pathname.includes('/forgot-password') ||
                       window.location.pathname.includes('/reset-password');
    if (isAuthPage) {
        return;
    }
    
    // Kullanıcı kontrolü - cache'lenmiş kullanıcı bilgisini kullan
    const cachedUser = localStorage.getItem('user');
    if (cachedUser) {
        try {
            const user = JSON.parse(cachedUser);
            // Panel kullanıcıları için scroll-to-top göster
            if (user.role === 'seller' || user.role === 'courier' || user.role === 'admin') {
                createScrollToTopButton();
                return;
            }
        } catch (e) {
            // Parse hatası, devam et
        }
    }
    // Kullanıcı giriş yapmamış veya buyer ise scroll-to-top gösterme
    
    // Normal kullanıcılar için de göster
    createScrollToTopButton();
}

// Sayfa yüklendiğinde butonu oluştur
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndShowScrollToTop);
} else {
    // DOM zaten yüklendi
    checkAndShowScrollToTop();
}

