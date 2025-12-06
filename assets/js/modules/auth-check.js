/**
 * Yetkisiz erişim kontrolü - Sayfa yüklendiğinde kullanıcının yetkisini kontrol eder
 */

// Sayfa yüklendiğinde yetki kontrolü yap
document.addEventListener('DOMContentLoaded', async () => {
    // Mevcut sayfa yolunu al
    const currentPath = window.location.pathname;
    
    // Eğer login/register sayfalarındaysa kontrol yapma
    if (currentPath.includes('/login.html') || currentPath.includes('/register.html')) {
        return;
    }
    
    // Sayfa tipini belirle
    let requiredRole = null;
    if (currentPath.includes('/pages/buyer/')) {
        requiredRole = 'buyer';
    } else if (currentPath.includes('/pages/seller/')) {
        requiredRole = 'seller';
    } else if (currentPath.includes('/pages/admin/')) {
        requiredRole = 'admin';
    } else if (currentPath.includes('/pages/courier/')) {
        requiredRole = 'courier';
    }
    
    // Eğer role gerektiren bir sayfadaysa kontrol yap
    if (requiredRole) {
        try {
            const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
            const response = await fetch(`${baseUrl}/api/auth/me`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                // Giriş yapılmamış - login sayfasına yönlendir
                window.location.href = `${baseUrl}/pages/common/login.html`;
                return;
            }
            
            const data = await response.json();
            if (data.success && data.user) {
                const userRole = data.user.role;
                
                // Yetki kontrolü
                if (userRole !== requiredRole) {
                    // Yetkisiz erişim - kullanıcıyı kendi paneline yönlendir
                    let redirectPath = '/';
                    
                    switch(userRole) {
                        case 'buyer':
                            redirectPath = '/pages/buyer/search.html';
                            break;
                        case 'seller':
                            redirectPath = '/pages/seller/dashboard.html';
                            break;
                        case 'admin':
                            redirectPath = '/pages/admin/user-management.html';
                            break;
                        case 'courier':
                            redirectPath = '/pages/courier/dashboard.html';
                            break;
                    }
                    
                    alert('Bu sayfaya erişim yetkiniz yok. Kendi panelinize yönlendiriliyorsunuz.');
                    window.location.href = `${baseUrl}${redirectPath}`;
                }
            } else {
                // Kullanıcı bilgisi alınamadı - login sayfasına yönlendir
                window.location.href = `${baseUrl}/pages/common/login.html`;
            }
        } catch (error) {
            console.error('Yetki kontrolü hatası:', error);
            // Hata durumunda login sayfasına yönlendir
            const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
            window.location.href = `${baseUrl}/pages/common/login.html`;
        }
    }
});

