// ============================================
// FLOATING CART MODULE
// Sağ tarafta açılan sepet paneli
// ============================================

let floatingCartInitialized = false;

// Floating cart HTML yapısını oluştur
function createFloatingCartHTML() {
    const cartHTML = `
        <div class="floating-cart-overlay" id="floating-cart-overlay"></div>
        <div class="floating-cart-panel" id="floating-cart-panel">
            <div class="floating-cart-header">
                <h3>
                    Sepetim
                    <span class="cart-count-badge" id="floating-cart-count">0</span>
                </h3>
                <button class="floating-cart-close" id="floating-cart-close" aria-label="Sepeti Kapat">×</button>
            </div>
            <div class="floating-cart-body" id="floating-cart-body">
                <div class="floating-cart-empty" id="floating-cart-empty">
                    <div class="floating-cart-empty-icon">🛒</div>
                    <p>Sepetiniz boş</p>
                </div>
                <div class="floating-cart-items" id="floating-cart-items" style="display: none;"></div>
            </div>
            <div class="floating-cart-footer" id="floating-cart-footer" style="display: none;">
                <div class="floating-cart-summary">
                    <div class="floating-cart-summary-row">
                        <span>Ara Toplam</span>
                        <span id="floating-cart-subtotal">0,00 TL</span>
                    </div>
                    <div class="floating-cart-summary-row">
                        <span>Teslimat Ücreti</span>
                        <span id="floating-cart-delivery">29,99 TL</span>
                    </div>
                    <div class="floating-cart-summary-row total">
                        <span>Toplam</span>
                        <span id="floating-cart-total">29,99 TL</span>
                    </div>
                </div>
                <div class="floating-cart-actions">
                    <a href="/buyer/cart" class="btn btn-primary">Sepete Git</a>
                    <a href="/buyer/checkout" class="btn btn-secondary">Ödemeye Geç</a>
                </div>
            </div>
        </div>
        <button class="floating-cart-toggle" id="floating-cart-toggle" aria-label="Sepeti Aç">
            🛒
            <span class="cart-count-badge" id="floating-cart-toggle-count" style="display: none;">0</span>
        </button>
    `;
    
    document.body.insertAdjacentHTML('beforeend', cartHTML);
}

// Floating cart'ı başlat
async function initFloatingCart() {
    if (floatingCartInitialized) {
        return;
    }
    
    // Panel sayfalarında floating cart'ı gösterme
    const path = window.location.pathname;
    if (path.includes('/seller/') || path.includes('/courier/') || path.includes('/admin/')) {
        return; // Panel sayfalarında floating cart gösterme
    }
    
    // Kullanıcı kontrolü - eğer seller, courier veya admin ise gösterme
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const response = await fetch(`${baseUrl}/api/auth/me`, {
            credentials: 'include'
        }).catch(() => null); // Network hatalarını sessizce handle et
        
        if (response && response.ok) {
            const data = await response.json();
            if (data.success && data.user) {
                const role = data.user.role;
                if (role === 'seller' || role === 'courier' || role === 'admin') {
                    return; // Panel kullanıcıları için floating cart gösterme
                }
            }
        }
        // 401/403 normal durumlar (kullanıcı giriş yapmamış), sessizce devam et
    } catch (error) {
        // Hata durumunda devam et (kullanıcı login olmamış olabilir)
    }
    
    createFloatingCartHTML();
    
    const overlay = document.getElementById('floating-cart-overlay');
    const panel = document.getElementById('floating-cart-panel');
    const closeBtn = document.getElementById('floating-cart-close');
    const toggleBtn = document.getElementById('floating-cart-toggle');
    
    // Kapat butonu
    if (closeBtn) {
        closeBtn.addEventListener('click', closeFloatingCart);
    }
    
    // Overlay'e tıklanınca kapat
    if (overlay) {
        overlay.addEventListener('click', closeFloatingCart);
    }
    
    // Toggle butonu
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleFloatingCart(e);
        }, true); // Capture phase'de çalışsın
        
        // Ekstra güvenlik: badge'e tıklandığında da sepete git
        const badge = document.getElementById('floating-cart-toggle-count');
        if (badge && badge.parentElement === toggleBtn) {
            badge.style.pointerEvents = 'none'; // CSS'de de var ama JS'de de emin ol
        }
    }
    
    floatingCartInitialized = true;
}

// Floating cart'ı aç
function openFloatingCart() {
    const overlay = document.getElementById('floating-cart-overlay');
    const panel = document.getElementById('floating-cart-panel');
    
    if (overlay && panel) {
        overlay.classList.add('active');
        panel.classList.add('active');
        document.body.style.overflow = 'hidden'; // Scroll'u engelle
    }
}

// Floating cart'ı kapat
function closeFloatingCart() {
    const overlay = document.getElementById('floating-cart-overlay');
    const panel = document.getElementById('floating-cart-panel');
    
    if (overlay && panel) {
        overlay.classList.remove('active');
        panel.classList.remove('active');
        document.body.style.overflow = ''; // Scroll'u geri aç
    }
}

// Floating cart'ı aç/kapat
function toggleFloatingCart(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Butona tıklayınca direkt sepete git
    const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
    const cartUrl = `${baseUrl}/buyer/cart`;
    
    // Direkt yönlendir
    window.location.href = cartUrl;
}

// Floating cart'ı güncelle (sepet değiştiğinde çağrılır)
async function updateFloatingCart() {
    // Panel sayfalarında güncelleme yapma
    const path = window.location.pathname;
    if (path.includes('/seller/') || path.includes('/courier/') || path.includes('/admin/')) {
        return;
    }
    
    // Kullanıcı kontrolü - cache'lenmiş kullanıcı bilgisini kullan
    const cachedUser = localStorage.getItem('user');
    if (cachedUser) {
        try {
            const user = JSON.parse(cachedUser);
            if (user.role === 'seller' || user.role === 'courier' || user.role === 'admin') {
                return; // Panel kullanıcıları için güncelleme yapma
            }
        } catch (e) {
            // Parse hatası, devam et
        }
    }
    // Kullanıcı giriş yapmamış veya buyer ise devam et
    
    if (!floatingCartInitialized) {
        await initFloatingCart();
    }
    
    const sepet = window.getSepet ? window.getSepet() : [];
    const totals = window.getSepetTotals ? (await window.getSepetTotals()) : { ara: 0, teslimat: 15.00, toplam: 15.00 };
    
    const countBadge = document.getElementById('floating-cart-count');
    const toggleCountBadge = document.getElementById('floating-cart-toggle-count');
    const emptyDiv = document.getElementById('floating-cart-empty');
    const itemsDiv = document.getElementById('floating-cart-items');
    const footerDiv = document.getElementById('floating-cart-footer');
    const subtotalEl = document.getElementById('floating-cart-subtotal');
    const deliveryEl = document.getElementById('floating-cart-delivery');
    const totalEl = document.getElementById('floating-cart-total');
    
    // Sepet sayısını güncelle
    const totalItems = sepet.reduce((sum, item) => sum + (item.adet || 1), 0);
    
    if (countBadge) {
        countBadge.textContent = totalItems;
    }
    
    if (toggleCountBadge) {
        if (totalItems > 0) {
            toggleCountBadge.textContent = totalItems;
            toggleCountBadge.style.display = 'flex';
        } else {
            toggleCountBadge.style.display = 'none';
        }
    }
    
    // Sepet boşsa
    if (sepet.length === 0) {
        if (emptyDiv) emptyDiv.style.display = 'block';
        if (itemsDiv) itemsDiv.style.display = 'none';
        if (footerDiv) footerDiv.style.display = 'none';
        return;
    }
    
    // Sepet doluysa
    if (emptyDiv) emptyDiv.style.display = 'none';
    if (itemsDiv) itemsDiv.style.display = 'flex';
    if (footerDiv) footerDiv.style.display = 'block';
    
    // Ürünleri render et
    if (itemsDiv) {
        itemsDiv.innerHTML = '';
        
        sepet.forEach((item) => {
            const urun = item.urun || {};
            const adet = item.adet || 1;
            const fiyat = parseFloat(urun.price || urun.fiyat || 0) || 0;
            const toplam = fiyat * adet;
            const urunId = urun.id || item.id || '';
            const urunAd = (urun.ad || urun.name || 'Ürün').toString().trim();
            const urunAdDisplay = urunAd || 'Ürün';
            
            // Görsel URL'i kontrol et
            let urunGorsel = urun.gorsel || urun.imageUrl || '';
            if (!urunGorsel || 
                typeof urunGorsel !== 'string' ||
                !urunGorsel.startsWith('http') || 
                urunGorsel.includes('via.placeholder.com') ||
                urunGorsel.includes('placeholder.com')) {
                const urunAdShort = urunAdDisplay.substring(0, 10);
                urunGorsel = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#f0f0f0"/><text x="50%" y="50%" font-family="Arial" font-size="12" fill="#666" text-anchor="middle" dominant-baseline="middle">${urunAdShort}</text></svg>`)}`;
            }
            
            const itemHTML = `
                <div class="floating-cart-item" data-item-id="${urunId}">
                    <img src="${urunGorsel}" alt="${urunAdDisplay}" class="floating-cart-item-image" onerror="this.onerror=null; this.style.display='none';">
                    <div class="floating-cart-item-details">
                        <div class="floating-cart-item-name">${urunAdDisplay}</div>
                        <div class="floating-cart-item-price">${formatTL(toplam)}</div>
                        <div class="floating-cart-item-quantity">
                            <button class="floating-cart-qty-decrease" data-az="${urunId}" aria-label="Azalt">-</button>
                            <input type="text" value="${adet}" class="floating-cart-qty-input" readonly>
                            <button class="floating-cart-qty-increase" data-art="${urunId}" aria-label="Artır">+</button>
                        </div>
                    </div>
                    <button class="floating-cart-item-remove" data-sil="${urunId}" aria-label="Kaldır">×</button>
                </div>
            `;
            
            itemsDiv.insertAdjacentHTML('beforeend', itemHTML);
        });
        
        // Event delegation kullan - çift tıklama sorununu önlemek için
        // Mevcut listener'ları kaldır (varsa)
        itemsDiv.onclick = null;
        
        // Tek bir event listener ile tüm butonları yönet
        itemsDiv.addEventListener('click', (e) => {
            e.stopPropagation(); // Event bubbling'i durdur
            
            const target = e.target;
            
            // Azalt butonu
            if (target.classList.contains('floating-cart-qty-decrease') || target.closest('.floating-cart-qty-decrease')) {
                const btn = target.classList.contains('floating-cart-qty-decrease') ? target : target.closest('.floating-cart-qty-decrease');
                const id = parseInt(btn.getAttribute('data-az'));
                if (window.adetArtirAzalt && !btn.disabled) {
                    btn.disabled = true;
                    window.adetArtirAzalt(id, -1);
                    setTimeout(() => { btn.disabled = false; }, 300); // 300ms sonra tekrar aktif et
                }
                return;
            }
            
            // Artır butonu
            if (target.classList.contains('floating-cart-qty-increase') || target.closest('.floating-cart-qty-increase')) {
                const btn = target.classList.contains('floating-cart-qty-increase') ? target : target.closest('.floating-cart-qty-increase');
                const id = parseInt(btn.getAttribute('data-art'));
                if (window.adetArtirAzalt && !btn.disabled) {
                    btn.disabled = true;
                    window.adetArtirAzalt(id, 1);
                    setTimeout(() => { btn.disabled = false; }, 300); // 300ms sonra tekrar aktif et
                }
                return;
            }
            
            // Kaldır butonu
            if (target.classList.contains('floating-cart-item-remove') || target.closest('.floating-cart-item-remove')) {
                const btn = target.classList.contains('floating-cart-item-remove') ? target : target.closest('.floating-cart-item-remove');
                const id = parseInt(btn.getAttribute('data-sil'));
                if (window.sepettenSil && !btn.disabled) {
                    btn.disabled = true;
                    window.sepettenSil(id);
                    setTimeout(() => { btn.disabled = false; }, 300);
                }
                return;
            }
        });
    }
    
    // Toplamları güncelle
    if (subtotalEl) {
        subtotalEl.textContent = formatTL(totals.ara);
    }
    if (deliveryEl) {
        deliveryEl.textContent = formatTL(totals.teslimat);
    }
    if (totalEl) {
        totalEl.textContent = formatTL(totals.toplam);
    }
}

// formatTL fonksiyonu api.js'de tanımlı (window.formatTL)
const formatTL = window.formatTL || function(amount) {
    return Number(amount || 0).toLocaleString('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

// Global fonksiyonlar
window.openFloatingCart = openFloatingCart;
window.closeFloatingCart = closeFloatingCart;
window.toggleFloatingCart = toggleFloatingCart;
window.updateFloatingCart = updateFloatingCart;

// Sayfa yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', async () => {
    // Auth sayfalarında çalışma
    const isAuthPage = window.location.pathname.includes('/login') || 
                       window.location.pathname.includes('/register') ||
                       window.location.pathname.includes('/forgot-password') ||
                       window.location.pathname.includes('/reset-password');
    if (isAuthPage) {
        return;
    }
    // Panel sayfalarında veya panel kullanıcıları için floating cart'ı gösterme
    const path = window.location.pathname;
    const isPanelPage = path.includes('/seller/') || path.includes('/courier/') || path.includes('/admin/');
    
    // Kullanıcı kontrolü
    let isPanelUser = false;
    if (isPanelPage) {
        isPanelUser = true;
    } else {
        // Kullanıcı kontrolü - cache'lenmiş kullanıcı bilgisini kullan
        const cachedUser = localStorage.getItem('user');
        if (cachedUser) {
            try {
                const user = JSON.parse(cachedUser);
                if (user.role === 'seller' || user.role === 'courier' || user.role === 'admin') {
                    isPanelUser = true;
                }
            } catch (e) {
                // Parse hatası, devam et
            }
        }
    }
    
    // Panel kullanıcıları için floating cart'ı başlatma
    if (!isPanelUser) {
        initFloatingCart();
        
        // İlk sepet durumunu güncelle
        if (window.sepetiYenile) {
            // sepetiYenile fonksiyonunu override et
            const originalSepetiYenile = window.sepetiYenile;
            window.sepetiYenile = function() {
                originalSepetiYenile();
                updateFloatingCart();
            };
        }
        
        // Sepet değişikliklerini dinle
        setTimeout(() => {
            updateFloatingCart();
        }, 500);
    } else {
        // Panel kullanıcıları için floating cart toggle butonunu gizle
        const toggleBtn = document.getElementById('floating-cart-toggle');
        if (toggleBtn) {
            toggleBtn.style.display = 'none';
        }
    }
});

