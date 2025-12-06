/* ==================================== */
/* SAHTE BACKEND (Mock API) - TAM SÜRÜM */
/* assets/js/api.js                     */
/* Görev: Enes (SİZ)                     */
/* ==================================== */
/*
  Bu dosya, sunucu hazır olana kadar tüm ekibe
  sahte veri sağlar. Tüm fonksiyonlar, bir ağ
  isteğini taklit etmek için 'Promise' ve 
  'setTimeout' kullanır.
*/

// Gecikme süresi (milisaniye). 500ms = 0.5 saniye
const NETWORK_DELAY = 500;

// ============================================
// GLOBAL UTILITY FONKSİYONLARI
// ============================================

// Path'ten gereksiz segmentleri temizle (örn: /Yemek-Sepeti/)
window.cleanPath = function(path) {
    if (!path) return path;
    // /Yemek-Sepeti/ veya /YemekSepeti/ gibi segmentleri kaldır
    return path.replace(/^\/Yemek-Sepeti\//, '/').replace(/^\/YemekSepeti\//, '/');
};

// Yönlendirme için base URL belirleme
window.getBaseUrl = function() {
    const port = window.location.port;
    // Eğer Live Server veya başka bir dev server kullanılıyorsa Express sunucusuna yönlendir
    if (port === '5500' || port === '8080' || port === '5173' || port === '3001') {
        return 'http://localhost:3000';  // Express sunucusu
    }
    // Aynı portta çalışıyorsa (production) relative path kullan
    return '';
};

// API Base URL - Backend sunucusunun adresi
// Eğer frontend ve backend farklı portlarda çalışıyorsa, backend'in portunu buraya yazın
// Live Server (5500) veya başka bir dev server kullanılıyorsa backend portunu belirtin
const getApiBaseUrl = () => {
    return window.getBaseUrl();
};
const API_BASE_URL = getApiBaseUrl();

/* ==================================== */
/* SAHTE VERİTABANI (Mock Database)     */
/* ==================================== */

// --- Alıcıların Göreceği Veriler ---
// HATA DÜZELTMESİ: 'const' yerine 'let' kullanıldı (Silme işlemi için)
let MOCK_SELLERS = [
    { 
        id: 1, 
        name: "Ayşe'nin Mutfağı", 
        location: "Kadıköy", 
        rating: 4.9, 
        imageUrl: "https://via.placeholder.com/400x200.png?text=Ayşe'nin+Mutfağı",
        bannerUrl: "https://via.placeholder.com/1920x400.png?text=Satıcı+Banner+1"
    },
    { 
        id: 2, 
        name: "Ali'nin Kebapları", 
        location: "Beşiktaş", 
        rating: 4.7, 
        imageUrl: "https://via.placeholder.com/400x200.png?text=Ali'nin+Kebapları",
        bannerUrl: "https://via.placeholder.com/1920x400.png?text=Satıcı+Banner+2"
    },
    { 
        id: 3, 
        name: "Vegan Lezzetler", 
        location: "Moda", 
        rating: 4.8, 
        imageUrl: "https://via.placeholder.com/400x200.png?text=Vegan+Lezzetler",
        bannerUrl: "https://via.placeholder.com/1920x400.png?text=Satıcı+Banner+3"
    },
];

const MOCK_MENUS = {
    // Satıcı ID 1'in (Ayşe'nin Mutfağı) menüsü
    "1": [
        { id: 101, category: "Ana Yemekler", name: "Ev Mantısı (Porsiyon)", description: "Kayseri usulü, yoğurt ve sos ile.", price: 110.00, imageUrl: "https://via.placeholder.com/400x200.png?text=Ev+Mantısı" },
        { id: 102, category: "Ana Yemekler", name: "Kuru Fasulye", description: "Geleneksel usulde, yanında pilav ile.", price: 85.00, imageUrl: "https://via.placeholder.com/400x200.png?text=Kuru+Fasulye" },
        { id: 103, category: "Tatlılar", name: "Fırın Sütlaç", description: "Ev yapımı, bol fındıklı.", price: 60.00, imageUrl: "https://via.placeholder.com/400x200.png?text=Sütlaç" },
    ],
    // Satıcı ID 2'nin (Ali'nin Kebapları) menüsü
    "2": [
        { id: 201, category: "Kebaplar", name: "Adana Kebap", description: "Acılı, porsiyon.", price: 130.00, imageUrl: "https://via.placeholder.com/400x200.png?text=Adana+Kebap" },
        { id: 202, category: "Pide", name: "Kıymalı Pide", description: "Bol malzemeli.", price: 90.00, imageUrl: "https://via.placeholder.com/400x200.png?text=Kıymalı+Pide" },
    ],
    "3": [], // Vegan Lezzetler (henüz menü eklememiş)
};

//kuponlar burada tutulacak
let MOCK_COUPONS = [];

// --- Kullanıcı (Alıcı/Satıcı/Kurye) Verileri ---
// HATA DÜZELTMESİ: 'const' yerine 'let' kullanıldı (Silme işlemi için)
let MOCK_USERS = [
    { id: 1, email: "enes@mail.com", password: "123", role: "buyer", fullname: "Enes Avcı" },
    { id: 2, email: "ahmet@mail.com", password: "123", role: "buyer", fullname: "Ahmet Eren" },
    { id: 3, email: "satici@mail.com", password: "123", role: "seller", fullname: "Ayşe Satıcı", shopId: 1 },
    { id: 4, email: "kurye@mail.com", password: "123", role: "courier", fullname: "Şükrü Kurye" },
];

// --- Alıcıya Özel Veriler (Halit'in modülü için) ---
// HATA DÜZELTMESİ: 'const' yerine 'let' kullanıldı (Silme işlemi için)
let MOCK_ORDERS = [
    { id: 1052, userId: 1, sellerName: "Ayşe'nin Mutfağı", date: "12 Kasım 2025, 21:00", total: 259.99, status: "preparing", items: "1 x Ev Mantısı, 2 x Fırın Sütlaç" },
    { id: 1051, userId: 1, sellerName: "Ali'nin Kebapları", date: "10 Kasım 2025, 12:15", total: 85.00, status: "delivered", items: "1 x Adana Kebap" },
    { id: 1050, userId: 2, sellerName: "Vegan Lezzetler", date: "9 Kasım 2025, 17:30", total: 60.00, status: "cancelled", items: "1 x Vegan Burger" },
];

/* ==================================== */
/* API FONKSİYONLARI                    */
/* ==================================== */

/**
 * Sahte bir ağ isteği (Promise) oluşturan yardımcı fonksiyon.
 * @param {*} data - Geri döndürülecek veri.
 * @param {number} delay - Gecikme süresi (ms).
 */
function mockFetch(data, delay = NETWORK_DELAY) {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Veriyi kopyalayarak gönder (referans sorunu olmasın)
            resolve(JSON.parse(JSON.stringify(data)));
        }, delay);
    });
}

/**
 * Hata durumunu simüle eden fonksiyon.
 * @param {string} message - Hata mesajı.
 * @param {number} delay - Gecikme süresi (ms).
 */
function mockError(message, delay = NETWORK_DELAY) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            reject(new Error(message));
        }, delay);
    });
}

// ------------------------------------
// GÖREV 1: AHMET EREN (Auth & Search)
// ------------------------------------

/**
 * Kullanıcı girişini gerçek backend'e bağlar.
 * @param {string} email 
 * @param {string} password 
 */
async function loginUser(email, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include', // Session cookie'yi gönder
            body: JSON.stringify({ email, password })
        });
        
        if (!response.ok) {
            // HTTP hata durumunda
            const errorData = await response.json().catch(() => ({ message: 'Sunucu hatası' }));
            return { success: false, message: errorData.message || 'Giriş başarısız' };
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Login hatası:', error);
        return { success: false, message: 'Sunucuya bağlanılamadı. Lütfen sunucunun çalıştığından emin olun.' };
    }
}

/**
 * Arama sayfasındaki satıcıları getirir.
 * @param {object} filters - (İsteğe bağlı) { location, rating }
 */
/**
 * Satıcıları arar ve filtreler (gerçek backend'e bağlı).
 * @param {object} filters - { location, minRating, cuisines, sortBy }
 */
async function searchSellers(filters = {}) {
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        let url = `${baseUrl}/api/sellers`;
        
        // Query parametrelerini ekle
        const params = new URLSearchParams();
        if (filters.location) {
            params.append('location', filters.location);
        }
        if (filters.minRating) {
            params.append('rating', filters.minRating);
        }
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        console.log(`🔍 API isteği: ${url}`);
        
        const response = await fetch(url);
        
        // Response'u kontrol et
        if (!response.ok) {
            // 500 hatası bile olsa response'u parse etmeyi dene
            try {
                const errorData = await response.json();
                console.warn('⚠️ API hata yanıtı:', errorData);
                // Eğer sellers array'i varsa onu kullan
                if (errorData.sellers && Array.isArray(errorData.sellers)) {
                    return errorData.sellers;
                }
            } catch (parseError) {
                console.error('❌ Response parse hatası:', parseError);
            }
            // Hata durumunda boş array döndür, throw etme
            console.warn('⚠️ Satıcılar yüklenemedi, boş liste döndürülüyor');
            return [];
        }
        
        let sellers = await response.json();
        
        // Eğer response bir obje ise ve sellers property'si varsa onu kullan
        if (sellers && typeof sellers === 'object' && !Array.isArray(sellers)) {
            if (sellers.sellers && Array.isArray(sellers.sellers)) {
                sellers = sellers.sellers;
            } else if (sellers.success === false) {
                // Hata mesajı varsa boş array döndür
                console.warn('⚠️ API hata mesajı:', sellers.message);
                return [];
            }
        }
        
        // sellers'ın array olduğundan emin ol
        if (!Array.isArray(sellers)) {
            console.warn('⚠️ Sellers array değil, boş array döndürülüyor');
            return [];
        }
        
        // Rating filtresini backend'den gelen veriler üzerinde uygula (backend zaten filtreliyor ama tekrar kontrol et)
        if (filters.minRating) {
            sellers = sellers.filter(seller => (seller.rating || 0) >= filters.minRating);
        }
        
        // Not: Mutfak türü ve sıralama frontend'de yapılacak (search.js'de)
        
        console.log(`✅ ${sellers.length} satıcı bulundu`);
        return sellers;
    } catch (error) {
        console.error('❌ Satıcı arama hatası:', error);
        // Hata durumunda boş array döndür, mock veri kullanma
        return [];
    }
}

/**
 * Yeni kullanıcı kaydı oluşturur (gerçek backend'e bağlı).
 * @param {object} userData - { fullname, email, password, role }
 */
async function registerUser(userData) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        if (!response.ok) {
            // HTTP hata durumunda
            const errorData = await response.json().catch(() => ({ message: 'Sunucu hatası' }));
            return { success: false, message: errorData.message || 'Kayıt başarısız' };
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Register hatası:', error);
        return { success: false, message: 'Sunucuya bağlanılamadı. Lütfen sunucunun çalıştığından emin olun.' };
    }
}

/**
 * Şifre sıfırlama isteği gönderir (gerçek backend'e bağlı).
 * @param {string} email 
 */
async function forgotPassword(email) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Sunucu hatası' }));
            return { success: false, message: errorData.message || 'İşlem başarısız' };
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Forgot password hatası:', error);
        return { success: false, message: 'Sunucuya bağlanılamadı. Lütfen sunucunun çalıştığından emin olun.' };
    }
}

// ------------------------------------
// GÖREV 2: EMİRHAN (Sepet & Ödeme)
// ------------------------------------

/**
 * Bir satıcının detaylarını getirir (Vitrin sayfası için).
 * @param {string|number} sellerId 
 */
async function getSellerDetails(sellerId) {
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const response = await fetch(`${baseUrl}/api/sellers/${sellerId}`);
        
        if (!response.ok) {
            throw new Error('Satıcı bulunamadı');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Satıcı detay getirme hatası:', error);
        // Fallback: Mock veri
        const seller = MOCK_SELLERS.find(s => s.id == sellerId);
        return mockFetch(seller);
    }
}

/**
 * Bir satıcının menüsünü getirir.
 * @param {string|number} sellerId 
 */
async function getSellerMenu(sellerId) {
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const response = await fetch(`${baseUrl}/api/sellers/${sellerId}/menu`);
        
        if (!response.ok) {
            throw new Error('Menü bulunamadı');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Menü getirme hatası:', error);
        // Fallback: Mock veri
        const menu = MOCK_MENUS[sellerId] || [];
        return mockFetch(menu);
    }
}

/**
 * Yeni sipariş oluştur - Backend'e bağlı
 * @param {object} cart - Sepet içeriği (array)
 * @param {number} address - Adres ID
 * @param {string} paymentMethod - Ödeme yöntemi (credit_card, cash, wallet)
 */
async function createOrder(cart, address, paymentMethod = 'credit_card') {
    try {
        // Validasyon
        if (!cart || !Array.isArray(cart) || cart.length === 0) {
            return { success: false, message: "Sepet boş." };
        }

        if (!address) {
            return { success: false, message: "Lütfen bir adres seçin." };
        }

        // Backend'e POST isteği gönder
        const response = await fetch(`${API_BASE_URL}/api/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include', // Session cookie'yi gönder
            body: JSON.stringify({
                cart: cart,
                address: address,
                paymentMethod: paymentMethod
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen hata' }));
            return { 
                success: false, 
                message: errorData.message || `Hata: ${response.status}` 
            };
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error('Sipariş oluşturma hatası:', error);
        return { 
            success: false, 
            message: 'Sunucuya bağlanılamadı. Lütfen sunucunun çalıştığından emin olun.' 
        };
    }
}

// ------------------------------------
// GÖREV 3: HALİT (Alıcı Panel)
// ------------------------------------

/**
 * Aktif siparişleri getir - Backend'e bağlı
 * @param {string|number} userId 
 */
async function getActiveOrders(userId) {
    try {
        if (!userId) {
            return { success: false, message: "Kullanıcı ID gereklidir." };
        }

        const response = await fetch(`${API_BASE_URL}/api/orders/active/${userId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include' // Session cookie'yi gönder
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen hata' }));
            console.warn('Aktif siparişler getirme hatası:', errorData);
            
            // Fallback: Mock veriyi döndür
            const mockActive = MOCK_ORDERS.filter(o => o.userId == userId && o.status === "preparing").map(o => ({
                ...o,
                statusText: 'Hazırlanıyor',
                canCancel: true,
                canDetail: true,
                type: 'active'
            }));
            return { success: true, data: mockActive };
        }

        const data = await response.json();
        return { success: true, data: data.data || data };

    } catch (error) {
        console.error('Aktif siparişler getirme hatası:', error);
        
        // Fallback: Mock veriyi döndür
        const mockActive = MOCK_ORDERS.filter(o => o.userId == userId && o.status === "preparing").map(o => ({
            ...o,
            statusText: 'Hazırlanıyor',
            canCancel: true,
            canDetail: true,
            type: 'active'
        }));
        return { success: true, data: mockActive };
    }
}

/**
 * Geçmiş siparişleri getir - Backend'e bağlı
 * @param {string|number} userId 
 */
async function getPastOrders(userId) {
    try {
        if (!userId) {
            return { success: false, message: "Kullanıcı ID gereklidir." };
        }

        const response = await fetch(`${API_BASE_URL}/api/orders/past/${userId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include' // Session cookie'yi gönder
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen hata' }));
            console.warn('Geçmiş siparişler getirme hatası:', errorData);
            
            // Fallback: Mock veriyi döndür
            const mockPast = MOCK_ORDERS.filter(o => o.userId == userId && (o.status === "delivered" || o.status === "cancelled")).map(o => ({
                ...o,
                statusText: o.status === "delivered" ? "Teslim Edildi" : "İptal Edildi",
                canRepeat: o.status === "delivered",
                canRate: o.status === "delivered",
                type: 'past'
            }));
            return { success: true, data: mockPast };
        }

        const data = await response.json();
        return { success: true, data: data.data || data };

    } catch (error) {
        console.error('Geçmiş siparişler getirme hatası:', error);
        
        // Fallback: Mock veriyi döndür
        const mockPast = MOCK_ORDERS.filter(o => o.userId == userId && (o.status === "delivered" || o.status === "cancelled")).map(o => ({
            ...o,
            statusText: o.status === "delivered" ? "Teslim Edildi" : "İptal Edildi",
            canRepeat: o.status === "delivered",
            canRate: o.status === "delivered",
            type: 'past'
        }));
        return { success: true, data: mockPast };
    }
}

// TODO: Halit için getAddresses(), getWalletBalance() vb. fonksiyonları buraya ekleyin.


// ------------------------------------
// GÖREV 4: ŞÜKRÜ (Satıcı & Kurye Panel)
// ------------------------------------

/**
 * Satıcının son siparişlerini getirir (Dashboard için).
 * @param {string|number} shopId 
 */
function getRecentOrders(shopId) {
    // Şimdilik tüm siparişlerden rastgele dönelim
    return mockFetch(MOCK_ORDERS.slice(0, 2));
}

/**
 * Satıcının tüm siparişlerini getirir (Siparişler sayfası için).
 * @param {string|number} shopId 
 * @param {string} tab - ("new", "preparing", "history")
 */
function getSellerOrders(shopId, tab) {
    if (tab === "new") {
        return mockFetch([MOCK_ORDERS[0]]); // Sadece 'preparing' olanı
    }
    return mockFetch([]);
}

/**
 * Kurye için alınabilir görevleri getirir.
 */
function getAvailableDeliveries() {
    return mockFetch([
        { id: 1052, from: "Ayşe'nin Mutfağı (Kadıköy)", to: "E*** S. (Çerkezköy)", payout: 45.00 },
        { id: 1050, from: "Vegan Lezzetler (Moda)", to: "M*** Y. (Göztepe)", payout: 30.00 },
    ]);
}

// TODO: Şükrü için addMeal(), updateMeal(), getCourierHistory() vb. fonksiyonları buraya ekleyin.



/* ==================================== */
/* 5. GÖREV: ADMİN PANELİ (GERÇEK API)  */
/* ==================================== */

// Header hazırlayan yardımcı fonksiyon
// Not: Artık session kullanıyoruz, token opsiyonel (geriye dönük uyumluluk için)
function getAuthHeaders() {
    const headers = {
        'Content-Type': 'application/json'
    };
    
    // Session kullanıyoruz, token'a gerek yok
    // credentials: 'include' ile session cookie otomatik gönderilir
    // Token varsa ekle (geriye dönük uyumluluk için - sadece API isteklerinde)
    // Not: Session birincil yöntem, token sadece fallback
    
    return headers;
}

/**
 * Tüm satıcıları ve kuryeleri veritabanından getirir.
 */
async function getAllUsers() {
    try {
        console.log('📡 getAllUsers API çağrısı yapılıyor...');
        console.log('🍪 Cookie durumu:', document.cookie);
        console.log('🌐 API Base URL:', API_BASE_URL);
        
        const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include' // Session cookie'yi gönder
        });
        
        console.log('📡 Response status:', response.status, response.statusText);
        
        if (!response.ok) {
            let errorMessage = 'Kullanıcılar getirilemedi';
            try {
                const err = await response.json();
                errorMessage = err.message || errorMessage;
            } catch (e) {
                errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }
            console.error('❌ API hatası:', errorMessage);
            throw new Error(errorMessage);
        }
        
        const users = await response.json();
        console.log('✅ Kullanıcılar alındı:', users.length, 'kullanıcı');
        console.log('📋 İlk 3 kullanıcı:', users.slice(0, 3));
        
        // Eğer array değilse, array'e çevir
        if (!Array.isArray(users)) {
            console.warn('⚠️ API response array değil, boş array döndürülüyor');
            return [];
        }
        
        return users; // Backend zaten frontend'e uygun formatta (active/suspended) dönüyor
    } catch (error) {
        console.error('❌ Kullanıcı listesi hatası:', error);
        console.error('❌ Hata detayı:', error.message, error.stack);
        return [];
    }
}

/**
 * Kupon sayfasında seçim yapmak için tüm satıcıları getirir.
 */
async function getAllSellers() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/sellers`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include' // Session cookie'yi gönder
        });

        if (!response.ok) throw new Error('Satıcılar alınamadı');
        return await response.json();
    } catch (error) {
        console.error('Satıcı listesi hatası:', error);
        return [];
    }
}

/**
 * Yeni kullanıcı (satıcı/kurye) ekler (Veritabanına kaydeder).
 */
async function adminAddUser(userData) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include', // Session cookie'yi gönder
            body: JSON.stringify(userData)
        });

        const data = await response.json();
        
        if (!response.ok) {
            return { success: false, message: data.message || 'Ekleme başarısız' };
        }
        
        return { success: true, user: data.user };
    } catch (error) {
        console.error('Kullanıcı ekleme hatası:', error);
        return { success: false, message: 'Sunucu hatası oluştu.' };
    }
}

/**
 * Kullanıcıyı dondurur veya aktif eder.
 */
async function adminSuspendUser(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/suspend`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            credentials: 'include' // Session cookie'yi gönder
        });

        const data = await response.json();
        
        if (!response.ok) {
            return { success: false, message: data.message }; // Toast mesajı için hata metni
        }
        
        return { success: true };
    } catch (error) {
        console.error('Durum güncelleme hatası:', error);
        return { success: false, message: 'Bağlantı hatası' };
    }
}

/**
 * Kullanıcıyı veritabanından siler.
 */
async function adminDeleteUser(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
            credentials: 'include' // Session cookie'yi gönder
        });

        const data = await response.json();

        if (!response.ok) {
            // Backend silmeye izin vermediyse (örn: siparişi var diye)
            console.warn(data.message);
            return { success: false, message: data.message };
        }
        
        return { success: true };
    } catch (error) {
        console.error('Silme hatası:', error);
        return { success: false, message: 'Silme işlemi başarısız.' };
    }
}

/**
 * Yeni kupon tanımlar.
 */
async function adminAddCoupon(couponData) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/coupons`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include', // Session cookie'yi gönder
            body: JSON.stringify(couponData) 
        });

        const data = await response.json();
        
        if (!response.ok) {
            return { success: false, message: data.message };
        }
        
        return { success: true, coupon: data.coupon };
    } catch (error) {
        console.error('Kupon ekleme hatası:', error);
        return { success: false, message: 'Sunucu hatası.' };
    }
}

/**
 * Tüm kuponları getirir.
 */
async function getCoupons() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/coupons`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include' // Session cookie'yi gönder
        });

        if (!response.ok) throw new Error('Kuponlar alınamadı');
        return await response.json();
    } catch (error) {
        console.error('Kupon listesi hatası:', error);
        return [];
    }
}

/**
 * Kuponu siler.
 */
async function adminDeleteCoupon(couponId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/coupons/${couponId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
            credentials: 'include' // Session cookie'yi gönder
        });

        if (!response.ok) return { success: false };
        return { success: true };
    } catch (error) {
        console.error('Kupon silme hatası:', error);
        return { success: false };
    }
}

/* ================================================ */
/* FONKSİYONLARI GLOBAL YAPMA (window'a Ekleme)   */
/* ================================================ */
/*
  Diğer JS dosyalarının (auth.js, admin.js vb.) bu 
  fonksiyonlara erişebilmesi için 'window' objesine ekliyoruz.
*/

// --- Global değişkenleri window'a ekle (cart.js için) ---
window.MOCK_MENUS = MOCK_MENUS;
window.MOCK_SELLERS = MOCK_SELLERS;

// --- Alıcı / Ortak Fonksiyonlar ---
window.loginUser = loginUser;
window.registerUser = registerUser;
window.forgotPassword = forgotPassword;
window.searchSellers = searchSellers;
window.getSellerDetails = getSellerDetails;
window.getSellerMenu = getSellerMenu;
window.createOrder = createOrder;
window.getActiveOrders = getActiveOrders;
window.getPastOrders = getPastOrders;

// --- Satıcı / Kurye Fonksiyonları ---
window.getRecentOrders = getRecentOrders;
window.getSellerOrders = getSellerOrders;
window.getAvailableDeliveries = getAvailableDeliveries;

// --- ADMİN PANELİ FONKSİYONLARI ---
window.getAllUsers = getAllUsers;
window.adminAddUser = adminAddUser;
window.adminSuspendUser = adminSuspendUser;
window.adminDeleteUser = adminDeleteUser;
window.getAllSellers = getAllSellers;
window.adminAddCoupon = adminAddCoupon;
window.getCoupons = getCoupons;
window.adminDeleteCoupon = adminDeleteCoupon;