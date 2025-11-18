// =================================================================
// GENEL VERİ, YARDIMCI VE LOCAL STORAGE FONKSİYONLARI
// =================================================================

const COURIER_DATA = {
    id: 101,
    name: "Kurye Adı Soyadı",
    phone: "05551234567",
    vehicle: "motorcycle",
    status: "online"
};

const AVAILABLE_ORDERS_DATA = [
    { id: 101, pickup: "Ayşe'nin Mutfağı (Kadıköy)", dropoff: "E*** S. (Çerkezköy)", payout: 45.00, status: 'available' },
    { id: 102, pickup: "Ali'nin Kebapları (Beşiktaş)", dropoff: "A*** K. (Şişli)", payout: 25.00, status: 'available' },
    { id: 103, pickup: "Vegan Lezzetler (Moda)", dropoff: "M*** Y. (Göztepe)", payout: 30.00, status: 'available' },
];

function formatPhoneNumber(rawPhone) {
    if (!rawPhone) return '';
    const digits = rawPhone.replace(/\D/g, '');
    if (digits.length === 11) {
        return digits.replace(/(\d{4})(\d{3})(\d{4})/, '($1) $2 $3');
    }
    return rawPhone;
}

function displayMessage(message, type = 'info') {
    const statusMessageDiv = document.getElementById('status-message');
    if (!statusMessageDiv) {
        console.log(`[${type.toUpperCase()}] ${message}`);
        return;
    }
    
    statusMessageDiv.textContent = message;
    statusMessageDiv.style.display = 'block';

    if (type === 'success') {
        statusMessageDiv.style.backgroundColor = '#e6ffe6';
        statusMessageDiv.style.color = '#4CAF50';
        statusMessageDiv.style.border = '1px solid #4CAF50';
    } else if (type === 'error') {
        statusMessageDiv.style.backgroundColor = '#ffe6e6';
        statusMessageDiv.style.color = '#E74C3C';
        statusMessageDiv.style.border = '1px solid #E74C3C';
    } else { 
        statusMessageDiv.style.backgroundColor = '#f0f0f0';
        statusMessageDiv.style.color = '#333';
        statusMessageDiv.style.border = '1px solid #ccc';
    }
    
    if (type !== 'info') {
        setTimeout(() => {
            statusMessageDiv.style.display = 'none';
            statusMessageDiv.textContent = '';
        }, 4000);
    }
}

function initializeLogout() {
    const logoutBtn = document.getElementById('courier-logout-btn');
    if (!logoutBtn) return;

    logoutBtn.addEventListener('click', function(event) {
        event.preventDefault();

        displayMessage('Oturum sonlandırılıyor...', 'info');

        setTimeout(() => {
            window.location.href = '../../index.html';
        }, 800);
    });
}

function getActiveOrders() {
    try {
        const orders = localStorage.getItem('activeOrders');
        return orders ? JSON.parse(orders) : [];
    } catch (e) {
        console.error("Aktif görevler Local Storage'dan okunamadı.", e);
        return [];
    }
}

function getHistoryOrders() {
    try {
        const orders = localStorage.getItem('historyOrders');
        return orders ? JSON.parse(orders) : [];
    } catch (e) {
        console.error("Geçmiş görevler Local Storage'dan okunamadı.", e);
        return [];
    }
}

function addAcceptedOrderToStorage(order) {
    if (!order) return;
    const activeOrders = getActiveOrders();
    activeOrders.push(order);
    localStorage.setItem('activeOrders', JSON.stringify(activeOrders));
}

function addCompletedOrderToHistory(order) {
    if (!order) return;
    const historyOrders = getHistoryOrders();
    
    order.completedAt = new Date().toISOString();
    order.status = 'delivered';
    
    historyOrders.push(order);
    
    localStorage.setItem('historyOrders', JSON.stringify(historyOrders));
}

function removeCompletedOrder(orderId) {
    let activeOrders = getActiveOrders();
    const completedOrderIndex = activeOrders.findIndex(order => String(order.id) === String(orderId));
    
    if (completedOrderIndex === -1) {
        localStorage.setItem('activeOrders', JSON.stringify(activeOrders));
        return null;
    }

    const [completedOrder] = activeOrders.splice(completedOrderIndex, 1);
    localStorage.setItem('activeOrders', JSON.stringify(activeOrders));
    
    if (completedOrder) {
        addCompletedOrderToHistory(completedOrder);
    }
    return completedOrder;
}

// =================================================================
// PROFİL SAYFASI İŞLEVLERİ (profile.html)
// =================================================================

function loadProfileData() {
    const courierNameInput = document.getElementById('courier-name');
    const courierPhoneInput = document.getElementById('courier-phone');
    const courierVehicleSelect = document.getElementById('courier-vehicle');
    const statusOnline = document.getElementById('status-online');
    const statusOffline = document.getElementById('status-offline');

    if (!courierNameInput || !courierPhoneInput || !courierVehicleSelect) return;
    
    courierNameInput.value = COURIER_DATA.name || '';
    courierPhoneInput.value = formatPhoneNumber(COURIER_DATA.phone || '');
    courierVehicleSelect.value = COURIER_DATA.vehicle || '';

    if (statusOnline && statusOffline) {
        if (COURIER_DATA.status === 'online') {
            statusOnline.checked = true;
        } else {
            statusOffline.checked = true;
        }
    }
}

function handleProfileUpdate(event) {
    event.preventDefault();
    
    const courierNameInput = document.getElementById('courier-name');
    const courierPhoneInput = document.getElementById('courier-phone');
    const courierVehicleSelect = document.getElementById('courier-vehicle');

    if (!courierNameInput || !courierPhoneInput || !courierVehicleSelect) {
        displayMessage('Profil alanları eksik veya sayfada bulunamadı.', 'error');
        return;
    }

    COURIER_DATA.name = courierNameInput.value || COURIER_DATA.name;
    COURIER_DATA.phone = courierPhoneInput.value.replace(/\D/g, '') || COURIER_DATA.phone;
    COURIER_DATA.vehicle = courierVehicleSelect.value || COURIER_DATA.vehicle;

    displayMessage('✅ Profil bilgileri başarıyla güncellendi!', 'success');
}

function handleStatusChange() {
    const newStatus = this.value;
    COURIER_DATA.status = newStatus;

    const statusText = newStatus === 'online' ? 'Aktif (Görev Alabilir)' : 'Pasif (Görev Alamaz)';
    displayMessage(`Durumunuz başarıyla "${statusText}" olarak ayarlandı.`, 'success');
}

function initializeProfilePage() {
    loadProfileData();

    const profileForm = document.getElementById('courier-profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileUpdate);
    }

    const statusInputs = document.querySelectorAll('input[name="courier-status"]');
    if (statusInputs && statusInputs.length) {
        statusInputs.forEach(input => {
            input.addEventListener('change', handleStatusChange);
        });
    }
}

// =================================================================
// ALINABİLİR SİPARİŞLER İŞLEVLERİ (available.html)
// =================================================================

function acceptOrderAndSave(orderId) {
    const acceptedOrder = AVAILABLE_ORDERS_DATA.find(order => String(order.id) === String(orderId));
    
    if (getActiveOrders().length > 0) {
        displayMessage('❌ Zaten aktif bir göreviniz var. Lütfen önce onu tamamlayın.', 'error');
        return false;
    }

    if (acceptedOrder) {
        const orderCopy = Object.assign({}, acceptedOrder);
        orderCopy.status = 'accepted';
        addAcceptedOrderToStorage(orderCopy);
        return true;
    }
    return false;
}

function createOrderCardHTML(order) {
    return `
        <div class="card available-order-card" data-order-id="${order.id}">
            <div class="order-route">
                <div class="route-point">
                    <strong>Alış:</strong> ${order.pickup}
                </div>
                <div class="route-point">
                    <strong>Teslim:</strong> ${order.dropoff}
                </div>
            </div>
            <div class="order-payout">
                <span>Tahmini Kazanç</span>
                <strong>${order.payout.toFixed(2)} TL</strong>
                <button class="btn btn-primary btn-full accept-order-btn" data-order-id="${order.id}">Görevi Kabul Et</button>
            </div>
        </div>
    `;
}

function handleAcceptOrder(event) {
    const button = event.currentTarget;
    const orderId = button.getAttribute('data-order-id');

    if (!orderId) return;

    button.disabled = true;
    button.textContent = 'Kabul Ediliyor...';

    const saved = acceptOrderAndSave(orderId);

    if (saved) {
        setTimeout(() => {
            const orderCard = document.querySelector(`.available-order-card[data-order-id="${orderId}"]`);
            if (orderCard) orderCard.remove();

            displayMessage(`✅ Sipariş #${orderId} başarıyla kabul edildi! Yönlendiriliyorsunuz...`, 'success');

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 200);
        }, 700);
    } else {
        button.disabled = false;
        button.textContent = 'Görevi Kabul Et';
    }
}

function attachAcceptButtonListeners() {
    const acceptButtons = document.querySelectorAll('.accept-order-btn');
    if (!acceptButtons) return;
    acceptButtons.forEach(button => {
        button.removeEventListener('click', handleAcceptOrder); 
        button.addEventListener('click', handleAcceptOrder);
    });
}

function loadAvailableOrders() {
    const ordersListContainer = document.querySelector('.available-orders-list');
    if (!ordersListContainer) return;

    ordersListContainer.innerHTML = '';

    AVAILABLE_ORDERS_DATA.forEach(order => {
        const orderHTML = createOrderCardHTML(order);
        ordersListContainer.insertAdjacentHTML('beforeend', orderHTML);
    });

    attachAcceptButtonListeners();
}

function initializeAvailablePage() {
    loadAvailableOrders();
}

// =================================================================
// DASHBOARD İŞLEVLERİ (dashboard.html)
// =================================================================

function handleTaskComplete(event) {
    const orderId = event.currentTarget.getAttribute('data-order-id');
    if (!orderId) return;

    event.currentTarget.disabled = true;
    event.currentTarget.textContent = 'Teslimat Onaylanıyor...';

    const completedOrder = removeCompletedOrder(orderId);

    setTimeout(() => {
        if (completedOrder) {
            displayMessage(`✅ Görev #${orderId} başarıyla tamamlandı ve Teslimat Geçmişine eklendi!`, 'success');
        } else {
            displayMessage('⚠️ Tamamlanan görev bulunamadı.', 'error');
        }
        loadActiveTasks(); 
    }, 800);
}

function createActiveTaskCard(order) {
    const pickupName = (order.pickup || '').split('(')[0].trim();
    const dropoffName = (order.dropoff || '').split('(')[0].trim();
    
    const cardHTML = `
        <div class="card-content">
            <h3 class="checkout-card-title">Aktif Görev: #${order.id}</h3>
            
            <div class="map-placeholder">
                <p>Harita Alanı</p>
                <span>(Kurye -> ${pickupName} -> ${dropoffName} rotası)</span>
            </div>
            
            <div class="task-details">
                <div class="task-step active">
                    <strong>1. Adım (Alış):</strong> ${order.pickup}
                </div>
                <div class="task-step">
                    <strong>2. Adım (Teslim):</strong> ${order.dropoff}
                </div>
            </div>
            
            <div style="text-align: center; margin: 15px 0; padding: 10px; background: #f9f9f9; border-radius: 4px;">
                <strong>Bu Görev Kazancı:</strong> <span style="color: #4CAF50;">${order.payout.toFixed(2)} TL</span>
            </div>

            <button class="btn btn-primary btn-full complete-task-btn" data-order-id="${order.id}">
                Görevi Tamamladım
            </button>
        </div>
    `;
    return cardHTML;
}

function updateStats() {
    const historyOrders = getHistoryOrders();
    const today = new Date().toLocaleDateString('tr-TR');

    const todaysDeliveries = historyOrders.filter(order => {
        try {
            const orderDate = new Date(order.completedAt).toLocaleDateString('tr-TR');
            return orderDate === today;
        } catch (e) {
            return false;
        }
    });

    const totalEarning = todaysDeliveries.reduce((sum, order) => sum + (order.payout || 0), 0);

    const earningValue = document.querySelector('.stat-grid .stat-card:nth-child(1) .stat-value');
    const deliveryValue = document.querySelector('.stat-grid .stat-card:nth-child(2) .stat-value');

    if (earningValue) {
        earningValue.textContent = `${totalEarning.toFixed(2)} TL`;
    }
    if (deliveryValue) {
        deliveryValue.textContent = todaysDeliveries.length;
    }
}

function loadActiveTasks() {
    const activeOrders = getActiveOrders();
    const taskContainer = document.querySelector('main .card');

    if (!taskContainer) return;

    updateStats(); 

    if (activeOrders.length > 0) {
        const activeTask = activeOrders[0];
        taskContainer.innerHTML = createActiveTaskCard(activeTask);

        const completeBtn = taskContainer.querySelector('.complete-task-btn');
        if (completeBtn) {
            completeBtn.addEventListener('click', handleTaskComplete);
        }
    } else {
        taskContainer.innerHTML = `
            <div class="card-content">
                <h3 class="checkout-card-title">Aktif Görev Yok</h3>
                <p>Şu anda teslimat rotanda bekleyen aktif bir görevin bulunmamaktadır.</p>
                <a href="available.html" class="btn btn-secondary btn-full" style="margin-top: 1rem;">Yeni Görevlere Git</a>
            </div>
        `;
    }
}

function initializeDashboardPage() {
    loadActiveTasks();
}

// =================================================================
// TESLİMAT GEÇMİŞİ İŞLEVLERİ (history.html)
// =================================================================

function createTransactionItemHTML(transaction) {
    const typeClass = transaction.type || 'income';
    const sign = typeClass === 'income' ? '+' : '-';
    
    const formattedDate = (() => {
        try {
            return new Date(transaction.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
        } catch (e) {
            return '';
        }
    })();

    return `
        <div class="transaction-item">
            <div class="transaction-icon ${typeClass}">
                <span>${sign}</span>
            </div>
            <div class="transaction-details">
                <strong>${transaction.description}</strong>
                <span>${formattedDate}</span>
            </div>
            <div class="transaction-amount ${typeClass}">
                ${sign}${(transaction.amount || 0).toFixed(2)} TL
            </div>
        </div>
    `;
}

function updateHistoryStats(allTransactions) {
    const totalEarnings = allTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const totalPayouts = allTransactions
        .filter(t => t.type === 'payout')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalBalance = totalEarnings - totalPayouts;
    const totalDeliveries = allTransactions.filter(t => t.type === 'income').length;
    
    const balanceValue = document.querySelector('.stat-grid .stat-card:nth-child(1) .stat-value');
    const deliveryValue = document.querySelector('.stat-grid .stat-card:nth-child(2) .stat-value');

    if (balanceValue) {
        balanceValue.textContent = `${totalBalance.toFixed(2)} TL`;
    }
    if (deliveryValue) {
        deliveryValue.textContent = totalDeliveries;
    }
}

function loadHistoryData() {
    const historyOrders = getHistoryOrders();

    const transactionListContainer = document.querySelector('.transaction-list');
    const historyCardContent = document.querySelector('.card:nth-child(2) .card-content') || document.querySelector('.card .card-content');

    if (!transactionListContainer || !historyCardContent) return;

    let transactions = historyOrders.map(order => ({
        type: 'income',
        description: `#${order.id} Nolu Teslimat Kazancı`,
        date: order.completedAt,
        amount: order.payout,
        id: order.id
    }));

    if (historyOrders.length >= 3) {
        transactions.push({
            type: 'payout',
            description: `Ödeme Çekildi (IBAN: ...5678)`,
            date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            amount: 250.00,
            id: 'payout-1'
        });
    }

    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    updateHistoryStats(transactions);

    transactionListContainer.innerHTML = '';

    if (transactions.length > 0) {
        transactions.forEach(t => {
            transactionListContainer.insertAdjacentHTML('beforeend', createTransactionItemHTML(t));
        });
    } else {
        historyCardContent.innerHTML = `
            <h3 class="checkout-card-title">Son İşlemler</h3>
            <p style="text-align: center; padding: 20px;">
                Henüz tamamlanmış bir teslimatınız veya işlem kaydınız bulunmamaktadır.
            </p>
        `;
    }
}

function initializeHistoryPage() {
    loadHistoryData();
}

// =================================================================
// BAŞLATMA VE YÖNLENDİRME (ENTRY POINT)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    initializeLogout();

    const path = window.location.pathname || window.location.href;

    try {
        if (path.includes('profile.html')) {
            initializeProfilePage();
            console.log("-> Profil Sayfası Başlatıldı.");
        } else if (path.includes('available.html')) {
            initializeAvailablePage();
            console.log("-> Alınabilir Siparişler Sayfası Başlatıldı.");
        } else if (path.includes('dashboard.html')) {
            initializeDashboardPage();
            console.log("-> Dashboard Sayfası Başlatıldı.");
        } else if (path.includes('history.html')) {
            initializeHistoryPage();
            console.log("-> Teslimat Geçmişi Sayfası Başlatıldı.");
        } else {
            if (document.querySelector('.transaction-list')) {
                initializeHistoryPage();
                console.log("-> Teslimat Geçmişi (fallback) Başlatıldı.");
            } else if (document.querySelector('.available-orders-list')) {
                initializeAvailablePage();
                console.log("-> Alınabilir Siparişler (fallback) Başlatıldı.");
            } else if (document.querySelector('#courier-profile-form')) {
                initializeProfilePage();
                console.log("-> Profil (fallback) Başlatıldı.");
            } else if (document.querySelector('main .card')) {
                initializeDashboardPage();
                console.log("-> Dashboard (fallback) Başlatıldı.");
            }
        }
    } catch (e) {
        console.error("Başlatma sırasında hata oluştu:", e);
    }
});