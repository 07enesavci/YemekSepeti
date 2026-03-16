window.getBaseUrl=function() {
    const port=window.location.port;
    // Yalnızca tipik frontend dev portlarından backend'e (3000) yönlendir
    // Uygulama backend üzerinde (3000/3001 vb.) çalışıyorsa relatif kullan ("")
    if (port === '5500' || port === '8080' || port === '5173') {
        return 'http://localhost:3000';
    }
    return '';
};

window.getApiBaseUrl=function() {
    return window.getBaseUrl();
};

const API_BASE_URL=window.getApiBaseUrl();

// Utılıty function
window.formatTL=function(amount) {
    return (amount || 0).toLocaleString('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

// Auth functions
async function loginUser(email, password) {
    try 
    {
        const response=await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });
        
        if (!response.ok) 
        {
            const errorData=await response.json().catch(() => ({ message: 'Sunucu hatası' }));
            return { success: false, message: errorData.message || 'Giriş başarısız' };
        }
        
        return await response.json();
    } 
    catch (error) 
    {
        return { success: false, message: 'Sunucuya bağlanılamadı.' };
    }
}

async function registerUser(userData) 
{
    try 
    {
        const response=await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        
        if (!response.ok) 
        {
            const errorData=await response.json().catch(() => ({ message: 'Sunucu hatası' }));
            return { success: false, message: errorData.message || 'Kayıt başarısız' };
        }
        
        return await response.json();
    } 
    catch (error) 
    {
        return { success: false, message: 'Sunucuya bağlanılamadı.' };
    }
}

async function forgotPassword(email) 
{
    try 
    {
        const response=await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        if (!response.ok) 
        {
            const errorData=await response.json().catch(() => ({ message: 'Sunucu hatası' }));
            return { success: false, message: errorData.message || 'İşlem başarısız' };
        }
        
        return await response.json();
    } 
    catch (error) 
    {
        return { success: false, message: 'Sunucuya bağlanılamadı.' };
    }
}

async function verifyEmail(email, code, userData, formData) 
{
    try 
    {
        const opts = {
            method: 'POST',
            credentials: 'include'
        };
        if (formData) {
            opts.body = formData;
        } else {
            opts.headers = { 'Content-Type': 'application/json' };
            opts.body = JSON.stringify({ email, code, ...userData });
        }
        const response = await fetch(`${API_BASE_URL}/api/auth/verify-email`, opts);
        
        if (!response.ok) 
        {
            const errorData = await response.json().catch(() => ({ message: 'Sunucu hatası' }));
            return { success: false, message: errorData.message || 'Doğrulama başarısız' };
        }
        
        return await response.json();
    } 
    catch (error) 
    {
        return { success: false, message: 'Sunucuya bağlanılamadı.' };
    }
}

async function submitDocuments(formData) 
{
    const timeoutMs = 60000; // 60 saniye - takılı kalmayı önler
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try 
    {
        const response = await fetch(`${API_BASE_URL}/api/auth/submit-documents`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        var data = {};
        try {
            var text = await response.text();
            if (text && text.trim()) data = JSON.parse(text);
        } catch (_) {}
        if (!response.ok) {
            var msg = data.message || ('Sunucu hata döndü (' + response.status + '). Dosyalar çok büyük olabilir.');
            if (response.status === 520) msg = 'Bağlantı koptu (520). Dosyalarınızı küçültün (her biri 2 MB altı) veya sunucu limitlerini kontrol edin.';
            return { success: false, message: msg };
        }
        return data;
    } 
    catch (error) 
    {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            return { success: false, message: 'Yükleme zaman aşımına uğradı (60 sn). Dosyalarınızı küçültüp tekrar deneyin.' };
        }
        return { success: false, message: 'Bağlantı koptu. Dosyalar çok büyük olabilir veya sunucu yanıt vermiyor.' };
    }
}

// Alternatif: Base64 JSON ile gönder (520 / multipart sorununda)
async function submitDocumentsJson(documents) {
    const timeoutMs = 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/submit-documents-json`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documents }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        var data = {};
        try {
            var text = await response.text();
            if (text && text.trim()) data = JSON.parse(text);
        } catch (_) {}
        if (!response.ok) return { success: false, message: data.message || 'Belgeler yüklenemedi.' };
        return data;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') return { success: false, message: 'Yükleme zaman aşımına uğradı.' };
        return { success: false, message: 'Bağlantı hatası.' };
    }
}

async function verify2FA(email, code) 
{
    try 
    {
        const response=await fetch(`${API_BASE_URL}/api/auth/verify-2fa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, code })
        });
        
        if (!response.ok) 
        {
            const errorData=await response.json().catch(() => ({ message: 'Sunucu hatası' }));
            return { success: false, message: errorData.message || 'Doğrulama başarısız' };
        }
        
        return await response.json();
    } 
    catch (error) 
    {
        return { success: false, message: 'Sunucuya bağlanılamadı.' };
    }
}

async function resetPassword(token, password) 
{
    try 
    {
        const response=await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password })
        });
        
        if (!response.ok) 
        {
            const errorData=await response.json().catch(() => ({ message: 'Sunucu hatası' }));
            return { success: false, message: errorData.message || 'Şifre sıfırlama başarısız' };
        }
        
        return await response.json();
    } 
    catch (error) 
    {
        return { success: false, message: 'Sunucuya bağlanılamadı.' };
    }
}

// Search functions
async function searchSellers(filters = {}) 
{
    try 
    {
        let baseUrl='';
        if(window.getBaseUrl) 
        {
            baseUrl=window.getBaseUrl();
        }
        let url=`${baseUrl}/api/sellers`;
        
        const params=new URLSearchParams();
        if (filters.location) params.append('location', filters.location);
        if (filters.minRating) params.append('rating', filters.minRating);
        
        if (params.toString()) url += '?' + params.toString();
        
        const response=await fetch(url);
        
        if (!response.ok) 
        {
            try 
            {
                const errorData=await response.json();
                if (errorData.sellers && Array.isArray(errorData.sellers)) 
                {
                    return errorData.sellers;
                }
            }
            catch (parseError) 
            {
            }
            return [];
        }
        
        let sellers=await response.json();
        
        if (sellers && typeof sellers === 'object' && !Array.isArray(sellers)) 
        {
            if (sellers.sellers && Array.isArray(sellers.sellers)) 
            {
                sellers = sellers.sellers;
            }
            else if (sellers.success === false) 
            {
                return [];
            }
        }
        
        if (!Array.isArray(sellers)) return [];
        
        if (filters.minRating) 
        {
            sellers = sellers.filter(seller => (seller.rating || 0) >= filters.minRating);
        }
        
        return sellers;
    } 
    catch (error) 
    {
        return [];
    }
}

// Seller functions
async function getSellerDetails(sellerId) 
{
    try 
    {
        let baseUrl='';
        if(window.getBaseUrl) 
        {
            baseUrl=window.getBaseUrl();
        }
        const response=await fetch(`${baseUrl}/api/sellers/${sellerId}`);
        
        if (!response.ok) 
        {
            throw new Error('Satıcı bulunamadı');
        }
        
        return await response.json();
    } 
    catch (error) 
    {
        throw error;
    }
}

async function getSellerMenu(sellerId) 
{
    try 
    {
        let baseUrl='';
        if(window.getBaseUrl) 
        {
            baseUrl=window.getBaseUrl();
        }
        const response=await fetch(`${baseUrl}/api/sellers/${sellerId}/menu`);
        
        if (!response.ok) 
        {
            throw new Error('Menü bulunamadı');
        }
        
        return await response.json();
    } 
    catch (error) 
    {
        throw error;
    }
}

// Order functions
async function createOrder(cart, address, paymentMethod = 'credit_card') 
{
    try 
    {
        console.log('createOrder çağrıldı:', { cart, address, paymentMethod });
        
        if (!cart || !Array.isArray(cart) || cart.length === 0) 
        {
            console.error('Sepet boş');
            return { success: false, message: "Sepet boş." };
        }

        if (!address) 
        {
            console.error('Adres seçilmemiş');
            return { success: false, message: "Lütfen bir adres seçin." };
        }

        let apiUrl='/api/orders';
        if (API_BASE_URL && API_BASE_URL.trim() !== '') 
        {
            apiUrl = `${API_BASE_URL}/api/orders`;
        }
        console.log('API isteği gönderiliyor:', apiUrl);
        console.log('API_BASE_URL:', API_BASE_URL);
        const response=await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ cart, address, paymentMethod })
        });

        console.log('API yanıtı:', response.status, response.statusText);

        if (!response.ok) 
        {
            const errorText=await response.text();
            console.error('API hatası:', response.status, errorText);
            let errorData;
            try 
            {
                errorData = JSON.parse(errorText);
            } 
            catch (e) 
            {
                errorData = { message: errorText || 'Bilinmeyen hata' };
            }
            return { success: false, message: errorData.message || `Hata: ${response.status}` };
        }

        const result=await response.json();
        console.log('API başarılı:', result);
        
        // Backend'den gelen tutarları loglaması
        if (result.subtotal && result.deliveryFee && result.total) 
        {
            console.log('Backend Tutarları - Subtotal: ' + result.subtotal + ' TL, Delivery Fee: ' + result.deliveryFee + ' TL, Total: ' + result.total + ' TL');
            
            if (typeof window.getSepetTotals === 'function') 
            {
                const frontendTotals=await window.getSepetTotals();
                const frontendTotal=parseFloat(frontendTotals.toplam.toFixed(2));
                const backendTotal=parseFloat(result.total);
                
                if (Math.abs(frontendTotal - backendTotal) > 0.01) 
                {
                    console.warn('TUTAR FARKI TESPİT EDİLDİ! Frontend: ' + frontendTotal.toFixed(2) + ' TL, Backend: ' + backendTotal.toFixed(2) + ' TL, Fark: ' + Math.abs(frontendTotal - backendTotal).toFixed(2) + ' TL');
                    console.warn('Frontend Subtotal: ' + frontendTotals.ara.toFixed(2) + ' TL, Delivery: ' + frontendTotals.teslimat.toFixed(2) + ' TL');
                    console.warn('Backend Subtotal: ' + result.subtotal + ' TL, Delivery: ' + result.deliveryFee + ' TL');
                }
            }
        }
        
        return result;
    } 
    catch (error) 
    {
        console.error('createOrder hatası:', error);
        console.error('Hata stack:', error.stack);
        return { success: false, message: 'Sunucuya bağlanılamadı: ' + error.message };
    }
}

async function getActiveOrders(userId) 
{
    try 
    {
        if (!userId) 
        {
            return { success: false, message: "Kullanıcı ID gereklidir." };
        }

        const response=await fetch(`${API_BASE_URL}/api/orders/active/${userId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });

        if (!response.ok) 
        {
            return { success: true, data: [] };
        }

        const data=await response.json();
        return { success: true, data: data.data || data };
    } 
    catch (error) 
    {
        return { success: true, data: [] };
    }
}

async function getPastOrders(userId) 
{
    try 
    {
        if (!userId) 
        {
            return { success: false, message: "Kullanıcı ID gereklidir." };
        }

        const response=await fetch(`${API_BASE_URL}/api/orders/past/${userId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });

        if (!response.ok) 
        {
            return { success: true, data: [] };
        }

        const data=await response.json();
        return { success: true, data: data.data || data };
    } 
    catch (error) 
    {
        return { success: true, data: [] };
    }
}

async function cancelOrder(orderId) 
{
    try 
    {
        if (!orderId) 
        {
            return { success: false, message: "Sipariş ID gereklidir." };
        }

        const response=await fetch(`${API_BASE_URL}/api/orders/${orderId}/cancel`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });

        const data=await response.json();
        
        if (!response.ok) 
        {
            return { success: false, message: data.message || "Sipariş iptal edilemedi." };
        }

        return data;
    } 
    catch (error) 
    {
        return { success: false, message: "Sunucuya bağlanılamadı: " + error.message };
    }
}

// Admin functions
function getAuthHeaders() 
{
    return { 'Content-Type': 'application/json' };
}

async function getAllUsers() 
{
    try 
    {
        const response=await fetch(`${API_BASE_URL}/api/admin/users`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include'
        });
        
        if (!response.ok) 
        {
            return [];
        }
        
        const users=await response.json();
        if(Array.isArray(users)) 
        {
            return users;
        }
        if (users && users.data && Array.isArray(users.data)) 
        {
            return users.data;
        }
        return [];
    } 
    catch (error) 
    {
        return [];
    }
}

async function getAllSellers() 
{
    try 
    {
        const response=await fetch(`${API_BASE_URL}/api/admin/sellers`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include'
        });

        if (!response.ok) throw new Error('Satıcılar alınamadı');
        return await response.json();
    } 
    catch (error) 
    {
        return [];
    }
}

async function adminAddUser(userData) 
{
    try 
    {
        const response=await fetch(`${API_BASE_URL}/api/admin/users`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify(userData)
        });

        const data=await response.json();
        
        if (!response.ok) 
        {
            return { success: false, message: data.message || 'Ekleme başarısız' };
        }
        
        return { success: true, user: data.user };
    } 
    catch (error) 
    {
        return { success: false, message: 'Sunucu hatası oluştu.' };
    }
}

async function adminSuspendUser(userId) 
{
    try 
    {
        const response=await fetch(`${API_BASE_URL}/api/admin/users/${userId}/suspend`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            credentials: 'include'
        });

        const data=await response.json();
        
        if (!response.ok) 
        {
            return { success: false, message: data.message };
        }
        
        return { success: true };
    } 
    catch (error) 
    {
        return { success: false, message: 'Bağlantı hatası' };
    }
}

async function adminDeleteUser(userId) 
{
    try 
    {
        const response=await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
            credentials: 'include'
        });

        const data=await response.json();

        if (!response.ok) 
        {
            return { success: false, message: data.message };
        }
        
        return { success: true };
    } 
    catch (error) 
    {
        return { success: false, message: 'Silme işlemi başarısız.' };
    }
}

async function adminAddCoupon(couponData) 
{
    try 
    {
        const response=await fetch(`${API_BASE_URL}/api/admin/coupons`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify(couponData) 
        });

        const data=await response.json();
        
        if (!response.ok) 
        {
            return { success: false, message: data.message || 'Kupon eklenemedi.' };
        }
        
        return { success: true, message: data.message || 'Kupon başarıyla eklendi.', coupon: data.coupon };
    } 
    catch (error) 
    {
        console.error('Kupon ekleme hatası:', error);
        return { success: false, message: 'Kupon eklenirken bir hata oluştu.' };
    }
}

async function getCoupons() 
{
    try 
    {
        const response=await fetch(`${API_BASE_URL}/api/admin/coupons`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include'
        });

        if (!response.ok) throw new Error('Kuponlar alınamadı');
        return await response.json();
    } 
    catch (error) 
    {
        return [];
    }
}

async function adminDeleteCoupon(couponId) 
{
    try 
    {
        const response=await fetch(`${API_BASE_URL}/api/admin/coupons/${couponId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
            credentials: 'include'
        });

        if (!response.ok) return { success: false };
        return { success: true };
    } 
    catch (error) 
    {
        return { success: false };
    }
}

// Export to window
window.loginUser=loginUser;
window.registerUser=registerUser;
window.forgotPassword=forgotPassword;
window.verifyEmail=verifyEmail;
window.submitDocuments=submitDocuments;
window.submitDocumentsJson=submitDocumentsJson;
window.verify2FA=verify2FA;
window.searchSellers=searchSellers;
window.getSellerDetails=getSellerDetails;
window.getSellerMenu=getSellerMenu;
window.createOrder=createOrder;
window.getActiveOrders=getActiveOrders;
window.getPastOrders=getPastOrders;
window.cancelOrder=cancelOrder;
window.getAllUsers=getAllUsers;
window.adminAddUser=adminAddUser;
window.adminSuspendUser=adminSuspendUser;
window.adminDeleteUser=adminDeleteUser;
window.getAllSellers=getAllSellers;
window.adminAddCoupon=adminAddCoupon;
window.getCoupons=getCoupons;
window.adminDeleteCoupon=adminDeleteCoupon;

async function getNotifications(limit) {
    const response = await fetch(`${API_BASE_URL}/api/notifications?limit=${limit || 20}`, { credentials: 'include', headers: getAuthHeaders() });
    if (!response.ok) return { notifications: [], unreadCount: 0 };
    return await response.json();
}
async function markNotificationRead(id) {
    const response = await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, { method: 'PUT', credentials: 'include', headers: getAuthHeaders() });
    return response.ok;
}
async function markAllNotificationsRead() {
    const response = await fetch(`${API_BASE_URL}/api/notifications/read-all`, { method: 'POST', credentials: 'include', headers: getAuthHeaders() });
    return response.ok;
}
async function getFavorites() {
    const response = await fetch(`${API_BASE_URL}/api/favorites`, { credentials: 'include', headers: getAuthHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    return data.favorites || [];
}
async function addFavorite(sellerId) {
    const response = await fetch(`${API_BASE_URL}/api/favorites/${sellerId}`, { method: 'POST', credentials: 'include', headers: getAuthHeaders() });
    return await response.json();
}
async function removeFavorite(sellerId) {
    const response = await fetch(`${API_BASE_URL}/api/favorites/${sellerId}`, { method: 'DELETE', credentials: 'include', headers: getAuthHeaders() });
    return await response.json();
}
async function checkFavorite(sellerId) {
    const response = await fetch(`${API_BASE_URL}/api/favorites/check/${sellerId}`, { credentials: 'include', headers: getAuthHeaders() });
    if (!response.ok) return false;
    const data = await response.json();
    return !!data.isFavorite;
}
window.getNotifications=getNotifications;
window.markNotificationRead=markNotificationRead;
window.markAllNotificationsRead=markAllNotificationsRead;
window.getFavorites=getFavorites;
window.addFavorite=addFavorite;
window.removeFavorite=removeFavorite;
window.checkFavorite=checkFavorite;