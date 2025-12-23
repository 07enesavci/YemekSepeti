/**
 * Yetkisiz erişim kontrolü - Sayfa yüklendiğinde kullanıcının yetkisini kontrol eder
 */

// Sayfa yüklendiğinde yetki kontrolü yap
document.addEventListener('DOMContentLoaded', async () => {
    // Mevcut sayfa yolunu al
    const currentPath = window.location.pathname;
    
    // Eğer login/register sayfalarındaysa kontrol yapma
    if (currentPath.includes('/login') || currentPath.includes('/register')) {
        return;
    }
    
    // Sayfa tipini belirle (EJS route'larına göre)
    let requiredRole = null;
    if (currentPath.includes('/buyer/')) {
        requiredRole = 'buyer';
    } else if (currentPath.includes('/seller/')) {
        requiredRole = 'seller';
    } else if (currentPath.includes('/admin/')) {
        requiredRole = 'admin';
    } else if (currentPath.includes('/courier/')) {
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
                window.location.href = `${baseUrl}/login`;
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
                            redirectPath = '/';
                            break;
                        case 'seller':
                            redirectPath = '/seller/dashboard';
                            break;
                        case 'admin':
                            redirectPath = '/admin/users';
                            break;
                        case 'courier':
                            // Courier ID'yi al
                            const courierId = data.user.courierId || data.user.id;
                            redirectPath = `/courier/${courierId}/dashboard`;
                            break;
                    }
                    
                    alert('Bu sayfaya erişim yetkiniz yok. Kendi panelinize yönlendiriliyorsunuz.');
                    window.location.href = `${baseUrl}${redirectPath}`;
                }
            } else {
                // Kullanıcı bilgisi alınamadı - login sayfasına yönlendir
                window.location.href = `${baseUrl}/login`;
            }
        } catch (error) {
            console.error('Yetki kontrolü hatası:', error);
            // Hata durumunda login sayfasına yönlendir
            const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
            window.location.href = `${baseUrl}/login`;
        }
    }
});

