const BUYER_API = {
    getWalletAndCoupons: async () => {
        try {
            const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
            const response = await fetch(`${baseUrl}/api/buyer/wallet`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Cüzdan bilgileri yüklenemedi');
            const data = await response.json();
            return data.success ? data.data : { balance: 0, coupons: [] };
        } catch (error) {
            console.error('Cüzdan yükleme hatası:', error);
            return { balance: 0, coupons: [] };
        }
    },
    getPaymentCards: async () => {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/buyer/payment-cards`, { credentials: 'include' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) return [];
        return data.data || [];
    },
    savePaymentCard: async (body) => {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/buyer/payment-cards`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return response.json().catch(() => ({}));
    },
    updatePaymentCard: async (id, body) => {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/buyer/payment-cards/${id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return response.json().catch(() => ({}));
    },
    deletePaymentCard: async (id) => {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/buyer/payment-cards/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        return response.json().catch(() => ({}));
    }
};

function formatCardInput(el) {
    let numbers = el.value.replace(/\D/g, '');
    if (numbers.length > 16) numbers = numbers.slice(0, 16);
    el.value = numbers.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function formatExpiryInput(el, e) {
    if (e && e.inputType === 'deleteContentBackward' && el.value.endsWith('/')) {
        el.value = el.value.slice(0, -1);
        return;
    }
    let numbers = el.value.replace(/\D/g, '');
    if (numbers.length >= 1 && parseInt(numbers[0], 10) > 1) numbers = '0' + numbers;
    if (numbers.length >= 2) {
        const month = parseInt(numbers.substring(0, 2), 10);
        if (month > 12) numbers = '12' + numbers.slice(2);
        else if (month === 0) numbers = '01' + numbers.slice(2);
    }
    if (numbers.length > 4) numbers = numbers.slice(0, 4);
    if (numbers.length >= 3) el.value = numbers.slice(0, 2) + '/' + numbers.slice(2);
    else el.value = numbers;
}

function parseExpiryMmYy(str) {
    const parts = String(str || '').split('/');
    const month = parseInt(parts[0], 10);
    let year = parseInt(parts[1], 10);
    if (!month || month < 1 || month > 12) return null;
    if (year < 100) year = 2000 + year;
    if (year < 2000 || year > 2100) return null;
    return { month, year };
}

function yearToShort(y) {
    const n = Number(y);
    if (!n || Number.isNaN(n)) return '';
    return String(n).length > 2 ? String(n).slice(-2) : String(n).padStart(2, '0');
}

function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

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

    if (!cardEl || !numInput) return;

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
        enteredCount = 0;
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    const walletTransactions = document.getElementById('wallet-transactions');
    const couponsList = document.getElementById('coupons-list');
    const balanceElement = document.querySelector('.wallet-balance .total-price');
    const loadMoneyBtn = document.getElementById('load-money-btn');
    const logoutBtn = document.getElementById('logout-btn');

    async function loadWalletData() {
        try {
            const data = await BUYER_API.getWalletAndCoupons();
            
            if (balanceElement) {
                balanceElement.textContent = (window.formatTL || ((amt) => (amt || 0).toLocaleString('tr-TR', { 
                    style: 'currency', 
                    currency: 'TRY', 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                })))(data.balance);
            }

            if (walletTransactions) {
                walletTransactions.innerHTML = `
                    <p style="text-align: center; padding: 2rem; color: #666;">
                        Henüz işlem geçmişiniz bulunmamaktadır.
                    </p>
                `;
            }

            if (couponsList) {
                couponsList.innerHTML = '';
                
                if (data.coupons && data.coupons.length > 0) {
                    data.coupons.forEach((coupon, index) => {
                        let discountText = '';
                        if (coupon.discountType === 'fixed') {
                            discountText = `${(window.formatTL || ((amt) => (amt || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })))(coupon.discountValue)}`;
                        } else if (coupon.discountType === 'percentage') {
                            discountText = `%${coupon.discountValue}`;
                            if (coupon.maxDiscountAmount) {
                                discountText += ` (Max: ${(window.formatTL || ((amt) => (amt || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })))(coupon.maxDiscountAmount)})`;
                            }
                        }
                        
                        let restaurantInfo = '<span style="color: #2563EB; font-size: 0.85rem; cursor: pointer; text-decoration: underline;" class="show-coupon-details" data-coupon-index="' + index + '">Kupon detayları (detaylar için tıklayın)</span>';
                        let couponClickable = true;
                        let couponData = { coupon: coupon, sellers: coupon.applicableSellers };
                        
                        const couponHtml = `
                            <div class="coupon-item" data-coupon-id="${coupon.id}" data-coupon-index="${index}" style="padding: 1.25rem; margin-bottom: 1rem; background: var(--card-bg); border-radius: 8px; border-left: 4px solid var(--primary-color); ${couponClickable ? 'cursor: pointer;' : ''} transition: all 0.3s;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                                    <div style="flex: 1;">
                                        <span class="coupon-code" style="font-weight: 700; font-size: 1.2rem; color: var(--primary-color); display: block; margin-bottom: 0.5rem;">${coupon.code || 'KUPON'}</span>
                                        <p style="margin: 0 0 0.5rem 0; color: var(--text-color-light); font-size: 0.95rem;">${coupon.description || 'Açıklama yok'}</p>
                                        ${restaurantInfo}
                                        ${coupon.minOrderAmount > 0 ? `<p style="margin: 0.5rem 0 0 0; color: var(--text-color-light); font-size: 0.85rem;">Min. sipariş: ${(window.formatTL || ((amt) => (amt || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })))(coupon.minOrderAmount)}</p>` : ''}
                                    </div>
                                    <div style="text-align: right; margin-left: 1rem;">
                                        <strong style="color: var(--primary-color); font-size: 1.5rem; display: block;">${discountText}</strong>
                                    </div>
                                </div>
                            </div>
                        `;
                        couponsList.insertAdjacentHTML('beforeend', couponHtml);
                        
                        if (couponClickable && couponData) {
                            if (!window.couponModalData) {
                                window.couponModalData = {};
                            }
                            window.couponModalData[index] = couponData;
                        }
                    });
                    
                    if (!document.getElementById('coupon-restaurants-modal')) {
                        const modalHtml = `
                            <div id="coupon-restaurants-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center;">
                                <div style="background: var(--card-bg); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; position: relative; border: 1px solid var(--border-color);">
                                    <button id="close-coupon-modal" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-color-light);">&times;</button>
                                    <h3 style="margin: 0 0 1.5rem 0; color: var(--text-color); font-size: 1.5rem;">Kupon Detayları</h3>
                                    <div id="coupon-modal-content"></div>
                                </div>
                            </div>
                        `;
                        document.body.insertAdjacentHTML('beforeend', modalHtml);
                        
                        document.getElementById('close-coupon-modal').addEventListener('click', () => {
                            document.getElementById('coupon-restaurants-modal').style.display = 'none';
                        });
                        
                        document.getElementById('coupon-restaurants-modal').addEventListener('click', (e) => {
                            if (e.target.id === 'coupon-restaurants-modal') {
                                document.getElementById('coupon-restaurants-modal').style.display = 'none';
                            }
                        });
                    }
                    
                    window.showCouponRestaurantsModal = function(index) {
                        const modal = document.getElementById('coupon-restaurants-modal');
                        const content = document.getElementById('coupon-modal-content');
                        const couponData = window.couponModalData && window.couponModalData[index];
                        
                        if (!modal || !content || !couponData) return;

                        const coupon = couponData.coupon || {};
                        const sellers = couponData.sellers;
                        const formatTL = window.formatTL || ((amt) => (amt || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }));
                        const formatDate = function(value) {
                            if (!value) return '-';
                            const dt = new Date(value);
                            if (isNaN(dt.getTime())) return '-';
                            return dt.toLocaleDateString('tr-TR');
                        };

                        let discountInfo = '-';
                        if (coupon.discountType === 'percentage') {
                            discountInfo = '%' + (coupon.discountValue || 0) + ' indirim';
                            if (coupon.maxDiscountAmount) {
                                discountInfo += ' (Maks: ' + formatTL(coupon.maxDiscountAmount) + ')';
                            }
                        } else {
                            discountInfo = formatTL(coupon.discountValue || 0) + ' indirim';
                        }

                        let restaurantsHtml = '<p style="color: var(--text-color-light); margin: 0;">Geçerlilik bilgisi bulunamadı.</p>';
                        if (sellers === null) {
                            restaurantsHtml = '<p style="color: var(--text-color-light); margin: 0;">Tüm restoranlarda geçerli.</p>';
                        } else if (Array.isArray(sellers) && sellers.length > 0) {
                            restaurantsHtml = `
                                <div style="display: flex; flex-wrap: wrap; gap: 0.75rem;">
                                    ${sellers.map(seller => `
                                        <a href="/buyer/seller-profile/${seller.id}" style="display: inline-block; padding: 0.75rem 1.25rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; color: var(--primary-color); text-decoration: none; font-size: 0.95rem; transition: all 0.2s;"
                                           onmouseover="this.style.borderColor='var(--primary-color)';"
                                           onmouseout="this.style.borderColor='var(--border-color)';">
                                            ${seller.name}
                                        </a>
                                    `).join('')}
                                </div>
                            `;
                        }

                        content.innerHTML = `
                            <div style="display: grid; gap: 0.75rem;">
                                <p style="margin: 0;"><strong>Kod:</strong> ${coupon.code || '-'}</p>
                                <p style="margin: 0;"><strong>Açıklama:</strong> ${coupon.description || '-'}</p>
                                <p style="margin: 0;"><strong>İndirim:</strong> ${discountInfo}</p>
                                <p style="margin: 0;"><strong>Minimum sipariş:</strong> ${formatTL(coupon.minOrderAmount || 0)}</p>
                                <p style="margin: 0;"><strong>Geçerlilik tarihi:</strong> ${formatDate(coupon.validFrom)} - ${formatDate(coupon.validUntil)}</p>
                                <div style="margin-top: 0.5rem;">
                                    <p style="margin: 0 0 0.5rem 0;"><strong>Geçerli restoranlar:</strong></p>
                                    ${restaurantsHtml}
                                </div>
                            </div>
                        `;
                        
                        modal.style.display = 'flex';
                    };

                    if (couponsList && !couponsList.dataset.couponModalBound) {
                        couponsList.dataset.couponModalBound = 'true';
                        couponsList.addEventListener('click', function(e) {
                            const clickableEl = e.target.closest('.show-coupon-details, .coupon-item[data-coupon-index]');
                            if (!clickableEl) {
                                return;
                            }

                            const couponItem = clickableEl.classList.contains('coupon-item')
                                ? clickableEl
                                : clickableEl.closest('.coupon-item[data-coupon-index]');

                            if (!couponItem) {
                                return;
                            }

                            const indexAttr = couponItem.getAttribute('data-coupon-index');
                            const couponIndex = parseInt(indexAttr, 10);
                            if (Number.isNaN(couponIndex)) {
                                return;
                            }

                            const couponData = window.couponModalData && window.couponModalData[couponIndex];
                            if (!couponData) {
                                return;
                            }

                            e.preventDefault();
                            e.stopPropagation();
                            window.showCouponRestaurantsModal(couponIndex);
                        });
                    }
                } else {
                    couponsList.innerHTML = `
                        <div class="coupon-item" style="text-align: center; padding: 2rem; color: var(--text-color-light); background: var(--card-bg);">
                            <p>Henüz aktif kupon bulunmamaktadır.</p>
                        </div>
                    `;
                }
            }
        } catch (error) {
            console.error('Cüzdan verisi yüklenirken hata:', error);
            if (walletTransactions) {
                walletTransactions.innerHTML = '<p style="text-align: center; padding: 2rem; color: red;">Cüzdan bilgileri yüklenirken bir hata oluştu.</p>';
            }
            if (couponsList) {
                couponsList.innerHTML = '<p style="text-align: center; padding: 2rem; color: red;">Kuponlar yüklenirken bir hata oluştu.</p>';
            }
        }
    }

    if (loadMoneyBtn) {
        loadMoneyBtn.addEventListener('click', () => {
            alert('Para yükleme özelliği yakında eklenecektir.');
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.logout) {
                window.logout();
            } else {
                alert("Başarıyla çıkış yaptınız.");
                const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                window.location.href = `${baseUrl}/`;
            }
        });
    }

    const savedCardsList = document.getElementById('saved-cards-list');
    const toggleAddBtn = document.getElementById('toggle-add-card-btn');
    const addCardPanel = document.getElementById('add-card-panel');
    const addCardForm = document.getElementById('add-card-form');
    const addCardCancel = document.getElementById('add-card-cancel-btn');
    const newPcNumber = document.getElementById('new-pc-number');
    const newPcExpiry = document.getElementById('new-pc-expiry');

    function ensureEditModal() {
        let el = document.getElementById('pc-edit-modal-overlay');
        if (el) return el;
        document.body.insertAdjacentHTML('beforeend', `
<div id="pc-edit-modal-overlay" class="pc-edit-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="pc-edit-title">
  <div class="pc-edit-modal">
    <h4 id="pc-edit-title">Kartı düzenle</h4>
    <p class="text-muted" style="font-size:0.88rem;margin:0 0 1rem;">Kart numarası güvenlik nedeniyle saklanmaz; sadece isim ve son kullanma güncellenir.</p>
    <form id="pc-edit-form">
      <input type="hidden" id="pc-edit-id" value="">
      <div class="form-group">
        <label for="pc-edit-name" class="form-label">Kart üzerindeki isim</label>
        <input type="text" id="pc-edit-name" class="form-input" required maxlength="80">
      </div>
      <div class="form-group">
        <label for="pc-edit-expiry" class="form-label">Son kullanma (AA/YY)</label>
        <input type="text" id="pc-edit-expiry" class="form-input" required placeholder="AA/YY" maxlength="5">
      </div>
      <div class="form-group">
        <label class="form-check form-check-inline">
          <input type="checkbox" id="pc-edit-default">
          <span>Varsayılan kart</span>
        </label>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary" id="pc-edit-save-btn">Kaydet</button>
        <button type="button" class="btn btn-secondary" id="pc-edit-cancel-btn">İptal</button>
      </div>
    </form>
  </div>
</div>`);
        el = document.getElementById('pc-edit-modal-overlay');
        document.getElementById('pc-edit-cancel-btn').addEventListener('click', () => {
            el.classList.remove('is-open');
        });
        el.addEventListener('click', (e) => {
            if (e.target === el) el.classList.remove('is-open');
        });
        const nameIn = document.getElementById('pc-edit-name');
        if (nameIn) {
            nameIn.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ\s]/g, '');
            });
        }
        const expIn = document.getElementById('pc-edit-expiry');
        expIn.addEventListener('input', (e) => formatExpiryInput(expIn, e));
        return el;
    }

    async function renderSavedCards() {
        if (!savedCardsList) return;
        savedCardsList.innerHTML = '<p class="text-muted payment-cards-loading">Yükleniyor…</p>';
        const cards = await BUYER_API.getPaymentCards();
        if (!cards.length) {
            savedCardsList.innerHTML = `
                <div class="payment-cards-empty">
                    <p>Henüz kayıtlı kartınız yok.</p>
                    <p style="font-size:0.9rem;margin-top:0.5rem;">Aşağıdan yeni kart ekleyebilirsiniz.</p>
                </div>`;
            return;
        }
        savedCardsList.innerHTML = '';
        cards.forEach((c) => {
            const yy = yearToShort(c.expiryYear);
            const mm = String(c.expiryMonth || '').padStart(2, '0');
            const tile = document.createElement('div');
            tile.className = 'saved-card-tile' + (c.isDefault ? ' is-default' : '');
            tile.dataset.cardId = String(c.id);
            tile.innerHTML = `
                <div class="saved-card-visual">
                    <span class="saved-card-chip" aria-hidden="true"></span>
                    <div class="saved-card-number">${c.cardNumber || ('**** **** **** ' + (c.cardLastFour || '****'))}</div>
                    <div class="saved-card-name">${escapeHtml(c.cardName || 'Kart')}</div>
                    <div class="saved-card-meta">SKT ${mm}/${yy}</div>
                    ${c.isDefault ? '<span class="saved-card-badge">Varsayılan</span>' : ''}
                </div>
                <div class="saved-card-actions">
                    <button type="button" class="btn btn-sm btn-card-edit" data-action="edit" data-id="${c.id}">Düzenle</button>
                    <button type="button" class="btn btn-sm btn-card-delete" data-action="delete" data-id="${c.id}">Sil</button>
                </div>`;
            savedCardsList.appendChild(tile);
        });

        savedCardsList.querySelectorAll('[data-action="edit"]').forEach((btn) => {
            btn.addEventListener('click', () => openEditModal(parseInt(btn.dataset.id, 10), cards));
        });
        savedCardsList.querySelectorAll('[data-action="delete"]').forEach((btn) => {
            btn.addEventListener('click', () => deleteCard(parseInt(btn.dataset.id, 10)));
        });
    }

    function openEditModal(cardId, cardsList) {
        const c = (cardsList || []).find((x) => x.id === cardId);
        if (!c) return;
        ensureEditModal();
        const overlay = document.getElementById('pc-edit-modal-overlay');
        document.getElementById('pc-edit-id').value = String(cardId);
        document.getElementById('pc-edit-name').value = c.cardName || '';
        const mm = String(c.expiryMonth || '').padStart(2, '0');
        const yy = yearToShort(c.expiryYear);
        document.getElementById('pc-edit-expiry').value = `${mm}/${yy}`;
        document.getElementById('pc-edit-default').checked = !!c.isDefault;
        overlay.classList.add('is-open');
    }

    async function deleteCard(cardId) {
        const ok = window.showConfirm
            ? await window.showConfirm('Bu kartı silmek istediğinize emin misiniz?')
            : window.confirm('Bu kartı silmek istediğinize emin misiniz?');
        if (!ok) return;
        const data = await BUYER_API.deletePaymentCard(cardId);
        if (data.success) {
            await renderSavedCards();
        } else {
            alert(data.message || 'Kart silinemedi.');
        }
    }

    const resetWalletCard = initCreditCardAnimation({
        card: 'wallet-cc-card',
        highlight: 'wallet-cc-highlight',
        number: 'wallet-cc-number',
        holder: 'wallet-cc-holder',
        month: 'wallet-cc-month',
        year: 'wallet-cc-year',
        cvv: 'wallet-cc-cvv',
        numInput: 'new-pc-number',
        holderInput: 'new-pc-name',
        expiryInput: 'new-pc-expiry',
        cvvInput: 'new-pc-cvc'
    });

    if (toggleAddBtn && addCardPanel) {
        toggleAddBtn.addEventListener('click', () => {
            const open = addCardPanel.hidden;
            addCardPanel.hidden = !open;
            toggleAddBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
            toggleAddBtn.textContent = open ? '− Formu gizle' : '+ Yeni kart ekle';
        });
    }

    if (newPcNumber) {
        newPcNumber.addEventListener('input', () => formatCardInput(newPcNumber));
    }
    if (newPcExpiry) {
        newPcExpiry.addEventListener('input', (e) => formatExpiryInput(newPcExpiry, e));
    }

    if (addCardCancel && addCardPanel && addCardForm) {
        addCardCancel.addEventListener('click', () => {
            addCardForm.reset();
            if (resetWalletCard) resetWalletCard();
            addCardPanel.hidden = true;
            if (toggleAddBtn) {
                toggleAddBtn.setAttribute('aria-expanded', 'false');
                toggleAddBtn.textContent = '+ Yeni kart ekle';
            }
        });
    }

    if (addCardForm) {
        addCardForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('new-pc-name').value.trim();
            const num = document.getElementById('new-pc-number').value.replace(/\s/g, '');
            const exp = parseExpiryMmYy(document.getElementById('new-pc-expiry').value);
            const cvc = document.getElementById('new-pc-cvc').value.trim();
            const isDef = document.getElementById('new-pc-default').checked;
            if (!name || num.length < 13 || !exp) {
                alert('Lütfen kart bilgilerini eksiksiz girin.');
                return;
            }
            const body = {
                cardName: name,
                cardNumber: num,
                expiryMonth: exp.month,
                expiryYear: exp.year,
                cvc: cvc || undefined,
                isDefault: isDef
            };
            const data = await BUYER_API.savePaymentCard(body);
            if (data.success) {
                addCardForm.reset();
                if (resetWalletCard) resetWalletCard();
                addCardPanel.hidden = true;
                if (toggleAddBtn) {
                    toggleAddBtn.setAttribute('aria-expanded', 'false');
                    toggleAddBtn.textContent = '+ Yeni kart ekle';
                }
                await renderSavedCards();
            } else {
                alert(data.message || 'Kart kaydedilemedi.');
            }
        });
    }

    document.addEventListener('submit', async (e) => {
        if (e.target && e.target.id === 'pc-edit-form') {
            e.preventDefault();
            const id = parseInt(document.getElementById('pc-edit-id').value, 10);
            const name = document.getElementById('pc-edit-name').value.trim();
            const exp = parseExpiryMmYy(document.getElementById('pc-edit-expiry').value);
            const isDef = document.getElementById('pc-edit-default').checked;
            if (!id || !name || !exp) {
                alert('Geçerli bilgiler girin.');
                return;
            }
            const data = await BUYER_API.updatePaymentCard(id, {
                cardName: name,
                expiryMonth: exp.month,
                expiryYear: exp.year,
                isDefault: isDef
            });
            if (data.success) {
                document.getElementById('pc-edit-modal-overlay').classList.remove('is-open');
                await renderSavedCards();
            } else {
                alert(data.message || 'Güncellenemedi.');
            }
        }
    });

    await loadWalletData();
    if (savedCardsList) {
        await renderSavedCards();
    }
});

