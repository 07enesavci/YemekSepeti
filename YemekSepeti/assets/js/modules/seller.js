// Satıcı modülü: menü, sipariş, kazanç, profil, kuponlar
// Base URL ve kimlikli istekler window yardımcılarından alınır

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
    const menuListContainer = document.querySelector('.menu-list');
    if (!menuListContainer) {
        return;
    }
    menuListContainer.innerHTML = '<p>Yükleniyor...</p>';
    try {
        const menu = await fetchSellerMenu();
        menuListContainer.innerHTML = '';

        if (menu.length === 0) {
            menuListContainer.innerHTML = '<p style="text-align: center; padding: 2rem; color: #666;">Henüz menü eklenmemiş. Yeni yemek eklemek için yukarıdaki butona tıklayın.</p>';
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
                totalWithdrawnEl.textContent = `${stats.completedOrders} tamamlanan`;
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
    
    let actionButtons = '';
    if (order.status === 'pending' || order.status === 'confirmed') {
        actionButtons = `
            <button class="btn btn-secondary reject-order-btn" data-order-id="${order.id}">Reddet</button>
            <button class="btn btn-primary accept-order-btn" data-order-id="${order.id}">Onayla ve Hazırlamaya Başla</button>
        `;
    } else if (order.status === 'preparing') {
        actionButtons = `
            <button class="btn btn-primary ready-order-btn" data-order-id="${order.id}">Kuryeye Hazır Olduğunu Bildir</button>
        `;
    } else if (order.status === 'ready' && !order.courierId) {
        actionButtons = `
            <button class="btn btn-primary assign-courier-btn" data-order-id="${order.id}">Kuryeye Bildir</button>
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
                ${order.courierId && order.courierName ? `<p><strong>Kurye:</strong> ${order.courierName} (ID: ${order.courierId})</p>` : ''}
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
            try {
                await updateOrderStatus(orderId, 'preparing');
                showSellerActionNotification('success', 'Sipariş Onaylandı', '#' + orderId + ' hazırlanmaya alındı.');
                await loadOrdersForTab('new');
                await loadOrdersForTab('preparing');
            } catch (error) {
                showSellerActionNotification('error', 'İşlem Başarısız', error.message || 'Sipariş güncellenemedi.');
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
            try {
                await updateOrderStatus(orderId, 'ready');
                showSellerActionNotification('success', 'Kurye Çağrısı Hazır', '#' + orderId + ' için kurye çağrısı yapılabilir.');
                await loadOrdersForTab('preparing');
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
                button.textContent = 'Kuryeye Bildir';
            }
        });
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

    // Dikkat çekici ses: başarılı işlemde kısa zil, hata/rette alarm tonu
    playOrderSound(isError ? 'cancel' : 'new');

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
        let hoursValue = profile.workingHours || '';
        if (hoursValue && typeof hoursValue === 'object') {
            hoursValue = JSON.stringify(hoursValue, null, 2);
        }
        if (hoursInput) hoursInput.value = hoursValue;
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
                    finalLogoUrl = logoUrlInput && logoUrlInput.value.trim() !== '' ? logoUrlInput.value.trim() : null;
                }
                if (bannerOptionUrl && bannerOptionUrl.checked) {
                    finalBannerUrl = bannerUrlInput && bannerUrlInput.value.trim() !== '' ? bannerUrlInput.value.trim() : null;
                }
                
                const profileData = {
                    fullname: fullnameInput?.value || '',
                    email: emailInput?.value || '',
                    shopName: shopNameInput?.value || '',
                    description: descriptionInput?.value || '',
                    location: locationInput?.value || '',
                    workingHours: hoursInput?.value && hoursInput.value.trim() !== '' ? hoursInput.value : undefined,
                    deliveryRadiusKm: radiusSlider ? parseInt(radiusSlider.value) || 0 : undefined
                };
                
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
                        <button class="btn btn-sm delete-coupon-btn" data-id="${coupon.id}" style="padding: 0.35rem 0.85rem; font-size: 0.85rem; background-color: #E74C3C !important; color: white !important; border: none; border-radius: 4px; cursor: pointer; transition: background-color 0.2s;">SİL</button>
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
    
    // Kupon Silme Listener'ı
    const container = document.getElementById('seller-coupon-list-container');
    if (container) {
        container.addEventListener('click', async (e) => {
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
                    return;
                }
            }
        } catch (dashboardError) {}
        try {
            const response = await fetch(`${baseUrl}/api/seller/profile`, { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.profile && data.profile.fullname) {
                    ownerNameEl.textContent = data.profile.fullname;
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

const PAGE_NAMES = ['dashboard', 'orders', 'menu', 'earnings', 'profile', 'coupons'];

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
    } else if (path.includes('/seller/') && path.includes('/coupons')) {
        initializeCouponsPage();
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
function initializeSellerRealTimeUpdates() {
    if (!window.location.pathname.includes('/seller')) return;
    startSellerAutoSyncFallback();
    // Production proxy/WebSocket sorunlarında ana akış polling fallback ile ilerler.
    // Socket bağlantısı opsiyoneldir; gerektiğinde tekrar açılabilir.
    const ENABLE_SELLER_SOCKET = false;
    if (!ENABLE_SELLER_SOCKET) return;
    
    // Socket.IO client library'yi bekle
    let retries = 0;
    const maxRetries = 50;
    
    const waitForIO = setInterval(() => {
        retries++;
        if (typeof io !== 'undefined') {
            clearInterval(waitForIO);
            unlockNotificationAudio();
            connectSellerSocket();
        } else if (retries >= maxRetries) {
            clearInterval(waitForIO);
            console.error('Socket.IO library yüklenemedi');
        }
    }, 100);
}

let sellerAutoSyncInterval = null;
let sellerKnownPendingOrderIds = new Set();
let sellerAutoSyncInitialized = false;

function normalizeSellerOrderForNotification(order) {
    if (!order) return null;
    return {
        id: order.id,
        orderNumber: order.orderNumber || order.order_number || ('#' + (order.id || '')),
        buyerName: order.customer || order.buyerName || 'Müşteri',
        totalAmount: (order.total != null ? order.total : (order.totalAmount != null ? order.totalAmount : 0))
    };
}

async function runSellerAutoSync() {
    if (!window.location.pathname.includes('/seller')) return;
    if (document.hidden) return;

    try {
        const pendingOrders = await fetchSellerOrders('pending');
        const latestIds = new Set((pendingOrders || []).map(function(order) { return Number(order.id); }).filter(Boolean));

        if (!sellerAutoSyncInitialized) {
            sellerKnownPendingOrderIds = latestIds;
            sellerAutoSyncInitialized = true;
        } else {
            (pendingOrders || []).forEach(function(order) {
                const id = Number(order.id);
                if (!id) return;
                if (!sellerKnownPendingOrderIds.has(id)) {
                    const orderData = normalizeSellerOrderForNotification(order);
                    if (orderData) showOrderNotification(orderData);
                }
            });
            sellerKnownPendingOrderIds = latestIds;
        }

        const isOrdersPage = document.querySelector('.tabs') !== null;
        const isDashboardPage = document.querySelector('#recent-orders-list') !== null;
        const isEarningsPage = document.querySelector('#recent-orders-list-earnings') !== null;

        if (isDashboardPage) {
            await loadDashboardPage();
        } else if (isEarningsPage) {
            await loadRecentOrdersForPanel();
        } else if (isOrdersPage) {
            const activeTabBtn = document.querySelector('.tab-link.active');
            if (activeTabBtn) {
                const currentTab = activeTabBtn.getAttribute('data-tab');
                if (typeof loadOrdersForTab === 'function') {
                    await loadOrdersForTab(currentTab, true);
                }
            }
        }
    } catch (error) {}
}

function startSellerAutoSyncFallback() {
    if (sellerAutoSyncInterval) return;
    runSellerAutoSync().catch(function() {});
    sellerAutoSyncInterval = setInterval(function() {
        runSellerAutoSync().catch(function() {});
    }, 3000);
}

async function resolveSellerUserId() {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/auth/me`, { credentials: 'include' });
        if (!response.ok) throw new Error('auth me failed');
        const data = await response.json();
        const fallbackUserId = data?.user?.id;
        if (fallbackUserId) {
            window.currentUserId = fallbackUserId;
            if (window.sessionStorage) {
                window.sessionStorage.setItem('userId', String(fallbackUserId));
            }
            return String(fallbackUserId);
        }
    } catch (error) {}

    const directUserId = window.currentUserId ||
        (window.sessionStorage && window.sessionStorage.getItem('userId')) ||
        document.querySelector('[data-user-id]')?.dataset.userId;

    if (directUserId && directUserId !== 'unknown') {
        return String(directUserId);
    }

    return null;
}

async function connectSellerSocket() {
    if (window.sellerSocket) return;
    
    try {
        const userId = await resolveSellerUserId();
        if (!userId) {
            console.warn('Socket.IO için userId alınamadı, tekrar denenecek');
            setTimeout(() => connectSellerSocket(), 1200);
            return;
        }
        
        if (typeof io === 'undefined') {
            console.error('Socket.IO client library yüklenmedi');
            return;
        }
        
        window.sellerSocket = (typeof window.createAppSocket === 'function' ? window.createAppSocket({
            query: { userId },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
            transports: ['polling'],
            upgrade: false
        }) : io({
            query: { userId },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
            transports: ['polling'],
            upgrade: false
        }));

        if (!window.sellerSocket) {
            console.error('Socket.IO başlatılamadı (client hazır değil)');
            return;
        }

        window.sellerSocket.on('connect', () => {
            console.log('Socket.IO bağlantısı kuruldu');
        });

        window.sellerSocket.on('new_order', async (orderData) => {
            console.log('Yeni sipariş geldi:', orderData);
            
            const isOrdersPage = document.querySelector('.tabs') !== null; 
            const isDashboardPage = document.querySelector('#recent-orders-list') !== null;
            const isEarningsPage = document.querySelector('#recent-orders-list-earnings') !== null;
            
            showOrderNotification(orderData);
            
            // Dashboard'da ise tüm sayfayı yenile
            if (isDashboardPage) {
                loadDashboardPage().catch((error) => {
                    console.error('Dashboard yenilenmesi hatası:', error);
                });
            }
            // Kazanç sayfasında Son Gelen Siparişler'i yenile
            if (isEarningsPage) {
                loadRecentOrdersForPanel().catch((error) => {
                    console.error('Son siparişler yenilenmesi hatası:', error);
                });
            }
            
            // Orders sayfasında ise siparişleri yenile
            if (isOrdersPage) {
                try {
                    const tabContent = document.querySelector('.tab-content');
                    if (tabContent) {
                        const orders = await fetchSellerOrders('pending');
                        if (orders.length > 0) {
                            tabContent.innerHTML = '';
                            orders.forEach(order => {
                                tabContent.insertAdjacentHTML('beforeend', createOrderCardHTML(order));
                            });
                            attachOrderEventListeners();
                        }
                    }
                } catch (error) {
                    console.error('Orders listesi güncellenirken hata:', error);
                }
            } 
            
        });

        // Sipariş iptal edildiğinde
        window.sellerSocket.on('order_cancelled', async (orderData) => {
            console.log('Sipariş iptal edildi:', orderData);
            
            const isOrdersPage = document.querySelector('.tabs') !== null; 
            const isDashboardPage = document.querySelector('#recent-orders-list') !== null;
            const cancelledBy = orderData.cancelledBy === 'buyer' ? 'Müşteri' : 'Satıcı';
            
            showCancelNotification(orderData, cancelledBy);
            
            // Dashboard'da ise tüm sayfayı yenile
            if (isDashboardPage) {
                loadDashboardPage().catch((error) => {
                    console.error('Dashboard yenilenmesi hatası:', error);
                });
            }
            
            // Orders sayfasında ise siparişleri yenile
            if (isOrdersPage) {
                try {
                    const tabContent = document.querySelector('.tab-content');
                    if (tabContent) {
                        const orders = await fetchSellerOrders('pending');
                        if (orders.length > 0) {
                            tabContent.innerHTML = '';
                            orders.forEach(order => {
                                tabContent.insertAdjacentHTML('beforeend', createOrderCardHTML(order));
                            });
                            attachOrderEventListeners();
                        } else {
                            tabContent.innerHTML = '<p style="text-align: center; padding: 2rem; color: #666;">Henüz sipariş yok</p>';
                        }
                    }
                } catch (error) {
                    console.error('İptal edilen sipariş güncellenirken hata:', error);
                }
            }
            
        });

        window.sellerSocket.on('connect_error', (error) => {
            console.error('Socket.IO bağlantı hatası:', error.message);
        });

        window.sellerSocket.on('disconnect', (reason) => {
            console.log('Socket.IO bağlantısı kesildi:', reason);
        });

    } catch (error) {
        console.error('Socket.IO başlatma hatası:', error);
    }
}

function showOrderNotification(orderData) {
    // Toast notification göster
    const notification = document.createElement('div');
    notification.className = 'order-notification-toast';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 14px;
        animation: slideIn 0.3s ease-out;
        font-weight: 500;
        max-width: 400px;
    `;
    
    notification.innerHTML = `
        <span style="font-size: 20px;">🔔</span>
        <div style="flex: 1;">
            <strong>${orderData.orderNumber}</strong><br>
            <small>${orderData.buyerName} - ${orderData.totalAmount} TL</small>
        </div>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0;">×</button>
    `;
    
    // CSS Animation ekleme
    if (!document.querySelector('style[data-notification-style]')) {
        const style = document.createElement('style');
        style.setAttribute('data-notification-style', '');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Ses çal (yeni sipariş - bell sound)
    playOrderSound('new');
    
    // 6 saniye sonra otomatik kapatılsın
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 6000);
}

function showCancelNotification(orderData, cancelledBy) {
    const notification = document.createElement('div');
    notification.className = 'order-notification-toast';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f44336;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 14px;
        animation: slideIn 0.3s ease-out;
        font-weight: 500;
        max-width: 400px;
    `;
    
    notification.innerHTML = `
        <span style="font-size: 20px;">🚫</span>
        <div style="flex: 1;">
            <strong>Sipariş İptal Edildi</strong><br>
            <small>${orderData.orderNumber} - ${cancelledBy} tarafından</small>
        </div>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0;">×</button>
    `;
    
    document.body.appendChild(notification);
    
    // Ses çal (iptal - alarm sound)
    playOrderSound('cancel');
    
    // 6 saniye sonra otomatik kapatılsın
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 6000);
}

function playOrderSound(type) {
    try {
        if (!notificationAudioUnlocked) {
            pendingSoundType = type;
            attachAudioUnlockListeners();
            playSpeechFallback(type);
            return;
        }
        const context = getNotificationAudioContext();
        if (!context) {
            playSpeechFallback(type);
            return;
        }

        if (context.state !== 'running') {
            pendingSoundType = type;
            attachAudioUnlockListeners();
            playSpeechFallback(type);
            context.resume().then(() => {
                const queuedType = pendingSoundType;
                pendingSoundType = null;
                if (queuedType) {
                    playOrderSound(queuedType);
                }
            }).catch(() => {});
            return;
        }
        
        if (type === 'new') {
            const start = context.currentTime;
            const osc1 = context.createOscillator();
            const gain1 = context.createGain();
            osc1.frequency.value = 880;
            osc1.type = 'triangle';
            osc1.connect(gain1);
            gain1.connect(context.destination);
            gain1.gain.setValueAtTime(0.0001, start);
            gain1.gain.exponentialRampToValueAtTime(0.85, start + 0.02);
            gain1.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
            osc1.start(start);
            osc1.stop(start + 0.30);

            const osc2 = context.createOscillator();
            const gain2 = context.createGain();
            osc2.frequency.value = 1174;
            osc2.type = 'triangle';
            osc2.connect(gain2);
            gain2.connect(context.destination);
            gain2.gain.setValueAtTime(0.0001, start + 0.18);
            gain2.gain.exponentialRampToValueAtTime(0.75, start + 0.22);
            gain2.gain.exponentialRampToValueAtTime(0.0001, start + 0.75);
            osc2.start(start + 0.18);
            osc2.stop(start + 0.78);
        } else if (type === 'cancel') {
            const start = context.currentTime;
            const freqs = [420, 320, 420, 320];
            freqs.forEach((frequency, index) => {
                const beepStart = start + (index * 0.24);
                const osc = context.createOscillator();
                const gain = context.createGain();
                osc.frequency.value = frequency;
                osc.type = 'sawtooth';
                osc.connect(gain);
                gain.connect(context.destination);
                gain.gain.setValueAtTime(0.0001, beepStart);
                gain.gain.exponentialRampToValueAtTime(0.9, beepStart + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.0001, beepStart + 0.20);
                osc.start(beepStart);
                osc.stop(beepStart + 0.22);
            });
        }
    } catch (error) {
        console.error('Ses çalma hatası:', error);
        playSpeechFallback(type);
    }
}

let notificationAudioContext = null;
let notificationAudioUnlocked = false;
let pendingSoundType = null;
let audioUnlockListenersAttached = false;
let lastSpeechAt = 0;

function getNotificationAudioContext() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
        console.warn('Web Audio API bu tarayıcıda desteklenmiyor');
        return null;
    }

    if (!notificationAudioContext) {
        notificationAudioContext = new AudioContext();
    }

    return notificationAudioContext;
}

function unlockNotificationAudio() {
    attachAudioUnlockListeners();
}

function attachAudioUnlockListeners() {
    if (audioUnlockListenersAttached) return;
    audioUnlockListenersAttached = true;

    const unlock = () => {
        const context = getNotificationAudioContext();
        if (context && context.state !== 'running') {
            context.resume().catch(() => {});
        }
        
        if (context && context.state === 'running') {
            notificationAudioUnlocked = true;
            if (pendingSoundType) {
                const queuedType = pendingSoundType;
                pendingSoundType = null;
                playOrderSound(queuedType);
            }
        }
    };

    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
    document.addEventListener('touchstart', unlock, true);
    window.addEventListener('focus', unlock);
}

function playSpeechFallback(type) {
    try {
        const synth = window.speechSynthesis;
        if (!synth) return;

        const now = Date.now();
        if (now - lastSpeechAt < 800) return;
        lastSpeechAt = now;

        const utterance = new SpeechSynthesisUtterance(
            type === 'cancel' ? 'Sipariş iptal edildi' : 'Yeni sipariş geldi'
        );
        utterance.lang = 'tr-TR';
        utterance.rate = type === 'cancel' ? 1.0 : 1.1;
        utterance.pitch = type === 'cancel' ? 0.8 : 1.2;
        utterance.volume = 1;

        synth.cancel();
        synth.speak(utterance);
    } catch (error) {}
}

// Satıcı sayfası yüklendiğinde Socket.IO bağlantısını başlat
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('/seller')) {
        initializeSellerRealTimeUpdates();
    }
});

// Sayfa navigasyon sırasında da başlat (single page app içim)
window.addEventListener('load', () => {
    if (window.location.pathname.includes('/seller')) {
        setTimeout(() => initializeSellerRealTimeUpdates(), 500);
    }
});


