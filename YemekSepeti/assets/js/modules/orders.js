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

async function showOrderDetail(orderId) {
    const orderDetail = await fetchOrderDetail(orderId);
    
    if (!orderDetail) {
        alert('Sipariş detayı yüklenemedi.');
        return;
    }
    
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
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    document.getElementById('order-detail-modal').addEventListener('click', (e) => {
        if (e.target.id === 'order-detail-modal') {
            closeOrderDetailModal();
        }
    });
}

function closeOrderDetailModal() {
    const modal = document.getElementById('order-detail-modal');
    if (modal) {
        modal.remove();
    }
}

window.closeOrderDetailModal = closeOrderDetailModal;

async function showReviewModal(orderId) {
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        
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

async function handleOrderAction(e, orderId, actionType) {
    e.preventDefault();
    e.stopPropagation();
    const card = e.target.closest('.order-card');

    switch (actionType) {
        case 'iptal':
            if (confirm(`Sipariş #${orderId} iptal edilsin mi?`)) {
                // Butonu devre dışı bırak
                const cancelBtn = e.target;
                if (cancelBtn) {
                    cancelBtn.disabled = true;
                    cancelBtn.textContent = 'İptal ediliyor...';
                }

                try {
                    // API'ye istek gönder
                    const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                    
                    let result;
                    if (window.cancelOrder && typeof window.cancelOrder === 'function') {
                        result = await window.cancelOrder(orderId);
                    } else {
                        const response = await fetch(`${baseUrl}/api/orders/${orderId}/cancel`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include'
                        });
                        const data = await response.json();
                        if (!response.ok) {
                            throw new Error(data.message || 'Sipariş iptal edilemedi');
                        }
                        result = data;
                    }
                    
                    if (!result.success) {
                        throw new Error(result.message || 'Sipariş iptal edilemedi');
                    }

                    // Başarılı olduğunda UI'ı güncelle
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

                    alert(`✅ Sipariş #${orderId} başarıyla iptal edildi.`);
                    
                    // Sayfayı yenile
                    renderOrders();
                } catch (error) {
                    console.error('Sipariş iptal hatası:', error);
                    alert(`❌ Hata: ${error.message || 'Sipariş iptal edilemedi. Lütfen tekrar deneyin.'}`);
                    
                    // Butonu tekrar etkinleştir
                    if (cancelBtn) {
                        cancelBtn.disabled = false;
                        cancelBtn.textContent = 'Siparişi İptal Et';
                    }
                }
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

function createOrderCard(order) {
    const card = document.createElement('div');
    card.className = 'card order-card clickable-order-card';
    card.setAttribute('data-order-id', order.id);
    card.style.cursor = 'pointer';
    
    card.addEventListener('click', (e) => {
        if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || e.target.closest('a') || e.target.closest('button')) {
            return;
        }
        showOrderDetail(order.id);
    });

    const header = document.createElement('div');
    header.className = 'order-header';
    
    const headerLeft = document.createElement('div');
    const statusSpan = document.createElement('span');
    statusSpan.className = `order-status ${order.status}`;
    statusSpan.textContent = order.statusText;
    const dateSpan = document.createElement('span');
    dateSpan.className = 'order-date';
    dateSpan.textContent = order.date;
    headerLeft.appendChild(statusSpan);
    headerLeft.appendChild(dateSpan);

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

    const seller = document.createElement('div');
    seller.className = 'order-seller';
    const strongSeller = document.createElement('strong');
    strongSeller.textContent = order.seller;
    seller.appendChild(strongSeller);
    
    const items = document.createElement('div');
    items.className = 'order-items';
    const pItems = document.createElement('p');
    pItems.textContent = order.items;
    items.appendChild(pItems);
    
    const footer = document.createElement('div');
    footer.className = 'order-footer';

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
    
    if (order.status === 'delivered' && order.canRate !== false) {
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
        });
    }

    card.appendChild(header);
    card.appendChild(seller);
    if (order.type === 'active') {
        card.appendChild(items);
    }
    card.appendChild(footer);
    
    return card;
}

async function renderOrders() {
    const activeSection = document.getElementById('active-orders');
    const pastSection = document.getElementById('past-orders');

    let userId = null;
    
    try {
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

    if (activeSection) {
        try {
            console.log(`📦 Aktif siparişler yükleniyor (User: ${userId})...`);
            
            activeSection.querySelectorAll('.order-card').forEach(card => card.remove());
            activeSection.querySelectorAll('p').forEach(p => p.remove());
            
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

    if (pastSection) {
        try {
            console.log(`📦 Geçmiş siparişler yükleniyor (User: ${userId})...`);
            
            pastSection.querySelectorAll('.order-card').forEach(card => card.remove());
            pastSection.querySelectorAll('p').forEach(p => p.remove());

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

function playBuyerOrderSound() {
    try {
        var synth = window.speechSynthesis;
        if (synth) {
            synth.cancel();
            var u = new SpeechSynthesisUtterance('Siparişiniz alındı.');
            u.lang = 'tr-TR';
            u.rate = 1.0;
            u.volume = 1;
            synth.speak(u);
        }
    } catch (e) {}
}

function showBuyerOrderToast(data) {
    var toast = document.createElement('div');
    toast.className = 'buyer-order-toast';
    toast.style.cssText = 'position:fixed;top:20px;right:20px;background:#4CAF50;color:#fff;padding:16px 24px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:10000;font-size:14px;animation:slideIn 0.3s ease-out;';
    toast.innerHTML = '<strong>Siparişiniz alındı</strong><br><small>#' + (data.orderNumber || data.id) + ' - ' + (data.totalAmount || '') + ' TL</small>';
    if (!document.querySelector('style[data-buyer-toast]')) {
        var style = document.createElement('style');
        style.setAttribute('data-buyer-toast', '');
        style.textContent = '@keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }';
        document.head.appendChild(style);
    }
    document.body.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 5000);
}

function initializeBuyerOrderUpdates() {
    if (!window.location.pathname.includes('/buyer/orders')) return;
    var retries = 0;
    var maxRetries = 50;
    var interval = setInterval(function() {
        retries++;
        if (typeof io === 'undefined') {
            if (retries >= maxRetries) clearInterval(interval);
            return;
        }
        clearInterval(interval);
        var baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        fetch(baseUrl + '/api/auth/me', { credentials: 'include' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.success || !data.user || !data.user.id) return;
                var userId = data.user.id;
                window.buyerOrderSocket = io({
                    query: { userId: String(userId), role: 'buyer' },
                    reconnection: true,
                    reconnectionDelay: 1000,
                    transports: ['websocket', 'polling']
                });
                window.buyerOrderSocket.on('connect', function() {
                    console.log('Alıcı Socket.IO bağlandı - sipariş güncellemeleri açık.');
                });
                window.buyerOrderSocket.on('order_placed', function(payload) {
                    console.log('Yeni sipariş bildirimi:', payload);
                    playBuyerOrderSound();
                    showBuyerOrderToast(payload);
                    if (typeof renderOrders === 'function') {
                        renderOrders();
                    }
                });
                window.buyerOrderSocket.on('connect_error', function(err) {
                    console.warn('Alıcı Socket bağlantı hatası:', err.message);
                });
            })
            .catch(function() {});
    }, 100);
}

window.renderOrders = renderOrders;

document.addEventListener('DOMContentLoaded', function() {
    renderOrders();
    initializeBuyerOrderUpdates();

    var logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (window.logout) {
                window.logout();
            } else {
                console.log("Kullanıcı çıkış yaptı.");
                alert("Başarıyla çıkış yaptınız.");
                var baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                window.location.href = baseUrl + '/';
            }
        });
    }
});