async function loadRestaurants() {
    console.log('🚀🚀🚀 loadRestaurants VERSİYON 3.0 - Cache temizlendi! 🚀🚀🚀');
    console.log('📅 Tarih:', new Date().toISOString());
    
    const featuredGrid = document.querySelector('#restaurants-container') || document.querySelector('.featured-grid');
    if (!featuredGrid) {
        console.warn('featured-grid bulunamadı');
        return;
    }

    featuredGrid.innerHTML = '<p style="text-align: center; padding: 2rem;">Yükleniyor...</p>';

    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const apiUrl = `${baseUrl}/api/sellers`;
        console.log('🔍 API çağrısı yapılıyor:', apiUrl);
        
        const response = await fetch(apiUrl);
        
        console.log('📥 API yanıtı alındı:', response.status, response.statusText);
        
        if (!response.ok) {
            console.error('❌ API yanıt hatası:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('❌ Hata detayı:', errorText);
            throw new Error(`Restoranlar yüklenemedi: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('📦 API yanıtı alındı:', data);
        
        // API yanıtını işle - önce data.sellers kontrolü yap
        let sellers = [];
        
        if (data && data.sellers && Array.isArray(data.sellers)) {
            sellers = data.sellers;
            console.log(`✅ ${sellers.length} restoran bulundu`);
        } else if (Array.isArray(data)) {
            sellers = data;
            console.log(`✅ ${sellers.length} restoran bulundu (direkt array)`);
        } else if (data && data.data && Array.isArray(data.data)) {
            sellers = data.data;
            console.log(`✅ ${sellers.length} restoran bulundu (data.data)`);
        } else {
            console.warn('⚠️ Restoran bulunamadı, boş array kullanılıyor');
            sellers = [];
        }

        console.log(`📦 Toplam ${sellers.length} restoran işlendi`);
        
        if (sellers.length === 0) {
            console.log('⚠️ Restoran bulunamadı, boş mesaj gösteriliyor');
            featuredGrid.innerHTML = '<div style="text-align: center; padding: 3rem;"><p style="font-size: 1.2rem; color: #666; margin-bottom: 1rem;">Henüz restoran bulunmamaktadır.</p><p style="color: #999;">Yakında lezzetli restoranlar eklenecek!</p></div>';
            return;
        }

        console.log(`🎯 ${sellers.length} restoran saklanıyor...`);
        allRestaurants = sellers;
        
        console.log('🎨 Restoranlar ekrana yazdırılıyor...');
        try {
            displayRestaurants(sellers);
            console.log('✅ Restoranlar başarıyla gösterildi');
        } catch (displayError) {
            console.error('❌ displayRestaurants hatası:', displayError);
            featuredGrid.innerHTML = '<p style="text-align: center; padding: 2rem; color: red;">Restoranlar gösterilirken bir hata oluştu.</p>';
        }
    } catch (error) {
        console.error('Restoranlar yüklenirken hata:', error);
        featuredGrid.innerHTML = '<p style="text-align: center; padding: 2rem; color: red;">Restoranlar yüklenirken bir hata oluştu.</p>';
    }
}

let allRestaurants = [];
let currentFilters = {
    searchTerm: '',
    minRating: 0,
    cuisines: [],
    minOrderAmount: null,
    location: ''
};

function handleHeroSearch() {
    const searchInput = document.getElementById('hero-search-input');
    const searchButton = document.getElementById('hero-search-button');
    
    if (!searchInput || !searchButton) {
        return;
    }
    
    const performSearch = () => {
        const searchTerm = searchInput.value.trim();
        currentFilters.searchTerm = searchTerm;
        filterAndDisplayRestaurants();
    };
    
    searchButton.addEventListener('click', (e) => {
        e.preventDefault();
        performSearch();
    });
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            performSearch();
        }
    });
    
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performSearch();
        }, 300);
    });
}

function initFilters() {
    document.querySelectorAll('.filter-rating').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const checkedRatings = Array.from(document.querySelectorAll('.filter-rating:checked'))
                .map(cb => parseFloat(cb.value));
            currentFilters.minRating = checkedRatings.length > 0 ? Math.min(...checkedRatings) : 0;
            filterAndDisplayRestaurants();
        });
    });
    
    document.querySelectorAll('.filter-cuisine').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            currentFilters.cuisines = Array.from(document.querySelectorAll('.filter-cuisine:checked'))
                .map(cb => cb.value);
            filterAndDisplayRestaurants();
        });
    });
    
    const minOrderSelect = document.getElementById('filter-min-order');
    if (minOrderSelect) {
        minOrderSelect.addEventListener('change', () => {
            currentFilters.minOrderAmount = minOrderSelect.value ? parseFloat(minOrderSelect.value) : null;
            filterAndDisplayRestaurants();
        });
    }
    
    const locationInput = document.getElementById('filter-location');
    if (locationInput) {
        let locationTimeout;
        locationInput.addEventListener('input', () => {
            clearTimeout(locationTimeout);
            locationTimeout = setTimeout(() => {
                currentFilters.location = locationInput.value.trim().toLowerCase();
                filterAndDisplayRestaurants();
            }, 300);
        });
    }
    
    const clearFiltersBtn = document.getElementById('clear-filters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            document.querySelectorAll('.filter-rating, .filter-cuisine').forEach(cb => cb.checked = false);
            if (minOrderSelect) minOrderSelect.value = '';
            if (locationInput) locationInput.value = '';
            const searchInput = document.getElementById('hero-search-input');
            if (searchInput) searchInput.value = '';
            
            currentFilters = {
                searchTerm: '',
                minRating: 0,
                cuisines: [],
                minOrderAmount: null,
                location: ''
            };
            
            filterAndDisplayRestaurants();
        });
    }
}

function filterAndDisplayRestaurants() {
    if (allRestaurants.length === 0) {
        return;
    }
    
    let filtered = allRestaurants.filter(restaurant => {
        if (currentFilters.searchTerm) {
            const searchLower = currentFilters.searchTerm.toLowerCase();
            const nameMatch = (restaurant.name || '').toLowerCase().includes(searchLower);
            const descMatch = (restaurant.description || '').toLowerCase().includes(searchLower);
            if (!nameMatch && !descMatch) {
                return false;
            }
        }
        
        if (currentFilters.minRating > 0) {
            const rating = parseFloat(restaurant.rating) || 0;
            if (rating < currentFilters.minRating) {
                return false;
            }
        }
        
        if (currentFilters.cuisines.length > 0) {
            const desc = (restaurant.description || '').toLowerCase();
            const name = (restaurant.name || '').toLowerCase();
            const matchesCuisine = currentFilters.cuisines.some(cuisine => {
                const cuisineKeywords = {
                    'turkish': ['türk', 'turk', 'kebap', 'döner', 'lahmacun', 'pide', 'mantı', 'çorba', 'ev yemekleri'],
                    'italian': ['italyan', 'italian', 'pizza', 'pasta', 'makarna'],
                    'asian': ['asya', 'asian', 'sushi', 'çin', 'japon', 'thai'],
                    'vegan': ['vegan', 'bitkisel'],
                    'fastfood': ['fast food', 'burger', 'hamburger', 'köfte'],
                    'seafood': ['balık', 'fish', 'deniz', 'seafood', 'sushi']
                };
                const keywords = cuisineKeywords[cuisine] || [];
                return keywords.some(keyword => desc.includes(keyword) || name.includes(keyword));
            });
            if (!matchesCuisine) {
                return false;
            }
        }
        
        if (currentFilters.minOrderAmount !== null) {
            const minOrder = parseFloat(restaurant.minOrderAmount) || 0;
            if (minOrder > currentFilters.minOrderAmount) {
                return false;
            }
        }
        
        if (currentFilters.location) {
            const location = (restaurant.location || '').toLowerCase();
            if (!location.includes(currentFilters.location)) {
                return false;
            }
        }
        
        return true;
    });
    
    displayRestaurants(filtered);
    
    const resultsHeader = document.getElementById('results-header');
    const resultsCount = document.getElementById('results-count');
    if (resultsHeader && resultsCount) {
        if (currentFilters.searchTerm || currentFilters.minRating > 0 || currentFilters.cuisines.length > 0 || 
            currentFilters.minOrderAmount !== null || currentFilters.location) {
            resultsHeader.style.display = 'flex';
            resultsCount.textContent = filtered.length;
        } else {
            resultsHeader.style.display = 'none';
        }
    }
}

function displayRestaurants(sellers) {
    const featuredGrid = document.querySelector('#restaurants-container') || document.querySelector('.featured-grid');
    if (!featuredGrid) {
        console.warn('featured-grid bulunamadı');
        return;
    }
    
    if (sellers.length === 0) {
        featuredGrid.innerHTML = '<div style="text-align: center; padding: 3rem;"><p style="font-size: 1.2rem; color: #666; margin-bottom: 1rem;">Aradığınız kriterlere uygun restoran bulunamadı.</p><p style="color: #999;">Filtreleri değiştirerek tekrar deneyin.</p></div>';
        return;
    }
    
    featuredGrid.innerHTML = sellers.map(seller => {
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
        
        let imageUrl = seller.bannerUrl || seller.imageUrl;
        let usePlaceholder = false;
        
        const isValidUrl = (url) => {
            if (!url || typeof url !== 'string') return false;
            const trimmed = url.trim();
            if (trimmed === '') return false;
            if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                if (trimmed.includes('via.placeholder.com') || 
                    trimmed.includes('placeholder.com') ||
                    trimmed.includes('400x200.png') ||
                    trimmed.includes('1920x400.png')) {
                    return false;
                }
                return true;
            }
            if (trimmed.startsWith('/')) return true;
            return false;
        };
        
        if (!isValidUrl(imageUrl)) {
            usePlaceholder = true;
            imageUrl = null;
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
        
        return `
            <div class="restaurant-card" data-seller-id="${seller.id}" style="cursor: pointer;">
                <div class="card-image-wrapper" style="position: relative; width: 100%; height: 220px; overflow: hidden; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                    ${usePlaceholder ? `
                        <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-size: 28px; font-weight: bold; text-align: center; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                            ${safeName}
                        </div>
                    ` : `
                        <img src="${imageUrl}" 
                             alt="${safeName.replace(/'/g, '&#39;')}" 
                             class="card-image"
                             style="width: 100%; height: 100%; object-fit: cover;"
                             loading="lazy"
                             onerror="this.onerror=null; this.style.display='none'; const parent=this.parentElement; if(parent) { parent.innerHTML='<div style=\\'width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold; text-align: center; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\\'>' + this.alt.replace(/&#39;/g, '\\'') + '</div>'; }">
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
                        <a href="/buyer/seller-profile/${seller.id}?tab=reviews" 
                           class="rating-count" 
                           style="font-size: 0.85rem;"
                           onclick="event.stopPropagation();">
                            (${seller.totalReviews || 0} değerlendirme)
                        </a>
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
    
    setTimeout(() => {
        document.querySelectorAll('.restaurant-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('a')) {
                    const sellerId = card.getAttribute('data-seller-id');
                    const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                    window.location.href = `${baseUrl}/buyer/seller-profile/${sellerId}`;
                }
            });
        });
    }, 100);
}

async function loadPromotions() {
    const track = document.getElementById('promotions-track');
    if (!track) return;
    
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const response = await fetch(`${baseUrl}/api/buyer/coupons/active`);
        
        if (!response.ok) {
            throw new Error('Kuponlar yüklenemedi');
        }
        
        const data = await response.json();
        const coupons = data.coupons || [];
        
        if (coupons.length === 0) {
            return;
        }
        
        track.innerHTML = coupons.map(coupon => {
            const badge = coupon.discountType === 'percentage' 
                ? `💰 %${coupon.discountValue} İndirim`
                : `🔥 ${coupon.discountValue}TL İndirim`;
            
            let description = coupon.description || '';
            if (!description) {
                if (coupon.applicableSellerIds && coupon.applicableSellerIds.length > 0) {
                    description = `Seçili restoranlarda ${coupon.minOrderAmount > 0 ? `${coupon.minOrderAmount}TL üzerine ` : ''}${coupon.discountType === 'percentage' ? `%${coupon.discountValue}` : `${coupon.discountValue}TL`} indirim!`;
                } else {
                    description = `Tüm restoranlarda ${coupon.minOrderAmount > 0 ? `${coupon.minOrderAmount}TL üzerine ` : ''}${coupon.discountType === 'percentage' ? `%${coupon.discountValue}` : `${coupon.discountValue}TL`} indirim!`;
                }
            }
            
            return `
                <div class="promotion-item" data-coupon-code="${coupon.code}" style="cursor: pointer;">
                    <span class="promo-badge">${badge}</span>
                    <span class="promo-text">${description}</span>
                </div>
            `;
        }).join('') + coupons.map(coupon => {
            const badge = coupon.discountType === 'percentage' 
                ? `💰 %${coupon.discountValue} İndirim`
                : `🔥 ${coupon.discountValue}TL İndirim`;
            
            let description = coupon.description || '';
            if (!description) {
                if (coupon.applicableSellerIds && coupon.applicableSellerIds.length > 0) {
                    description = `Seçili restoranlarda ${coupon.minOrderAmount > 0 ? `${coupon.minOrderAmount}TL üzerine ` : ''}${coupon.discountType === 'percentage' ? `%${coupon.discountValue}` : `${coupon.discountValue}TL`} indirim!`;
                } else {
                    description = `Tüm restoranlarda ${coupon.minOrderAmount > 0 ? `${coupon.minOrderAmount}TL üzerine ` : ''}${coupon.discountType === 'percentage' ? `%${coupon.discountValue}` : `${coupon.discountValue}TL`} indirim!`;
                }
            }
            
            return `
                <div class="promotion-item" data-coupon-code="${coupon.code}" style="cursor: pointer;">
                    <span class="promo-badge">${badge}</span>
                    <span class="promo-text">${description}</span>
                </div>
            `;
        }).join('');
        
        track.querySelectorAll('.promotion-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const couponCode = item.getAttribute('data-coupon-code');
                if (couponCode) {
                    navigator.clipboard.writeText(couponCode).then(() => {
                        alert(`Kupon kodu kopyalandı: ${couponCode}\nSepet sayfasında kullanabilirsiniz!`);
                        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                        window.location.href = `${baseUrl}/buyer/cart`;
                    }).catch(() => {
                        alert(`Kupon kodu: ${couponCode}\nSepet sayfasında kullanabilirsiniz!`);
                        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                        window.location.href = `${baseUrl}/buyer/cart`;
                    });
                }
            });
        });
        
    } catch (error) {
        console.error('Kuponlar yüklenirken hata:', error);
    }
}

function initPromotionsBanner() {
    const track = document.getElementById('promotions-track');
    if (!track) return;
    
    const banner = document.querySelector('.promotions-banner');
    if (banner) {
        banner.addEventListener('mouseenter', () => {
            track.style.animationPlayState = 'paused';
        });
        
        banner.addEventListener('mouseleave', () => {
            track.style.animationPlayState = 'running';
        });
    }
}

async function loadHeroSlider() {
    const sliderContainer = document.getElementById('hero-background-slider');
    if (!sliderContainer) return;

    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const response = await fetch(`${baseUrl}/api/sellers`);
        
        if (!response.ok) {
            throw new Error('Restoranlar yüklenemedi');
        }

        const data = await response.json();
        
        let sellers;
        if (Array.isArray(data)) {
            sellers = data;
        } else if (data && Array.isArray(data.sellers)) {
            sellers = data.sellers;
        } else {
            sellers = [];
        }
        
        const sellersWithImages = sellers
            .filter(seller => {
                const bannerUrl = seller.bannerUrl || seller.imageUrl;
                if (!bannerUrl || typeof bannerUrl !== 'string') return false;
                const trimmed = bannerUrl.trim();
                if (trimmed === '') return false;
                if (trimmed.includes('via.placeholder.com') || 
                    trimmed.includes('placeholder.com') ||
                    trimmed.includes('400x200.png') ||
                    trimmed.includes('1920x400.png')) {
                    return false;
                }
                return true;
            });

        if (sellersWithImages.length === 0) {
            sliderContainer.innerHTML = '';
            return;
        }

        let sliderHTML = '';
        sellersWithImages.forEach((seller, index) => {
            const bannerUrl = seller.bannerUrl || seller.imageUrl;
            const activeClass = index === 0 ? 'active' : '';
            const safeName = (seller.name || 'Restoran')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
            sliderHTML += `
                <div class="hero-slide ${activeClass}" data-seller-id="${seller.id}">
                    <img src="${bannerUrl}" alt="${safeName}" class="hero-slide-image" loading="lazy" onerror="this.onerror=null; this.style.display='none';">
                    <div class="hero-slide-overlay"></div>
                </div>
            `;
        });
        
        sliderContainer.innerHTML = sliderHTML;

        if (sellersWithImages.length > 1) {
            let currentSlide = 0;
            const slideInterval = setInterval(() => {
                const slides = sliderContainer.querySelectorAll('.hero-slide');
                if (slides.length === 0) {
                    clearInterval(slideInterval);
                    return;
                }
                
                slides[currentSlide].classList.remove('active');
                
                currentSlide = (currentSlide + 1) % slides.length;
                
                slides[currentSlide].classList.add('active');
            }, 4000);
        }

    } catch (error) {
        console.error('Hero slider yüklenirken hata:', error);
        sliderContainer.innerHTML = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.featured-grid')) {
        loadRestaurants();
        loadHeroSlider();
        
        initFilters();
    }
    
    handleHeroSearch();
    
    initPromotionsBanner();
});

