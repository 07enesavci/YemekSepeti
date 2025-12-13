// ============================================
// CÜZDAN & KUPONLAR SAYFASI MODÜLÜ (wallet.js)
// ============================================

// API fonksiyonları
const BUYER_API = {
    // Cüzdan ve kuponları getir
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

// Sayfa yüklendiğinde çalışacak fonksiyon
document.addEventListener('DOMContentLoaded', async () => {
    const walletTransactions = document.getElementById('wallet-transactions');
    const couponsList = document.getElementById('coupons-list');
    const balanceElement = document.querySelector('.wallet-balance .total-price');
    const loadMoneyBtn = document.getElementById('load-money-btn');
    const logoutBtn = document.getElementById('logout-btn');

    // Cüzdan ve kuponları yükle
    async function loadWalletData() {
        try {
            const data = await BUYER_API.getWalletAndCoupons();
            
            // Bakiyeyi göster
            if (balanceElement) {
                balanceElement.textContent = (window.formatTL || ((amt) => (amt || 0).toLocaleString('tr-TR', { 
                    style: 'currency', 
                    currency: 'TRY', 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                })))(data.balance);
            }

            // İşlem geçmişini göster (şimdilik boş)
            if (walletTransactions) {
                walletTransactions.innerHTML = `
                    <p style="text-align: center; padding: 2rem; color: #666;">
                        Henüz işlem geçmişiniz bulunmamaktadır.
                    </p>
                `;
            }

            // Kuponları göster
            if (couponsList) {
                couponsList.innerHTML = '';
                
                if (data.coupons && data.coupons.length > 0) {
                    data.coupons.forEach(coupon => {
                        const couponHtml = `
                            <div class="coupon-item" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; margin-bottom: 0.75rem; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #FF6B35;">
                                <div>
                                    <span class="coupon-code" style="font-weight: 600; font-size: 1.1rem; color: #FF6B35; display: block; margin-bottom: 0.25rem;">${coupon.code || 'KUPON'}</span>
                                    <p style="margin: 0; color: #666; font-size: 0.9rem;">${coupon.description || 'Açıklama yok'}</p>
                                </div>
                                <div style="text-align: right;">
                                    ${coupon.discount_value ? `<strong style="color: #FF6B35; font-size: 1.2rem;">${coupon.discount_value} TL</strong>` : ''}
                                </div>
                            </div>
                        `;
                        couponsList.insertAdjacentHTML('beforeend', couponHtml);
                    });
                } else {
                    couponsList.innerHTML = `
                        <div class="coupon-item" style="text-align: center; padding: 2rem; color: #666;">
                            <p>Henüz kullanabileceğiniz kupon bulunmamaktadır.</p>
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

    // Para yükle butonu
    if (loadMoneyBtn) {
        loadMoneyBtn.addEventListener('click', () => {
            alert('Para yükleme özelliği yakında eklenecektir.');
            // İleride burada para yükleme modal'ı açılabilir
        });
    }

    // Logout butonu
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

    // İlk yükleme
    await loadWalletData();
});

