var kullanicilariGetir = window.getAllUsers;
var kullaniciEkle = window.adminAddUser;
var kullaniciDondur = window.adminSuspendUser;
var kullaniciSil = window.adminDeleteUser;
var saticilariGetir = window.getAllSellers;
var kuponEkle = window.adminAddCoupon;
var kuponGuncelle = window.adminUpdateCoupon;
var kuponlariGetir = window.getCoupons;
var kuponSil = window.adminDeleteCoupon;

var currentRoleFilter = 'buyer';
var currentStatusFilter = 'all'; // all | active | suspended | deleted
var tumKullanicilar = [];

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
            tumKullanicilar = kullanicilar || [];
            console.log('API çağrısı başarılı, toplam kullanıcı sayısı:', tumKullanicilar.length);
            listeyiFiltreleVeCiz();
        })
        .catch(hata => {
            console.error("Kullanıcılar yüklenemedi:", hata);
            console.error("Hata detayı:", hata.message, hata.stack);
        });
}

function listeyiFiltreleVeCiz()
{
    var filtrelenmis = tumKullanicilar.filter(function(k) {
        // Rol filtresi
        var rolEslesiyor;
        if (currentRoleFilter === 'buyer') {
            rolEslesiyor = k.role === 'user' || k.role === 'buyer' || !k.role;
        } else {
            rolEslesiyor = k.role === currentRoleFilter;
        }
        if (!rolEslesiyor) return false;
        // Durum filtresi
        if (currentStatusFilter === 'active')    return k.status === 'active';
        if (currentStatusFilter === 'suspended') return k.status === 'suspended';
        if (currentStatusFilter === 'deleted')   return k.status === 'deleted';
        return true; // 'all'
    });
    kullaniciListesiniCiz(filtrelenmis);
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
    var silinmis = kullanici.status === 'deleted';
    var dondurulmus = !silinmis && (kullanici.status === 'suspended' || kullanici.is_active === 0 || kullanici.is_active === false);

    var itemDiv=document.createElement('div');
    itemDiv.className='admin-list-item';
    if (silinmis) itemDiv.style.opacity = '0.65';

    var durumYazisi = silinmis ? '🗑 Silinmiş' : (dondurulmus ? 'Donduruldu' : 'Aktif');
    var butonYazisi = dondurulmus ? 'Aktif Et' : 'Dondur';
    var durumSinifi = silinmis ? 'deleted' : (dondurulmus ? 'suspended' : 'active');
    
    var rolYazi = (kullanici.role === 'seller') ? 'Satıcı' : (kullanici.role === 'courier') ? 'Kurye' : 'Müşteri';

    // XSS önlemi: Kullanıcı verisi textContent ile ekleniyor, innerHTML'e ham veri yazılmıyor
    var userInfoDiv = document.createElement('div');
    userInfoDiv.className = 'user-info';
    var strongEl = document.createElement('strong');
    strongEl.textContent = kullanici.fullname || kullanici.name || '-';
    var spanEl = document.createElement('span');
    spanEl.textContent = (kullanici.email || '') + ' – ' + rolYazi;
    userInfoDiv.appendChild(strongEl);
    userInfoDiv.appendChild(spanEl);

    var userStatusDiv = document.createElement('div');
    userStatusDiv.className = 'user-status';
    var statusSpan = document.createElement('span');
    statusSpan.className = 'status-dot ' + durumSinifi;
    statusSpan.textContent = durumYazisi;
    userStatusDiv.appendChild(statusSpan);

    var userActionsDiv = document.createElement('div');
    userActionsDiv.className = 'user-actions';
    if (!silinmis) {
        var suspendBtn = document.createElement('button');
        suspendBtn.className = 'btn btn-secondary btn-sm btn-suspend';
        suspendBtn.dataset.id = kullanici.id;
        suspendBtn.textContent = butonYazisi;
        userActionsDiv.appendChild(suspendBtn);

        var deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger btn-sm btn-delete';
        deleteBtn.dataset.id = kullanici.id;
        deleteBtn.textContent = 'Sil';
        userActionsDiv.appendChild(deleteBtn);
    } else {
        var deletedLabel = document.createElement('span');
        deletedLabel.textContent = 'Hesap silinmiş';
        deletedLabel.style.cssText = 'font-size:0.8rem;color:#999;font-style:italic;';
        userActionsDiv.appendChild(deletedLabel);
    }

    itemDiv.appendChild(userInfoDiv);
    itemDiv.appendChild(userStatusDiv);
    itemDiv.appendChild(userActionsDiv);
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
             window.showAlert("Hata: " + response.message);
        } 
        else 
        {
             window.showAlert("Kullanıcı başarıyla eklendi!");
             kullanicilariYukleVeListele(); 
             document.getElementById("add-user-form")?.reset();
        }
    }).catch(hata => window.showAlert("Bir hata oluştu: " + hata.message));
}

async function kullaniciListesiTiklamaIslemi(e) 
{
    var hedef=e.target;   
    if (hedef.classList.contains('btn-suspend')) 
    {
        kullaniciDondur(hedef.dataset.id).then(kullanicilariYukleVeListele);
        return;
    }
    if (hedef.classList.contains('btn-delete')) 
    {
        const result = await window.showConfirm("Bu kullanıcıyı silmek istediğinizden emin misiniz?");
        if (result) {
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
        if(!saticilar || saticilar.length === 0)
        {
            listeElementi.innerHTML = "<p>Kayıtlı satıcı bulunamadı.</p>";
            var editListBos = document.getElementById("edit-coupon-seller-list");
            if (editListBos) editListBos.innerHTML = "<p>Kayıtlı satıcı bulunamadı.</p>";
            return;
        }

        // XSS önlemi: satıcı adı textContent ile ekleniyor, innerHTML'e ham veri yazılmıyor
        function saticiCheckboxListesiOlustur(idOnEki)
        {
            var belgeParcasi = document.createDocumentFragment();
            for (var i=0; i < saticilar.length; i++)
            {
                var s=saticilar[i];
                var gorunenIsim=s.shop_name || s.name || s.fullname || "İsimsiz Satıcı";

                var wrapper=document.createElement('div');
                wrapper.className='form-check';

                var checkbox=document.createElement('input');
                checkbox.type='checkbox';
                checkbox.className='seller-checkbox';
                checkbox.id=idOnEki + s.id;
                checkbox.value=s.id;

                var label=document.createElement('label');
                label.setAttribute('for', idOnEki + s.id);
                label.textContent=gorunenIsim;

                wrapper.appendChild(checkbox);
                wrapper.appendChild(label);
                belgeParcasi.appendChild(wrapper);
            }
            return belgeParcasi;
        }

        listeElementi.innerHTML="";
        listeElementi.appendChild(saticiCheckboxListesiOlustur('seller-'));

        var editList = document.getElementById("edit-coupon-seller-list");
        if (editList) {
            editList.innerHTML="";
            editList.appendChild(saticiCheckboxListesiOlustur('edit-seller-'));
        }
    }).catch(hata => listeElementi.innerHTML = "<p style='color:red;'>Satıcılar yüklenemedi.</p>");
}

// Aktif kupon filtresi durumu
var _kuponFilter = 'all';

function kuponlariYukleVeListele(filter)
{
    if (filter !== undefined) _kuponFilter = filter;
    var listeKonteyneri=document.getElementById("coupon-list-container");
    if (!listeKonteyneri) return;

    if (typeof kuponlariGetir !== 'function')
    {
        listeKonteyneri.innerHTML="<p style='color:red;'>Hata: Kupon verisi alınamadı.</p>";
        return;
    }

    // Filtre sekmelerini render et (yoksa ekle)
    var filterBar = document.getElementById('coupon-filter-bar');
    if (!filterBar) {
        filterBar = document.createElement('div');
        filterBar.id = 'coupon-filter-bar';
        filterBar.style.cssText = 'display:flex;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap;';
        var filters = [
            { key: 'all', label: 'Tümü' },
            { key: 'active', label: '✅ Aktif' },
            { key: 'inactive', label: '🚫 Pasif' },
            { key: 'expired', label: '⏰ Süresi Dolmuş' }
        ];
        filters.forEach(function(f) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = f.label;
            btn.dataset.filterKey = f.key;
            btn.className = 'btn btn-sm ' + (f.key === _kuponFilter ? 'btn-primary' : 'btn-secondary');
            btn.addEventListener('click', function() {
                document.querySelectorAll('#coupon-filter-bar button').forEach(function(b){ b.className = 'btn btn-sm btn-secondary'; });
                btn.className = 'btn btn-sm btn-primary';
                kuponlariYukleVeListele(f.key);
            });
            filterBar.appendChild(btn);
        });
        listeKonteyneri.parentNode.insertBefore(filterBar, listeKonteyneri);
    }

    listeKonteyneri.innerHTML="<p>Kuponlar yükleniyor...</p>";

    // Filter parametresi ile API çağrısı
    var fetchUrl = (window.getApiBaseUrl ? window.getApiBaseUrl() : '') +
        '/api/admin/coupons?limit=200' +
        (_kuponFilter && _kuponFilter !== 'all' ? '&filter=' + _kuponFilter : '');

    fetch(fetchUrl, { credentials: 'include', headers: window.getAuthHeaders ? window.getAuthHeaders() : {} })
        .then(function(r){ return r.json(); })
        .then(function(data) { return Array.isArray(data) ? data : (data.coupons || []); })
        .then(function(kuponlar)
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

async function kuponEkleIslemi(e) 
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
            const isConfirmed = await window.showConfirm("Hiçbir satıcı seçmediniz. Bu kupon TÜM satıcılarda geçerli olsun mu?");
            if(!isConfirmed) 
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
            window.showAlert("Hata: " + res.message);
        }
    });
}

async function kuponListesiTiklamaIslemi(e)
{
    var hedef=e.target;
    var silButonu=hedef.closest('.btn-delete-coupon');
    var duzenleButonu=hedef.closest('.btn-edit-coupon');

    if (silButonu)
    {
        var id=silButonu.getAttribute("data-id");
        const isConfirmed = await window.showConfirm("Bu kuponu silmek istediğinizden emin misiniz?");
        if (isConfirmed) {
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
    
    // YS-Select için UI güncellemesi ve ilk init garantisi
    if (window.initYsSelects) {
        window.initYsSelects(modal);
        var selectEl = document.getElementById("edit-coupon-discount-type");
        if (selectEl && selectEl.syncCustomUI) {
            selectEl.syncCustomUI();
        }
    }
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
    if (!code||isNaN(amount)||amount<=0) { window.showAlert("Kupon kodu ve geçerli indirim değeri girin."); return; }
    kuponGuncelle(id, { code: code, description: description||null, discountType: discountType, discountValue: amount, minOrderAmount: minOrder, maxDiscountAmount: maxDiscount, sellerIds: sellerIds }).then(function(res){
        if (res.success) { window.showAlert(res.message); closeCouponEditModal(); kuponlariYukleVeListele(); }
        else { window.showAlert(res.message||"Güncelleme başarısız."); }
    });
}

// ============================================================
// ADMİN SİPARİŞ YÖNETİMİ
// ============================================================
var ADMIN_ORDER_STATUS = {
    pending:     { label: 'Beklemede',      color: '#92400e', bg: '#fef3c7' },
    confirmed:   { label: 'Onaylandı',      color: '#1e40af', bg: '#dbeafe' },
    preparing:   { label: 'Hazırlanıyor',   color: '#3730a3', bg: '#e0e7ff' },
    ready:       { label: 'Hazır',          color: '#065f46', bg: '#d1fae5' },
    on_delivery: { label: 'Kuryede',        color: '#9a3412', bg: '#ffedd5' },
    delivered:   { label: 'Teslim Edildi',  color: '#374151', bg: '#f3f4f6' },
    cancelled:   { label: 'İptal Edildi',   color: '#991b1b', bg: '#fee2e2' }
};
// Sipariş akışında bir sonraki adım (müdahale kısayolu için)
var ADMIN_ORDER_NEXT = {
    pending: 'confirmed', confirmed: 'preparing', preparing: 'ready',
    ready: 'on_delivery', on_delivery: 'delivered'
};
var adminOrderCurrentGroup = 'all';
var adminOrderSearch = '';
var adminOrdersCache = [];

function adminOrderStatusBadge(status) {
    var s = ADMIN_ORDER_STATUS[status] || { label: status, color: '#374151', bg: '#f3f4f6' };
    return '<span class="admin-order-badge" style="color:' + s.color + ';background:' + s.bg + ';">' + s.label + '</span>';
}

function adminEscape(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function(c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}

function adminOrdersYukle() {
    var listEl = document.getElementById('admin-orders-list');
    if (!listEl) return;
    if (typeof window.getAdminOrders !== 'function') {
        listEl.innerHTML = '<p style="color:#b91c1c;">Sipariş API bulunamadı.</p>';
        return;
    }
    listEl.innerHTML = '<p style="color:var(--text-color-light);">Siparişler yükleniyor…</p>';
    var opts = { limit: 100 };
    if (adminOrderCurrentGroup && adminOrderCurrentGroup !== 'all') opts.group = adminOrderCurrentGroup;
    if (adminOrderSearch) opts.search = adminOrderSearch;
    window.getAdminOrders(opts).then(function(res) {
        if (!res || !res.success) {
            listEl.innerHTML = '<p style="color:#b91c1c;">Siparişler yüklenemedi.</p>';
            return;
        }
        adminOrdersCache = res.data || [];
        adminOrdersCiz(adminOrdersCache);
    });
}

function adminOrdersCiz(list) {
    var listEl = document.getElementById('admin-orders-list');
    if (!listEl) return;
    if (!list || list.length === 0) {
        listEl.innerHTML = '<p style="color:var(--text-color-light);">Bu filtrede sipariş bulunmuyor.</p>';
        return;
    }
    var fmt = window.formatTL || function(n){ return (n||0) + ' ₺'; };
    var html = '';
    list.forEach(function(o) {
        var buyerName = o.buyer ? adminEscape(o.buyer.fullname || o.buyer.email || 'Müşteri') : 'Müşteri';
        var shop = o.seller ? adminEscape(o.seller.shopName || '-') : '-';
        var courierTxt = o.courier ? ('🛵 ' + adminEscape(o.courier.fullname)) : '';
        var dateTxt = o.createdAt ? new Date(o.createdAt).toLocaleString('tr-TR') : '';
        html += '<div class="admin-order-card">'
            + '<div class="admin-order-card-head">'
            + '<div><strong>#' + adminEscape(o.orderNumber || o.id) + '</strong> &nbsp; ' + adminOrderStatusBadge(o.status) + '</div>'
            + '<div><strong>' + fmt(o.totalAmount) + '</strong></div>'
            + '</div>'
            + '<div class="admin-order-meta">👤 ' + buyerName + ' &nbsp;•&nbsp; 🏪 ' + shop + (courierTxt ? ' &nbsp;•&nbsp; ' + courierTxt : '') + '</div>'
            + '<div class="admin-order-meta">' + dateTxt + '</div>'
            + '<div class="admin-order-actions">'
            + '<button type="button" class="btn btn-sm btn-secondary" data-order-detail="' + o.id + '">Detay / Müdahale</button>'
            + '</div>'
            + '</div>';
    });
    listEl.innerHTML = html;
}

function adminOrderModalAc(order) {
    var modal = document.getElementById('admin-order-modal');
    var body = document.getElementById('admin-order-modal-body');
    var footer = document.getElementById('admin-order-modal-footer');
    var titleEl = document.getElementById('admin-order-modal-title');
    if (!modal || !body || !footer) return;
    var fmt = window.formatTL || function(n){ return (n||0) + ' ₺'; };

    titleEl.textContent = 'Sipariş #' + (order.orderNumber || order.id);

    var itemsHtml = '';
    if (order.items && order.items.length) {
        itemsHtml = '<ul style="margin:0.4rem 0 0;padding-left:1.1rem;">' + order.items.map(function(it) {
            return '<li>' + adminEscape(it.name) + ' × ' + it.quantity + ' — ' + fmt(it.price * it.quantity) + '</li>';
        }).join('') + '</ul>';
    } else {
        itemsHtml = '<span style="color:var(--text-color-light);">Kalem bilgisi yok</span>';
    }

    var addrHtml = order.address
        ? adminEscape([order.address.title, order.address.fullAddress, [order.address.district, order.address.city].filter(Boolean).join(', ')].filter(Boolean).join(' — '))
        : '<span style="color:var(--text-color-light);">Adres yok</span>';

    body.innerHTML =
        '<div class="admin-order-meta" style="margin-bottom:0.5rem;">Durum: ' + adminOrderStatusBadge(order.status) + '</div>'
        + '<div class="admin-order-meta"><strong>Müşteri:</strong> ' + (order.buyer ? adminEscape(order.buyer.fullname || '-') + (order.buyer.phone ? ' (' + adminEscape(order.buyer.phone) + ')' : '') : '-') + '</div>'
        + '<div class="admin-order-meta"><strong>Satıcı:</strong> ' + (order.seller ? adminEscape(order.seller.shopName || '-') : '-') + '</div>'
        + '<div class="admin-order-meta"><strong>Kurye:</strong> ' + (order.courier ? adminEscape(order.courier.fullname) + (order.courier.phone ? ' (' + adminEscape(order.courier.phone) + ')' : '') : 'Atanmadı') + '</div>'
        + '<div class="admin-order-meta"><strong>Teslimat:</strong> ' + addrHtml + '</div>'
        + '<div class="admin-order-meta"><strong>Tutar:</strong> ' + fmt(order.totalAmount) + (order.deliveryFee ? ' (' + (order.deliveryType === 'cargo' ? 'kargo' : 'teslimat') + ' ' + fmt(order.deliveryFee) + ')' : '') + '</div>'
        + (order.deliveryType === 'cargo'
            ? '<div class="admin-order-meta"><strong>Kargo:</strong> ' + (order.cargoCompany ? adminEscape(order.cargoCompany) : 'Firma girilmedi')
                + (order.cargoTrackingNumber
                    ? ' — Takip: ' + (order.cargoTrackingUrl
                        ? '<a href="' + adminEscape(order.cargoTrackingUrl) + '" target="_blank" rel="noopener noreferrer">' + adminEscape(order.cargoTrackingNumber) + '</a>'
                        : adminEscape(order.cargoTrackingNumber))
                    : '')
                + '</div>'
            : '')
        + '<div class="admin-order-meta"><strong>Ürünler:</strong> ' + itemsHtml + '</div>';

    // Müdahale butonları
    footer.innerHTML = '';
    var isFinal = order.status === 'delivered' || order.status === 'cancelled';

    if (!isFinal) {
        var next = ADMIN_ORDER_NEXT[order.status];
        if (next) {
            var advBtn = document.createElement('button');
            advBtn.type = 'button';
            advBtn.className = 'btn btn-sm btn-primary';
            advBtn.textContent = '→ ' + (ADMIN_ORDER_STATUS[next] ? ADMIN_ORDER_STATUS[next].label : next) + ' yap';
            advBtn.addEventListener('click', function() { adminOrderDurumDegistir(order.id, next); });
            footer.appendChild(advBtn);
        }
        var cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn btn-sm btn-danger';
        cancelBtn.textContent = 'Siparişi İptal Et';
        cancelBtn.style.background = '#dc2626';
        cancelBtn.style.color = '#fff';
        cancelBtn.addEventListener('click', async function() {
            var ok = await window.showConfirm('Bu sipariş iptal edilecek. Ödeme iadesi ve kupon iadesi otomatik yapılacaktır. Onaylıyor musunuz?');
            if (ok) adminOrderDurumDegistir(order.id, 'cancelled');
        });
        footer.appendChild(cancelBtn);
    } else {
        var infoEl = document.createElement('span');
        infoEl.style.cssText = 'color:var(--text-color-light);font-size:0.85rem;align-self:center;';
        infoEl.textContent = order.status === 'delivered' ? 'Sipariş tamamlandı.' : 'Sipariş iptal edildi.';
        footer.appendChild(infoEl);
    }

    // Manuel durum seçimi (herhangi bir adıma müdahale)
    var sel = document.createElement('select');
    sel.className = 'form-input';
    sel.style.cssText = 'flex:1 1 100%;margin-top:0.5rem;';
    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Durumu elle değiştir…';
    sel.appendChild(placeholder);
    Object.keys(ADMIN_ORDER_STATUS).forEach(function(st) {
        if (st === order.status) return;
        var opt = document.createElement('option');
        opt.value = st;
        opt.textContent = ADMIN_ORDER_STATUS[st].label;
        sel.appendChild(opt);
    });
    sel.addEventListener('change', async function() {
        if (!sel.value) return;
        var target = sel.value;
        if (target === 'cancelled') {
            var ok = await window.showConfirm('Bu sipariş iptal edilecek. Ödeme/kupon iadesi otomatik yapılacaktır. Onaylıyor musunuz?');
            if (!ok) { sel.value = ''; return; }
        }
        adminOrderDurumDegistir(order.id, target);
    });
    footer.appendChild(sel);

    modal.style.display = 'flex';
}

function adminOrderModalKapat() {
    var modal = document.getElementById('admin-order-modal');
    if (modal) modal.style.display = 'none';
}

function adminOrderDurumDegistir(orderId, status) {
    if (typeof window.updateAdminOrderStatus !== 'function') return;
    window.updateAdminOrderStatus(orderId, status).then(function(res) {
        if (res && res.success) {
            window.showAlert(res.message || 'Sipariş durumu güncellendi.');
            adminOrderModalKapat();
            adminOrdersYukle();
        } else {
            window.showAlert((res && res.message) || 'Durum güncellenemedi.');
        }
    });
}

function adminOrdersInit() {
    var listEl = document.getElementById('admin-orders-list');
    if (!listEl) return;

    // Filtre butonları
    var filterBar = document.getElementById('admin-order-filter-bar');
    if (filterBar) {
        filterBar.addEventListener('click', function(e) {
            var btn = e.target.closest('button[data-group]');
            if (!btn) return;
            adminOrderCurrentGroup = btn.getAttribute('data-group') || 'all';
            filterBar.querySelectorAll('button').forEach(function(b) { b.className = 'btn btn-sm btn-secondary'; });
            btn.className = 'btn btn-sm btn-primary';
            adminOrdersYukle();
        });
    }

    // Arama (debounce)
    var searchEl = document.getElementById('admin-order-search');
    if (searchEl) {
        var t = null;
        searchEl.addEventListener('input', function() {
            adminOrderSearch = searchEl.value.trim();
            clearTimeout(t);
            t = setTimeout(adminOrdersYukle, 350);
        });
    }

    // Detay/müdahale
    listEl.addEventListener('click', function(e) {
        var btn = e.target.closest('button[data-order-detail]');
        if (!btn) return;
        var id = parseInt(btn.getAttribute('data-order-detail'), 10);
        var order = adminOrdersCache.find(function(o) { return o.id === id; });
        if (order) adminOrderModalAc(order);
    });

    // Modal kapatma
    var closeBtn = document.getElementById('admin-order-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', adminOrderModalKapat);
    var modal = document.getElementById('admin-order-modal');
    if (modal) modal.addEventListener('click', function(e) { if (e.target === modal) adminOrderModalKapat(); });

    adminOrdersYukle();
}

// ============================================================
// ADMİN ÖNERİ / ŞİKAYET YÖNETİMİ
// ============================================================
var ADMIN_FB_STATUS = {
    open:      { label: 'Açık',        color: '#92400e', bg: '#fef3c7' },
    in_review: { label: 'İnceleniyor', color: '#1e40af', bg: '#dbeafe' },
    resolved:  { label: 'Çözüldü',     color: '#065f46', bg: '#d1fae5' }
};
var ADMIN_FB_TYPE = {
    suggestion: { label: '💡 Öneri',   color: '#065f46', bg: '#d1fae5' },
    complaint:  { label: '⚠️ Şikayet', color: '#991b1b', bg: '#fee2e2' }
};
var ADMIN_FB_ROLE = { buyer: '👤 Alıcı', seller: '🏪 Satıcı', courier: '🛵 Kurye' };

var adminFbType = 'all', adminFbRole = 'all', adminFbStatus = 'all', adminFbSearch = '';
var adminFbCache = [];
var adminFbSelectedId = null;

function adminFbChip(map, key) {
    var s = map[key] || { label: key, color: '#374151', bg: '#f3f4f6' };
    return '<span class="admin-fb-chip" style="color:' + s.color + ';background:' + s.bg + ';">' + s.label + '</span>';
}

function adminFeedbackYukle() {
    var listEl = document.getElementById('admin-fb-list');
    if (!listEl || typeof window.getAdminFeedback !== 'function') return;
    listEl.innerHTML = '<p class="admin-fb-empty">Talepler yükleniyor…</p>';
    var opts = {};
    if (adminFbType !== 'all') opts.type = adminFbType;
    if (adminFbRole !== 'all') opts.role = adminFbRole;
    if (adminFbStatus !== 'all') opts.status = adminFbStatus;
    if (adminFbSearch) opts.search = adminFbSearch;
    window.getAdminFeedback(opts).then(function(res) {
        if (!res || !res.success) {
            listEl.innerHTML = '<p style="color:#b91c1c;">Talepler yüklenemedi.</p>';
            return;
        }
        adminFbCache = res.data || [];
        var badge = document.getElementById('feedback-open-badge');
        if (badge) {
            if (res.openCount && res.openCount > 0) {
                badge.textContent = res.openCount + ' açık';
                badge.style.cssText = 'display:inline-block;padding:0.15rem 0.6rem;border-radius:999px;font-size:0.8rem;font-weight:600;color:#92400e;background:#fef3c7;';
            } else {
                badge.style.display = 'none';
            }
        }
        adminFeedbackCiz(adminFbCache);
    });
}

function adminFeedbackCiz(list) {
    var listEl = document.getElementById('admin-fb-list');
    if (!listEl) return;
    if (!list || list.length === 0) {
        listEl.innerHTML = '<p class="admin-fb-empty">Bu filtrede talep bulunmuyor.</p>';
        return;
    }
    var html = '';
    list.forEach(function(f) {
        var who = f.user ? adminEscape(f.user.fullname || f.user.email || '-') : '-';
        var dateTxt = f.createdAt ? new Date(f.createdAt).toLocaleString('tr-TR') : '';
        var msgShort = adminEscape((f.message || '').slice(0, 120)) + ((f.message || '').length > 120 ? '…' : '');
        html += '<div class="admin-fb-card" data-fb-id="' + f.id + '">'
            + '<div class="admin-fb-card-head">'
            + '<div>' + adminFbChip(ADMIN_FB_TYPE, f.type) + ' &nbsp; <strong>' + adminEscape(f.subject) + '</strong></div>'
            + '<div>' + adminFbChip(ADMIN_FB_STATUS, f.status) + '</div>'
            + '</div>'
            + '<div class="admin-fb-meta">' + msgShort + '</div>'
            + '<div class="admin-fb-meta">' + (ADMIN_FB_ROLE[f.role] || f.role) + ' • ' + who + ' • ' + dateTxt + '</div>'
            + '</div>';
    });
    listEl.innerHTML = html;
}

function adminFbModalAc(fb) {
    var modal = document.getElementById('admin-fb-modal');
    var body = document.getElementById('admin-fb-modal-body');
    var titleEl = document.getElementById('admin-fb-modal-title');
    var noteEl = document.getElementById('admin-fb-note');
    if (!modal || !body) return;
    adminFbSelectedId = fb.id;
    titleEl.textContent = 'Talep #' + fb.id;
    var who = fb.user ? adminEscape(fb.user.fullname || '-') + (fb.user.email ? ' (' + adminEscape(fb.user.email) + ')' : '') : '-';
    body.innerHTML =
        '<div class="admin-fb-meta">' + adminFbChip(ADMIN_FB_TYPE, fb.type) + ' &nbsp; ' + adminFbChip(ADMIN_FB_STATUS, fb.status) + '</div>'
        + '<div class="admin-fb-meta" style="margin-top:0.5rem;"><strong>Gönderen:</strong> ' + (ADMIN_FB_ROLE[fb.role] || fb.role) + ' — ' + who + '</div>'
        + '<div class="admin-fb-meta"><strong>Konu:</strong> ' + adminEscape(fb.subject) + '</div>'
        + '<div class="admin-fb-meta"><strong>Mesaj:</strong><br>' + adminEscape(fb.message).replace(/\n/g, '<br>') + '</div>';
    if (noteEl) noteEl.value = fb.adminNote || '';
    modal.style.display = 'flex';
}

function adminFbModalKapat() {
    var modal = document.getElementById('admin-fb-modal');
    if (modal) modal.style.display = 'none';
    adminFbSelectedId = null;
}

function adminFeedbackGuncelle(payload) {
    if (!adminFbSelectedId || typeof window.updateAdminFeedback !== 'function') return;
    window.updateAdminFeedback(adminFbSelectedId, payload).then(function(res) {
        if (res && res.success) {
            window.showAlert(res.message || 'Talep güncellendi.');
            adminFbModalKapat();
            adminFeedbackYukle();
        } else {
            window.showAlert((res && res.message) || 'Güncellenemedi.');
        }
    });
}

function adminFeedbackInit() {
    var listEl = document.getElementById('admin-fb-list');
    if (!listEl) return;

    var typeSel = document.getElementById('admin-fb-type');
    if (typeSel) typeSel.addEventListener('change', function() { adminFbType = typeSel.value || 'all'; adminFeedbackYukle(); });
    var roleSel = document.getElementById('admin-fb-role');
    if (roleSel) roleSel.addEventListener('change', function() { adminFbRole = roleSel.value || 'all'; adminFeedbackYukle(); });
    var statusSel = document.getElementById('admin-fb-status');
    if (statusSel) statusSel.addEventListener('change', function() { adminFbStatus = statusSel.value || 'all'; adminFeedbackYukle(); });

    var searchEl = document.getElementById('admin-fb-search');
    if (searchEl) {
        var t = null;
        searchEl.addEventListener('input', function() {
            adminFbSearch = searchEl.value.trim();
            clearTimeout(t);
            t = setTimeout(adminFeedbackYukle, 350);
        });
    }

    listEl.addEventListener('click', function(e) {
        var card = e.target.closest('.admin-fb-card');
        if (!card) return;
        var id = parseInt(card.getAttribute('data-fb-id'), 10);
        var fb = adminFbCache.find(function(f) { return f.id === id; });
        if (fb) adminFbModalAc(fb);
    });

    var closeBtn = document.getElementById('admin-fb-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', adminFbModalKapat);
    var modal = document.getElementById('admin-fb-modal');
    if (modal) modal.addEventListener('click', function(e) { if (e.target === modal) adminFbModalKapat(); });

    var reviewBtn = document.getElementById('admin-fb-mark-review');
    if (reviewBtn) reviewBtn.addEventListener('click', function() {
        var note = document.getElementById('admin-fb-note');
        adminFeedbackGuncelle({ status: 'in_review', adminNote: note ? note.value.trim() : undefined });
    });
    var resolveBtn = document.getElementById('admin-fb-mark-resolved');
    if (resolveBtn) resolveBtn.addEventListener('click', function() {
        var note = document.getElementById('admin-fb-note');
        adminFeedbackGuncelle({ status: 'resolved', adminNote: note ? note.value.trim() : undefined });
    });

    adminFeedbackYukle();
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
        
        var tabler = document.querySelectorAll(".admin-tabs .tab-btn");
        if (tabler && tabler.length > 0) {
            tabler.forEach(function(tabBtn) {
                tabBtn.addEventListener("click", function(e) {
                    var hedefRole = e.target.getAttribute("data-role");
                    if(hedefRole) {
                        currentRoleFilter = hedefRole;
                        tabler.forEach(function(btn) {
                            btn.classList.remove("btn-primary");
                            btn.classList.add("btn-secondary");
                        });
                        e.target.classList.remove("btn-secondary");
                        e.target.classList.add("btn-primary");
                        listeyiFiltreleVeCiz();
                    }
                });
            });
        }

        // Durum filtresi — Aktif / Dondurulmuş / Silinmiş
        var userListEl = document.getElementById("user-list");
        if (userListEl && userListEl.parentNode) {
            var statusBar = document.createElement('div');
            statusBar.id = 'user-status-filter-bar';
            statusBar.style.cssText = 'display:flex;gap:0.5rem;margin-bottom:0.75rem;flex-wrap:wrap;';
            var statusFilters = [
                { key: 'all',       label: 'Tümü' },
                { key: 'active',    label: '✅ Aktif' },
                { key: 'suspended', label: '🔒 Dondurulmuş' },
                { key: 'deleted',   label: '🗑 Silinmiş' }
            ];
            statusFilters.forEach(function(sf) {
                var sbtn = document.createElement('button');
                sbtn.type = 'button';
                sbtn.textContent = sf.label;
                sbtn.className = 'btn btn-sm ' + (sf.key === 'all' ? 'btn-primary' : 'btn-secondary');
                sbtn.addEventListener('click', function() {
                    document.querySelectorAll('#user-status-filter-bar button').forEach(function(b){ b.className = 'btn btn-sm btn-secondary'; });
                    sbtn.className = 'btn btn-sm btn-primary';
                    currentStatusFilter = sf.key;
                    listeyiFiltreleVeCiz();
                });
                statusBar.appendChild(sbtn);
            });
            userListEl.parentNode.insertBefore(statusBar, userListEl);
        }
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
    
    adminOrdersInit();
    adminFeedbackInit();

    initAdminSocket();
});

function initAdminSocket() {
    if (!window.__socketManager) {
        setTimeout(initAdminSocket, 500);
        return;
    }

    window.__socketManager.on('admin_users_updated', () => {
        const kullaniciListesiSayfasi=document.getElementById("user-list");
        if(kullaniciListesiSayfasi) kullanicilariYukleVeListele();
    });

    window.__socketManager.on('admin_orders_updated', () => {
        const orderListesi=document.getElementById("admin-orders-list");
        if(orderListesi) adminOrdersYukle();
    });

    window.__socketManager.on('feedback_created', () => {
        const fbListesi=document.getElementById("admin-fb-list");
        if(fbListesi) adminFeedbackYukle();
    });

    window.__socketManager.on('feedback_updated', () => {
        const fbListesi=document.getElementById("admin-fb-list");
        if(fbListesi) adminFeedbackYukle();
    });

    window.__socketManager.on('admin_coupons_updated', () => {
        const kuponFormuSayfasi=document.getElementById("coupon-form");
        if(kuponFormuSayfasi) kuponlariYukleVeListele();
    });

    window.__socketManager.on('admin_sellers_updated', () => {
        const kullaniciListesiSayfasi=document.getElementById("user-list");
        if(kullaniciListesiSayfasi && currentRoleFilter === 'seller') kullanicilariYukleVeListele();
    });

    window.__socketManager.on('admin_couriers_updated', () => {
        const kullaniciListesiSayfasi=document.getElementById("user-list");
        if(kullaniciListesiSayfasi && currentRoleFilter === 'courier') kullanicilariYukleVeListele();
    });
}