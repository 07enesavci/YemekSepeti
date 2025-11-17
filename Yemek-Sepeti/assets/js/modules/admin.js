/* ==================================== */
/* ADMİN PANELİ JAVASCRIPT - GÜNCELLENDİ  */
/* assets/js/modules/admin.js           */
/* ==================================== */

// DOM yüklendiğinde ana fonksiyonu çalıştır
document.addEventListener("DOMContentLoaded", function() {
    
    // 1. GEREKLİ ELEMENTLERİ SEÇME
    const userListPage = document.getElementById("user-list");
    const addUserForm = document.getElementById("add-user-form");

    const couponPage = document.getElementById("coupon-form");
    const selectAllCheckbox = document.getElementById("select-all-sellers");
    const sellerCheckboxList = document.getElementById("seller-checkbox-list");
    const couponListContainer = document.getElementById("coupon-list-container"); // YENİ

    // --- Aktif Menü Linkini Ayarlama ---
    const page = window.location.pathname;
    if (page.includes("user-management.html")) {
        document.getElementById("nav-users")?.classList.add("active");
    } else if (page.includes("coupons.html")) {
        document.getElementById("nav-coupons")?.classList.add("active");
    }

    // 2. SAYFA KONTROLÜ VE İLK YÜKLEME
    
    // Eğer 'user-management.html' sayfasındaysak:
    if (userListPage) {
        loadAndRenderUsers();
        addUserForm.addEventListener("submit", handleAddUser);
        userListPage.addEventListener("click", handleUserListClick);
    }

    // Eğer 'coupons.html' sayfasındaysak:
    if (couponPage) {
        loadAndRenderSellers(); // Satıcı checkbox'larını yükle
        loadAndRenderCoupons(); // YENİ: Mevcut kuponları yükle
        
        couponPage.addEventListener("submit", handleAddCoupon);
        selectAllCheckbox.addEventListener("change", handleSelectAllSellers);
        
        // YENİ: Kupon listesindeki silme butonları için dinleyici
        couponListContainer.addEventListener("click", handleCouponListClick);
    }
});

/* ==================================== */
/* YARDIMCI FONKSİYONLAR                */
/* ==================================== */
function yeniId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ==================================== */
/* KULLANICI YÖNETİMİ FONKSİYONLARI     */
/* ==================================== */

function loadAndRenderUsers() {
    if (typeof getAllUsers !== 'function') return; // API yüklenmediyse dur
    getAllUsers().then(renderUserList).catch(err => console.error("Kullanıcılar yüklenemedi", err));
}

function renderUserList(users) {
    const userListElement = document.getElementById("user-list");
    userListElement.innerHTML = "";
    if (users.length === 0) {
        userListElement.innerHTML = "<p>Gösterilecek kullanıcı yok.</p>";
        return;
    }
    const frag = document.createDocumentFragment();
    for (let i = 0; i < users.length; i++) {
        frag.appendChild(kullaniciSatiriOlustur(users[i]));
    }
    userListElement.appendChild(frag);
}

function kullaniciSatiriOlustur(user) {
    const suspended = user.status === 'suspended';
    const itemDiv = document.createElement('div');
    itemDiv.className = 'admin-list-item';
    itemDiv.innerHTML = `
        <div class="user-info">
            <strong>${user.fullname}</strong>
            <span>${user.email} - (Rol: ${user.role})</span>
        </div>
        <div class="user-status">
            <span class="status-dot ${suspended ? 'suspended' : 'active'}">
                ${suspended ? 'Donduruldu' : 'Aktif'}
            </span>
        </div>
        <div class="user-actions">
            <button class="btn btn-secondary btn-sm btn-suspend" data-id="${user.id}">
                ${suspended ? 'Aktif Et' : 'Dondur'}
            </button>
            <button class="btn btn-danger btn-sm btn-delete" data-id="${user.id}">Sil</button>
        </div>
    `;
    return itemDiv;
}

function handleAddUser(e) {
    e.preventDefault(); 
    const fullname = document.getElementById("new-fullname").value;
    const email = document.getElementById("new-email").value;
    const password = document.getElementById("new-password").value;
    const role = document.getElementById("new-role").value;
    if (!fullname || !email || !password) {
        alert("Lütfen tüm alanları doldurun."); return;
    }
    const yeniKullanici = { id: yeniId(), fullname, email, password, role, status: 'active' };
    adminAddUser(yeniKullanici).then(() => {
        alert(`${yeniKullanici.role} başarıyla eklendi!`);
        loadAndRenderUsers(); 
        document.getElementById("add-user-form").reset(); 
    }).catch(err => alert(err.message));
}

function handleUserListClick(e) {
    const target = e.target;
    const suspendButton = target.closest('.btn-suspend');
    if (suspendButton) {
        adminSuspendUser(suspendButton.dataset.id).then(loadAndRenderUsers);
        return;
    }
    const deleteButton = target.closest('.btn-delete');
    if (deleteButton) {
        if (confirm("Bu kullanıcıyı silmek istediğinizden emin misiniz?")) {
            adminDeleteUser(deleteButton.dataset.id).then(loadAndRenderUsers);
        }
    }
}

/* ==================================== */
/* KUPON YÖNETİMİ FONKSİYONLARI         */
/* ==================================== */

function loadAndRenderSellers() {
    const listElement = document.getElementById("seller-checkbox-list");
    if (typeof getAllSellers !== 'function') {
        listElement.innerHTML = "<p style='color:red;'>Hata: Satıcı verisi alınamadı.</p>";
        return;
    }
    listElement.innerHTML = "<p>Satıcılar yükleniyor...</p>";
    getAllSellers().then(sellers => {
        listElement.innerHTML = "";
        sellers.forEach(function(seller) {
            const sellerHtml = `
                <div class="form-check">
                    <input type="checkbox" class="seller-checkbox" id="seller-${seller.id}" value="${seller.id}">
                    <label for="seller-${seller.id}">${seller.name}</label>
                </div>
            `;
            listElement.insertAdjacentHTML('beforeend', sellerHtml);
        });
    }).catch(err => listElement.innerHTML = "<p style='color:red;'>Satıcılar yüklenemedi.</p>");
}

// YENİ EKLENDİ
function loadAndRenderCoupons() {
    const listContainer = document.getElementById("coupon-list-container");
    if (typeof getCoupons !== 'function') {
        listContainer.innerHTML = "<p style='color:red;'>Hata: Kupon verisi alınamadı.</Gereksiz detayp>";
        return;
    }
    listContainer.innerHTML = "<p>Kuponlar yükleniyor...</p>";

    getCoupons().then(coupons => {
        listContainer.innerHTML = ""; // Temizle
        if (coupons.length === 0) {
            listContainer.innerHTML = "<p>Henüz tanımlanmış kupon yok.</p>";
            return;
        }
        const frag = document.createDocumentFragment();
        for (let i = 0; i < coupons.length; i++) {
            frag.appendChild(kuponSatiriOlustur(coupons[i]));
        }
        listContainer.appendChild(frag);
    }).catch(err => listContainer.innerHTML = "<p style='color:red;'>Kuponlar yüklenemedi.</p>");
}

// YENİ EKLENDİ
function kuponSatiriOlustur(coupon) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'coupon-list-item';

    // Satıcıları 'seller-tag' HTML'ine dönüştür
    let sellersHtml = '';
    if (coupon.sellers && coupon.sellers.length > 0) {
        sellersHtml = coupon.sellers.map(function(name) {
            return `<span class="seller-tag">${name}</span>`;
        }).join(' ');
    } else {
        sellersHtml = '<span class="seller-tag">Tüm Satıcılar</span>';
    }

    itemDiv.innerHTML = `
        <div class="coupon-info">
            <strong>${coupon.code}</strong>
            <span>İndirim: ${coupon.amount} TL</span>
        </div>
        <div class="coupon-sellers">
            ${sellersHtml}
        </div>
        <div class="coupon-actions">
            <button class="btn btn-danger btn-sm btn-delete-coupon" data-id="${coupon.id}">Sil</button>
        </div>
    `;
    return itemDiv;
}

function handleSelectAllSellers(e) {
    const isChecked = e.target.checked;
    const allCheckboxes = document.querySelectorAll(".seller-checkbox");
    for (let i = 0; i < allCheckboxes.length; i++) {
        allCheckboxes[i].checked = isChecked;
    }
}

function handleAddCoupon(e) {
    e.preventDefault();
    const code = document.getElementById("coupon-code").value;
    const amount = document.getElementById("coupon-amount").value;
    const selectedSellerIds = [];
    const allCheckboxes = document.querySelectorAll(".seller-checkbox:checked");
    const selectAll = document.getElementById("select-all-sellers").checked;

    // Eğer "Tümünü Seç" işaretliyse, ID göndermeye gerek yok (veya 'all' gönder)
    // Şimdilik, 'Tümünü Seç' işaretliyse ID listesini boş bırakıyoruz.
    if (!selectAll) {
        for (let i = 0; i < allCheckboxes.length; i++) {
            selectedSellerIds.push(allCheckboxes[i].value);
        }
        if (selectedSellerIds.length === 0) {
            alert("Lütfen en az bir satıcı seçin veya 'Tüm Satıcıları Seç'i işaretleyin.");
            return;
        }
    }
    
    if (!code || !amount) {
        alert("Lütfen kupon kodu ve indirim miktarını girin.");
        return;
    }

    // api.js'e 'sellerIds: []' (boş dizi) giderse, 'Tüm Satıcılar' anlamına gelsin
    adminAddCoupon({ code, amount, sellerIds: selectedSellerIds })
        .then(function(response) {
            alert(`Kupon başarıyla eklendi!`);
            document.getElementById("coupon-form").reset();
            
            // Checkbox'ları temizle
            document.getElementById("select-all-sellers").checked = false;
            allCheckboxes.forEach(cb => cb.checked = false);
            
            // YENİ: Listeyi yenile
            loadAndRenderCoupons();
        });
}

// YENİ EKLENDİ
function handleCouponListClick(e) {
    const deleteButton = e.target.closest('.btn-delete-coupon');
    if (deleteButton) {
        const couponId = deleteButton.dataset.id;
        if (confirm("Bu kuponu silmek istediğinizden emin misiniz?")) {
            // ENES (SİZİN) GÖREVİNİZ: 'api.js'e 'adminDeleteCoupon' eklemelisiniz
            adminDeleteCoupon(couponId).then(() => {
                alert("Kupon silindi.");
                loadAndRenderCoupons(); // Listeyi yenile
            });
        }
    }
}