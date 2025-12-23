// ============================================
// ADRESLER SAYFASI MODÜLÜ (addresses.js)
// ============================================

// API fonksiyonları
const BUYER_API = {
    // Adresleri getir
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
    
    // Yeni adres ekle
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

    // Adres güncelle
    updateAddress: async (addressId, updateData) => {
        try {
            const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
            const response = await fetch(`${baseUrl}/api/buyer/addresses/${addressId}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Adres güncellenemedi');
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Adres güncelleme hatası:', error);
            throw error;
        }
    },

    // Adres sil
    deleteAddress: async (addressId) => {
        try {
            const baseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.getBaseUrl ? window.getBaseUrl() : '');
            const response = await fetch(`${baseUrl}/api/buyer/addresses/${addressId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Adres silinemedi');
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Adres silme hatası:', error);
            throw error;
        }
    }
};

// Sayfa yüklendiğinde çalışacak fonksiyon
document.addEventListener('DOMContentLoaded', async () => {
    const addressesList = document.getElementById('addresses-list');
    const addAddressBtn = document.getElementById('add-address-btn');
    const newAddressForm = document.getElementById('new-address-form');
    const editAddressForm = document.getElementById('edit-address-form');
    const newAddressContainer = document.getElementById('new-address-form-container');
    const editAddressContainer = document.getElementById('edit-address-form-container');
    const cancelAddressBtn = document.getElementById('cancel-address-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const deleteAddressBtn = document.getElementById('delete-address-btn');

    // Adresleri yükle ve göster
    async function loadAddresses() {
        if (!addressesList) return;
        
        addressesList.innerHTML = '<p style="text-align: center; padding: 2rem; color: #666;">Yükleniyor...</p>';
        
        try {
            const addresses = await BUYER_API.getAddresses();
            renderAddresses(addresses);
        } catch (error) {
            console.error('Adresler yüklenirken hata:', error);
            addressesList.innerHTML = '<p style="text-align: center; padding: 2rem; color: red;">Adresler yüklenirken bir hata oluştu.</p>';
        }
    }

    // Adresleri render et
    function renderAddresses(addresses) {
        if (!addressesList) return;
        
        addressesList.innerHTML = '';
        
        if (addresses.length === 0) {
            addressesList.innerHTML = `
                <p style="color: var(--secondary-color-light); padding: 1rem; text-align: center;">
                    Henüz adres eklenmemiş. Yeni adres ekleyerek başlayın.
                </p>
            `;
            return;
        }

        addresses.forEach((address) => {
            const isDefault = address.isDefault ? '<span style="color: #FF6B35; font-size: 0.85rem; margin-left: 0.5rem;">(Varsayılan)</span>' : '';
            const addressDetail = address.detail || address.fullDetail || '';
            const shortDetail = addressDetail.length > 50 ? addressDetail.substring(0, 50) + '...' : addressDetail;
            
            const addressHtml = `
                <div class="form-check form-check-radio" data-address-id="${address.id}">
                    <input type="radio" id="address-${address.id}" name="address" value="${address.id}" ${address.isDefault ? 'checked' : ''}>
                    <label for="address-${address.id}" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <div>
                            <strong>${address.title || 'Adres'}</strong>${isDefault}
                            <span style="display: block; color: #666; font-size: 0.9rem; margin-top: 0.25rem;">${shortDetail}</span>
                        </div>
                        <a href="#" class="btn-edit" data-address-id="${address.id}" style="margin-left: 1rem;">Düzenle</a>
                    </label>
                </div>
            `;
            addressesList.insertAdjacentHTML('beforeend', addressHtml);
        });

        // Düzenle butonlarına event listener ekle
        addressesList.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const addressId = parseInt(btn.getAttribute('data-address-id'));
                await showEditForm(addressId);
            });
        });
    }

    // Yeni adres formunu göster
    function showNewAddressForm() {
        if (newAddressContainer) {
            newAddressContainer.style.display = 'block';
            editAddressContainer.style.display = 'none';
            newAddressForm.reset();
            document.getElementById('address-default').checked = false;
            // Sayfayı forma kaydır
            newAddressContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    // Düzenleme formunu göster
    async function showEditForm(addressId) {
        try {
            const addresses = await BUYER_API.getAddresses();
            const address = addresses.find(a => a.id === addressId);
            
            if (!address) {
                alert('Adres bulunamadı.');
                return;
            }

            // Form alanlarını doldur
            document.getElementById('edit-address-id').value = address.id;
            document.getElementById('edit-address-title').value = address.title || '';
            
            // fullDetail'den district ve city'yi ayır (eğer varsa)
            const fullDetail = address.fullDetail || address.detail || '';
            document.getElementById('edit-address-detail').value = fullDetail;
            
            // District ve city'yi ayır (basit bir yaklaşım)
            if (address.district) {
                document.getElementById('edit-address-district').value = address.district;
            }
            if (address.city) {
                document.getElementById('edit-address-city').value = address.city;
            }
            
            document.getElementById('edit-address-default').checked = address.isDefault || false;

            // Formları göster/gizle
            if (editAddressContainer) {
                editAddressContainer.style.display = 'block';
                newAddressContainer.style.display = 'none';
                // Sayfayı forma kaydır
                editAddressContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        } catch (error) {
            console.error('Adres bilgisi yüklenirken hata:', error);
            alert('Adres bilgisi yüklenirken bir hata oluştu.');
        }
    }

    // Yeni adres formu gönderimi
    if (newAddressForm) {
        newAddressForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const title = document.getElementById('address-title').value.trim();
            const district = document.getElementById('address-district').value.trim();
            const city = document.getElementById('address-city').value.trim();
            const detail = document.getElementById('address-detail').value.trim();
            const isDefault = document.getElementById('address-default').checked;

            if (!title || !district || !city || !detail) {
                alert('Lütfen tüm alanları doldurun.');
                return;
            }

            const saveBtn = document.getElementById('save-address-btn');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Kaydediliyor...';
            saveBtn.disabled = true;

            try {
                const response = await BUYER_API.addAddress({
                    title,
                    district,
                    city,
                    detail,
                    isDefault
                });

                if (response.success) {
                    alert(response.message || 'Adres başarıyla eklendi.');
                    newAddressForm.reset();
                    newAddressContainer.style.display = 'none';
                    await loadAddresses();
                } else {
                    alert('Adres eklenirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
                }
            } catch (error) {
                console.error('Adres ekleme hatası:', error);
                alert('Adres eklenirken bir hata oluştu: ' + error.message);
            } finally {
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }
        });
    }

    // Adres güncelleme formu gönderimi
    if (editAddressForm) {
        editAddressForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const addressId = parseInt(document.getElementById('edit-address-id').value);
            const title = document.getElementById('edit-address-title').value.trim();
            const district = document.getElementById('edit-address-district').value.trim();
            const city = document.getElementById('edit-address-city').value.trim();
            const detail = document.getElementById('edit-address-detail').value.trim();
            const isDefault = document.getElementById('edit-address-default').checked;

            if (!title || !district || !city || !detail) {
                alert('Lütfen tüm alanları doldurun.');
                return;
            }

            const updateBtn = document.getElementById('update-address-btn');
            const originalText = updateBtn.textContent;
            updateBtn.textContent = 'Güncelleniyor...';
            updateBtn.disabled = true;

            try {
                const response = await BUYER_API.updateAddress(addressId, {
                    title,
                    district,
                    city,
                    detail,
                    isDefault
                });

                if (response.success) {
                    alert(response.message || 'Adres başarıyla güncellendi.');
                    editAddressContainer.style.display = 'none';
                    await loadAddresses();
                } else {
                    alert('Adres güncellenirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
                }
            } catch (error) {
                console.error('Adres güncelleme hatası:', error);
                alert('Adres güncellenirken bir hata oluştu: ' + error.message);
            } finally {
                updateBtn.textContent = originalText;
                updateBtn.disabled = false;
            }
        });
    }

    // Adres silme
    if (deleteAddressBtn) {
        deleteAddressBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const addressId = parseInt(document.getElementById('edit-address-id').value);
            
            if (!addressId) {
                alert('Adres ID bulunamadı.');
                return;
            }

            if (!confirm('Bu adresi silmek istediğinizden emin misiniz?')) {
                return;
            }

            const deleteBtn = deleteAddressBtn;
            const originalText = deleteBtn.textContent;
            deleteBtn.textContent = 'Siliniyor...';
            deleteBtn.disabled = true;

            try {
                const response = await BUYER_API.deleteAddress(addressId);

                if (response.success) {
                    alert(response.message || 'Adres başarıyla silindi.');
                    editAddressContainer.style.display = 'none';
                    await loadAddresses();
                } else {
                    alert('Adres silinirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
                }
            } catch (error) {
                console.error('Adres silme hatası:', error);
                alert('Adres silinirken bir hata oluştu: ' + error.message);
            } finally {
                deleteBtn.textContent = originalText;
                deleteBtn.disabled = false;
            }
        });
    }

    // İptal butonları
    if (cancelAddressBtn) {
        cancelAddressBtn.addEventListener('click', () => {
            newAddressForm.reset();
            newAddressContainer.style.display = 'none';
        });
    }

    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            editAddressForm.reset();
            editAddressContainer.style.display = 'none';
        });
    }

    // Yeni adres ekle butonu
    if (addAddressBtn) {
        addAddressBtn.addEventListener('click', () => {
            showNewAddressForm();
        });
    }

    // Logout butonu
    const logoutBtn = document.getElementById('logout-btn');
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
    await loadAddresses();
});

