var homePageOffset = 0;
var homePageHasMore = true;
var homePageLoading = false;
var HOME_PAGE_SIZE = 24;

// Kullanıcı konum bilgisi (Geolocation)
var userLocation = { lat: null, lng: null };

// Geolocation ile konum al ve localStorage'a kaydet
function initUserGeolocation() {
    try {
        var deliveryAreaRaw = localStorage.getItem('ys_delivery_area');
        if (deliveryAreaRaw) {
            var delivery = JSON.parse(deliveryAreaRaw);
            if (delivery && delivery.lat && delivery.lng) {
                userLocation.lat = Number(delivery.lat);
                userLocation.lng = Number(delivery.lng);
            }
        }
    } catch (e) {}
    // Önce localStorage'dan kontrol et
    try {
        var saved = localStorage.getItem('ys-user-location');
        if (saved) {
            var parsed = JSON.parse(saved);
            if (parsed.lat && parsed.lng) {
                userLocation.lat = parsed.lat;
                userLocation.lng = parsed.lng;
            }
        }
    } catch (e) {}
    
    // Tarayıcıdan konum iste
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                userLocation.lat = position.coords.latitude;
                userLocation.lng = position.coords.longitude;
                try {
                    localStorage.setItem('ys-user-location', JSON.stringify(userLocation));
                } catch (e) {}
                // Konum güncellendi, restoranları yeniden yükle
                var grid = document.querySelector('#restaurants-container') || document.querySelector('.featured-grid');
                if (grid && allRestaurants.length > 0) {
                    loadRestaurants(false);
                }
            },
            function() {
                /* İzin yoksa elle adres akışı kullanılır; konsolu kirletme. */
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
    }
}

async function loadRestaurants(append) {
    const featuredGrid = document.querySelector('#restaurants-container') || document.querySelector('.featured-grid');
    if (!featuredGrid) return;
    if (!append) {
        featuredGrid.innerHTML = '<p style="text-align: center; padding: 2rem;">Yükleniyor...</p>';
        allRestaurants = [];
        homePageOffset = 0;
        homePageHasMore = true;
    }
    if (homePageLoading) return;
    homePageLoading = true;
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        let apiUrl = baseUrl + '/api/sellers?limit=' + HOME_PAGE_SIZE + '&offset=' + (append ? homePageOffset : 0);
        // Kullanıcı konumunu ekle
        if (userLocation.lat && userLocation.lng) {
            apiUrl += '&userLat=' + userLocation.lat + '&userLng=' + userLocation.lng;
        }
        const response = await fetch(apiUrl, { credentials: 'same-origin' });
        if (!response.ok) {
            let msg = 'Restoranlar yüklenemedi (HTTP ' + response.status + ').';
            try {
                const errBody = await response.json();
                if (errBody && errBody.message) msg = errBody.message;
            } catch (e) {}
            throw new Error(msg);
        }
        const data = await response.json();
        let sellers = (data && data.sellers && Array.isArray(data.sellers)) ? data.sellers : (Array.isArray(data) ? data : (data && data.data && Array.isArray(data.data) ? data.data : []));
        homePageHasMore = !!(data && data.hasMore);
        if (!append && sellers.length === 0) {
            featuredGrid.innerHTML = '<div style="text-align: center; padding: 3rem;"><p style="font-size: 1.2rem; color: #666;">Henüz restoran bulunmamaktadır.</p></div>';
            homePageLoading = false;
            return;
        }
        if (append) {
            allRestaurants = allRestaurants.concat(sellers);
        } else {
            allRestaurants = sellers;
            loadCouponSellerIds().then(function() { applyQuickFilterButtons(); });
        }
        homePageOffset = allRestaurants.length;
        if (window.__userRole === 'buyer' && typeof window.getFavorites === 'function') {
            window.getFavorites().then(function(favs) {
                favoriteSellerIds = (favs || []).map(function(f) { return f.id; });
                filterAndDisplayRestaurants(append);
            }).catch(function() { filterAndDisplayRestaurants(append); });
        } else {
            filterAndDisplayRestaurants(append);
        }
        setupLazyLoadSentinel();
    } catch (error) {
        if (!append) {
            var errMsg = (error && error.message) ? error.message : 'Restoranlar yüklenirken bir hata oluştu.';
            featuredGrid.innerHTML = '<div style="text-align: center; padding: 2rem;"><p style="color: #c0392b; margin-bottom: 1rem;">' + errMsg + '</p><button type="button" class="btn-retry-restaurants" style="padding: 0.5rem 1rem; cursor: pointer;">Tekrar Dene</button></div>';
            var btn = featuredGrid.querySelector('.btn-retry-restaurants');
            if (btn) btn.addEventListener('click', function() { loadRestaurants(false); });
        }
    }
    homePageLoading = false;
}

function setupLazyLoadSentinel() {
    var sentinel = document.getElementById('home-lazy-sentinel');
    if (!sentinel && homePageHasMore) {
        var grid = document.querySelector('#restaurants-container') || document.querySelector('.featured-grid');
        if (!grid) return;
        sentinel = document.createElement('div');
        sentinel.id = 'home-lazy-sentinel';
        sentinel.style.cssText = 'height: 40px; display: flex; align-items: center; justify-content: center;';
        sentinel.innerHTML = '<span style="color: #999;">Yükleniyor...</span>';
        grid.parentElement && grid.parentElement.appendChild(sentinel);
    }
    if (!sentinel) return;
    if (!homePageHasMore) {
        sentinel.innerHTML = '';
        sentinel.style.display = 'none';
        return;
    }
    sentinel.style.display = 'flex';
    sentinel.innerHTML = '<span style="color: #999;">Daha fazla yükleniyor...</span>';
    var io = window._homeLazyIO;
    if (io) io.disconnect();
    io = new IntersectionObserver(function(entries) {
        if (!entries[0] || !entries[0].isIntersecting || homePageLoading || !homePageHasMore) return;
        loadRestaurants(true);
    }, { rootMargin: '200px', threshold: 0 });
    io.observe(sentinel);
    window._homeLazyIO = io;
}

let allRestaurants = [];
let favoriteSellerIds = [];
let sellerIdsWithCoupons = new Set();
let currentFilters = {
    searchTerm: '',
    minRating: 0,
    cuisines: [],
    minOrderAmount: null,
    location: '',
    quickFilter: 'all'
};

function handleHeroSearch() {
    const searchInput = document.getElementById('hero-search-input');
    const searchButton = document.getElementById('hero-search-button');
    
    if (!searchInput || !searchButton) {
        return;
    }
    
    const SEARCH_HISTORY_KEY = 'ys-search-history';
    const SEARCH_HISTORY_MAX = 8;

    function getSearchHistory() {
        try {
            const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }
    function saveSearchToHistory(term) {
        if (!term || term.length < 2) return;
        let arr = getSearchHistory();
        arr = arr.filter(function (t) { return t !== term; });
        arr.unshift(term);
        arr = arr.slice(0, SEARCH_HISTORY_MAX);
        try { localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(arr)); } catch (e) {}
    }
    function renderSearchHistory() {
        const dropdown = document.getElementById('search-history-dropdown');
        if (!dropdown) return;
        const list = getSearchHistory();
        if (list.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        dropdown.innerHTML = list.map(function (term) {
            return '<button type="button" role="option" class="search-history-item" data-term="' + term.replace(/"/g, '&quot;') + '">' + term.replace(/</g, '&lt;') + '</button>';
        }).join('');
        dropdown.style.display = 'block';
        dropdown.querySelectorAll('.search-history-item').forEach(function (btn) {
            btn.addEventListener('click', function () {
                searchInput.value = this.getAttribute('data-term') || '';
                currentFilters.searchTerm = searchInput.value;
                filterAndDisplayRestaurants();
                dropdown.style.display = 'none';
            });
        });
    }

    const performSearch = function () {
        const searchTerm = searchInput.value.trim();
        currentFilters.searchTerm = searchTerm;
        if (searchTerm) saveSearchToHistory(searchTerm);
        filterAndDisplayRestaurants();
        document.getElementById('search-history-dropdown') && (document.getElementById('search-history-dropdown').style.display = 'none');
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
    searchInput.addEventListener('focus', function () {
        renderSearchHistory();
    });
    searchInput.addEventListener('blur', function () {
        setTimeout(function () {
            var d = document.getElementById('search-history-dropdown');
            if (d) d.style.display = 'none';
        }, 200);
    });
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performSearch();
        }, 300);
    });
}

function loadCouponSellerIds() {
    var baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
    return fetch(baseUrl + '/api/buyer/coupons/active', { credentials: 'include' })
        .then(function(r) { return r.ok ? r.json() : { success: false }; })
        .then(function(data) {
            sellerIdsWithCoupons = new Set();
            var list = (data && data.coupons) ? data.coupons : [];
            list.forEach(function(c) {
                var ids = c.applicableSellerIds || c.applicable_seller_ids || c.sellerIds;
                if (Array.isArray(ids) && ids.length > 0) ids.forEach(function(id) { sellerIdsWithCoupons.add(parseInt(id, 10)); });
                else allRestaurants.forEach(function(r) { sellerIdsWithCoupons.add(parseInt(r.id, 10)); });
            });
        })
        .catch(function() {});
}

function applyQuickFilterButtons() {
    document.querySelectorAll('.quick-filter-btn').forEach(function(btn) {
        btn.classList.toggle('active', (btn.getAttribute('data-filter') || '') === currentFilters.quickFilter);
        btn.onclick = function() {
            currentFilters.quickFilter = btn.getAttribute('data-filter') || 'all';
            document.querySelectorAll('.quick-filter-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            filterAndDisplayRestaurants();
        };
    });
}

function applyQuickFilterFromUrl() {
    try {
        var params = new URLSearchParams(window.location.search || '');
        var qf = (params.get('quickFilter') || '').trim();
        if (!qf) return;
        var allowed = ['all', 'discount', 'new', 'top_rated', 'deals'];
        if (allowed.indexOf(qf) === -1) return;
        currentFilters.quickFilter = qf;
    } catch (e) {}
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
                location: '',
                quickFilter: 'all'
            };
            document.querySelectorAll('.quick-filter-btn').forEach(function(b) {
                b.classList.toggle('active', (b.getAttribute('data-filter') || '') === 'all');
            });
            filterAndDisplayRestaurants();
        });
    }
}

function filterAndDisplayRestaurants(append) {
    append = !!append;
    if (allRestaurants.length === 0) {
        return;
    }

    let list = allRestaurants.slice();
    var q = currentFilters.quickFilter || 'all';
    if (q === 'discount' && sellerIdsWithCoupons.size > 0) {
        list = list.filter(function(r) { return sellerIdsWithCoupons.has(parseInt(r.id, 10)); });
    } else if (q === 'new') {
        list.sort(function(a, b) {
            var da = (a.created_at || a.createdAt) ? new Date(a.created_at || a.createdAt).getTime() : 0;
            var db = (b.created_at || b.createdAt) ? new Date(b.created_at || b.createdAt).getTime() : 0;
            return db - da;
        });
    } else if (q === 'top_rated') {
        list.sort(function(a, b) {
            var ra = parseFloat(a.rating) || 0;
            var rb = parseFloat(b.rating) || 0;
            if (rb !== ra) return rb - ra;
            var ca = parseInt(a.review_count || a.reviewCount, 10) || 0;
            var cb = parseInt(b.review_count || b.reviewCount, 10) || 0;
            return cb - ca;
        });
    } else if (q === 'deals') {
        list = list.filter(function(r) { return sellerIdsWithCoupons.has(parseInt(r.id, 10)); });
        if (list.length === 0) list = allRestaurants.slice();
    }
    
    let filtered = list.filter(restaurant => {
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
    
    var grid = document.querySelector('#restaurants-container') || document.querySelector('.featured-grid');
    var prevCount = grid ? grid.querySelectorAll('.restaurant-card').length : 0;
    var toShow = append && prevCount > 0 ? filtered.slice(prevCount) : filtered;
    displayRestaurants(toShow, append);
    
    const resultsHeader = document.getElementById('results-header');
    const resultsCount = document.getElementById('results-count');
    if (resultsHeader && resultsCount) {
        if (currentFilters.searchTerm || currentFilters.minRating > 0 || currentFilters.cuisines.length > 0 || 
            currentFilters.minOrderAmount !== null || currentFilters.location || (currentFilters.quickFilter && currentFilters.quickFilter !== 'all')) {
            resultsHeader.style.display = 'flex';
            resultsCount.textContent = filtered.length;
        } else {
            resultsHeader.style.display = 'none';
        }
    }
}

function displayRestaurants(sellers, append) {
    const featuredGrid = document.querySelector('#restaurants-container') || document.querySelector('.featured-grid');
    if (!featuredGrid) return;
    var sentinel = document.getElementById('home-lazy-sentinel');
    if (sentinel && sentinel.parentNode) sentinel.parentNode.removeChild(sentinel);
    if (sellers.length === 0 && !append) {
        featuredGrid.innerHTML = '<div style="text-align: center; padding: 3rem;"><p style="font-size: 1.2rem; color: #666;">Aradığınız kriterlere uygun restoran bulunamadı.</p></div>';
        return;
    }
    var html = sellers.map(seller => {
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
        
        const isFavorite = window.__userRole === 'buyer' && favoriteSellerIds.indexOf(seller.id) !== -1;
        const heartBtn = window.__userRole === 'buyer' ? `
            <button type="button" class="favorite-heart-btn" data-seller-id="${seller.id}" onclick="event.preventDefault(); event.stopPropagation();" style="position: absolute; top: 10px; left: 10px; width: 36px; height: 36px; border-radius: 50%; border: none; background: rgba(255,255,255,0.9); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; z-index: 2;">${isFavorite ? '❤️' : '🤍'}</button>
        ` : '';
        
        return `
            <div class="restaurant-card" data-seller-id="${seller.id}" style="cursor: pointer;" role="article">
                <div class="card-image-wrapper" style="position: relative; width: 100%; height: 220px; overflow: hidden; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                    ${heartBtn}
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
                    <div class="rating-badge" style="position: absolute; top: 10px; right: 10px; background: rgba(255, 255, 255, 0.95); padding: 6px 12px; border-radius: 20px; font-weight: bold; color: #333; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 2;">
                        <span style="color: #FFA500;">★</span>
                        <span>${rating.toFixed(1)}</span>
                    </div>
                    ${seller.isOpen === false ? `<div style="position: absolute; top:0; left:0; right:0; bottom:0; background: rgba(0,0,0,0.6); z-index: 10; display:flex; align-items:center; justify-content:center; color:white; font-size:24px; font-weight:bold;">KAPALI</div>` : ''}
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
                        ${seller.distance !== null && seller.distance !== undefined ? `<span style="background: rgba(59, 130, 246, 0.1); color: #2563eb; padding: 2px 8px; border-radius: 12px; font-weight: 600; font-size: 0.8rem;">📏 ${seller.distance < 1 ? (seller.distance * 1000).toFixed(0) + ' m' : seller.distance.toFixed(1) + ' km'}</span>` : ''}
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
    if (append) featuredGrid.insertAdjacentHTML('beforeend', html); else featuredGrid.innerHTML = html;
    
    setTimeout(function() {
        document.querySelectorAll('.restaurant-card').forEach(function(card) {
            card.addEventListener('click', function(e) {
                if (!e.target.closest('a') && !e.target.closest('.favorite-heart-btn')) {
                    const sellerId = card.getAttribute('data-seller-id');
                    const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                    window.location.href = baseUrl + '/buyer/seller-profile/' + sellerId;
                }
            });
        });
        document.querySelectorAll('.favorite-heart-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                var sellerId = parseInt(this.getAttribute('data-seller-id'), 10);
                if (!sellerId || typeof window.addFavorite !== 'function') return;
                var isFav = favoriteSellerIds.indexOf(sellerId) !== -1;
                if (isFav) {
                    window.removeFavorite(sellerId).then(function() {
                        favoriteSellerIds = favoriteSellerIds.filter(function(id) { return id !== sellerId; });
                        btn.textContent = '🤍';
                    });
                } else {
                    window.addFavorite(sellerId).then(function() {
                        favoriteSellerIds.push(sellerId);
                        btn.textContent = '❤️';
                    });
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
            item.style.cursor = 'pointer';
            item.addEventListener('click', () => {
                const couponCode = item.getAttribute('data-coupon-code') || '';
                const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                var target = `${baseUrl}/?quickFilter=discount`;
                if (couponCode) target += `&coupon=${encodeURIComponent(couponCode)}`;
                window.location.href = target;
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
        const response = await fetch(`${baseUrl}/api/sellers`, { credentials: 'same-origin' });
        
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
    const host = String(window.location.hostname || '').toLowerCase();
    if (host === 'partner.localhost' || host === 'admin.localhost') {
        return;
    }
    // Kullanıcı konumunu başlat
    initUserGeolocation();
    
    if (document.querySelector('.featured-grid')) {
        applyQuickFilterFromUrl();
        loadRestaurants();
        loadHeroSlider();
        
        initFilters();
    }
    document.addEventListener('ys-delivery-area-updated', function (e) {
        if (!e || !e.detail) return;
        const d = e.detail;
        if (d.lat != null && d.lng != null && !Number.isNaN(Number(d.lat)) && !Number.isNaN(Number(d.lng))) {
            userLocation.lat = Number(d.lat);
            userLocation.lng = Number(d.lng);
        }
        loadRestaurants(false);
    });
    
    handleHeroSearch();
    
    initPromotionsBanner();
});

