/* ==================================== */
/* SAHTE BACKEND (Mock API)             */
/* assets/js/api.js                     */
/* ==================================== */
/*
  Bu dosya, sunucu hazır olana kadar tüm ekibe
  sahte veri sağlar. Tüm fonksiyonlar, bir ağ
  isteğini taklit etmek için 'Promise' ve 
  'setTimeout' kullanır.
*/

// Gecikme süresi (milisaniye). 500ms = 0.5 saniye
const NETWORK_DELAY = 500;

/* ==================================== */
/* SAHTE VERİTABANI (Mock Database)     */
/* ==================================== */

// --- Alıcıların Göreceği Veriler ---
const MOCK_SELLERS = [
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

// --- Kullanıcı (Alıcı/Satıcı/Kurye) Verileri ---
const MOCK_USERS = [
    { id: 1, email: "enes@mail.com", password: "123", role: "buyer", fullname: "Enes Avcı" },
    { id: 2, email: "ahmet@mail.com", password: "123", role: "buyer", fullname: "Ahmet Eren" },
    { id: 3, email: "satici@mail.com", password: "123", role: "seller", fullname: "Ayşe Satıcı", shopId: 1 },
    { id: 4, email: "kurye@mail.com", password: "123", role: "courier", fullname: "Şükrü Kurye" },
];

// --- Alıcıya Özel Veriler (Halit'in modülü için) ---
const MOCK_ORDERS = [
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
            resolve(data);
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
 * Kullanıcı girişini simüle eder.
 * @param {string} email 
 * @param {string} password 
 */
function loginUser(email, password) {
    const user = MOCK_USERS.find(u => u.email === email && u.password === password);
    if (user) {
        // Gerçekte burada bir token döner, biz kullanıcı objesini dönelim
        return mockFetch({ success: true, user });
    } else {
        return mockError("E-posta veya şifre hatalı.");
    }
}

/**
 * Arama sayfasındaki satıcıları getirir.
 * @param {object} filters - (İsteğe bağlı) { location, rating }
 */
function searchSellers(filters = {}) {
    // TODO: Filtreleme mantığını buraya ekleyin
    return mockFetch(MOCK_SELLERS);
}

// ------------------------------------
// GÖREV 2: EMİRHAN (Sepet & Ödeme)
// ------------------------------------

/**
 * Bir satıcının detaylarını getirir (Vitrin sayfası için).
 * @param {string|number} sellerId 
 */
function getSellerDetails(sellerId) {
    const seller = MOCK_SELLERS.find(s => s.id == sellerId);
    return mockFetch(seller);
}

/**
 * Bir satıcının menüsünü getirir.
 * @param {string|number} sellerId 
 */
function getSellerMenu(sellerId) {
    const menu = MOCK_MENUS[sellerId] || [];
    return mockFetch(menu);
}

/**
 * Yeni sipariş oluşturmayı simüle eder.
 * @param {object} cart - Sepet içeriği
 * @param {object} address - Adres bilgisi
 */
function createOrder(cart, address) {
    // Gerçekte bu, veritabanına kayıt yapar
    console.log("SİPARİŞ OLUŞTURULDU:", cart, address);
    // Yeni sipariş objesi oluşturup MOCK_ORDERS'a ekleyebiliriz
    return mockFetch({ success: true, orderId: 1053 });
}

// ------------------------------------
// GÖREV 3: HALİT (Alıcı Panel)
// ------------------------------------

/**
 * Aktif siparişleri getirir.
 * @param {string|number} userId 
 */
function getActiveOrders(userId) {
    const active = MOCK_ORDERS.filter(o => o.userId == userId && o.status === "preparing");
    return mockFetch(active);
}

/**
 * Geçmiş siparişleri getirir.
 * @param {string|number} userId 
 */
function getPastOrders(userId) {
    const past = MOCK_ORDERS.filter(o => o.userId == userId && (o.status === "delivered" || o.status === "cancelled"));
    return mockFetch(past);
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