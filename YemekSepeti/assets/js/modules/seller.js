// Satıcı modülü: menü, sipariş, kazanç, profil, kuponlar
// Base URL ve kimlikli istekler window yardımcılarından alınır

function updateSidebarUzakMesafe(enabled) {
    const li = document.getElementById('sidebar-uzak-mesafe-li');
    if (li) li.style.display = enabled ? 'block' : 'none';
}

async function fetchAndApplyUzakMesafeSidebar(baseUrl) {
    try {
        baseUrl = baseUrl || (window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : ''));
        const res = await fetch(`${baseUrl}/api/seller/profile`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.profile) {
            window.__sellerUzakMesafeEnabled = !!data.profile.uzakMesafeEnabled;
            updateSidebarUzakMesafe(!!data.profile.uzakMesafeEnabled);
        }
    } catch (e) {}
}

async function fetchSellerMenu() {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/seller/menu`, {
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error(`Menü yüklenemedi: ${response.status}`);
        }
        const data = await response.json();
        return data.success ? data.menu : [];
    } catch (error) {
        return [];
    }
}

window.addMeal = addMeal;
window.updateMeal = updateMeal;
window.loadMenuPage = loadMenuPage;

async function addMeal(mealData) {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/seller/menu`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mealData)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Yemek eklenemedi');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        throw error;
    }
}

async function updateMeal(mealId, mealData) {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/seller/menu/${mealId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mealData)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Yemek güncellenemedi');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        throw error;
    }
}

async function deleteMeal(mealId) {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/seller/menu/${mealId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Yemek silinemedi');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        throw error;
    }
}

// Kazanç raporları
async function fetchSellerEarnings(period = 'month') {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/seller/earnings?period=${period}`, {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Kazanç raporları yüklenemedi');
        const data = await response.json();
        return data.success ? data : null;
    } catch (error) {
        return null;
    }
}

// Menü sayfası işlevleri
function createMealCardHTML(meal) {
    let imageUrl = meal.imageUrl || '';
    if (imageUrl && imageUrl.trim() !== '') {
        if (imageUrl.includes('via.placeholder.com') || 
            imageUrl.includes('placeholder.com') ||
            imageUrl.includes('400x200.png') ||
            imageUrl.includes('250x150.png')) {
            imageUrl = '';
        } else {
            if (imageUrl.startsWith('/uploads/')) {
                const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                imageUrl = baseUrl + imageUrl;
            }
            const separator = imageUrl.includes('?') ? '&' : '?';
            imageUrl = imageUrl + separator + '_t=' + Date.now();
        }
    }
    
    const statusClass = meal.isAvailable ? 'active' : 'inactive';
    const statusText = meal.isAvailable ? 'Satışta' : 'Satışta Değil';
    
    const safeName = (meal.name || 'Yemek')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    
    return `
        <div class="menu-list-item" data-meal-id="${meal.id}">
            ${imageUrl && imageUrl.trim() !== '' ? `
                <img src="${imageUrl}" 
                     alt="${safeName}" 
                     class="menu-item-image" 
                     onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="menu-item-image" style="background: #f0f0f0; display: none; align-items: center; justify-content: center; color: #999; font-size: 0.75rem;">Resim Yok</div>
            ` : `
                <div class="menu-item-image" style="background: #f0f0f0; display: flex; align-items: center; justify-content: center; color: #999; font-size: 0.75rem;">Resim Yok</div>
            `}
            <div class="menu-item-info">
                <strong>${meal.name}</strong>
                <span>${meal.category}</span>
            </div>
            <div class="menu-item-status">
                ${meal.isApproved === false ?
                    '<span class="status-dot" style="background-color: #f39c12;">Admin Onayı Bekliyor</span>' :
                    `<span class="status-dot ${statusClass}">${statusText}</span>`
                }
                ${meal.isUzakMesafe ? '<span class="status-dot" style="background-color: #7c3aed; margin-left: 4px;">📦 Uzak Mesafe</span>' : ''}
            </div>
            <div class="menu-item-price">
                ${parseFloat(meal.price || 0).toFixed(2)} TL
            </div>
            <div class="menu-item-actions">
                ${meal.isApproved !== false ? `
                <button class="btn ${meal.isAvailable ? 'btn-secondary' : 'btn-primary'} btn-sm toggle-meal-btn" data-meal-id="${meal.id}" data-available="${meal.isAvailable}">
                    ${meal.isAvailable ? 'Tükendi Yap' : 'Satışa Aç'}
                </button>
                ` : ''}
                <button class="btn btn-secondary btn-sm edit-meal-btn" data-meal-id="${meal.id}">Düzenle</button>
                <button class="btn btn-danger btn-sm delete-meal-btn" data-meal-id="${meal.id}">Sil</button>
            </div>
        </div>
    `;
}

async function loadMenuPage() {
    const isUzakMesafePage = !!window.__uzakMesafePage;
    const containerId = isUzakMesafePage ? '#uzak-mesafe-menu-list' : '.menu-list';
    const menuListContainer = document.querySelector(containerId) || document.querySelector('.menu-list');
    if (!menuListContainer) return;
    menuListContainer.innerHTML = '<p>Yükleniyor...</p>';
    try {
        const allMenu = await fetchSellerMenu();
        const menu = isUzakMesafePage
            ? allMenu.filter(m => !!m.isUzakMesafe)
            : allMenu.filter(m => !m.isUzakMesafe);
        menuListContainer.innerHTML = '';
        if (menu.length === 0) {
            const emptyMsg = isUzakMesafePage
                ? 'Henüz Uzak Mesafe ürünü eklenmemiş. Yukarıdaki butona tıklayın.'
                : 'Henüz menü eklenmemiş. Yeni yemek eklemek için yukarıdaki butona tıklayın.';
            menuListContainer.innerHTML = `<p style="text-align: center; padding: 2rem; color: #666;">${emptyMsg}</p>`;
        } else {
            menu.forEach(meal => {
                menuListContainer.insertAdjacentHTML('beforeend', createMealCardHTML(meal));
            });
        }
        attachMenuEventListeners();
    } catch (error) {
        menuListContainer.innerHTML = '<p style="text-align: center; padding: 2rem; color: #E74C3C;">Menü yüklenirken hata oluştu.</p>';
    }
}

function attachMenuEventListeners() {
    document.querySelectorAll('.delete-meal-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const mealId = parseInt(e.target.getAttribute('data-meal-id'));
            const isConfirmed = await window.showConfirm('Bu yemeği silmek istediğinize emin misiniz?');
            if (!isConfirmed) return;

            try {
                await deleteMeal(mealId);
                e.target.closest('.menu-list-item').remove();
                alert('Yemek başarıyla silindi.');
            } catch (error) {
                alert('Yemek silinirken hata oluştu: ' + error.message);
            }
        });
    });

    document.querySelectorAll('.toggle-meal-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const mealId = parseInt(e.target.getAttribute('data-meal-id'));
            const isAvailable = e.target.getAttribute('data-available') === 'true';
            btn.disabled = true;
            try {
                await updateMeal(mealId, { isAvailable: !isAvailable });
                loadMenuPage();
            } catch (error) {
                alert('Yemek durumu güncellenirken hata oluştu: ' + error.message);
                btn.disabled = false;
            }
        });
    });

    document.querySelectorAll('.edit-meal-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const mealId = parseInt(e.target.getAttribute('data-meal-id'));
            try {
                const menu = await fetchSellerMenu();
                const meal = menu.find(m => m.id === mealId);
                if (meal && window.openEditMealModalWithData) {
                    window.openEditMealModalWithData(meal);
                } else {
                    alert('Yemek bulunamadı veya modal yüklenemedi.');
                }
            } catch (error) {
                alert('Yemek bilgileri yüklenirken hata oluştu: ' + error.message);
            }
        });
    });

    const addMealBtn = document.getElementById('add-new-meal-btn');
    if (addMealBtn) {
        const newAddMealBtn = addMealBtn.cloneNode(true);
        addMealBtn.parentNode.replaceChild(newAddMealBtn, addMealBtn);
        
        newAddMealBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!document.getElementById('meal-modal')) {
                if (window.createMealModal) {
                    window.createMealModal();
                } else {
                    alert('Modal yükleniyor... Lütfen sayfayı yenileyin.');
                    return;
                }
            }
            if (window.openAddMealModal) {
                window.openAddMealModal();
            } else {
                alert('Modal açılamadı. Lütfen sayfayı yenileyin.');
            }
        });
    }
}

function initializeMenuPage() {
    loadMenuPage();
}


async function loadEarningsPage() {
    const periodButtons = document.querySelectorAll('.period-btn');
    let currentPeriod = 'month';

    periodButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const period = e.target.getAttribute('data-period') || 'month';
            currentPeriod = period;
            
            periodButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            await updateEarningsStats(period);
        });
    });

    await updateEarningsStats(currentPeriod);
}

async function updateEarningsStats(period = 'month') {
    try {
        const earnings = await fetchSellerEarnings(period);
        
        if (!earnings || !earnings.stats) {
            const transactionList = document.querySelector('.transaction-list');
            if (transactionList) {
                transactionList.innerHTML = '<p style="text-align: center; padding: 2rem; color: #666;">Veri yüklenemedi.</p>';
            }
            return;
        }

        const stats = earnings.stats;

        const statCards = document.querySelectorAll('.stat-card');
        if (statCards.length >= 3) {
            const totalBalanceEl = statCards[0].querySelector('.stat-value');
            if (totalBalanceEl) {
                totalBalanceEl.textContent = `${stats.totalEarnings.toFixed(2)} TL`;
            }

            const pendingEl = statCards[1].querySelector('.stat-value');
            if (pendingEl) {
                const pendingAmount = stats.totalOrders - stats.completedOrders;
                pendingEl.textContent = `${pendingAmount} sipariş`;
            }

            const totalWithdrawnEl = statCards[2].querySelector('.stat-value');
            if (totalWithdrawnEl) {
                // Tamamlanan sipariş sayısını göster (para çekme sistemi yok)
                totalWithdrawnEl.textContent = `${stats.completedOrders} tamamlanan sipariş`;
            }
            // "Ödeme Talep Et" butonu pasif — sistem henüz aktif değil
            const payoutBtn = document.querySelector('.btn-payout, .earnings-page .btn-primary');
            if (payoutBtn && !payoutBtn.dataset.payoutDisabled) {
                payoutBtn.dataset.payoutDisabled = '1';
                payoutBtn.disabled = true;
                payoutBtn.title = 'Ödeme talep sistemi yakında aktif olacak.';
                payoutBtn.style.opacity = '0.5';
                payoutBtn.style.cursor = 'not-allowed';
            }
        }

        const transactionList = document.querySelector('.transaction-list');
        if (transactionList) {
            if (stats.completedOrders === 0) {
                transactionList.innerHTML = '<p style="text-align: center; padding: 2rem; color: #666;">Henüz işlem kaydı bulunmuyor.</p>';
            } else {
                const periodText = period === 'day' ? 'Bugün' : period === 'week' ? 'Bu Hafta' : 'Bu Ay';
                transactionList.innerHTML = `
                    <div class="transaction-item">
                        <div class="transaction-icon income">
                            <span>+</span>
                        </div>
                        <div class="transaction-details">
                            <strong>Toplam Gelir (${periodText})</strong>
                            <span>${new Date().toLocaleDateString('tr-TR')}</span>
                        </div>
                        <div class="transaction-amount income">
                            +${stats.totalRevenue.toFixed(2)} TL
                        </div>
                    </div>
                    <div class="transaction-item">
                        <div class="transaction-icon income">
                            <span>+</span>
                        </div>
                        <div class="transaction-details">
                            <strong>Tamamlanan Siparişler</strong>
                            <span>${stats.completedOrders} adet</span>
                        </div>
                        <div class="transaction-amount income">
                            +${stats.completedOrders} adet
                        </div>
                    </div>
                    ${stats.totalDiscounts > 0 ? `
                    <div class="transaction-item">
                        <div class="transaction-icon payout">
                            <span>-</span>
                        </div>
                        <div class="transaction-details">
                            <strong>Toplam İndirim</strong>
                            <span>${periodText}</span>
                        </div>
                        <div class="transaction-amount payout">
                            -${stats.totalDiscounts.toFixed(2)} TL
                        </div>
                    </div>
                    ` : ''}
                `;
            }
        }
    } catch (error) {
        const transactionList = document.querySelector('.transaction-list');
        if (transactionList) {
            transactionList.innerHTML = '<p style="text-align: center; padding: 2rem; color: #E74C3C;">Veri yüklenirken hata oluştu.</p>';
        }
    }
}

async function loadRecentOrdersForPanel() {
    const ids = ['recent-orders-list', 'recent-orders-list-earnings'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<p style="text-align: center; padding: 2rem; color: #666;">Yükleniyor...</p>';
    });
    try {
        const data = await fetchDashboardData();
        const orders = (data && data.recentOrders) ? data.recentOrders : [];
        ids.forEach(id => renderRecentOrdersList(orders, id));
    } catch (e) {
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<p style="text-align: center; padding: 2rem; color: #E74C3C;">Siparişler yüklenirken hata oluştu.</p>';
        });
    }
}

function initializeEarningsPage() {
    loadEarningsPage();
    loadRecentOrdersForPanel();
}

async function fetchSellerOrders(tab = 'new') {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/orders/seller/orders?tab=${tab}`, {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Siparişler yüklenemedi');
        const data = await response.json();
        // hasOwnCouriers bilgisini sakla
        if (data.hasOwnCouriers !== undefined) {
            window.__sellerHasOwnCouriers = !!data.hasOwnCouriers;
        }
        return data.success ? data.orders : [];
    } catch (error) {
        return [];
    }
}

async function updateOrderStatus(orderId, status) {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/orders/seller/orders/${orderId}/status`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Sipariş durumu güncellenemedi');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        throw error;
    }
}

function createOrderCardHTML(order) {
    const statusClass = order.status === 'delivered' ? 'delivered' : 
                       order.status === 'cancelled' ? 'cancelled' : '';
    const discount = parseFloat(order.discount) || 0;
    const subtotal = parseFloat(order.subtotal) || 0;
    const deliveryFee = parseFloat(order.deliveryFee) || 0;
    const couponCode = order.couponCode || order.coupon_code || '';
    
    // Ödeme yöntemi bilgisini oluştur
    let paymentInfo = '';
    if (order.paymentMethod === 'cash') {
        const method = order.cashPaymentMethod === 'card' ? 'Kartla' : 'Nakit';
        paymentInfo = `💵 Kapıda Ödeme - ${method}`;
    } else if (order.paymentMethod === 'iyzico') {
        paymentInfo = '💳 İyzico (Kredi Kartı)';
    } else if (order.paymentMethod === 'wallet') {
        paymentInfo = '💰 Cüzdan';
    } else if (order.paymentMethod === 'credit_card') {
        paymentInfo = '💳 Kredi Kartı';
    } else {
        paymentInfo = 'Belirtilmemiş';
    }
    
    let actionButtons = '';
    if (order.status === 'pending' || order.status === 'confirmed') {
        actionButtons = `
            <button class="btn btn-secondary reject-order-btn" data-order-id="${order.id}">Reddet</button>
            <button class="btn btn-primary accept-order-btn" data-order-id="${order.id}">Onayla ve Hazırlamaya Başla</button>
        `;
    } else if (order.status === 'preparing' && order.deliveryType === 'cargo') {
        // Kargo siparişlerinde hazırlanıyor → doğrudan kargoya gönderim butonu
        actionButtons = `
            <button class="btn btn-primary cargo-ship-btn" data-order-id="${order.id}" style="background:#8e44ad;border-color:#8e44ad;">📦 Kargoya Verildi</button>
        `;
    } else if (order.status === 'preparing') {
        let readyButtonText;
        if (order.deliveryType === 'pickup') readyButtonText = 'Alıcıya Hazır Olduğunu Bildir';
        else if (order.deliveryType === 'cargo') readyButtonText = 'Kargoya Verilecek';
        else readyButtonText = 'Kuryeye Hazır Olduğunu Bildir';
        actionButtons = `
            <button class="btn btn-primary ready-order-btn" data-order-id="${order.id}" data-delivery-type="${order.deliveryType || 'delivery'}">${readyButtonText}</button>
        `;
    } else if (order.status === 'ready' && !order.courierId) {
        if (order.deliveryType === 'pickup') {
            actionButtons = `
                <button class="btn btn-success custom-delivered-btn" style="background-color: #27AE60; border-color: #27AE60;" data-order-id="${order.id}">Teslim Edildi</button>
            `;
        } else if (order.deliveryType === 'cargo') {
            actionButtons = `
                <button class="btn btn-primary cargo-ship-btn" data-order-id="${order.id}" style="background:#8e44ad;border-color:#8e44ad;">📦 Kargoya Verildi</button>
            `;
        } else if (window.__sellerHasOwnCouriers) {
            // Kendi kuryesi olan restoran: kendi kuryesini seç + havuza da gönderebilir
            actionButtons = `
                <button class="btn btn-primary assign-own-courier-btn" data-order-id="${order.id}" style="background:#1565C0;border-color:#1565C0;">🏍️ Kendi Kuryemi Ata</button>
                <button class="btn btn-secondary assign-courier-btn" data-order-id="${order.id}" style="margin-left:6px; font-size:0.8rem;">Havuza Gönder</button>
            `;
        } else {
            actionButtons = `
                <button class="btn btn-primary assign-courier-btn" data-order-id="${order.id}">Kuryeye Bildir</button>
            `;
        }
    } else if (order.status === 'on_delivery' && order.deliveryType === 'cargo') {
        actionButtons = `
            <button class="btn btn-success custom-delivered-btn" style="background-color: #27AE60; border-color: #27AE60;" data-order-id="${order.id}">Teslim Edildi</button>
        `;
    }
    
    return `
        <div class="card seller-order-card ${statusClass}">
            <div class="order-card-header">
                <div>
                    <strong>#${order.orderNumber || order.id} - ${order.customer || 'Müşteri'}</strong>
                    <span class="order-date">${order.date || ''}</span>
                </div>
                <span class="order-price">${order.total.toFixed(2)} TL</span>
            </div>
            <div class="order-card-body">
                <p><strong>Ürünler:</strong> ${order.items || 'Belirtilmemiş'}</p>
                ${order.address ? `<p><strong>Adres:</strong> ${order.address}</p>` : ''}
                ${discount > 0 ? `<p><strong>Kupon:</strong> ${couponCode || 'Uygulandı'} • <span style="color:#27AE60;">-${discount.toFixed(2)} TL</span></p>` : ''}
                ${discount > 0 ? `<p><strong>Tutar:</strong> ${subtotal.toFixed(2)} + ${deliveryFee.toFixed(2)} - ${discount.toFixed(2)} = <strong>${(parseFloat(order.total) || 0).toFixed(2)} TL</strong></p>` : ''}
                ${order.statusText ? `<p><strong>Durum:</strong> ${order.statusText}</p>` : ''}
                <p><strong>Ödeme:</strong> ${paymentInfo}</p>
                ${order.courierId && order.courierName ? `<p><strong>Kurye:</strong> ${order.courierName} (ID: ${order.courierId})</p>` : ''}
                ${order.deliveryType === 'cargo' && order.cargoCompany ? `<p><strong>Kargo Firması:</strong> ${order.cargoCompany}${order.cargoTrackingNumber ? ` • Takip: <strong>${order.cargoTrackingNumber}</strong>` : ''}</p>` : ''}
            </div>
            ${actionButtons ? `
            <div class="order-card-actions">
                ${actionButtons}
            </div>
            ` : ''}
        </div>
    `;
}

async function loadOrdersPage() {
    const tabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    
    let currentTab = 'new';
    
    tabs.forEach(tab => {
        tab.addEventListener('click', async (e) => {
            e.preventDefault();
            const tabName = e.target.getAttribute('data-tab');
            currentTab = tabName;
            
            tabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            
            tabContents.forEach(content => {
                if (content.id === tabName) {
                    content.style.display = 'block';
                    content.classList.add('active');
                } else {
                    content.style.display = 'none';
                    content.classList.remove('active');
                }
            });
            
            await loadOrdersForTab(tabName);
        });
    });
    
    await loadOrdersForTab(currentTab);
    
    // Auto-refresh is handled globally by startSellerAutoSyncFallback
}

async function loadOrdersForTab(tab, isSilent = false) {
    const tabContent = document.getElementById(tab);
    if (!tabContent) return;
    
    if (!isSilent) tabContent.innerHTML = '<p style="text-align: center; padding: 2rem;">Yükleniyor...</p>';
    
    try {
        const orders = await fetchSellerOrders(tab);
        
        let newHtml = '';
        if (orders.length === 0) {
            const tabNames = {
                'new': 'Yeni sipariş',
                'preparing': 'Hazırlanan sipariş',
                'cargo_ready': 'Kargoya verilecek sipariş',
                'shipped': 'Kargodaki sipariş',
                'history': 'Geçmiş sipariş'
            };
            newHtml = `<p style="text-align: center; padding: 2rem; color: #666;">${tabNames[tab] || 'Sipariş'} bulunmuyor.</p>`;
        } else {
            newHtml = orders.map(order => createOrderCardHTML(order)).join('');
        }
        
        const newHash = Array.from(newHtml).reduce((hash, char) => 0 | (31 * hash + char.charCodeAt(0)), 0);
        const currentHash = tabContent.getAttribute('data-hash');
        
        if (currentHash !== String(newHash) || !isSilent) {
            tabContent.innerHTML = newHtml;
            tabContent.setAttribute('data-hash', newHash);
            if (orders.length > 0) attachOrderEventListeners();
        }
        
        const tabButton = document.querySelector(`.tab-link[data-tab="${tab}"]`);
        if (tabButton) {
            const currentTabTitle = tabButton.textContent;
            const tabText = currentTabTitle.replace(/\(\d+\)/, `(${orders.length})`);
            if (currentTabTitle !== tabText) tabButton.textContent = tabText;
        }
        
    } catch (error) {
        if (!isSilent) tabContent.innerHTML = '<p style="text-align: center; padding: 2rem; color: #E74C3C;">Siparişler yüklenirken hata oluştu.</p>';
    }
}

function attachOrderEventListeners() {
    document.querySelectorAll('.accept-order-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const orderId = parseInt(e.target.getAttribute('data-order-id'));
            const button = e.currentTarget;
            if (button.disabled) return;
            button.disabled = true;
            try {
                // Önce 'confirmed' → sonra hemen 'preparing' (2 adımlı geçiş doğru akışı yansıtır)
                await updateOrderStatus(orderId, 'confirmed');
                await updateOrderStatus(orderId, 'preparing');
                showSellerActionNotification('success', 'Sipariş Onaylandı', '#' + orderId + ' hazırlanmaya alındı.');
                await loadOrdersForTab('new');
                await loadOrdersForTab('preparing');
            } catch (error) {
                showSellerActionNotification('error', 'İşlem Başarısız', error.message || 'Sipariş güncellenemedi.');
            } finally {
                button.disabled = false;
            }
        });
    });
    
    document.querySelectorAll('.reject-order-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const orderId = parseInt(e.target.getAttribute('data-order-id'));
            const isConfirmed = await window.showConfirm('Bu siparişi reddetmek istediğinize emin misiniz?');
            if (!isConfirmed) return;
            
            try {
                await updateOrderStatus(orderId, 'cancelled');
                showSellerActionNotification('error', 'Sipariş Reddedildi', '#' + orderId + ' numaralı sipariş reddedildi.');
                await loadOrdersForTab('new');
            } catch (error) {
                showSellerActionNotification('error', 'İşlem Başarısız', error.message || 'Sipariş reddedilemedi.');
            }
        });
    });
    
    document.querySelectorAll('.ready-order-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const orderId = parseInt(e.target.getAttribute('data-order-id'));
            const deliveryType = e.target.getAttribute('data-delivery-type') || 'delivery';
            try {
                await updateOrderStatus(orderId, 'ready');
                if (deliveryType === 'pickup') {
                    showSellerActionNotification('success', 'Alıcıya Bildirildi', '#' + orderId + ' numaralı gel al siparişi hazır. Müşteriye bildirim gönderildi.');
                } else if (deliveryType === 'cargo') {
                    showSellerActionNotification('success', 'Kargoya Hazır', '#' + orderId + ' kargoya verilecekler listesine taşındı.');
                } else {
                    showSellerActionNotification('success', 'Kurye Çağrısı Hazır', '#' + orderId + ' için kurye çağrısı yapılabilir.');
                }
                await loadOrdersForTab('preparing');
                if (deliveryType === 'cargo') {
                    await loadOrdersForTab('cargo_ready');
                } else {
                    await loadOrdersForTab('new');
                }
            } catch (error) {
                showSellerActionNotification('error', 'İşlem Başarısız', error.message || 'Durum güncellenemedi.');
            }
        });
    });
    
    document.querySelectorAll('.assign-courier-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const orderId = parseInt(e.target.getAttribute('data-order-id'));
            const button = e.target;
            button.disabled = true;
            button.textContent = 'Atanıyor...';
            
            try {
                const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
                const response = await fetch(`${baseUrl}/api/orders/seller/assign-courier/${orderId}`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Kurye atama başarısız');
                }
                
                const data = await response.json();
                showSellerActionNotification('success', 'Kurye Atandı', data.message || ('#' + orderId + ' kuryeye atandı.'));
                
                // Siparişleri yenile
                await loadOrdersForTab('preparing');
            } catch (error) {
                showSellerActionNotification('error', 'Kurye Atama Hatası', error.message || 'Kurye atanamadı.');
                button.disabled = false;
                button.textContent = button.getAttribute('data-delivery-type') === 'pickup' ? 'Alıcıya Hazır Olduğunu Bildir' : 'Kuryeye Bildir';
            }
        });
    });

    document.querySelectorAll('.cargo-ship-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const orderId = parseInt(e.target.getAttribute('data-order-id'));
            showCargoShipModal(orderId);
        });
    });

    document.querySelectorAll('.custom-delivered-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const orderId = parseInt(e.target.getAttribute('data-order-id'));
            try {
                await updateOrderStatus(orderId, 'delivered');
                showSellerActionNotification('success', 'Sipariş Teslim Edildi', '#' + orderId + ' müşteriye teslim edildi.');
                await loadOrdersForTab('preparing');
                await loadOrdersForTab('shipped');
                await loadOrdersForTab('history');
            } catch (error) {
                showSellerActionNotification('error', 'İşlem Başarısız', error.message || 'Durum güncellenemedi.');
            }
        });
    });

    // Kendi kuryesini ata butonu (zincir restoran)
    document.querySelectorAll('.assign-own-courier-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const orderId = parseInt(e.target.getAttribute('data-order-id'));
            showOwnCourierAssignModal(orderId);
        });
    });
}

function showCargoShipModal(orderId) {
    const existing = document.getElementById('cargo-ship-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'cargo-ship-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10100;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
        <div style="background:#fff;border-radius:12px;padding:2rem;min-width:320px;max-width:460px;width:90%;">
            <h3 style="margin:0 0 1rem 0;">📦 Kargoya Ver</h3>
            <div style="margin-bottom:1rem;">
                <label style="display:block;font-size:0.9rem;font-weight:600;margin-bottom:0.4rem;">Kargo Firması *</label>
                <input id="cargo-company-input" type="text" placeholder="Örn: Yurtiçi Kargo" style="width:100%;padding:0.5rem 0.75rem;border:1px solid #ddd;border-radius:8px;font-size:0.95rem;box-sizing:border-box;">
            </div>
            <div style="margin-bottom:1.5rem;">
                <label style="display:block;font-size:0.9rem;font-weight:600;margin-bottom:0.4rem;">Takip Numarası (opsiyonel)</label>
                <input id="cargo-tracking-input" type="text" placeholder="Takip numarası" style="width:100%;padding:0.5rem 0.75rem;border:1px solid #ddd;border-radius:8px;font-size:0.95rem;box-sizing:border-box;">
            </div>
            <div style="display:flex;gap:0.75rem;justify-content:flex-end;">
                <button id="cargo-ship-cancel" class="btn btn-secondary">İptal</button>
                <button id="cargo-ship-confirm" class="btn btn-primary" style="background:#8e44ad;border-color:#8e44ad;">Kargoya Ver</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('cargo-ship-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    document.getElementById('cargo-ship-confirm').addEventListener('click', async () => {
        const cargoCompany = document.getElementById('cargo-company-input').value.trim();
        const cargoTrackingNumber = document.getElementById('cargo-tracking-input').value.trim();
        if (!cargoCompany) {
            alert('Kargo firması zorunludur.');
            return;
        }
        const btn = document.getElementById('cargo-ship-confirm');
        btn.disabled = true;
        btn.textContent = 'Gönderiliyor...';
        try {
            const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
            const res = await fetch(`${baseUrl}/api/orders/seller/cargo-ship/${orderId}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cargoCompany, cargoTrackingNumber })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Hata oluştu');
            modal.remove();
            showSellerActionNotification('success', 'Kargoya Verildi', `#${orderId} kargoya verildi. Firma: ${cargoCompany}`);
            await loadOrdersForTab('preparing');
            await loadOrdersForTab('cargo_ready');
            await loadOrdersForTab('shipped');
        } catch (err) {
            showSellerActionNotification('error', 'Hata', err.message);
            btn.disabled = false;
            btn.textContent = 'Kargoya Ver';
        }
    });
}

function showSellerActionNotification(type, title, message) {
    const isError = type === 'error';
    const bg = isError ? '#E53935' : '#2E7D32';
    const icon = isError ? '⚠️' : '✅';
    const toast = document.createElement('div');
    toast.className = 'seller-action-toast';
    toast.style.cssText = [
        'position:fixed',
        'top:20px',
        'right:20px',
        'z-index:10001',
        'background:' + bg,
        'color:#fff',
        'padding:14px 18px',
        'border-radius:10px',
        'box-shadow:0 8px 24px rgba(0,0,0,0.24)',
        'min-width:300px',
        'max-width:420px',
        'font-weight:500',
        'animation:slideIn 0.25s ease-out'
    ].join(';');
    toast.innerHTML = '<div style="display:flex; gap:10px; align-items:flex-start;">' +
        '<span style="font-size:18px; line-height:1;">' + icon + '</span>' +
        '<div><strong style="display:block; margin-bottom:2px;">' + (title || 'Bildirim') + '</strong>' +
        '<span style="font-size:13px;">' + (message || '') + '</span></div>' +
        '</div>';
    document.body.appendChild(toast);

    // Ses bildirimi satıcının kendi yaptığı işlemlerde çalmıyor,
    // yalnızca gelen socketevents için çalıyor (initSellerSocket içinde)

    setTimeout(function() {
        toast.style.animation = 'slideOut 0.25s ease-in';
        setTimeout(function() { toast.remove(); }, 250);
    }, 4500);
}

function initializeOrdersPage() {
    loadOrdersPage();
}

async function fetchDashboardData() {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/seller/dashboard`, {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Dashboard verileri yüklenemedi');
        const data = await response.json();
        return data.success ? data : null;
    } catch (error) {
        return null;
    }
}

function renderRecentOrdersList(orders, containerId) {
    const ordersList = document.getElementById(containerId);
    if (!ordersList) return;
    if (orders.length === 0) {
        ordersList.innerHTML = '<p style="text-align: center; padding: 2rem; color: #666;">Henüz sipariş bulunmuyor.</p>';
        return;
    }
    ordersList.innerHTML = orders.map(order => {
        const statusClass = order.status === 'delivered' ? 'delivered' : 
                           order.status === 'preparing' ? 'preparing' : 
                           order.status === 'cancelled' ? 'cancelled' : '';
        const statusText = order.status === 'delivered' ? 'Teslim Edildi' :
                          order.status === 'preparing' ? 'Hazırlanıyor' :
                          order.status === 'cancelled' ? 'İptal Edildi' :
                          order.status === 'ready' ? 'Hazır' : 'Bekliyor';
        const total = parseFloat(order.total) || 0;
        const discount = parseFloat(order.discount) || 0;
        const couponCode = order.couponCode || order.coupon_code || '';
        return `
            <div class="order-list-item">
                <div class="order-info">
                    <strong>#${order.orderNumber || order.id} - ${order.customer || 'Müşteri'}</strong>
                    <span>${order.items || 'Belirtilmemiş'}</span>
                    ${discount > 0 ? `<span style="color:#27AE60;">Kupon: ${couponCode || 'Uygulandı'} (-${discount.toFixed(2)} TL)</span>` : ''}
                </div>
                <div class="order-status ${statusClass}">
                    ${statusText}
                </div>
                <div class="order-price">
                    ${total.toFixed(2)} TL
                </div>
                <a href="/seller/orders" class="btn btn-secondary btn-sm">Detay</a>
            </div>
        `;
    }).join('');
}

async function loadDashboardPage() {
    try {
        const data = await fetchDashboardData();
        
        if (!data) {
            const subtitle = document.getElementById('dashboard-subtitle');
            if (subtitle) subtitle.textContent = 'Veri yüklenemedi.';
            renderRecentOrdersList([], 'recent-orders-list');
            renderRecentOrdersList([], 'recent-orders-list-earnings');
            return;
        }
        
        const subtitle = document.getElementById('dashboard-subtitle');
        if (subtitle) {
            const ownerName = data.fullname || 'Satıcı';
            subtitle.textContent = `Hoş geldin, ${ownerName}! İşletmenizin anlık durumu burada.`;
        }
        
        if (window.updateSellerSidebarOwnerName) {
            setTimeout(() => {
                window.updateSellerSidebarOwnerName();
            }, 200);
        }

        const shopStatusBtn = document.getElementById('shop-status-btn');
        if (shopStatusBtn && data.hasOwnProperty('isOpen')) {
            shopStatusBtn.style.display = 'inline-block';
            shopStatusBtn.textContent = data.isOpen ? 'Dükkanı Kapat' : 'Dükkanı Aç';
            shopStatusBtn.className = data.isOpen ? 'btn btn-danger' : 'btn btn-primary';
            
            shopStatusBtn.onclick = async () => {
                const newStatus = !data.isOpen;
                shopStatusBtn.disabled = true;
                shopStatusBtn.textContent = 'Bekleyin...';
                try {
                    const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
                    const response = await fetch(`${baseUrl}/api/seller/toggle-shop-status`, {
                        method: 'PUT',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ is_open: newStatus })
                    });
                    if (!response.ok) throw new Error('Güncelleme başarısız');
                    
                    data.isOpen = newStatus;
                    shopStatusBtn.textContent = data.isOpen ? 'Dükkanı Kapat' : 'Dükkanı Aç';
                    shopStatusBtn.className = data.isOpen ? 'btn btn-danger' : 'btn btn-primary';
                    showSellerActionNotification('success', 'Dükkan Durumu', 'Dükkan ' + (data.isOpen ? 'açıldı.' : 'kapatıldı.'));
                } catch (err) {
                    showSellerActionNotification('error', 'Hata', err.message);
                    shopStatusBtn.textContent = data.isOpen ? 'Dükkanı Kapat' : 'Dükkanı Aç';
                } finally {
                    shopStatusBtn.disabled = false;
                }
            };
        }
        
        // İstatistikleri güncelle
        const stats = data.stats || {};
        const newOrdersEl = document.getElementById('stat-new-orders');
        const completedEl = document.getElementById('stat-completed');
        const earningsEl = document.getElementById('stat-earnings');
        const ratingEl = document.getElementById('stat-rating');
        
        if (newOrdersEl) newOrdersEl.textContent = stats.newOrders || 0;
        if (completedEl) completedEl.textContent = stats.completedOrders || 0;
        if (earningsEl) earningsEl.textContent = `${(stats.todayEarnings || 0).toFixed(2)} TL`;
        if (ratingEl) ratingEl.textContent = (stats.shopRating || 0).toFixed(1);
        
        renderRecentOrdersList(data.recentOrders || [], 'recent-orders-list');
        renderRecentOrdersList(data.recentOrders || [], 'recent-orders-list-earnings');
    } catch (error) {
        const subtitle = document.getElementById('dashboard-subtitle');
        if (subtitle) subtitle.textContent = 'Veri yüklenirken hata oluştu.';
    }
}

function initializeDashboardPage() {
    loadDashboardPage();
}

// Profil sayfası işlevleri
async function fetchSellerProfile() {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/seller/profile`, {
            credentials: 'include'
        });
        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = 'Profil yüklenemedi';
            let errorDetails = null;
            try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.message || errorMessage;
                errorDetails = errorData.error || null;
            } catch (e) {}
            
            const finalError = new Error(errorMessage);
            if (errorDetails) {
                finalError.details = errorDetails;
            }
            throw finalError;
        }
        
        const data = await response.json();
        if (!data.success) {
            return null;
        }
        
        return data.profile || null;
    } catch (error) {
        return null;
    }
}

async function updateSellerProfile(profileData) {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/seller/profile`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileData)
        });
        
        
        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            let errorMessage = 'Profil güncellenemedi';
            
            if (contentType && contentType.includes('application/json')) {
                try {
                    const error = await response.json();
                    errorMessage = error.message || errorMessage;
                } catch (jsonError) {
                    errorMessage = `Sunucu hatası (${response.status}): ${response.statusText}`;
                }
            } else {
                const errorText = await response.text();
                if (response.status === 405) {
                    errorMessage = 'Bu işlem için kullanılan HTTP metodu desteklenmiyor. Lütfen sayfayı yenileyin ve tekrar deneyin.';
                } else {
                    errorMessage = `Sunucu hatası (${response.status}): ${response.statusText}`;
                }
            }
            
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        throw error;
    }
}

async function loadProfilePage() {
    try {
        const profile = await fetchSellerProfile();
        
        if (!profile) {
            alert('Profil bilgileri yüklenemedi.');
            return;
        }
        
        const fullnameInput = document.getElementById('seller-fullname');
        const emailInput = document.getElementById('seller-email');
        const shopNameInput = document.getElementById('shop-name');
        const descriptionInput = document.getElementById('shop-description');
        const locationInput = document.getElementById('shop-location');
        const hoursInput = document.getElementById('shop-hours');
        const logoPreview = document.getElementById('logo-preview');
        const bannerPreview = document.getElementById('banner-preview');
        const removeLogoBtn = document.getElementById('remove-logo-btn');
        const removeBannerBtn = document.getElementById('remove-banner-btn');
        
        if (fullnameInput) fullnameInput.value = profile.fullname || '';
        if (emailInput) emailInput.value = profile.email || '';
        if (shopNameInput) shopNameInput.value = profile.shopName || '';
        if (descriptionInput) descriptionInput.value = profile.description || '';
        if (locationInput) locationInput.value = profile.location || '';
        // Çalışma saatleri editörünü doldur (yeni JSON formatı veya eski text)
        renderScheduleEditor(profile.workingHours);
        // Geriye uyumluluk: eski input hâlâ varsa onu da doldur
        if (hoursInput) {
            let hoursValue = profile.workingHours || '';
            if (hoursValue && typeof hoursValue === 'object') {
                hoursValue = JSON.stringify(hoursValue, null, 2);
            }
            hoursInput.value = hoursValue;
        }
        if (logoPreview && profile.logoUrl) {
            logoPreview.src = profile.logoUrl;
            if (removeLogoBtn) removeLogoBtn.style.display = 'inline-block';
        } else {
            if (logoPreview) logoPreview.src = '';
            if (removeLogoBtn) removeLogoBtn.style.display = 'none';
        }
        if (bannerPreview && profile.bannerUrl) {
            bannerPreview.src = profile.bannerUrl;
            if (removeBannerBtn) removeBannerBtn.style.display = 'inline-block';
        } else {
            if (bannerPreview) bannerPreview.src = '';
            if (removeBannerBtn) removeBannerBtn.style.display = 'none';
        }
        
        // Teslimat yarıçapı yükle
        const radiusSlider = document.getElementById('delivery-radius');
        const radiusLabel = document.getElementById('radius-label');
        const radiusBadge = document.getElementById('radius-badge');
        
        function updateRadiusUI(val) {
            val = parseInt(val) || 0;
            if (radiusLabel) {
                radiusLabel.textContent = val === 0 ? 'Sınırsız' : val + ' km';
            }
            if (radiusBadge) {
                if (val === 0) {
                    radiusBadge.textContent = 'TÜM TÜRKİYE';
                    radiusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
                    radiusBadge.style.color = '#059669';
                } else if (val <= 50) {
                    radiusBadge.textContent = 'YAKIN ÇEVRE';
                    radiusBadge.style.background = 'rgba(245, 158, 11, 0.15)';
                    radiusBadge.style.color = '#d97706';
                } else if (val <= 150) {
                    radiusBadge.textContent = 'BÖLGESEL';
                    radiusBadge.style.background = 'rgba(59, 130, 246, 0.15)';
                    radiusBadge.style.color = '#2563eb';
                } else {
                    radiusBadge.textContent = 'GENİŞ ALAN';
                    radiusBadge.style.background = 'rgba(139, 92, 246, 0.15)';
                    radiusBadge.style.color = '#7c3aed';
                }
            }
        }
        
        if (radiusSlider) {
            radiusSlider.value = profile.deliveryRadiusKm || 0;
            const pickupCb = document.getElementById('pickup-enabled');
            if (pickupCb) pickupCb.checked = profile.pickupEnabled !== false;
            const uzakMesafeCb = document.getElementById('uzak-mesafe-enabled');
            if (uzakMesafeCb) {
                uzakMesafeCb.checked = !!profile.uzakMesafeEnabled;
                uzakMesafeCb.addEventListener('change', function() {
                    window.__sellerUzakMesafeEnabled = this.checked;
                    updateSidebarUzakMesafe(this.checked);
                });
            }
            window.__sellerUzakMesafeEnabled = !!profile.uzakMesafeEnabled;
            updateSidebarUzakMesafe(!!profile.uzakMesafeEnabled);
            updateRadiusUI(radiusSlider.value);
            radiusSlider.addEventListener('input', function() {
                updateRadiusUI(this.value);
            });
        }
        
        const profileForm = document.getElementById('seller-profile-form');
        
        const logoOptionFile = document.getElementById('logo-option-file');
        const logoOptionUrl = document.getElementById('logo-option-url');
        const logoFileContainer = document.getElementById('logo-file-container');
        const logoUrlContainer = document.getElementById('logo-url-container');
        const logoUrlInput = document.getElementById('logo-url-input');
        
        if (logoOptionFile && logoOptionUrl && logoFileContainer && logoUrlContainer) {
            logoOptionFile.addEventListener('change', () => {
                logoFileContainer.style.display = 'block';
                logoUrlContainer.style.display = 'none';
            });
            logoOptionUrl.addEventListener('change', () => {
                logoFileContainer.style.display = 'none';
                logoUrlContainer.style.display = 'block';
            });
            if (profile.logoUrl && !profile.logoUrl.startsWith('/uploads/')) {
                logoOptionUrl.checked = true;
                logoFileContainer.style.display = 'none';
                logoUrlContainer.style.display = 'block';
                if (logoUrlInput) logoUrlInput.value = profile.logoUrl;
            }
        }
        
        const bannerOptionFile = document.getElementById('banner-option-file');
        const bannerOptionUrl = document.getElementById('banner-option-url');
        const bannerFileContainer = document.getElementById('banner-file-container');
        const bannerUrlContainer = document.getElementById('banner-url-container');
        const bannerUrlInput = document.getElementById('banner-url-input');
        
        if (bannerOptionFile && bannerOptionUrl && bannerFileContainer && bannerUrlContainer) {
            bannerOptionFile.addEventListener('change', () => {
                bannerFileContainer.style.display = 'block';
                bannerUrlContainer.style.display = 'none';
            });
            bannerOptionUrl.addEventListener('change', () => {
                bannerFileContainer.style.display = 'none';
                bannerUrlContainer.style.display = 'block';
            });
            if (profile.bannerUrl && !profile.bannerUrl.startsWith('/uploads/')) {
                bannerOptionUrl.checked = true;
                bannerFileContainer.style.display = 'none';
                bannerUrlContainer.style.display = 'block';
                if (bannerUrlInput) bannerUrlInput.value = profile.bannerUrl;
            }
        }

        if (profileForm) {
            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                let finalLogoUrl = undefined;
                let finalBannerUrl = undefined;
                
                if (logoOptionUrl && logoOptionUrl.checked) {
                    const logoVal = logoUrlInput ? logoUrlInput.value.trim() : '';
                    if (logoVal === '' && profile && profile.logoUrl && profile.logoUrl.startsWith('/uploads/')) {
                        // Kullanıcı URL moduna geçti ama URL girmedi ve zaten yüklü bir logo var → sıfırlama
                        const keepLogo = window.showConfirm
                            ? await window.showConfirm('URL alanı boş bırakıldı. Mevcut yüklü logonuz silinecek. Devam etmek istiyor musunuz?')
                            : window.confirm('URL alanı boş. Mevcut logo silinecek. Devam?');
                        if (!keepLogo) return;
                    }
                    finalLogoUrl = logoVal !== '' ? logoVal : null;
                }
                if (bannerOptionUrl && bannerOptionUrl.checked) {
                    const bannerVal = bannerUrlInput ? bannerUrlInput.value.trim() : '';
                    if (bannerVal === '' && profile && profile.bannerUrl && profile.bannerUrl.startsWith('/uploads/')) {
                        const keepBanner = window.showConfirm
                            ? await window.showConfirm('URL alanı boş bırakıldı. Mevcut yüklü banner\'ınız silinecek. Devam etmek istiyor musunuz?')
                            : window.confirm('URL alanı boş. Mevcut banner silinecek. Devam?');
                        if (!keepBanner) return;
                    }
                    finalBannerUrl = bannerVal !== '' ? bannerVal : null;
                }
                
                const pickupCb = document.getElementById('pickup-enabled');
                const uzakMesafeCb = document.getElementById('uzak-mesafe-enabled');
                const scheduleData = collectScheduleData();
                // Dükkan adı zorunlu — boş bırakılamaz
                if (shopNameInput && !shopNameInput.value.trim()) {
                    if (window.YsUI) window.YsUI.showToast('Dükkan adı boş bırakılamaz.', 'error');
                    else alert('Dükkan adı boş bırakılamaz.');
                    shopNameInput.focus();
                    return;
                }
                const profileData = {
                    fullname: fullnameInput?.value || '',
                    email: emailInput?.value || '',
                    shopName: shopNameInput?.value?.trim() || '',
                    description: descriptionInput?.value || '',
                    location: locationInput?.value || '',
                    workingHours: scheduleData ? JSON.stringify(scheduleData) : (hoursInput?.value && hoursInput.value.trim() !== '' ? hoursInput.value : undefined),
                    deliveryRadiusKm: radiusSlider ? parseInt(radiusSlider.value) || 0 : undefined,
                    pickupEnabled: pickupCb ? pickupCb.checked : true,
                    uzakMesafeEnabled: uzakMesafeCb ? uzakMesafeCb.checked : false
                };
                window.__sellerUzakMesafeEnabled = uzakMesafeCb ? uzakMesafeCb.checked : false;
                updateSidebarUzakMesafe(window.__sellerUzakMesafeEnabled);
                
                if (finalLogoUrl !== undefined) profileData.logoUrl = finalLogoUrl;
                if (finalBannerUrl !== undefined) profileData.bannerUrl = finalBannerUrl;
                
                try {
                    await updateSellerProfile(profileData);
                    alert('✅ Profil başarıyla güncellendi!');
                    
                    if (window.updateSellerSidebarOwnerName) {
                        await window.updateSellerSidebarOwnerName();
                    }
                } catch (error) {
                    alert('❌ Profil güncellenirken hata oluştu: ' + error.message);
                }
            });
        }
        
        const logoUpload = document.getElementById('logo-upload');
        const bannerUpload = document.getElementById('banner-upload');
        
        if (logoUpload) {
            logoUpload.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    // Dosya boyutu kontrolü (max 5MB)
                    if (file.size > 5 * 1024 * 1024) {
                        alert('❌ Logo resmi çok büyük! Maksimum 5MB olmalı.');
                        e.target.value = ''; // Input'u temizle
                        return;
                    }
                    
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        if (logoPreview) {
                            logoPreview.src = e.target.result;
                        }
                    };
                    reader.readAsDataURL(file);
                    
                    try {
                        const formData = new FormData();
                        formData.append('logo', file);
                        
                        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
                        const response = await fetch(`${baseUrl}/api/upload/seller/logo`, {
                            method: 'POST',
                            credentials: 'include',
                            body: formData
                        });
                        
                        if (!response.ok) {
                            const error = await response.json();
                            throw new Error(error.message || 'Logo yüklenemedi');
                        }
                        
                        const data = await response.json();
                        if (logoPreview) {
                            logoPreview.src = data.url;
                        }
                        
                        if (removeLogoBtn) {
                            removeLogoBtn.style.display = 'inline-block';
                        }
                        
                        alert('✅ Logo başarıyla yüklendi!');
                    } catch (error) {
                        alert('❌ Logo yüklenirken hata oluştu: ' + error.message);
                        e.target.value = '';
                        if (logoPreview) {
                            logoPreview.src = profile.logoUrl || '';
                        }
                    }
                }
            });
        }
        
        if (bannerUpload) {
            bannerUpload.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 5 * 1024 * 1024) {
                        alert('❌ Banner resmi çok büyük! Maksimum 5MB olmalı.');
                        e.target.value = ''; 
                        return;
                    }
                    
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        if (bannerPreview) {
                            bannerPreview.src = e.target.result;
                        }
                    };
                    reader.readAsDataURL(file);
                    
                    // Dosyayı sunucuya yükle
                    try {
                        const formData = new FormData();
                        formData.append('banner', file);
                        
                        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
                        const response = await fetch(`${baseUrl}/api/upload/seller/banner`, {
                            method: 'POST',
                            credentials: 'include',
                            body: formData
                        });
                        
                        if (!response.ok) {
                            const error = await response.json();
                            throw new Error(error.message || 'Banner yüklenemedi');
                        }
                        
                        const data = await response.json();
                        // Preview'ı güncelle
                        if (bannerPreview) {
                            bannerPreview.src = data.url;
                        }
                        
                        // Kaldır butonunu göster
                        if (removeBannerBtn) {
                            removeBannerBtn.style.display = 'inline-block';
                        }
                        
                        alert('✅ Banner başarıyla yüklendi!');
                    } catch (error) {
                        alert('❌ Banner yüklenirken hata oluştu: ' + error.message);
                        e.target.value = ''; 
                        if (bannerPreview) {
                            bannerPreview.src = profile.bannerUrl || '';
                        }
                    }
                }
            });
        }
        
        if (removeLogoBtn) {
            removeLogoBtn.addEventListener('click', async () => {
                const isConfirmed = await window.showConfirm('Logoyu kaldırmak istediğinize emin misiniz?');
                if (!isConfirmed) {
                    return;
                }
                
                try {
                    const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
                    await updateSellerProfile({ logoUrl: null });
                    
                    if (logoPreview) {
                        logoPreview.src = '';
                    }
                    
                    // Input'u temizle
                    if (logoUpload) {
                        logoUpload.value = '';
                    }
                    
                    removeLogoBtn.style.display = 'none';
                    
                    alert('✅ Logo başarıyla kaldırıldı!');
                } catch (error) {
                    alert('❌ Logo kaldırılırken hata oluştu: ' + error.message);
                }
            });
        }
        
        // Banner kaldırma butonu
        if (removeBannerBtn) {
            removeBannerBtn.addEventListener('click', async () => {
                const isConfirmed = await window.showConfirm('Banner\'ı kaldırmak istediğinize emin misiniz?');
                if (!isConfirmed) {
                    return;
                }
                
                try {
                    const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
                    await updateSellerProfile({ bannerUrl: null });
                    
                    if (bannerPreview) {
                        bannerPreview.src = '';
                    }
                    
                    if (bannerUpload) {
                        bannerUpload.value = '';
                    }
                    
                    removeBannerBtn.style.display = 'none';
                    
                    alert('✅ Banner başarıyla kaldırıldı!');
                } catch (error) {
                    alert('❌ Banner kaldırılırken hata oluştu: ' + error.message);
                }
            });
        }
    } catch (error) {}
}

function initializeProfilePage() {
    loadProfilePage();
}

// Kuponlar sayfası işlevleri
async function loadSellerCoupons() {
    const container = document.getElementById('seller-coupon-list-container');
    if (!container) return;
    
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/seller/coupons`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Kuponlar yüklenemedi');
        }
        
        const data = await response.json();
        const coupons = data.success ? data.coupons : [];
        
        if (coupons.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 2rem; color: #666;">Henüz kupon oluşturmadınız.</p>';
            return;
        }
        
        container.innerHTML = coupons.map(coupon => {
            const discountText = coupon.discountType === 'percentage' 
                ? `%${coupon.discountValue}` 
                : `${coupon.discountValue} TL`;
            
            const validFrom = new Date(coupon.validFrom).toLocaleDateString('tr-TR');
            const validUntil = new Date(coupon.validUntil).toLocaleDateString('tr-TR');
            const isExpired = new Date(coupon.validUntil) < new Date();
            const statusClass = !coupon.isActive ? 'cancelled' : isExpired ? 'cancelled' : 'delivered';
            const statusText = !coupon.isActive ? 'Pasif' : isExpired ? 'Süresi Doldu' : 'Aktif';
            
            return `
                <div class="coupon-list-item" style="padding: 1.5rem; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; margin-bottom: 1rem;">
                    <div class="coupon-info" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                        <div>
                            <strong style="font-size: 1.2rem; color: var(--primary-color);">${coupon.code}</strong>
                            <span class="order-status ${statusClass}" style="margin-left: 1rem;">${statusText}</span>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary-color);">${discountText}</div>
                            <div style="font-size: 0.85rem; color: #666;">İndirim</div>
                        </div>
                    </div>
                    ${coupon.description ? `<p style="color: #666; margin: 0.5rem 0;">${coupon.description}</p>` : ''}
                    <div style="display: flex; gap: 1rem; margin-top: 0.5rem; font-size: 0.9rem; color: #666; align-items: center; justify-content: space-between;">
                        <div style="display: flex; gap: 1rem;">
                            <span>Min. Tutar: ${coupon.minOrderAmount || 0} TL</span>
                            <span>•</span>
                            <span>Kullanım: ${coupon.usedCount || 0}${coupon.usageLimit && coupon.usageLimit > 0 ? ` / ${coupon.usageLimit}` : ' / Sınırsız'}</span>
                            <span>•</span>
                            <span>Geçerli: ${validFrom} - ${validUntil}</span>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-sm edit-coupon-btn" data-id="${coupon.id}" data-code="${coupon.code}" data-description="${coupon.description || ''}" data-discount-type="${coupon.discountType}" data-discount-value="${coupon.discountValue}" data-min-order="${coupon.minOrderAmount || 0}" data-max-discount="${coupon.maxDiscountAmount || ''}" data-is-active="${coupon.isActive ? '1' : '0'}" style="padding: 0.35rem 0.85rem; font-size: 0.85rem; background-color: #3498DB !important; color: white !important; border: none; border-radius: 4px; cursor: pointer;">DÜZENLE</button>
                            <button class="btn btn-sm delete-coupon-btn" data-id="${coupon.id}" style="padding: 0.35rem 0.85rem; font-size: 0.85rem; background-color: #E74C3C !important; color: white !important; border: none; border-radius: 4px; cursor: pointer; transition: background-color 0.2s;">SİL</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        container.innerHTML = '<p style="color: red;">Kuponlar yüklenirken bir hata oluştu.</p>';
    }
}

function initializeCouponsPage() {
    const form = document.getElementById('seller-coupon-form');
    const discountType = document.getElementById('discount-type');
    const maxDiscountGroup = document.getElementById('max-discount-group');
    
    if (!form) return;
    
    if (discountType && maxDiscountGroup) {
        discountType.addEventListener('change', (e) => {
            if (e.target.value === 'percentage') {
                maxDiscountGroup.style.display = 'block';
            } else {
                maxDiscountGroup.style.display = 'none';
            }
        });
    }
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const code = document.getElementById('coupon-code').value.trim();
        const description = document.getElementById('coupon-description').value.trim();
        const discountTypeValue = document.getElementById('discount-type').value;
        const discountValue = parseFloat(document.getElementById('discount-value').value);
        const minOrderAmount = parseFloat(document.getElementById('min-order-amount').value) || 0;
        const maxDiscountAmount = document.getElementById('max-discount-amount').value ? parseFloat(document.getElementById('max-discount-amount').value) : null;
        const validDays = parseInt(document.getElementById('valid-days').value) || 30;
        
        if (!code || !discountValue || discountValue <= 0) {
            alert('Lütfen geçerli bir kupon kodu ve indirim değeri girin.');
            return;
        }
        
        if (discountTypeValue === 'percentage' && (discountValue <= 0 || discountValue > 100)) {
            alert('Yüzde indirim değeri 1-100 arası olmalıdır.');
            return;
        }
        
        try {
            const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
            const response = await fetch(`${baseUrl}/api/seller/coupons`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    code,
                    description: description || null,
                    discountType: discountTypeValue,
                    discountValue,
                    minOrderAmount,
                    maxDiscountAmount,
                    validDays
                })
            });
            
            const data = await response.json();
            
            if (!response.ok || !data.success) {
                alert(data.message || 'Kupon oluşturulamadı.');
                return;
            }
            
            alert('✅ Kupon başarıyla oluşturuldu!');
            form.reset();
            document.getElementById('max-discount-group').style.display = 'none';
            loadSellerCoupons();
            
        } catch (error) {
            alert('Kupon oluşturulurken bir hata oluştu.');
        }
    });
    
    // Edit modal HTML'i DOM'a ekle
    if (!document.getElementById('coupon-edit-modal')) {
        const modal = document.createElement('div');
        modal.id = 'coupon-edit-modal';
        modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center;';
        modal.innerHTML = `
            <div style="background:#fff; border-radius:12px; padding:2rem; width:90%; max-width:500px; max-height:90vh; overflow-y:auto;">
                <h3 style="margin-bottom:1.5rem;">Kuponu Düzenle</h3>
                <form id="coupon-edit-form">
                    <input type="hidden" id="edit-coupon-id">
                    <div class="form-group" style="margin-bottom:1rem;">
                        <label class="form-label">Kupon Kodu *</label>
                        <input type="text" id="edit-coupon-code" class="form-input" required>
                    </div>
                    <div class="form-group" style="margin-bottom:1rem;">
                        <label class="form-label">Açıklama</label>
                        <textarea id="edit-coupon-description" class="form-input" rows="2"></textarea>
                    </div>
                    <div style="display:flex; gap:1rem; margin-bottom:1rem;">
                        <div class="form-group" style="flex:1;">
                            <label class="form-label">İndirim Türü *</label>
                            <select id="edit-discount-type" class="form-input">
                                <option value="fixed">Sabit Tutar (TL)</option>
                                <option value="percentage">Yüzde (%)</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label class="form-label">İndirim Değeri *</label>
                            <input type="number" id="edit-discount-value" class="form-input" step="0.01" min="0" required>
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom:1rem;">
                        <label class="form-label">Minimum Sipariş Tutarı (TL)</label>
                        <input type="number" id="edit-min-order-amount" class="form-input" step="0.01" min="0" value="0">
                    </div>
                    <div class="form-group" id="edit-max-discount-group" style="margin-bottom:1rem; display:none;">
                        <label class="form-label">Maksimum İndirim Tutarı (TL)</label>
                        <input type="number" id="edit-max-discount-amount" class="form-input" step="0.01" min="0">
                    </div>
                    <div class="form-group" style="margin-bottom:1rem;">
                        <label class="form-label">Yeni Geçerlilik Süresi (Gün) — boş bırakılırsa değişmez</label>
                        <input type="number" id="edit-valid-days" class="form-input" min="1" placeholder="Örn: 30">
                    </div>
                    <div class="form-group" style="margin-bottom:1.5rem;">
                        <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                            <input type="checkbox" id="edit-is-active"> Aktif
                        </label>
                    </div>
                    <div style="display:flex; gap:1rem; justify-content:flex-end;">
                        <button type="button" id="coupon-edit-cancel" class="btn btn-secondary">İptal</button>
                        <button type="submit" class="btn btn-primary">Kaydet</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('edit-discount-type').addEventListener('change', (e) => {
            document.getElementById('edit-max-discount-group').style.display = e.target.value === 'percentage' ? 'block' : 'none';
        });

        document.getElementById('coupon-edit-cancel').addEventListener('click', () => {
            document.getElementById('coupon-edit-modal').style.display = 'none';
        });

        document.getElementById('coupon-edit-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const couponId = document.getElementById('edit-coupon-id').value;
            const code = document.getElementById('edit-coupon-code').value.trim();
            const description = document.getElementById('edit-coupon-description').value.trim();
            const discountTypeValue = document.getElementById('edit-discount-type').value;
            const discountValue = parseFloat(document.getElementById('edit-discount-value').value);
            const minOrderAmount = parseFloat(document.getElementById('edit-min-order-amount').value) || 0;
            const maxDiscountAmountVal = document.getElementById('edit-max-discount-amount').value;
            const maxDiscountAmount = maxDiscountAmountVal ? parseFloat(maxDiscountAmountVal) : null;
            const validDaysVal = document.getElementById('edit-valid-days').value;
            const validDays = validDaysVal ? parseInt(validDaysVal) : null;
            const isActive = document.getElementById('edit-is-active').checked;

            if (!code || !discountValue || discountValue <= 0) {
                alert('Lütfen geçerli bir kupon kodu ve indirim değeri girin.');
                return;
            }

            try {
                const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
                const response = await fetch(`${baseUrl}/api/seller/coupons/${couponId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ code, description, discountType: discountTypeValue, discountValue, minOrderAmount, maxDiscountAmount, validDays, isActive })
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    alert('✅ Kupon başarıyla güncellendi!');
                    document.getElementById('coupon-edit-modal').style.display = 'none';
                    loadSellerCoupons();
                } else {
                    alert(data.message || 'Kupon güncellenemedi.');
                }
            } catch (err) {
                alert('Kupon güncellenirken ağ hatası oluştu.');
            }
        });
    }

    // Kupon Silme ve Düzenleme Listener'ı
    const container = document.getElementById('seller-coupon-list-container');
    if (container) {
        container.addEventListener('click', async (e) => {
            if (e.target.classList.contains('edit-coupon-btn')) {
                const btn = e.target;
                document.getElementById('edit-coupon-id').value = btn.dataset.id;
                document.getElementById('edit-coupon-code').value = btn.dataset.code;
                document.getElementById('edit-coupon-description').value = btn.dataset.description;
                document.getElementById('edit-discount-type').value = btn.dataset.discountType;
                document.getElementById('edit-discount-value').value = btn.dataset.discountValue;
                document.getElementById('edit-min-order-amount').value = btn.dataset.minOrder;
                document.getElementById('edit-max-discount-amount').value = btn.dataset.maxDiscount;
                document.getElementById('edit-is-active').checked = btn.dataset.isActive === '1';
                document.getElementById('edit-valid-days').value = '';
                document.getElementById('edit-max-discount-group').style.display = btn.dataset.discountType === 'percentage' ? 'block' : 'none';
                
                if (window.initYsSelects) {
                    window.initYsSelects(document.getElementById('coupon-edit-modal'));
                    const selectEl = document.getElementById('edit-discount-type');
                    if (selectEl && selectEl.syncCustomUI) {
                        selectEl.syncCustomUI();
                    }
                }
                
                document.getElementById('coupon-edit-modal').style.display = 'flex';
                return;
            }
            if (e.target.classList.contains('delete-coupon-btn')) {
                const couponId = e.target.getAttribute('data-id');
                const isConfirmed = await window.showConfirm('Bu kuponu silmek istediğinize emin misiniz?');
                if (isConfirmed) {
                    const btn = e.target;
                    try {
                        btn.disabled = true;
                        btn.textContent = 'Siliniyor...';
                        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
                        const response = await fetch(`${baseUrl}/api/seller/coupons/${couponId}`, {
                            method: 'DELETE',
                            credentials: 'include'
                        });
                        const data = await response.json();
                        if (response.ok && data.success) {
                            alert('Kupon başarıyla silindi.');
                            loadSellerCoupons();
                        } else {
                            alert(data.message || 'Kupon silinirken hata oluştu.');
                            btn.disabled = false;
                            btn.textContent = 'SİL';
                        }
                    } catch (err) {
                        alert('Kupon silinirken ağ hatası oluştu.');
                        btn.disabled = false;
                        btn.textContent = 'SİL';
                    }
                }
            }
        });
    }

    // Kuponları yükle
    loadSellerCoupons();
}

// Sidebar linklerini güncelle

function updateSellerSidebarLinks(sellerId) {
    if (!sellerId) return;
    
    const links = {
        'seller-dashboard-link': `/seller/${sellerId}/dashboard`,
        'sidebar-dashboard-link': `/seller/${sellerId}/dashboard`,
        'sidebar-orders-link': `/seller/${sellerId}/orders`,
        'sidebar-menu-link': `/seller/${sellerId}/menu`,
        'sidebar-earnings-link': `/seller/${sellerId}/earnings`,
        'sidebar-profile-link': `/seller/${sellerId}/profile`,
        'sidebar-coupons-link': `/seller/${sellerId}/coupons`
    };
    
    Object.keys(links).forEach(id => {
        const link = document.getElementById(id);
        if (link) {
            link.href = links[id];
        }
    });
}

async function updateSellerSidebarOwnerName() {
    try {
        const ownerNameEl = document.getElementById('seller-owner-name');
        if (!ownerNameEl) return;
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        try {
            const dashboardResponse = await fetch(`${baseUrl}/api/seller/dashboard`, { credentials: 'include' });
            if (dashboardResponse.ok) {
                const dashboardData = await dashboardResponse.json();
                if (dashboardData.success && dashboardData.fullname) {
                    ownerNameEl.textContent = dashboardData.fullname;
                    // uzak_mesafe durumunu ayrıca profile'dan çek (dashboard bunu dönmüyor)
                    fetchAndApplyUzakMesafeSidebar(baseUrl);
                    return;
                }
            }
        } catch (dashboardError) {}
        try {
            const response = await fetch(`${baseUrl}/api/seller/profile`, { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.profile) {
                    if (data.profile.fullname) ownerNameEl.textContent = data.profile.fullname;
                    window.__sellerUzakMesafeEnabled = !!data.profile.uzakMesafeEnabled;
                    updateSidebarUzakMesafe(!!data.profile.uzakMesafeEnabled);
                    return;
                }
            }
        } catch (profileError) {}
        if (!ownerNameEl.textContent || ownerNameEl.textContent === 'Yükleniyor...') {
            ownerNameEl.textContent = 'Bilinmiyor';
        }
    } catch (error) {
        const el = document.getElementById('seller-owner-name');
        if (el) el.textContent = 'Hata';
    }
}

const PAGE_NAMES = ['dashboard', 'orders', 'menu', 'earnings', 'profile', 'coupons', 'uzak-mesafe'];

function getSellerIdFromUrl() {
    const pathParts = window.location.pathname.split('/');
    const sellerIndex = pathParts.indexOf('seller');
    if (sellerIndex !== -1 && pathParts[sellerIndex + 1]) {
        const segment = pathParts[sellerIndex + 1];
        if (PAGE_NAMES.includes(segment) || !/^\d+$/.test(segment)) {
            return null;
        }
        return segment;
    }
    return null;
}


// Sayfa yüklendiğinde otomatik çalıştır
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSellerPages);
} else {
    initializeSellerPages();
}

async function initializeSellerPages() {
    const path = window.location.pathname;
    if (path.includes('/seller/')) {
        startSellerAutoSyncFallback();
        fetchAndApplyUzakMesafeSidebar();
        fetchAndApplyOwnCouriersSidebar();
    }
    
    let sellerId = getSellerIdFromUrl();
    
    if (!sellerId && path.includes('/seller/')) {
        try {
            const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
            const response = await fetch(`${baseUrl}/api/auth/me`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.user && data.user.sellerId) {
                    sellerId = data.user.sellerId;
                }
            }
        } catch (error) {}
    }
    
    // Sidebar linklerini güncelle
    if (sellerId) {
        updateSellerSidebarLinks(sellerId);
        const couponsLink = document.getElementById('sidebar-coupons-link');
        if (couponsLink) {
            couponsLink.href = `/seller/${sellerId}/coupons`;
        }
    }
    
    // Sidebar'da dükkan sahibi adını göster
    if (path.includes('/seller/')) {
        setTimeout(() => {
            updateSellerSidebarOwnerName();
        }, 100);
    }
    
    window.updateSellerSidebarOwnerName = updateSellerSidebarOwnerName;

    // Sidebar logout butonuna event listener ekle
    const sidebarLogoutBtn = document.getElementById('sidebar-logout-btn');
    if (sidebarLogoutBtn) {
        sidebarLogoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.logout) {
                window.logout();
            }
        });
    }

    if (path.includes('/seller/') && path.includes('/menu')) {
        initializeMenuPage();
    } else if (path.includes('/seller/') && path.includes('/earnings')) {
        initializeEarningsPage();
    } else if (path.includes('/seller/') && path.includes('/orders')) {
        initializeOrdersPage();
    } else if (path.includes('/seller/') && path.includes('/dashboard')) {
        initializeDashboardPage();
    } else if (path.includes('/seller/') && path.includes('/profile')) {
        initializeProfilePage();
        initializeOwnCouriersToggle();
    } else if (path.includes('/seller/') && path.includes('/coupons')) {
        initializeCouponsPage();
    } else if (path.includes('/seller/') && path.includes('/own-couriers')) {
        initializeOwnCouriersPage();
    } else {
        if (path.includes('menu.html') || document.querySelector('.menu-list')) {
            initializeMenuPage();
        } else if (path.includes('earnings.html') || document.querySelector('.period-selector')) {
            initializeEarningsPage();
        } else if (path.includes('orders.html') || document.querySelector('.tabs')) {
            initializeOrdersPage();
        } else if (path.includes('dashboard.html') || document.querySelector('#recent-orders-list')) {
            initializeDashboardPage();
        } else if (path.includes('profile.html') || document.querySelector('#seller-profile-form')) {
            initializeProfilePage();
        } else if (path.includes('coupons') || document.querySelector('#seller-coupon-form')) {
            initializeCouponsPage();
        }
    }
}

// ========== REAL-TIME SİPARİŞ TESLİMATI (SOCKET.IO) ==========

let sellerAutoSyncInterval = null;
let sellerKnownPendingOrderIds = new Set();
let sellerAutoSyncInitialized = false;

// Fallback polling (Eğer socket çalışmıyorsa 30 saniyede bir kontrol et)
async function runSellerAutoSync() {
    if (!window.location.pathname.includes('/seller')) return;
    if (document.hidden) return;
    if (window.__socketManager && window.__socketManager.isConnected()) return; // Socket bağlıysa polling atla

    try {
        const pendingOrders = await fetchSellerOrders('pending');
        const isOrdersPage = document.querySelector('.tabs') !== null;
        const isDashboardPage = document.querySelector('#recent-orders-list') !== null;
        const isEarningsPage = document.querySelector('#recent-orders-list-earnings') !== null;

        if (isDashboardPage) await loadDashboardPage();
        else if (isEarningsPage) await loadRecentOrdersForPanel();
        else if (isOrdersPage) {
            const activeTabBtn = document.querySelector('.tab-link.active');
            if (activeTabBtn) await loadOrdersForTab(activeTabBtn.getAttribute('data-tab'), true);
        }
    } catch (error) {}
}

function startSellerAutoSyncFallback() {
    if (sellerAutoSyncInterval) return;
    sellerAutoSyncInterval = setInterval(() => runSellerAutoSync().catch(() => {}), 30000); // 30s'e çekildi
}

// Merkezi socket entegrasyonu
function initSellerSocket() {
    if (!window.__socketManager) {
        setTimeout(initSellerSocket, 500);
        return;
    }
    
    // Fallback'i başlat
    startSellerAutoSyncFallback();

    window.__socketManager.on('new_order', async (orderData) => {
        window.__socketManager.notifyQueue('new_order', orderData);
        refreshSellerUI('new');
    });

    window.__socketManager.on('order_cancelled', async (orderData) => {
        window.__socketManager.notifyQueue('order_cancelled', orderData);
        // Her tabı yenile, iptal her sekmede olabilir
        refreshSellerUI('current');
    });

    window.__socketManager.on('order_status_updated', async (orderData) => {
        // Satıcı bir statü değişikliği alırsa (örn. kurye aldı) — ses çalma, sadece UI yenile
        refreshSellerUI('current');
    });

    window.__socketManager.on('uzak_mesafe_toggle', (data) => {
        window.__sellerUzakMesafeEnabled = !!data.enabled;
        if(typeof updateSidebarUzakMesafe === 'function') updateSidebarUzakMesafe(!!data.enabled);
    });

    window.__socketManager.on('own_courier_status_changed', (data) => {
        if (window.location.pathname.includes('/own-couriers') && typeof window.__reloadOwnCouriersList === 'function') {
            window.__reloadOwnCouriersList();
        }
    });
}

// UI Yenileme Fonksiyonu ("Yükleniyor" göstermeden gizlice günceller)
async function refreshSellerUI(targetTab) {
    const isOrdersPage = document.querySelector('.tabs') !== null; 
    const isDashboardPage = document.querySelector('#recent-orders-list') !== null;
    const isEarningsPage = document.querySelector('#recent-orders-list-earnings') !== null;
    
    if (isDashboardPage && typeof loadDashboardPage === 'function') {
        loadDashboardPage();
    }
    if (isEarningsPage && typeof loadRecentOrdersForPanel === 'function') {
        loadRecentOrdersForPanel();
    }
    if (isOrdersPage) {
        try {
            if (targetTab === 'new') {
                // Spesifik olarak 'new' sekmesini güncelle (Yeni sipariş geldi)
                await loadOrdersForTab('new', true);
            } else if (targetTab === 'current') {
                // Aktif görüntülenen sekmeyi güncelle
                const activeTabBtn = document.querySelector('.tab-link.active');
                if (activeTabBtn) {
                    await loadOrdersForTab(activeTabBtn.getAttribute('data-tab'), true);
                }
            } else {
                // Geçmiş davranış: pending'i yüklemeye çalış
                const tabContent = document.querySelector('.tab-content');
                if (tabContent) {
                    const orders = await fetchSellerOrders('new');
                    if (orders.length > 0) {
                        tabContent.innerHTML = '';
                        orders.forEach(order => tabContent.insertAdjacentHTML('beforeend', createOrderCardHTML(order)));
                        if(typeof attachOrderEventListeners === 'function') attachOrderEventListeners();
                    }
                }
            }
        } catch (error) {
            console.error('Sipariş listesi güncellenirken hata:', error);
        }
    }
}

// ═══════════════════════════════════════════════════════════
// ÇALIŞMA SAATLERİ EDITORU
// ═══════════════════════════════════════════════════════════

const SCHEDULE_DAYS = [
    { key: 'mon', label: 'Pazartesi' },
    { key: 'tue', label: 'Salı' },
    { key: 'wed', label: 'Çarşamba' },
    { key: 'thu', label: 'Perşembe' },
    { key: 'fri', label: 'Cuma' },
    { key: 'sat', label: 'Cumartesi' },
    { key: 'sun', label: 'Pazar' }
];

function parseWorkingHoursToSchedule(raw) {
    const defaults = {};
    SCHEDULE_DAYS.forEach(d => {
        defaults[d.key] = { enabled: d.key !== 'sun', open: '09:00', close: '21:00' };
    });

    if (!raw) return { days: defaults, autoToggle: false };

    let parsed = raw;
    if (typeof raw === 'string') {
        try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    }
    if (parsed && typeof parsed === 'object' && parsed.days) {
        const days = {};
        SCHEDULE_DAYS.forEach(d => {
            const v = parsed.days[d.key] || defaults[d.key];
            days[d.key] = {
                enabled: !!v.enabled,
                open: v.open || '09:00',
                close: v.close || '21:00'
            };
        });
        return { days, autoToggle: parsed.autoToggle !== false };
    }
    // Eski format ({ hours: "..." } veya plain text) — varsayılan çizelge, otomatik kapalı
    return { days: defaults, autoToggle: false };
}

function renderScheduleEditor(rawHours) {
    const container = document.getElementById('schedule-editor');
    if (!container) return;
    const data = parseWorkingHoursToSchedule(rawHours);
    container.innerHTML = SCHEDULE_DAYS.map(d => {
        const v = data.days[d.key];
        return `
            <div class="schedule-day-row" data-day="${d.key}" style="display:flex; align-items:center; gap:0.75rem; padding:0.5rem 0; border-bottom:1px solid var(--border-color, #e2e8f0);">
                <label style="flex:0 0 130px; display:flex; align-items:center; gap:0.4rem; cursor:pointer; margin:0;">
                    <input type="checkbox" class="day-enabled" ${v.enabled ? 'checked' : ''}>
                    <span>${d.label}</span>
                </label>
                <input type="time" class="day-open form-input" value="${v.open}" style="flex:1; max-width:120px;">
                <span style="color:#94a3b8;">—</span>
                <input type="time" class="day-close form-input" value="${v.close}" style="flex:1; max-width:120px;">
                <button type="button" class="btn btn-sm btn-secondary day-closed-btn" data-day="${d.key}" title="Bu gün kapalı">Kapalı</button>
            </div>
        `;
    }).join('');

    const autoCb = document.getElementById('schedule-auto-toggle');
    if (autoCb) autoCb.checked = data.autoToggle !== false;

    container.querySelectorAll('.day-closed-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const row = btn.closest('.schedule-day-row');
            const cb = row.querySelector('.day-enabled');
            cb.checked = false;
        });
    });
}

function collectScheduleData() {
    const container = document.getElementById('schedule-editor');
    if (!container) return null;
    const rows = container.querySelectorAll('.schedule-day-row');
    if (rows.length === 0) return null;
    const days = {};
    rows.forEach(row => {
        const key = row.dataset.day;
        const enabled = row.querySelector('.day-enabled').checked;
        const open = row.querySelector('.day-open').value || '09:00';
        const close = row.querySelector('.day-close').value || '21:00';
        days[key] = { enabled, open, close };
    });
    const autoCb = document.getElementById('schedule-auto-toggle');
    return {
        days,
        autoToggle: autoCb ? autoCb.checked : true
    };
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('/seller')) {
        initSellerSocket();
    }
});

// ═══════════════════════════════════════════════════════════
// KENDİ KURYE YÖNETİMİ MODAL & SAYFA FONKSİYONLARI
// ═══════════════════════════════════════════════════════════

// Kendi kuryesini atama modalı
async function showOwnCourierAssignModal(orderId) {
    const existing = document.getElementById('own-courier-assign-modal');
    if (existing) existing.remove();

    const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');

    // Kurye listesini çek
    let couriers = [];
    try {
        const res = await fetch(`${baseUrl}/api/seller/own-couriers`, { credentials: 'include' });
        const data = await res.json();
        if (data.success && data.couriers) couriers = data.couriers;
    } catch (e) {}

    const modal = document.createElement('div');
    modal.id = 'own-courier-assign-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10100;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';

    const onlineCouriers = couriers.filter(c => c.status === 'online');
    const offlineCouriers = couriers.filter(c => c.status !== 'online');

    let courierOptions = '';
    if (couriers.length === 0) {
        courierOptions = '<p style="color:#E74C3C; font-size:0.9rem;">Henüz kadronuzda kurye bulunmuyor. Kurye Yönetimi sayfasından kurye ekleyin.</p>';
    } else {
        courierOptions = '<select id="own-courier-select" style="width:100%;padding:0.6rem 0.75rem;border:1px solid #ddd;border-radius:8px;font-size:0.95rem;box-sizing:border-box;">';
        if (onlineCouriers.length > 0) {
            courierOptions += '<optgroup label="🟢 Çevrimiçi">';
            onlineCouriers.forEach(c => {
                courierOptions += `<option value="${c.id}">🟢 ${c.fullname} (${c.email})</option>`;
            });
            courierOptions += '</optgroup>';
        }
        if (offlineCouriers.length > 0) {
            courierOptions += '<optgroup label="⚫ Çevrimdışı">';
            offlineCouriers.forEach(c => {
                courierOptions += `<option value="${c.id}">⚫ ${c.fullname} (${c.email})</option>`;
            });
            courierOptions += '</optgroup>';
        }
        courierOptions += '</select>';
    }

    modal.innerHTML = `
        <div style="background:#fff;border-radius:12px;padding:2rem;min-width:320px;max-width:460px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
            <h3 style="margin:0 0 1rem 0;font-size:1.15rem;">🏍️ Kendi Kuryeni Seç</h3>
            <p style="font-size:0.9rem;color:#666;margin-bottom:1rem;">Sipariş <strong>#${orderId}</strong> için kurye seçin:</p>
            <div style="margin-bottom:1.5rem;">
                ${courierOptions}
            </div>
            <div style="display:flex;gap:0.75rem;justify-content:flex-end;">
                <button id="own-courier-cancel" class="btn btn-secondary">İptal</button>
                ${couriers.length > 0 ? '<button id="own-courier-confirm" class="btn btn-primary" style="background:#1565C0;border-color:#1565C0;">Kuryeyi Ata</button>' : ''}
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('own-courier-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    const confirmBtn = document.getElementById('own-courier-confirm');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            const selectedCourierId = document.getElementById('own-courier-select').value;
            if (!selectedCourierId) {
                alert('Lütfen bir kurye seçin.');
                return;
            }
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Atanıyor...';

            try {
                const res = await fetch(`${baseUrl}/api/orders/seller/assign-own-courier/${orderId}`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ courierId: parseInt(selectedCourierId) })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Kurye atanamadı');
                modal.remove();
                showSellerActionNotification('success', 'Kurye Atandı', data.message || `Sipariş #${orderId} kuryeye atandı.`);
                // Kurye atandıktan sonra on_delivery olur → 'shipped' tabı yenile
                await loadOrdersForTab('preparing');
                await loadOrdersForTab('shipped');
                await loadOrdersForTab('new');
            } catch (err) {
                showSellerActionNotification('error', 'Kurye Atama Hatası', err.message);
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Kuryeyi Ata';
            }
        });
    }
}

// Kurye Yönetimi sayfası
async function initializeOwnCouriersPage() {
    const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
    const listEl = document.getElementById('own-couriers-list');
    const addBtn = document.getElementById('add-own-courier-btn');
    const emailInput = document.getElementById('own-courier-email');
    const statusEl = document.getElementById('own-courier-status');

    if (!listEl) return;

    async function loadCouriers(silent = false) {
        if (!silent) {
            listEl.innerHTML = '<p style="text-align:center;padding:1rem;color:#666;">Yükleniyor...</p>';
        }
        try {
            const res = await fetch(`${baseUrl}/api/seller/own-couriers`, { credentials: 'include' });
            const data = await res.json();
            if (!data.success || !data.hasOwnCouriers) {
                listEl.innerHTML = '<p style="text-align:center;padding:2rem;color:#999;">Önce profil sayfasından "Kendi Kuryem Var" seçeneğini aktifleştirin.</p>';
                return;
            }
            if (data.couriers.length === 0) {
                listEl.innerHTML = '<p style="text-align:center;padding:2rem;color:#999;">Henüz kadronuzda kurye yok. Aşağıdan e-posta ile kurye ekleyin.</p>';
                return;
            }
            listEl.innerHTML = data.couriers.map(c => `
                <div class="card" style="padding:1rem;margin-bottom:0.75rem;display:flex;align-items:center;justify-content:space-between;border-radius:10px;">
                    <div>
                        <strong>${c.fullname}</strong>
                        <span style="color:#888;font-size:0.85rem;margin-left:6px;">${c.email}</span>
                        ${c.phone ? `<span style="color:#888;font-size:0.85rem;margin-left:6px;">📞 ${c.phone}</span>` : ''}
                        <span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:12px;font-size:0.8rem;font-weight:600;${c.status === 'online' ? 'background:#e8f5e9;color:#2e7d32;' : 'background:#fafafa;color:#999;'}">${c.status === 'online' ? '🟢 Aktif' : '⚫ Çevrimdışı'}</span>
                    </div>
                    <button class="btn btn-danger btn-sm remove-own-courier-btn" data-courier-id="${c.id}" data-courier-name="${c.fullname}" style="white-space:nowrap;">Çıkar</button>
                </div>
            `).join('');

            // Çıkarma butonları
            listEl.querySelectorAll('.remove-own-courier-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const cId = e.target.getAttribute('data-courier-id');
                    const cName = e.target.getAttribute('data-courier-name');
                    const confirmed = window.showConfirm ? await window.showConfirm(`${cName} kuryesini kadronuzdan çıkarmak istediğinize emin misiniz?`) : confirm(`${cName} kuryesini kadronuzdan çıkarmak istediğinize emin misiniz?`);
                    if (!confirmed) return;
                    try {
                        const res = await fetch(`${baseUrl}/api/seller/own-couriers/${cId}`, { method: 'DELETE', credentials: 'include' });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.message || 'Hata');
                        showSellerActionNotification('success', 'Kurye Çıkarıldı', data.message || `${cName} kadrodan çıkarıldı.`);
                        loadCouriers();
                    } catch (err) {
                        showSellerActionNotification('error', 'Hata', err.message);
                    }
                });
            });
        } catch (err) {
            listEl.innerHTML = '<p style="text-align:center;padding:2rem;color:#E74C3C;">Kurye listesi yüklenemedi.</p>';
        }
    }
    
    window.__reloadOwnCouriersList = () => loadCouriers(true);

    if (addBtn) {
        addBtn.addEventListener('click', async () => {
            const email = emailInput?.value?.trim();
            if (!email) {
                if (statusEl) statusEl.textContent = 'E-posta adresi girin.';
                return;
            }
            addBtn.disabled = true;
            addBtn.textContent = 'Ekleniyor...';
            if (statusEl) statusEl.textContent = '';
            try {
                const res = await fetch(`${baseUrl}/api/seller/own-couriers`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Kurye eklenemedi');
                showSellerActionNotification('success', 'Kurye Eklendi', data.message);
                emailInput.value = '';
                loadCouriers();
            } catch (err) {
                showSellerActionNotification('error', 'Hata', err.message);
                if (statusEl) statusEl.textContent = err.message;
            } finally {
                addBtn.disabled = false;
                addBtn.textContent = 'Kurye Ekle';
            }
        });
    }

    loadCouriers();
}
window.initializeOwnCouriersPage = initializeOwnCouriersPage;

// Profil sayfasında hasOwnCouriers toggle desteği
function initializeOwnCouriersToggle() {
    const toggle = document.getElementById('has-own-couriers-toggle');
    if (!toggle) return;

    // Mevcut durumu yükle
    fetchAndApplyUzakMesafeSidebar().then(() => {
        // __sellerProfile'dan alınıyor
    });

    const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');

    fetch(`${baseUrl}/api/seller/profile`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
            if (data.success && data.profile) {
                toggle.checked = !!data.profile.hasOwnCouriers;
                updateOwnCouriersSidebar(!!data.profile.hasOwnCouriers);
            }
        })
        .catch(() => {});

    toggle.addEventListener('change', async () => {
        try {
            const res = await fetch(`${baseUrl}/api/seller/profile`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hasOwnCouriers: toggle.checked })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Güncelleme başarısız');
            updateOwnCouriersSidebar(toggle.checked);
            showSellerActionNotification('success', 'Güncellendi', toggle.checked ? 'Kendi kurye özelliği aktifleştirildi.' : 'Kendi kurye özelliği kapatıldı.');
        } catch (err) {
            toggle.checked = !toggle.checked;
            showSellerActionNotification('error', 'Hata', err.message);
        }
    });
}
window.initializeOwnCouriersToggle = initializeOwnCouriersToggle;

function updateOwnCouriersSidebar(enabled) {
    const li = document.getElementById('sidebar-own-couriers-li');
    if (li) li.style.display = enabled ? 'block' : 'none';
}
window.updateOwnCouriersSidebar = updateOwnCouriersSidebar;

// Sayfa yüklendiğinde sidebar durumunu güncelle
async function fetchAndApplyOwnCouriersSidebar(baseUrl) {
    try {
        baseUrl = baseUrl || (window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : ''));
        const res = await fetch(`${baseUrl}/api/seller/profile`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.profile) {
            window.__sellerHasOwnCouriers = !!data.profile.hasOwnCouriers;
            updateOwnCouriersSidebar(!!data.profile.hasOwnCouriers);
        }
    } catch (e) {}
}
window.fetchAndApplyOwnCouriersSidebar = fetchAndApplyOwnCouriersSidebar;
