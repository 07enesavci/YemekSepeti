/* ==================================== */
/* ANA SAYFA (home.js)                  */
/* ==================================== */

/**
 * Ana sayfadaki restoranları API'den çekip gösterir
 */
async function loadRestaurants() {
        const featuredGrid = document.querySelector('#restaurants-container') || document.querySelector('.featured-grid');
    if (!featuredGrid) {
        console.warn('featured-grid bulunamadı');
        return;
    }

    // Yükleniyor mesajı göster
    featuredGrid.innerHTML = '<p style="text-align: center; padding: 2rem;">Yükleniyor...</p>';

    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const response = await fetch(`${baseUrl}/api/sellers`);
        
        if (!response.ok) {
            throw new Error('Restoranlar yüklenemedi');
        }

        const sellers = await response.json();

        // Debug: Kaç restoran geldi?
        console.log(`📦 API'den ${sellers.length} restoran geldi`);
        if (sellers.length > 0) {
            console.log(`📋 Restoranlar: ${sellers.map(s => `${s.name} (ID: ${s.id})`).join(', ')}`);
        }

        if (sellers.length === 0) {
            featuredGrid.innerHTML = '<div style="text-align: center; padding: 3rem;"><p style="font-size: 1.2rem; color: #666; margin-bottom: 1rem;">Henüz restoran bulunmamaktadır.</p><p style="color: #999;">Yakında lezzetli restoranlar eklenecek!</p></div>';
            return;
        }

        // TÜM restoranları göster - Limit yok, hepsi gösterilecek
        console.log(`🎯 ${sellers.length} restoran kartı oluşturuluyor...`);

        // Restoran kartlarını oluştur - TÜM restoranlar gösterilecek, güzel tasarım
        featuredGrid.innerHTML = sellers.map(seller => {
            // HTML escape için güvenli isim
            const safeName = (seller.name || 'Restoran')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
            
            const safeDescription = (seller.description || seller.location || 'Lezzetli ev yemekleri')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
            
            // Resim URL'ini güvenli hale getir - via.placeholder.com URL'lerini reddet
            let imageUrl = seller.imageUrl;
            let usePlaceholder = false;
            
            // via.placeholder.com içeriyorsa veya geçerli bir HTTP URL değilse, SVG placeholder kullan
            if (!imageUrl || 
                !imageUrl.startsWith('http') || 
                imageUrl.includes('via.placeholder.com') ||
                imageUrl.includes('placeholder.com') ||
                imageUrl.includes('400x200.png') ||
                imageUrl.includes('1920x400.png')) {
                usePlaceholder = true;
            }
            
            // Rating yıldızları
            const rating = parseFloat(seller.rating) || 0;
            const fullStars = Math.floor(rating);
            const hasHalfStar = rating % 1 >= 0.5;
            const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
            
            let starsHTML = '';
            for (let i = 0; i < fullStars; i++) {
                starsHTML += '<span style="color: #FFA500;">★</span>';
            }
            if (hasHalfStar) {
                starsHTML += '<span style="color: #FFA500;">☆</span>';
            }
            for (let i = 0; i < emptyStars; i++) {
                starsHTML += '<span style="color: #ddd;">★</span>';
            }
            
            // Kart HTML'i - Tıklanabilir ve güzel tasarım
            return `
            <div class="restaurant-card" data-seller-id="${seller.id}" style="cursor: pointer;">
                <div class="card-image-wrapper" style="position: relative; width: 100%; height: 220px; overflow: hidden; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                    ${usePlaceholder ? `
                        <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-size: 28px; font-weight: bold; text-align: center; padding: 20px;">
                            ${safeName}
                        </div>
                    ` : `
                        <img src="${imageUrl}" 
                             alt="${safeName}" 
                             class="card-image"
                             style="width: 100%; height: 100%; object-fit: cover;"
                             onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-size: 28px; font-weight: bold; text-align: center; padding: 20px;\\'>${safeName}</div>';">
                    `}
                    <div class="rating-badge" style="position: absolute; top: 10px; right: 10px; background: rgba(255, 255, 255, 0.95); padding: 6px 12px; border-radius: 20px; font-weight: bold; color: #333; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                        <span style="color: #FFA500;">★</span>
                        <span>${rating.toFixed(1)}</span>
                    </div>
                </div>
                <div class="card-content" style="padding: 1.5rem;">
                    <h3 class="card-title" style="margin: 0 0 0.5rem 0; font-size: 1.4rem; color: var(--secondary-color); font-weight: 700;">${safeName}</h3>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 0.75rem; flex-wrap: wrap;">
                        <span style="font-size: 0.9rem; color: #666;">${starsHTML}</span>
                        <span style="font-size: 0.85rem; color: #999;">(${seller.totalReviews || 0} değerlendirme)</span>
                    </div>
                    <p class="card-text" style="margin: 0 0 0.75rem 0; color: #666; font-size: 0.95rem; line-height: 1.5; min-height: 2.5rem;">${safeDescription}</p>
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1rem; font-size: 0.85rem; color: #888;">
                        <span>📍 ${seller.location || 'Konum belirtilmemiş'}</span>
                    </div>
                    <a href="/buyer/seller-profile/${seller.id}" 
                       class="btn btn-primary btn-full"
                       style="text-decoration: none; display: block; text-align: center;"
                       onclick="event.stopPropagation();">
                        Menüyü Gör
                    </a>
                </div>
            </div>
        `;
        }).join('');
        
        // Kartlara tıklama eventi ekle (tüm karta tıklanabilir yap)
        setTimeout(() => {
            document.querySelectorAll('.restaurant-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    // Eğer butona veya linke tıklanmadıysa
                    if (!e.target.closest('a')) {
                        const sellerId = card.getAttribute('data-seller-id');
                        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                        window.location.href = `${baseUrl}/buyer/seller-profile/${sellerId}`;
                    }
                });
            });
        }, 100);

        console.log(`✅ ${sellers.length} restoran yüklendi`);
    } catch (error) {
        console.error('Restoranlar yüklenirken hata:', error);
        featuredGrid.innerHTML = '<p style="text-align: center; padding: 2rem; color: red;">Restoranlar yüklenirken bir hata oluştu.</p>';
    }
}

/**
 * Ana sayfadaki arama fonksiyonu
 * Arama terimini alıp arama sayfasına yönlendirir
 */
function handleHeroSearch() {
    const searchInput = document.getElementById('hero-search-input');
    const searchButton = document.getElementById('hero-search-button');
    
    if (!searchInput || !searchButton) {
        return; // Ana sayfada değilsek çık
    }
    
    const performSearch = () => {
        const searchTerm = searchInput.value.trim();
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        
        if (searchTerm) {
            // Arama terimini query parametresi olarak gönder
            window.location.href = `${baseUrl}/buyer/search?q=${encodeURIComponent(searchTerm)}`;
        } else {
            // Boşsa sadece arama sayfasına git
            window.location.href = `${baseUrl}/buyer/search`;
        }
    };
    
    // Butona tıklama eventi
    searchButton.addEventListener('click', (e) => {
        e.preventDefault();
        performSearch();
    });
    
    // Enter tuşuna basma eventi
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            performSearch();
        }
    });
}

// Sayfa yüklendiğinde restoranları yükle ve arama fonksiyonunu başlat
document.addEventListener('DOMContentLoaded', () => {
    // Sadece ana sayfada çalışsın
    if (document.querySelector('.featured-grid')) {
        loadRestaurants();
    }
    
    // Arama fonksiyonunu başlat
    handleHeroSearch();
});

