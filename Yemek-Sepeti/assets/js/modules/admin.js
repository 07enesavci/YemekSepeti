/* assets/js/modules/admin.js */
// Global fonksiyonları al 
var kullanicilariGetir = window.getAllUsers;
var kullaniciEkle = window.adminAddUser;
var kullaniciDondur = window.adminSuspendUser;
var kullaniciSil = window.adminDeleteUser;
var saticilariGetir = window.getAllSellers;
var kuponEkle = window.adminAddCoupon;
var kuponlariGetir = window.getCoupons;
var kuponSil = window.adminDeleteCoupon;

function yeniId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function kullanicilariYukleVeListele() {
    if (typeof kullanicilariGetir !== 'function') return; 
    
    kullanicilariGetir()
        .then(kullaniciListesiniCiz)
        .catch(hata => console.error("Kullanıcılar yüklenemedi", hata));
}
function kullaniciListesiniCiz(kullanicilar) {
    
    const kullaniciListesiElementi = document.getElementById("user-list");
    
    if (!kullaniciListesiElementi) return;
    
    kullaniciListesiElementi.innerHTML = "";
    if (kullanicilar.length === 0) {
        kullaniciListesiElementi.innerHTML = "<p>Gösterilecek kullanıcı yok.</p>";
        return;
    }
    const belgeParcasi = document.createDocumentFragment();
    for (let i = 0; i < kullanicilar.length; i++) {
        belgeParcasi.appendChild(kullaniciSatiriOlustur(kullanicilar[i]));
    }
    
    kullaniciListesiElementi.appendChild(belgeParcasi);
}
function kullaniciSatiriOlustur(kullanici) {
    const dondurulmus = kullanici.status === 'suspended';
    const itemDiv = document.createElement('div');
    itemDiv.className = 'admin-list-item';    
    var durumYazisi = dondurulmus ? 'Donduruldu' : 'Aktif';
    var butonYazisi = dondurulmus ? 'Aktif Et' : 'Dondur';
    var durumSinifi = dondurulmus ? 'suspended' : 'active';
    
    itemDiv.innerHTML = `
        <div class="user-info">
            <strong>${kullanici.fullname}</strong>
            <span>${kullanici.email} - (Rol: ${kullanici.role})</span>
        </div>
        <div class="user-status">
            <span class="status-dot ${durumSinifi}">
                ${durumYazisi}
            </span>
        </div>
        <div class="user-actions">
            <button class="btn btn-secondary btn-sm btn-suspend" data-id="${kullanici.id}">
                ${butonYazisi}
            </button>
            <button class="btn btn-danger btn-sm btn-delete" data-id="${kullanici.id}">Sil</button>
        </div>
    `;
    return itemDiv;
}
function kullaniciEkleIslemi(e) {
    e.preventDefault(); 
    
    var fullname = document.getElementById("new-fullname").value;
    var email = document.getElementById("new-email").value;
    var password = document.getElementById("new-password").value;
    var role = document.getElementById("new-role").value;

    if (!fullname || !email || !password) {
        alert("Lütfen tüm alanları doldurun."); return;
    }
    var yeniKullanici = { id: yeniId(), fullname: fullname, email: email, password: password, role: role, status: 'active' };
    kullaniciEkle(yeniKullanici).then(function() {
        alert("Kullanıcı başarıyla eklendi!");
        kullanicilariYukleVeListele(); 
        document.getElementById("add-user-form")?.reset();
    }).catch(hata => alert(hata.message));
}
function kullaniciListesiTiklamaIslemi(e) {
    var hedef = e.target;   
    if (hedef.classList.contains('btn-suspend')) {
        kullaniciDondur(hedef.dataset.id).then(kullanicilariYukleVeListele);
        return;
    }
    if (hedef.classList.contains('btn-delete')) {
        if (confirm("Bu kullanıcıyı silmek istediğinizden emin misiniz?")) {
            kullaniciSil(hedef.dataset.id).then(kullanicilariYukleVeListele);
        }
    }
}
//KUPON YÖNETİMİ 
function saticilariYukleVeListele() {
    const listeElementi = document.getElementById("seller-checkbox-list");
    if (!listeElementi) return; 
    if (typeof getAllSellers !== 'function') {
        listeElementi.innerHTML = "<p style='color:red;'>Hata: Satıcı verisi alınamadı.</p>";
        return;
    }
    listeElementi.innerHTML = "<p>Satıcılar yükleniyor...</p>";
    saticilariGetir().then(function(saticilar) {
        var html = "";
        for (var i = 0; i < saticilar.length; i++) {
            var s = saticilar[i];
            html += '<div class="form-check">';
            html +=   '<input type="checkbox" class="seller-checkbox" id="seller-' + s.id + '" value="' + s.id + '">';
            html +=   '<label for="seller-' + s.id + '">' + s.name + '</label>';
            html += '</div>';
        }
        listeElementi.innerHTML = html;
    }).catch(hata => listeElementi.innerHTML = "<p style='color:red;'>Satıcılar yüklenemedi.</p>");
}
function kuponlariYukleVeListele() { 
    const listeKonteyneri = document.getElementById("coupon-list-container");
    if (!listeKonteyneri) 
        return; 
    if (typeof getCoupons !== 'function') {
        listeKonteyneri.innerHTML = "<p style='color:red;'>Hata: Kupon verisi alınamadı.</p>";
        return;
    }
    listeKonteyneri.innerHTML = "<p>Kuponlar yükleniyor...</p>";
    kuponlariGetir().then(function(kuponlar) {
        var html = "";
        if (kuponlar.length === 0) {
            html = "<p>Henüz tanımlanmış kupon yok.</p>";
            listeKonteyneri.innerHTML = html;
            return;
        }
        for (var i = 0; i < kuponlar.length; i++) {
            var k = kuponlar[i];
            
            var saticilarHtml = "";
            if (k.sellers && k.sellers.length > 0) {
                for (var j = 0; j < k.sellers.length; j++) {
                    saticilarHtml += '<span class="seller-tag">' + k.sellers[j] + '</span> ';
                }
            } else {
                saticilarHtml = '<span class="seller-tag">Tüm Satıcılar</span>';
            }
            html += '<div class="coupon-list-item">';
            html +=   '<div class="coupon-info"><strong>' + k.code + '</strong><span>İndirim: ' + k.amount + ' TL</span></div>';
            html +=   '<div class="coupon-sellers">' + saticilarHtml + '</div>';
            html +=   '<div class="coupon-actions">';
            html +=     '<button class="btn btn-danger btn-sm btn-delete-coupon" data-id="' + k.id + '">Sil</button>';
            html +=   '</div>';
            html += '</div>';
        }
        listeKonteyneri.innerHTML = html;
    }).catch(hata => listeKonteyneri.innerHTML = "<p style='color:red;'>Kuponlar yüklenemedi.</p>");
}
function kuponSatiriOlustur(kupon) {
}
function tumSaticilariSecIslemi(e) {
    var secildiMi = e.target.checked;
    var tumKutular = document.querySelectorAll(".seller-checkbox");    
    for (let i = 0; i < tumKutular.length; i++) {
        tumKutular[i].checked = secildiMi;
    }
}
function kuponEkleIslemi(e) {
    e.preventDefault();
    var kod = document.getElementById("coupon-code").value;
    var miktar = document.getElementById("coupon-amount").value; 
    var secilenIdler = [];
    var secilenKutular = document.querySelectorAll(".seller-checkbox:checked");
    var tumuSecili = document.getElementById("select-all-sellers").checked;
    if (!tumuSecili) {
        for (var i = 0; i < secilenKutular.length; i++) {
            secilenIdler.push(secilenKutular[i].value);
        }
        if (secilenIdler.length === 0) {
            alert("Lütfen en az bir satıcı seçin.");
            return;
        }
    }
    if (!kod || !miktar) {
        alert("Lütfen kupon kodu ve indirim miktarını girin.");
        return;
    }
    var veri = { code: kod, amount: miktar, sellerIds: secilenIdler };

    kuponEkle(veri).then(function() {
        alert("Kupon başarıyla eklendi!");
        document.getElementById("coupon-form")?.reset();
        
        document.getElementById("select-all-sellers").checked = false;
        var kutular = document.querySelectorAll(".seller-checkbox");
        for (var k = 0; k < kutular.length; k++) {
            kutular[k].checked = false;
        }
        kuponlariYukleVeListele();
    });
}
function kuponListesiTiklamaIslemi(e) {
    var hedef = e.target;
    var silButonu = hedef.closest('.btn-delete-coupon');
    
    if (silButonu) {
        var id = silButonu.getAttribute("data-id");
        if (confirm("Bu kuponu silmek istediğinizden emin misiniz?")) {
            kuponSil(id).then(function() {
                kuponlariYukleVeListele();
            });
        }
    }
}
//DOM CONTENT
document.addEventListener("DOMContentLoaded", function() {      
    // Elementler artık fonksiyonların içinde seçildiği için burası temiz
    var kullaniciListesiSayfasi = document.getElementById("user-list");
    var kullaniciEkleFormu = document.getElementById("add-user-form");
    var kuponFormuSayfasi = document.getElementById("coupon-form");
    var tumunuSecKutusu = document.getElementById("select-all-sellers");
    var kuponListesiKonteyneri = document.getElementById("coupon-list-container"); // Kontrol için tutuluyor
    // --- KULLANICI YÖNETİMİ SAYFASI ---
    if (kullaniciListesiSayfasi) {
        kullanicilariYukleVeListele();
        if(kullaniciEkleFormu) kullaniciEkleFormu.addEventListener("submit", kullaniciEkleIslemi);
        kullaniciListesiSayfasi.addEventListener("click", kullaniciListesiTiklamaIslemi);
    }
    // --- KUPON YÖNETİMİ SAYFASI ---
    if (kuponFormuSayfasi) {
        saticilariYukleVeListele(); 
        kuponlariYukleVeListele();       
        kuponFormuSayfasi.addEventListener("submit", kuponEkleIslemi);     
        if (tumunuSecKutusu) { // Güvenli kontrol
            tumunuSecKutusu.addEventListener("change", tumSaticilariSecIslemi);
        }       
        if (kuponListesiKonteyneri) { // Güvenli kontrol
            kuponListesiKonteyneri.addEventListener("click", kuponListesiTiklamaIslemi);
        }
    }
});