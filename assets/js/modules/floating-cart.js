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
function initFloatingCart() {
    if (floatingCartInitialized) {
        return;
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
        toggleBtn.addEventListener('click', toggleFloatingCart);
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
function toggleFloatingCart() {
    const panel = document.getElementById('floating-cart-panel');
    if (panel && panel.classList.contains('active')) {
        closeFloatingCart();
    } else {
        openFloatingCart();
    }
}

// Floating cart'ı güncelle (sepet değiştiğinde çağrılır)
async function updateFloatingCart() {
    if (!floatingCartInitialized) {
        initFloatingCart();
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
            toggleCountBadge.style.display = 'block';
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
            const fiyat = urun.price || urun.fiyat || 0;
            const toplam = fiyat * adet;
            
            // Görsel URL'i kontrol et
            let urunGorsel = urun.gorsel || urun.imageUrl || '';
            if (!urunGorsel || 
                !urunGorsel.startsWith('http') || 
                urunGorsel.includes('via.placeholder.com') ||
                urunGorsel.includes('placeholder.com')) {
                const urunAd = (urun.ad || urun.name || 'Yemek').substring(0, 10);
                urunGorsel = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#f0f0f0"/><text x="50%" y="50%" font-family="Arial" font-size="12" fill="#666" text-anchor="middle" dominant-baseline="middle">${urunAd}</text></svg>`)}`;
            }
            
            const itemHTML = `
                <div class="floating-cart-item" data-item-id="${urun.id}">
                    <img src="${urunGorsel}" alt="${urun.ad || urun.name}" class="floating-cart-item-image" onerror="this.onerror=null; this.style.display='none';">
                    <div class="floating-cart-item-details">
                        <div class="floating-cart-item-name">${urun.ad || urun.name || 'Ürün'}</div>
                        <div class="floating-cart-item-price">${formatTL(toplam)}</div>
                        <div class="floating-cart-item-quantity">
                            <button class="floating-cart-qty-decrease" data-az="${urun.id}" aria-label="Azalt">-</button>
                            <input type="text" value="${adet}" class="floating-cart-qty-input" readonly>
                            <button class="floating-cart-qty-increase" data-art="${urun.id}" aria-label="Artır">+</button>
                        </div>
                    </div>
                    <button class="floating-cart-item-remove" data-sil="${urun.id}" aria-label="Kaldır">×</button>
                </div>
            `;
            
            itemsDiv.insertAdjacentHTML('beforeend', itemHTML);
        });
        
        // Event listener'ları ekle
        itemsDiv.querySelectorAll('.floating-cart-qty-decrease').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(btn.getAttribute('data-az'));
                if (window.adetArtirAzalt) {
                    window.adetArtirAzalt(id, -1);
                }
            });
        });
        
        itemsDiv.querySelectorAll('.floating-cart-qty-increase').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(btn.getAttribute('data-art'));
                if (window.adetArtirAzalt) {
                    window.adetArtirAzalt(id, 1);
                }
            });
        });
        
        itemsDiv.querySelectorAll('.floating-cart-item-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(btn.getAttribute('data-sil'));
                if (window.sepettenSil) {
                    window.sepettenSil(id);
                }
            });
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
document.addEventListener('DOMContentLoaded', () => {
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
});

