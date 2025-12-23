// auth.js – Temiz, düzenli ve her sayfada sorunsuz çalışır
// Not: getBaseUrl ve cleanPath fonksiyonları api.js'de tanımlı (window objesine eklenmiş)

document.addEventListener("DOMContentLoaded", function () {

    // ==================== GİRİŞ SAYFASI ====================
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const email    = document.getElementById("email").value.trim();
            const password = document.getElementById("password").value;

            if (!email || !password) {
                alert("Lütfen e-posta ve şifrenizi girin.");
                return;
            }

            // Admin kontrolü artık backend'de yapılıyor, buraya gerek yok
            const btn = this.querySelector("button[type=submit]");
            const oldText = btn.textContent;
            btn.disabled = true;
            btn.textContent = "Giriş yapılıyor...";

            try {
                console.log("Login deneniyor:", email);
                const result = await window.loginUser(email, password);
                console.log("Login sonucu:", result);
                
                if (result && result.success) {
                    // 2FA kontrolü
                    if (result.requires2FA) {
                        // Login formunu gizle, 2FA formunu göster
                        document.getElementById('login-form').style.display = 'none';
                        document.getElementById('2fa-section').style.display = 'block';
                        // Email'i sakla (2FA doğrulama için)
                        document.getElementById('2fa-section').setAttribute('data-email', email);
                        return;
                    }
                    
                    // Session kullanıyoruz, localStorage'a token kaydetmeye gerek yok
                    // Sadece kullanıcı bilgisini kaydet (opsiyonel - header güncellemesi için)
                    localStorage.setItem("user", JSON.stringify(result.user));
                    // Token localStorage'a kaydedilmiyor - session cookie kullanılıyor
                    
                    // Header'ı güncelle
                    if (window.updateHeader) {
                        await window.updateHeader();
                    }
                    
                    // Rol bazlı yönlendirme (EJS route'larına göre)
                    const role = result.user.role;
                    const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                    console.log("Yönlendirme yapılıyor, rol:", role, "baseUrl:", baseUrl);
                    
                    if (role === "admin") {
                        window.location.href = `${baseUrl}/admin/users`;
                    } else if (role === "seller") {
                        // Seller ID'yi al ve dashboard'a yönlendir
                        console.log("🔍 Seller login - user data:", result.user);
                        const sellerId = result.user.sellerId;
                        
                        if (sellerId) {
                            console.log("✅ Seller ID bulundu, yönlendiriliyor:", sellerId);
                            window.location.href = `${baseUrl}/seller/${sellerId}/dashboard`;
                        } else {
                            console.log("⚠️ Seller ID yok, API'den alınıyor...");
                            // Seller ID yoksa API'den al
                            fetch(`${baseUrl}/api/auth/me`, { credentials: 'include' })
                                .then(res => res.json())
                                .then(data => {
                                    console.log("🔍 /api/auth/me response:", data);
                                    if (data.success && data.user && data.user.sellerId) {
                                        console.log("✅ Seller ID API'den alındı:", data.user.sellerId);
                                        window.location.href = `${baseUrl}/seller/${data.user.sellerId}/dashboard`;
                                    } else {
                                        console.log("⚠️ Seller ID bulunamadı, eski route'a yönlendiriliyor");
                                        window.location.href = `${baseUrl}/seller/dashboard`;
                                    }
                                })
                                .catch((err) => {
                                    console.error("❌ API hatası:", err);
                                    window.location.href = `${baseUrl}/seller/dashboard`;
                                });
                        }
                    } else if (role === "courier") {
                        // Courier ID'yi kontrol et ve dashboard'a yönlendir
                        console.log("🔍 Courier login - user data:", result.user);
                        const courierId = result.user.courierId || result.user.id;
                        
                        if (courierId) {
                            console.log("✅ Courier ID bulundu, yönlendiriliyor:", courierId);
                            window.location.href = `${baseUrl}/courier/${courierId}/dashboard`;
                        } else {
                            console.log("⚠️ Courier ID yok, API'den alınıyor...");
                            // Courier ID yoksa API'den al
                            fetch(`${baseUrl}/api/auth/me`, { credentials: 'include' })
                                .then(res => res.json())
                                .then(data => {
                                    console.log("🔍 /api/auth/me response:", data);
                                    if (data.success && data.user) {
                                        const finalCourierId = data.user.courierId || data.user.id;
                                        console.log("✅ Courier ID API'den alındı:", finalCourierId);
                                        window.location.href = `${baseUrl}/courier/${finalCourierId}/dashboard`;
                                    } else {
                                        console.log("⚠️ Courier ID bulunamadı, dashboard'a yönlendiriliyor");
                                        // Fallback: user.id kullan
                                        const fallbackId = result.user.id;
                                        window.location.href = `${baseUrl}/courier/${fallbackId}/dashboard`;
                                    }
                                })
                                .catch((err) => {
                                    console.error("❌ API hatası:", err);
                                    // Fallback: user.id kullan
                                    const fallbackId = result.user.id;
                                    window.location.href = `${baseUrl}/courier/${fallbackId}/dashboard`;
                                });
                        }
                    } else if (role === "buyer") {
                        // Redirect parametresini kontrol et
                        const urlParams = new URLSearchParams(window.location.search);
                        const redirectUrl = urlParams.get('redirect');
                        
                        if (redirectUrl) {
                            console.log("✅ Redirect parametresi bulundu, yönlendiriliyor:", redirectUrl);
                            window.location.href = redirectUrl.startsWith('/') ? `${baseUrl}${redirectUrl}` : `${baseUrl}/${redirectUrl}`;
                        } else {
                            // Ana sayfaya yönlendir
                            console.log("✅ Buyer login başarılı, ana sayfaya yönlendiriliyor");
                            window.location.href = `${baseUrl}/`;
                        }
                    } else {
                        // Varsayılan olarak ana sayfaya yönlendir
                        window.location.href = `${baseUrl}/`;
                    }
                } else {
                    alert(result?.message || "E-posta veya şifre hatalı.");
                }
            } catch (error) {
                console.error("Login catch hatası:", error);
                alert("Bir hata oluştu: " + error.message);
            } finally {
                btn.disabled = false;
                btn.textContent = oldText;
            }
        });
    }

    // ==================== KAYIT SAYFASI ====================
    const registerForm = document.getElementById("register-form");
    if (registerForm) {
        registerForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const fullname      = document.getElementById("fullname").value.trim();
            const email         = document.getElementById("email").value.trim();
            const password      = document.getElementById("password").value;
            const confirm       = document.getElementById("confirm-password").value;
            const role          = document.querySelector("input[name='user-role']:checked")?.value;
            const terms         = document.getElementById("terms").checked;

            if (!fullname || !email || !password || !confirm || !role || !terms) {
                alert("Tüm alanları doldurun ve şartları kabul edin.");
                return;
            }
            if (password !== confirm) {
                alert("Şifreler eşleşmiyor.");
                return;
            }
            if (password.length < 6) {
                alert("Şifre en az 6 karakter olmalı.");
                return;
            }

            const btn = this.querySelector("button[type=submit]");
            const oldText = btn.textContent;
            btn.disabled = true;
            btn.textContent = "Kayıt oluşturuluyor...";

            try {
                console.log("Kayıt deneniyor:", { fullname, email, role });
                const result = await window.registerUser({ fullname, email, password, role });
                console.log("Kayıt sonucu:", result);
                
                if (result && result.success) {
                    // Email doğrulama kontrolü
                    if (result.requiresVerification) {
                        // Register formunu gizle, verification formunu göster
                        document.getElementById('register-form').style.display = 'none';
                        document.getElementById('verification-section').style.display = 'block';
                        // User data'yı sakla (doğrulama sonrası kayıt için)
                        document.getElementById('verification-section').setAttribute('data-user-data', JSON.stringify({ fullname, email, password, role }));
                        return;
                    }
                    
                    // Session kullanıyoruz, localStorage'a token kaydetmeye gerek yok
                    // Sadece kullanıcı bilgisini kaydet (opsiyonel)
                    localStorage.setItem("user", JSON.stringify(result.user));
                    // Token localStorage'a kaydedilmiyor - session cookie kullanılıyor
                    
                    alert("Kayıt başarılı! Şimdi giriş yapabilirsin.");
                    const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                    window.location.href = `${baseUrl}/login`;
                } else {
                    alert(result?.message || "Bu e-posta zaten kayıtlı.");
                }
            } catch (error) {
                console.error("Register catch hatası:", error);
                alert("Kayıt sırasında hata oluştu: " + error.message);
            } finally {
                btn.disabled = false;
                btn.textContent = oldText;
            }
        });
    }

    // ==================== EMAIL DOĞRULAMA FORM ====================
    const verifyEmailForm = document.getElementById("verify-email-form");
    if (verifyEmailForm) {
        verifyEmailForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const code = document.getElementById("verification-code").value.trim();
            const verificationSection = document.getElementById("verification-section");
            const userDataStr = verificationSection?.getAttribute('data-user-data');
            
            if (!code || code.length !== 6) {
                alert("Lütfen 6 haneli doğrulama kodunu girin.");
                return;
            }

            if (!userDataStr) {
                alert("Hata: Kullanıcı bilgileri bulunamadı. Lütfen kayıt işlemini tekrar başlatın.");
                window.location.reload();
                return;
            }

            const userData = JSON.parse(userDataStr);
            const btn = this.querySelector("button[type=submit]");
            const oldText = btn.textContent;
            btn.disabled = true;
            btn.textContent = "Doğrulanıyor...";

            try {
                console.log("Email doğrulama deneniyor:", { email: userData.email, code });
                const result = await window.verifyEmail(userData.email, code, userData);
                console.log("Email doğrulama sonucu:", result);
                
                if (result && result.success) {
                    // Başarılı - kullanıcı bilgisini kaydet
                    localStorage.setItem("user", JSON.stringify(result.user));
                    
                    // Header'ı güncelle
                    if (window.updateHeader) {
                        await window.updateHeader();
                    }
                    
                    // Rol bazlı yönlendirme
                    const role = result.user.role;
                    const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                    
                    if (role === "admin") {
                        window.location.href = `${baseUrl}/admin/users`;
                    } else if (role === "seller") {
                        const sellerId = result.user.sellerId;
                        if (sellerId) {
                            window.location.href = `${baseUrl}/seller/${sellerId}/dashboard`;
                        } else {
                            window.location.href = `${baseUrl}/seller/dashboard`;
                        }
                    } else if (role === "courier") {
                        const courierId = result.user.courierId || result.user.id;
                        window.location.href = `${baseUrl}/courier/${courierId}/dashboard`;
                    } else if (role === "buyer") {
                        // Ana sayfaya yönlendir
                        window.location.href = `${baseUrl}/`;
                    } else {
                        window.location.href = `${baseUrl}/`;
                    }
                } else {
                    alert(result?.message || "Doğrulama başarısız. Lütfen tekrar deneyin.");
                }
            } catch (error) {
                console.error("Email doğrulama hatası:", error);
                alert("Bir hata oluştu: " + error.message);
            } finally {
                btn.disabled = false;
                btn.textContent = oldText;
            }
        });
    }

    // ==================== 2FA DOĞRULAMA FORM ====================
    const verify2FAForm = document.getElementById("verify-2fa-form");
    if (verify2FAForm) {
        verify2FAForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const code = document.getElementById("2fa-code").value.trim();
            const twoFASection = document.getElementById("2fa-section");
            const email = twoFASection?.getAttribute('data-email');
            
            if (!code || code.length !== 6) {
                alert("Lütfen 6 haneli doğrulama kodunu girin.");
                return;
            }

            if (!email) {
                alert("Hata: Email bilgisi bulunamadı. Lütfen giriş işlemini tekrar başlatın.");
                window.location.reload();
                return;
            }

            const btn = this.querySelector("button[type=submit]");
            const oldText = btn.textContent;
            btn.disabled = true;
            btn.textContent = "Doğrulanıyor...";

            try {
                console.log("2FA doğrulama deneniyor:", { email, code });
                const result = await window.verify2FA(email, code);
                console.log("2FA doğrulama sonucu:", result);
                
                if (result && result.success) {
                    // Başarılı - kullanıcı bilgisini kaydet
                    localStorage.setItem("user", JSON.stringify(result.user));
                    
                    // Header'ı güncelle
                    if (window.updateHeader) {
                        await window.updateHeader();
                    }
                    
                    // Rol bazlı yönlendirme
                    const role = result.user.role;
                    const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                    
                    if (role === "admin") {
                        window.location.href = `${baseUrl}/admin/users`;
                    } else if (role === "seller") {
                        const sellerId = result.user.sellerId;
                        if (sellerId) {
                            window.location.href = `${baseUrl}/seller/${sellerId}/dashboard`;
                        } else {
                            window.location.href = `${baseUrl}/seller/dashboard`;
                        }
                    } else if (role === "courier") {
                        const courierId = result.user.courierId || result.user.id;
                        window.location.href = `${baseUrl}/courier/${courierId}/dashboard`;
                    } else if (role === "buyer") {
                        // Ana sayfaya yönlendir
                        window.location.href = `${baseUrl}/`;
                    } else {
                        window.location.href = `${baseUrl}/`;
                    }
                } else {
                    alert(result?.message || "Doğrulama başarısız. Lütfen tekrar deneyin.");
                }
            } catch (error) {
                console.error("2FA doğrulama hatası:", error);
                alert("Bir hata oluştu: " + error.message);
            } finally {
                btn.disabled = false;
                btn.textContent = oldText;
            }
        });
    }

    // ==================== ŞİFREMİ UNUTTUM ====================
    const forgotForm = document.getElementById("forgot-password-form");
    if (forgotForm) {
        forgotForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const email = document.getElementById("email").value.trim();
            const messageDiv = document.getElementById("forgot-password-message");

            if (!email || !email.includes("@")) {
                if (messageDiv) {
                    messageDiv.style.display = "block";
                    messageDiv.style.backgroundColor = "#FEE2E2";
                    messageDiv.style.color = "#DC2626";
                    messageDiv.textContent = "Geçerli bir e-posta adresi girin.";
                } else {
                    alert("Geçerli bir e-posta adresi girin.");
                }
                return;
            }

            const btn = this.querySelector("button[type=submit]");
            const oldText = btn.textContent;
            btn.disabled = true;
            btn.textContent = "Gönderiliyor...";

            // Mesaj alanını temizle
            if (messageDiv) {
                messageDiv.style.display = "none";
                messageDiv.textContent = "";
            }

            try {
                const result = await window.forgotPassword(email);
                
                if (messageDiv) {
                    messageDiv.style.display = "block";
                    
                    if (result?.success) {
                        messageDiv.style.backgroundColor = "#D1FAE5";
                        messageDiv.style.color = "#059669";
                        messageDiv.textContent = result.message || "Şifre sıfırlama linki gönderildi. Email adresinizi kontrol edin.";
                        // Formu temizle
                        document.getElementById("email").value = "";
                    } else {
                        messageDiv.style.backgroundColor = "#FEE2E2";
                        messageDiv.style.color = "#DC2626";
                        messageDiv.textContent = result?.message || "Kayıtlı mail bulunamadı.";
                    }
                } else {
                    // Fallback: alert kullan
                    alert(result?.success 
                        ? (result.message || "Şifre sıfırlama linki gönderildi. Email adresinizi kontrol edin.") 
                        : (result?.message || "Kayıtlı mail bulunamadı.")
                    );
                }
            } catch (error) {
                console.error("Forgot password error:", error);
                if (messageDiv) {
                    messageDiv.style.display = "block";
                    messageDiv.style.backgroundColor = "#FEE2E2";
                    messageDiv.style.color = "#DC2626";
                    messageDiv.textContent = "Bir hata oluştu, tekrar deneyin.";
                } else {
                    alert("Bir hata oluştu, tekrar deneyin.");
                }
            } finally {
                btn.disabled = false;
                btn.textContent = oldText;
            }
        });
    }
});

