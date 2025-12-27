document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const email = document.getElementById("email").value.trim();
            const password = document.getElementById("password").value;

            if (!email || !password) {
                alert("Lütfen e-posta ve şifrenizi girin.");
                return;
            }

            const btn = this.querySelector("button[type=submit]");
            const oldText = btn.textContent;
            btn.disabled = true;
            btn.textContent = "Giriş yapılıyor...";

            try {
                console.log('🔑 Login işlemi başlatıldı:', email);
                const result = await loginUser(email, password);
                console.log('✅ Login sonuç:', result?.success);
                
                if (result && result.success) {
                    localStorage.setItem("user", JSON.stringify(result.user));
                    
                    if (window.updateHeader) {
                        await window.updateHeader();
                    }
                    
                    const role = result.user.role;
                    const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                    console.log('🔀 Yönlendirme - Rol:', role);
                    
                    if (role === "admin") {
                        window.location.href = `${baseUrl}/admin/users`;
                    } else if (role === "seller") {
                        const sellerId = result.user.sellerId;
                        if (sellerId) {
                            window.location.href = `${baseUrl}/seller/${sellerId}/dashboard`;
                        } else {
                            fetch(`${baseUrl}/api/auth/me`, { credentials: 'include' })
                                .then(res => res.json())
                                .then(data => {
                                    if (data.success && data.user && data.user.sellerId) {
                                        window.location.href = `${baseUrl}/seller/${data.user.sellerId}/dashboard`;
                                    } else {
                                        window.location.href = `${baseUrl}/seller/dashboard`;
                                    }
                                })
                                .catch(() => window.location.href = `${baseUrl}/seller/dashboard`);
                        }
                    } else if (role === "courier") {
                        const courierId = result.user.courierId || result.user.id;
                        window.location.href = `${baseUrl}/courier/${courierId}/dashboard`;
                    } else {
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