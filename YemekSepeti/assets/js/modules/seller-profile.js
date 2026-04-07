// Satıcı profil: bilgi, menü ve sekmelerin yüklenmesi
function getSellerIdFromUrl() {
    const pathParts = window.location.pathname.split('/');
    const sellerProfileIndex = pathParts.indexOf('seller-profile');
    if (sellerProfileIndex !== -1 && pathParts[sellerProfileIndex + 1]) {
        return pathParts[sellerProfileIndex + 1];
    }
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

async function loadSellerProfile() {
    const sellerId = getSellerIdFromUrl();
    
    if (!sellerId) {
        console.error('Satıcı ID bulunamadı');
        document.querySelector('.seller-header').innerHTML = '<p style="padding: 2rem; text-align: center; color: red;">Satıcı bulunamadı.</p>';
        return;
    }

    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        
        const sellerResponse = await fetch(`${baseUrl}/api/sellers/${sellerId}`);
        if (!sellerResponse.ok) {
            throw new Error('Satıcı bilgileri yüklenemedi');
        }
        const seller = await sellerResponse.json();
        
        console.log('📥 API seller verisi:', seller);
        console.log('📥 imageUrl:', seller.imageUrl);
        console.log('📥 bannerUrl:', seller.bannerUrl);

        const sellerNameEl = document.getElementById('seller-name');
        const sellerRatingEl = document.getElementById('seller-rating');
        const sellerLogoEl = document.querySelector('.seller-logo');
        const sellerBannerEl = document.querySelector('.seller-banner');
        
        if (sellerNameEl) {
            sellerNameEl.textContent = (seller.name || 'Satıcı Adı') + (seller.isOpen === false ? ' (KAPALI)' : '');
        }
        
        if (sellerRatingEl) {
            const ratingText = `⭐ ${seller.rating || 0} (${seller.totalReviews || 0} Yorum) - ${seller.location || ''}`;
            sellerRatingEl.textContent = ratingText;
        }
        
        if (sellerLogoEl) {
            let logoUrl = seller.imageUrl;
            if (!logoUrl || 
                logoUrl.trim() === '' ||
                logoUrl.includes('via.placeholder.com') ||
                logoUrl.includes('placeholder.com')) {
                const sellerName = (seller.name || 'Satıcı').substring(0, 15);
                logoUrl = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#667eea"/><text x="50%" y="50%" font-family="Arial" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">${sellerName}</text></svg>`)}`;
            } else {
                const separator = logoUrl.includes('?') ? '&' : '?';
                logoUrl = logoUrl + separator + '_t=' + Date.now();
            }
            console.log('🖼️ Logo URL:', logoUrl);
            sellerLogoEl.src = logoUrl;
            sellerLogoEl.alt = seller.name || 'Satıcı Logosu';
            sellerLogoEl.onerror = function() {
                this.onerror = null;
                const sellerName = (seller.name || 'Satıcı').substring(0, 15);
                this.src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#667eea"/><text x="50%" y="50%" font-family="Arial" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">${sellerName}</text></svg>`)}`;
            };
        }
        
        if (sellerBannerEl) {
            let bannerUrl = seller.bannerUrl;
            if (!bannerUrl || 
                bannerUrl.trim() === '' ||
                bannerUrl.includes('via.placeholder.com') ||
                bannerUrl.includes('placeholder.com')) {
                const sellerName = (seller.name || 'Satıcı').substring(0, 30);
                bannerUrl = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="400"><rect width="1920" height="400" fill="#764ba2"/><text x="50%" y="50%" font-family="Arial" font-size="48" fill="white" text-anchor="middle" dominant-baseline="middle">${sellerName}</text></svg>`)}`;
            } else {
                const separator = bannerUrl.includes('?') ? '&' : '?';
                bannerUrl = bannerUrl + separator + '_t=' + Date.now();
            }
            console.log('🖼️ Banner URL:', bannerUrl);
            sellerBannerEl.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.1), rgba(0,0,0,0.4)), url(${bannerUrl})`;
        }

        await loadSellerMenu(sellerId, seller); // Pass seller parameter here
        await loadSellerReviews(sellerId);
        initializeTabs();
        
    } catch (error) {
        console.error('Satıcı profili yüklenirken hata:', error);
        document.querySelector('.seller-header').innerHTML = '<p style="padding: 2rem; text-align: center; color: red;">Satıcı bilgileri yüklenirken bir hata oluştu.</p>';
    }
}

async function loadSellerReviews(sellerId) {
    const reviewsContent = document.getElementById('reviews-content');
    if (!reviewsContent) return;
    const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
    reviewsContent.innerHTML = '<p style="text-align: center; padding: 2rem;">Yorumlar yükleniyor...</p>';
    try {
        const res = await fetch(baseUrl + '/api/reviews/seller/' + sellerId);
        const data = await res.json();
        const reviews = data.reviews || [];
        const averageRating = data.averageRating != null ? data.averageRating : 0;
        let reviewableOrders = [];
        try {
            const ordRes = await fetch(baseUrl + '/api/orders/reviewable?seller_id=' + sellerId, { credentials: 'include' });
            const ordData = await ordRes.json();
            if (ordData.success && ordData.orders && ordData.orders.length > 0) reviewableOrders = ordData.orders;
        } catch (e) {}
        let html = '<div class="card"><div class="card-content">';
        html += '<p style="margin-bottom: 1rem;"><strong>Ortalama puan:</strong> ';
        for (let i = 1; i <= 5; i++) html += (i <= averageRating ? '★' : '☆');
        html += ' ' + averageRating.toFixed(1) + '</p>';
        if (reviewableOrders.length > 0) {
            html += '<div class="review-form-card" style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-color); border-radius: 8px;">';
            html += '<h4 style="margin: 0 0 0.75rem 0;">Değerlendir</h4>';
            html += '<form id="review-form">';
            html += '<input type="hidden" name="seller_id" value="' + sellerId + '">';
            html += '<div style="margin-bottom: 0.75rem;"><label>Sipariş seçin</label><select name="order_id" class="form-input" style="width: 100%;">';
            reviewableOrders.forEach(function(o) {
                html += '<option value="' + o.order_id + '">#' + (o.order_number || o.order_id) + ' - ' + (o.date || '') + '</option>';
            });
            html += '</select></div>';
            html += '<div style="margin-bottom: 0.75rem;"><label>Puan (1-5)</label><select name="rating" class="form-input" style="width: 100%;">';
            for (let r = 1; r <= 5; r++) html += '<option value="' + r + '">' + r + ' yıldız</option>';
            html += '</select></div>';
            html += '<div style="margin-bottom: 0.75rem;"><label>Yorum (isteğe bağlı)</label><textarea name="comment" class="form-input" rows="2" style="width: 100%;"></textarea></div>';
            html += '<button type="submit" class="btn btn-primary">Gönder</button></form></div>';
        }
        html += '<h4 style="margin: 0 0 0.75rem 0;">Yorumlar</h4>';
        if (reviews.length === 0) {
            html += '<p style="color: #666;">Henüz yorum yok.</p>';
        } else {
            reviews.forEach(function(r) {
                let stars = '';
                for (let i = 1; i <= 5; i++) stars += (i <= r.rating ? '★' : '☆');
                html += '<div style="padding: 0.75rem 0; border-bottom: 1px solid var(--border-color);">';
                html += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">' + stars + ' <strong>' + escapeHtml(r.userName) + '</strong> <span style="font-size: 0.85rem; color: #888;">' + (r.createdAt ? new Date(r.createdAt).toLocaleDateString('tr-TR') : '') + '</span></div>';
                if (r.comment) html += '<p style="margin: 0; font-size: 0.95rem;">' + escapeHtml(r.comment) + '</p>';
                html += '</div>';
            });
        }
        html += '</div></div>';
        reviewsContent.innerHTML = html;
        var form = document.getElementById('review-form');
        if (form) {
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                var orderId = form.querySelector('[name="order_id"]').value;
                var rating = form.querySelector('[name="rating"]').value;
                var comment = (form.querySelector('[name="comment"]').value || '').trim();
                fetch(baseUrl + '/api/reviews', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order_id: parseInt(orderId, 10), rating: parseInt(rating, 10), comment: comment || null })
                }).then(function(res) { return res.json(); }).then(function(data) {
                    if (data.success) {
                        alert('Değerlendirmeniz kaydedildi.');
                        loadSellerReviews(sellerId);
                    } else {
                        alert(data.message || 'Kaydedilemedi.');
                    }
                }).catch(function() { alert('Bir hata oluştu.'); });
            });
        }
    } catch (e) {
        reviewsContent.innerHTML = '<div class="card"><div class="card-content"><p style="color: #666;">Yorumlar yüklenemedi.</p></div></div>';
    }
}
function escapeHtml(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function initializeTabs() {
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    const activateTab = (targetTab) => {
        tabLinks.forEach(l => l.classList.remove('active'));
        tabContents.forEach(c => {
            c.classList.remove('active');
            c.style.display = 'none';
        });

        const link = document.querySelector(`.tab-link[data-tab="${targetTab}"]`);
        const targetContent = document.getElementById(`${targetTab}-content`);
        if (link) link.classList.add('active');
        if (targetContent) {
            targetContent.classList.add('active');
            targetContent.style.display = 'block';
        }
    };

    tabLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = link.getAttribute('data-tab');
            activateTab(targetTab);
        });
    });

    // URL parametresi ile varsayılan sekmeyi seç
    const urlTab = new URLSearchParams(window.location.search).get('tab');
    if (urlTab && document.getElementById(`${urlTab}-content`)) {
        activateTab(urlTab);
    } else {
        activateTab('menu');
    }
}

async function loadSellerMenu(sellerId, seller) {
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const menuResponse = await fetch(`${baseUrl}/api/sellers/${sellerId}/menu`);
        
        if (!menuResponse.ok) {
            throw new Error('Menü yüklenemedi');
        }
        
        const responseData = await menuResponse.json();
        const menuContent = document.getElementById('menu-content');
        if (!menuContent) {
            return;
        }

        let menu;
        if (Array.isArray(responseData)) {
            menu = responseData;
        } else if (responseData && Array.isArray(responseData.menu)) {
            menu = responseData.menu;
        } else {
            menu = [];
        }

        if (menu.length === 0) {
            menuContent.innerHTML = '<p style="text-align: center; padding: 2rem;">Henüz menü eklenmemiş.</p>';
            return;
        }

        const menuByCategory = {};
        menu.forEach(item => {
            if (!menuByCategory[item.category]) {
                menuByCategory[item.category] = [];
            }
            menuByCategory[item.category].push(item);
        });

        let menuHTML = '';
        for (const [category, items] of Object.entries(menuByCategory)) {
            menuHTML += `
                <h3 class="category-title" style="margin-top: 2rem; margin-bottom: 1rem; font-size: 1.5rem; color: var(--secondary-color);">${category}</h3>
                <div class="menu-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
            `;
            
            items.forEach(item => {
                const safeItemName = (item.name || 'Yemek')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
                
                let itemImageUrl = item.imageUrl;
                if (!itemImageUrl || 
                    itemImageUrl.trim() === '' ||
                    itemImageUrl.includes('via.placeholder.com') ||
                    itemImageUrl.includes('placeholder.com')) {
                    const itemName = (item.name || 'Yemek').substring(0, 20);
                    itemImageUrl = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="250" height="150"><rect width="250" height="150" fill="#f0f0f0"/><text x="50%" y="50%" font-family="Arial" font-size="18" fill="#666" text-anchor="middle" dominant-baseline="middle">${itemName}</text></svg>`)}`;
                } else {
                    itemImageUrl = itemImageUrl.trim();
                    if (itemImageUrl.startsWith('/uploads/')) {
                        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                        itemImageUrl = `${baseUrl}${itemImageUrl}`;
                    }
                    // Önbellek kırmak için zaman damgası ekle
                    const separator = itemImageUrl.includes('?') ? '&' : '?';
                    itemImageUrl = itemImageUrl + separator + '_t=' + Date.now();
                }
                
                let cartButtonHtml = '';
                if (seller.isOpen === false) {
                    cartButtonHtml = `<button class="btn btn-secondary btn-full" disabled style="margin-top: 0.5rem; opacity: 0.6; cursor: not-allowed;">Dükkan Kapalı</button>`;
                } else if (!item.isAvailable) {
                    cartButtonHtml = `<button class="btn btn-secondary btn-full" disabled style="margin-top: 0.5rem; opacity: 0.6; cursor: not-allowed;">Tükendi</button>`;
                } else {
                    cartButtonHtml = `<button class="btn btn-primary btn-full sepete-ekle-btn" onclick="addToCart(${item.id}, ${sellerId}, 1)" style="margin-top: 0.5rem; position: relative; overflow: hidden;"><span class="btn-label">Sepete Ekle</span><span class="food-anim" aria-hidden="true"><svg viewBox="0 0 24 20" width="24" height="20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 8.5Q6.5 6.5 7.5 4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M12 7.5Q11 5.5 12 3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M16.5 8.5Q15.5 6.5 16.5 4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M3 14Q3 9 12 9Q21 9 21 14Z" fill="currentColor"/><ellipse cx="12" cy="14.5" rx="9" ry="2.2" fill="currentColor"/></svg></span><span class="cart-anim" aria-hidden="true"><svg viewBox="0 0 36 26" width="30" height="22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 2.5H6L10 18.5H25.5L28.5 7.5L7.5 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="11.5" cy="23" r="2" stroke="currentColor" stroke-width="1.5"/><circle cx="24" cy="23" r="2" stroke="currentColor" stroke-width="1.5"/><path class="cart-tick" d="M14.5 13.5L16.5 15.5L21.5 10.5" stroke="#FFD700" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="stroke-dasharray:10;stroke-dashoffset:10"/></svg></span></button>`;
                }

                menuHTML += `
                    <div class="menu-item" style="background: var(--card-bg); border-radius: var(--border-radius); padding: 1rem; box-shadow: var(--card-shadow); ${item.isAvailable ? '' : 'opacity: 0.6;'}">
                        <div style="position: relative; width: 100%; height: 150px; overflow: hidden; border-radius: 8px; margin-bottom: 0.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                            <img src="${itemImageUrl}" 
                                 alt="${safeItemName}" 
                                 style="width: 100%; height: 100%; object-fit: cover; ${item.isAvailable ? '' : 'filter: grayscale(100%);'}"
                                 onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; color: white; font-size: 18px; font-weight: bold; text-align: center; padding: 10px;">${safeItemName}</div>
                        </div>
                        <h4 style="margin: 0.5rem 0; font-size: 1.1rem; color: var(--secondary-color);">${safeItemName}</h4>
                        <p style="margin: 0.5rem 0; color: var(--secondary-color-light); font-size: 0.9rem;">${(item.description || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
                        <p style="margin: 0.5rem 0; font-size: 1.2rem; font-weight: bold; color: var(--primary-color);">${parseFloat(item.price || 0).toFixed(2)} ₺</p>
                        ${cartButtonHtml}
                    </div>
                `;
            });
            
            menuHTML += '</div>';
        }

        menuContent.innerHTML = menuHTML;
        
        // Inline onclick yerine modern event listener kullan
        setTimeout(function() {
            var addToCartButtons = menuContent.querySelectorAll('button[onclick*="addToCart"]');

            // GSAP başlangıç pozisyonlarını ayarla
            if (typeof gsap !== 'undefined') {
                addToCartButtons.forEach(function(btn) {
                    var foodEl = btn.querySelector('.food-anim');
                    var cartEl = btn.querySelector('.cart-anim');
                    var tickEl = btn.querySelector('.cart-tick');
                    if (foodEl) gsap.set(foodEl, { xPercent: -50, yPercent: -50, y: 20, scale: 0, opacity: 0 });
                    if (cartEl) gsap.set(cartEl, { xPercent: -50, yPercent: -50, x: -60, opacity: 0 });
                    if (tickEl) gsap.set(tickEl, { strokeDashoffset: 10 });
                });
            }

            addToCartButtons.forEach(function(button) {
                var onclickAttr = button.getAttribute('onclick');
                if (onclickAttr) {
                    button.removeAttribute('onclick');
                    button.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        var match = onclickAttr.match(/addToCart\((\d+),\s*(\d+)(?:,\s*(\d+))?\)/);
                        if (match) {
                            var mealId = parseInt(match[1]);
                            var sellerId = parseInt(match[2]);
                            var quantity = match[3] ? parseInt(match[3]) : 1;
                            addToCart(mealId, sellerId, quantity);

                            if (typeof gsap !== 'undefined' && button.classList.contains('sepete-ekle-btn') && !button.classList.contains('animating')) {
                                var lbl = button.querySelector('.btn-label');
                                var foodEl = button.querySelector('.food-anim');
                                var cartEl = button.querySelector('.cart-anim');
                                var tickEl = button.querySelector('.cart-tick');

                                if (lbl && foodEl && cartEl) {
                                    button.classList.add('animating');
                                    button.disabled = true;

                                    var tl = gsap.timeline({
                                        onComplete: function() {
                                            button.classList.remove('animating');
                                            button.disabled = false;
                                        }
                                    });

                                    // Yazı solar
                                    tl.to(lbl, { opacity: 0, x: -10, duration: 0.2, ease: 'power1.in' });

                                    // Yemek ikonu yükselir
                                    tl.fromTo(foodEl,
                                        { xPercent: -50, yPercent: -50, y: 20, scale: 0, opacity: 0 },
                                        { y: 0, scale: 1, opacity: 1, duration: 0.38, ease: 'back.out(1.7)' },
                                        0.1
                                    );

                                    // Yemek hafifçe zıplar
                                    tl.to(foodEl, { y: -7, duration: 0.18, ease: 'power1.out' });

                                    // Yemek düşer ve solar
                                    tl.to(foodEl, { y: 20, scale: 0.4, opacity: 0, duration: 0.28, ease: 'power3.in' });

                                    // Sepet soldan kayar
                                    tl.fromTo(cartEl,
                                        { xPercent: -50, yPercent: -50, x: -60, opacity: 0 },
                                        { x: 0, opacity: 1, duration: 0.28, ease: 'power2.out' },
                                        '-=0.08'
                                    );

                                    // Tik çizilir
                                    if (tickEl) {
                                        tl.to(tickEl, { strokeDashoffset: 0, duration: 0.22, ease: 'none' }, '+=0.05');
                                    }

                                    // Sepet hafif zıplar
                                    tl.to(cartEl, { y: 3, duration: 0.09 });
                                    tl.to(cartEl, { y: 0, duration: 0.14, ease: 'elastic.out(1, 0.5)' });

                                    // Sepet sağa kayar
                                    tl.to(cartEl, { x: 60, opacity: 0, duration: 0.22, ease: 'power2.in' }, '+=0.4');

                                    // "Eklendi!" yazısı belirir - önce metni değiştir (label hâlâ opacity:0), sonra göster
                                    tl.call(function() { lbl.textContent = 'Eklendi! \u2713'; });
                                    tl.to(lbl, { opacity: 1, x: 0, duration: 0.2, ease: 'power2.out' });

                                    // Kısa bekleme sonra sıfırla
                                    tl.to({}, { duration: 0.85 });
                                    tl.call(function() {
                                        lbl.textContent = 'Sepete Ekle';
                                        gsap.set(foodEl, { xPercent: -50, yPercent: -50, y: 20, scale: 0, opacity: 0 });
                                        gsap.set(cartEl, { xPercent: -50, yPercent: -50, x: -60, opacity: 0 });
                                        if (tickEl) gsap.set(tickEl, { strokeDashoffset: 10 });
                                        gsap.set(lbl, { x: 0, opacity: 1 });
                                    });
                                }
                            } else {
                                // GSAP yoksa basit geri bildirim
                                var lbl = button.querySelector('.btn-label') || button;
                                var origContent = lbl.textContent;
                                lbl.textContent = 'Eklendi!';
                                button.disabled = true;
                                setTimeout(function() {
                                    lbl.textContent = origContent;
                                    button.disabled = false;
                                }, 1000);
                            }
                        }
                    });
                }
            });
        }, 100);
        
    } catch (error) {
        console.error('Menü yüklenirken hata:', error);
        const menuContent = document.getElementById('menu-content');
        if (menuContent) {
            menuContent.innerHTML = '<p style="text-align: center; padding: 2rem; color: red;">Menü yüklenirken bir hata oluştu.</p>';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('seller-name')) {
        loadSellerProfile();
        
        // Socket.io ile anlık menü güncellemesi (F5'siz)
        if (typeof io !== 'undefined') {
            const socket = io();
            const currentSellerId = getSellerIdFromUrl();
            socket.on('menu_updated', (data) => {
                if (data && data.sellerId && String(data.sellerId) === String(currentSellerId)) {
                    console.log('🔄 Satıcı paneli üzerinden menü güncellendi, liste yeniden yükleniyor...');
                    loadSellerProfile(); // Sadece veriyi çeker ve içeriği günceller, sayfa atlamaz.
                }
            });
        }
    }
});

