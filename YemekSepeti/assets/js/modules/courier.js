async function fetchAvailableTasks() {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        // DÜZELTİLEN YER 1: /api/courier/tasks/available yerine /api/courier/available (README'ye göre)
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

async function pickupTask(taskId) {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/courier/tasks/${taskId}/pickup`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Paket teslim alındı olarak işaretlenemedi');
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

async function fetchTaskDetail(orderId) {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/courier/tasks/${orderId}`, { credentials: 'include' });
        if (!response.ok) throw new Error('Detay yüklenemedi');
        const data = await response.json();
        return data.success ? data.task : null;
    } catch (error) {
        return null;
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
    const logoutBtn = document.getElementById('sidebar-logout-btn') || document.getElementById('courier-logout-btn');
    if (!logoutBtn) return;

    logoutBtn.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();

        // window.logout varsa onu kullan (header.js'den geliyor, cookie/session temizliği yapar)
        if (window.logout) {
            window.logout();
        } else {
            // Fallback: basit çıkış
            try {
                localStorage.clear();
                sessionStorage.clear();
            } catch(e) {}
            const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
            window.location.href = `${baseUrl}/`;
        }
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
                <div class="route-point" style="border-left: 3px solid #4CAF50; padding-left: 10px;">
                    <strong>📍 Alış:</strong> ${order.pickup || 'Belirtilmemiş'}
                    ${order.pickupLocation ? `<div style="font-size:0.85rem; color:var(--text-color-light); margin-top:2px;">${order.pickupLocation}</div>` : ''}
                </div>
                <div class="route-point" style="border-left: 3px solid #E74C3C; padding-left: 10px; margin-top: 8px;">
                    <strong>📍 Teslim:</strong> ${order.dropoffFullAddress || order.dropoff || 'Belirtilmemiş'}
                </div>
            </div>
            <div id="available-map-${order.id}" class="available-order-map" style="height: 0; overflow: hidden; transition: height 0.3s ease; border-radius: 8px; margin: 8px 0;"></div>
            <div class="order-payout">
                <span>Tahmini Kazanç</span>
                <strong>${(order.payout || 0).toFixed(2)} TL</strong>
                <button class="btn btn-secondary btn-full toggle-map-btn" data-order-id="${order.id}" data-pickup="${encodeURIComponent(order.pickup || '')}" data-pickup-location="${encodeURIComponent(order.pickupLocation || '')}" data-dropoff="${encodeURIComponent(order.dropoffFullAddress || order.dropoff || '')}" data-dropoff-lat="${order.dropoffLat || ''}" data-dropoff-lng="${order.dropoffLng || ''}" style="margin-top: 0.5rem; font-size: 0.85rem;">
                    🗺️ Haritada Göster
                </button>
                <button class="btn btn-primary btn-full accept-order-btn" data-order-id="${order.id}" style="margin-top: 0.5rem;">Görevi Kabul Et</button>
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
    
    // Harita toggle butonları
    const mapButtons = document.querySelectorAll('.toggle-map-btn');
    mapButtons.forEach(button => {
        button.addEventListener('click', async function(e) {
            e.preventDefault();
            const orderId = this.getAttribute('data-order-id');
            const mapDiv = document.getElementById(`available-map-${orderId}`);
            if (!mapDiv) return;
            
            // Toggle
            if (mapDiv.style.height !== '0px' && mapDiv.style.height !== '') {
                mapDiv.style.height = '0px';
                this.innerHTML = '🗺️ Haritada Göster';
                return;
            }
            
            mapDiv.style.height = '280px';
            this.innerHTML = '🗺️ Haritayı Gizle';
            
            // Zaten harita yükediyse tekrar yükleme
            if (mapDiv.querySelector('.leaflet-container')) return;
            
            const pickup = decodeURIComponent(this.getAttribute('data-pickup') || '');
            const pickupLocation = decodeURIComponent(this.getAttribute('data-pickup-location') || '');
            const dropoff = decodeURIComponent(this.getAttribute('data-dropoff') || '');
            const dropoffLat = parseFloat(this.getAttribute('data-dropoff-lat')) || null;
            const dropoffLng = parseFloat(this.getAttribute('data-dropoff-lng')) || null;
            
            // Mini harita oluştur
            try {
                let dropCoords = null;
                if (dropoffLat && dropoffLng) {
                    dropCoords = [dropoffLat, dropoffLng];
                } else if (dropoff) {
                    dropCoords = await geocodeAddress(dropoff);
                }
                
                let pickCoords = null;
                const pickTarget = pickupLocation || pickup;
                if (pickTarget) {
                    pickCoords = await geocodeAddress(pickTarget);
                }
                
                if (!pickCoords && !dropCoords) {
                    mapDiv.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#E74C3C;font-size:0.9rem;">Adres bulunamadı</div>';
                    return;
                }
                
                const center = pickCoords || dropCoords;
                const miniMap = L.map(mapDiv).setView(center, 13);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OSM',
                    maxZoom: 19
                }).addTo(miniMap);
                
                if (pickCoords && dropCoords) {
                    L.marker(pickCoords).addTo(miniMap).bindPopup('🏢 Restoran');
                    L.marker(dropCoords).addTo(miniMap).bindPopup('🏠 Teslimat');

                    const miniRoute = await fetchFastestRoute([pickCoords, dropCoords]);
                    if (miniRoute && miniRoute.coordinates && miniRoute.coordinates.length >= 2) {
                        const line = L.polyline(miniRoute.coordinates, { color: '#E74C3C', opacity: 0.85, weight: 5 }).addTo(miniMap);
                        miniMap.fitBounds(line.getBounds(), { padding: [16, 16] });
                    } else {
                        const line = L.polyline([pickCoords, dropCoords], { color: '#E74C3C', opacity: 0.8, weight: 4, dashArray: '10, 8' }).addTo(miniMap);
                        miniMap.fitBounds(line.getBounds(), { padding: [16, 16] });
                    }
                } else {
                    L.marker(center).addTo(miniMap).bindPopup(pickCoords ? '🏢 Restoran' : '🏠 Teslimat').openPopup();
                }
                
                setTimeout(() => miniMap.invalidateSize(), 350);
            } catch (err) {
                mapDiv.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#E74C3C;font-size:0.9rem;">Harita yüklenemedi</div>';
            }
        });
    });
}

async function loadAvailableOrders() {
    const ordersListContainer = document.querySelector('.available-orders-list');
    if (!ordersListContainer) return;

    ordersListContainer.innerHTML = '<p>Yükleniyor...</p>';

    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        // DÜZELTİLEN YER 3: /api/courier/tasks/available yerine /api/courier/available
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
                pickupLocation: task.pickupLocation || '',
                dropoff: task.dropoff,
                dropoffFullAddress: task.dropoffFullAddress || task.dropoff,
                dropoffLat: task.dropoffLat || null,
                dropoffLng: task.dropoffLng || null,
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
    setupCourierAutoRefresh('available');
    connectCourierSocket();
}


async function handleTaskComplete(event) {
    const btn = event.currentTarget;
    const orderId = btn ? btn.getAttribute('data-order-id') : null;
    if (!orderId) return;

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Teslimat Onaylanıyor...';
    }

    try {
        await completeTask(parseInt(orderId));
        displayMessage('✅ Görev #' + orderId + ' başarıyla tamamlandı ve Teslimat Geçmişine eklendi!', 'success');
        setTimeout(function() { loadActiveTasks(); }, 1000);
    } catch (error) {
        if (btn && btn.parentNode) {
            btn.disabled = false;
            btn.textContent = '✅ Teslim Ettim';
        }
        displayMessage('❌ ' + (error && error.message ? error.message : 'İşlem başarısız.'), 'error');
    }
}

async function handleTaskPickup(event) {
    const btn = event.currentTarget;
    const orderId = btn ? btn.getAttribute('data-order-id') : null;
    if (!orderId || btn.classList.contains('animation')) return;

    const box = btn.querySelector('.box');
    const truck = btn.querySelector('.truck');

    if (!box || !truck) return;

    // Animasyonu başlat
    btn.classList.add('animation');

    // Ana timeline – tüm animasyonu tek bir timeline ile senkronize yönet
    const btnW = btn.offsetWidth || 300;
    const truckW = truck.offsetWidth || 72;
    const finalX = btnW - truckW - 16;

    const tl = gsap.timeline({
        onComplete: function () {
            btn.classList.add('done');
            // Animasyon bittikten 1 saniye sonra paneli yenile ("Teslim Edildi" butonu gelsin)
            setTimeout(function () { loadActiveTasks(); }, 1000);
        }
    });

    // 1) Kutuyu göster ve tıra yükle (0 – 1.3s)
    tl.to(btn, { '--box-s': 1, '--box-o': 1, duration: 0.3 }, 0.5)
      .to(btn, { '--box-x': 0, duration: 0.4 }, 0.7)
      .to(btn, { '--hx': -5, '--bx': 50, duration: 0.18 }, 0.92)
      .to(btn, { '--box-y': 0, duration: 0.1 }, 1.15)

    // 2) Tır sola → sağa doğru düzgün tek seferde gitsin (1.5s – 3.5s)
      .to(btn, {
          '--truck-x': finalX,
          duration: 2,
          ease: 'power1.inOut'
      }, 1.5)

    // 3) İlerleme çubuğu tırla birlikte dolsun
      .to(btn, {
          '--progress': 1,
          duration: 2,
          ease: 'power1.inOut'
      }, 1.5);

    try {
        await pickupTask(parseInt(orderId));
        displayMessage('✅ Sipariş #' + orderId + ' için paket teslim alındı. Rota teslimat noktasına güncelleniyor...', 'success');
    } catch (error) {
        tl.kill();
        btn.classList.remove('animation', 'done');
        gsap.killTweensOf(btn);
        displayMessage('❌ ' + (error && error.message ? error.message : 'İşlem başarısız.'), 'error');
    }
}

// --- HARİTA VE ROTA FONKSİYONLARI ---

let activeCourierMap = null;
let activeCourierRoutingControl = null;
let idleCourierMap = null;
let courierDashboardRefreshInterval = null;
let courierAvailableRefreshInterval = null;
const COURIER_AUTO_REFRESH_MS = 3000;
let courierSocket = null;
let lastRenderedActiveTaskKey = null;
let lastRenderedDashboardMode = null;
let courierLocationInterval = null;
let hasShownGeoPermissionWarning = false;

async function resolveCourierSocketUserId() {
    try {
        const localUserRaw = localStorage.getItem('user');
        if (localUserRaw) {
            const localUser = JSON.parse(localUserRaw);
            if (localUser && localUser.id) {
                return String(localUser.id);
            }
        }
    } catch (e) {}

    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const res = await fetch(`${baseUrl}/api/auth/me`, { credentials: 'include' });
        if (!res.ok) return null;
        const data = await res.json();
        if (data && data.success && data.user && data.user.id) {
            return String(data.user.id);
        }
        return null;
    } catch (e) {
        return null;
    }
}

function connectCourierSocketWhenReady() {
    if (courierSocket) return;
    let retries = 0;
    const maxRetries = 50;
    const interval = setInterval(async () => {
        retries++;
        if (typeof io === 'undefined') {
            if (retries >= maxRetries) clearInterval(interval);
            return;
        }
        clearInterval(interval);
        await connectCourierSocket();
    }, 100);
}
window.connectCourierSocketWhenReady = connectCourierSocketWhenReady;

async function connectCourierSocket() {
    if (courierSocket) return;
    if (typeof io === 'undefined') {
        connectCourierSocketWhenReady();
        return;
    }

    const userId = await resolveCourierSocketUserId();
    if (!userId) return;

    try {
        courierSocket = (typeof window.createAppSocket === 'function' ? window.createAppSocket({
            query: { userId, role: 'courier' },
            transports: ['polling'],
            upgrade: false,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        }) : io({
            query: { userId, role: 'courier' },
            transports: ['polling'],
            upgrade: false,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        }));

        if (!courierSocket) return;
        courierSocket.on('courier_task_assigned', async (payload) => {
            lastRenderedActiveTaskKey = null;
            lastRenderedDashboardMode = null;
            const path = window.location.pathname || '';
            if (path.includes('/courier/available')) {
                loadAvailableOrders();
            }
            if (path.includes('/courier/dashboard')) {
                loadActiveTasks();
                loadCourierStatusIndicator();
            }
            playCourierTaskSound();
            const taskId = payload && payload.taskId ? payload.taskId : null;
            if (!taskId) {
                displayMessage('🆕 Yeni görev atandı! Panel güncellendi.', 'success');
                return;
            }

            const confirmed = await askCourierTaskApproval(taskId);
            if (confirmed === true) {
                await acceptAssignedTask(taskId);
            } else if (confirmed === false) {
                await rejectAssignedTask(taskId);
            }
        });

        courierSocket.on('disconnect', () => {
            courierSocket = null;
            setTimeout(() => connectCourierSocket(), 1500);
        });

        courierSocket.on('connect_error', () => {
            courierSocket = null;
        });
    } catch (e) {
        courierSocket = null;
    }
}

async function askCourierTaskApproval(taskId) {
    const question = `Yeni bir teslimat görevi atandı (#${taskId}). Bu görevi kabul etmek istiyor musunuz?`;
    try {
        if (typeof window.showConfirm === 'function') {
            return await window.showConfirm(question);
        }
    } catch (e) {}

    try {
        return window.confirm(question);
    } catch (e) {
        return null;
    }
}

function clearCourierAutoRefresh() {
    if (courierDashboardRefreshInterval) {
        clearInterval(courierDashboardRefreshInterval);
        courierDashboardRefreshInterval = null;
    }
    if (courierAvailableRefreshInterval) {
        clearInterval(courierAvailableRefreshInterval);
        courierAvailableRefreshInterval = null;
    }
    if (courierLocationInterval) {
        clearInterval(courierLocationInterval);
        courierLocationInterval = null;
    }
}

function setupCourierAutoRefresh(mode) {
    clearCourierAutoRefresh();

    // Socket koparsa F5 gerekmesin diye düşük frekanslı fallback senkronizasyon.
    const refreshMs = Math.max(COURIER_AUTO_REFRESH_MS, 10000);

    if (mode === 'dashboard') {
        courierDashboardRefreshInterval = setInterval(() => {
            if (document.hidden) return;
            loadActiveTasks();
            loadCourierStatusIndicator();
        }, refreshMs);
    }

    if (mode === 'available') {
        courierAvailableRefreshInterval = setInterval(() => {
            if (document.hidden) return;
            loadAvailableOrders();
        }, refreshMs);
    }
}

function playCourierTaskSound() {
    try {
        if ('speechSynthesis' in window) {
            const now = Date.now();
            const utter = new SpeechSynthesisUtterance('Yeni teslimat görevi atandı');
            utter.lang = 'tr-TR';
            window.speechSynthesis.speak(utter);
        }
    } catch (e) {
    }
}

async function acceptAssignedTask(taskId) {
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const response = await fetch(`${baseUrl}/api/courier/tasks/${taskId}/accept-assigned`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json().catch(() => ({ success: false }));
        if (!response.ok || !data.success) {
            displayMessage('❌ Görev kabul edilemedi: ' + (data.message || response.status), 'error');
            return;
        }
        displayMessage('✅ Görev kabul edildi.', 'success');
        loadActiveTasks();
        loadAvailableOrders();
    } catch (error) {
        displayMessage('❌ Görev kabul edilirken hata oluştu.', 'error');
    }
}

async function rejectAssignedTask(taskId) {
    try {
        const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
        const response = await fetch(`${baseUrl}/api/courier/tasks/${taskId}/reject-assigned`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json().catch(() => ({ success: false }));
        if (!response.ok || !data.success) {
            displayMessage('❌ Görev reddedilemedi: ' + (data.message || response.status), 'error');
            return;
        }
        displayMessage(data.message || 'Görev reddedildi.', 'success');
        loadActiveTasks();
        loadAvailableOrders();
    } catch (error) {
        displayMessage('❌ Görev reddedilirken hata oluştu.', 'error');
    }
}

async function geocodeAddress(address) {
    try {
        const searchAddress = `${address}, Türkiye`;
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddress)}&limit=1&accept-language=tr`);
        const data = await response.json();
        
        if (data && data.length > 0) {
            return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        }
        return null;
    } catch (error) {
        console.error("Geocoding hatası:", error);
        return null;
    }
}

async function sendCourierLocation(orderId, latitude, longitude) {
    try {
        const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
        const response = await fetch(`${baseUrl}/api/courier/tasks/${orderId}/location`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude, longitude })
        });
        return response.ok;
    } catch (e) {
        return false;
    }
}

async function getCourierCurrentPosition() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }

        try {
            if (navigator.permissions && typeof navigator.permissions.query === 'function') {
                navigator.permissions.query({ name: 'geolocation' }).then((status) => {
                    if (status && status.state === 'denied' && !hasShownGeoPermissionWarning) {
                        if (typeof displayMessage === 'function') {
                            displayMessage('ℹ️ Konum izni kapalı. Harita yine çalışır, ama canlı konum görünmez.', 'info');
                        }
                        hasShownGeoPermissionWarning = true;
                    }
                }).catch(() => {});
            }
        } catch (e) {}

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve([position.coords.latitude, position.coords.longitude]);
            },
            (error) => {
                if (!hasShownGeoPermissionWarning) {
                    const denied = error && error.code === 1;
                    const blockedMsg = denied
                        ? 'Konum izni engelli (Access blocked). Tarayıcı ayarlarından bu site için konumu "İzin ver" yapın.'
                        : 'Konum alınamadı. Harita varsayılan merkezle gösterilecek.';
                    if (typeof displayMessage === 'function') {
                        displayMessage('ℹ️ ' + blockedMsg, denied ? 'error' : 'info');
                    }
                    hasShownGeoPermissionWarning = true;
                }
                resolve(null);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
}

async function fetchFastestRoute(waypointCoords) {
    try {
        if (!Array.isArray(waypointCoords) || waypointCoords.length < 2) {
            return null;
        }

        const path = waypointCoords
            .map((point) => `${point[1]},${point[0]}`)
            .join(';');

        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson&alternatives=false&steps=false`);
        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        if (!data || !data.routes || !data.routes.length) {
            return null;
        }

        const route = data.routes[0];
        const coordinates = (route.geometry?.coordinates || []).map((coord) => [coord[1], coord[0]]);

        return {
            coordinates,
            distanceKm: (route.distance || 0) / 1000,
            durationMin: Math.round((route.duration || 0) / 60)
        };
    } catch (error) {
        return null;
    }
}

// Haritayı başlat – koordinatlar varsa doğrudan kullan, yoksa geocoding yap
async function initCourierMap(options) {
    const mapContainer = document.getElementById('courier-map');
    if (!mapContainer) return;
    if (typeof L === 'undefined') {
        mapContainer.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%; color:#E74C3C; text-align:center; padding: 20px;">Harita kütüphanesi yüklenemedi. Sayfayı yenileyip tekrar deneyin.</div>';
        return;
    }

    // options: { pickupAddress, pickupLocation, dropoffAddress, dropoffFullAddress, dropoffLat, dropoffLng, includePickupStop }
    const opts = options || {};
    const includePickupStop = opts.includePickupStop !== false;

    try {
        if (activeCourierRoutingControl && activeCourierMap) {
            try {
                activeCourierMap.removeControl(activeCourierRoutingControl);
            } catch (e) {}
            activeCourierRoutingControl = null;
        }

        if (activeCourierMap) {
            try {
                activeCourierMap.remove();
            } catch (e) {}
            activeCourierMap = null;
        }

        if (mapContainer._leaflet_id) {
            try {
                delete mapContainer._leaflet_id;
            } catch (e) {}
        }

        // Kurye canlı konumu
        const courierCoords = await getCourierCurrentPosition();

        // Teslimat noktası – önce DB koordinatları, yoksa geocoding
        let dropoffCoords = null;
        if (opts.dropoffLat && opts.dropoffLng) {
            dropoffCoords = [parseFloat(opts.dropoffLat), parseFloat(opts.dropoffLng)];
            if (Number.isNaN(dropoffCoords[0]) || Number.isNaN(dropoffCoords[1])) {
                dropoffCoords = null;
            }
        } else {
            const geocodeTarget = opts.dropoffFullAddress || opts.dropoffAddress || '';
            if (geocodeTarget) {
                dropoffCoords = await geocodeAddress(geocodeTarget);
            }
        }

        // Alış noktası – seller location veya isim ile geocoding
        let pickupCoords = null;
        const pickupGeoTarget = opts.pickupLocation || opts.pickupAddress || '';
        if (includePickupStop && pickupGeoTarget) {
            pickupCoords = await geocodeAddress(pickupGeoTarget);
        }

        if (!courierCoords && !pickupCoords && !dropoffCoords) {
            mapContainer.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%; color:#E74C3C; text-align:center; padding: 20px;">Adresler tam olarak tespit edilemediği için harita gösterilemiyor.<br>Lütfen aşağıdaki adres metinlerini takip edin.</div>';
            return;
        }

        // Merkez noktası
        const center = courierCoords || pickupCoords || dropoffCoords;
        mapContainer.innerHTML = '';

        const map = L.map('courier-map', { preferCanvas: true }).setView(center, 13);
        activeCourierMap = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);

        // Rota: kurye canlı konumu -> restoran (pickup aşamasıysa) -> müşteri
        const routeWaypoints = [];
        if (courierCoords) routeWaypoints.push(L.latLng(courierCoords[0], courierCoords[1]));
        if (includePickupStop && pickupCoords) routeWaypoints.push(L.latLng(pickupCoords[0], pickupCoords[1]));
        if (dropoffCoords) routeWaypoints.push(L.latLng(dropoffCoords[0], dropoffCoords[1]));

        const uniqueWaypoints = routeWaypoints.filter((wp, index, arr) => {
            const key = `${wp.lat.toFixed(6)},${wp.lng.toFixed(6)}`;
            return arr.findIndex((x) => `${x.lat.toFixed(6)},${x.lng.toFixed(6)}` === key) === index;
        });

        if (uniqueWaypoints.length >= 2) {
            const icons = {
                courier: L.divIcon({ className: 'courier-map-marker courier-marker', html: '<div style="background:#2563EB;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,.3);">🛵</div>', iconSize: [32, 32], iconAnchor: [16, 16] }),
                pickup: L.divIcon({ className: 'courier-map-marker pickup-marker', html: '<div style="background:#4CAF50;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,.3);">🏢</div>', iconSize: [32, 32], iconAnchor: [16, 16] }),
                dropoff: L.divIcon({ className: 'courier-map-marker dropoff-marker', html: '<div style="background:#E74C3C;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,.3);">🏠</div>', iconSize: [32, 32], iconAnchor: [16, 16] })
            };

            if (courierCoords) {
                L.marker(courierCoords, { icon: icons.courier }).addTo(map).bindPopup('🛵 Kurye Konumu (Canlı)');
            }
            if (includePickupStop && pickupCoords) {
                L.marker(pickupCoords, { icon: icons.pickup }).addTo(map).bindPopup(`🏢 Restoran (Alış)<br>${opts.pickupAddress || opts.pickupLocation || ''}`);
            }
            if (dropoffCoords) {
                L.marker(dropoffCoords, { icon: icons.dropoff }).addTo(map).bindPopup(`🏠 Müşteri (Teslimat)<br>${opts.dropoffFullAddress || opts.dropoffAddress || ''}`);
            }

            const waypointCoords = uniqueWaypoints.map((wp) => [wp.lat, wp.lng]);
            const route = await fetchFastestRoute(waypointCoords);

            let drawnLine = null;
            if (route && route.coordinates && route.coordinates.length >= 2) {
                drawnLine = L.polyline(route.coordinates, { color: '#E74C3C', weight: 6, opacity: 0.85 }).addTo(map);
                const infoDiv = document.getElementById('route-info');
                if (infoDiv) {
                    infoDiv.innerHTML = `<span>📏 ${route.distanceKm.toFixed(1)} km</span> &nbsp;|&nbsp; <span>⏱️ ~${route.durationMin} dk</span>`;
                    infoDiv.style.display = 'flex';
                }
            } else {
                drawnLine = L.polyline(waypointCoords, { color: '#E74C3C', weight: 4, opacity: 0.8, dashArray: '10, 8' }).addTo(map);
            }

            if (drawnLine) {
                map.fitBounds(drawnLine.getBounds(), { padding: [24, 24] });
            }
        } else {
            // Sadece mevcut noktayı işaretle
            const coords = courierCoords || pickupCoords || dropoffCoords;
            const label = courierCoords ? '🛵 Kurye Konumu (Canlı)' : (pickupCoords ? '🏢 Restoran (Alış)' : '🏠 Müşteri (Teslimat)');
            L.marker(coords).addTo(map).bindPopup(label).openPopup();
        }

    } catch (error) {
        mapContainer.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%; color:#E74C3C;">Harita yüklenirken beklenmeyen bir hata oluştu.</div>';
        console.error("Harita başlatma hatası:", error);
    }
}

async function initIdleCourierMap() {
    const mapContainer = document.getElementById('courier-map-idle');
    if (!mapContainer || typeof L === 'undefined') return;

    try {
        if (idleCourierMap) {
            try {
                idleCourierMap.remove();
            } catch (e) {}
            idleCourierMap = null;
        }

        if (mapContainer._leaflet_id) {
            try {
                delete mapContainer._leaflet_id;
            } catch (e) {}
        }

        mapContainer.innerHTML = '';

        const courierCoords = await getCourierCurrentPosition();
        const istanbulCenter = [41.0082, 28.9784];
        const center = courierCoords || istanbulCenter;
        const zoomLevel = courierCoords ? 14 : 11;

        const map = L.map('courier-map-idle').setView(center, zoomLevel);
        idleCourierMap = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);

        L.marker(center)
            .addTo(map)
            .bindPopup(courierCoords
                ? '🛵 Mevcut konumunuz gösteriliyor. Aktif görev geldiğinde rota otomatik çizilir.'
                : '📍 Konum izni yok, varsayılan merkez gösteriliyor. Aktif görev geldiğinde rota burada otomatik gösterilir.')
            .openPopup();
    } catch (error) {
        mapContainer.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%; color:#666;">Harita yüklenemedi.</div>';
    }
}

function createActiveTaskCard(order) {
    const dropoffName = (order.dropoff || '').split('(')[0].trim();
    const dropoffFull = order.dropoffFullAddress || dropoffName;
    const pickupAddr = (order.pickup || '') + (order.pickupLocation ? ', ' + order.pickupLocation : '');
    const isPickedUp = !!order.isPickedUp;
    const dropoffLat = order.dropoffLat != null && order.dropoffLng != null ? order.dropoffLat + ',' + order.dropoffLng : '';
    const dropoffEnc = encodeURIComponent(dropoffFull);
    const pickupEnc = encodeURIComponent(pickupAddr.trim() || order.pickup || '');

    const statusText = isPickedUp
        ? 'Durum: Restorandan alındı / Teslimata gidiliyor'
        : 'Durum: Restorana gidiliyor';

    const cardHTML = `
        <div class="card-content">
            <h3 class="checkout-card-title">Aktif Görev: #${order.id}</h3>
            <div class="courier-task-status-badge ${isPickedUp ? 'is-picked-up' : 'is-pickup-pending'}">
                <span>${isPickedUp ? '🚚' : '🏢'}</span>
                <span>${statusText}</span>
            </div>
            
            <div id="courier-map" class="courier-task-map">
                <div class="courier-task-map-loading">
                    <div class="courier-task-map-loading-inner">
                        <div class="courier-task-map-loading-icon">🗺️</div>
                        Harita yükleniyor...
                    </div>
                </div>
            </div>
            
            <div id="route-info" class="courier-route-info"></div>
            <div class="courier-directions-row" style="margin-bottom: 1rem;">
                <button type="button" class="btn btn-secondary btn-open-google-maps" 
                    data-origin="current" 
                    data-destination="${dropoffEnc}" 
                    data-destination-lat-lng="${dropoffLat}"
                    data-waypoints="${isPickedUp ? '' : pickupEnc}"
                    data-travelmode="driving"
                    title="Mevcut konumdan hedefe Google Maps ile yol tarifi">
                    🧭 Google Maps ile Yol Tarifi
                </button>
            </div>
            
            <div class="task-details">
                <div class="task-step task-step-pickup ${isPickedUp ? 'task-step-picked-up' : 'task-step-pickup-pending active'}">
                    <strong>${isPickedUp ? '✅ 1. Adım — Restorandan Alındı:' : '📍 1. Adım — Restorandan Al:'}</strong>
                    <div class="courier-task-line">${order.pickup}</div>
                    ${order.pickupLocation ? `<div class="courier-task-subline">${order.pickupLocation}</div>` : ''}
                </div>
                <div class="task-step task-step-dropoff ${isPickedUp ? 'task-step-dropoff-active active' : 'task-step-dropoff-pending'}">
                    <strong>${isPickedUp ? '📍 2. Adım — Müşteriye Teslim Et (Aktif):' : '📍 2. Adım — Müşteriye Teslim Et:'}</strong>
                    <div class="courier-task-line">${dropoffFull}</div>
                </div>
            </div>
            
            <div class="courier-task-payout-box">
                <strong>Bu Görev Kazancı:</strong> <span class="courier-task-payout-amount">${order.payout.toFixed(2)} TL</span>
            </div>

            ${isPickedUp
                ? `<button class="btn btn-primary btn-full courier-task-action-btn complete-task-btn" data-order-id="${order.id}">✅ Teslim Ettim</button>`
                : `<button class="truck-button courier-task-action-btn pickup-task-btn" data-order-id="${order.id}">
                    <span class="default">📦 Paketi Teslim Aldım</span>
                    <span class="success">
                        Paket Alındı
                        <svg viewbox="0 0 12 10">
                            <polyline points="1.5 6 4.5 9 10.5 1"></polyline>
                        </svg>
                    </span>
                    <span class="truck">
                        <span class="wheel"></span>
                        <span class="back"></span>
                        <span class="front"></span>
                        <span class="box"></span>
                    </span>
                </button>`
            }
        </div>
    `;
    return cardHTML;
}

function openGoogleMapsDirections(btn) {
    if (!btn || !btn.dataset) return;
    var destLatLng = (btn.dataset.destinationLatLng || '').trim();
    var destAddr = (btn.dataset.destination || '').trim();
    var waypoints = (btn.dataset.waypoints || '').trim();
    var travelmode = (btn.dataset.travelmode || 'driving').toLowerCase();
    var destination = destLatLng && /^-?[\d.]+,-?[\d.]+$/.test(destLatLng.replace(/\s/g, ''))
        ? destLatLng
        : (destAddr ? (function(s) { try { return decodeURIComponent(s); } catch (e) { return s; } })(destAddr) : '');
    if (!destination) return;
    var params = new URLSearchParams();
    params.set('api', '1');
    params.set('travelmode', travelmode);
    params.set('destination', destination);
    if (waypoints) params.set('waypoints', (function(s) { try { return decodeURIComponent(s); } catch (e) { return s; } })(waypoints));
    window.open('https://www.google.com/maps/dir/?' + params.toString(), '_blank', 'noopener,noreferrer');
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
    const taskContainer = document.getElementById('courier-dashboard-task-card') || document.querySelector('main .card:not(.stat-card)') || document.querySelector('main .card');

    if (!taskContainer) return;

    await updateStats(); 

    try {
        const tasks = await fetchActiveTasks();
        
        if (tasks.length > 0) {
            const activeTask = tasks[0];
            const isPickedUp = !!activeTask.pickedUpAt;
            const activeTaskKey = [
                activeTask.id,
                isPickedUp ? 1 : 0,
                activeTask.dropoffLat || '',
                activeTask.dropoffLng || ''
            ].join(':');

            const hasExistingTaskCard = !!taskContainer.querySelector('.courier-task-action-btn');

            // Animasyon devam ediyorsa yeniden render etme (animasyonu kesme)
            if (taskContainer.querySelector('.truck-button.animation:not(.done)')) {
                return;
            }

            // Auto-refresh sırasında görev aynıysa haritayı tekrar kurma.
            if (hasExistingTaskCard && lastRenderedDashboardMode === 'active' && lastRenderedActiveTaskKey === activeTaskKey) {
                return;
            }

            taskContainer.innerHTML = createActiveTaskCard({
                id: activeTask.id,
                pickup: activeTask.pickup,
                pickupLocation: activeTask.pickupLocation || '',
                dropoff: activeTask.dropoff,
                dropoffFullAddress: activeTask.dropoffFullAddress || activeTask.dropoff,
                dropoffLat: activeTask.dropoffLat ?? null,
                dropoffLng: activeTask.dropoffLng ?? null,
                payout: activeTask.payout,
                isPickedUp: isPickedUp
            });

            lastRenderedActiveTaskKey = activeTaskKey;
            lastRenderedDashboardMode = 'active';

            if (courierLocationInterval) clearInterval(courierLocationInterval);
            courierLocationInterval = setInterval(async () => {
                if (document.hidden) return;
                const pos = await getCourierCurrentPosition();
                if (pos && pos[0] != null && pos[1] != null) await sendCourierLocation(activeTask.id, pos[0], pos[1]);
            }, 15000);

            const pickupBtn = taskContainer.querySelector('.pickup-task-btn');
            if (pickupBtn) {
                pickupBtn.addEventListener('click', handleTaskPickup);
            }

            const completeBtn = taskContainer.querySelector('.complete-task-btn');
            if (completeBtn) {
                completeBtn.addEventListener('click', handleTaskComplete);
            }

            const googleMapsBtn = taskContainer.querySelector('.btn-open-google-maps');
            if (googleMapsBtn) {
                googleMapsBtn.addEventListener('click', function() { openGoogleMapsDirections(this); });
            }

            // Haritayı başlat — yeni koordinat desteği ile
            setTimeout(() => {
                initCourierMap({
                    pickupAddress: activeTask.pickup,
                    pickupLocation: activeTask.pickupLocation || '',
                    dropoffAddress: activeTask.dropoff,
                    dropoffFullAddress: activeTask.dropoffFullAddress || activeTask.dropoff,
                    dropoffLat: activeTask.dropoffLat || null,
                    dropoffLng: activeTask.dropoffLng || null,
                    includePickupStop: !isPickedUp
                });
            }, 300);

        } else {
            const hasIdleMapAlready = !!document.getElementById('courier-map-idle');
            if (hasIdleMapAlready && lastRenderedDashboardMode === 'idle') {
                return;
            }

            const pathMatch = window.location.pathname.match(/\/courier\/(\d+)/);
            const courierId = pathMatch ? pathMatch[1] : (localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).courierId || JSON.parse(localStorage.getItem('user')).id : '');
            
            taskContainer.innerHTML = `
                <div class="card-content">
                    <h3 class="checkout-card-title">Aktif Görev Yok</h3>
                    <p>Şu anda teslimat rotanda bekleyen aktif bir görevin bulunmamaktadır.</p>
                    <div id="courier-map-idle" style="height: 320px; width: 100%; border-radius: 12px; margin: 12px 0; border: 2px solid var(--border-color);"></div>
                    <a href="/courier/${courierId}/available" class="btn btn-secondary btn-full" style="margin-top: 1rem;">Yeni Görevlere Git</a>
                </div>
            `;

            lastRenderedActiveTaskKey = null;
            lastRenderedDashboardMode = 'idle';
            if (courierLocationInterval) { clearInterval(courierLocationInterval); courierLocationInterval = null; }

            setTimeout(() => {
                initIdleCourierMap();
            }, 150);
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
    setupCourierAutoRefresh('dashboard');
    connectCourierSocket();
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

    const orderId = transaction.id || transaction.orderId;
    const detailBtn = orderId
        ? `<button type="button" class="btn btn-secondary btn-sm courier-history-detail-btn" data-order-id="${orderId}" style="margin-left: 0.5rem;">Detay</button>`
        : '';

    return `
        <div class="transaction-item" data-order-id="${orderId || ''}">
            <div class="transaction-icon ${typeClass}">
                <span>${sign}</span>
            </div>
            <div class="transaction-details">
                <strong>${transaction.description}</strong>
                <span>${formattedDate}</span>
                ${detailBtn}
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
            attachCourierHistoryDetailButtons();
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

function attachCourierHistoryDetailButtons() {
    document.querySelectorAll('.courier-history-detail-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const orderId = this.getAttribute('data-order-id');
            if (!orderId) return;
            const modal = document.getElementById('courier-order-detail-modal');
            const body = document.getElementById('courier-detail-modal-body');
            const title = document.getElementById('courier-detail-modal-title');
            if (!modal || !body) return;
            modal.style.display = 'flex';
            body.innerHTML = '<p class="text-muted">Yükleniyor...</p>';
            title.textContent = 'Sipariş #' + orderId + ' Detayı';
            const task = await fetchTaskDetail(orderId);
            if (!task) {
                body.innerHTML = '<p style="color: #E74C3C;">Detay yüklenemedi.</p>';
                return;
            }
            const itemsHtml = (task.items || []).map(i => `
                <tr><td>${(i.meal_name || '').replace(/</g, '&lt;')}</td><td>${i.quantity}</td><td>${(i.meal_price || 0).toFixed(2)} TL</td><td>${(i.subtotal || 0).toFixed(2)} TL</td></tr>
            `).join('');
            const dropoff = task.dropoff && task.dropoff.fullAddress ? task.dropoff.fullAddress : (task.dropoff ? [task.dropoff.district, task.dropoff.city].filter(Boolean).join(', ') : '—');
            const customer = task.customer ? (task.customer.fullname || 'Müşteri') + ' — ' + (task.customer.phone || '***') : '—';
            body.innerHTML = `
                <p><strong>Sipariş No:</strong> ${(task.orderNumber || task.id).toString().replace(/</g, '&lt;')}</p>
                <p><strong>Durum:</strong> ${(task.status || 'delivered').toString().replace(/</g, '&lt;')}</p>
                <p><strong>Restoran:</strong> ${task.pickup && task.pickup.name ? (task.pickup.name + (task.pickup.address ? ', ' + task.pickup.address : '')).replace(/</g, '&lt;') : '—'}</p>
                <p><strong>Teslimat adresi:</strong> ${dropoff.replace(/</g, '&lt;')}</p>
                <p><strong>Müşteri:</strong> ${customer.replace(/</g, '&lt;')}</p>
                <table class="form-input" style="width:100%; margin: 0.5rem 0; border-collapse: collapse;">
                    <thead><tr><th>Ürün</th><th>Adet</th><th>Birim</th><th>Toplam</th></tr></thead>
                    <tbody>${itemsHtml}</tbody>
                </table>
                <p><strong>Ara Toplam:</strong> ${(task.subtotal || 0).toFixed(2)} TL &nbsp;|&nbsp; <strong>Kargo:</strong> ${(task.deliveryFee || 0).toFixed(2)} TL &nbsp;|&nbsp; <strong>Toplam:</strong> ${(task.totalAmount || 0).toFixed(2)} TL</p>
                <p><strong>Bu teslimat kazancınız:</strong> ${(task.payout || 0).toFixed(2)} TL</p>
                ${task.deliveredAt ? '<p><strong>Teslim tarihi:</strong> ' + new Date(task.deliveredAt).toLocaleString('tr-TR') + '</p>' : ''}
            `;
        });
    });

    const closeBtn = document.getElementById('courier-detail-modal-close');
    const modal = document.getElementById('courier-order-detail-modal');
    if (closeBtn && modal) {
        closeBtn.onclick = () => { modal.style.display = 'none'; };
    }
    if (modal) {
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    }
}

function initializeHistoryPage() {
    loadHistoryData();
}


document.addEventListener('DOMContentLoaded', () => {
    initializeLogout();

    const path = window.location.pathname || window.location.href;

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) return;

        if (path.includes('/courier/available') || path.includes('available.html')) {
            loadAvailableOrders();
        }

        if (path.includes('/courier/dashboard') || path.includes('dashboard.html')) {
            loadActiveTasks();
            loadCourierStatusIndicator();
        }
    });

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