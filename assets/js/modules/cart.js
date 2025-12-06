// Global değişkenlere erişim için fallback
// api.js yüklendikten sonra window.MOCK_MENUS ve window.MOCK_SELLERS mevcut olacak
// Eğer yoksa boş değerler kullan
if (typeof window.MOCK_MENUS === 'undefined') {
    window.MOCK_MENUS = {};
}
if (typeof window.MOCK_SELLERS === 'undefined') {
    window.MOCK_SELLERS = [];
}

// Local referanslar (kod içinde kullanım kolaylığı için - const/let yerine direkt window kullan)
// Not: api.js'de const MOCK_MENUS tanımlı olduğu için burada yeniden tanımlamıyoruz

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

function urunBul(id)
{
   	id = Number(id);
    var saticiIdleri = [];
    for (var saticiId in window.MOCK_MENUS)
	{
        if (MOCK_MENUS.hasOwnProperty(saticiId))
		{
            saticiIdleri.push(saticiId);
        }
    }
   	
   	for(var i=0; i < saticiIdleri.length; i++)
	{
   	 	var saticiId = saticiIdleri[i];
   	 	var menu = window.MOCK_MENUS[saticiId];
   	 	for(var j=0; j < menu.length; j++)
		{
   	 	 	var yemek = menu[j];
   	 	 	if(yemek.id === id)
			{
   	 	 	var satici = null;
   	 	 	for(var k=0; k < window.MOCK_SELLERS.length; k++)
				{
   	 	 	 	if(window.MOCK_SELLERS[k].id == saticiId)
						{
							satici = window.MOCK_SELLERS[k]; break;
						}
   	 	 	 	}
				var klonYemek = JSON.parse(JSON.stringify(yemek));
                if (satici)
				{
                    klonYemek.satici = satici.name;
                } 
				else
				{
                    klonYemek.satici = 'Ev Lezzetleri';
                }
                klonYemek.fiyat = yemek.price; 
                klonYemek.gorsel = yemek.imageUrl;
                klonYemek.ad = yemek.name;
                
                return klonYemek;
   	 	 	}
   	 	}
   	}
   	console.error('Hata: urunBul() ' + id + ' IDli yemeği window.MOCK_MENUS içinde bulamadı.');
   	return null; 
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

function sepeteEkle(id, adet)
{
   	id = Number(id);
   	adet = Math.max(1, Number(adet) || 1);
   	var i = sepetIndex(id);
   	
   	if(i > -1)
	{
		sepet[i].adet += adet;
	} 
 	else
	{
   	 	var urun = urunBul(id); 
   	 	if(urun)
		{
			sepet.push(new SepetKalemi(urun, adet));
		} 
 	 	else
		{
			return;
		}
   	}
   	sepetiKaydet();    
   	sepetiYenile();
}

/**
 * API'den meal bilgilerini çekip sepete ekler
 * @param {number} mealId - Meal ID
 * @param {number} sellerId - Seller ID (meal bilgilerini çekmek için gerekli)
 * @param {number} quantity - Adet (varsayılan: 1)
 */
async function addToCart(mealId, sellerId, quantity) {
    mealId = Number(mealId);
    sellerId = Number(sellerId);
    quantity = Math.max(1, Number(quantity) || 1);
    
    try {
        // Önce sepette var mı kontrol et
        var i = sepetIndex(mealId);
        if (i > -1) {
            // Zaten sepette varsa adet artır
            sepet[i].adet += quantity;
            sepetiKaydet();
            sepetiYenile();
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
        
        // Seller bilgilerini de çek
        const sellerResponse = await fetch(`${baseUrl}/api/sellers/${sellerId}`);
        let sellerName = 'Ev Lezzetleri';
        if (sellerResponse.ok) {
            const seller = await sellerResponse.json();
            sellerName = seller.name || sellerName;
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
 	 	sepet[i].adet = Math.max(1, sepet[i].adet + (delta || 1));
 	 	sepetiKaydet();
 	 	sepetiYenile();
 	}
}

function sepetiYenile()
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

   	var teslimatUcreti = 29.99;
   	var toplam = ara + teslimatUcreti;
    var cartCountSpan = document.getElementById('cart-count');

    if (cartCountSpan)
	{
        cartCountSpan.textContent = adetTop;
    }
	else
	{

        var headerLink = document.querySelector('.site-header a[href*="cart.html"]');

        if (headerLink)
		{
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
}

window.getSepet = function(){
	return sepet; 
}

window.getSepetTotals = function(){
   	var ara = 0, adetTop = 0;
   	for(var i=0; i<sepet.length; i++)
	{ 
 	 	ara += sepet[i].aratoplam(); 
 	 	adetTop += sepet[i].adet; 
 	}
   	var teslimatUcreti = 29.99; 
   	var toplam = ara + teslimatUcreti;
   	return { ara: ara, teslimat: teslimatUcreti, toplam: toplam };
}

window.sepetiTemizle = function(){
   	sepet = [];
   	sepetiKaydet();
}

document.addEventListener('click', function(e){
   	var t = e.target.closest('button'); 
   	if(!t)
	{
		return; 
	}

   	var mealCard = e.target.closest('.meal-card');

   	if (mealCard && t.classList.contains('btn-primary'))
	{
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
   	 	 	sepeteEkle(bulunanYemek.id, 1); 
   	 	 	var orjinalText = t.innerHTML;
   	 	 	t.textContent = 'Eklendi!';
      	 	t.disabled = true;
   	 	 	setTimeout(function(){ t.innerHTML = orjinalText; t.disabled = false; }, 1000);
   	 	}
		else
		{
   	 	 	console.error('Hata: HTMLdeki ' + yemekAdi + ' window.MOCK_MENUS içinde bulunamadı.');
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
   	 	adetArtirAzalt(artId, 1);
   	 	return;
   	}

 	var azId = t.getAttribute('data-az');
 	if (azId !== null)
	{
 	 	adetArtirAzalt(azId, -1);
 	 	return;
 	}
});

document.addEventListener('DOMContentLoaded', function(){
   	sepetiYukle();
   	sepetiYenile();
});