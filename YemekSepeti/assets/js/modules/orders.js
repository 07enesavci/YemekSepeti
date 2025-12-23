// ============================================
// SİPARİŞ MODÜLÜ (orders.js)
// Backend API ile Entegre
// ============================================

// formatTL fonksiyonu api.js'de tanımlı (window.formatTL)
// Her yerde direkt window.formatTL kullanıyoruz, burada tanımlamıyoruz

// Sipariş detayını API'den çek
async function fetchOrderDetail(orderId) {
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const response = await fetch(`${baseUrl}/api/orders/${orderId}`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Sipariş detayı yüklenemedi');
        }
        
        const data = await response.json();
        return data.success ? data.data : null;
    } catch (error) {
        console.error('Sipariş detay yükleme hatası:', error);
        return null;
    }
}

// Sipariş detay modal'ını göster
async function showOrderDetail(orderId) {
    const orderDetail = await fetchOrderDetail(orderId);
    
    if (!orderDetail) {
        alert('Sipariş detayı yüklenemedi.');
        return;
    }
    
    // Modal HTML'i oluştur
    const modalHTML = `
        <div id="order-detail-modal" class="order-detail-modal" style="display: flex;">
            <div class="order-detail-modal-content">
                <div class="order-detail-modal-header">
                    <h2>Sipariş Detayı - #${orderDetail.orderNumber || orderDetail.id}</h2>
                    <button class="order-detail-modal-close" onclick="closeOrderDetailModal()">&times;</button>
                </div>
                <div class="order-detail-modal-body">
                    <div class="order-detail-section">
                        <h3>Sipariş Bilgileri</h3>
                        <div class="order-detail-info">
                            <p><strong>Durum:</strong> <span class="order-status ${orderDetail.status}">${orderDetail.statusText}</span></p>
                            <p><strong>Tarih:</strong> ${orderDetail.date}</p>
                            <p><strong>Ödeme Yöntemi:</strong> ${orderDetail.paymentMethod === 'credit_card' ? 'Kredi Kartı' : orderDetail.paymentMethod === 'cash' ? 'Nakit' : orderDetail.paymentMethod}</p>
                        </div>
                    </div>
                    
                    <div class="order-detail-section">
                        <h3>Satıcı Bilgileri</h3>
                        <div class="order-detail-info">
                            <p><strong>Restoran:</strong> ${orderDetail.seller?.name || 'Bilinmiyor'}</p>
                            ${orderDetail.seller?.phone ? `<p><strong>Telefon:</strong> ${orderDetail.seller.phone}</p>` : ''}
                        </div>
                    </div>
                    
                    <div class="order-detail-section">
                        <h3>Teslimat Adresi</h3>
                        <div class="order-detail-info">
                            <p>${orderDetail.address?.full || 'Adres bilgisi yok'}</p>
                        </div>
                    </div>
                    
                    <div class="order-detail-section">
                        <h3>Sipariş Öğeleri</h3>
                        <div class="order-detail-items">
                            ${orderDetail.items && orderDetail.items.length > 0 
                                ? orderDetail.items.map(item => `
                                    <div class="order-detail-item">
                                        <div class="order-detail-item-name">
                                            <strong>${item.quantity}x</strong> ${item.mealName}
                                        </div>
                                        <div class="order-detail-item-price">
                                            ${window.formatTL ? window.formatTL(item.subtotal) : (item.subtotal || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                        </div>
                                    </div>
                                `).join('')
                                : '<p>Ürün bilgisi yok</p>'
                            }
                        </div>
                    </div>
                    
                    <div class="order-detail-section order-detail-total">
                        <div class="order-detail-total-row">
                            <span>Ara Toplam:</span>
                            <span>${window.formatTL ? window.formatTL(orderDetail.subtotal) : (orderDetail.subtotal || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
                        </div>
                        ${orderDetail.discount > 0 ? `
                        <div class="order-detail-total-row">
                            <span>İndirim:</span>
                            <span>-${window.formatTL ? window.formatTL(orderDetail.discount) : (orderDetail.discount || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
                        </div>
                        ` : ''}
                        <div class="order-detail-total-row">
                            <span>Teslimat Ücreti:</span>
                            <span>${window.formatTL ? window.formatTL(orderDetail.deliveryFee) : (orderDetail.deliveryFee || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
                        </div>
                        <div class="order-detail-total-row order-detail-total-final">
                            <span><strong>Toplam:</strong></span>
                            <span><strong>${window.formatTL ? window.formatTL(orderDetail.total) : (orderDetail.total || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</strong></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Modal'ı body'ye ekle
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Modal dışına tıklanınca kapat
    document.getElementById('order-detail-modal').addEventListener('click', (e) => {
        if (e.target.id === 'order-detail-modal') {
            closeOrderDetailModal();
        }
    });
}

// Modal'ı kapat
function closeOrderDetailModal() {
    const modal = document.getElementById('order-detail-modal');
    if (modal) {
        modal.remove();
    }
}

// Global fonksiyon olarak ekle
window.closeOrderDetailModal = closeOrderDetailModal;

/**
 * Yorum modal'ını göster
 */
async function showReviewModal(orderId) {
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        
        // Yorum yapılabilir mi kontrol et
        const response = await fetch(`${baseUrl}/api/buyer/orders/${orderId}/review`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            alert(errorData.message || 'Yorum yapılamaz.');
            return;
        }
        
        const data = await response.json();
        
        if (!data.success || !data.canReview) {
            if (data.review) {
                alert('Bu sipariş için zaten yorum yaptınız.');
            } else {
                alert(data.message || 'Bu sipariş için yorum yapılamaz.');
            }
            return;
        }
        
        // Yorum formu modal'ı oluştur
        const modalHTML = `
            <div id="review-modal" class="order-detail-modal" style="display: flex;">
                <div class="order-detail-modal-content">
                    <div class="order-detail-modal-header">
                        <h2>Siparişi Değerlendir - #${orderId}</h2>
                        <button class="order-detail-modal-close" onclick="closeReviewModal()">&times;</button>
                    </div>
                    <div class="order-detail-modal-body">
                        <form id="review-form">
                            <div class="form-group">
                                <label class="form-label">Yıldız Değerlendirmesi *</label>
                                <div class="star-rating" id="star-rating">
                                    <span class="star" data-rating="1">☆</span>
                                    <span class="star" data-rating="2">☆</span>
                                    <span class="star" data-rating="3">☆</span>
                                    <span class="star" data-rating="4">☆</span>
                                    <span class="star" data-rating="5">☆</span>
                                </div>
                                <input type="hidden" id="rating-value" name="rating" required>
                                <p class="rating-text" id="rating-text" style="margin-top: 0.5rem; color: #666; font-size: 0.9rem;">Yıldız seçiniz</p>
                            </div>
                            
                            <div class="form-group">
                                <label for="review-comment" class="form-label">Yorumunuz (Opsiyonel)</label>
                                <textarea 
                                    id="review-comment" 
                                    name="comment" 
                                    class="form-input" 
                                    rows="4" 
                                    placeholder="Siparişiniz hakkında görüşlerinizi paylaşın..."></textarea>
                            </div>
                            
                            <div class="order-detail-modal-footer" style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
                                <button type="button" class="btn btn-secondary" onclick="closeReviewModal()">İptal</button>
                                <button type="submit" class="btn btn-primary">Yorumu Gönder</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Yıldız rating sistemi
        let selectedRating = 0;
        const stars = document.querySelectorAll('#star-rating .star');
        const ratingValue = document.getElementById('rating-value');
        const ratingText = document.getElementById('rating-text');
        
        stars.forEach((star, index) => {
            star.addEventListener('click', () => {
                selectedRating = index + 1;
                ratingValue.value = selectedRating;
                updateStars(stars, selectedRating);
                
                const ratingMessages = {
                    1: 'Çok Kötü',
                    2: 'Kötü',
                    3: 'Orta',
                    4: 'İyi',
                    5: 'Mükemmel'
                };
                ratingText.textContent = ratingMessages[selectedRating] || '';
            });
            
            star.addEventListener('mouseenter', () => {
                updateStars(stars, index + 1);
            });
        });
        
        document.getElementById('star-rating').addEventListener('mouseleave', () => {
            updateStars(stars, selectedRating);
        });
        
        // Form submit
        document.getElementById('review-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!selectedRating) {
                alert('Lütfen yıldız değerlendirmesi yapın.');
                return;
            }
            
            const comment = document.getElementById('review-comment').value.trim();
            
            try {
                const submitResponse = await fetch(`${baseUrl}/api/buyer/orders/${orderId}/review`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        rating: selectedRating,
                        comment: comment || null
                    })
                });
                
                const submitData = await submitResponse.json();
                
                if (!submitResponse.ok || !submitData.success) {
                    alert(submitData.message || 'Yorum eklenemedi.');
                    return;
                }
                
                alert('✅ Yorumunuz başarıyla eklendi!');
                closeReviewModal();
                
                // Sayfayı yenile
                renderOrders();
            } catch (error) {
                console.error('Yorum ekleme hatası:', error);
                alert('Yorum eklenirken bir hata oluştu.');
            }
        });
        
        // Modal dışına tıklanınca kapat
        document.getElementById('review-modal').addEventListener('click', (e) => {
            if (e.target.id === 'review-modal') {
                closeReviewModal();
            }
        });
        
    } catch (error) {
        console.error('Yorum modal hatası:', error);
        alert('Yorum ekranı açılırken bir hata oluştu.');
    }
}

function updateStars(stars, rating) {
    stars.forEach((star, index) => {
        if (index < rating) {
            star.textContent = '★';
            star.style.color = '#FFA500';
        } else {
            star.textContent = '☆';
            star.style.color = '#ddd';
        }
    });
}

function closeReviewModal() {
    const modal = document.getElementById('review-modal');
    if (modal) {
        modal.remove();
    }
}

window.closeReviewModal = closeReviewModal;

/**
 * Sipariş için yorum yapılıp yapılamayacağını kontrol et
 */
async function checkCanReview(orderId) {
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const response = await fetch(`${baseUrl}/api/buyer/orders/${orderId}/review`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            return false;
        }
        
        const data = await response.json();
        return data.success && data.canReview;
    } catch (error) {
        console.error('Yorum kontrol hatası:', error);
        return false;
    }
}

// Aksiyonları (İptal/Detay/Tekrarla) yöneten fonksiyon
function handleOrderAction(e, orderId, actionType) {
    e.preventDefault();
    e.stopPropagation(); // Kart tıklama event'ini durdur
    const card = e.target.closest('.order-card'); // Tıklanan butona en yakın sipariş kartını bul

    switch (actionType) {
        case 'iptal':
            if (confirm(`Sipariş #${orderId} iptal edilsin mi?`)) {
                // DOM Manipülasyonu ile kartın durumunu güncelle ve yerini değiştir (simülasyon)
                const newStatus = document.createElement('span');
                newStatus.className = 'order-status cancelled'; 
                newStatus.textContent = 'İptal Edildi'; 
                const oldStatus = card.querySelector('.order-status');
                if (oldStatus) {
                    oldStatus.replaceWith(newStatus); 
                }

                const footer = card.querySelector('.order-footer');
                if (footer) {
                    footer.innerHTML = ''; 
                    const repeatBtn = document.createElement('a');
                    repeatBtn.href = '#';
                    repeatBtn.className = 'btn btn-primary btn-sm';
                    repeatBtn.textContent = 'Siparişi Tekrarla';
                    repeatBtn.addEventListener('click', (e) => handleOrderAction(e, orderId, 'tekrarla'));
                    footer.appendChild(repeatBtn);
                }

                const pastSection = document.getElementById('past-orders');
                if (pastSection && card) {
                    card.querySelector('.order-items')?.remove(); 
                    pastSection.appendChild(card);
                }

                alert(`Sipariş #${orderId} iptal edildi ve geçmiş siparişlere taşındı.`);
            }
            break;

        case 'detay':
            showOrderDetail(orderId);
            break;
            
        case 'tekrarla':
            alert(`Sipariş #${orderId} Sepete eklenmek üzere tekrarlandı.`);
            break;
            
        case 'degerlendir':
            showReviewModal(orderId);
            break;

        default:
            console.log(`Bilinmeyen aksiyon: ${actionType}`);
    }
}

/**
 * Tek bir sipariş verisine göre DOM'da sipariş kartı (order-card) oluşturur.
 * Bu fonksiyon, verilen HTML yapınıza tam olarak uyar.
 * @param {object} order Sipariş verisi objesi.
 * @returns {HTMLElement} Oluşturulmuş sipariş kartı elementi.
 */
function createOrderCard(order) {
    // Ana Kart: <div class="card order-card">
    const card = document.createElement('div');
    card.className = 'card order-card clickable-order-card';
    card.setAttribute('data-order-id', order.id);
    card.style.cursor = 'pointer';
    
    // Kart tıklanınca detay göster
    card.addEventListener('click', (e) => {
        // Butonlara tıklanırsa kart tıklama event'ini çalıştırma
        if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || e.target.closest('a') || e.target.closest('button')) {
            return;
        }
        showOrderDetail(order.id);
    });

    // Header: <div class="order-header">
    const header = document.createElement('div');
    header.className = 'order-header';
    
    // Header Sol (Durum ve Tarih)
    const headerLeft = document.createElement('div');
    const statusSpan = document.createElement('span');
    statusSpan.className = `order-status ${order.status}`;
    statusSpan.textContent = order.statusText;
    const dateSpan = document.createElement('span');
    dateSpan.className = 'order-date';
    dateSpan.textContent = order.date;
    headerLeft.appendChild(statusSpan);
    headerLeft.appendChild(dateSpan);

    // Header Sağ (Toplam)
    const headerRight = document.createElement('div');
    headerRight.className = 'order-total';
    const totalSpan = document.createElement('span');
    totalSpan.textContent = 'Toplam:';
    const strongTotal = document.createElement('strong');
    strongTotal.textContent = (window.formatTL || ((amt) => (amt || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2 })))(order.total);
    headerRight.appendChild(totalSpan);
    headerRight.appendChild(strongTotal);

    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    // Satıcı Adı: <div class="order-seller">
    const seller = document.createElement('div');
    seller.className = 'order-seller';
    const strongSeller = document.createElement('strong');
    strongSeller.textContent = order.seller;
    seller.appendChild(strongSeller);
    
    // Ürünler (Aktif siparişler için): <div class="order-items">
    const items = document.createElement('div');
    items.className = 'order-items';
    const pItems = document.createElement('p');
    pItems.textContent = order.items;
    items.appendChild(pItems);
    
    // Alt Bölüm (Butonlar): <div class="order-footer">
    const footer = document.createElement('div');
    footer.className = 'order-footer';

    // Buton Ekleme Mantığı (Tüm butonlar handleOrderAction'a bağlanır)
    if (order.canCancel) {
        const cancelBtn = document.createElement('a');
        cancelBtn.href = '#';
        cancelBtn.className = 'btn btn-secondary btn-sm';
        cancelBtn.textContent = 'Siparişi İptal Et';
        cancelBtn.addEventListener('click', (e) => handleOrderAction(e, order.id, 'iptal')); 
        footer.appendChild(cancelBtn);
    }
    
    if (order.canDetail) {
        const detailBtn = document.createElement('a');
        detailBtn.href = '#';
        detailBtn.className = 'btn btn-primary btn-sm';
        detailBtn.textContent = 'Sipariş Detayı';
        detailBtn.addEventListener('click', (e) => handleOrderAction(e, order.id, 'detay')); 
        footer.appendChild(detailBtn);
    }
    
    if (order.canRepeat) {
        const repeatBtn = document.createElement('a');
        repeatBtn.href = '#';
        repeatBtn.className = 'btn btn-primary btn-sm';
        repeatBtn.textContent = 'Siparişi Tekrarla';
        repeatBtn.addEventListener('click', (e) => handleOrderAction(e, order.id, 'tekrarla'));
        footer.appendChild(repeatBtn);
    }
    
    // Yorum yapılabilecek mi kontrol et (API'den)
    if (order.status === 'delivered' && order.canRate !== false) {
        // API'den kontrol edelim
        checkCanReview(order.id).then(canReview => {
            if (canReview) {
                const rateBtn = document.createElement('a');
                rateBtn.href = '#';
                rateBtn.className = 'btn btn-secondary btn-sm';
                rateBtn.textContent = '⭐ Yorum Yap';
                rateBtn.addEventListener('click', (e) => handleOrderAction(e, order.id, 'degerlendir'));
                footer.appendChild(rateBtn);
            }
        }).catch(() => {
            // Hata durumunda sessizce geç
        });
    }

    // Kartın parçalarını birleştirme (DOM Oluşturma - Hafta-4.docx)
    card.appendChild(header);
    card.appendChild(seller);
    if (order.type === 'active') {
        card.appendChild(items); // Ürünler sadece aktif siparişlerde detaylı listelenir (örnek veri setine göre)
    }
    card.appendChild(footer);
    
    return card;
}

/**
 * API'den aktif ve geçmiş siparişleri çeker ve DOM'a render eder.
 * Backend'den veri alır, hata durumunda mock veri döner.
 */
async function renderOrders() {
    const activeSection = document.getElementById('active-orders');
    const pastSection = document.getElementById('past-orders');

    // Session'dan userId'yi al
    let userId = null;
    
    try {
        // /api/auth/me endpoint'ini kullan
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const authResponse = await fetch(`${baseUrl}/api/auth/me`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (authResponse.ok) {
            const authData = await authResponse.json();
            if (authData.success && authData.user) {
                userId = authData.user.id;
            }
        }
    } catch (e) {
        console.warn('Session bilgisi alınamadı:', e);
    }
    
    // Eğer userId bulunamazsa hata ver
    if (!userId) {
        console.error('Kullanıcı ID bulunamadı. Lütfen giriş yapın.');
        if (activeSection) {
            activeSection.innerHTML = '<p style="color: red;">Lütfen giriş yapın.</p>';
        }
        if (pastSection) {
            pastSection.innerHTML = '<p style="color: red;">Lütfen giriş yapın.</p>';
        }
        return;
    }

    // 1. Aktif Siparişleri Çek ve Render Et
    if (activeSection) {
        try {
            console.log(`📦 Aktif siparişler yükleniyor (User: ${userId})...`);
            
            // Mevcut statik kartları temizle
            activeSection.querySelectorAll('.order-card').forEach(card => card.remove());
            activeSection.querySelectorAll('p').forEach(p => p.remove());
            
            // API'den siparişleri çek
            const activeResponse = await getActiveOrders(userId);
            
            if (activeResponse.success && activeResponse.data && activeResponse.data.length > 0) {
                activeResponse.data.forEach(order => {
                    const card = createOrderCard(order);
                    activeSection.appendChild(card);
                });
                console.log(`✅ ${activeResponse.data.length} aktif sipariş yüklendi`);
            } else {
                const p = document.createElement('p');
                p.textContent = 'Aktif siparişiniz bulunmamaktadır.';
                activeSection.appendChild(p);
                console.log('ℹ️  Aktif sipariş yok');
            }
        } catch(e) {
            console.error("Aktif siparişler yüklenirken hata oluştu:", e);
            const p = document.createElement('p');
            p.textContent = 'Siparişler yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.';
            p.style.color = 'red';
            activeSection.appendChild(p);
        }
    }

    // 2. Geçmiş Siparişleri Çek ve Render Et
    if (pastSection) {
        try {
            console.log(`📦 Geçmiş siparişler yükleniyor (User: ${userId})...`);
            
            // Mevcut statik kartları temizle
            pastSection.querySelectorAll('.order-card').forEach(card => card.remove());
            pastSection.querySelectorAll('p').forEach(p => p.remove());

            // API'den siparişleri çek
            const pastResponse = await getPastOrders(userId);
            
            if (pastResponse.success && pastResponse.data && pastResponse.data.length > 0) {
                pastResponse.data.forEach(order => {
                    const card = createOrderCard(order);
                    pastSection.appendChild(card);
                });
                console.log(`✅ ${pastResponse.data.length} geçmiş sipariş yüklendi`);
            } else {
                const p = document.createElement('p');
                p.textContent = 'Geçmiş siparişiniz bulunmamaktadır.';
                pastSection.appendChild(p);
                console.log('ℹ️  Geçmiş sipariş yok');
            }
        } catch(e) {
            console.error("Geçmiş siparişler yüklenirken hata oluştu:", e);
            const p = document.createElement('p');
            p.textContent = 'Siparişler yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.';
            p.style.color = 'red';
            pastSection.appendChild(p);
        }
    }
}

// Sayfa yüklendiğinde siparişleri render et (DOMContentLoaded - Hafta-5.docx)
document.addEventListener('DOMContentLoaded', () => {
    renderOrders();
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.logout) {
                window.logout();
            } else {
                console.log("Kullanıcı çıkış yaptı.");
                alert("Başarıyla çıkış yaptınız.");
                const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                window.location.href = `${baseUrl}/`;
            }
        });
    }
});