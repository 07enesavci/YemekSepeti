function initCreditCardAnimation(ids) {
    const cardEl = document.getElementById(ids.card);
    const highlightEl = document.getElementById(ids.highlight);
    const cardNumEl = document.getElementById(ids.number);
    const cardHolderEl = document.getElementById(ids.holder);
    const cardMonthEl = document.getElementById(ids.month);
    const cardYearEl = document.getElementById(ids.year);
    const cardCvvEl = document.getElementById(ids.cvv);
    const numInput = document.getElementById(ids.numInput);
    const holderInput = document.getElementById(ids.holderInput);
    const expiryInput = document.getElementById(ids.expiryInput);
    const cvvInput = document.getElementById(ids.cvvInput);

    if (!cardEl || !numInput) return null;

    numInput.addEventListener('focus', () => {
        cardEl.classList.remove('flip');
        highlightEl.className = 'cc-anim-highlight hl-number';
    });
    if (holderInput) holderInput.addEventListener('focus', () => {
        cardEl.classList.remove('flip');
        highlightEl.className = 'cc-anim-highlight hl-holder';
    });
    if (expiryInput) expiryInput.addEventListener('focus', () => {
        cardEl.classList.remove('flip');
        highlightEl.className = 'cc-anim-highlight hl-expire';
    });
    if (cvvInput) {
        cvvInput.addEventListener('focus', () => {
            cardEl.classList.add('flip');
            highlightEl.className = 'cc-anim-highlight hl-cvv';
        });
        cvvInput.addEventListener('focusout', () => {
            cardEl.classList.remove('flip');
            highlightEl.className = 'cc-anim-highlight hl-hidden';
        });
    }

    numInput.addEventListener('input', (e) => {
        let numbers = e.target.value.replace(/\D/g, '');
        if (numbers.length > 16) numbers = numbers.slice(0, 16);
        e.target.value = numbers.replace(/(\d{4})(?=\d)/g, '$1 ');

        const raw = numbers;
        const spans = cardNumEl.children;
        for (let i = 0; i < 16; i++) {
            if (i < raw.length) {
                const char = (i >= 4 && i < 12) ? '*' : raw[i];
                spans[i].innerHTML = '#<br>' + char;
                spans[i].classList.add('filed');
            } else {
                spans[i].innerHTML = '#<br>';
                spans[i].classList.remove('filed');
            }
        }
    });

    if (holderInput) holderInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ\s]/g, '');
        cardHolderEl.innerText = holderInput.value || 'Ad Soyad';
    });
    if (expiryInput) expiryInput.addEventListener('input', (e) => {
        if (e.inputType === 'deleteContentBackward' && e.target.value.endsWith('/')) {
            e.target.value = e.target.value.slice(0, -1);
        }
        let numbers = e.target.value.replace(/\D/g, '');
        if (numbers.length >= 1 && parseInt(numbers[0], 10) > 1) numbers = '0' + numbers;
        if (numbers.length >= 2) {
            const month = parseInt(numbers.substring(0, 2), 10);
            if (month > 12) numbers = '12' + numbers.slice(2);
            else if (month === 0) numbers = '01' + numbers.slice(2);
        }
        if (numbers.length > 4) numbers = numbers.slice(0, 4);
        if (numbers.length >= 3) e.target.value = numbers.slice(0, 2) + '/' + numbers.slice(2);
        else e.target.value = numbers;

        cardMonthEl.innerText = numbers.substring(0, 2).padEnd(2, 'A');
        cardYearEl.innerText = numbers.substring(2, 4).padEnd(2, 'Y');
    });
    if (cvvInput) cvvInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 3) val = val.slice(0, 3);
        e.target.value = val;
        cardCvvEl.innerText = '*'.repeat(val.length);
    });

    return function resetCard() {
        Array.from(cardNumEl.children).forEach(s => { s.classList.remove('filed'); s.innerHTML = '#<br>'; });
        cardHolderEl.innerText = 'Ad Soyad';
        cardMonthEl.innerText = 'AA';
        cardYearEl.innerText = 'YY';
        cardCvvEl.innerText = '';
        cardEl.classList.remove('flip');
        highlightEl.className = 'cc-anim-highlight hl-hidden';
    };
}

async function loadAddresses() {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
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

async function loadPaymentCards() {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
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

function checkoutGetBaseUrl() {
    return window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
}

function escapeHtmlCheckout(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function checkoutYearShort(y) {
    const n = Number(y);
    if (!n || Number.isNaN(n)) return '';
    return String(n).length > 2 ? String(n).slice(-2) : String(n).padStart(2, '0');
}

function markCheckoutCardFormDirty() {
    window.__checkoutCardSavedForOrder = false;
}

/** @returns {null | { kartAdi: string, cleanCardNo: string, expiryMonth: number, expiryYear2: number, expiryYearFull: number, kartCvc: string, isDefault: boolean }} */
function parseCheckoutNewCardFields() {
    const kartNo = document.getElementById('card-number')?.value;
    const kartAdi = document.getElementById('card-name')?.value;
    const kartExpiry = document.getElementById('card-expiry')?.value;
    const kartCvc = document.getElementById('card-cvc')?.value;
    const isDefault = !!(document.getElementById('card-save-default')?.checked);

    if (!kartNo || !kartAdi || !kartExpiry) {
        return null;
    }
    const cleanCardNo = kartNo.replace(/\s/g, '');
    const expiryParts = kartExpiry.split('/');
    const expiryMonth = parseInt(expiryParts[0], 10);
    let expiryYear2 = parseInt(expiryParts[1], 10);
    if (Number.isNaN(expiryMonth) || Number.isNaN(expiryYear2) || expiryMonth < 1 || expiryMonth > 12) {
        return null;
    }
    if (expiryYear2 > 99) {
        expiryYear2 = parseInt(String(expiryYear2).slice(-2), 10);
    }
    const expiryYearFull = 2000 + expiryYear2;
    return {
        kartAdi: kartAdi.trim(),
        cleanCardNo,
        expiryMonth,
        expiryYear2,
        expiryYearFull,
        kartCvc: kartCvc,
        isDefault
    };
}

function buildIyzicoPayloadFromParsed(p) {
    if (!p || !p.kartCvc) return null;
    return {
        iyzicoCard: {
            cardHolderName: p.kartAdi,
            cardNumber: p.cleanCardNo,
            expireMonth: String(p.expiryMonth).padStart(2, '0'),
            expireYear: String(p.expiryYear2).padStart(2, '0'),
            cvc: String(p.kartCvc)
        }
    };
}

function ensureCheckoutEditModal() {
    if (document.getElementById('checkout-pc-edit-overlay')) return;
    document.body.insertAdjacentHTML('beforeend', `
<div id="checkout-pc-edit-overlay" class="pc-edit-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="checkout-pc-edit-title">
  <div class="pc-edit-modal">
    <h4 id="checkout-pc-edit-title">Kartı düzenle</h4>
    <p class="text-muted" style="font-size:0.88rem;margin:0 0 1rem;">Kart numarası güvenlik nedeniyle saklanmaz; sadece isim ve son kullanma güncellenir.</p>
    <form id="checkout-pc-edit-form">
      <input type="hidden" id="checkout-pc-edit-id" value="">
      <div class="form-group">
        <label for="checkout-pc-edit-name" class="form-label">Kart üzerindeki isim</label>
        <input type="text" id="checkout-pc-edit-name" class="form-input" required maxlength="80">
      </div>
      <div class="form-group">
        <label for="checkout-pc-edit-expiry" class="form-label">Son kullanma (AA/YY)</label>
        <input type="text" id="checkout-pc-edit-expiry" class="form-input" required placeholder="AA/YY" maxlength="5">
      </div>
      <div class="form-group">
        <label class="form-check form-check-inline">
          <input type="checkbox" id="checkout-pc-edit-default">
          <span>Varsayılan kart</span>
        </label>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">Kaydet</button>
        <button type="button" class="btn btn-secondary" id="checkout-pc-edit-cancel">İptal</button>
      </div>
    </form>
  </div>
</div>`);
    const overlay = document.getElementById('checkout-pc-edit-overlay');
    document.getElementById('checkout-pc-edit-cancel').addEventListener('click', () => overlay.classList.remove('is-open'));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('is-open'); });
    const nameIn = document.getElementById('checkout-pc-edit-name');
    if (nameIn) {
        nameIn.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ\s]/g, '');
        });
    }
    const expIn = document.getElementById('checkout-pc-edit-expiry');
    expIn.addEventListener('input', (e) => {
        if (e.inputType === 'deleteContentBackward' && expIn.value.endsWith('/')) expIn.value = expIn.value.slice(0, -1);
        let numbers = expIn.value.replace(/\D/g, '');
        if (numbers.length >= 1 && parseInt(numbers[0], 10) > 1) numbers = '0' + numbers;
        if (numbers.length >= 2) {
            const month = parseInt(numbers.substring(0, 2), 10);
            if (month > 12) numbers = '12' + numbers.slice(2);
            else if (month === 0) numbers = '01' + numbers.slice(2);
        }
        if (numbers.length > 4) numbers = numbers.slice(0, 4);
        if (numbers.length >= 3) expIn.value = numbers.slice(0, 2) + '/' + numbers.slice(2);
        else expIn.value = numbers;
    });
    document.getElementById('checkout-pc-edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = parseInt(document.getElementById('checkout-pc-edit-id').value, 10);
        const name = document.getElementById('checkout-pc-edit-name').value.trim();
        const expStr = document.getElementById('checkout-pc-edit-expiry').value;
        const parts = expStr.split('/');
        const em = parseInt(parts[0], 10);
        let ey = parseInt(parts[1], 10);
        if (ey < 100) ey = 2000 + ey;
        const isDef = document.getElementById('checkout-pc-edit-default').checked;
        if (!id || !name || !em || em < 1 || em > 12) {
            alert('Geçerli bilgiler girin.');
            return;
        }
        const baseUrl = checkoutGetBaseUrl();
        const res = await fetch(`${baseUrl}/api/buyer/payment-cards/${id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cardName: name,
                expiryMonth: em,
                expiryYear: ey,
                isDefault: isDef
            })
        });
        const data = await res.json().catch(() => ({}));
        if (data.success) {
            overlay.classList.remove('is-open');
            const cards = await loadPaymentCards();
            renderPaymentCards(cards);
        } else {
            alert(data.message || 'Güncellenemedi.');
        }
    });
}

function openCheckoutEditModal(card) {
    ensureCheckoutEditModal();
    const overlay = document.getElementById('checkout-pc-edit-overlay');
    document.getElementById('checkout-pc-edit-id').value = String(card.id);
    document.getElementById('checkout-pc-edit-name').value = card.cardName || '';
    const mm = String(card.expiryMonth || '').padStart(2, '0');
    const yy = checkoutYearShort(card.expiryYear);
    document.getElementById('checkout-pc-edit-expiry').value = `${mm}/${yy}`;
    document.getElementById('checkout-pc-edit-default').checked = !!card.isDefault;
    overlay.classList.add('is-open');
}

async function reverseGeocode(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&accept-language=tr`);
        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        const addr = data.address || {};

        const district = addr.town || addr.suburb || addr.city_district || addr.county || '';
        const city = addr.city || addr.state || addr.province || '';
        const road = addr.road || '';
        const houseNumber = addr.house_number || '';
        const neighbourhood = addr.neighbourhood || addr.quarter || addr.suburb || '';
        const detail = [neighbourhood, road, houseNumber].filter(Boolean).join(', ') || (data.display_name || '');

        return {
            district,
            city,
            detail,
            fullText: data.display_name || ''
        };
    } catch (error) {
        return null;
    }
}

function fillAddressFormWithLocation(formValues) {
    const districtInput = document.getElementById('checkout-address-district');
    const cityInput = document.getElementById('checkout-address-city');
    const detailInput = document.getElementById('checkout-address-detail');

    if (districtInput && formValues.district) districtInput.value = formValues.district;
    if (cityInput && formValues.city) cityInput.value = formValues.city;
    if (detailInput && formValues.detail) detailInput.value = formValues.detail;
}

async function useCurrentLocationForCheckoutAddress(buttonEl) {
    if (!navigator.geolocation) {
        alert('Tarayıcınız konum özelliğini desteklemiyor.');
        return;
    }

    const originalText = buttonEl.textContent;
    buttonEl.disabled = true;
    buttonEl.textContent = 'Konum alınıyor...';

    navigator.geolocation.getCurrentPosition(async (position) => {
        try {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            const form = document.getElementById('new-address-form-checkout-form');
            if (form) {
                form.dataset.latitude = String(lat);
                form.dataset.longitude = String(lng);
            }

            showCheckoutLocationPreview(lat, lng);

            const resolved = await reverseGeocode(lat, lng);
            if (resolved) {
                fillAddressFormWithLocation(resolved);
                alert('Konumdan adres bilgisi dolduruldu. Gerekirse düzenleyip kaydedin.');
            } else {
                alert('Konum alındı fakat adres çözümlenemedi. Lütfen alanları elle doldurun.');
            }
        } catch (error) {
            alert('Konum bilgisi işlenemedi.');
        } finally {
            buttonEl.disabled = false;
            buttonEl.textContent = originalText;
        }
    }, (error) => {
        buttonEl.disabled = false;
        buttonEl.textContent = originalText;

        if (error && error.code === 1) {
            alert('Konum izni reddedildi. Tarayıcıdan konum izni verin.');
        } else {
            alert('Konum alınamadı. Lütfen tekrar deneyin.');
        }
    }, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
    });
}

function showCheckoutLocationPreview(lat, lng) {
    const previewContainer = document.getElementById('checkout-location-preview');
    const previewMap = document.getElementById('checkout-location-preview-map');
    const previewCoords = document.getElementById('checkout-location-preview-coords');
    if (!previewContainer || !previewMap) {
        return;
    }

    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
        return;
    }

    const delta = 0.004;
    const left = (lngNum - delta).toFixed(6);
    const right = (lngNum + delta).toFixed(6);
    const top = (latNum + delta).toFixed(6);
    const bottom = (latNum - delta).toFixed(6);

    const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${latNum}%2C${lngNum}`;
    previewMap.src = embedUrl;

    if (previewCoords) {
        previewCoords.textContent = `Konum: ${latNum.toFixed(6)}, ${lngNum.toFixed(6)}`;
    }

    previewContainer.style.display = 'block';
}

function clearCheckoutLocationPreview() {
    const previewContainer = document.getElementById('checkout-location-preview');
    const previewMap = document.getElementById('checkout-location-preview-map');
    const previewCoords = document.getElementById('checkout-location-preview-coords');

    if (previewMap) {
        previewMap.src = 'about:blank';
    }
    if (previewCoords) {
        previewCoords.textContent = '';
    }
    if (previewContainer) {
        previewContainer.style.display = 'none';
    }
}

function renderAddresses(addresses) {
    const addressContainer = document.querySelector('.checkout-card .role-selector');
    if (!addressContainer) return;
    
    const newAddressRadio = addressContainer.querySelector('#address-new');
    const newAddressLabel = newAddressRadio ? newAddressRadio.closest('.form-check-radio') : null;
    addressContainer.innerHTML = '';
    
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

function renderPaymentCards(cards) {
    const paymentContainer = document.querySelectorAll('.checkout-card .role-selector')[1];
    if (!paymentContainer) return;

    const newCardRadio = paymentContainer.querySelector('#card-new');
    const newCardLabel = newCardRadio ? newCardRadio.closest('.form-check-radio') : null;
    paymentContainer.innerHTML = '';

    if (cards.length > 0) {
        cards.forEach((card) => {
            const row = document.createElement('div');
            row.className = 'checkout-payment-row';
            const yy = checkoutYearShort(card.expiryYear);
            const mm = String(card.expiryMonth || '').padStart(2, '0');
            const masked = card.cardNumber || ('**** **** **** ' + (card.cardLastFour || '****'));
            row.innerHTML = `
                <div class="form-check form-check-radio checkout-payment-card-wrap">
                    <input type="radio" id="card-${card.id}" name="payment-card" value="${card.id}" ${card.isDefault ? 'checked' : ''}>
                    <label for="card-${card.id}">
                        <strong>💳 ${escapeHtmlCheckout(masked)}</strong>
                        <span>${escapeHtmlCheckout(card.cardName || 'Kart')}</span>
                        ${card.expiryMonth && card.expiryYear ? `<span>(${mm}/${yy})</span>` : ''}
                        ${card.isDefault ? '<span class="badge badge-default">Varsayılan</span>' : ''}
                    </label>
                </div>
                <div class="checkout-payment-row-actions">
                    <button type="button" class="btn btn-secondary btn-sm btn-checkout-card" data-edit-card="${card.id}">Düzenle</button>
                    <button type="button" class="btn btn-secondary btn-sm btn-checkout-card danger" data-delete-card="${card.id}">Sil</button>
                </div>
            `;
            paymentContainer.appendChild(row);

            row.querySelector('[data-edit-card]')?.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = parseInt(e.currentTarget.getAttribute('data-edit-card'), 10);
                const c = cards.find((x) => x.id === id);
                if (c) openCheckoutEditModal(c);
            });
            row.querySelector('[data-delete-card]')?.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = parseInt(e.currentTarget.getAttribute('data-delete-card'), 10);
                if (!confirm('Bu kartı silmek istediğinize emin misiniz?')) return;
                const baseUrl = checkoutGetBaseUrl();
                const res = await fetch(`${baseUrl}/api/buyer/payment-cards/${id}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                const data = await res.json().catch(() => ({}));
                if (data.success) {
                    const refreshed = await loadPaymentCards();
                    renderPaymentCards(refreshed);
                    if (refreshed.length) {
                        const pick = refreshed.find((c) => c.isDefault) || refreshed[0];
                        const r = document.getElementById(`card-${pick.id}`);
                        if (r) r.checked = true;
                        const newForm = document.getElementById('new-card-form');
                        if (newForm) newForm.style.display = 'none';
                    } else {
                        const radioNew = document.getElementById('card-new');
                        if (radioNew) radioNew.checked = true;
                        const newForm = document.getElementById('new-card-form');
                        if (newForm) newForm.style.display = 'block';
                    }
                } else {
                    alert(data.message || 'Silinemedi.');
                }
            });
        });
    }

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
                    <div class="form-group" style="margin-top: -0.25rem;">
                        <button type="button" class="btn btn-secondary btn-sm" id="use-current-location-btn">📍 Konumumu Kullan</button>
                    </div>
                    <div id="checkout-location-preview" style="display: none; margin-bottom: 1rem;">
                        <div style="font-size: 0.9rem; color: var(--secondary-color); margin-bottom: 0.5rem;" id="checkout-location-preview-coords"></div>
                        <iframe
                            id="checkout-location-preview-map"
                            title="Checkout Konum Önizleme"
                            style="width: 100%; height: 220px; border: 1px solid var(--border-color); border-radius: 8px;"
                            loading="lazy"
                            referrerpolicy="no-referrer-when-downgrade"
                            src="about:blank"></iframe>
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

        var couponDiscountRow = document.getElementById('summary-coupon-discount-checkout');
        if (tutarlar.kuponIndirimi > 0) {
            if (!couponDiscountRow && deliveryEl) {
                var deliveryRow = deliveryEl.closest('.summary-row');
                if (deliveryRow) {
                    couponDiscountRow = document.createElement('div');
                    couponDiscountRow.className = 'summary-row';
                    couponDiscountRow.id = 'summary-coupon-discount-checkout';
                    deliveryRow.insertAdjacentElement('afterend', couponDiscountRow);
                }
            }

            if (couponDiscountRow) {
                var couponCode = (window.appliedCoupon && window.appliedCoupon.code) ? window.appliedCoupon.code : '';
                couponDiscountRow.innerHTML = '<span>Kupon İndirimi' + (couponCode ? ' (' + couponCode + ')' : '') + '</span><span style="color: #27AE60;">-' + tl(tutarlar.kuponIndirimi) + '</span>';
            }
        } else if (couponDiscountRow) {
            couponDiscountRow.remove();
        }

        if (totalEl) totalEl.textContent = tl(tutarlar.toplam);
        
        if (!sepet || sepet.length === 0)
        {
                alert('Sepetiniz boş. Sepet sayfasına yönlendiriliyorsunuz.');
                const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
                window.location.href = `${baseUrl}/buyer/cart`;
                return;
        }
}

document.addEventListener('DOMContentLoaded', async function(){

        const addresses = await loadAddresses();
        renderAddresses(addresses);
        
        const cards = await loadPaymentCards();
        renderPaymentCards(cards);
        
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
                    const latitude = newAddressForm.dataset.latitude || null;
                    const longitude = newAddressForm.dataset.longitude || null;
                    
                    if (!title || !district || !city || !detail) {
                        alert('Lütfen tüm alanları doldurun.');
                        return;
                    }
                    
                    try {
                        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
                        const response = await fetch(`${baseUrl}/api/buyer/addresses`, {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ title, district, city, detail, latitude, longitude, isDefault: false })
                        });
                        
                        const data = await response.json();
                        if (data.success) {
                            const newAddresses = await loadAddresses();
                            renderAddresses(newAddresses);
                            
                            const newAddressRadio = document.getElementById(`address-${data.addressId}`);
                            if (newAddressRadio) {
                                newAddressRadio.checked = true;
                            }
                            
                            document.getElementById('new-address-form-checkout').style.display = 'none';
                            newAddressForm.reset();
                            delete newAddressForm.dataset.latitude;
                            delete newAddressForm.dataset.longitude;
                            clearCheckoutLocationPreview();
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

            const useLocationBtn = document.getElementById('use-current-location-btn');
            if (useLocationBtn) {
                useLocationBtn.addEventListener('click', function() {
                    useCurrentLocationForCheckoutAddress(this);
                });
            }
            
            // İptal butonu
            const cancelBtn = document.getElementById('cancel-address-checkout');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    document.getElementById('new-address-form-checkout').style.display = 'none';
                    const formEl = document.getElementById('new-address-form-checkout-form');
                    formEl.reset();
                    delete formEl.dataset.latitude;
                    delete formEl.dataset.longitude;
                    clearCheckoutLocationPreview();
                    document.getElementById('address-new').checked = false;
                });
            }
        }

        // Kredi kartı 3D animasyon başlatma
        initCreditCardAnimation({
            card: 'checkout-cc-card',
            highlight: 'checkout-cc-highlight',
            number: 'checkout-cc-number',
            holder: 'checkout-cc-holder',
            month: 'checkout-cc-month',
            year: 'checkout-cc-year',
            cvv: 'checkout-cc-cvv',
            numInput: 'card-number',
            holderInput: 'card-name',
            expiryInput: 'card-expiry',
            cvvInput: 'card-cvc'
        });



        const newCardFormEl = document.getElementById('new-card-form');
        if (newCardFormEl) {
            newCardFormEl.addEventListener('input', markCheckoutCardFormDirty);
            newCardFormEl.addEventListener('change', markCheckoutCardFormDirty);
        }

        const checkoutSaveCardBtn = document.getElementById('checkout-save-card-btn');
        if (checkoutSaveCardBtn) {
            checkoutSaveCardBtn.addEventListener('click', async function () {
                const parsed = parseCheckoutNewCardFields();
                if (!parsed) {
                    alert('Kaydetmek için kart adı, numara ve son kullanma tarihini girin.');
                    return;
                }
                if (!parsed.kartCvc) {
                    alert('Kaydetmek için CVC girin.');
                    return;
                }
                checkoutSaveCardBtn.disabled = true;
                try {
                    const baseUrl = checkoutGetBaseUrl();
                    const cardResponse = await fetch(`${baseUrl}/api/buyer/payment-cards`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            cardName: parsed.kartAdi,
                            cardNumber: parsed.cleanCardNo,
                            expiryMonth: parsed.expiryMonth,
                            expiryYear: parsed.expiryYearFull,
                            cvc: parsed.kartCvc,
                            isDefault: parsed.isDefault
                        })
                    });
                    const cardData = await cardResponse.json();
                    if (!cardData.success) {
                        alert(cardData.message || 'Kart kaydedilemedi.');
                        return;
                    }
                    window.__checkoutCardSavedForOrder = true;
                    const newCards = await loadPaymentCards();
                    renderPaymentCards(newCards);
                    alert('Kart kaydedildi.');
                } catch (err) {
                    console.error('Checkout kart kaydetme:', err);
                    alert('Kart kaydedilirken bir hata oluştu.');
                } finally {
                    checkoutSaveCardBtn.disabled = false;
                }
            });
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
    	 	 	 	        const newAddressForm = document.getElementById('new-address-form-checkout');
    	 	 	 	        if (newAddressForm) {
    	 	 	 	            newAddressForm.style.display = 'block';
    	 	 	 	            newAddressForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    	 	 	 	        }
    	 	 	 	        return;
    	 	 	        }
                                else
                                {
                                        addressId = parseInt(adresSecili);
                                        if (!addressId) {
                                            alert('Geçersiz adres seçildi.');
                                            return;
                                        }
    	 	 	        }

    	 	 	        var paymentMethod = 'iyzico';
                        var iyzicoCardPayload = null;

    	 	 	 	        if (kartSecili === 'new')
                                        {
    	 	 	 	        const parsed = parseCheckoutNewCardFields();
    	 	 	 	        if (!parsed) {
    	 	 	 	            alert('Lütfen tüm kart bilgilerini girin.');
    	 	 	 	            return;
    	 	 	 	        }
    	 	 	 	        if (!parsed.kartCvc) {
                                    alert('Lütfen CVC bilgisini girin.');
                                    return;
                                }
                                iyzicoCardPayload = buildIyzicoPayloadFromParsed(parsed);
                                if (!iyzicoCardPayload) {
                                    alert('Lütfen CVC bilgisini girin.');
                                    return;
                                }

    	 	 	 	        const skipDbPost = !!window.__checkoutCardSavedForOrder;

    	 	 	 	        if (!skipDbPost) {
    	 	 	 	        try {
                                const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
    	 	 	 	            const cardResponse = await fetch(`${baseUrl}/api/buyer/payment-cards`, {
    	 	 	 	                method: 'POST',
    	 	 	 	                credentials: 'include',
    	 	 	 	                headers: { 'Content-Type': 'application/json' },
    	 	 	 	                body: JSON.stringify({
    	 	 	 	                    cardName: parsed.kartAdi,
    	 	 	 	                    cardNumber: parsed.cleanCardNo,
    	 	 	 	                    expiryMonth: parsed.expiryMonth,
    	 	 	 	                    expiryYear: parsed.expiryYearFull,
    	 	 	 	                    cvc: parsed.kartCvc,
    	 	 	 	                    isDefault: parsed.isDefault
    	 	 	 	                })
    	 	 	 	            });
    	 	 	 	            
    	 	 	 	            const cardData = await cardResponse.json();
    	 	 	 	            if (!cardData.success) {
    	 	 	 	                alert('Kart kaydedilemedi: ' + (cardData.message || 'Bilinmeyen hata'));
    	 	 	 	                return;
    	 	 	 	            }
    	 	 	 	            
    	 	 	 	            const newCards = await loadPaymentCards();
    	 	 	 	            renderPaymentCards(newCards);
    	 	 	 	            
    	 	 	 	            const newCardRadio = document.getElementById(`card-${cardData.cardId}`);
    	 	 	 	            if (newCardRadio) {
    	 	 	 	                newCardRadio.checked = true;
    	 	 	 	            }
    	 	 	 	            
    	 	 	 	            const ncf = document.getElementById('new-card-form');
    	 	 	 	            if (ncf) ncf.style.display = 'none';
    	 	 	 	            const cnew = document.getElementById('card-new');
    	 	 	 	            if (cnew) cnew.checked = false;
    	 	 	 	            
    	 	 	 	            kartSecili = cardData.cardId.toString();
    	 	 	 	        } catch (cardError) {
    	 	 	 	            console.error('Kart kaydetme hatası:', cardError);
    	 	 	 	            alert('Kart kaydedilirken bir hata oluştu.');
    	 	 	 	            return;
    	 	 	 	        }
    	 	 	 	        }
    	 	 	        } else {
                            alert('iyzico ödemesi için güvenlik nedeniyle bu aşamada yeni kart bilgisi girmeniz gerekiyor.');
                            return;
    	 	 	        }

    	 	 	        var cartForAPI = sepet.map(function(item) {
    	 	 	            return {
    	 	 	                mealId: item.urun.id,
    	 	 	                quantity: item.adet,
    	 	 	                price: item.urun.price || item.urun.fiyat,
    	 	 	                urun: item.urun,
    	 	 	                sellerId: item.urun.sellerId || null
    	 	 	            };
    	 	 	        });

    	 	 	        console.log('Sipariş oluşturuluyor...', { cart: cartForAPI, addressId, paymentMethod });
    	 	 	        var tamamlaOriginalHtml = tamamlaBtn.innerHTML;
    	 	 	        tamamlaBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> İşleniyor...';
    	 	 	        tamamlaBtn.disabled = true;
    	 	 	        tamamlaBtn.setAttribute('aria-busy', 'true');
    	 	 	
            	 	 	if (typeof window.createOrder === 'function')
                                        {
            	 	 	    try {
            	 	 	        console.log('📦 Sipariş oluşturuluyor...', { cart: cartForAPI, addressId, paymentMethod });
            	 	 	        const sonuc = await window.createOrder(cartForAPI, addressId, paymentMethod, iyzicoCardPayload);
            	 	 	        console.log('📦 Sipariş sonucu:', sonuc);
            	 	 	        
            	 	 	        if (!sonuc || !sonuc.success) {
            	 	 	            throw new Error(sonuc?.message || 'Sipariş oluşturulamadı');
            	 	 	        }
            	 	 	        
    	 	 	 	 	 	window.sepetiTemizle();
    	 	 	 	 	 	if (window.closeFloatingCart) {
    	 	 	 	 	 	    window.closeFloatingCart();
    	 	 	 	 	 	}
                            const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
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
            	 	 	        var msg = err && err.message ? err.message : String(err);
            	 	 	        if (!msg || msg === '[object Object]') msg = 'Sipariş oluşturulurken beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.';
            	 	 	        alert('Sipariş sırasında bir hata oluştu: ' + msg);
    	 	 	 	 	 	tamamlaBtn.innerHTML = typeof tamamlaOriginalHtml !== 'undefined' ? tamamlaOriginalHtml : 'Siparişi Tamamla';
    	 	 	 	 	 	tamamlaBtn.disabled = false;
    	 	 	 	 	 	tamamlaBtn.removeAttribute('aria-busy');
            	 	 	    }
    	 	 	                }
                                        else
                                        {
    	 	 	        alert('Hata: api.js bulunamadı veya global createOrder fonksiyonu eksik. Sayfayı yenileyip tekrar deneyin.');
 	 	 	 	            tamamlaBtn.innerHTML = typeof tamamlaOriginalHtml !== 'undefined' ? tamamlaOriginalHtml : 'Siparişi Tamamla';
 	 	 	 	            tamamlaBtn.disabled = false;
 	 	 	 	            tamamlaBtn.removeAttribute('aria-busy');
    	 	 	                }
    	 	});
    	}

    	// Adres seçimi event listener
    	document.addEventListener('change', function(e) {
    	    if (e.target.name === 'address') {
    	        if (e.target.value === 'new') {
    	            const newAddressForm = document.getElementById('new-address-form-checkout');
    	            if (newAddressForm) {
    	                newAddressForm.style.display = 'block';
    	                newAddressForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    	            }
    	        } else {
    	            const newAddressForm = document.getElementById('new-address-form-checkout');
    	            if (newAddressForm) {
    	                newAddressForm.style.display = 'none';
                        const formEl = document.getElementById('new-address-form-checkout-form');
                        if (formEl) {
                            delete formEl.dataset.latitude;
                            delete formEl.dataset.longitude;
                        }
                        clearCheckoutLocationPreview();
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