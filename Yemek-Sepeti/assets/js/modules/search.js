document.addEventListener('DOMContentLoaded', () => {
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

// Yeni: Şablon önbelleği ve çoklu yol denemesiyle dinamik şablon yükleme
let _sellerTemplateCache = null;
async function getSellerTemplate() {
	// Eğer önceden yüklendiyse kullan
	if (_sellerTemplateCache) return _sellerTemplateCache;

	// Denenecek olası yollar (hangi klasörde tuttuğunuza göre ilk başarılı olan kullanılacak)
	const candidates = [
		'components/seller-card.html',
		'../../components/seller-card.html',
		'../../../components/seller-card.html',
		'/components/seller-card.html',
		'/assets/components/seller-card.html'
	];

	for (const path of candidates) {
		try {
			const res = await fetch(path, { cache: 'no-store' });
			if (res.ok) {
				_sellerTemplateCache = await res.text();
				return _sellerTemplateCache;
			}
		} catch (e) {
			// ignore ve diğer yola devam et
		}
	}

	// Eğer hiçbiri bulunamazsa hata fırlat
	throw new Error('Seller template not found in expected paths.');
}

// Şablondaki {{placeholder}} ifadelerini seller verisiyle değiştirir
function renderSellerFromTemplate(template, seller) {
	const defaultPlaceholder = "https://via.placeholder.com/400x200.png?text=Yemek+Resmi";
	const data = {
		id: seller.id ?? '',
		name: seller.name ?? 'İsimsiz Satıcı',
		imageUrl: seller.imageUrl || defaultPlaceholder,
		location: seller.location || '',
		rating: (typeof seller.rating === 'number') ? seller.rating.toFixed(1) : (seller.rating ?? ''),
		// ek alanlar gerekiyorsa buraya eklenebilir
	};

	// Basit token değişimi: {{name}}, {{imageUrl}}, {{location}}, {{rating}}, {{id}}
	return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key) => {
		return (key in data) ? data[key] : '';
	});
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
		const sellers = await window.searchSellers(filters);

		// Şablonu yükle (veya önbellekten al)
		let template = '';
		try {
			template = await getSellerTemplate();
		} catch (tplErr) {
			// Eğer şablon yüklenemezse, fallback olarak inline kart üretici kullanılabilir
			console.warn('Seller template yüklenemedi, inline fallback kullanılacak.', tplErr);
		}

		// Sonuçları ekrana bas
		if (!template) {
			// Fallback: mevcut createSellerCard fonksiyonunu kullan (eski inline HTML)
			resultsList.innerHTML = ''; // Temizle
			if (sellers.length === 0) {
				resultsList.innerHTML = '<p class="not-found-text" style="grid-column: 1 / -1; text-align: center;">Filtrelere uygun satıcı bulunamadı. 😢</p>';
			} else {
				sellers.forEach(seller => {
					resultsList.innerHTML += createSellerCard(seller);
				});
			}
		} else {
			// Şablon ile render et
			if (sellers.length === 0) {
				resultsList.innerHTML = '<p class="not-found-text" style="grid-column: 1 / -1; text-align: center;">Filtrelere uygun satıcı bulunamadı. 😢</p>';
			} else {
				const html = sellers.map(seller => renderSellerFromTemplate(template, seller)).join('');
				resultsList.innerHTML = html;
			}
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
	// NOT: Bu kısım, API'den gelen veriye göre kartı oluşturur.
	// Senin HTML'indeki statik resimler yerine, satıcının kendi verilerini kullanır.
	const defaultPlaceholder = "https://via.placeholder.com/400x200.png?text=Yemek+Resmi";

	return `
        <div class="card">
            <img src="${seller.imageUrl || defaultPlaceholder}" alt="${seller.name}" class="card-image">
            <div class="card-content">
                <div style="min-height: 80px;">
                    <h3 class="card-title">${seller.name}</h3>
                    <p class="card-text">${seller.location} - ⭐ ${seller.rating.toFixed(1)}</p>
                </div>
                <a href="../buyer/seller-profile.html?id=${seller.id}" class="btn btn-secondary btn-full">Menüyü Gör</a>
            </div>
        </div>
    `;
}