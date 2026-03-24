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
    }
};

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

    await loadWalletData();
});

