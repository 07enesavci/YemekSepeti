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
    for (var saticiId in MOCK_MENUS)
	{
        if (MOCK_MENUS.hasOwnProperty(saticiId))
		{
            saticiIdleri.push(saticiId);
        }
    }
   	
   	for(var i=0; i < saticiIdleri.length; i++)
	{
   	 	var saticiId = saticiIdleri[i];
   	 	var menu = MOCK_MENUS[saticiId];
   	 	for(var j=0; j < menu.length; j++)
		{
   	 	 	var yemek = menu[j];
   	 	 	if(yemek.id === id)
			{
   	 	 	 	var satici = null;
   	 	 	 	for(var k=0; k < MOCK_SELLERS.length; k++)
				{
   	 	 	 	 	if(MOCK_SELLERS[k].id == saticiId)
						{
							satici = MOCK_SELLERS[k]; break;
						}
   	 	 	 	}
   	 	 	 	var klonYemek = JSON.parse(JSON.stringify(yemek));
   	 	 	 	klonYemek.satici = satici ? satici.name : 'Ev Lezzetleri';
                klonYemek.fiyat = yemek.price; 
                klonYemek.gorsel = yemek.imageUrl;
                klonYemek.ad = yemek.name;
   	 	 	 	return klonYemek;
   	 	 	}
   	 	}
   	}
   	console.error('Hata: urunBul() ' + id + ' IDli yemeği MOCK_MENUS içinde bulamadı.');
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
   	 	 	
   	 	 	li.innerHTML = 
   	 	 	 	'<img src="'+(s.urun.gorsel || 'https://via.placeholder.com/100')+'" alt="'+s.urun.ad +'"class="cart-item-image">' +
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
   	 	for (var saticiId in MOCK_MENUS)
		{
   	 	 	if (MOCK_MENUS.hasOwnProperty(saticiId))
			{
   	 	 	 	var menu = MOCK_MENUS[saticiId];
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
   	 	 	console.error('Hata: HTMLdeki ' + yemekAdi + ' MOCK_MENUS içinde bulunamadı.');
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