// Adresleri API'den yükle
async function loadAddresses() {
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const response = await fetch(`${baseUrl}/api/buyer/addresses`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            console.error('Adresler yüklenemedi');
            return [];
        }
        
        const data = await response.json();
        return data.success ? data.data : [];
    } catch (error) {
        console.error('Adres yükleme hatası:', error);
        return [];
    }
}

// Ödeme kartlarını API'den yükle
async function loadPaymentCards() {
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const response = await fetch(`${baseUrl}/api/buyer/payment-cards`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            console.error('Ödeme kartları yüklenemedi');
            return [];
        }
        
        const data = await response.json();
        return data.success ? data.data : [];
    } catch (error) {
        console.error('Ödeme kartı yükleme hatası:', error);
        return [];
    }
}

// Adresleri HTML'e ekle
function renderAddresses(addresses) {
    const addressContainer = document.querySelector('.checkout-card .role-selector');
    if (!addressContainer) return;
    
    // Mevcut adres radio'larını temizle (yeni adres ekle hariç)
    const newAddressRadio = addressContainer.querySelector('#address-new');
    const newAddressLabel = newAddressRadio ? newAddressRadio.closest('.form-check-radio') : null;
    addressContainer.innerHTML = '';
    
    // Adresleri ekle
    if (addresses.length > 0) {
        addresses.forEach((address) => {
            const addressDiv = document.createElement('div');
            addressDiv.className = 'form-check form-check-radio';
            addressDiv.innerHTML = `
                <input type="radio" id="address-${address.id}" name="address" value="${address.id}" ${address.isDefault ? 'checked' : ''}>
                <label for="address-${address.id}">
                    <strong>${address.title || 'Adres'}</strong>
                    <span>(${address.detail || address.fullDetail || ''})</span>
                </label>
            `;
            addressContainer.appendChild(addressDiv);
        });
    }
    
    // Yeni adres ekle seçeneğini ekle
    if (newAddressLabel) {
        addressContainer.appendChild(newAddressLabel);
    } else {
        const newAddressDiv = document.createElement('div');
        newAddressDiv.className = 'form-check form-check-radio';
        newAddressDiv.innerHTML = `
            <input type="radio" id="address-new" name="address" value="new">
            <label for="address-new">
                <strong>Yeni Adres Ekle</strong>
            </label>
        `;
        addressContainer.appendChild(newAddressDiv);
    }
}

// Ödeme kartlarını HTML'e ekle
function renderPaymentCards(cards) {
    const paymentContainer = document.querySelectorAll('.checkout-card .role-selector')[1];
    if (!paymentContainer) return;
    
    // Mevcut kart radio'larını temizle (yeni kart ekle hariç)
    const newCardRadio = paymentContainer.querySelector('#card-new');
    const newCardLabel = newCardRadio ? newCardRadio.closest('.form-check-radio') : null;
    paymentContainer.innerHTML = '';
    
    // Kartları ekle
    if (cards.length > 0) {
        cards.forEach((card) => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'form-check form-check-radio';
            cardDiv.innerHTML = `
                <input type="radio" id="card-${card.id}" name="payment-card" value="${card.id}" ${card.isDefault ? 'checked' : ''}>
                <label for="card-${card.id}">
                    <strong>💳 ${card.cardNumber || '**** **** **** ' + card.cardLastFour}</strong>
                    ${card.expiryMonth && card.expiryYear ? `<span>(${card.expiryMonth}/${card.expiryYear})</span>` : ''}
                </label>
            `;
            paymentContainer.appendChild(cardDiv);
        });
    }
    
    // Yeni kart ekle seçeneğini ekle
    if (newCardLabel) {
        paymentContainer.appendChild(newCardLabel);
    } else {
        const newCardDiv = document.createElement('div');
        newCardDiv.className = 'form-check form-check-radio';
        newCardDiv.innerHTML = `
            <input type="radio" id="card-new" name="payment-card" value="new">
            <label for="card-new">
                <strong>Yeni Kart Ekle</strong>
            </label>
        `;
        paymentContainer.appendChild(newCardDiv);
    }
}

// Yeni adres ekleme formu
const NEW_ADDRESS_FORM_CHECKOUT = `
    <div id="new-address-form-checkout" style="display: none; margin-top: 1.5rem;">
        <div class="card" style="background: var(--bg-color);">
            <div class="card-content">
                <h4 style="margin-bottom: 1rem; font-size: 1.1rem;">Yeni Adres Bilgileri</h4>
                <form id="new-address-form-checkout-form">
                    <div class="form-group">
                        <label for="checkout-address-title" class="form-label">Adres Başlığı</label>
                        <input type="text" class="form-input" id="checkout-address-title" placeholder="Ev, İş, vb." required>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="checkout-address-district" class="form-label">İlçe</label>
                            <input type="text" class="form-input" id="checkout-address-district" placeholder="Çerkezköy" required>
                        </div>
                        <div class="form-group">
                            <label for="checkout-address-city" class="form-label">İl</label>
                            <input type="text" class="form-input" id="checkout-address-city" placeholder="Tekirdağ" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="checkout-address-detail" class="form-label">Adres Detayı</label>
                        <textarea class="form-input" id="checkout-address-detail" rows="2" placeholder="Mahalle, Sokak, No" required></textarea>
                    </div>
                    <div class="form-group">
                        <button type="submit" class="btn btn-primary btn-sm">Kaydet ve Kullan</button>
                        <button type="button" class="btn btn-secondary btn-sm" id="cancel-address-checkout" style="margin-left: 0.5rem;">İptal</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
`;

async function cizOdemeSayfasi()
{
        var sepet = window.getSepet();

        var tutarlar = await window.getSepetTotals(); 

    if (typeof tl !== 'function') 
    {
        console.error("HATA: tl() fonksiyonu bulunamadı. cart.js'in yüklendiğinden emin olun.");
        return;
    }

        var subtotalEl = document.getElementById('summary-subtotal');
        var deliveryEl = document.getElementById('summary-delivery');
        var totalEl = document.getElementById('summary-total');
        
        if (subtotalEl) subtotalEl.textContent = tl(tutarlar.ara);
        if (deliveryEl) deliveryEl.textContent = tl(tutarlar.teslimat);
        if (totalEl) totalEl.textContent = tl(tutarlar.toplam);
        
        if (!sepet || sepet.length === 0)
        {
                alert('Sepetiniz boş. Sepet sayfasına yönlendiriliyorsunuz.');
                const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                window.location.href = `${baseUrl}/buyer/cart`;
                return;
        }
}

document.addEventListener('DOMContentLoaded', async function(){

        // Adresleri yükle
        const addresses = await loadAddresses();
        renderAddresses(addresses);
        
        // Ödeme kartlarını yükle
        const cards = await loadPaymentCards();
        renderPaymentCards(cards);
        
        // Yeni adres formunu ekle
        const addressCard = document.querySelector('.checkout-card');
        if (addressCard && !document.getElementById('new-address-form-checkout')) {
            addressCard.insertAdjacentHTML('afterend', NEW_ADDRESS_FORM_CHECKOUT);
            
            // Yeni adres form submit
            const newAddressForm = document.getElementById('new-address-form-checkout-form');
            if (newAddressForm) {
                newAddressForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const title = document.getElementById('checkout-address-title').value.trim();
                    const district = document.getElementById('checkout-address-district').value.trim();
                    const city = document.getElementById('checkout-address-city').value.trim();
                    const detail = document.getElementById('checkout-address-detail').value.trim();
                    
                    if (!title || !district || !city || !detail) {
                        alert('Lütfen tüm alanları doldurun.');
                        return;
                    }
                    
                    try {
                        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                        const response = await fetch(`${baseUrl}/api/buyer/addresses`, {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ title, district, city, detail, isDefault: false })
                        });
                        
                        const data = await response.json();
                        if (data.success) {
                            // Adresleri yeniden yükle
                            const newAddresses = await loadAddresses();
                            renderAddresses(newAddresses);
                            
                            // Yeni eklenen adresi seç
                            const newAddressRadio = document.getElementById(`address-${data.addressId}`);
                            if (newAddressRadio) {
                                newAddressRadio.checked = true;
                            }
                            
                            // Formu gizle ve temizle
                            document.getElementById('new-address-form-checkout').style.display = 'none';
                            newAddressForm.reset();
                            document.getElementById('address-new').checked = false;
                            
                            alert('Adres başarıyla eklendi!');
                        } else {
                            alert('Adres eklenemedi: ' + (data.message || 'Bilinmeyen hata'));
                        }
                    } catch (error) {
                        console.error('Adres ekleme hatası:', error);
                        alert('Adres eklenirken bir hata oluştu.');
                    }
                });
            }
            
            // İptal butonu
            const cancelBtn = document.getElementById('cancel-address-checkout');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    document.getElementById('new-address-form-checkout').style.display = 'none';
                    document.getElementById('new-address-form-checkout-form').reset();
                    document.getElementById('address-new').checked = false;
                });
            }
        }

        cizOdemeSayfasi();
        
        var tamamlaBtn = document.getElementById('complete-order-btn') || document.querySelector('.order-summary .btn-primary');
        
        if (tamamlaBtn)
        {
                tamamlaBtn.addEventListener('click', async function(e){

                        e.preventDefault();
                        
                        var sepet = window.getSepet();
                        if(!sepet || !sepet.length)
                        {
                                alert('Sepetiniz boş.'); 
                                const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                                window.location.href = `${baseUrl}/buyer/cart`;
                                return;
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
                        
    	 	 	        var addressId = null;

            	 	 	if (adresSecili === 'new')
                                {
    	 	 	 	        // Yeni adres formunu göster
    	 	 	 	        const newAddressForm = document.getElementById('new-address-form-checkout');
    	 	 	 	        if (newAddressForm) {
    	 	 	 	            newAddressForm.style.display = 'block';
    	 	 	 	            newAddressForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    	 	 	 	        }
    	 	 	 	        return;
    	 	 	        }
                                else
                                {
                                        // Address ID'yi al
                                        addressId = parseInt(adresSecili);
                                        if (!addressId) {
                                            alert('Geçersiz adres seçildi.');
                                            return;
                                        }
    	 	 	        }

    	 	 	        var paymentMethod = 'credit_card';

    	 	 	 	        if (kartSecili === 'new')
                                        {
    	 	 	 	        var kartNo = document.getElementById('card-number')?.value;
    	 	 	 	        var kartAdi = document.getElementById('card-name')?.value;
    	 	 	 	        var kartExpiry = document.getElementById('card-expiry')?.value;
    	 	 	 	        var kartCvc = document.getElementById('card-cvc')?.value;

    	 	 	 	        if (!kartNo || !kartAdi || !kartExpiry) {
    	 	 	 	            alert('Lütfen tüm kart bilgilerini girin.');
    	 	 	 	 	 	return;
    	 	 	 	 	}
    	 	 	 	        
    	 	 	 	        // Kart numarasını temizle
    	 	 	 	        const cleanCardNo = kartNo.replace(/\s/g, '');
    	 	 	 	        
    	 	 	 	        // Expiry'yi parse et (MM/YY formatı)
    	 	 	 	        const expiryParts = kartExpiry.split('/');
    	 	 	 	        const expiryMonth = parseInt(expiryParts[0]);
    	 	 	 	        const expiryYear = parseInt(expiryParts[1]);
    	 	 	 	        
    	 	 	 	        if (!expiryMonth || !expiryYear || expiryMonth < 1 || expiryMonth > 12) {
    	 	 	 	            alert('Geçersiz son kullanma tarihi. MM/YY formatında girin.');
    	 	 	 	            return;
    	 	 	 	        }
    	 	 	 	        
    	 	 	 	        // Kartı kaydet
    	 	 	 	        try {
    	 	 	 	            const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
    	 	 	 	            const cardResponse = await fetch(`${baseUrl}/api/buyer/payment-cards`, {
    	 	 	 	                method: 'POST',
    	 	 	 	                credentials: 'include',
    	 	 	 	                headers: { 'Content-Type': 'application/json' },
    	 	 	 	                body: JSON.stringify({
    	 	 	 	                    cardName: kartAdi,
    	 	 	 	                    cardNumber: cleanCardNo,
    	 	 	 	                    expiryMonth: expiryMonth,
    	 	 	 	                    expiryYear: 2000 + expiryYear, // YY'yi YYYY'ye çevir
    	 	 	 	                    cvc: kartCvc,
    	 	 	 	                    isDefault: false
    	 	 	 	                })
    	 	 	 	            });
    	 	 	 	            
    	 	 	 	            const cardData = await cardResponse.json();
    	 	 	 	            if (!cardData.success) {
    	 	 	 	                alert('Kart kaydedilemedi: ' + (cardData.message || 'Bilinmeyen hata'));
    	 	 	 	                return;
    	 	 	 	            }
    	 	 	 	            
    	 	 	 	            // Kartları yeniden yükle ve yeni kartı seç
    	 	 	 	            const newCards = await loadPaymentCards();
    	 	 	 	            renderPaymentCards(newCards);
    	 	 	 	            
    	 	 	 	            const newCardRadio = document.getElementById(`card-${cardData.cardId}`);
    	 	 	 	            if (newCardRadio) {
    	 	 	 	                newCardRadio.checked = true;
    	 	 	 	            }
    	 	 	 	            
    	 	 	 	            // Formu gizle
    	 	 	 	            document.getElementById('new-card-form').style.display = 'none';
    	 	 	 	            document.getElementById('card-new').checked = false;
    	 	 	 	            
    	 	 	 	            // Kart seçimini güncelle
    	 	 	 	            kartSecili = cardData.cardId.toString();
    	 	 	 	        } catch (cardError) {
    	 	 	 	            console.error('Kart kaydetme hatası:', cardError);
    	 	 	 	            alert('Kart kaydedilirken bir hata oluştu.');
    	 	 	 	            return;
    	 	 	 	        }
    	 	 	        } else {
    	 	 	            // Mevcut kart seçildi - zaten paymentMethod = 'credit_card' olarak tanımlı
    	 	 	        }

    	 	 	        // Sepeti API formatına çevir
    	 	 	        var cartForAPI = sepet.map(function(item) {
    	 	 	            return {
    	 	 	                mealId: item.urun.id,
    	 	 	                quantity: item.adet,
    	 	 	                price: item.urun.price || item.urun.fiyat,
    	 	 	                urun: item.urun, // Backend sellerId için gerekli
    	 	 	                sellerId: item.urun.sellerId || null
    	 	 	            };
    	 	 	        });

    	 	 	        console.log('Sipariş oluşturuluyor...', { cart: cartForAPI, addressId, paymentMethod });
    	 	 	                tamamlaBtn.textContent = 'İşleniyor...';
                                        tamamlaBtn.disabled = true;
    	 	 	
            	 	 	if (typeof window.createOrder === 'function')
                                        {
            	 	 	    try {
            	 	 	        console.log('📦 Sipariş oluşturuluyor...', { cart: cartForAPI, addressId, paymentMethod });
            	 	 	        const sonuc = await window.createOrder(cartForAPI, addressId, paymentMethod);
            	 	 	        console.log('📦 Sipariş sonucu:', sonuc);
            	 	 	        
            	 	 	        if (!sonuc || !sonuc.success) {
            	 	 	            throw new Error(sonuc?.message || 'Sipariş oluşturulamadı');
            	 	 	        }
            	 	 	        
            	 	 	        // Sepeti temizle
    	 	 	 	 	 	window.sepetiTemizle();
    	 	 	 	 	 	// Floating cart'ı kapat
    	 	 	 	 	 	if (window.closeFloatingCart) {
    	 	 	 	 	 	    window.closeFloatingCart();
    	 	 	 	 	 	}
    	 	 	 	 	 	// Sipariş onay sayfasına yönlendir
    	 	 	 	 	 	const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
    	 	 	 	 	 	const orderId = sonuc.orderId || sonuc.id;
    	 	 	 	 	 	if (orderId) {
    	 	 	 	 	 	    console.log('✅ Sipariş oluşturuldu, yönlendiriliyor:', orderId);
    	 	 	 	 	 	    window.location.href = `${baseUrl}/buyer/order-confirmation/${orderId}`;
    	 	 	 	 	 	} else {
    	 	 	 	 	 	    console.warn('⚠️ OrderId bulunamadı, siparişler sayfasına yönlendiriliyor');
    	 	 	 	 	 	    window.location.href = `${baseUrl}/buyer/orders`;
    	 	 	 	 	 	}
            	 	 	    } catch (err) {
            	 	 	        console.error('❌ Sipariş hatası:', err);
            	 	 	        console.error('❌ Hata detayı:', err.stack);
            	 	 	        alert('Sipariş sırasında bir hata oluştu: ' + (err.message || String(err)));
    	 	 	 	 	 	tamamlaBtn.textContent = 'Siparişi Tamamla'; 
                                                tamamlaBtn.disabled = false;
            	 	 	    }
    	 	 	                }
                                        else
                                        {
    	 	 	 	        alert('Hata: api.js bulunamadı veya global createOrder fonksiyonu eksik.');
 	 	 	 	            tamamlaBtn.textContent = 'Siparişi Tamamla'; 
 	 	 	 	            tamamlaBtn.disabled = false;
    	 	 	                }
    	 	});
    	}

    	// Adres seçimi event listener
    	document.addEventListener('change', function(e) {
    	    if (e.target.name === 'address') {
    	        if (e.target.value === 'new') {
    	            // Yeni adres formunu göster
    	            const newAddressForm = document.getElementById('new-address-form-checkout');
    	            if (newAddressForm) {
    	                newAddressForm.style.display = 'block';
    	                newAddressForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    	            }
    	        } else {
    	            // Yeni adres formunu gizle
    	            const newAddressForm = document.getElementById('new-address-form-checkout');
    	            if (newAddressForm) {
    	                newAddressForm.style.display = 'none';
    	            }
    	        }
    	    }

    	    if (e.target.name === 'payment-card') {
    	 	 	        var form = document.getElementById('new-card-form');
    	        if (form) {
    	            if (e.target.value === 'new') {
    	 	 	 	 	form.style.display = 'block';
    	            } else {
    	 	 	 	 	form.style.display = 'none';
    	            }
            	 	 	}
    	 	 	}
    	 	});
});