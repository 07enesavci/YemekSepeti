var kullanicilariGetir = window.getAllUsers;
var kullaniciEkle = window.adminAddUser;
var kullaniciDondur = window.adminSuspendUser;
var kullaniciSil = window.adminDeleteUser;
var saticilariGetir = window.getAllSellers;
var kuponEkle = window.adminAddCoupon;
var kuponGuncelle = window.adminUpdateCoupon;
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
    
    var rolYazi = (kullanici.role === 'seller') ? 'Satıcı' : (kullanici.role === 'courier') ? 'Kurye' : (kullanici.role || '');
    itemDiv.innerHTML = `
        <div class="user-info">
            <strong>${kullanici.fullname || '-'}</strong>
            <span>${kullanici.email || ''} – ${rolYazi}</span>
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
        var editList = document.getElementById("edit-coupon-seller-list");
        if (editList) editList.innerHTML = html.replace(/id="seller-/g, 'id="edit-seller-').replace(/for="seller-/g, 'for="edit-seller-');
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
        if (!Array.isArray(kuponlar)) 
        {
            kuponlar = [];
        }
        if (kuponlar.length === 0) 
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
                saticilarHtml = '<span class="seller-tag">' + saticiListesi.length + ' restoranda geçerli</span> ';
            } 
            else 
            {
                saticilarHtml = '<span class="seller-tag">Tüm restoranlarda geçerli</span>';
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
            html +=   '<div class="coupon-actions" style="display: flex; justify-content: flex-end; gap: 0.5rem;">';
            html +=     '<button type="button" class="btn btn-secondary btn-sm btn-edit-coupon" data-id="' + k.id + '" data-code="' + (k.code || '').replace(/"/g, '&quot;') + '" data-description="' + (k.description || '').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '" data-discount-type="' + (k.discountType || k.discount_type || 'fixed') + '" data-discount-value="' + (k.discountValue != null ? k.discountValue : k.discount_value) + '" data-min-order="' + (k.minOrderAmount != null ? k.minOrderAmount : k.min_order_amount) + '" data-max-discount="' + (k.maxDiscountAmount != null ? k.maxDiscountAmount : k.max_discount_amount || '') + '" data-seller-ids="' + (Array.isArray(k.sellerIds) ? k.sellerIds.join(',') : (Array.isArray(k.applicable_seller_ids) ? k.applicable_seller_ids.join(',') : '')) + '">Düzenle</button>';
            html +=     '<button class="btn btn-danger btn-sm btn-delete-coupon" data-id="' + k.id + '">Sil</button>';
            html +=   '</div>';
            html += '</div>';
        }
        listeKonteyneri.innerHTML = html;
    }).catch(hata => {
        console.error(hata);
        listeKonteyneri.innerHTML = "<p style='color:red;'>Kuponlar yüklenemedi. Veritabanı bağlantısını kontrol edin veya sayfayı yenileyin.</p>";
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
    var duzenleButonu=hedef.closest('.btn-edit-coupon');
    
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
        return;
    }
    if (duzenleButonu) 
    {
        var id=duzenleButonu.getAttribute("data-id");
        var code=duzenleButonu.getAttribute("data-code") || '';
        var description=duzenleButonu.getAttribute("data-description") || '';
        var discountType=duzenleButonu.getAttribute("data-discount-type") || 'fixed';
        var discountValue=duzenleButonu.getAttribute("data-discount-value") || '0';
        var minOrder=duzenleButonu.getAttribute("data-min-order") || '0';
        var maxDiscount=duzenleButonu.getAttribute("data-max-discount") || '';
        var sellerIdsStr=duzenleButonu.getAttribute("data-seller-ids") || '';
        openCouponEditModal(id, { code: code, description: description, discountType: discountType, discountValue: discountValue, minOrderAmount: minOrder, maxDiscountAmount: maxDiscount, sellerIds: sellerIdsStr ? sellerIdsStr.split(',').map(function(x){ return parseInt(x,10); }).filter(function(x){ return !isNaN(x); }) : [] });
    }
}

function openCouponEditModal(couponId, data) 
{
    var modal=document.getElementById("coupon-edit-modal");
    if (!modal) return;
    document.getElementById("edit-coupon-id").value=couponId;
    document.getElementById("edit-coupon-code").value=data.code||'';
    document.getElementById("edit-coupon-description").value=data.description||'';
    document.getElementById("edit-coupon-discount-type").value=data.discountType||'fixed';
    document.getElementById("edit-coupon-amount").value=data.discountValue||'';
    document.getElementById("edit-coupon-min-order").value=data.minOrderAmount||'0';
    document.getElementById("edit-coupon-max-discount").value=data.maxDiscountAmount||'';
    var checkboxes=document.querySelectorAll("#coupon-edit-modal .seller-checkbox");
    var ids=(data.sellerIds||[]).map(Number);
    if (checkboxes.length) checkboxes.forEach(function(cb){ cb.checked=ids.indexOf(parseInt(cb.value,10))!==-1; });
    modal.style.display="block";
}

function closeCouponEditModal() 
{
    var modal=document.getElementById("coupon-edit-modal");
    if (modal) modal.style.display="none";
}

function kuponDuzenleIslemi(e) 
{
    e.preventDefault();
    var id=document.getElementById("edit-coupon-id").value;
    if (!id) return;
    var code=document.getElementById("edit-coupon-code").value.trim();
    var description=document.getElementById("edit-coupon-description").value.trim();
    var discountType=document.getElementById("edit-coupon-discount-type").value;
    var amount=parseFloat(document.getElementById("edit-coupon-amount").value);
    var minOrder=parseFloat(document.getElementById("edit-coupon-min-order").value)||0;
    var maxDiscountEl=document.getElementById("edit-coupon-max-discount");
    var maxDiscount=maxDiscountEl&&maxDiscountEl.value?parseFloat(maxDiscountEl.value):null;
    var sellerIds=[];
    document.querySelectorAll("#coupon-edit-modal .seller-checkbox:checked").forEach(function(cb){ sellerIds.push(parseInt(cb.value,10)); });
    if (!code||isNaN(amount)||amount<=0) { alert("Kupon kodu ve geçerli indirim değeri girin."); return; }
    kuponGuncelle(id, { code: code, description: description||null, discountType: discountType, discountValue: amount, minOrderAmount: minOrder, maxDiscountAmount: maxDiscount, sellerIds: sellerIds }).then(function(res){
        if (res.success) { alert(res.message); closeCouponEditModal(); kuponlariYukleVeListele(); }
        else { alert(res.message||"Güncelleme başarısız."); }
    });
}

document.addEventListener("DOMContentLoaded", function() 
{      
    var kullaniciListesiSayfasi=document.getElementById("user-list");
    var kullaniciEkleFormu=document.getElementById("add-user-form");
    var kuponFormuSayfasi=document.getElementById("coupon-form");
    var tumunuSecKutusu=document.getElementById("select-all-sellers");
    var kuponListesiKonteyneri=document.getElementById("coupon-list-container");
    var discountTypeSelect=document.getElementById("discount-type");
    var maxDiscountGroup=document.getElementById("max-discount-group");

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
        var couponEditForm = document.getElementById("coupon-edit-form");
        var couponEditCancel = document.getElementById("coupon-edit-cancel");
        var couponEditModal = document.getElementById("coupon-edit-modal");
        if (couponEditForm) couponEditForm.addEventListener("submit", kuponDuzenleIslemi);
        if (couponEditCancel) couponEditCancel.addEventListener("click", closeCouponEditModal);
        if (couponEditModal) couponEditModal.addEventListener("click", function(e) { if (e.target === couponEditModal) closeCouponEditModal(); });
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