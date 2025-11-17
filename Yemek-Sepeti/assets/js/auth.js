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

            const btn = this.querySelector("button[type=submit]");
            const oldText = btn.textContent;
            btn.disabled = true;
            btn.textContent = "Giriş yapılıyor...";

            try {
                const result = await loginUser(email, password);
                if (result.success) {
                    localStorage.setItem("user", JSON.stringify(result.user));
                    window.location.href = "../../index.html";
                } else {
                    alert(result.message || "E-posta veya şifre hatalı.");
                }
            } catch {
                alert("Bir hata oluştu, tekrar deneyin.");
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
                const result = await registerUser({ fullname, email, password, role });
                if (result.success) {
                    alert("Kayıt başarılı! Şimdi giriş yapabilirsin.");
                    window.location.href = "login.html";
                } else {
                    alert(result.message || "Bu e-posta zaten kayıtlı.");
                }
            } catch {
                alert("Kayıt sırasında hata oluştu.");
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