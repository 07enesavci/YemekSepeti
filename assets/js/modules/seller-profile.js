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
            sellerNameEl.textContent = seller.name || 'Satıcı Adı';
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

        await loadSellerMenu(sellerId);
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

async function loadSellerMenu(sellerId) {
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
                
                menuHTML += `
                    <div class="menu-item" style="background: var(--card-bg); border-radius: var(--border-radius); padding: 1rem; box-shadow: var(--card-shadow);">
                        <div style="position: relative; width: 100%; height: 150px; overflow: hidden; border-radius: 8px; margin-bottom: 0.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                            <img src="${itemImageUrl}" 
                                 alt="${safeItemName}" 
                                 style="width: 100%; height: 100%; object-fit: cover;"
                                 onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; color: white; font-size: 18px; font-weight: bold; text-align: center; padding: 10px;">${safeItemName}</div>
                        </div>
                        <h4 style="margin: 0.5rem 0; font-size: 1.1rem; color: var(--secondary-color);">${safeItemName}</h4>
                        <p style="margin: 0.5rem 0; color: var(--secondary-color-light); font-size: 0.9rem;">${(item.description || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
                        <p style="margin: 0.5rem 0; font-size: 1.2rem; font-weight: bold; color: var(--primary-color);">${parseFloat(item.price || 0).toFixed(2)} ₺</p>
                        <button class="btn btn-primary btn-full" onclick="addToCart(${item.id}, ${sellerId}, 1)" style="margin-top: 0.5rem;">Sepete Ekle</button>
                    </div>
                `;
            });
            
            menuHTML += '</div>';
        }

        menuContent.innerHTML = menuHTML;
        
        // Inline onclick yerine modern event listener kullan
        setTimeout(function() {
            var addToCartButtons = menuContent.querySelectorAll('button[onclick*="addToCart"]');
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
                            var originalText = button.innerHTML;
                            button.textContent = 'Eklendi!';
                            button.disabled = true;
                            setTimeout(function() {
                                button.innerHTML = originalText;
                                button.disabled = false;
                            }, 1000);
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
    }
});

