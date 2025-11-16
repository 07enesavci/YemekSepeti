function cizOdemeSayfasi()
{
        var sepet = window.getSepet();

        var tutarlar = window.getSepetTotals(); 

    if (typeof tl !== 'function') 
    {
        console.error("HATA: tl() fonksiyonu bulunamadı. cart.js'in yüklendiğinden emin olun.");
        return;
    }

        document.getElementById('summary-subtotal').textContent = tl(tutarlar.ara);
        document.getElementById('summary-delivery').textContent = tl(tutarlar.teslimat);
        document.getElementById('summary-total').textContent = tl(tutarlar.toplam);
        
        if (!sepet || sepet.length === 0)
        {
                alert('Sepetiniz boş. Sepet sayfasına yönlendiriliyorsunuz.');
                window.location.href = 'cart.html';
                return;
        }
}

document.addEventListener('DOMContentLoaded', function(){

        cizOdemeSayfasi();
        
        var tamamlaBtn = document.querySelector('.order-summary .btn-primary');
        
        if (tamamlaBtn)
        {
                tamamlaBtn.addEventListener('click', function(e){

                        e.preventDefault();
                        
                        var sepet = window.getSepet();
                        if(!sepet || !sepet.length)
                        {
                                alert('Sepetiniz boş.'); return;
                        }
                        
                        var adresRadio = document.querySelector('input[name="address"]:checked');
                        var kartRadio = document.querySelector('input[name="payment-card"]:checked');
                        var sozlesmeOnayli = document.getElementById('terms').checked;

                        if (!adresRadio)
                        {
                                alert("Lütfen bir adres seçin.");
                                return;
                        }
                        if (!kartRadio)
                        {
                                alert("Lütfen bir ödeme yöntemi seçin.");
                                return;
                        }
                        if (!sozlesmeOnayli)
                        {
                                alert('Lütfen sözleşmeleri onaylayın.');
                                return;
                        }

                        var adresSecili = adresRadio.value;
                        var kartSecili = kartRadio.value;
                        
    	 	 	        var adresDetayi = {};

            	 	 	if (adresSecili === 'new')
                                {
    	 	 	 	        alert('Yeni adres ekleme özelliği henüz tamamlanmadı. Lütfen varsayılan adresi seçin.');
    	 	 	 	        return;
    	 	 	        }
                                else
                                {
            	 	 	 	var label = document.querySelector('label[for="address-1"] span');
                                        adresDetayi.adres = label ? label.textContent : "Ev Adresi (Varsayılan)";
    	 	 	        }

    	 	 	                var kartDetayi = {};

    	 	 	 	        if (kartSecili === 'new')
                                        {
    	 	 	 	 	    kartDetayi.kartNo = document.getElementById('card-number').value;

    	 	 	 	 	if (!kartDetayi.kartNo || kartDetayi.kartNo.trim() === '')
                                        {
    	 	 	 	 	 	alert('Lütfen "Yeni Kart" bilgilerinizi girin.');
    	 	 	 	 	 	return;
    	 	 	 	 	}
    	 	 	 	        }
                                        else
                                        {
    	 	 	 	 	    kartDetayi.kartNo = "**** 1234";
    	 	 	 	        }

    	 	 	
    	 	 	                console.log('Sipariş oluşturuluyor...');
    	 	 	                tamamlaBtn.textContent = 'İşleniyor...';
                                        tamamlaBtn.disabled = true;
    	 	 	
            	 	 	        if (typeof createOrder === 'function')
                                        {
            	 	 	 	createOrder(sepet, adresDetayi)
    	     	 	 	 	.then(function(sonuc){
    	 	 	 	 	 	alert('Siparişiniz alındı! Sipariş ID: ' + sonuc.orderId);
    	 	 	 	 	 	window.sepetiTemizle();
    	 	 	 	 	 	window.location.href = '../../index.html';
    	 	 	 	 	})
    	 	 	 	 	    .catch(function(err) {
    	 	 	 	 	 	alert('Sipariş sırasında bir hata oluştu: ' + String(err));
    	 	 	 	 	 	tamamlaBtn.textContent = 'Siparişi Tamamla'; 
                                                tamamlaBtn.disabled = false;
    	 	 	 	 	});
    	 	 	 	
    	 	 	                }
                                        else
                                        {
    	 	 	 	        alert('Hata: api.js bulunamadı veya global createOrder fonksiyonu eksik.');
 	 	 	 	            tamamlaBtn.textContent = 'Siparişi Tamamla'; 
 	 	 	 	            tamamlaBtn.disabled = false;
    	 	 	                }
    	 	});
    	}

    	var radioGruplari = ['address', 'payment-card'];
    	
    	for (var i=0; i < radioGruplari.length; i++)
        {
    	 	var radyolar = document.querySelectorAll('input[name="' + radioGruplari[i] + '"]');

    	 	for (var j=0; j < radyolar.length; j++)
                {
    	 	 	radyolar[j].addEventListener('change', function(e){

    	 	 	if (e.target.name === 'payment-card') 
                        {
    	 	 	        var form = document.getElementById('new-card-form');
    	 	 	 	if (e.target.value === 'new')
                                {
    	 	 	 	 	form.style.display = 'block';
    	 	 	 	}
                                else
                                {
    	 	 	 	 	form.style.display = 'none';
            	 	 	}
    	 	 	}
    	 	});
    	 	}
    	}
});