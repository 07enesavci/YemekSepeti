var kullanicilariGetir = window.getAllUsers;
var kullaniciEkle = window.adminAddUser;
var kullaniciDondur = window.adminSuspendUser;
var kullaniciSil = window.adminDeleteUser;
var saticilariGetir = window.getAllSellers;
var kuponEkle = window.adminAddCoupon;
var kuponlariGetir = window.getCoupons;
var kuponSil = window.adminDeleteCoupon;

function yeniId() 
{
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}


function kullanicilariYukleVeListele() 
{
    console.log('kullanicilariYukleVeListele çağrıldı');
    
    if (typeof kullanicilariGetir !== 'function') 
    {
        console.error('kullanicilariGetir fonksiyonu bulunamadı!');
        return; 
    }
    
    console.log('API çağrısı yapılıyor...');
    kullanicilariGetir()
        .then(kullanicilar => {
            var uzunluk;
            if (kullanicilar && kullanicilar.length) 
            {
                uzunluk=kullanicilar.length;
            } 
            else 
            {
                uzunluk=0;
            }
            console.log('API çağrısı başarılı, kullanıcı sayısı:', uzunluk);
            kullaniciListesiniCiz(kullanicilar);
        })
        .catch(hata => {
            console.error("Kullanıcılar yüklenemedi:", hata);
            console.error("Hata detayı:", hata.message, hata.stack);
        });
}

function kullaniciListesiniCiz(kullanicilar) 
{
    var uzunluk;
    if (kullanicilar && kullanicilar.length) 
    {
        uzunluk=kullanicilar.length;
    } 
    else 
    {
        uzunluk=0;
    }
    console.log('kullaniciListesiniCiz çağrıldı, kullanıcı sayısı:', uzunluk);
    
    var kullaniciListesiElementi=document.getElementById("user-list");
    
    if (!kullaniciListesiElementi) 
    {
        console.error('user-list elementi bulunamadı!');
        return;
    }
    
    kullaniciListesiElementi.innerHTML="";
    
    if (!kullanicilar || kullanicilar.length === 0) 
    {
        console.warn('Kullanıcı listesi boş');
        kullaniciListesiElementi.innerHTML="<p>Gösterilecek kullanıcı yok.</p>";
        return;
    }
    
    console.log(kullanicilar.length, 'kullanıcı render edilecek');
    var belgeParcasi=document.createDocumentFragment();
    for (let i=0; i<kullanicilar.length; i++) 
    {
        belgeParcasi.appendChild(kullaniciSatiriOlustur(kullanicilar[i]));
    }
    
    kullaniciListesiElementi.appendChild(belgeParcasi);
}

function kullaniciSatiriOlustur(kullanici) 
{
    var dondurulmus=kullanici.status === 'suspended' || kullanici.is_active === 0 || kullanici.is_active === false;
    
    var itemDiv=document.createElement('div');
    itemDiv.className='admin-list-item';    
    var durumYazisi;
    if (dondurulmus) 
    {
        durumYazisi='Donduruldu';
    } 
    else 
    {
        durumYazisi='Aktif';
    }
    var butonYazisi;
    if (dondurulmus) 
    {
        butonYazisi='Aktif Et';
    } 
    else 
    {
        butonYazisi='Dondur';
    }
    var durumSinifi;
    if (dondurulmus) 
    {
        durumSinifi='suspended';
    } 
    else 
    {
        durumSinifi='active';
    }
    
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

function kullaniciEkleIslemi(e) 
{
    e.preventDefault(); 
    
    var fullname=document.getElementById("new-fullname").value;
    var email=document.getElementById("new-email").value;
    var password=document.getElementById("new-password").value;
    var role=document.getElementById("new-role").value;

    if (!fullname || !email || !password) 
    {
        alert("Lütfen tüm alanları doldurun."); 
        return;
    }
    
    var yeniKullanici={ fullname: fullname, email: email, password: password, role: role };
    
    kullaniciEkle(yeniKullanici).then(function(response) 
    {
        if(response.success === false) 
        {
             alert("Hata: " + response.message);
        } 
        else 
        {
             alert("Kullanıcı başarıyla eklendi!");
             kullanicilariYukleVeListele(); 
             document.getElementById("add-user-form")?.reset();
        }
    }).catch(hata => alert("Bir hata oluştu: " + hata.message));
}

function kullaniciListesiTiklamaIslemi(e) 
{
    var hedef=e.target;   
    if (hedef.classList.contains('btn-suspend')) 
    {
        kullaniciDondur(hedef.dataset.id).then(kullanicilariYukleVeListele);
        return;
    }
    if (hedef.classList.contains('btn-delete')) 
    {
        if (confirm("Bu kullanıcıyı silmek istediğinizden emin misiniz?")) 
        {
            kullaniciSil(hedef.dataset.id).then(kullanicilariYukleVeListele);
        }
    }
}

function saticilariYukleVeListele() 
{
    var listeElementi=document.getElementById("seller-checkbox-list");
    if (!listeElementi) return; 
    
    if (typeof saticilariGetir !== 'function') 
    {
        listeElementi.innerHTML="<p style='color:red;'>Hata: Satıcı verisi alınamadı.</p>";
        return;
    }
    
    listeElementi.innerHTML="<p>Satıcılar yükleniyor...</p>";
    
    saticilariGetir().then(function(saticilar) 
    {
        var html="";
        if(!saticilar || saticilar.length === 0) 
        {
            listeElementi.innerHTML = "<p>Kayıtlı satıcı bulunamadı.</p>";
            return;
        }

        for (var i=0; i < saticilar.length; i++) 
        {
            var s=saticilar[i];
            var gorunenIsim=s.shop_name || s.name || s.fullname || "İsimsiz Satıcı"; 
            
            html += '<div class="form-check">';
            html +=   '<input type="checkbox" class="seller-checkbox" id="seller-' + s.id + '" value="' + s.id + '">';
            html +=   '<label for="seller-' + s.id + '">' + gorunenIsim + '</label>';
            html += '</div>';
        }
        listeElementi.innerHTML = html;
    }).catch(hata => listeElementi.innerHTML = "<p style='color:red;'>Satıcılar yüklenemedi.</p>");
}

function kuponlariYukleVeListele() 
{ 
    var listeKonteyneri=document.getElementById("coupon-list-container");
    if (!listeKonteyneri) return; 
    
    if (typeof kuponlariGetir !== 'function') 
    {
        listeKonteyneri.innerHTML="<p style='color:red;'>Hata: Kupon verisi alınamadı.</p>";
        return;
    }
    
    listeKonteyneri.innerHTML="<p>Kuponlar yükleniyor...</p>";
    
    kuponlariGetir().then(function(kuponlar) 
    {
        var html="";
        if (!kuponlar || kuponlar.length === 0) 
        {
            html = "<p>Henüz tanımlanmış kupon yok.</p>";
            listeKonteyneri.innerHTML = html;
            return;
        }
        
        for (var i=0; i < kuponlar.length; i++) 
        {
            var k=kuponlar[i];
            
            var saticilarHtml="";

            var saticiListesi=k.sellerIds || k.sellers || [];
            
            if (typeof saticiListesi === 'string') 
            {
                try { saticiListesi = JSON.parse(saticiListesi); } catch(e) {}
            }

            if (saticiListesi && saticiListesi.length > 0) 
            {

                saticilarHtml = '<span class="seller-tag">' + saticiListesi.length + ' Satıcıda Geçerli</span> ';
            } 
            else 
            {
                saticilarHtml='<span class="seller-tag">Tüm Satıcılar</span>';
            }
            
            var indirimText;
            if ((k.discountType || k.discount_type || 'fixed') === 'percentage') 
            {
                indirimText='%' + (k.discountValue || k.amount);
            } 
            else 
            {
                indirimText=(k.discountValue || k.amount) + ' TL';
            }
            
            var minTutar=k.minOrderAmount || k.min_order_amount || 0;
            var gecerlilik=k.validUntil || k.valid_until || '';
            var gecerlilikTarihi;
            if (gecerlilik) 
            {
                gecerlilikTarihi=new Date(gecerlilik).toLocaleDateString('tr-TR');
            } 
            else 
            {
                gecerlilikTarihi='';
            }
            var kullanim=(k.usedCount || k.used_count || 0);
            if (k.usageLimit && k.usageLimit > 0) 
            {
                kullanim+=' / ' + k.usageLimit;
            } 
            else 
            {
                kullanim+=' / Sınırsız';
            }
            
            html += '<div class="coupon-list-item" style="padding: 1.5rem; margin-bottom: 1rem;">';
            html +=   '<div class="coupon-info" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">';
            html +=     '<div>';
            html +=       '<strong style="font-size: 1.2rem; color: var(--primary-color);">' + k.code + '</strong>';
            if (k.description) 
            {
                html+='<p class="coupon-meta" style="margin: 0.25rem 0;">' + k.description + '</p>';
            }
            html +=     '</div>';
            html +=     '<div style="text-align: right;">';
            html +=       '<div style="font-size: 1.5rem; font-weight: bold; color: var(--primary-color);">' + indirimText + '</div>';
            html +=       '<div class="coupon-meta" style="font-size: 0.85rem;">İndirim</div>';
            html +=     '</div>';
            html +=   '</div>';
            html +=   '<div class="coupon-sellers" style="margin-bottom: 0.5rem;">' + saticilarHtml + '</div>';
            html+=   '<div class="coupon-meta" style="display: flex; gap: 1rem; font-size: 0.9rem; margin-bottom: 1rem; flex-wrap: wrap;">';
            html+=     '<span>Min. Tutar: ' + minTutar + ' TL</span>';
            html+=     '<span>•</span>';
            html+=     '<span>Kullanım: ' + kullanim + '</span>';
            if (gecerlilikTarihi) 
            {
                html+='<span>•</span><span>Geçerli: ' + gecerlilikTarihi + '</span>';
            }
            html+=   '</div>';
            html +=   '<div class="coupon-actions" style="display: flex; justify-content: flex-end;">';
            html +=     '<button class="btn btn-danger btn-sm btn-delete-coupon" data-id="' + k.id + '">Sil</button>';
            html +=   '</div>';
            html += '</div>';
        }
        listeKonteyneri.innerHTML = html;
    }).catch(hata => {
        console.error(hata);
        listeKonteyneri.innerHTML = "<p style='color:red;'>Kuponlar yüklenemedi.</p>";
    });
}

function tumSaticilariSecIslemi(e) 
{
    var secildiMi=e.target.checked;
    var tumKutular=document.querySelectorAll(".seller-checkbox");    
    for (let i=0; i<tumKutular.length; i++) 
    {
        tumKutular[i].checked=secildiMi;
    }
}

function kuponEkleIslemi(e) 
{
    e.preventDefault();
    var kod=document.getElementById("coupon-code").value.trim();
    var aciklama;
    if (document.getElementById("coupon-description")) 
    {
        aciklama=document.getElementById("coupon-description").value.trim();
    } 
    else 
    {
        aciklama='';
    }
    var indirimTuru;
    if (document.getElementById("discount-type")) 
    {
        indirimTuru=document.getElementById("discount-type").value;
    } 
    else 
    {
        indirimTuru='fixed';
    }
    var miktar=parseFloat(document.getElementById("coupon-amount").value);
    var minSiparis;
    if (document.getElementById("min-order-amount")) 
    {
        minSiparis=parseFloat(document.getElementById("min-order-amount").value);
    } 
    else 
    {
        minSiparis=0;
    }
    var maxIndirim;
    if (document.getElementById("max-discount-amount") && document.getElementById("max-discount-amount").value) 
    {
        maxIndirim=parseFloat(document.getElementById("max-discount-amount").value);
    } 
    else 
    {
        maxIndirim=null;
    }
    var gecerlilikGun;
    if (document.getElementById("valid-days")) 
    {
        gecerlilikGun=parseInt(document.getElementById("valid-days").value);
    } 
    else 
    {
        gecerlilikGun=30;
    }
    var secilenIdler=[];
    
    var secilenKutular=document.querySelectorAll(".seller-checkbox:checked");
    var tumuSecili=document.getElementById("select-all-sellers").checked;
    
    if (!tumuSecili) 
    {
        for (var i=0; i < secilenKutular.length; i++) 
        {
            secilenIdler.push(parseInt(secilenKutular[i].value));
        }
        if (secilenIdler.length === 0) 
        {
            if(!confirm("Hiçbir satıcı seçmediniz. Bu kupon TÜM satıcılarda geçerli olsun mu?")) 
            {
                 return;
            }
        }
    } 
    else 
    {
        secilenIdler = [];
    }

    if (!kod || !miktar || miktar <= 0) 
    {
        alert("Lütfen geçerli bir kupon kodu ve indirim miktarı girin.");
        return;
    }
    
    if (indirimTuru === 'percentage' && (miktar <= 0 || miktar > 100)) 
    {
        alert("Yüzde indirim değeri 1-100 arası olmalıdır.");
        return;
    }
    
    var veri={ 
        code: kod,
        description: aciklama || null,
        discountType: indirimTuru,
        discountValue: miktar,
        amount: miktar,
        minOrderAmount: minSiparis,
        maxDiscountAmount: maxIndirim,
        validDays: gecerlilikGun,
        sellerIds: secilenIdler 
    };

    kuponEkle(veri).then(function(res) 
    {
        if(res.success) 
        {
            alert("Kupon başarıyla eklendi!");
            document.getElementById("coupon-form")?.reset();
            document.getElementById("max-discount-group").style.display='none';
            document.getElementById("select-all-sellers").checked=false;
            var kutular=document.querySelectorAll(".seller-checkbox");
            for (var k=0; k < kutular.length; k++) 
            {
                kutular[k].checked=false;
            }
            kuponlariYukleVeListele();
        } 
        else 
        {
            alert("Hata: " + res.message);
        }
    });
}

function kuponListesiTiklamaIslemi(e) 
{
    var hedef=e.target;
    var silButonu=hedef.closest('.btn-delete-coupon');
    
    if (silButonu) 
    {
        var id=silButonu.getAttribute("data-id");
        if (confirm("Bu kuponu silmek istediğinizden emin misiniz?")) 
        {
            kuponSil(id).then(function() 
            {
                kuponlariYukleVeListele();
            });
        }
    }
}

document.addEventListener("DOMContentLoaded", function() 
{      
    var kullaniciListesiSayfasi=document.getElementById("user-list");
    var kullaniciEkleFormu=document.getElementById("add-user-form");
    var kuponFormuSayfasi=document.getElementById("coupon-form");
    var tumunuSecKutusu=document.getElementById("select-all-sellers");
    var kuponListesiKonteyneri=document.getElementById("coupon-list-container");

    if (kullaniciListesiSayfasi) 
    {
        kullanicilariYukleVeListele();
        if(kullaniciEkleFormu) kullaniciEkleFormu.addEventListener("submit", kullaniciEkleIslemi);
        kullaniciListesiSayfasi.addEventListener("click", kullaniciListesiTiklamaIslemi);
    }
    
    if (kuponFormuSayfasi) 
    {
        saticilariYukleVeListele(); 
        kuponlariYukleVeListele();       
        kuponFormuSayfasi.addEventListener("submit", kuponEkleIslemi);     
        
        if (tumunuSecKutusu) 
        {
            tumunuSecKutusu.addEventListener("change", tumSaticilariSecIslemi);
        }       
        if (kuponListesiKonteyneri) 
        { 
            kuponListesiKonteyneri.addEventListener("click", kuponListesiTiklamaIslemi);
        }
        if (discountTypeSelect && maxDiscountGroup) 
        {
            discountTypeSelect.addEventListener("change", function(e) 
            {
                if (e.target.value === 'percentage') 
                {
                    maxDiscountGroup.style.display = 'block';
                } 
                else 
                {
                    maxDiscountGroup.style.display = 'none';
                }
            });
        }
    }
});