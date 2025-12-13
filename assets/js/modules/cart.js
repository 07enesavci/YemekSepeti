// Backend API kullanılıyor, mock veriler kaldırıldı

//Kurucu Fonksiyon
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
   			console.error('Hata: urunBul() ' + id + ' IDli yemeği bulamadı.');
   			return null;
   		}
   		
   		const yemek = await response.json();
   		
   		// Backend'den gelen veriyi cart.js formatına çevir
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
   		console.error('Hata: urunBul() API çağrısı başarısız:', error);
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
   	// Login kontrolü
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
		// Zaten sepette varsa sadece adet artır
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
			console.error('Ürün bulunamadı:', id);
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
		});
		
		if (!response.ok) {
			return false;
		}
		
		const data = await response.json();
		return data.success && data.user && data.user.role === 'buyer';
	} catch (error) {
		console.error('Auth kontrolü hatası:', error);
		return false;
	}
}

/**
 * API'den meal bilgilerini çekip sepete ekler
 * @param {number} mealId - Meal ID
 * @param {number} sellerId - Seller ID (meal bilgilerini çekmek için gerekli)
 * @param {number} quantity - Adet (varsayılan: 1)
 */
async function addToCart(mealId, sellerId, quantity) {
    // Login kontrolü
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
        // Önce sepette var mı kontrol et
        var i = sepetIndex(mealId);
        if (i > -1) {
            // Zaten sepette varsa sadece 1 adet artır (çift eklemeyi önle)
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
        
        // SellerId yoksa eski yöntemi dene
        if (!sellerId) {
            var urun = urunBul(mealId);
            if (urun) {
                sepet.push(new SepetKalemi(urun, quantity));
                sepetiKaydet();
                sepetiYenile();
            } else {
                console.error('Ürün bulunamadı:', mealId);
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
            // Meal bulunamazsa eski yöntemi dene
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
        
        // Seller bilgilerini de çek (delivery fee dahil)
        const sellerResponse = await fetch(`${baseUrl}/api/sellers/${sellerId}`);
        let sellerName = 'Ev Lezzetleri';
        if (sellerResponse.ok) {
            const seller = await sellerResponse.json();
            sellerName = seller.name || sellerName;
            // Delivery fee'yi cache'le
            if (seller.deliveryFee !== undefined) {
                cachedDeliveryFee = parseFloat(seller.deliveryFee) || 15.00;
                cachedSellerId = sellerId;
            }
        }
        
        // Meal bilgilerini sepete uygun formata çevir
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
        
        // Floating cart'ı güncelle ve aç
        if (window.updateFloatingCart) {
            window.updateFloatingCart();
            window.openFloatingCart();
        }
        
        // Başarı mesajı göster (event objesi varsa)
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
            console.log('Sepete eklendi');
        }
        
    } catch (error) {
        console.error('Sepete ekleme hatası:', error);
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
   	            console.warn('Delivery fee çekilemedi, default kullanılıyor:', e);
   	        }
   	    }
   	}
   	
   	var toplam = ara + teslimatUcreti;
    
    // Sepet butonunu ve sayısını güncelle
    var cartCountSpan = document.getElementById('cart-count');
    var cartButtonLi = document.getElementById('cart-button-li');
    var cartButton = document.getElementById('cart-button');

    if (cartCountSpan) {
        cartCountSpan.textContent = adetTop;
    }

    // Sepet butonunu göster/gizle
    if (cartButtonLi) {
        if (adetTop > 0) {
            cartButtonLi.style.display = 'block';
        } else {
            cartButtonLi.style.display = 'none';
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
   	 	 	
   	 	 	// Resim URL'ini kontrol et - via.placeholder.com içeriyorsa SVG placeholder kullan
   	 	 	var urunGorsel = s.urun.gorsel || s.urun.imageUrl;
   	 	 	if (!urunGorsel || 
   	 	 	    !urunGorsel.startsWith('http') || 
   	 	 	    urunGorsel.includes('via.placeholder.com') ||
   	 	 	    urunGorsel.includes('placeholder.com')) {
   	 	 	    var urunAd = (s.urun.ad || 'Yemek').substring(0, 10);
   	 	 	    urunGorsel = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#f0f0f0"/><text x="50%" y="50%" font-family="Arial" font-size="12" fill="#666" text-anchor="middle" dominant-baseline="middle">${urunAd}</text></svg>`)}`;
   	 	 	}
   	 	 	
   	 	 	li.innerHTML = 
   	 	 	 	'<img src="'+urunGorsel+'" alt="'+s.urun.ad +'"class="cart-item-image" onerror="this.onerror=null; this.style.display=\'none\';">' +
   	 	 	 	'<div class="cart-item-details">' +
   	 	 	 	 	'<h3 class="card-title">'+s.urun.ad+'</h3>' +
   	 	 	 	 	'<p class="card-text">Satıcı: <strong>'+(s.urun.satici || 'Ev Lezzetleri')+'</strong></p>' +
   	 	 	 	'</div>' +
   	 	 	 	'<div class="cart-item-quantity">' +
   	 	 	 	 	'<button class="quantity-btn" data-az="'+s.urun.id+'">-</button>' +
   	 	 	 	 	'<input type="text" value="'+s.adet+'" class="quantity-input" readonly>' +
   	 	 	 	 	'<button class="quantity-btn" data-art="'+s.urun.id+'">+</button>' +
   	 	 	 	'</div>' +
   	 	 	 	'<div class="cart-item-price">' + tl(s.aratoplam()) + '</div>' +
   	 	 	 	'<button class="cart-item-remove" data-sil="'+s.urun.id+'" title="Sepetten Çıkar">×</button>';
   	 	 	sepetListeAlani.appendChild(li);
   	 	}
   	 	
   	 	document.getElementById('summary-subtotal').textContent = tl(ara);
   	 	document.getElementById('summary-delivery').textContent = tl(teslimatUcreti);
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
   	            console.warn('Delivery fee çekilemedi, default kullanılıyor:', e);
   	        }
   	    }
   	}
   	
   	// Yuvarlama
   	teslimatUcreti = Math.round(teslimatUcreti * 100) / 100;
   	var toplam = Math.round((ara + teslimatUcreti) * 100) / 100;
   	
   	return { ara: ara, teslimat: teslimatUcreti, toplam: toplam };
}

window.sepetiTemizle = function(){
   	sepet = [];
   	sepetiKaydet();
}

// Event listener'ların birden fazla kez eklenmesini önlemek için flag kullan
var cartEventListenersAttached = false;

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
                    console.error('Sepete ekleme hatası:', error);
                    t.innerHTML = orjinalText;
                    t.disabled = false;
                    t.dataset.processing = 'false';
                });
   	 	}
		else
		{
   	 	 	console.error('Hata: HTMLdeki ' + yemekAdi + ' window.MOCK_MENUS içinde bulunamadı.');
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

document.addEventListener('DOMContentLoaded', async function(){
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
});