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
                        
                        let restaurantInfo = '';
                        let couponClickable = false;
                        let couponData = null;
                        
                        if (coupon.applicableSellers === null) {
                            restaurantInfo = '<span style="color: #059669; font-size: 0.85rem; cursor: pointer; text-decoration: underline;" class="show-all-restaurants" data-coupon-index="' + index + '">Tüm restoranlarda geçerli (detaylar için tıklayın)</span>';
                            couponClickable = true;
                            couponData = { type: 'all', coupon: coupon };
                        } else if (coupon.applicableSellers && coupon.applicableSellers.length === 1) {
                            const sellerName = coupon.applicableSellers[0].name;
                            restaurantInfo = '<span style="color: #2563EB; font-size: 0.9rem; font-weight: 600;">📍 ' + sellerName + '</span>';
                            couponClickable = false;
                        } else if (coupon.applicableSellers && coupon.applicableSellers.length > 1) {
                            const restaurantCount = coupon.applicableSellers.length;
                            restaurantInfo = '<span style="color: #2563EB; font-size: 0.85rem; cursor: pointer; text-decoration: underline;" class="show-restaurants-modal" data-coupon-index="' + index + '">' + restaurantCount + ' restoranda geçerli (detaylar için tıklayın)</span>';
                            couponClickable = true;
                            couponData = { type: 'multiple', coupon: coupon, sellers: coupon.applicableSellers };
                        }
                        
                        const couponHtml = `
                            <div class="coupon-item" data-coupon-id="${coupon.id}" data-coupon-index="${index}" style="padding: 1.25rem; margin-bottom: 1rem; background: var(--card-bg); border-radius: 8px; border-left: 4px solid var(--primary-color); ${couponClickable ? 'cursor: pointer;' : ''} transition: all 0.3s;" ${couponClickable ? 'onclick="showCouponRestaurantsModal(' + index + ')"' : ''}>
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
                                    <h3 style="margin: 0 0 1.5rem 0; color: var(--text-color); font-size: 1.5rem;">Geçerli Restoranlar</h3>
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
                        
                        if (couponData.type === 'all') {
                            content.innerHTML = '<p style="color: var(--text-color-light); margin-bottom: 1rem;">Bu kupon tüm restoranlarda geçerlidir.</p>';
                        } else if (couponData.type === 'multiple' && couponData.sellers) {
                            content.innerHTML = `
                                <p style="color: var(--text-color-light); margin-bottom: 1rem;">Bu kupon aşağıdaki restoranlarda geçerlidir:</p>
                                <div style="display: flex; flex-wrap: wrap; gap: 0.75rem;">
                                    ${couponData.sellers.map(seller => `
                                        <a href="/buyer/seller-profile/${seller.id}" style="display: inline-block; padding: 0.75rem 1.25rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; color: var(--primary-color); text-decoration: none; font-size: 0.95rem; transition: all 0.2s;" 
                                           onmouseover="this.style.borderColor='var(--primary-color)';" 
                                           onmouseout="this.style.borderColor='var(--border-color)';">
                                            ${seller.name}
                                        </a>
                                    `).join('')}
                                </div>
                            `;
                        }
                        
                        modal.style.display = 'flex';
                    };
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

