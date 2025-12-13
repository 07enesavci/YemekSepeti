// =================================================================
// SELLER API FONKSİYONLARI
// =================================================================

// getApiBaseUrl fonksiyonu api.js'de window.getApiBaseUrl olarak tanımlı
// Direkt olarak window.getApiBaseUrl() kullanıyoruz

// =================================================================
// MENU YÖNETİMİ
// =================================================================

/**
 * Satıcının menüsünü backend'den çek
 */
async function fetchSellerMenu() {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        console.log('📡 Menü API çağrısı yapılıyor:', `${baseUrl}/api/seller/menu`);
        const response = await fetch(`${baseUrl}/api/seller/menu`, {
            credentials: 'include'
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API hatası:', response.status, errorText);
            throw new Error(`Menü yüklenemedi: ${response.status}`);
        }
        const data = await response.json();
        console.log('✅ Menü API yanıtı:', data);
        return data.success ? data.menu : [];
    } catch (error) {
        console.error('❌ Menü yükleme hatası:', error);
        return [];
    }
}

/**
 * Yeni yemek ekle
 */
// Global fonksiyonlar (modal'dan erişim için)
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
        console.error('Yemek ekleme hatası:', error);
        throw error;
    }
}

/**
 * Yemek güncelle
 */
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
        console.error('Yemek güncelleme hatası:', error);
        throw error;
    }
}

/**
 * Yemek sil
 */
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
        console.error('Yemek silme hatası:', error);
        throw error;
    }
}

// =================================================================
// KAZANÇ RAPORLARI
// =================================================================

/**
 * Kazanç istatistiklerini backend'den çek
 */
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
        console.error('Kazanç raporları yükleme hatası:', error);
        return null;
    }
}

// =================================================================
// MENU SAYFASI İŞLEVLERİ
// =================================================================

function createMealCardHTML(meal) {
    let imageUrl = meal.imageUrl || '';
    console.log('🖼️ createMealCardHTML - Meal:', meal.name, 'imageUrl:', imageUrl);
    
    // Eğer imageUrl varsa ve relative path ise cache-busting ekle
    if (imageUrl && imageUrl.trim() !== '') {
        // Placeholder kontrolü
        if (imageUrl.includes('via.placeholder.com') || 
            imageUrl.includes('placeholder.com') ||
            imageUrl.includes('400x200.png') ||
            imageUrl.includes('250x150.png')) {
            imageUrl = '';
        } else {
            // Relative path kontrolü - /uploads/ ile başlıyorsa base URL ekle
            if (imageUrl.startsWith('/uploads/')) {
                const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                imageUrl = baseUrl + imageUrl;
            }
            // Cache-busting için timestamp ekle
            const separator = imageUrl.includes('?') ? '&' : '?';
            imageUrl = imageUrl + separator + '_t=' + Date.now();
        }
    }
    
    const statusClass = meal.isAvailable ? 'active' : 'inactive';
    const statusText = meal.isAvailable ? 'Satışta' : 'Satışta Değil';
    
    // HTML escape için güvenli isim
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
                <span class="status-dot ${statusClass}">${statusText}</span>
            </div>
            <div class="menu-item-price">
                ${parseFloat(meal.price || 0).toFixed(2)} TL
            </div>
            <div class="menu-item-actions">
                <button class="btn btn-secondary btn-sm edit-meal-btn" data-meal-id="${meal.id}">Düzenle</button>
                <button class="btn btn-danger btn-sm delete-meal-btn" data-meal-id="${meal.id}">Sil</button>
            </div>
        </div>
    `;
}

async function loadMenuPage() {
    console.log('📋 loadMenuPage() çağrıldı');
    const menuListContainer = document.querySelector('.menu-list');
    if (!menuListContainer) {
        console.error('❌ .menu-list container bulunamadı!');
        return;
    }

    console.log('⏳ Menü yükleniyor...');
    menuListContainer.innerHTML = '<p>Yükleniyor...</p>';

    try {
        const menu = await fetchSellerMenu();
        console.log('📦 Menü verisi alındı:', menu.length, 'item');
        console.log('📦 Menü verisi detay:', menu.map(m => ({ id: m.id, name: m.name, imageUrl: m.imageUrl })));
        menuListContainer.innerHTML = '';

        if (menu.length === 0) {
            menuListContainer.innerHTML = '<p style="text-align: center; padding: 2rem; color: #666;">Henüz menü eklenmemiş. Yeni yemek eklemek için yukarıdaki butona tıklayın.</p>';
            return;
        }

        menu.forEach(meal => {
            menuListContainer.insertAdjacentHTML('beforeend', createMealCardHTML(meal));
        });

        console.log('✅ Menü render edildi, event listener\'lar ekleniyor...');
        // Event listener'ları ekle
        attachMenuEventListeners();
        console.log('✅ Menü sayfası yükleme tamamlandı');
    } catch (error) {
        menuListContainer.innerHTML = '<p style="text-align: center; padding: 2rem; color: #E74C3C;">Menü yüklenirken hata oluştu.</p>';
        console.error('❌ Menü yükleme hatası:', error);
    }
}

function attachMenuEventListeners() {
    // Sil butonları
    document.querySelectorAll('.delete-meal-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const mealId = parseInt(e.target.getAttribute('data-meal-id'));
            if (!confirm('Bu yemeği silmek istediğinize emin misiniz?')) return;

            try {
                await deleteMeal(mealId);
                e.target.closest('.menu-list-item').remove();
                alert('Yemek başarıyla silindi.');
            } catch (error) {
                alert('Yemek silinirken hata oluştu: ' + error.message);
            }
        });
    });

    // Düzenle butonları
    document.querySelectorAll('.edit-meal-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const mealId = parseInt(e.target.getAttribute('data-meal-id'));
            // Yemek bilgilerini API'den çek
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

    // Yeni yemek ekle butonu
    const addMealBtn = document.getElementById('add-new-meal-btn');
    if (addMealBtn) {
        // Önceki event listener'ı kaldır (varsa)
        const newAddMealBtn = addMealBtn.cloneNode(true);
        addMealBtn.parentNode.replaceChild(newAddMealBtn, addMealBtn);
        
        newAddMealBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('➕ Yeni yemek ekle butonuna tıklandı');
            
            // Modal'ı yükle (eğer yoksa)
            if (!document.getElementById('meal-modal')) {
                console.log('📦 Modal oluşturuluyor...');
                if (window.createMealModal) {
                    window.createMealModal();
                } else {
                    console.error('❌ createMealModal fonksiyonu bulunamadı');
                    alert('Modal yükleniyor... Lütfen sayfayı yenileyin.');
                    return;
                }
            }
            
            // Modal'ı aç
            if (window.openAddMealModal) {
                console.log('✅ Modal açılıyor...');
                window.openAddMealModal();
            } else {
                console.error('❌ openAddMealModal fonksiyonu bulunamadı');
                alert('Modal açılamadı. Lütfen sayfayı yenileyin.');
            }
        });
    } else {
        console.warn('⚠️ add-new-meal-btn bulunamadı');
    }
}

function initializeMenuPage() {
    loadMenuPage();
}

// =================================================================
// EARNINGS SAYFASI İŞLEVLERİ
// =================================================================

async function loadEarningsPage() {
    const periodButtons = document.querySelectorAll('.period-btn');
    let currentPeriod = 'month';

    // Period butonlarına event listener ekle
    periodButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const period = e.target.getAttribute('data-period') || 'month';
            currentPeriod = period;
            
            // Aktif butonu güncelle
            periodButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            await updateEarningsStats(period);
        });
    });

    // İlk yükleme
    await updateEarningsStats(currentPeriod);
}

async function updateEarningsStats(period = 'month') {
    try {
        const earnings = await fetchSellerEarnings(period);
        
        if (!earnings || !earnings.stats) {
            console.error('Kazanç verisi alınamadı');
            const transactionList = document.querySelector('.transaction-list');
            if (transactionList) {
                transactionList.innerHTML = '<p style="text-align: center; padding: 2rem; color: #666;">Veri yüklenemedi.</p>';
            }
            return;
        }

        const stats = earnings.stats;

        // İstatistikleri güncelle
        const statCards = document.querySelectorAll('.stat-card');
        if (statCards.length >= 3) {
            // Toplam Bakiye (delivered siparişlerin toplam kazancı)
            const totalBalanceEl = statCards[0].querySelector('.stat-value');
            if (totalBalanceEl) {
                totalBalanceEl.textContent = `${stats.totalEarnings.toFixed(2)} TL`;
            }

            // Beklemede Olan (pending/confirmed/preparing siparişler)
            const pendingEl = statCards[1].querySelector('.stat-value');
            if (pendingEl) {
                const pendingAmount = stats.totalOrders - stats.completedOrders;
                pendingEl.textContent = `${pendingAmount} sipariş`;
            }

            // Toplam Çekilen (tamamlanan siparişler)
            const totalWithdrawnEl = statCards[2].querySelector('.stat-value');
            if (totalWithdrawnEl) {
                totalWithdrawnEl.textContent = `${stats.completedOrders} tamamlanan`;
            }
        }

        // Son işlemler listesini güncelle
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
        console.error('Kazanç istatistikleri güncelleme hatası:', error);
        const transactionList = document.querySelector('.transaction-list');
        if (transactionList) {
            transactionList.innerHTML = '<p style="text-align: center; padding: 2rem; color: #E74C3C;">Veri yüklenirken hata oluştu.</p>';
        }
    }
}

function initializeEarningsPage() {
    loadEarningsPage();
}

// =================================================================
// ORDERS SAYFASI İŞLEVLERİ
// =================================================================

/**
 * Satıcının siparişlerini backend'den çek
 */
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
        console.error('Siparişler yükleme hatası:', error);
        return [];
    }
}

/**
 * Sipariş durumunu güncelle
 */
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
        console.error('Sipariş durumu güncelleme hatası:', error);
        throw error;
    }
}

function createOrderCardHTML(order) {
    const statusClass = order.status === 'delivered' ? 'delivered' : 
                       order.status === 'cancelled' ? 'cancelled' : '';
    
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
        // Hazır durumunda ve henüz kuryeye atanmamış siparişler için
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
    
    // Tab butonlarına event listener ekle
    tabs.forEach(tab => {
        tab.addEventListener('click', async (e) => {
            e.preventDefault();
            const tabName = e.target.getAttribute('data-tab');
            currentTab = tabName;
            
            // Aktif tab'ı güncelle
            tabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            
            // Tab içeriklerini göster/gizle
            tabContents.forEach(content => {
                if (content.id === tabName) {
                    content.style.display = 'block';
                    content.classList.add('active');
                } else {
                    content.style.display = 'none';
                    content.classList.remove('active');
                }
            });
            
            // Siparişleri yükle
            await loadOrdersForTab(tabName);
        });
    });
    
    // İlk yükleme
    await loadOrdersForTab(currentTab);
    
    // Her 10 saniyede bir siparişleri yenile (yeni siparişler için)
    setInterval(async () => {
        await loadOrdersForTab(currentTab);
    }, 10000);
}

async function loadOrdersForTab(tab) {
    const tabContent = document.getElementById(tab);
    if (!tabContent) return;
    
    // Yükleme mesajı göster
    tabContent.innerHTML = '<p style="text-align: center; padding: 2rem;">Yükleniyor...</p>';
    
    try {
        const orders = await fetchSellerOrders(tab);
        
        if (orders.length === 0) {
            const tabNames = {
                'new': 'Yeni sipariş',
                'preparing': 'Hazırlanan sipariş',
                'history': 'Geçmiş sipariş'
            };
            tabContent.innerHTML = `<p style="text-align: center; padding: 2rem; color: #666;">${tabNames[tab] || 'Sipariş'} bulunmuyor.</p>`;
            return;
        }
        
        // Tab başlığındaki sayıyı güncelle
        const tabButton = document.querySelector(`.tab-link[data-tab="${tab}"]`);
        if (tabButton) {
            const tabText = tabButton.textContent.replace(/\(\d+\)/, `(${orders.length})`);
            tabButton.textContent = tabText;
        }
        
        // Siparişleri göster
        tabContent.innerHTML = '';
        orders.forEach(order => {
            tabContent.insertAdjacentHTML('beforeend', createOrderCardHTML(order));
        });
        
        // Event listener'ları ekle
        attachOrderEventListeners();
    } catch (error) {
        tabContent.innerHTML = '<p style="text-align: center; padding: 2rem; color: #E74C3C;">Siparişler yüklenirken hata oluştu.</p>';
        console.error('Siparişler yükleme hatası:', error);
    }
}

function attachOrderEventListeners() {
    // Onayla butonları
    document.querySelectorAll('.accept-order-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const orderId = parseInt(e.target.getAttribute('data-order-id'));
            try {
                await updateOrderStatus(orderId, 'preparing');
                alert('Sipariş onaylandı ve hazırlamaya başlandı.');
                await loadOrdersForTab('new');
                await loadOrdersForTab('preparing');
            } catch (error) {
                alert('Hata: ' + error.message);
            }
        });
    });
    
    // Reddet butonları
    document.querySelectorAll('.reject-order-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const orderId = parseInt(e.target.getAttribute('data-order-id'));
            if (!confirm('Bu siparişi reddetmek istediğinize emin misiniz?')) return;
            
            try {
                await updateOrderStatus(orderId, 'cancelled');
                alert('Sipariş reddedildi.');
                await loadOrdersForTab('new');
            } catch (error) {
                alert('Hata: ' + error.message);
            }
        });
    });
    
    // Hazır butonları
    document.querySelectorAll('.ready-order-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const orderId = parseInt(e.target.getAttribute('data-order-id'));
            try {
                await updateOrderStatus(orderId, 'ready');
                alert('Kuryeye hazır olduğu bildirildi.');
                await loadOrdersForTab('preparing');
            } catch (error) {
                alert('Hata: ' + error.message);
            }
        });
    });
    
    // Kuryeye Bildir butonları (ready durumundaki siparişler için)
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
                alert(data.message || 'Sipariş kuryeye atandı.');
                
                // Siparişleri yenile
                await loadOrdersForTab('preparing');
            } catch (error) {
                alert('Hata: ' + error.message);
                button.disabled = false;
                button.textContent = 'Kuryeye Bildir';
            }
        });
    });
}

function initializeOrdersPage() {
    loadOrdersPage();
}

// =================================================================
// DASHBOARD SAYFASI İŞLEVLERİ
// =================================================================

/**
 * Dashboard verilerini backend'den çek
 */
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
        console.error('Dashboard verileri yükleme hatası:', error);
        return null;
    }
}

/**
 * Dashboard sayfasını yükle
 */
async function loadDashboardPage() {
    try {
        const data = await fetchDashboardData();
        
        if (!data) {
            document.getElementById('dashboard-subtitle').textContent = 'Veri yüklenemedi.';
            return;
        }
        
        // Başlık güncelle
        const subtitle = document.getElementById('dashboard-subtitle');
        if (subtitle) {
            subtitle.textContent = `Hoş geldin, ${data.shopName || 'Satıcı'}! İşletmenizin anlık durumu burada.`;
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
        
        // Son siparişleri göster
        const ordersList = document.getElementById('recent-orders-list');
        if (ordersList) {
            const orders = data.recentOrders || [];
            
            if (orders.length === 0) {
                ordersList.innerHTML = '<p style="text-align: center; padding: 2rem; color: #666;">Henüz sipariş bulunmuyor.</p>';
            } else {
                ordersList.innerHTML = orders.map(order => {
                    const statusClass = order.status === 'delivered' ? 'delivered' : 
                                       order.status === 'preparing' ? 'preparing' : 
                                       order.status === 'cancelled' ? 'cancelled' : '';
                    const statusText = order.status === 'delivered' ? 'Teslim Edildi' :
                                      order.status === 'preparing' ? 'Hazırlanıyor' :
                                      order.status === 'cancelled' ? 'İptal Edildi' :
                                      order.status === 'ready' ? 'Hazır' : 'Bekliyor';
                    
                    return `
                        <div class="order-list-item">
                            <div class="order-info">
                                <strong>#${order.orderNumber || order.id} - ${order.customer || 'Müşteri'}</strong>
                                <span>${order.items || 'Belirtilmemiş'}</span>
                            </div>
                            <div class="order-status ${statusClass}">
                                ${statusText}
                            </div>
                            <div class="order-price">
                                ${order.total.toFixed(2)} TL
                            </div>
                            <a href="/seller/orders" class="btn btn-secondary btn-sm">Detay</a>
                        </div>
                    `;
                }).join('');
            }
        }
    } catch (error) {
        console.error('Dashboard yükleme hatası:', error);
        const subtitle = document.getElementById('dashboard-subtitle');
        if (subtitle) subtitle.textContent = 'Veri yüklenirken hata oluştu.';
    }
}

function initializeDashboardPage() {
    loadDashboardPage();
}

// =================================================================
// PROFILE SAYFASI İŞLEVLERİ
// =================================================================

/**
 * Satıcı profil bilgilerini backend'den çek
 */
async function fetchSellerProfile() {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        console.log('📡 Profil API çağrısı yapılıyor:', `${baseUrl}/api/seller/profile`);
        
        const response = await fetch(`${baseUrl}/api/seller/profile`, {
            credentials: 'include'
        });
        
        console.log('📥 Profil API yanıtı:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API hatası:', response.status, errorText);
            
            let errorMessage = 'Profil yüklenemedi';
            let errorDetails = null;
            try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.message || errorMessage;
                errorDetails = errorData.error || null;
                if (errorDetails) {
                    console.error('❌ Backend hata detayı:', errorDetails);
                }
            } catch (e) {
                // JSON parse edilemezse text olarak kullan
                console.error('❌ Error response parse edilemedi:', e);
            }
            
            const finalError = new Error(errorMessage);
            if (errorDetails) {
                finalError.details = errorDetails;
            }
            throw finalError;
        }
        
        const data = await response.json();
        console.log('✅ Profil API yanıtı:', data);
        
        if (!data.success) {
            console.error('❌ API başarısız:', data.message);
            return null;
        }
        
        return data.profile || null;
    } catch (error) {
        console.error('❌ Profil yükleme hatası:', error);
        console.error('❌ Hata detayı:', error.message);
        return null;
    }
}

/**
 * Satıcı profil bilgilerini güncelle
 */
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
            const error = await response.json();
            throw new Error(error.message || 'Profil güncellenemedi');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Profil güncelleme hatası:', error);
        throw error;
    }
}

/**
 * Profil sayfasını yükle
 */
async function loadProfilePage() {
    try {
        const profile = await fetchSellerProfile();
        
        if (!profile) {
            alert('Profil bilgileri yüklenemedi.');
            return;
        }
        
        // Form alanlarını doldur
        const shopNameInput = document.getElementById('shop-name');
        const descriptionInput = document.getElementById('shop-description');
        const locationInput = document.getElementById('shop-location');
        const hoursInput = document.getElementById('shop-hours');
        const logoPreview = document.getElementById('logo-preview');
        const bannerPreview = document.getElementById('banner-preview');
        
        if (shopNameInput) shopNameInput.value = profile.shopName || '';
        if (descriptionInput) descriptionInput.value = profile.description || '';
        if (locationInput) locationInput.value = profile.location || '';
        // workingHours JSON ise string'e çevir
        let hoursValue = profile.workingHours || '';
        if (hoursValue && typeof hoursValue === 'object') {
            hoursValue = JSON.stringify(hoursValue, null, 2);
        }
        if (hoursInput) hoursInput.value = hoursValue;
        if (logoPreview && profile.logoUrl) logoPreview.src = profile.logoUrl;
        if (bannerPreview && profile.bannerUrl) bannerPreview.src = profile.bannerUrl;
        
        // Form submit handler
        const profileForm = document.getElementById('seller-profile-form');
        if (profileForm) {
            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const profileData = {
                    shopName: shopNameInput?.value || '',
                    description: descriptionInput?.value || '',
                    location: locationInput?.value || '',
                    // Boş string ise undefined gönder (backend NULL olarak işleyecek)
                    workingHours: hoursInput?.value && hoursInput.value.trim() !== '' ? hoursInput.value : undefined
                    // Logo ve banner artık ayrı endpoint'lerden yükleniyor, buraya eklemiyoruz
                };
                
                console.log('📤 Profil güncelleme verisi:', profileData);
                
                try {
                    await updateSellerProfile(profileData);
                    alert('✅ Profil başarıyla güncellendi!');
                } catch (error) {
                    alert('❌ Profil güncellenirken hata oluştu: ' + error.message);
                }
            });
        }
        
        // Resim yükleme handler'ları - Dosya olarak yükle
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
                    
                    // Preview göster
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        if (logoPreview) {
                            logoPreview.src = e.target.result;
                        }
                    };
                    reader.readAsDataURL(file);
                    
                    // Dosyayı sunucuya yükle
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
                        console.log('✅ Logo yüklendi:', data.url);
                        
                        // Preview'ı güncelle
                        if (logoPreview) {
                            logoPreview.src = data.url;
                        }
                        
                        alert('✅ Logo başarıyla yüklendi!');
                    } catch (error) {
                        console.error('❌ Logo yükleme hatası:', error);
                        alert('❌ Logo yüklenirken hata oluştu: ' + error.message);
                        e.target.value = ''; // Input'u temizle
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
                    // Dosya boyutu kontrolü (max 5MB)
                    if (file.size > 5 * 1024 * 1024) {
                        alert('❌ Banner resmi çok büyük! Maksimum 5MB olmalı.');
                        e.target.value = ''; // Input'u temizle
                        return;
                    }
                    
                    // Preview göster
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
                        console.log('✅ Banner yüklendi:', data.url);
                        
                        // Preview'ı güncelle
                        if (bannerPreview) {
                            bannerPreview.src = data.url;
                        }
                        
                        alert('✅ Banner başarıyla yüklendi!');
                    } catch (error) {
                        console.error('❌ Banner yükleme hatası:', error);
                        alert('❌ Banner yüklenirken hata oluştu: ' + error.message);
                        e.target.value = ''; // Input'u temizle
                        if (bannerPreview) {
                            bannerPreview.src = profile.bannerUrl || '';
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Profil sayfası yükleme hatası:', error);
    }
}

function initializeProfilePage() {
    loadProfilePage();
}

// =================================================================
// SIDEBAR LINKLERİNİ GÜNCELLE
// =================================================================

function updateSellerSidebarLinks(sellerId) {
    if (!sellerId) return;
    
    const links = {
        'seller-dashboard-link': `/seller/${sellerId}/dashboard`,
        'sidebar-dashboard-link': `/seller/${sellerId}/dashboard`,
        'sidebar-orders-link': `/seller/${sellerId}/orders`,
        'sidebar-menu-link': `/seller/${sellerId}/menu`,
        'sidebar-earnings-link': `/seller/${sellerId}/earnings`,
        'sidebar-profile-link': `/seller/${sellerId}/profile`
    };
    
    Object.keys(links).forEach(id => {
        const link = document.getElementById(id);
        if (link) {
            link.href = links[id];
        }
    });
}

// URL'den seller ID'yi al
function getSellerIdFromUrl() {
    const pathParts = window.location.pathname.split('/');
    const sellerIndex = pathParts.indexOf('seller');
    if (sellerIndex !== -1 && pathParts[sellerIndex + 1]) {
        return pathParts[sellerIndex + 1];
    }
    return null;
}

// =================================================================
// BAŞLATMA (ENTRY POINT)
// =================================================================

// Sayfa yüklendiğinde otomatik çalıştır
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSellerPages);
} else {
    // DOM zaten yüklendi, hemen çalıştır
    initializeSellerPages();
}

async function initializeSellerPages() {
    const path = window.location.pathname;
    
    // Seller ID'yi URL'den al veya API'den çek
    let sellerId = getSellerIdFromUrl();
    
    if (!sellerId && path.includes('/seller/')) {
        // API'den seller ID'yi al
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
        } catch (error) {
            console.warn('Seller ID alınamadı:', error);
        }
    }
    
    // Sidebar linklerini güncelle
    if (sellerId) {
        updateSellerSidebarLinks(sellerId);
    }

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

    // EJS route'larına göre kontrol et
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
    } else {
        // Fallback: HTML sayfaları için (geriye dönük uyumluluk)
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
        }
    }
}

