/**
 * API İletişim Fonksiyonları
 */

// Giriş Yapma
async function loginUser(email, password) {
    const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
    const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    return response.json();
}

// Kayıt Olma (FormData - Dosya Destekli)
async function registerUser(formData) {
    const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
    const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        // DİKKAT: FormData gönderirken Content-Type header'ı eklenmez!
        body: formData 
    });
    return response.json();
}

// Şifremi Unuttum
async function forgotPassword(email) {
    const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
    const response = await fetch(`${baseUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });
    return response.json();
}

/**
 * Sayfa Etkileşimleri
 */
document.addEventListener("DOMContentLoaded", function () {
    
    // --- GİRİŞ FORMU ---
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
                const result = await loginUser(email, password);
                if (result && result.success) {
                    localStorage.setItem("user", JSON.stringify(result.user));
                    const role = result.user.role;
                    const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                    
                    // Rol bazlı yönlendirme
                    if (role === "admin") window.location.href = `${baseUrl}/admin/users`;
                    else if (role === "seller") window.location.href = `${baseUrl}/seller/dashboard`;
                    else if (role === "courier") {
                        const courierId = result.user.courierId || result.user.id;
                        window.location.href = `${baseUrl}/courier/${courierId}/dashboard`;
                    }
                    else window.location.href = `${baseUrl}/`;
                } else {
                    alert(result?.message || "Hatalı giriş.");
                }
            } catch (error) {
                alert("Bağlantı hatası: " + error.message);
            } finally {
                btn.disabled = false;
                btn.textContent = oldText;
            }
        });
    }

    // --- KAYIT FORMU VE SATICI BELGELERİ ---
    const registerForm = document.getElementById("register-form");
    const roleRadios = document.querySelectorAll("input[name='user-role']");
    const sellerDocsSection = document.getElementById("seller-docs");

    // Rol seçimine göre belge alanını göster/gizle
    if (roleRadios.length > 0 && sellerDocsSection) {
        roleRadios.forEach(radio => {
            radio.addEventListener("change", function(e) {
                if (e.target.value === "seller") {
                    sellerDocsSection.style.display = "block";
                    sellerDocsSection.querySelectorAll("input[type='file']").forEach(i => i.required = true);
                } else {
                    sellerDocsSection.style.display = "none";
                    sellerDocsSection.querySelectorAll("input[type='file']").forEach(i => i.required = false);
                }
            });
        });
    }

    if (registerForm) {
        registerForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const fullname = document.getElementById("fullname").value.trim();
            const email = document.getElementById("email").value.trim();
            const password = document.getElementById("password").value;
            const confirm = document.getElementById("confirm-password").value;
            const role = document.querySelector("input[name='user-role']:checked")?.value;
            const terms = document.getElementById("terms").checked;

            if (!fullname || !email || !password || !confirm || !role || !terms) {
                alert("Lütfen tüm alanları doldurun.");
                return;
            }
            if (password !== confirm) { alert("Şifreler eşleşmiyor."); return; }

            // FormData oluşturma
            const formData = new FormData();
            formData.append("fullname", fullname);
            formData.append("email", email);
            formData.append("password", password);
            formData.append("role", role);

            // Satıcı belgeleri ekleme
            if (role === "seller") {
                const taxPlate = document.querySelector("input[name='taxPlate']").files[0];
                const idCard = document.querySelector("input[name='idCard']").files[0];
                const activityCert = document.querySelector("input[name='activityCert']").files[0];
                const businessLicense = document.querySelector("input[name='businessLicense']").files[0];

                if (!taxPlate || !idCard || !activityCert || !businessLicense) {
                    alert("Satıcı için tüm belgeler zorunludur.");
                    return;
                }
                formData.append("taxPlate", taxPlate);
                formData.append("idCard", idCard);
                formData.append("activityCert", activityCert);
                formData.append("businessLicense", businessLicense);
            }

            const btn = this.querySelector("button[type=submit]");
            const oldText = btn.textContent;
            btn.disabled = true;
            btn.textContent = "Kayıt oluşturuluyor...";

            try {
                const result = await registerUser(formData);
                if (result && result.success) {
                    alert("Kayıt başarılı!");
                    window.location.href = `/login`;
                } else {
                    alert(result?.message || "Kayıt hatası.");
                }
            } catch (error) {
                alert("Sunucu hatası: " + error.message);
            } finally {
                btn.disabled = false;
                btn.textContent = oldText;
            }
        });
    }

    // --- ŞİFRE SIFIRLAMA ---
    const forgotForm = document.getElementById("forgot-password-form");
    if (forgotForm) {
        forgotForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const email = document.getElementById("email").value.trim();
            try {
                const result = await forgotPassword(email);
                alert(result?.message || "İşlem tamamlandı.");
            } catch {
                alert("Hata oluştu.");
            }
        });
    }
});