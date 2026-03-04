document.addEventListener('DOMContentLoaded', async ()=>{
    var currentPath=window.location.pathname;
    
    if (currentPath.includes('/login')) 
    {
        return;
    }
    if (currentPath.includes('/register')) 
    {
        return;
    }
    
    var requiredRole=null;
    if (currentPath.includes('/buyer/')) 
    {
        requiredRole='buyer';
    } 
    else if (currentPath.includes('/seller/')) 
    {
        requiredRole='seller';
    } 
    else if (currentPath.includes('/admin/')) 
    {
        requiredRole='admin';
    } 
    else if (currentPath.includes('/courier/')) 
    {
        requiredRole='courier';
    }
    
    if (requiredRole) 
    {
        try 
        {
            var baseUrl;
            if (window.getBaseUrl) 
            {
                baseUrl=window.getBaseUrl();
            } 
            else 
            {
                baseUrl='';
            }
            var response=await fetch(baseUrl + '/api/auth/me', {
                credentials: 'include'
            });
            
            if (!response.ok) 
            {
                window.location.href=baseUrl + '/login';
                return;
            }
            
            var data=await response.json();
            if (data.success) 
            {
                if (data.user) 
                {
                    var userRole=data.user.role;
                
                if (userRole !== requiredRole) 
                {
                    var redirectPath='/';
                    
                    if (userRole==='buyer') 
                    {
                        redirectPath='/';
                    } 
                    else if (userRole==='seller') 
                    {
                        redirectPath='/seller/dashboard';
                    } 
                    else if (userRole==='admin') 
                    {
                        redirectPath='/admin/users';
                    } 
                    else if (userRole==='courier') 
                    {
                        var courierId;
                        if (data.user.courierId) 
                        {
                            courierId=data.user.courierId;
                        } 
                        else 
                        {
                            courierId=data.user.id;
                        }
                        redirectPath='/courier/' + courierId + '/dashboard';
                    }
                    
                    alert('Bu sayfaya erişim yetkiniz yok. Kendi panelinize yönlendiriliyorsunuz.');
                    window.location.href=baseUrl + redirectPath;
                }
                }
            } 
            else 
            {
                window.location.href=baseUrl + '/login';
            }
        } 
        catch (error) 
        {
            console.log('Yetki kontrolü hatası: ' + error);
            var baseUrl2;
            if (window.getBaseUrl) 
            {
                baseUrl2=window.getBaseUrl();
            } 
            else 
            {
                baseUrl2='';
            }
            window.location.href=baseUrl2 + '/login';
        }
    }
});

