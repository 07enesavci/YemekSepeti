// auth.js – Temiz, düzenli ve her sayfada sorunsuz çalışır

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
                    // Kullanıcı bilgisini ve token'ı kaydet
                    localStorage.setItem("user", JSON.stringify(result.user));
                    if (result.token) {
                        localStorage.setItem("token", result.token);
                    }
                    
                    // Rol bazlı yönlendirme
                    const role = result.user.role;
                    console.log("Yönlendirme yapılıyor, rol:", role);
                    
                    if (role === "admin") {
                        window.location.href = "/pages/admin/user-management.html";
                    } else if (role === "seller") {
                        window.location.href = "/pages/seller/dashboard.html";
                    } else if (role === "courier") {
                        window.location.href = "/pages/courier/dashboard.html";
                    } else if (role === "buyer") {
                        window.location.href = "/index.html";
                    } else {
                        // Varsayılan olarak ana sayfaya yönlendir
                        window.location.href = "/";
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
                    // Token varsa kaydet
                    if (result.token) {
                        localStorage.setItem("token", result.token);
                        localStorage.setItem("user", JSON.stringify(result.user));
                    }
                    alert("Kayıt başarılı! Şimdi giriş yapabilirsin.");
                    window.location.href = "login.html";
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