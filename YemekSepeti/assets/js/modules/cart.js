// SEPETİM (cart.js)

function SepetKalemi(urun, adet)
{
   	this.urun = urun;
   	this.adet = adet || 1;
}
SepetKalemi.prototype.aratoplam = function(){
    var fiyat = this.urun.price || this.urun.fiyat || 0;
   	return fiyat * this.adet; 
};

//Durum
var sepet = [];
var cachedDeliveryFee = null; // Delivery fee cache
var cachedSellerId = null; // Seller ID cache
var appliedCoupon = null; // Uygulanan kupon bilgisi

function tl(x)
{
   	return Number(x || 0).toLocaleString('tr-TR', {style:'currency', currency:'TRY'});
}

function sepetIndex(id)
{
   	id = Number(id);
   	for(var i=0; i<sepet.length; i++)
	{
   	 	if(sepet[i].urun.id === id)
		{ 
   	 	 	return i;
   	 	}
   	}
   	return -1;
}

async function urunBul(id)
{
   	id = Number(id);
   	try {
   		const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
   		const response = await fetch(`${baseUrl}/api/cart/product/${id}`);
   		
   		if (!response.ok) {
   			return null;
   		}
   		const yemek = await response.json();
   		var klonYemek = {
   			id: yemek.id,
   			name: yemek.name,
   			description: yemek.description,
   			price: yemek.price,
   			imageUrl: yemek.imageUrl,
   			category: yemek.category,
   			satici: yemek.satici || 'Ev Lezzetleri',
   			fiyat: yemek.fiyat || yemek.price,
   			gorsel: yemek.gorsel || yemek.imageUrl,
   			ad: yemek.ad || yemek.name
   		};
   		
   		return klonYemek;
   	} catch (error) {
   		return null;
   	}
}

function sepetiKaydet()
{
   	localStorage.setItem('evLezzetleriSepet', JSON.stringify(sepet));
}

function sepetiYukle()
{
    var kayitliSepet = localStorage.getItem('evLezzetleriSepet');
    var geciciSepet;

  	if (kayitliSepet)
	{
  	 	geciciSepet = JSON.parse(kayitliSepet);
  	}
	else
	{
  	 	geciciSepet = [];
  	}

  	sepet = [];

  	for (var i = 0; i < geciciSepet.length; i++)
	{
  	 	var kalem = geciciSepet[i];
  	 	if (kalem.urun)
		{
  	 	 	sepet.push(new SepetKalemi(kalem.urun, kalem.adet)); 
  	 	}
  	}
}

async function sepeteEkle(id, adet)
{
   	if (!await checkAuth()) {
   		alert('Sepete ürün eklemek için lütfen giriş yapın.');
   		const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
   		window.location.href = `${baseUrl}/login?redirect=${encodeURIComponent(window.location.pathname)}`;
   		return;
   	}

   	id = Number(id);
   	adet = Math.max(1, Number(adet) || 1);
   	var i = sepetIndex(id);
   	
   	if(i > -1)
	{
		sepet[i].adet += adet;
		sepetiKaydet();    
		sepetiYenile();
		// Floating cart'ı güncelle ve aç
		if (window.updateFloatingCart) {
			window.updateFloatingCart();
			window.openFloatingCart();
		}
		return;
	} 
 	else
	{
   	 	// Ürünü bul ve sepete ekle
   	 	var urun = await urunBul(id); 
   	 	if(urun)
		{
			sepet.push(new SepetKalemi(urun, adet));
			sepetiKaydet();    
			sepetiYenile();
			// Floating cart'ı güncelle ve aç
			if (window.updateFloatingCart) {
				window.updateFloatingCart();
				window.openFloatingCart();
			}
		} 
 	 	else
		{
			return;
		}
   	}
}

// Login kontrolü fonksiyonu
async function checkAuth() {
	try {
		const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
		const response = await fetch(`${baseUrl}/api/auth/me`, {
			credentials: 'include'
		}).catch(() => null); // Network hatalarını sessizce handle et
		
		if (!response || !response.ok) {
			return false;
		}
		
		const data = await response.json();
		return data.success && data.user && data.user.role === 'buyer';
	} catch (error) {
		return false;
	}
}

async function addToCart(mealId, sellerId, quantity) {
    if (!await checkAuth()) {
        alert('Sepete ürün eklemek için lütfen giriş yapın.');
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        window.location.href = `${baseUrl}/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
    }

    mealId = Number(mealId);
    sellerId = Number(sellerId);
    quantity = Math.max(1, Number(quantity) || 1);
    
    try {
        var i = sepetIndex(mealId);
        if (i > -1) {
            sepet[i].adet += 1;
            sepetiKaydet();
            sepetiYenile();
            // Floating cart'ı güncelle ve aç
            if (window.updateFloatingCart) {
                window.updateFloatingCart();
                window.openFloatingCart();
            }
            return;
        }
        
        if (!sellerId) {
            var urun = urunBul(mealId);
            if (urun) {
                sepet.push(new SepetKalemi(urun, quantity));
                sepetiKaydet();
                sepetiYenile();
            } else {
                alert('Ürün sepete eklenemedi. Lütfen tekrar deneyin.');
            }
            return;
        }
        
        // API'den seller menüsünü çek ve meal'i bul
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const menuResponse = await fetch(`${baseUrl}/api/sellers/${sellerId}/menu`);
        
        if (!menuResponse.ok) {
            throw new Error('Menü yüklenemedi');
        }
        
        const menu = await menuResponse.json();
        const meal = menu.find(m => m.id === mealId);
        
        if (!meal) {
            var urun = urunBul(mealId);
            if (urun) {
                sepet.push(new SepetKalemi(urun, quantity));
                sepetiKaydet();
                sepetiYenile();
            } else {
                alert('Ürün bulunamadı. Lütfen tekrar deneyin.');
            }
            return;
        }
        
        const sellerResponse = await fetch(`${baseUrl}/api/sellers/${sellerId}`);
        let sellerName = 'Ev Lezzetleri';
        if (sellerResponse.ok) {
            const seller = await sellerResponse.json();
            sellerName = seller.name || sellerName;
            if (seller.deliveryFee !== undefined) {
                cachedDeliveryFee = parseFloat(seller.deliveryFee) || 15.00;
                cachedSellerId = sellerId;
            }
        }
        
        var urun = {
            id: meal.id,
            name: meal.name,
            ad: meal.name,
            price: parseFloat(meal.price) || 0,
            fiyat: parseFloat(meal.price) || 0,
            description: meal.description || '',
            imageUrl: meal.imageUrl || null,
            gorsel: meal.imageUrl || null,
            category: meal.category || '',
            satici: sellerName,
            sellerId: sellerId
        };
        
        sepet.push(new SepetKalemi(urun, quantity));
        sepetiKaydet();
        sepetiYenile();
        
        if (window.updateFloatingCart) {
            window.updateFloatingCart();
            window.openFloatingCart();
        }
        
        try {
            var button = (typeof event !== 'undefined' && event && event.target) ? event.target : null;
            if (!button && typeof window.event !== 'undefined' && window.event) {
                button = window.event.target || window.event.srcElement;
            }
            if (button && (button.tagName === 'BUTTON' || button.classList.contains('btn'))) {
                var originalText = button.innerHTML;
                button.textContent = 'Eklendi!';
                button.disabled = true;
                setTimeout(function() {
                    button.innerHTML = originalText;
                    button.disabled = false;
                }, 1000);
            }
        } catch (e) {
            // Event objesine erişilemezse sessizce devam et
        }
        
    } catch (error) {
        // Hata durumunda eski yöntemi dene
        var urun = urunBul(mealId);
        if (urun) {
            sepet.push(new SepetKalemi(urun, quantity));
            sepetiKaydet();
            sepetiYenile();
        } else {
            alert('Ürün sepete eklenemedi. Lütfen tekrar deneyin.');
        }
    }
}

// Global olarak erişilebilir yap
window.addToCart = addToCart;

function sepettenSil(id)
{
   	var i = sepetIndex(Number(id));
   	if(i > -1)
	{
   	 	sepet.splice(i, 1); 
   	 	sepetiKaydet();
   	 	sepetiYenile();
   	 	// Floating cart'ı güncelle
   	 	if (window.updateFloatingCart) {
   	 	    window.updateFloatingCart();
   	 	}
   	}
}

function adetArtirAzalt(id, delta)
{
 	var i = sepetIndex(Number(id));
 	if(i > -1)
	{
 	 	if (delta === -1 && sepet[i].adet === 1)
		{
 	 	 	sepettenSil(id); 
 	 	 	return; 
 	 	}
 	 	// Delta değerini doğru kullan - eğer delta 0 ise 1 ekle, değilse delta kadar ekle
 	 	var yeniAdet = sepet[i].adet + delta;
 	 	sepet[i].adet = Math.max(1, yeniAdet);
 	 	sepetiKaydet();
 	 	sepetiYenile();
 	 	// Floating cart'ı güncelle
 	 	if (window.updateFloatingCart) {
 	 	    window.updateFloatingCart();
 	 	}
 	}
}

async function sepetiYenile()
{
   	var ara = 0;
   	var adetTop = 0;
   	for(var i=0; i<sepet.length; i++)
	{
   	 	var s = sepet[i];
        if (s && typeof s.aratoplam === 'function')
		{
   	 	    ara += s.aratoplam();
   	 	    adetTop += s.adet;
        }
   	}

   	// Delivery fee'yi veritabanından çek
   	var teslimatUcreti = 15.00; // Default fallback
   	if (sepet.length > 0) {
   	    var firstItem = sepet[0];
   	    var sellerId = firstItem.urun?.sellerId || firstItem.urun?.seller_id || null;
   	    
   	    // Cache'de varsa ve seller ID aynıysa kullan
   	    if (cachedDeliveryFee && cachedSellerId === sellerId) {
   	        teslimatUcreti = cachedDeliveryFee;
   	    } else if (sellerId) {
   	        try {
   	            const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
   	            const sellerResponse = await fetch(`${baseUrl}/api/sellers/${sellerId}`);
   	            if (sellerResponse.ok) {
   	                const seller = await sellerResponse.json();
   	                teslimatUcreti = parseFloat(seller.deliveryFee) || 15.00;
   	                // Cache'le
   	                cachedDeliveryFee = teslimatUcreti;
   	                cachedSellerId = sellerId;
   	            }
   	        } catch (e) {
   	        }
   	    }
   	}
   	
   	// Kupon indirimi varsa çıkar
   	var kuponIndirimi = 0;
   	if (appliedCoupon && appliedCoupon.discountAmount) {
   	    kuponIndirimi = parseFloat(appliedCoupon.discountAmount) || 0;
   	}
   	
   	var toplam = ara + teslimatUcreti - kuponIndirimi;
   	// Toplam negatif olamaz
   	toplam = Math.max(0, toplam);
    
    // Sepet butonunu ve sayısını güncelle
    var cartCountSpan = document.getElementById('cart-count');
    var cartButtonLi = document.getElementById('cart-button-li');
    var cartButton = document.getElementById('cart-button');

    if (cartCountSpan) {
        cartCountSpan.textContent = adetTop;
    }

    // Sepet butonunu göster/gizle
    if (cartButtonLi) {
        // Panel sayfalarında sepet butonunu gösterme
        const path = window.location.pathname;
        const isPanelPage = path.includes('/seller/') || path.includes('/courier/') || path.includes('/admin/');
        
        if (isPanelPage) {
            cartButtonLi.style.display = 'none';
        } else {
            // Kullanıcı kontrolü - cache'lenmiş kullanıcı bilgisini kullan
            // Eğer localStorage'da user varsa kontrol et, yoksa API çağrısı yapma
            const cachedUser = localStorage.getItem('user');
            if (cachedUser) {
                try {
                    const user = JSON.parse(cachedUser);
                    if (user.role === 'seller' || user.role === 'courier' || user.role === 'admin') {
                        cartButtonLi.style.display = 'none';
                        return; // Panel kullanıcıları için sepet butonunu gösterme ve devam etme
                    }
                } catch (e) {
                    // Parse hatası, devam et
                }
            }
            // Kullanıcı giriş yapmamış veya buyer ise sepet butonunu göster
            
            if (adetTop > 0) {
                cartButtonLi.style.display = 'block';
            } else {
                cartButtonLi.style.display = 'none';
            }
        }
    }

    // Eski yöntem (fallback)
    if (!cartCountSpan && !cartButtonLi) {
        var headerLink = document.querySelector('.site-header a[href*="cart"]');
        if (headerLink) {
            var isActive = headerLink.classList.contains('active');
            headerLink.innerHTML = 'Sepet (' + adetTop + ')';
            if(isActive) headerLink.classList.add('active');
        }
    }
   	
   	var sepetListeAlani = document.querySelector('.cart-items-list'); 
   	if (sepetListeAlani)
	{
   	 	sepetListeAlani.innerHTML = '';
   	 	
   	 	for(var i=0; i<sepet.length; i++)
		{
   	 	 	var s = sepet[i];
   	 	 	var li = document.createElement('div'); 
   	 	 	li.className = 'card cart-item'; 
   	 	 	
   	 	 	// Güvenli değer çekme
   	 	 	var urun = s.urun || {};
   	 	 	var urunId = urun.id || s.id || '';
   	 	 	var urunAd = (urun.ad || urun.name || 'Ürün').toString().trim() || 'Ürün';
   	 	 	var urunSatici = (urun.satici || 'Ev Lezzetleri').toString().trim() || 'Ev Lezzetleri';
   	 	 	
   	 	 	// Resim URL'ini kontrol et - via.placeholder.com içeriyorsa SVG placeholder kullan
   	 	 	var urunGorsel = urun.gorsel || urun.imageUrl || '';
   	 	 	if (!urunGorsel || 
   	 	 	    typeof urunGorsel !== 'string' ||
   	 	 	    !urunGorsel.startsWith('http') || 
   	 	 	    urunGorsel.includes('via.placeholder.com') ||
   	 	 	    urunGorsel.includes('placeholder.com')) {
   	 	 	    var urunAdShort = urunAd.substring(0, 10);
   	 	 	    urunGorsel = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#f0f0f0"/><text x="50%" y="50%" font-family="Arial" font-size="12" fill="#666" text-anchor="middle" dominant-baseline="middle">${urunAdShort}</text></svg>`)}`;
   	 	 	}
   	 	 	
   	 	 	li.innerHTML = 
   	 	 	 	'<img src="'+urunGorsel+'" alt="'+urunAd+'" class="cart-item-image" onerror="this.onerror=null; this.style.display=\'none\';">' +
   	 	 	 	'<div class="cart-item-details">' +
   	 	 	 	 	'<h3 class="card-title">'+urunAd+'</h3>' +
   	 	 	 	 	'<p class="card-text">Satıcı: <strong>'+urunSatici+'</strong></p>' +
   	 	 	 	'</div>' +
   	 	 	 	'<div class="cart-item-quantity">' +
   	 	 	 	 	'<button class="quantity-btn" data-az="'+urunId+'">-</button>' +
   	 	 	 	 	'<input type="text" value="'+(s.adet || 1)+'" class="quantity-input" readonly>' +
   	 	 	 	 	'<button class="quantity-btn" data-art="'+urunId+'">+</button>' +
   	 	 	 	'</div>' +
   	 	 	 	'<div class="cart-item-price">' + tl(s.aratoplam()) + '</div>' +
   	 	 	 	'<button class="cart-item-remove" data-sil="'+urunId+'" title="Sepetten Çıkar">×</button>';
   	 	 	sepetListeAlani.appendChild(li);
   	 	}
   	 	
   	 	document.getElementById('summary-subtotal').textContent = tl(ara);
   	 	document.getElementById('summary-delivery').textContent = tl(teslimatUcreti);
   	 	
   	 	// Kupon indirimi satırını göster/gizle
   	 	var couponDiscountRow = document.getElementById('summary-coupon-discount');
   	 	if (kuponIndirimi > 0) {
   	 	    if (!couponDiscountRow) {
   	 	        // Kupon indirimi satırını oluştur
   	 	        var deliveryRow = document.querySelector('.summary-row:has(#summary-delivery)');
   	 	        if (deliveryRow) {
   	 	            var couponRow = document.createElement('div');
   	 	            couponRow.className = 'summary-row';
   	 	            couponRow.id = 'summary-coupon-discount';
   	 	            couponRow.innerHTML = '<span>Kupon İndirimi (' + (appliedCoupon.code || '') + ')</span><span style="color: #27AE60;">-' + tl(kuponIndirimi) + '</span>';
   	 	            deliveryRow.insertAdjacentElement('afterend', couponRow);
   	 	        }
   	 	    } else {
   	 	        couponDiscountRow.innerHTML = '<span>Kupon İndirimi (' + (appliedCoupon.code || '') + ')</span><span style="color: #27AE60;">-' + tl(kuponIndirimi) + '</span>';
   	 	    }
   	 	} else if (couponDiscountRow) {
   	 	    couponDiscountRow.remove();
   	 	}
   	 	
   	 	document.getElementById('summary-total').textContent = tl(toplam);
   	 	
   	 	var bosGoster = document.getElementById('cart-empty');
   	 	var doluGoster = document.getElementById('cart-layout');
   	 	if(bosGoster && doluGoster)
		{ 
   	 	 	if(sepet.length === 0)
			{
   	 	 	 	bosGoster.style.display = 'block';
   	 	 	 	doluGoster.style.display = 'none';
   	 	 	}
			else
			{
   	 	 	 	bosGoster.style.display = 'none';
   	 	 	 	doluGoster.style.display = 'flex'; 
   	 	 	}
   	 	}
   	}
    
    // Floating cart'ı güncelle
    if (window.updateFloatingCart) {
        window.updateFloatingCart();
   	}
    
    // Uygulanabilir kupon kodlarını yenile
    if (window.location.pathname.includes('/buyer/cart')) {
        loadAvailableCoupons();
    }
}

window.getSepet = function(){
	return sepet; 
}

window.getSepetTotals = async function(){
   	var ara = 0, adetTop = 0;
   	for(var i=0; i<sepet.length; i++)
	{ 
 	 	ara += sepet[i].aratoplam(); 
 	 	adetTop += sepet[i].adet; 
 	}
   	
   	// Yuvarlama hatası önlemek için 2 ondalık basamağa yuvarla
   	ara = Math.round(ara * 100) / 100;
   	adetTop = Math.round(adetTop);
   	
   	// Delivery fee'yi veritabanından çek
   	var teslimatUcreti = 15.00; // Default fallback
   	if (sepet.length > 0) {
   	    var firstItem = sepet[0];
   	    var sellerId = firstItem.urun?.sellerId || firstItem.urun?.seller_id || null;
   	    
   	    // Cache'de varsa ve seller ID aynıysa kullan
   	    if (cachedDeliveryFee && cachedSellerId === sellerId) {
   	        teslimatUcreti = cachedDeliveryFee;
   	    } else if (sellerId) {
   	        try {
   	            const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
   	            const sellerResponse = await fetch(`${baseUrl}/api/sellers/${sellerId}`);
   	            if (sellerResponse.ok) {
   	                const seller = await sellerResponse.json();
   	                teslimatUcreti = parseFloat(seller.deliveryFee) || 15.00;
   	                // Cache'le
   	                cachedDeliveryFee = teslimatUcreti;
   	                cachedSellerId = sellerId;
   	            }
   	        } catch (e) {
   	        }
   	    }
   	}
   	
   	// Yuvarlama
   	teslimatUcreti = Math.round(teslimatUcreti * 100) / 100;
   	
   	// Kupon indirimi varsa çıkar
   	var kuponIndirimi = 0;
   	if (appliedCoupon && appliedCoupon.discountAmount) {
   	    kuponIndirimi = Math.round(parseFloat(appliedCoupon.discountAmount) * 100) / 100;
   	}
   	
   	var toplam = Math.round((ara + teslimatUcreti - kuponIndirimi) * 100) / 100;
   	// Toplam negatif olamaz
   	toplam = Math.max(0, toplam);
   	
   	return { ara: ara, teslimat: teslimatUcreti, kuponIndirimi: kuponIndirimi, toplam: toplam };
}

window.sepetiTemizle = function(){
   	sepet = [];
   	sepetiKaydet();
}

// Event listener'ların birden fazla kez eklenmesini önlemek için flag kullan
var cartEventListenersAttached = false;
var couponEventListenersAttached = false;

function attachCartEventListeners() {
    if (cartEventListenersAttached) {
        return; // Zaten eklenmiş
    }
    cartEventListenersAttached = true;

document.addEventListener('click', function(e){
   	var t = e.target.closest('button'); 
   	if(!t)
	{
            return; 
        }

        // Buton disabled ise işlem yapma
        if (t.disabled) {
		return; 
	}

   	var mealCard = e.target.closest('.meal-card');

   	if (mealCard && t.classList.contains('btn-primary'))
	{
            // Butonu geçici olarak disable et (çift tıklamayı önle)
            if (t.dataset.processing === 'true') {
                return;
            }
            t.dataset.processing = 'true';
            t.disabled = true;

   	 	var yemekAdi = mealCard.querySelector('.card-title').textContent;
   	 	
   	 	var bulunanYemek = null;
   	 	for (var saticiId in window.MOCK_MENUS)
		{
   	 	 	if (window.MOCK_MENUS.hasOwnProperty(saticiId))
			{
   	 	 	 	var menu = window.MOCK_MENUS[saticiId];
   	 	 	 	for (var j = 0; j < menu.length; j++)
				{
   	 	 	 	 	if (menu[j].name === yemekAdi)
					{
   	 	 	 	 	 	bulunanYemek = menu[j];
   	 	 	 	 	 	break;
   	 	 	 	 	}
   	 	 	 	}
   	 	 	}
   	 	 	if (bulunanYemek)
			{
				break;
			}
   	 	}

   	 	if (bulunanYemek)
		{
   	 	 	var orjinalText = t.innerHTML;
                t.textContent = 'Ekleniyor...';
                
                sepeteEkle(bulunanYemek.id, 1).then(function() {
   	 	 	t.textContent = 'Eklendi!';
                    setTimeout(function(){ 
                        t.innerHTML = orjinalText; 
                        t.disabled = false;
                        t.dataset.processing = 'false';
                    }, 1000);
                }).catch(function(error) {
                    t.innerHTML = orjinalText;
                    t.disabled = false;
                    t.dataset.processing = 'false';
                });
   	 	}
		else
		{
                t.disabled = false;
                t.dataset.processing = 'false';
   	 	}
   	 	return;
   	}

 	var silId = t.getAttribute('data-sil');
   	if (silId !== null)
	{
   	 	sepettenSil(silId);
   	 	return;
   	}

 	var artId = t.getAttribute('data-art');
   	if (artId !== null)
	{
            // Çift tıklamayı önle
            if (t.dataset.processing === 'true') {
                return;
            }
            t.dataset.processing = 'true';
   	 	adetArtirAzalt(artId, 1);
            setTimeout(function() {
                t.dataset.processing = 'false';
            }, 300);
   	 	return;
   	}

 	var azId = t.getAttribute('data-az');
 	if (azId !== null)
	{
            // Çift tıklamayı önle
            if (t.dataset.processing === 'true') {
                return;
            }
            t.dataset.processing = 'true';
 	 	adetArtirAzalt(azId, -1);
            setTimeout(function() {
                t.dataset.processing = 'false';
            }, 300);
 	 	return;
 	}
});
}

/**
 * Kupon kodunu uygula
 */
async function applyCoupon() {
    try {
        var couponInput = document.getElementById('coupon');
        var couponButton = document.querySelector('.coupon-form button');
        
        if (!couponInput) {
            return;
        }
        
        var couponCode = couponInput.value.trim();
        if (!couponCode) {
            alert('Lütfen bir kupon kodu girin.');
            return;
        }
        
        // Sepet toplamlarını al
        var totals = await window.getSepetTotals();
        var subtotal = totals.ara;
        
        if (subtotal <= 0) {
            alert('Sepetinizde ürün bulunmuyor.');
            return;
        }
        
        // Seller ID'yi sepetteki ilk üründen al ve tüm ürünlerin aynı satıcıdan olduğunu kontrol et
        var sellerId = null;
        if (sepet.length > 0 && sepet[0].urun) {
            sellerId = sepet[0].urun.sellerId || sepet[0].urun.seller_id || null;
            
            // Tüm ürünlerin aynı satıcıdan olduğunu kontrol et
            for (var i = 1; i < sepet.length; i++) {
                var itemSellerId = sepet[i].urun?.sellerId || sepet[i].urun?.seller_id || null;
                if (itemSellerId !== sellerId) {
                    alert('Kupon kodu sadece aynı restorandan ürünler için uygulanabilir. Sepetinizde farklı restoranlardan ürünler bulunuyor.');
                    return;
                }
            }
        }
        
        // Butonu disable et
        if (couponButton) {
            couponButton.disabled = true;
            couponButton.textContent = 'Kontrol ediliyor...';
        }
        
        // API'ye istek gönder
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const response = await fetch(`${baseUrl}/api/cart/validate-coupon`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                code: couponCode,
                subtotal: subtotal,
                sellerId: sellerId
            })
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            alert(data.message || 'Kupon kodu geçersiz.');
            if (couponButton) {
                couponButton.disabled = false;
                couponButton.textContent = 'Uygula';
            }
            return;
        }
        
        // Kupon başarıyla uygulandı
        appliedCoupon = data.coupon;
        
        // Input'u disable et ve kupon kodunu göster
        couponInput.disabled = true;
        couponInput.value = couponCode.toUpperCase();
        
        // Butonu kaldır butonuna çevir
        if (couponButton) {
            couponButton.textContent = 'Kaldır';
            couponButton.disabled = false;
            // Önceki event listener'ı kaldır ve yenisini ekle
            var newButton = couponButton.cloneNode(true);
            couponButton.parentNode.replaceChild(newButton, couponButton);
            newButton.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                removeCoupon();
            });
        }
        
        // Sepeti yenile (indirim ile)
        sepetiYenile();
        
        // Kupon listesini yenile
        loadAvailableCoupons();
        
    } catch (error) {
        alert('Kupon uygulanırken bir hata oluştu. Lütfen tekrar deneyin.');
        var couponButton = document.querySelector('.coupon-form button');
        if (couponButton) {
            couponButton.disabled = false;
            couponButton.textContent = 'Uygula';
        }
    }
}

/**
 * Uygulanabilir kupon kodlarını yükle ve göster
 */
async function loadAvailableCoupons() {
    try {
        // Sepette ürün yoksa kuponları gösterme
        if (sepet.length === 0) {
            var couponsSection = document.getElementById('available-coupons-section');
            if (couponsSection) {
                couponsSection.style.display = 'none';
            }
            return;
        }
        
        // Sepetteki ilk üründen seller ID'yi al
        var sellerId = null;
        if (sepet.length > 0 && sepet[0].urun) {
            sellerId = sepet[0].urun.sellerId || sepet[0].urun.seller_id || null;
        }
        
        // Sepet toplamını al
        var totals = await window.getSepetTotals();
        var subtotal = totals.ara;
        
        // Aktif kuponları API'den çek
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const response = await fetch(`${baseUrl}/api/buyer/coupons/active`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            return;
        }
        
        const data = await response.json();
        if (!data.success || !data.coupons) {
            return;
        }
        
        // Kuponları filtrele: Sepetteki restorana özel veya tüm restoranlar için geçerli olanlar
        var applicableCoupons = data.coupons.filter(function(coupon) {
            // Tüm restoranlar için geçerli kuponlar
            if (!coupon.applicableSellerIds || coupon.applicableSellerIds.length === 0) {
                return true;
            }
            
            // Belirli restoranlar için geçerli kuponlar
            if (sellerId && coupon.applicableSellerIds.includes(parseInt(sellerId))) {
                return true;
            }
            
            return false;
        });
        
        // Minimum sipariş tutarı kontrolü
        applicableCoupons = applicableCoupons.filter(function(coupon) {
            return subtotal >= coupon.minOrderAmount;
        });
        
        // Kupon listesini göster
        var couponsSection = document.getElementById('available-coupons-section');
        var couponsList = document.getElementById('available-coupons-list');
        
        if (!couponsSection || !couponsList) {
            return;
        }
        
        if (applicableCoupons.length === 0) {
            couponsSection.style.display = 'none';
            return;
        }
        
        couponsSection.style.display = 'block';
        couponsList.innerHTML = '';
        
        applicableCoupons.forEach(function(coupon) {
            var discountText = '';
            if (coupon.discountType === 'percentage') {
                discountText = '%' + coupon.discountValue + ' İndirim';
            } else {
                discountText = coupon.discountValue + ' TL İndirim';
            }
            
            var minOrderText = coupon.minOrderAmount > 0 
                ? 'Min. ' + tl(coupon.minOrderAmount) + ' TL'
                : '';
            
            var couponCard = document.createElement('div');
            couponCard.className = 'coupon-card';
            couponCard.style.cssText = 'padding: 0.75rem; border: 1px solid #e0e0e0; border-radius: 6px; background: #f9f9f9; cursor: pointer; transition: all 0.2s;';
            couponCard.onmouseover = function() {
                this.style.borderColor = '#4CAF50';
                this.style.background = '#f0f8f0';
            };
            couponCard.onmouseout = function() {
                this.style.borderColor = '#e0e0e0';
                this.style.background = '#f9f9f9';
            };
            couponCard.onclick = function() {
                var couponInput = document.getElementById('coupon');
                if (couponInput) {
                    couponInput.value = coupon.code;
                    couponInput.focus();
                }
            };
            
            couponCard.innerHTML = 
                '<div style="display: flex; justify-content: space-between; align-items: center;">' +
                    '<div>' +
                        '<strong style="color: #4CAF50; font-size: 0.9rem;">' + coupon.code + '</strong>' +
                        '<div style="font-size: 0.85rem; color: #666; margin-top: 0.25rem;">' + discountText + 
                        (minOrderText ? ' • ' + minOrderText : '') + '</div>' +
                        (coupon.description ? '<div style="font-size: 0.8rem; color: #999; margin-top: 0.25rem;">' + coupon.description + '</div>' : '') +
                    '</div>' +
                    '<span style="font-size: 0.75rem; color: #999;">Tıkla</span>' +
                '</div>';
            
            couponsList.appendChild(couponCard);
        });
        
    } catch (error) {
    }
}

/**
 * Kupon kodunu kaldır
 */
function removeCoupon() {
    appliedCoupon = null;
    var couponInput = document.getElementById('coupon');
    var couponButton = document.querySelector('.coupon-form button');
    
    if (couponInput) {
        couponInput.value = '';
        couponInput.disabled = false;
    }
    
    if (couponButton) {
        couponButton.textContent = 'Uygula';
        couponButton.disabled = false;
        // Önceki event listener'ı kaldır ve yenisini ekle
        var newButton = couponButton.cloneNode(true);
        couponButton.parentNode.replaceChild(newButton, couponButton);
        newButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            applyCoupon();
        });
    }
    
    // Sepeti yenile (indirim olmadan)
    sepetiYenile();
    
    // Kupon listesini yenile
    loadAvailableCoupons();
}

document.addEventListener('DOMContentLoaded', async function(){
	// Auth sayfalarında çalışma
	const isAuthPage = window.location.pathname.includes('/login') || 
	                   window.location.pathname.includes('/register') ||
	                   window.location.pathname.includes('/forgot-password') ||
	                   window.location.pathname.includes('/reset-password');
	if (isAuthPage) {
		return;
	}
	
   	// Cart sayfası için login kontrolü
   	if (window.location.pathname.includes('/buyer/cart') || window.location.pathname.includes('/buyer/checkout')) {
   		if (!await checkAuth()) {
   			alert('Sepeti görüntülemek için lütfen giriş yapın.');
   			const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
   			window.location.href = `${baseUrl}/login?redirect=${encodeURIComponent(window.location.pathname)}`;
   			return;
   		}
   	}
   	
   	sepetiYukle();
   	sepetiYenile();
   	attachCartEventListeners();
   	
   	// Kupon kodu uygulama butonunu aktifleştir (sadece bir kez)
   	if (!couponEventListenersAttached) {
   	    couponEventListenersAttached = true;
   	    
   	    var couponButton = document.querySelector('.coupon-form button');
   	    if (couponButton) {
   	        couponButton.addEventListener('click', function(e) {
   	            e.preventDefault();
   	            e.stopPropagation();
   	            applyCoupon();
   	        });
   	    }
   	    
   	    // Enter tuşu ile kupon uygulama
   	    var couponInput = document.getElementById('coupon');
   	    if (couponInput) {
   	        couponInput.addEventListener('keypress', function(e) {
   	            if (e.key === 'Enter') {
   	                e.preventDefault();
   	                e.stopPropagation();
   	                applyCoupon();
   	            }
   	        });
   	    }
   	}
   	
   	// Uygulanabilir kupon kodlarını yükle
   	loadAvailableCoupons();
});