const BUYER_API = {
    getProfile: async () => {
        try {
            const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
            const response = await fetch(`${baseUrl}/api/buyer/profile`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Profil yüklenemedi');
            const data = await response.json();
            return data.success ? data.user : null;
        } catch (error) {
            console.error('Profil yükleme hatası:', error);
            return null;
        }
    },
    updateProfileInfo: async (fullname, phone) => {
        try {
            const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
            const response = await fetch(`${baseUrl}/api/buyer/profile`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullname, phone: phone || null })
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
    },
    getAddresses: async () => {
        try {
            const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
            const response = await fetch(`${baseUrl}/api/buyer/addresses`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Adresler yüklenemedi');
            const data = await response.json();
            return data.success ? data.data : [];
        } catch (error) {
            console.error('Adresler yükleme hatası:', error);
            return [];
        }
    },
    
    addAddress: async (newAddressData) => {
        try {
            const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
            const response = await fetch(`${baseUrl}/api/buyer/addresses`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newAddressData)
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Adres eklenemedi');
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Adres ekleme hatası:', error);
            throw error;
        }
    },
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
    },
    changePassword: async (currentPassword, newPassword) => {
        try {
            const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
            const response = await fetch(`${baseUrl}/api/buyer/password`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Şifre değiştirilemedi');
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Şifre değiştirme hatası:', error);
            throw error;
        }
    }
};
// window.formatTL yoksa TL formatlama için yedek biçim
const formatTL = window.formatTL || function(amount) {
    return (amount || 0).toLocaleString('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};
const NEW_ADDRESS_FORM_HTML = `
    <div id="new-address-form-container" style="display: none; margin-top: 2rem;">
        <div class="card">
            <div class="card-content">
                <h4 style="margin-bottom: 1.5rem;">Yeni Adres Bilgileri</h4>
                <form id="new-address-form">
                    <div class="form-group">
                <label for="address-title" class="form-label">Adres Başlığı (Ev/İş/Diğer)</label>
                        <input type="text" class="form-input" id="address-title" placeholder="Örn: Ev, İş, Anne Evi" required>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="address-district" class="form-label">İlçe</label>
                            <input type="text" class="form-input" id="address-district" placeholder="Örn: Çerkezköy" required>
            </div>
                        <div class="form-group">
                <label for="address-city" class="form-label">İl</label>
                            <input type="text" class="form-input" id="address-city" placeholder="Örn: Tekirdağ" required>
                        </div>
            </div>
                    <div class="form-group">
                <label for="address-detail" class="form-label">Adres Detayı (Mahalle, Sokak, No...)</label>
                        <textarea class="form-input" id="address-detail" rows="3" placeholder="Mahalle, Sokak, Bina No, Daire No" required></textarea>
            </div>
                    <div class="form-group">
                <div class="form-check">
                            <input type="checkbox" id="address-default" class="form-check-input">
                            <label for="address-default" class="form-check-label">
                        Varsayılan Adres Yap
                    </label>
                </div>
            </div>
                    <div class="form-group">
                <button type="submit" class="btn btn-primary" id="save-address-btn">Adresi Kaydet</button>
                        <button type="button" class="btn btn-secondary" id="cancel-address-btn" style="margin-left: 1rem;">İptal</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
`;
document.addEventListener('DOMContentLoaded', () => {
    // Yalnızca alıcı profil sayfalarında başlat
    const currentPath = window.location.pathname || window.location.href;
    if (currentPath.includes('/courier/')) {
        return;
    }
    
    const profileNavLinks = document.querySelectorAll('.profile-nav a');
    const profileSections = document.querySelectorAll('.profile-section');
    const profileInfoForm = document.getElementById('profile-info-form');
    const addressesSection = document.getElementById('adreslerim');
    const walletCouponsSection = document.getElementById('cuzdan-kuponlar');

    if (!currentPath.includes('/buyer/profile') && !document.getElementById('profile-info-form')) {
        return;
    }

    function showSection(targetId) {
        profileSections.forEach(section => {
            section.style.display = 'none';
        });

        profileNavLinks.forEach(link => {
            link.classList.remove('active');
        });

        const targetSection = document.querySelector(targetId);
        if (targetSection) {
            targetSection.style.display = 'block';

            const targetLink = document.querySelector(`.profile-nav a[href="${targetId}"]`);
            if (targetLink) {
                targetLink.classList.add('active');
            }
            if (targetId === '#adreslerim') {
                renderAddresses();
            } else if (targetId === '#cuzdan-kuponlar') {
                renderWalletAndCoupons().catch(err => console.error('Cüzdan yükleme hatası:', err));
            }
        }
    }

    profileNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const targetHref = link.getAttribute('href') || link.href;
            
            if (link.id === 'logout-btn') {
                e.preventDefault();
                e.stopPropagation();
                if (window.logout) {
                    window.logout();
                } else {
                    localStorage.clear();
                    sessionStorage.clear();
                    const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
                    window.location.href = `${baseUrl}/`;
                }
                return false;
            }
            else if (targetHref && (targetHref.startsWith('#') || targetHref.includes('#') && targetHref.includes('/buyer/profile'))) {
                e.preventDefault();
                e.stopPropagation();
                let anchorId = targetHref;
                if (targetHref.includes('#')) {
                    anchorId = '#' + targetHref.split('#')[1];
                }
                if (!anchorId.startsWith('#')) {
                    anchorId = '#' + anchorId;
                }
                showSection(anchorId);
                if (window.history && window.history.pushState) {
                    const newUrl = window.location.pathname + anchorId;
                    window.history.pushState({ path: newUrl }, '', newUrl);
                }
                return false;
            }
        });
    });

    const urlHash = window.location.hash;
    const initialSectionHref = urlHash || document.querySelector('.profile-nav a.active')?.getAttribute('href') || '#profil-bilgileri';
    let cleanHash = initialSectionHref;
    if (cleanHash.includes('#')) {
        const parts = cleanHash.split('#');
        cleanHash = '#' + parts[parts.length - 1];
    }
    if (!cleanHash.startsWith('#')) {
        cleanHash = '#' + cleanHash;
    }
    showSection(cleanHash);
    window.addEventListener('popstate', (e) => {
        const hash = window.location.hash || '#profil-bilgileri';
        showSection(hash);
    });
    async function loadProfileData() {
        try {
            const userData = await BUYER_API.getProfile();
            if (userData) {
                const nameInput = document.getElementById('profile-name');
                const phoneInput = document.getElementById('profile-phone');
                const emailInput = document.getElementById('profile-email');
                
                if (nameInput) nameInput.value = userData.fullname || '';
                if (phoneInput) phoneInput.value = userData.phone || '';
                if (emailInput) emailInput.value = userData.email || '';
            }
        } catch (error) {
            console.error('Profil verileri yüklenirken hata:', error);
        }
    }
    
    loadProfileData();
    if (!profileInfoForm) {
    } else {
        profileInfoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('profile-name');
        const emailInput = document.getElementById('profile-email');
        const updateButton = profileInfoForm.querySelector('button[type="submit"]');

        const newName = nameInput.value.trim();
        const currentEmail = emailInput.value.trim(); 

        if (newName === '') {
            alert("Lütfen ad ve soyad alanını doldurunuz.");
            return;
        }

        const originalButtonText = updateButton.textContent;
        updateButton.textContent = 'Güncelleniyor...';
        updateButton.disabled = true;

        try {
            const phoneInput = document.getElementById('profile-phone');
            const phone = phoneInput ? phoneInput.value.trim() : '';
            
            const response = await BUYER_API.updateProfileInfo(newName, phone);

            if (response.success) {
                alert(response.message);
                // Kullanıcı bilgileri güncellendikten sonra üst menüyü yenile
                if (window.updateHeader) {
                    await window.updateHeader();
                }
            } else {
                alert(`Güncelleme başarısız: ${response.message}`);
            }
        } catch (error) {
            console.error("Profil güncelleme hatası:", error);
            alert("Bir hata oluştu: " + error.message);
        } finally {
            updateButton.textContent = originalButtonText;
            updateButton.disabled = false;
        }
        });
    }
    async function renderAddresses() {
        const addressData = await BUYER_API.getAddresses();
        const addressContainer = addressesSection.querySelector('.role-selector');
        const newAddressItem = addressContainer.querySelector('#address-new')?.closest('.form-check-radio')?.outerHTML || '';
        addressContainer.innerHTML = ''; 
        if(!document.getElementById('new-address-form-container')) {
            addressesSection.insertAdjacentHTML('beforeend', NEW_ADDRESS_FORM_HTML);
            document.getElementById('new-address-form').addEventListener('submit', handleNewAddressSubmit);
        }

        if (addressData.length > 0) {
        addressData.forEach((address) => {
            const isChecked = address.isDefault ? 'checked' : '';
                const addressDetail = address.detail || address.fullDetail || '';
                const shortDetail = addressDetail.length > 30 ? addressDetail.substring(0, 30) + '...' : addressDetail;
            
            const addressHtml = `
                    <div class="form-check form-check-radio">
                    <input type="radio" id="address-${address.id}" name="address" value="${address.id}" ${isChecked}>
                    <label for="address-${address.id}">
                            <strong>${address.title || 'Adres'}</strong>
                            <span>(${shortDetail})</span>
                            <a href="#" class="btn-edit" data-address-id="${address.id}">Düzenle</a>
                    </label>
                </div>
            `;
            addressContainer.insertAdjacentHTML('beforeend', addressHtml);
        });
        } else {
            addressContainer.insertAdjacentHTML('beforeend', `
                <p style="color: var(--secondary-color-light); padding: 1rem; text-align: center;">
                    Henüz adres eklenmemiş. Yeni adres ekleyerek başlayın.
                </p>
            `);
        }

        if (newAddressItem) {
             addressContainer.insertAdjacentHTML('beforeend', newAddressItem);
        }
        
        addressContainer.querySelectorAll('input[type="radio"][name="address"]').forEach(radio => {
            radio.addEventListener('change', handleAddressSelectionChange);
        });

        addressesSection.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const addressId = e.target.dataset.addressId;
                alert(`Adres ID: ${addressId} düzenleniyor...`);
            });
        });
        
        const newAddressRadio = document.getElementById('address-new');
        if (newAddressRadio && newAddressRadio.checked) {
             document.getElementById('new-address-form-container').style.display = 'block';
        } else if (document.getElementById('new-address-form-container')) {
             document.getElementById('new-address-form-container').style.display = 'none';
        }
    }
    function handleAddressSelectionChange(e) {
        const formContainer = document.getElementById('new-address-form-container');
        if (!formContainer) return;

        if (e.target.id === 'address-new' && e.target.checked) {
            formContainer.style.display = 'block';
            formContainer.scrollIntoView({ behavior: 'smooth' });
        } else {
            formContainer.style.display = 'none';
        }
    }
    async function handleNewAddressSubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const title = form.querySelector('#address-title').value.trim();
        const district = form.querySelector('#address-district').value.trim();
        const city = form.querySelector('#address-city').value.trim();
        const detail = form.querySelector('#address-detail').value.trim();
        const isDefault = form.querySelector('#address-default').checked;
        const saveButton = form.querySelector('#save-address-btn');

        if (!title || !district || !city || !detail) {
            alert('Lütfen tüm adres alanlarını doldurunuz.');
            return;
        }

        const newAddressData = { title, district, city, detail, isDefault };
        
        const originalButtonText = saveButton.textContent;
        saveButton.textContent = 'Kaydediliyor...';
        saveButton.disabled = true;

        try {
            const response = await BUYER_API.addAddress(newAddressData);

            if (response.success) {
                alert(response.message || 'Adres başarıyla kaydedildi.');
                form.reset(); // Formu temizle
                const newAddressRadio = document.getElementById('address-new');
                if (newAddressRadio) {
                    newAddressRadio.checked = false;
                }
                document.getElementById('new-address-form-container').style.display = 'none';
                await renderAddresses();
            } else {
                 alert(`Kaydetme başarısız: ${response.message || 'Bilinmeyen hata'}`);
            }
        } catch (error) {
            console.error("Yeni adres ekleme hatası:", error);
            alert("Bir hata oluştu: " + (error.message || 'Bilinmeyen hata'));
        } finally {
            saveButton.textContent = originalButtonText;
            saveButton.disabled = false;
        }
    }
    document.addEventListener('click', (e) => {
        if (e.target.id === 'cancel-address-btn') {
            const formContainer = document.getElementById('new-address-form-container');
            const form = document.getElementById('new-address-form');
            const newAddressRadio = document.getElementById('address-new');
            
            if (formContainer) formContainer.style.display = 'none';
            if (form) form.reset();
            if (newAddressRadio) newAddressRadio.checked = false;
        }
    });
    async function renderWalletAndCoupons() {
        const data = await BUYER_API.getWalletAndCoupons();

        const balanceElement = walletCouponsSection.querySelector('.wallet-balance .total-price');
        balanceElement.textContent = formatTL(data.balance);
        
        const couponList = walletCouponsSection.querySelector('.coupon-list');
        couponList.innerHTML = ''; 

        if (data.coupons.length > 0) {
            data.coupons.forEach(coupon => {
                const couponHtml = `
                    <div class="coupon-item">
                        <span class="coupon-code">${coupon.code}</span>
                        <p>${coupon.description}</p>
                    </div>
                `;
                couponList.insertAdjacentHTML('beforeend', couponHtml);
            });
        } else {
            couponList.innerHTML = '<div class="coupon-item"><p>Henüz kullanabileceğiniz kupon bulunmamaktadır.</p></div>';
        }
    }
});