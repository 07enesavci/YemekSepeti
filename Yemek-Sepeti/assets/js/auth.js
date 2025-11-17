//login html ---------------------------------

const loginForm = document.getElementById('login-form');
loginForm.addEventListener('submit',yenileme);

function yenileme(e)
{
    e.preventDefault();
}

const eMail=document.getElementById('email').value;
const password=document.getElementById('password').value;

if(eMail == "" || password == "")
{
    alert("Lütfen tüm alanları doldurun.");
    return;
}
try
{
    const result=await loginUser(eMail,password);

    if(result.success)
    {
        alert("Giriş başarılı! Hoşgeldiniz, " + result.user.name);
        window.location.href = "index.html";
    }
    else
    {
        alert("Giriş başarısız: " + result.message);
    }
}
catch(error)
{
    alert("Bir hata oluştu: " + error.message);
}

//register html ---------------------------------

const registerForm=document.getElementById('register-form');
registerForm.addEventListener('submit',yenileme);

const fullname = document.getElementById('fullname').value.trim();
const email = document.getElementById('reg-email').value.trim();
const regPassword = document.getElementById('reg-password').value;
const confirmPassword = document.getElementById('confirm-password').value;
const role = document.getElementById('role').value;
const term = document.getElementById('terms').checked;

if(fullname === "" || email === "" || regPassword === "" || confirmPassword === "")
{
    alert("Lütfen tüm alanları doldurun.");
    return;
}
if(regPassword !== confirmPassword)
{
    alert("Şifreler eşleşmiyor.");
    return;
}
if(regPassword.length < 6)
{
    alert("Şifre en az 6 karakter olmalıdır.");
    return;
}

try
{
    const result = await registerUser({fullname, email, regPassword, role});

    if(result.success)
    {
        alert("Kayıt başarılı! Giriş yapabilirsiniz.");
        window.location.href = "login.html";
    }
    else
    {
        alert("Kayıt başarısız: " + result.message);
    }
}

catch(error)
{
    alert("Bir hata oluştu: " + error.message);
}

//forgot password html ---------------------------------

const forgotForm=document.getElementById('forgot-form');
forgotForm.addEventListener('submit',yenileme);

const forgotEmail=document.getElementById('forgot-email').value.trim();

if(forgotEmail === "" || forgotEmail.includes("@"))
{
    alert("Lütfen geçerli bir e-posta adresi girin.");
    return;
}
const forgotbtn=e.target.querySelector('button');
forgotbtn.disabled=true;
forgotbtn.innerText="Gönderiliyor...";

try
{
    const result=await sendPasswordResetEmail(forgotEmail);
    if(result.success)
    {
        alert("Şifre sıfırlama talimatları e-posta adresinize gönderildi.");
    }
    else
    {
        alert("İşlem başarısız: " + result.message);
    }
}
catch(error)
{
    alert("Bir hata oluştu: " + error.message);
}
finally
{
    forgotbtn.disabled=false;
    forgotbtn.innerText="Gönder";
}