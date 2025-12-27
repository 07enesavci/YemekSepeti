async function fetchAvailableTasks() {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/courier/available`, {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Alınabilir görevler yüklenemedi');
        const data = await response.json();
        return data.success ? data.tasks : [];
    } catch (error) {
        return [];
    }
}

async function acceptTask(taskId) {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/courier/tasks/${taskId}/accept`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Görev kabul edilemedi');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        throw error;
    }
}

async function fetchActiveTasks() {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/courier/tasks/active`, {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Aktif görevler yüklenemedi');
        const data = await response.json();
        return data.success ? data.tasks : [];
    } catch (error) {
        return [];
    }
}

async function completeTask(taskId) {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/courier/tasks/${taskId}/complete`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Görev tamamlanamadı');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        throw error;
    }
}

async function fetchHistoryTasks(page = 1, limit = 20) {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/courier/tasks/history?page=${page}&limit=${limit}`, {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Geçmiş görevler yüklenemedi');
        const data = await response.json();
        return data.success ? data : { tasks: [], pagination: {} };
    } catch (error) {
        return { tasks: [], pagination: {} };
    }
}

async function fetchCourierProfile() {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/courier/profile`, {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Profil yüklenemedi');
        const data = await response.json();
        return data.success ? data.courier : null;
    } catch (error) {
        return null;
    }
}

async function updateCourierProfile(fullname, phone, status, vehicleType) {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        
        const body = {};
        if (fullname) body.fullname = fullname;
        if (phone) body.phone = phone;
        if (status) body.status = status;
        if (vehicleType) body.vehicleType = vehicleType;
        
        const response = await fetch(`${baseUrl}/api/courier/profile`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            const responseText = await response.text();
            
            let errorMessage = 'Profil güncellenemedi';
            try {
                const errorData = JSON.parse(responseText);
                errorMessage = errorData.message || errorMessage;
            } catch (e) {
                errorMessage = responseText || errorMessage;
            }
            
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        throw error;
    }
}

async function fetchCourierEarnings(period = 'month') {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/courier/earnings?period=${period}`, {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Kazanç istatistikleri yüklenemedi');
        const data = await response.json();
        return data.success ? data : null;
    } catch (error) {
        return null;
    }
}

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
            const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
            window.location.href = `${baseUrl}/`;
        }, 800);
    });
}


async function loadProfileData() {
    const courierNameInput = document.getElementById('courier-name');
    const courierPhoneInput = document.getElementById('courier-phone');
    const courierVehicleSelect = document.getElementById('courier-vehicle');
    const statusOnline = document.getElementById('status-online');
    const statusOffline = document.getElementById('status-offline');

    if (!courierNameInput || !courierPhoneInput || !courierVehicleSelect) return;
    
    try {
        const profile = await fetchCourierProfile();
        if (profile) {
            courierNameInput.value = profile.fullname || '';
            courierPhoneInput.value = formatPhoneNumber(profile.phone || '');
            
            if (profile.vehicleType) {
                courierVehicleSelect.value = profile.vehicleType;
            } else {
                courierVehicleSelect.value = 'motorcycle';
            }
            
            if (statusOnline && statusOffline) {
                const courierStatus = profile.status || 'online';
                if (courierStatus === 'online') {
                    statusOnline.checked = true;
                    statusOffline.checked = false;
                } else {
                    statusOnline.checked = false;
                    statusOffline.checked = true;
                }
            }
        }
    } catch (error) {}
}

async function handleProfileUpdate(event) {
    event.preventDefault();
    
    const courierNameInput = document.getElementById('courier-name');
    const courierPhoneInput = document.getElementById('courier-phone');
    const courierVehicleSelect = document.getElementById('courier-vehicle');
    const statusRadio = document.querySelector('input[name="courier-status"]:checked');

    if (!courierNameInput || !courierPhoneInput || !courierVehicleSelect) {
        displayMessage('Profil alanları eksik veya sayfada bulunamadı.', 'error');
        return;
    }

    const fullname = courierNameInput.value.trim();
    const rawPhone = courierPhoneInput.value.replace(/\D/g, '');
    const vehicleType = courierVehicleSelect.value;
    const status = statusRadio ? statusRadio.value : 'online';

    if (!fullname || !rawPhone) {
        displayMessage('Ad soyad ve telefon numarası gereklidir.', 'error');
        return;
    }

    try {
        await updateCourierProfile(fullname, rawPhone, status, vehicleType);
        displayMessage('✅ Profil bilgileri başarıyla güncellendi!', 'success');
        
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        user.fullname = fullname;
        user.phone = rawPhone;
        user.courierStatus = status;
        user.vehicleType = vehicleType;
        localStorage.setItem('user', JSON.stringify(user));
    } catch (error) {
        displayMessage('❌ Profil güncellenirken hata oluştu: ' + error.message, 'error');
    }
}

async function handleStatusChange() {
    const newStatus = this.value;
    const courierNameInput = document.getElementById('courier-name');
    const courierPhoneInput = document.getElementById('courier-phone');
    const courierVehicleSelect = document.getElementById('courier-vehicle');

    const fullname = courierNameInput ? courierNameInput.value.trim() : '';
    const rawPhone = courierPhoneInput ? courierPhoneInput.value.replace(/\D/g, '') : '';
    const vehicleType = courierVehicleSelect ? courierVehicleSelect.value : 'motorcycle';

    try {
        await updateCourierProfile(fullname || null, rawPhone || null, newStatus, vehicleType);
        
        if (typeof updateCourierStatusIndicator === 'function') {
            updateCourierStatusIndicator(newStatus);
        }
        
        let statusText;
        if (newStatus === 'online') {
            statusText = 'Aktif (Görev Alabilir)';
        } else {
            statusText = 'Pasif (Görev Alamaz)';
        }
        
        displayMessage(`Durumunuz başarıyla "${statusText}" olarak ayarlandı.`, 'success');
    } catch (error) {
        displayMessage('❌ Durum güncellenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata'), 'error');
    }
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


function createOrderCardHTML(order) {
    return `
        <div class="card available-order-card" data-order-id="${order.id}">
            <div class="order-route">
                <div class="route-point">
                    <strong>Alış:</strong> ${order.pickup || 'Belirtilmemiş'}
                </div>
                <div class="route-point">
                    <strong>Teslim:</strong> ${order.dropoff || 'Belirtilmemiş'}
                </div>
            </div>
            <div class="order-payout">
                <span>Tahmini Kazanç</span>
                <strong>${(order.payout || 0).toFixed(2)} TL</strong>
                <button class="btn btn-primary btn-full accept-order-btn" data-order-id="${order.id}">Görevi Kabul Et</button>
            </div>
        </div>
    `;
}

async function handleAcceptOrder(event) {
    const button = event.currentTarget;
    const orderId = button.getAttribute('data-order-id');

    if (!orderId) return;

    button.disabled = true;
    button.textContent = 'Kabul Ediliyor...';

    try {
        await acceptTask(parseInt(orderId));
        
        const orderCard = document.querySelector(`.available-order-card[data-order-id="${orderId}"]`);
        if (orderCard) orderCard.remove();

        displayMessage(`✅ Sipariş #${orderId} başarıyla kabul edildi! Yönlendiriliyorsunuz...`, 'success');

        setTimeout(() => {
            const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
            // URL'den courierId'yi al
            const pathMatch = window.location.pathname.match(/\/courier\/(\d+)/);
            const courierId = pathMatch ? pathMatch[1] : (localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).courierId || JSON.parse(localStorage.getItem('user')).id : '');
            window.location.href = `${baseUrl}/courier/${courierId}/dashboard`;
        }, 1500);
    } catch (error) {
        button.disabled = false;
        button.textContent = 'Görevi Kabul Et';
        displayMessage('❌ ' + error.message, 'error');
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

async function loadAvailableOrders() {
    const ordersListContainer = document.querySelector('.available-orders-list');
    if (!ordersListContainer) return;

    ordersListContainer.innerHTML = '<p>Yükleniyor...</p>';

    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/courier/available`, {
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('Alınabilir görevler yüklenemedi');
        
        const data = await response.json();
        const tasks = data.success ? data.tasks : [];
        
        ordersListContainer.innerHTML = '';
        
        if (data.message || tasks.length === 0) {
            const message = data.message || "Henüz aktif görev bulunmamaktadır.";
            ordersListContainer.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 4rem 2rem;">
                    <div class="empty-state-icon" style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.5;">📦</div>
                    <div class="empty-state-title" style="font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-color);">${message}</div>
                    <div class="empty-state-message" style="font-size: 1rem; color: var(--text-color-light);">Yeni görevler geldiğinde burada görünecektir.</div>
                </div>
            `;
            return;
        }

        tasks.forEach(task => {
            const orderHTML = createOrderCardHTML({
                id: task.id,
                pickup: task.pickup,
                dropoff: task.dropoff,
                payout: task.payout
            });
            ordersListContainer.insertAdjacentHTML('beforeend', orderHTML);
        });

        attachAcceptButtonListeners();
    } catch (error) {
        ordersListContainer.innerHTML = '<p style="text-align: center; padding: 2rem; color: #E74C3C;">Görevler yüklenirken hata oluştu.</p>';
    }
}

function initializeAvailablePage() {
    loadAvailableOrders();
}


async function handleTaskComplete(event) {
    const orderId = event.currentTarget.getAttribute('data-order-id');
    if (!orderId) return;

    event.currentTarget.disabled = true;
    event.currentTarget.textContent = 'Teslimat Onaylanıyor...';

    try {
        await completeTask(parseInt(orderId));
        displayMessage(`✅ Görev #${orderId} başarıyla tamamlandı ve Teslimat Geçmişine eklendi!`, 'success');
        setTimeout(() => {
            loadActiveTasks();
        }, 1000);
    } catch (error) {
        event.currentTarget.disabled = false;
        event.currentTarget.textContent = 'Görevi Tamamladım';
        displayMessage('❌ ' + error.message, 'error');
    }
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

async function updateStats() {
    try {
        const earnings = await fetchCourierEarnings('day');
        if (earnings && earnings.stats) {
            const earningValue = document.querySelector('.stat-grid .stat-card:nth-child(1) .stat-value');
            const deliveryValue = document.querySelector('.stat-grid .stat-card:nth-child(2) .stat-value');

            if (earningValue) {
                earningValue.textContent = `${earnings.stats.totalEarnings.toFixed(2)} TL`;
            }
            if (deliveryValue) {
                deliveryValue.textContent = earnings.stats.totalDeliveries;
            }
        }
    } catch (error) {}
}

async function loadActiveTasks() {
    const taskContainer = document.querySelector('main .card');

    if (!taskContainer) return;

    await updateStats(); 

    try {
        const tasks = await fetchActiveTasks();
        
        if (tasks.length > 0) {
            const activeTask = tasks[0];
            taskContainer.innerHTML = createActiveTaskCard({
                id: activeTask.id,
                pickup: activeTask.pickup,
                dropoff: activeTask.dropoff,
                payout: activeTask.payout
            });

            const completeBtn = taskContainer.querySelector('.complete-task-btn');
            if (completeBtn) {
                completeBtn.addEventListener('click', handleTaskComplete);
            }
        } else {
            // URL'den courierId'yi al
            const pathMatch = window.location.pathname.match(/\/courier\/(\d+)/);
            const courierId = pathMatch ? pathMatch[1] : (localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).courierId || JSON.parse(localStorage.getItem('user')).id : '');
            
            taskContainer.innerHTML = `
                <div class="card-content">
                    <h3 class="checkout-card-title">Aktif Görev Yok</h3>
                    <p>Şu anda teslimat rotanda bekleyen aktif bir görevin bulunmamaktadır.</p>
                    <a href="/courier/${courierId}/available" class="btn btn-secondary btn-full" style="margin-top: 1rem;">Yeni Görevlere Git</a>
                </div>
            `;
        }
    } catch (error) {
        taskContainer.innerHTML = '<p style="text-align: center; padding: 2rem; color: #E74C3C;">Aktif görevler yüklenirken hata oluştu.</p>';
    }
}

function updateCourierStatusIndicator(status) {
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    
    if (!statusDot || !statusText) return;
    
    const isOnline = status === 'online';
    
    statusDot.style.background = isOnline ? '#10B981' : '#EF4444';
    
    statusText.textContent = isOnline ? 'Aktif' : 'Pasif';
    statusText.style.color = isOnline ? '#10B981' : '#EF4444';
}

async function loadCourierStatusIndicator() {
    const indicator = document.getElementById('courier-status-indicator');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    
    if (!indicator || !statusDot || !statusText) return;
    
    try {
        const profile = await fetchCourierProfile();
        if (profile) {
            const status = profile.status || 'online';
            updateCourierStatusIndicator(status);
            // İndikatör görünür yap
            indicator.style.display = 'flex';
        }
    } catch (error) {
        updateCourierStatusIndicator('online');
        indicator.style.display = 'flex';
    }
}

function initializeDashboardPage() {
    loadActiveTasks();
    loadCourierStatusIndicator();
}


function createTransactionItemHTML(transaction) {
    let typeClass = transaction.type;
    if (!typeClass) {
        typeClass = 'income';
    }
    
    let sign;
    if (typeClass === 'income') {
        sign = '+';
    } else {
        sign = '-';
    }
    
    const formattedDate = (() => {
        try {
            return new Date(transaction.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
        } catch (e) {
            return '';
        }
    })();

    let amount = transaction.amount;
    if (!amount) {
        amount = 0;
    }

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
                ${sign}${amount.toFixed(2)} TL
            </div>
        </div>
    `;
}

async function updateHistoryStats(allTransactions) {
    try {
        const earnings = await fetchCourierEarnings('month');
        if (earnings && earnings.stats) {
            const totalEarnings = earnings.stats.totalEarnings || 0;
            const totalDeliveries = earnings.stats.totalDeliveries || 0;
            
            const balanceValue = document.querySelector('.stat-grid .stat-card:nth-child(1) .stat-value');
            const deliveryValue = document.querySelector('.stat-grid .stat-card:nth-child(2) .stat-value');

            if (balanceValue) {
                balanceValue.textContent = `${totalEarnings.toFixed(2)} TL`;
            }
            if (deliveryValue) {
                deliveryValue.textContent = totalDeliveries;
            }
        } else {
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
    } catch (error) {}
}

async function loadHistoryData() {
    const transactionListContainer = document.querySelector('.transaction-list');
    let historyCardContent = document.querySelector('.card:nth-child(2) .card-content');
    if (!historyCardContent) {
        historyCardContent = document.querySelector('.card .card-content');
    }
    
    await updateHistoryStats([]);

    if (!transactionListContainer || !historyCardContent) return;

    transactionListContainer.innerHTML = '<p>Yükleniyor...</p>';

    try {
        const data = await fetchHistoryTasks(1, 50);
        const historyOrders = data.tasks || [];

        if (historyOrders.length === 0) {
            if (transactionListContainer) {
                transactionListContainer.innerHTML = `
                    <div class="empty-state" style="text-align: center; padding: 4rem 2rem;">
                        <div class="empty-state-icon" style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.5;">📋</div>
                        <div class="empty-state-title" style="font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-color);">Henüz teslimat geçmişi bulunmamaktadır.</div>
                        <div class="empty-state-message" style="font-size: 1rem; color: var(--text-color-light);">Tamamladığınız teslimatlar burada görünecektir.</div>
                    </div>
                `;
            }
            await updateHistoryStats([]);
            return;
        }

        let transactions = historyOrders.map(order => ({
            type: 'income',
            description: `#${order.orderNumber || order.id} Nolu Teslimat Kazancı`,
            date: order.deliveredAt || order.createdAt,
            amount: order.payout || 0,
            id: order.id
        }));

        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        updateHistoryStats(transactions);

        transactionListContainer.innerHTML = '';

        if (transactions.length > 0) {
            transactions.forEach(t => {
                transactionListContainer.insertAdjacentHTML('beforeend', createTransactionItemHTML(t));
            });
        } else {
            transactionListContainer.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 4rem 2rem;">
                    <div class="empty-state-icon" style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.5;">📋</div>
                    <div class="empty-state-title" style="font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-color);">Henüz teslimat geçmişi bulunmamaktadır.</div>
                    <div class="empty-state-message" style="font-size: 1rem; color: var(--text-color-light);">Tamamladığınız teslimatlar burada görünecektir.</div>
                </div>
            `;
        }
    } catch (error) {
        transactionListContainer.innerHTML = '<p style="text-align: center; padding: 2rem; color: #E74C3C;">Geçmiş görevler yüklenirken hata oluştu.</p>';
    }
}

function initializeHistoryPage() {
    loadHistoryData();
}


document.addEventListener('DOMContentLoaded', () => {
    initializeLogout();

    const path = window.location.pathname || window.location.href;

    try {
        if (path.includes('/courier/') && path.includes('/profile')) {
            initializeProfilePage();
        } else if (path.includes('/courier/available')) {
            initializeAvailablePage();
        } else if (path.includes('/courier/dashboard')) {
            initializeDashboardPage();
        } else if (path.includes('/courier/history')) {
            initializeHistoryPage();
        } else {
            if (path.includes('profile.html')) {
                initializeProfilePage();
            } else if (path.includes('available.html')) {
                initializeAvailablePage();
            } else if (path.includes('dashboard.html')) {
                initializeDashboardPage();
            } else if (path.includes('history.html')) {
                initializeHistoryPage();
            } else {
                if (document.querySelector('.transaction-list')) {
                    initializeHistoryPage();
                } else if (document.querySelector('.available-orders-list')) {
                    initializeAvailablePage();
                } else if (document.querySelector('#courier-profile-form')) {
                    initializeProfilePage();
                } else if (document.querySelector('main .card')) {
                    initializeDashboardPage();
                }
            }
        }
    } catch (e) {}
});