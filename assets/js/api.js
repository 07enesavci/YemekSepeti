/* ==================================== */
/* API UTILITY FUNCTIONS                 */
/* ==================================== */

// Yönlendirme için base URL belirleme
window.getBaseUrl = function() {
    const port = window.location.port;
    if (port === '5500' || port === '8080' || port === '5173' || port === '3001') {
        return 'http://localhost:3000';
    }
    return '';
};

// API Base URL
window.getApiBaseUrl = function() {
    return window.getBaseUrl();
};

const API_BASE_URL = window.getApiBaseUrl();

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * TL formatında para birimini döndürür
 * @param {number} amount - Formatlanacak tutar
 * @returns {string} Formatlanmış para birimi
 */
window.formatTL = function(amount) {
    return (amount || 0).toLocaleString('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

// ============================================
// AUTH FUNCTIONS
// ============================================

async function loginUser(email, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Sunucu hatası' }));
            return { success: false, message: errorData.message || 'Giriş başarısız' };
        }
        
        return await response.json();
    } catch (error) {
        return { success: false, message: 'Sunucuya bağlanılamadı.' };
    }
}

async function registerUser(userData) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Sunucu hatası' }));
            return { success: false, message: errorData.message || 'Kayıt başarısız' };
        }
        
        return await response.json();
    } catch (error) {
        return { success: false, message: 'Sunucuya bağlanılamadı.' };
    }
}

async function forgotPassword(email) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Sunucu hatası' }));
            return { success: false, message: errorData.message || 'İşlem başarısız' };
        }
        
        return await response.json();
    } catch (error) {
        return { success: false, message: 'Sunucuya bağlanılamadı.' };
    }
}

async function verifyEmail(email, code, userData) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/verify-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, code, ...userData })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Sunucu hatası' }));
            return { success: false, message: errorData.message || 'Doğrulama başarısız' };
        }
        
        return await response.json();
    } catch (error) {
        return { success: false, message: 'Sunucuya bağlanılamadı.' };
    }
}

async function verify2FA(email, code) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/verify-2fa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, code })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Sunucu hatası' }));
            return { success: false, message: errorData.message || 'Doğrulama başarısız' };
        }
        
        return await response.json();
    } catch (error) {
        return { success: false, message: 'Sunucuya bağlanılamadı.' };
    }
}

async function resetPassword(token, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Sunucu hatası' }));
            return { success: false, message: errorData.message || 'Şifre sıfırlama başarısız' };
        }
        
        return await response.json();
    } catch (error) {
        return { success: false, message: 'Sunucuya bağlanılamadı.' };
    }
}

// ============================================
// SEARCH FUNCTIONS
// ============================================

async function searchSellers(filters = {}) {
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        let url = `${baseUrl}/api/sellers`;
        
        const params = new URLSearchParams();
        if (filters.location) params.append('location', filters.location);
        if (filters.minRating) params.append('rating', filters.minRating);
        
        if (params.toString()) url += '?' + params.toString();
        
        const response = await fetch(url);
        
        if (!response.ok) {
            try {
                const errorData = await response.json();
                if (errorData.sellers && Array.isArray(errorData.sellers)) {
                    return errorData.sellers;
                }
            } catch (parseError) {
                // Ignore
            }
            return [];
        }
        
        let sellers = await response.json();
        
        if (sellers && typeof sellers === 'object' && !Array.isArray(sellers)) {
            if (sellers.sellers && Array.isArray(sellers.sellers)) {
                sellers = sellers.sellers;
            } else if (sellers.success === false) {
                return [];
            }
        }
        
        if (!Array.isArray(sellers)) return [];
        
        if (filters.minRating) {
            sellers = sellers.filter(seller => (seller.rating || 0) >= filters.minRating);
        }
        
        return sellers;
    } catch (error) {
        return [];
    }
}

// ============================================
// SELLER FUNCTIONS
// ============================================

async function getSellerDetails(sellerId) {
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const response = await fetch(`${baseUrl}/api/sellers/${sellerId}`);
        
        if (!response.ok) {
            throw new Error('Satıcı bulunamadı');
        }
        
        return await response.json();
    } catch (error) {
        throw error;
    }
}

async function getSellerMenu(sellerId) {
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const response = await fetch(`${baseUrl}/api/sellers/${sellerId}/menu`);
        
        if (!response.ok) {
            throw new Error('Menü bulunamadı');
        }
        
        return await response.json();
    } catch (error) {
        throw error;
    }
}

// ============================================
// ORDER FUNCTIONS
// ============================================

async function createOrder(cart, address, paymentMethod = 'credit_card') {
    try {
        console.log('📦 createOrder çağrıldı:', { cart, address, paymentMethod });
        
        if (!cart || !Array.isArray(cart) || cart.length === 0) {
            console.error('❌ Sepet boş');
            return { success: false, message: "Sepet boş." };
        }

        if (!address) {
            console.error('❌ Adres seçilmemiş');
            return { success: false, message: "Lütfen bir adres seçin." };
        }

        // API URL'ini düzelt - eğer API_BASE_URL boşsa veya undefined ise boş string kullan
        let apiUrl = '/api/orders';
        if (API_BASE_URL && API_BASE_URL.trim() !== '') {
            apiUrl = `${API_BASE_URL}/api/orders`;
        }
        console.log('📡 API isteği gönderiliyor:', apiUrl);
        console.log('📡 API_BASE_URL:', API_BASE_URL);
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ cart, address, paymentMethod })
        });

        console.log('📡 API yanıtı:', response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API hatası:', response.status, errorText);
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { message: errorText || 'Bilinmeyen hata' };
            }
            return { success: false, message: errorData.message || `Hata: ${response.status}` };
        }

        const result = await response.json();
        console.log('✅ API başarılı:', result);
        
        // Backend'den gelen tutarları log'la (tutarsızlık kontrolü için)
        if (result.subtotal && result.deliveryFee && result.total) {
            console.log(`💰 Backend Tutarları - Subtotal: ${result.subtotal} TL, Delivery Fee: ${result.deliveryFee} TL, Total: ${result.total} TL`);
            
            // Frontend'deki toplamla karşılaştır
            if (typeof window.getSepetTotals === 'function') {
                const frontendTotals = await window.getSepetTotals();
                const frontendTotal = parseFloat(frontendTotals.toplam.toFixed(2));
                const backendTotal = parseFloat(result.total);
                
                if (Math.abs(frontendTotal - backendTotal) > 0.01) {
                    console.warn(`⚠️ TUTAR FARKI TESPİT EDİLDİ! Frontend: ${frontendTotal.toFixed(2)} TL, Backend: ${backendTotal.toFixed(2)} TL, Fark: ${Math.abs(frontendTotal - backendTotal).toFixed(2)} TL`);
                    console.warn(`📋 Frontend Subtotal: ${frontendTotals.ara.toFixed(2)} TL, Delivery: ${frontendTotals.teslimat.toFixed(2)} TL`);
                    console.warn(`📋 Backend Subtotal: ${result.subtotal} TL, Delivery: ${result.deliveryFee} TL`);
                }
            }
        }
        
        return result;
    } catch (error) {
        console.error('❌ createOrder hatası:', error);
        console.error('❌ Hata stack:', error.stack);
        return { success: false, message: 'Sunucuya bağlanılamadı: ' + error.message };
    }
}

async function getActiveOrders(userId) {
    try {
        if (!userId) {
            return { success: false, message: "Kullanıcı ID gereklidir." };
        }

        const response = await fetch(`${API_BASE_URL}/api/orders/active/${userId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });

        if (!response.ok) {
            return { success: true, data: [] };
        }

        const data = await response.json();
        return { success: true, data: data.data || data };
    } catch (error) {
        return { success: true, data: [] };
    }
}

async function getPastOrders(userId) {
    try {
        if (!userId) {
            return { success: false, message: "Kullanıcı ID gereklidir." };
        }

        const response = await fetch(`${API_BASE_URL}/api/orders/past/${userId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });

        if (!response.ok) {
            return { success: true, data: [] };
        }

        const data = await response.json();
        return { success: true, data: data.data || data };
    } catch (error) {
        return { success: true, data: [] };
    }
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

function getAuthHeaders() {
    return { 'Content-Type': 'application/json' };
}

async function getAllUsers() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include'
        });
        
        if (!response.ok) {
            return [];
        }
        
        const users = await response.json();
        return Array.isArray(users) ? users : [];
    } catch (error) {
        return [];
    }
}

async function getAllSellers() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/sellers`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include'
        });

        if (!response.ok) throw new Error('Satıcılar alınamadı');
        return await response.json();
    } catch (error) {
        return [];
    }
}

async function adminAddUser(userData) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify(userData)
        });

        const data = await response.json();
        
        if (!response.ok) {
            return { success: false, message: data.message || 'Ekleme başarısız' };
        }
        
        return { success: true, user: data.user };
    } catch (error) {
        return { success: false, message: 'Sunucu hatası oluştu.' };
    }
}

async function adminSuspendUser(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/suspend`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            credentials: 'include'
        });

        const data = await response.json();
        
        if (!response.ok) {
            return { success: false, message: data.message };
        }
        
        return { success: true };
    } catch (error) {
        return { success: false, message: 'Bağlantı hatası' };
    }
}

async function adminDeleteUser(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
            credentials: 'include'
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, message: data.message };
        }
        
        return { success: true };
    } catch (error) {
        return { success: false, message: 'Silme işlemi başarısız.' };
    }
}

async function adminAddCoupon(couponData) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/coupons`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify(couponData) 
        });

        const data = await response.json();
        
        if (!response.ok) {
            return { success: false, message: data.message || 'Kupon eklenemedi.' };
        }
        
        return { success: true, message: data.message || 'Kupon başarıyla eklendi.', coupon: data.coupon };
    } catch (error) {
        console.error('Kupon ekleme hatası:', error);
        return { success: false, message: 'Kupon eklenirken bir hata oluştu.' };
    }
}

async function getCoupons() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/coupons`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include'
        });

        if (!response.ok) throw new Error('Kuponlar alınamadı');
        return await response.json();
    } catch (error) {
        return [];
    }
}

async function adminDeleteCoupon(couponId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/coupons/${couponId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
            credentials: 'include'
        });

        if (!response.ok) return { success: false };
        return { success: true };
    } catch (error) {
        return { success: false };
    }
}

// ============================================
// EXPORT TO WINDOW
// ============================================

window.loginUser = loginUser;
window.registerUser = registerUser;
window.forgotPassword = forgotPassword;
window.verifyEmail = verifyEmail;
window.verify2FA = verify2FA;
window.searchSellers = searchSellers;
window.getSellerDetails = getSellerDetails;
window.getSellerMenu = getSellerMenu;
window.createOrder = createOrder;
window.getActiveOrders = getActiveOrders;
window.getPastOrders = getPastOrders;
window.getAllUsers = getAllUsers;
window.adminAddUser = adminAddUser;
window.adminSuspendUser = adminSuspendUser;
window.adminDeleteUser = adminDeleteUser;
window.getAllSellers = getAllSellers;
window.adminAddCoupon = adminAddCoupon;
window.getCoupons = getCoupons;
window.adminDeleteCoupon = adminDeleteCoupon;

