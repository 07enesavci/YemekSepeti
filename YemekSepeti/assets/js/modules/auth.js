document.addEventListener("DOMContentLoaded", function () 
{

    var loginForm=document.getElementById("login-form");
    if (loginForm) 
    {
        loginForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            var email=document.getElementById("email").value.trim();
            var password=document.getElementById("password").value;

            if (!email || !password) 
            {
                alert("Lütfen e-posta ve şifrenizi girin.");
                return;
            }

            var btn=this.querySelector("button[type=submit]");
            var oldText=btn.textContent;
            btn.disabled=true;
            btn.textContent="Giriş yapılıyor...";

            try 
            {
                var result=await window.loginUser(email, password);
                if (result && result.success) 
                {
                    if (result.requires2FA) 
                    {
                        document.getElementById('login-form').style.display='none';
                        document.getElementById('2fa-section').style.display='block';
                        document.getElementById('2fa-section').setAttribute('data-email', email);
                        return;
                    }
                    
                    localStorage.setItem("user", JSON.stringify(result.user));
                    
                    if (window.updateHeader) 
                    {
                        await window.updateHeader();
                    }
                    
                    var role=result.user.role;
                    var baseUrl;
                    if (window.getBaseUrl) 
                    {
                        baseUrl=window.getBaseUrl();
                    } 
                    else 
                    {
                        baseUrl='';
                    }
                    if (role === "admin") 
                    {
                        window.location.href=`${baseUrl}/admin/users`;
                    } 
                    else if (role === "seller") 
                    {
                        var sellerId=result.user.sellerId;
                        if (sellerId) 
                        {
                            window.location.href=`${baseUrl}/seller/${sellerId}/dashboard`;
                        } 
                        else 
                        {
                            fetch(`${baseUrl}/api/auth/me`, { credentials: 'include' })
                                .then(res => res.json())
                                .then(data => {
                                    if (data.success && data.user && data.user.sellerId) 
                                    {
                                        window.location.href=`${baseUrl}/seller/${data.user.sellerId}/dashboard`;
                                    } 
                                    else 
                                    {
                                        window.location.href=`${baseUrl}/seller/dashboard`;
                                    }
                                })
                                .catch((err) => {
                                    window.location.href=`${baseUrl}/seller/dashboard`;
                                });
                        }
                    } 
                    else if (role === "courier") 
                    {
                        var courierId=result.user.courierId || result.user.id;
                        if (courierId) 
                        {
                            window.location.href=`${baseUrl}/courier/${courierId}/dashboard`;
                        } 
                        else 
                        {
                            fetch(`${baseUrl}/api/auth/me`, { credentials: 'include' })
                                .then(res => res.json())
                                .then(data => {
                                    if (data.success && data.user)
                                    {
                                        var finalCourierId=data.user.courierId || data.user.id;
                                        window.location.href=`${baseUrl}/courier/${finalCourierId}/dashboard`;
                                    } 
                                    else 
                                    {
                                        var fallbackId=result.user.id;
                                        window.location.href=`${baseUrl}/courier/${fallbackId}/dashboard`;
                                    }
                                })
                                .catch((err) => {
                                    var fallbackId=result.user.id;
                                    window.location.href=`${baseUrl}/courier/${fallbackId}/dashboard`;
                                });
                        }
                    } 
                    else if (role === "buyer")
                    {
                        var urlParams=new URLSearchParams(window.location.search);
                        var redirectUrl=urlParams.get('redirect');
                        
                        if (redirectUrl) 
                        {
                            if (redirectUrl.startsWith('/'))
                            {
                                window.location.href=`${baseUrl}${redirectUrl}`;
                            } 
                            else
                            {
                                window.location.href=`${baseUrl}/${redirectUrl}`;
                            }
                        } 
                        else
                        {
                    window.location.href=`${baseUrl}/`;
                        }
                    } 
                    else
                    {
                        window.location.href=`${baseUrl}/`;
                    }
                } 
                else
                {
                    var message;
                    if (result && result.message) 
                    {
                        message=result.message;
                    } 
                    else 
                    {
                        message="E-posta veya şifre hatalı.";
                    }
                    alert(message);
                }
            } 
            catch (error) 
            {
                alert("Bir hata oluştu: " + error.message);
            } 
            finally 
            {
                btn.disabled = false;
                btn.textContent = oldText;
            }
        });
    }

    var registerForm=document.getElementById("register-form");
    if (registerForm) 
    {
        registerForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            var fullname=document.getElementById("fullname").value.trim();
            var email=document.getElementById("email").value.trim();
            var password=document.getElementById("password").value;
            var confirm=document.getElementById("confirm-password").value;
            var roleElement=document.querySelector("input[name='user-role']:checked");
            var role;
            if (roleElement) 
            {
                role=roleElement.value;
            }
            var terms=document.getElementById("terms").checked;

            if (!fullname || !email || !password || !confirm || !role || !terms) 
            {
                alert("Tüm alanları doldurun ve şartları kabul edin.");
                return;
            }
            if (password !== confirm) 
            {
                alert("Şifreler eşleşmiyor.");
                return;
            }
            if (password.length < 6) 
            {
                alert("Şifre en az 6 karakter olmalı.");
                return;
            }

            var btn=this.querySelector("button[type=submit]");
            var oldText=btn.textContent;
            btn.disabled=true;
            btn.textContent="Kayıt oluşturuluyor...";

            try 
            {
                var result=await window.registerUser({ fullname, email, password, role });
                if (result && result.success) 
                {
                    if (result.requiresVerification) 
                    {
                        document.getElementById('register-form').style.display='none';
                        document.getElementById('verification-section').style.display='block';
                        document.getElementById('verification-section').setAttribute('data-user-data', JSON.stringify({ fullname, email, password, role }));
                        return;
                    }
                    
                    localStorage.setItem("user", JSON.stringify(result.user));
                    
                    alert("Kayıt başarılı! Şimdi giriş yapabilirsin.");
                    var baseUrl;
                    if (window.getBaseUrl) 
                    {
                        baseUrl=window.getBaseUrl();
                    } 
                    else 
                    {
                        baseUrl='';
                    }
                    window.location.href=`${baseUrl}/login`;
                } 
                else 
                {
                    var message;
                    if (result && result.message) 
                    {
                        message=result.message;
                    } 
                    else 
                    {
                        message="Bu e-posta zaten kayıtlı.";
                    }
                    alert(message);
                }
            } 
            catch (error) 
            {
                alert("Kayıt sırasında hata oluştu: " + error.message);
            } 
            finally 
            {
                btn.disabled = false;
                btn.textContent = oldText;
            }
        });
    }

    var verifyEmailForm=document.getElementById("verify-email-form");
    if (verifyEmailForm) 
    {
        verifyEmailForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            var code=document.getElementById("verification-code").value.trim();
            var verificationSection=document.getElementById("verification-section");
            var userDataStr;
            if (verificationSection) 
            {
                userDataStr=verificationSection.getAttribute('data-user-data');
            }
            
            if (!code || code.length !== 6) 
            {
                alert("Lütfen 6 haneli doğrulama kodunu girin.");
                return;
            }

            if (!userDataStr) 
            {
                alert("Hata: Kullanıcı bilgileri bulunamadı. Lütfen kayıt işlemini tekrar başlatın.");
                window.location.reload();
                return;
            }

            var userData=JSON.parse(userDataStr);
            var btn=this.querySelector("button[type=submit]");
            var oldText=btn.textContent;
            btn.disabled=true;
            btn.textContent="Doğrulanıyor...";

            try
            {
                var result=await window.verifyEmail(userData.email, code, userData);
                if (result && result.success) 
                {
                    localStorage.setItem("user", JSON.stringify(result.user));
                    
                    if (window.updateHeader)
                    {
                        await window.updateHeader();
                    }
                    
                    var role=result.user.role;
                    var baseUrl;
                    if (window.getBaseUrl) 
                    {
                        baseUrl=window.getBaseUrl();
                    } 
                    else 
                    {
                        baseUrl='';
                    }
                    
                    if (role === "admin") 
                    {
                        window.location.href = `${baseUrl}/admin/users`;
                    } 
                    else if (role === "seller") 
                    {
                        const sellerId = result.user.sellerId;
                        if (sellerId) 
                        {
                            window.location.href = `${baseUrl}/seller/${sellerId}/dashboard`;
                        } 
                        else 
                        {
                            window.location.href = `${baseUrl}/seller/dashboard`;
                        }
                    } 
                    else if (role === "courier") 
                    {
                        const courierId = result.user.courierId || result.user.id;
                        window.location.href = `${baseUrl}/courier/${courierId}/dashboard`;
                    } 
                    else if (role === "buyer") 
                    {
                        window.location.href = `${baseUrl}/`;
                    } 
                    else 
                    {
                        window.location.href = `${baseUrl}/`;
                    }
                } 
                else 
                {
                    alert(result?.message || "Doğrulama başarısız. Lütfen tekrar deneyin.");
                }
            } 
            catch (error) 
            {
                alert("Bir hata oluştu: " + error.message);
            } 
            finally 
            {
                btn.disabled = false;
                btn.textContent = oldText;
            }
        });
    }

    var verify2FAForm=document.getElementById("verify-2fa-form");
    if (verify2FAForm) 
        {
        verify2FAForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            var code=document.getElementById("2fa-code").value.trim();
            var twoFASection=document.getElementById("2fa-section");
            var email;
            if (twoFASection) 
            {
                email=twoFASection.getAttribute('data-email');
            }
            
            if (!code || code.length !== 6) 
            {
                alert("Lütfen 6 haneli doğrulama kodunu girin.");
                return;
            }

            if (!email) 
            {
                alert("Hata: Email bilgisi bulunamadı. Lütfen giriş işlemini tekrar başlatın.");
                window.location.reload();
                return;
            }

            var btn=this.querySelector("button[type=submit]");
            var oldText=btn.textContent;
            btn.disabled=true;
            btn.textContent="Doğrulanıyor...";

            try 
            {
                var result=await window.verify2FA(email, code);
                if (result && result.success) 
                {
                    localStorage.setItem("user", JSON.stringify(result.user));
                    
                    if (window.updateHeader) 
                    {
                        await window.updateHeader();
                    }
                    
                    var role=result.user.role;
                    var baseUrl;
                    if (window.getBaseUrl) 
                    {
                        baseUrl=window.getBaseUrl();
                    } 
                    else 
                    {
                        baseUrl='';
                    }
                    
                    if (role === "admin") 
                    {
                        window.location.href=`${baseUrl}/admin/users`;
                    } 
                    else if (role === "seller") 
                    {
                        var sellerId=result.user.sellerId;
                        if (sellerId) 
                        {
                            window.location.href=`${baseUrl}/seller/${sellerId}/dashboard`;
                        } 
                        else 
                        {
                            window.location.href=`${baseUrl}/seller/dashboard`;
                        }
                    } 
                    else if (role === "courier") 
                    {
                        var courierId=result.user.courierId || result.user.id;
                        window.location.href=`${baseUrl}/courier/${courierId}/dashboard`;
                    } 
                    else if (role === "buyer") 
                    {
                        window.location.href=`${baseUrl}/`;
                    } 
                    else 
                    {
                        window.location.href=`${baseUrl}/`;
                    }
                } 
                else 
                {
                    var message;
                    if (result && result.message) 
                    {
                        message=result.message;
                    } 
                    else 
                    {
                        message="Doğrulama başarısız. Lütfen tekrar deneyin.";
                    }
                    alert(message);
                }
            } 
            catch (error) 
            {
                alert("Bir hata oluştu: " + error.message);
            } 
            finally 
            {
                btn.disabled=false;
                btn.textContent=oldText;
            }
        });
    }

    var forgotForm=document.getElementById("forgot-password-form");
    if (forgotForm) 
    {
        forgotForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            var email=document.getElementById("email").value.trim();
            var messageDiv=document.getElementById("forgot-password-message");

            if (!email || !email.includes("@")) 
            {
                if (messageDiv) 
                {
                    messageDiv.style.display = "block";
                    messageDiv.style.backgroundColor = "#FEE2E2";
                    messageDiv.style.color = "#DC2626";
                    messageDiv.textContent = "Geçerli bir e-posta adresi girin.";
                } 
                else 
                {
                    alert("Geçerli bir e-posta adresi girin.");
                }
                return;
            }

            var btn=this.querySelector("button[type=submit]");
            var oldText=btn.textContent;
            btn.disabled=true;
            btn.textContent="Gönderiliyor...";

            if (messageDiv)
            {
                messageDiv.style.display = "none";
                messageDiv.textContent = "";
            }

            try 
            {
                var result=await window.forgotPassword(email);
                
                if (messageDiv) 
                {
                    messageDiv.style.display="block";
                    
                    if (result && result.success) 
                    {
                        messageDiv.style.backgroundColor="#D1FAE5";
                        messageDiv.style.color="#059669";
                        var msg;
                        if (result.message) 
                        {
                            msg=result.message;
                        } 
                        else 
                        {
                            msg="Şifre sıfırlama linki gönderildi. Email adresinizi kontrol edin.";
                        }
                        messageDiv.textContent=msg;
                        document.getElementById("email").value="";
                    } 
                    else 
                    {
                        messageDiv.style.backgroundColor="#FEE2E2";
                        messageDiv.style.color="#DC2626";
                        var msg2;
                        if (result && result.message) 
                        {
                            msg2=result.message;
                        } 
                        else 
                        {
                            msg2="Kayıtlı mail bulunamadı.";
                        }
                        messageDiv.textContent=msg2;
                    }
                } 
                else 
                {
                    var alertMsg;
                    if (result && result.success) 
                    {
                        if (result.message) 
                        {
                            alertMsg=result.message;
                        } 
                        else 
                        {
                            alertMsg="Şifre sıfırlama linki gönderildi. Email adresinizi kontrol edin.";
                        }
                    } 
                    else 
                    {
                        if (result && result.message) 
                        {
                            alertMsg=result.message;
                        } 
                        else 
                        {
                            alertMsg="Kayıtlı mail bulunamadı.";
                        }
                    }
                    alert(alertMsg);
                }
            } 
            catch (error) 
            {
                if (messageDiv) 
                {
                    messageDiv.style.display = "block";
                    messageDiv.style.backgroundColor = "#FEE2E2";
                    messageDiv.style.color = "#DC2626";
                    messageDiv.textContent = "Bir hata oluştu, tekrar deneyin.";
                } 
                else 
                {
                    alert("Bir hata oluştu, tekrar deneyin.");
                }
            } 
            finally 
            {
                btn.disabled=false;
                btn.textContent=oldText;
            }
        });
    }
});