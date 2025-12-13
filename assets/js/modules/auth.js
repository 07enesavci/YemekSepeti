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
                const result = await loginUser(email, password);
                console.log("Login sonucu:", result);
                
                if (result && result.success) {
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
                            // Buyer ID'yi al ve profile'a yönlendir
                            console.log("🔍 Buyer login - user data:", result.user);
                            const userId = result.user.id;
                            
                            if (userId) {
                                console.log("✅ Buyer ID bulundu, profile'a yönlendiriliyor:", userId);
                                window.location.href = `${baseUrl}/buyer/${userId}/profile`;
                            } else {
                                console.log("⚠️ Buyer ID yok, ana sayfaya yönlendiriliyor");
                                window.location.href = `${baseUrl}/`;
                            }
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
                const result = await registerUser({ fullname, email, password, role });
                console.log("Kayıt sonucu:", result);
                
                if (result && result.success) {
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

    // ==================== ŞİFREMİ UNUTTUM ====================
    const forgotForm = document.getElementById("forgot-password-form");
    if (forgotForm) {
        forgotForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const email = document.getElementById("email").value.trim();

            if (!email || !email.includes("@")) {
                alert("Geçerli bir e-posta adresi girin.");
                return;
            }

            const btn = this.querySelector("button[type=submit]");
            const oldText = btn.textContent;
            btn.disabled = true;
            btn.textContent = "Gönderiliyor...";

            try {
                const result = await forgotPassword(email);
                alert(result?.success 
                    ? "Şifre sıfırlama linki gönderildi ✓" 
                    : result?.message || "Bu e-posta kayıtlı değil."
                );
            } catch {
                alert("Bir hata oluştu, tekrar deneyin.");
            } finally {
                btn.disabled = false;
                btn.textContent = oldText;
            }
        });
    }
});

