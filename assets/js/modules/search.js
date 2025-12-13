document.addEventListener('DOMContentLoaded', () => {
    // URL'den query parametresini oku (ana sayfadan gelen arama terimi)
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');
    
    // Eğer query parametresi varsa, location input'una yaz
    const locationInput = document.getElementById('location');
    if (searchQuery && locationInput) {
        locationInput.value = searchQuery;
        // Arama terimini location filtresi olarak kullan
        // loadSellers fonksiyonu otomatik olarak location input'unu okuyacak
    }
    
    // Sayfa yüklendiğinde satıcıları yükle (query parametresi varsa otomatik filtreler)
    loadSellers();
    
    const applyFiltersButton = document.querySelector('.search-filters .btn-primary');

    if (applyFiltersButton) {
        applyFiltersButton.addEventListener('click', (event) => {
            event.preventDefault(); 
            loadSellers(getFilterValues());
        });
    }

    const sortBySelect = document.getElementById('sort-by');
    if (sortBySelect) {
        sortBySelect.addEventListener('change', () => {
            loadSellers(getFilterValues());
        });
    }

    // Konum input'una anlık arama ekle (Enter tuşu veya değişiklik)
    // locationInput zaten yukarıda tanımlandı
    if (locationInput) {
        let searchTimeout;
        locationInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadSellers(getFilterValues());
            }, 500); // 500ms bekle, sonra ara
        });

        locationInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(searchTimeout);
                loadSellers(getFilterValues());
            }
        });
    }

    // Rating checkbox'larına event listener ekle
    const rateCheckboxes = ['rate-4', 'rate-3'];
    rateCheckboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                // Diğer rating checkbox'ını kapat (sadece birini seç)
                rateCheckboxes.forEach(otherId => {
                    if (otherId !== id) {
                        const otherCheckbox = document.getElementById(otherId);
                        if (otherCheckbox) {
                            otherCheckbox.checked = false;
                        }
                    }
                });
                loadSellers(getFilterValues());
            });
        }
    });

    // Mutfak türü checkbox'larına event listener ekle
    const cuisineCheckboxes = ['cuisine-tr', 'cuisine-it', 'cuisine-vegan'];
    cuisineCheckboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                loadSellers(getFilterValues());
            });
        }
    });
});

// ------------------------------------------------------------------------

/**
 * Yardımcı Fonksiyon: HTML Sayfasından Filtre Değerlerini Okur
 * @returns {Object} Toplanan filtre değerlerini içeren nesne.
 */
function getFilterValues() {
    const filters = {};

    // 1. Konum (Input Text) Değerini Oku
    const locationInput = document.getElementById('location');
    filters.location = locationInput ? locationInput.value.trim() : '';

    // 2. Puana Göre (Checkbox Grubu) Değerlerini Oku
    if (document.getElementById('rate-4')?.checked) {
        filters.minRating = 4;
    } else if (document.getElementById('rate-3')?.checked) {
        filters.minRating = 3;
    } else {
        filters.minRating = null;
    }

    // 3. Mutfak Türü (Checkbox Grubu) Değerlerini Oku
    const cuisineCheckboxes = [
        { id: 'cuisine-tr', value: 'Türk Mutfağı' },
        { id: 'cuisine-it', value: 'İtalyan' },
        { id: 'cuisine-vegan', value: 'Vegan' }
    ];

    filters.cuisines = [];
    cuisineCheckboxes.forEach(item => {
        const checkbox = document.getElementById(item.id);
        if (checkbox && checkbox.checked) {
            filters.cuisines.push(item.value);
        }
    });

    // 4. Sıralama (Select Dropdown) Değerini Oku
    const sortBySelect = document.getElementById('sort-by');
    filters.sortBy = sortBySelect ? sortBySelect.value : 'default';
    
    return filters;
}

// ------------------------------------------------------------------------

/**
 * 🔄 Ana Fonksiyon: Satıcıları API'den Yükler ve Ekrana Basar
 * @param {Object} filters - Filtre değerlerini içeren nesne
 */
async function loadSellers(filters = {}) {
	// Gerekli DOM elemanlarını bul
	const resultsList = document.getElementById('search-results-list');
	const resultsHeaderSpan = document.querySelector('.results-header span strong');

	if (!resultsList) return;

	// Yükleniyor durumunu göster
	resultsList.innerHTML = '<p class="loading-text" style="grid-column: 1 / -1; text-align: center;">Satıcılar yükleniyor...</p>';

	try {
		// 🚀 api.js dosyasından gelen searchSellers fonksiyonunu çağır
		let sellers = await window.searchSellers(filters);

		// Frontend'de mutfak türü filtresini uygula (backend'de yok)
		if (filters.cuisines && filters.cuisines.length > 0) {
			sellers = sellers.filter(seller => {
				const sellerText = ((seller.name || '') + ' ' + (seller.description || '')).toLowerCase();
				
				return filters.cuisines.some(cuisine => {
					const cuisineLower = cuisine.toLowerCase();
					
					// Türk Mutfağı
					if (cuisineLower.includes('türk')) {
						return sellerText.includes('türk') || 
						       sellerText.includes('kebap') || 
						       sellerText.includes('mantı') || 
						       sellerText.includes('fasulye') ||
						       sellerText.includes('lahmacun') ||
						       sellerText.includes('börek') ||
						       sellerText.includes('döner');
					}
					
					// İtalyan
					if (cuisineLower.includes('italyan')) {
						return sellerText.includes('italyan') || 
						       sellerText.includes('pizza') || 
						       sellerText.includes('pasta') || 
						       sellerText.includes('carbonara') ||
						       sellerText.includes('arrabbiata') ||
						       sellerText.includes('margherita');
					}
					
					// Vegan
					if (cuisineLower.includes('vegan')) {
						return sellerText.includes('vegan') || 
						       sellerText.includes('bitkisel') ||
						       sellerText.includes('vejetaryen');
					}
					
					return false;
				});
			});
		}

		// Sıralama uygula
		if (filters.sortBy === 'rating') {
			sellers.sort((a, b) => (b.rating || 0) - (a.rating || 0));
		} else if (filters.sortBy === 'distance') {
			// Şimdilik distance yok, varsayılan sıralama (rating'e göre)
			sellers.sort((a, b) => (b.rating || 0) - (a.rating || 0));
		} else {
			// Varsayılan: rating'e göre sırala
			sellers.sort((a, b) => (b.rating || 0) - (a.rating || 0));
		}

		// Sonuçları ekrana bas - index.html ile aynı tasarım
		resultsList.innerHTML = ''; // Temizle
		if (sellers.length === 0) {
			resultsList.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 3rem;"><p style="font-size: 1.2rem; color: #666; margin-bottom: 1rem;">Filtrelere uygun satıcı bulunamadı.</p><p style="color: #999;">Filtreleri değiştirerek tekrar deneyin.</p></div>';
		} else {
			// Güzel kartlar oluştur
			resultsList.innerHTML = sellers.map(seller => createSellerCard(seller)).join('');
			
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
		}

		// Başlık sayısını güncelle
		if (resultsHeaderSpan) {
			resultsHeaderSpan.textContent = sellers.length;
		}

	} catch (error) {
		console.error("Satıcıları yüklerken hata oluştu:", error);
		resultsList.innerHTML = '<p class="error-text" style="grid-column: 1 / -1; color: red; text-align: center;">Veriler yüklenemedi. Lütfen sunucuyu kontrol edin.</p>';
		if (resultsHeaderSpan) resultsHeaderSpan.textContent = '0';
	}
}


/**
 * 🖼️ Yardımcı Fonksiyon: Tek Bir Satıcı Kartı Oluşturur
 * @param {Object} seller - Satıcı nesnesi
 */
function createSellerCard(seller) {
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

	// Resim URL'ini kontrol et - via.placeholder.com içeriyorsa SVG placeholder kullan
	let imageUrl = seller.imageUrl;
	let usePlaceholder = false;

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

	// Kart HTML'i - index.html ile aynı tasarım
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
}