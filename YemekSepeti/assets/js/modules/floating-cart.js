let floatingCartInitialized = false;

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
    `;
    
    document.body.insertAdjacentHTML('beforeend', cartHTML);
}

async function initFloatingCart() {
    if (floatingCartInitialized) {
        return;
    }
    
    const path = window.location.pathname;
    if (path.includes('/seller/') || path.includes('/courier/') || path.includes('/admin/')) {
        return;
    }
    
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const response = await fetch(`${baseUrl}/api/auth/me`, {
            credentials: 'include'
        }).catch(() => null);
        
        if (response && response.ok) {
            const data = await response.json();
            if (data.success && data.user) {
                const role = data.user.role;
                if (role === 'seller' || role === 'courier' || role === 'admin') {
                    return;
                }
            }
        }
    } catch (error) {
    }
    
    createFloatingCartHTML();
    
    const overlay = document.getElementById('floating-cart-overlay');
    const panel = document.getElementById('floating-cart-panel');
    const closeBtn = document.getElementById('floating-cart-close');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeFloatingCart);
    }
    
    if (overlay) {
        overlay.addEventListener('click', closeFloatingCart);
    }
    
    floatingCartInitialized = true;
}

function openFloatingCart() {
    const overlay = document.getElementById('floating-cart-overlay');
    const panel = document.getElementById('floating-cart-panel');
    
    if (overlay && panel) {
        overlay.classList.add('active');
        panel.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeFloatingCart() {
    const overlay = document.getElementById('floating-cart-overlay');
    const panel = document.getElementById('floating-cart-panel');
    
    if (overlay && panel) {
        overlay.classList.remove('active');
        panel.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function toggleFloatingCart(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    }
    
    console.log('toggleFloatingCart called');
    
    const panel = document.getElementById('floating-cart-panel');
    if (!panel) {
        console.error('Floating cart panel not found!');
        return;
    }
    
    const isOpen = panel.classList.contains('active');
    console.log('Panel is open:', isOpen);
    
    if (isOpen) {
        closeFloatingCart();
    } else {
        openFloatingCart();
        updateFloatingCart().catch((error) => {
            console.error('Error updating floating cart:', error);
        });
    }
}

async function updateFloatingCart() {
    const path = window.location.pathname;
    if (path.includes('/seller/') || path.includes('/courier/') || path.includes('/admin/')) {
        return;
    }
    
    const cachedUser = localStorage.getItem('user');
    if (cachedUser) {
        try {
            const user = JSON.parse(cachedUser);
            if (user.role === 'seller' || user.role === 'courier' || user.role === 'admin') {
                return;
            }
        } catch (e) {
        }
    }
    
    if (!floatingCartInitialized) {
        await initFloatingCart();
    }
    
    const sepet = window.getSepet ? window.getSepet() : [];
    const totals = window.getSepetTotals ? (await window.getSepetTotals()) : { ara: 0, teslimat: 15.00, toplam: 15.00 };
    
    const countBadge = document.getElementById('floating-cart-count');
    const emptyDiv = document.getElementById('floating-cart-empty');
    const itemsDiv = document.getElementById('floating-cart-items');
    const footerDiv = document.getElementById('floating-cart-footer');
    const subtotalEl = document.getElementById('floating-cart-subtotal');
    const deliveryEl = document.getElementById('floating-cart-delivery');
    const totalEl = document.getElementById('floating-cart-total');
    
    const totalItems = sepet.reduce((sum, item) => sum + (item.adet || 1), 0);
    
    if (countBadge) {
        countBadge.textContent = totalItems;
    }
    
    if (sepet.length === 0) {
        if (emptyDiv) emptyDiv.style.display = 'block';
        if (itemsDiv) itemsDiv.style.display = 'none';
        if (footerDiv) footerDiv.style.display = 'none';
        return;
    }
    
    if (emptyDiv) emptyDiv.style.display = 'none';
    if (itemsDiv) itemsDiv.style.display = 'flex';
    if (footerDiv) footerDiv.style.display = 'block';
    
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
        
        itemsDiv.onclick = null;
        
        itemsDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            
            const target = e.target;
            
            if (target.classList.contains('floating-cart-qty-decrease') || target.closest('.floating-cart-qty-decrease')) {
                const btn = target.classList.contains('floating-cart-qty-decrease') ? target : target.closest('.floating-cart-qty-decrease');
                const id = parseInt(btn.getAttribute('data-az'));
                if (window.adetArtirAzalt && !btn.disabled) {
                    btn.disabled = true;
                    window.adetArtirAzalt(id, -1);
                    setTimeout(() => { btn.disabled = false; }, 300);
                }
                return;
            }
            
            if (target.classList.contains('floating-cart-qty-increase') || target.closest('.floating-cart-qty-increase')) {
                const btn = target.classList.contains('floating-cart-qty-increase') ? target : target.closest('.floating-cart-qty-increase');
                const id = parseInt(btn.getAttribute('data-art'));
                if (window.adetArtirAzalt && !btn.disabled) {
                    btn.disabled = true;
                    window.adetArtirAzalt(id, 1);
                    setTimeout(() => { btn.disabled = false; }, 300);
                }
                return;
            }
            
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

const formatTL = window.formatTL || function(amount) {
    return Number(amount || 0).toLocaleString('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

window.openFloatingCart = openFloatingCart;
window.closeFloatingCart = closeFloatingCart;
window.toggleFloatingCart = toggleFloatingCart;
window.updateFloatingCart = updateFloatingCart;

document.addEventListener('DOMContentLoaded', async () => {
    const isAuthPage = window.location.pathname.includes('/login') || 
                       window.location.pathname.includes('/register') ||
                       window.location.pathname.includes('/forgot-password') ||
                       window.location.pathname.includes('/reset-password');
    if (isAuthPage) {
        return;
    }
    
    const path = window.location.pathname;
    const isPanelPage = path.includes('/seller/') || path.includes('/courier/') || path.includes('/admin/');
    
    let isPanelUser = false;
    if (isPanelPage) {
        isPanelUser = true;
    } else {
        const cachedUser = localStorage.getItem('user');
        if (cachedUser) {
            try {
                const user = JSON.parse(cachedUser);
                if (user.role === 'seller' || user.role === 'courier' || user.role === 'admin') {
                    isPanelUser = true;
                }
            } catch (e) {
            }
        }
    }
    
    if (!isPanelUser) {
        initFloatingCart();
        
        if (window.sepetiYenile) {
            const originalSepetiYenile = window.sepetiYenile;
            window.sepetiYenile = function() {
                originalSepetiYenile();
                updateFloatingCart();
            };
        }
        
        setTimeout(() => {
            updateFloatingCart();
        }, 500);
    }
});

