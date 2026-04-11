document.addEventListener("DOMContentLoaded", function () 
{
    function buyerHasSavedDeliveryArea() {
        try {
            var raw = localStorage.getItem("ys_delivery_area");
            if (!raw) return false;
            var o = JSON.parse(raw);
            return !!(o && o.il && String(o.il).trim() && o.ilce && String(o.ilce).trim() &&
                o.mahalle && String(o.mahalle).trim() && o.cadde && String(o.cadde).trim());
        } catch (e) {
            return false;
        }
    }
    function promptBuyerDeliveryAfterAuthIfNeeded() {
        try {
            if (!buyerHasSavedDeliveryArea()) {
                sessionStorage.setItem("ys_prompt_buyer_delivery", "1");
            }
        } catch (e) {}
    }

    var queryParams=new URLSearchParams(window.location.search);
    var googleErrorCode=queryParams.get("googleError");
    if (googleErrorCode) {
        var googleErrorMessages={
            not_configured: "Google ile giriş şu anda aktif değil. Lütfen daha sonra tekrar deneyin.",
            access_denied: "Google giriş izni verilmedi.",
            invalid_state: "Google giriş doğrulaması başarısız oldu. Lütfen tekrar deneyin.",
            token_exchange_failed: "Google doğrulama adımı tamamlanamadı.",
            token_missing: "Google oturum bilgisi alınamadı.",
            profile_fetch_failed: "Google profil bilgileri alınamadı.",
            email_missing: "Google hesabınızdan e-posta bilgisi alınamadı.",
            account_not_found: "Bu Google hesabı ile eşleşen bir kullanıcı bulunamadı. Lütfen kayıt olun.",
            inactive_account: "Hesabınız pasif durumda. Destek ile iletişime geçin.",
            oauth_failed: "Google ile giriş sırasında bir hata oluştu.",
            wrong_role_partner: "Bu Google hesabı partner (satıcı/kurye) hesabı değil. Partner için kayıtlı e-posta ile giriş yapın.",
            wrong_role_buyer: "Bu Google hesabı alıcı hesabı değil. Müşteri sitesinde alıcı olarak kayıtlı hesapla deneyin.",
            partner_use_email: "Partner kaydı Google ile otomatik açılmaz. Lütfen e-posta ile kayıt olun; ardından girişte Google kullanabilirsiniz."
        };
        alert(googleErrorMessages[googleErrorCode] || "Google ile işlem sırasında bir hata oluştu.");
        queryParams.delete("googleError");
        var updatedQuery=queryParams.toString();
        var cleanUrl=window.location.pathname+(updatedQuery ? "?"+updatedQuery : "")+(window.location.hash || "");
        window.history.replaceState({}, document.title, cleanUrl);
    }

    var loginForm=document.getElementById("login-form");
    if (loginForm) 
    {
        loginForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            var email=document.getElementById("email").value.trim();
            var password=document.getElementById("password").value;
            var rememberMe=document.getElementById("remember-me")?document.getElementById("remember-me").checked:false;

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
                var result=await window.loginUser(email, password, rememberMe);
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
                    if (role === "admin" || role === "super_admin" || role === "support") 
                    {
                        window.location.href=`${baseUrl}/admin/users`;
                    } 
                    else if (role === "seller") 
                    {
                        var sellerId=result.user.sellerId;
                        if (!sellerId)
                        {
                            window.location.href=`${baseUrl}/register/documents`;
                        }
                        else if (result.user.sellerApproved === false)
                        {
                            window.location.href=`${baseUrl}/seller/pending-approval`;
                        }
                        else if (sellerId) 
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
                        if (!result.user.courierId)
                        {
                            window.location.href=`${baseUrl}/register/documents`;
                        }
                        else if (result.user.courierApproved === false)
                        {
                            window.location.href=`${baseUrl}/courier/pending-approval`;
                        }
                        else
                        {
                            window.location.href=`${baseUrl}/courier/${courierId}/dashboard`;
                        }
                    } 
                    else if (role === "buyer")
                    {
                        promptBuyerDeliveryAfterAuthIfNeeded();
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
                var result=await window.registerUser({ email });
                if (result && result.success) 
                {
                    if (result.requiresVerification) 
                    {
                        document.getElementById('register-form').style.display='none';
                        document.getElementById('verification-section').style.display='block';
                        document.getElementById('verification-section').setAttribute('data-user-data', JSON.stringify({ fullname, email, password, role }));
                        startVerificationCountdown();
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
                    if (window.updateHeader) await window.updateHeader();
                    var baseUrl=window.getBaseUrl ? window.getBaseUrl() : '';
                    if (result.needsDocuments && result.redirectUrl) 
                    {
                        window.location.href=baseUrl + result.redirectUrl;
                        return;
                    }
                    var role=result.user.role;
                    if (role === "admin" || role === "super_admin" || role === "support") window.location.href=baseUrl + "/admin/users";
                    else if (role === "buyer") window.location.href=baseUrl + "/";
                    else window.location.href=baseUrl + "/";
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

    // --- 5 Dakika Geri Sayım Sayacı ---
    var countdownInterval = null;
    var COUNTDOWN_TOTAL = 300; // 5 dakika = 300 saniye
    var RING_CIRCUMFERENCE = 213.628; // 2 * PI * 34

    function startVerificationCountdown() {
        // Önceki sayacı temizle
        if (countdownInterval) clearInterval(countdownInterval);

        var remaining = COUNTDOWN_TOTAL;
        var ring = document.getElementById('countdown-ring');
        var text = document.getElementById('countdown-text');
        var label = document.getElementById('countdown-label');
        var expiredMsg = document.getElementById('code-expired-msg');
        var submitBtn = document.getElementById('verify-submit-btn');
        var codeInput = document.getElementById('verification-code');
        var container = document.getElementById('countdown-container');

        // Sayacı sıfırla
        if (ring) { ring.style.strokeDashoffset = '0'; ring.style.stroke = '#e63946'; }
        if (text) { text.style.color = '#e63946'; text.style.animation = 'none'; }
        if (expiredMsg) expiredMsg.style.display = 'none';
        if (container) container.style.display = 'flex';
        if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = '1'; }
        if (codeInput) { codeInput.disabled = false; codeInput.value = ''; }

        updateCountdownDisplay(remaining, ring, text, label);

        countdownInterval = setInterval(function () {
            remaining--;
            updateCountdownDisplay(remaining, ring, text, label);

            if (remaining <= 0) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                onCountdownExpired(ring, text, label, expiredMsg, submitBtn, codeInput, container);
            }
        }, 1000);
    }

    function updateCountdownDisplay(remaining, ring, text, label) {
        var minutes = Math.floor(remaining / 60);
        var seconds = remaining % 60;
        var display = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
        if (text) text.textContent = display;

        // Progress ring güncellemesi
        if (ring) {
            var progress = 1 - (remaining / COUNTDOWN_TOTAL);
            ring.style.strokeDashoffset = (RING_CIRCUMFERENCE * progress).toString();

            // Son 60 saniyede renk değişimi (turuncu)
            if (remaining <= 60 && remaining > 10) {
                ring.style.stroke = '#f4845f';
                if (text) text.style.color = '#f4845f';
            }
            // Son 10 saniyede kırmızı yanıp sönme
            if (remaining <= 10) {
                ring.style.stroke = '#d00000';
                if (text) {
                    text.style.color = '#d00000';
                    text.style.animation = 'countdown-blink 0.5s ease-in-out infinite';
                }
            } else if (text) {
                text.style.animation = 'none';
            }
        }
    }

    function onCountdownExpired(ring, text, label, expiredMsg, submitBtn, codeInput, container) {
        if (text) { text.textContent = '0:00'; text.style.color = '#999'; text.style.animation = 'none'; }
        if (ring) { ring.style.stroke = '#ccc'; }
        if (label) label.textContent = 'Süre doldu';
        if (expiredMsg) expiredMsg.style.display = 'block';
        if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.5'; }
        if (codeInput) { codeInput.disabled = true; }
    }

    // --- Kodu Tekrar Gönder Butonu ---
    var resendBtn = document.getElementById('resend-code');
    if (resendBtn) {
        resendBtn.addEventListener('click', async function () {
            var verificationSection = document.getElementById('verification-section');
            var userDataStr = verificationSection ? verificationSection.getAttribute('data-user-data') : null;
            if (!userDataStr) {
                alert('Hata: Kullanıcı bilgileri bulunamadı. Lütfen kayıt işlemini tekrar başlatın.');
                window.location.reload();
                return;
            }
            var userData = JSON.parse(userDataStr);
            var oldText = resendBtn.textContent;
            resendBtn.disabled = true;
            resendBtn.textContent = 'Gönderiliyor...';

            try {
                var result = await window.registerUser({ email: userData.email });
                if (result && result.success) {
                    startVerificationCountdown();
                    alert('Yeni doğrulama kodu gönderildi!');
                } else {
                    alert(result?.message || 'Kod gönderilemedi. Tekrar deneyin.');
                }
            } catch (error) {
                alert('Bir hata oluştu: ' + error.message);
            } finally {
                resendBtn.disabled = false;
                resendBtn.textContent = oldText;
            }
        });
    }

    // Yanıp sönme animasyonu için dinamik stil ekle
    if (!document.getElementById('countdown-blink-style')) {
        var style = document.createElement('style');
        style.id = 'countdown-blink-style';
        style.textContent = '@keyframes countdown-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }';
        document.head.appendChild(style);
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
                    
                    if (role === "admin" || role === "super_admin" || role === "support") 
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
                        promptBuyerDeliveryAfterAuthIfNeeded();
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

    // --- ŞİFRE SIFIRLAMA FORMU (reset-password) ---
    var resetForm=document.getElementById("reset-password-form");
    if (resetForm) 
    {
        resetForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            var password=document.getElementById("password").value;
            var confirmPassword=document.getElementById("confirm-password").value;
            var messageDiv=document.getElementById("reset-password-message");

            // Validasyonlar
            if (!password || !confirmPassword) 
            {
                if (messageDiv) 
                {
                    messageDiv.style.display = "block";
                    messageDiv.style.backgroundColor = "#FEE2E2";
                    messageDiv.style.color = "#DC2626";
                    messageDiv.textContent = "Lütfen tüm alanları doldurun.";
                } 
                else 
                {
                    alert("Lütfen tüm alanları doldurun.");
                }
                return;
            }

            if (password.length < 6) 
            {
                if (messageDiv) 
                {
                    messageDiv.style.display = "block";
                    messageDiv.style.backgroundColor = "#FEE2E2";
                    messageDiv.style.color = "#DC2626";
                    messageDiv.textContent = "Şifre en az 6 karakter olmalıdır.";
                } 
                else 
                {
                    alert("Şifre en az 6 karakter olmalıdır.");
                }
                return;
            }

            if (password !== confirmPassword) 
            {
                if (messageDiv) 
                {
                    messageDiv.style.display = "block";
                    messageDiv.style.backgroundColor = "#FEE2E2";
                    messageDiv.style.color = "#DC2626";
                    messageDiv.textContent = "Şifreler eşleşmiyor.";
                } 
                else 
                {
                    alert("Şifreler eşleşmiyor.");
                }
                return;
            }

            // URL'den token'ı al
            var urlParams = new URLSearchParams(window.location.search);
            var token = urlParams.get("token");

            if (!token) 
            {
                if (messageDiv) 
                {
                    messageDiv.style.display = "block";
                    messageDiv.style.backgroundColor = "#FEE2E2";
                    messageDiv.style.color = "#DC2626";
                    messageDiv.textContent = "Geçersiz sıfırlama bağlantısı. Lütfen yeni bir bağlantı isteyin.";
                } 
                else 
                {
                    alert("Geçersiz sıfırlama bağlantısı.");
                }
                return;
            }

            var btn=this.querySelector("button[type=submit]");
            var oldText=btn.textContent;
            btn.disabled=true;
            btn.textContent="Şifre sıfırlanıyor...";

            if (messageDiv) 
            {
                messageDiv.style.display = "none";
                messageDiv.textContent = "";
            }

            try 
            {
                var result=await window.resetPassword(token, password);
                
                if (messageDiv) 
                {
                    messageDiv.style.display="block";
                    
                    if (result && result.success) 
                    {
                        messageDiv.style.backgroundColor="#D1FAE5";
                        messageDiv.style.color="#059669";
                        messageDiv.textContent=result.message || "Şifreniz başarıyla güncellendi!";
                        
                        // Formu gizle, 3 saniye sonra giriş sayfasına yönlendir
                        resetForm.style.display = "none";
                        setTimeout(function() {
                            var baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                            window.location.href = baseUrl + "/login";
                        }, 3000);
                    } 
                    else 
                    {
                        messageDiv.style.backgroundColor="#FEE2E2";
                        messageDiv.style.color="#DC2626";
                        messageDiv.textContent=result && result.message ? result.message : "Şifre sıfırlama başarısız.";
                    }
                } 
                else 
                {
                    if (result && result.success) 
                    {
                        alert(result.message || "Şifreniz güncellendi!");
                        var baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                        window.location.href = baseUrl + "/login";
                    } 
                    else 
                    {
                        alert(result && result.message ? result.message : "Şifre sıfırlama başarısız.");
                    }
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