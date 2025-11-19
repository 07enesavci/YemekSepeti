
const MOCK_API = {

    updateProfileInfo: (name, email) => {
        return new Promise(resolve => {
            setTimeout(() => {
                console.log(`[MOCK API] Profil güncellendi: Ad: ${name}, E-posta: ${email}`);
       
                resolve({ success: true, message: "Profil bilgileriniz başarıyla güncellendi." });
            }, 1000);
        });
    },

    getAddresses: () => {
        return {
            success: true,
            data: [
                { id: 1, title: "Ev Adresi (Varsayılan)", detail: "Ertuğrul Gazi Mah. 123. Sokak No: 5, Çerkezköy, Tekirdağ", isDefault: true },
                { id: 2, title: "İş Adresi", detail: "Ataşehir Plaza Kat: 10, Ataşehir, İstanbul", isDefault: false }
            ]
        };
    },
    
 
    addAddress: (newAddressData) => {
         return new Promise(resolve => {
            setTimeout(() => {
                console.log("[MOCK API] Yeni Adres Eklendi:", newAddressData);
                resolve({ success: true, message: "Yeni adres başarıyla kaydedildi." });
            }, 1000);
        });
    },


    getWalletAndCoupons: () => {
        return {
            success: true,
            data: {
                balance: 42.75,
                coupons: [
                    { code: "HOSGELDIN10", description: "10 TL Hoş geldin indirimi (30 TL ve üzeri)" },
                    { code: "YAZ25", description: "Seçili ürünlerde %25 indirim (50 TL ve üzeri)" },
                ]
            }
        };
    }
};


const formatTL = (amount) => {
    return (amount || 0).toLocaleString('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

const NEW_ADDRESS_FORM_HTML = `
    <div id="new-address-form-container" style="display: none;">
        <h5 class="mt-4 mb-3">Yeni Adres Bilgileri</h5>
        <form id="new-address-form" class="row g-3 p-3 bg-light rounded shadow-sm">
            <div class="col-md-6">
                <label for="address-title" class="form-label">Adres Başlığı (Ev/İş/Diğer)</label>
                <input type="text" class="form-control" id="address-title" required>
            </div>
            <div class="col-md-6">
                <label for="address-city" class="form-label">İl</label>
                <input type="text" class="form-control" id="address-city" required>
            </div>
            <div class="col-12">
                <label for="address-detail" class="form-label">Adres Detayı (Mahalle, Sokak, No...)</label>
                <textarea class="form-control" id="address-detail" rows="3" required></textarea>
            </div>
            <div class="col-12">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="address-default">
                    <label class="form-check-label" for="address-default">
                        Varsayılan Adres Yap
                    </label>
                </div>
            </div>
            <div class="col-12">
                <button type="submit" class="btn btn-primary" id="save-address-btn">Adresi Kaydet</button>
            </div>
        </form>
    </div>
`;


document.addEventListener('DOMContentLoaded', () => {
   
    const profileNavLinks = document.querySelectorAll('.profile-nav a');
    const profileSections = document.querySelectorAll('.profile-section');
    const profileInfoForm = document.getElementById('profile-info-form');
    const addressesSection = document.getElementById('adreslerim');
    const walletCouponsSection = document.getElementById('cuzdan-kuponlar');
 

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
                renderWalletAndCoupons();
            }
        }
    }

    profileNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const targetHref = e.currentTarget.getAttribute('href');

            if (targetHref && targetHref.startsWith('#')) {
                e.preventDefault(); 
                showSection(targetHref);
            } 
            else if (e.currentTarget.id === 'logout-btn') {
                e.preventDefault();
                alert("Başarıyla çıkış yapıldı. Anasayfaya yönlendiriliyor...");
            }
        });
    });

    const initialSectionHref = document.querySelector('.profile-nav a.active')?.getAttribute('href') || '#profil-bilgileri';
    showSection(initialSectionHref);


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
            const response = await MOCK_API.updateProfileInfo(newName, currentEmail);

            if (response.success) {
                alert(response.message);
            } else {
                alert(`Güncelleme başarısız: ${response.message}`);
            }
        } catch (error) {
            console.error("Profil güncelleme hatası:", error);
            alert("Bir hata oluştu. Konsolu kontrol edin.");
        } finally {
            updateButton.textContent = originalButtonText;
            updateButton.disabled = false;
        }
    });

    
    function renderAddresses() {
        const addressData = MOCK_API.getAddresses().data;
        const addressContainer = addressesSection.querySelector('.role-selector');

        const newAddressItem = addressContainer.querySelector('#address-new')?.closest('.form-check-radio')?.outerHTML || '';
        addressContainer.innerHTML = ''; 

        if(!document.getElementById('new-address-form-container')) {
            addressesSection.insertAdjacentHTML('beforeend', NEW_ADDRESS_FORM_HTML);

            document.getElementById('new-address-form').addEventListener('submit', handleNewAddressSubmit);
        }

        addressData.forEach((address) => {
            const isChecked = address.isDefault ? 'checked' : '';
            
            const addressHtml = `
                <div class="form-check form-check-radio mb-2">
                    <input type="radio" id="address-${address.id}" name="address" value="${address.id}" ${isChecked}>
                    <label for="address-${address.id}">
                        <strong>${address.title}</strong>
                        <span>(${address.detail.substring(0, address.detail.indexOf(','))}...)</span>
                        <a href="#" class="btn-edit text-decoration-none ms-3" data-address-id="${address.id}">Düzenle</a>
                    </label>
                </div>
            `;
            addressContainer.insertAdjacentHTML('beforeend', addressHtml);
        });

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
/
    async function handleNewAddressSubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const title = form.querySelector('#address-title').value.trim();
        const city = form.querySelector('#address-city').value.trim();
        const detail = form.querySelector('#address-detail').value.trim();
        const isDefault = form.querySelector('#address-default').checked;
        const saveButton = form.querySelector('#save-address-btn');

        if (!title || !city || !detail) {
            alert('Lütfen tüm adres alanlarını doldurunuz.');
            return;
        }

        const newAddressData = { title, city, detail, isDefault };
        
        const originalButtonText = saveButton.textContent;
        saveButton.textContent = 'Kaydediliyor...';
        saveButton.disabled = true;

        try {
            const response = await MOCK_API.addAddress(newAddressData);

            if (response.success) {
                alert(response.message);
                form.reset();
                document.getElementById('address-new').checked = false;
                document.getElementById('new-address-form-container').style.display = 'none';
                showSection('#adreslerim'); 
            } else {
                 alert(`Kaydetme başarısız: ${response.message}`);
            }
        } catch (error) {
            console.error("Yeni adres ekleme hatası:", error);
            alert("Bir hata oluştu. Konsolu kontrol edin.");
        } finally {
            saveButton.textContent = originalButtonText;
            saveButton.disabled = false;
        }
    }


    function renderWalletAndCoupons() {
        const data = MOCK_API.getWalletAndCoupons().data;

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
