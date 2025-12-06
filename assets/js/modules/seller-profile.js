/* ==================================== */
/* SATICI PROFİLİ (seller-profile.js)  */
/* ==================================== */

/**
 * URL'den seller ID'yi alır
 */
function getSellerIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

/**
 * Satıcı bilgilerini API'den çekip gösterir
 */
async function loadSellerProfile() {
    const sellerId = getSellerIdFromUrl();
    
    if (!sellerId) {
        console.error('Satıcı ID bulunamadı');
        document.querySelector('.seller-header').innerHTML = '<p style="padding: 2rem; text-align: center; color: red;">Satıcı bulunamadı.</p>';
        return;
    }

    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        
        // Satıcı bilgilerini çek
        const sellerResponse = await fetch(`${baseUrl}/api/sellers/${sellerId}`);
        if (!sellerResponse.ok) {
            throw new Error('Satıcı bilgileri yüklenemedi');
        }
        const seller = await sellerResponse.json();

        // Satıcı bilgilerini göster
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
            // Logo URL'ini kontrol et - via.placeholder.com içeriyorsa SVG placeholder kullan
            let logoUrl = seller.imageUrl;
            if (!logoUrl || 
                !logoUrl.startsWith('http') || 
                logoUrl.includes('via.placeholder.com') ||
                logoUrl.includes('placeholder.com')) {
                const sellerName = (seller.name || 'Satıcı').substring(0, 15);
                logoUrl = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#667eea"/><text x="50%" y="50%" font-family="Arial" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">${sellerName}</text></svg>`)}`;
            }
            sellerLogoEl.src = logoUrl;
            sellerLogoEl.alt = seller.name || 'Satıcı Logosu';
            // onerror handler - sonsuz döngüyü önle
            sellerLogoEl.onerror = function() {
                this.onerror = null; // Sonsuz döngüyü önle
                const sellerName = (seller.name || 'Satıcı').substring(0, 15);
                this.src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#667eea"/><text x="50%" y="50%" font-family="Arial" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">${sellerName}</text></svg>`)}`;
            };
        }
        
        if (sellerBannerEl) {
            // Banner URL'ini kontrol et - via.placeholder.com içeriyorsa SVG placeholder kullan
            let bannerUrl = seller.bannerUrl;
            if (!bannerUrl || 
                !bannerUrl.startsWith('http') || 
                bannerUrl.includes('via.placeholder.com') ||
                bannerUrl.includes('placeholder.com')) {
                const sellerName = (seller.name || 'Satıcı').substring(0, 30);
                bannerUrl = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="400"><rect width="1920" height="400" fill="#764ba2"/><text x="50%" y="50%" font-family="Arial" font-size="48" fill="white" text-anchor="middle" dominant-baseline="middle">${sellerName}</text></svg>`)}`;
            }
            sellerBannerEl.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.1), rgba(0,0,0,0.4)), url(${bannerUrl})`;
        }

        // Menüyü çek
        await loadSellerMenu(sellerId);
        
    } catch (error) {
        console.error('Satıcı profili yüklenirken hata:', error);
        document.querySelector('.seller-header').innerHTML = '<p style="padding: 2rem; text-align: center; color: red;">Satıcı bilgileri yüklenirken bir hata oluştu.</p>';
    }
}

/**
 * Satıcı menüsünü API'den çekip gösterir
 */
async function loadSellerMenu(sellerId) {
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const menuResponse = await fetch(`${baseUrl}/api/sellers/${sellerId}/menu`);
        
        if (!menuResponse.ok) {
            throw new Error('Menü yüklenemedi');
        }
        
        const menu = await menuResponse.json();
        const menuContent = document.getElementById('menu-content');
        
        if (!menuContent) {
            console.warn('menu-content bulunamadı');
            return;
        }

        if (menu.length === 0) {
            menuContent.innerHTML = '<p style="text-align: center; padding: 2rem;">Henüz menü eklenmemiş.</p>';
            return;
        }

        // Kategorilere göre grupla
        const menuByCategory = {};
        menu.forEach(item => {
            if (!menuByCategory[item.category]) {
                menuByCategory[item.category] = [];
            }
            menuByCategory[item.category].push(item);
        });

        // Menüyü göster
        let menuHTML = '';
        for (const [category, items] of Object.entries(menuByCategory)) {
            menuHTML += `
                <h3 class="category-title" style="margin-top: 2rem; margin-bottom: 1rem; font-size: 1.5rem; color: var(--secondary-color);">${category}</h3>
                <div class="menu-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
            `;
            
            items.forEach(item => {
                // HTML escape için güvenli isim
                const safeItemName = (item.name || 'Yemek')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
                
                // Resim URL'ini kontrol et - via.placeholder.com içeriyorsa SVG placeholder kullan
                let itemImageUrl = item.imageUrl;
                if (!itemImageUrl || 
                    !itemImageUrl.startsWith('http') || 
                    itemImageUrl.includes('via.placeholder.com') ||
                    itemImageUrl.includes('placeholder.com')) {
                    const itemName = (item.name || 'Yemek').substring(0, 20);
                    itemImageUrl = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="250" height="150"><rect width="250" height="150" fill="#f0f0f0"/><text x="50%" y="50%" font-family="Arial" font-size="18" fill="#666" text-anchor="middle" dominant-baseline="middle">${itemName}</text></svg>`)}`;
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
        
        // Sepete ekle butonlarına event listener ekle
        setTimeout(function() {
            var addToCartButtons = menuContent.querySelectorAll('button[onclick*="addToCart"]');
            addToCartButtons.forEach(function(button) {
                var onclickAttr = button.getAttribute('onclick');
                if (onclickAttr) {
                    // onclick attribute'unu kaldır ve event listener ekle
                    button.removeAttribute('onclick');
                    button.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        // onclick içindeki parametreleri parse et
                        var match = onclickAttr.match(/addToCart\((\d+),\s*(\d+)(?:,\s*(\d+))?\)/);
                        if (match) {
                            var mealId = parseInt(match[1]);
                            var sellerId = parseInt(match[2]);
                            var quantity = match[3] ? parseInt(match[3]) : 1;
                            addToCart(mealId, sellerId, quantity);
                            
                            // Buton feedback
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

// Sayfa yüklendiğinde satıcı profilini yükle
document.addEventListener('DOMContentLoaded', () => {
    // Sadece seller-profile sayfasında çalışsın
    if (document.getElementById('seller-name')) {
        loadSellerProfile();
    }
});

