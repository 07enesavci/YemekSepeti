
const MOCK_API = {

    getActiveOrders: () => new Promise(resolve => {
        setTimeout(() => {
            resolve({
                success: true,
                data: [{
                    id: 101,
                    status: 'preparing', 
                    statusText: 'Hazırlanıyor',
                    date: '12 Kasım 2025, 21:00',
                    seller: "Ayşe'nin Mutfağı",
                    total: 259.99,
                    items: "1 x Ev Mantısı, 2 x Fırın Sütlaç",
                    canCancel: true,
                    canDetail: true,
                    type: 'active'
                }]
            });
        }, 300);
    }),

    getPastOrders: () => new Promise(resolve => {
        setTimeout(() => {
            resolve({
                success: true,
                data: [{
                    id: 201,
                    status: 'delivered',
                    statusText: 'Teslim Edildi',
                    date: '10 Kasım 2025, 12:15',
                    seller: "Ali'nin Kebapları",
                    total: 85.00,
                    items: "1 x Adana Kebap, 1 x Ayran",
                    canRepeat: true,
                    canRate: true,
                    type: 'past'
                }, {
                    id: 202,
                    status: 'cancelled',
                    statusText: 'İptal Edildi',
                    date: '9 Kasım 2025, 17:30',
                    seller: "Vegan Lezzetler",
                    total: 60.00,
                    items: "1 x Mercimek Köftesi",
                    canRepeat: true,
                    canRate: false,
                    type: 'past'
                }]
            });
        }, 500);
    }),
};

const formatTL = (amount) => {
    return (amount || 0).toLocaleString('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

function handleOrderAction(e, orderId, actionType) {
    e.preventDefault();
    const card = e.target.closest('.order-card'); 

    switch (actionType) {
        case 'iptal':
            if (confirm(`Sipariş #${orderId} iptal edilsin mi?`)) {
              
                const newStatus = document.createElement('span');
                newStatus.className = 'order-status cancelled'; 
                newStatus.textContent = 'İptal Edildi'; 
                const oldStatus = card.querySelector('.order-status');
                if (oldStatus) {
                    oldStatus.replaceWith(newStatus); 
                }

                const footer = card.querySelector('.order-footer');
                if (footer) {
                    footer.innerHTML = ''; 
                    const repeatBtn = document.createElement('a');
                    repeatBtn.href = '#';
                    repeatBtn.className = 'btn btn-primary btn-sm';
                    repeatBtn.textContent = 'Siparişi Tekrarla';
                    repeatBtn.addEventListener('click', (e) => handleOrderAction(e, orderId, 'tekrarla'));
                    footer.appendChild(repeatBtn);
                }

                const pastSection = document.getElementById('past-orders');
                if (pastSection && card) {
                    card.querySelector('.order-items')?.remove(); 
                    pastSection.appendChild(card);
                }

                alert(`Sipariş #${orderId} iptal edildi ve geçmiş siparişlere taşındı.`);
            }
            break;

        case 'detay':
            const itemsElement = card.querySelector('.order-items p');
            const items = itemsElement ? itemsElement.textContent : 'Ürün bilgisi yok.';
            alert(`Sipariş Detayı #${orderId}:\nSatıcı: ${card.querySelector('.order-seller strong').textContent}\nToplam: ${card.querySelector('.order-total strong').textContent}\nÜrünler: ${items}`);
            break;
            
        case 'tekrarla':
            alert(`Sipariş #${orderId} Sepete eklenmek üzere tekrarlandı.`);
            break;
            
        case 'degerlendir':
             alert(`Sipariş #${orderId} için değerlendirme ekranı açıldı.`);
            break;

        default:
            console.log(`Bilinmeyen aksiyon: ${actionType}`);
    }
}

function createOrderCard(order) {

    const card = document.createElement('div');
    card.className = 'card order-card';
    card.setAttribute('data-order-id', order.id);

    const header = document.createElement('div');
    header.className = 'order-header';

    const headerLeft = document.createElement('div');
    const statusSpan = document.createElement('span');
    statusSpan.className = `order-status ${order.status}`;
    statusSpan.textContent = order.statusText;
    const dateSpan = document.createElement('span');
    dateSpan.className = 'order-date';
    dateSpan.textContent = order.date;
    headerLeft.appendChild(statusSpan);
    headerLeft.appendChild(dateSpan);

    const headerRight = document.createElement('div');
    headerRight.className = 'order-total';
    const totalSpan = document.createElement('span');
    totalSpan.textContent = 'Toplam:';
    const strongTotal = document.createElement('strong');
    strongTotal.textContent = formatTL(order.total);
    headerRight.appendChild(totalSpan);
    headerRight.appendChild(strongTotal);

    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    const seller = document.createElement('div');
    seller.className = 'order-seller';
    const strongSeller = document.createElement('strong');
    strongSeller.textContent = order.seller;
    seller.appendChild(strongSeller);
 
    const items = document.createElement('div');
    items.className = 'order-items';
    const pItems = document.createElement('p');
    pItems.textContent = order.items;
    items.appendChild(pItems);

    const footer = document.createElement('div');
    footer.className = 'order-footer';

    if (order.canCancel) {
        const cancelBtn = document.createElement('a');
        cancelBtn.href = '#';
        cancelBtn.className = 'btn btn-secondary btn-sm';
        cancelBtn.textContent = 'Siparişi İptal Et';
        cancelBtn.addEventListener('click', (e) => handleOrderAction(e, order.id, 'iptal')); 
        footer.appendChild(cancelBtn);
    }
    
    if (order.canDetail) {
        const detailBtn = document.createElement('a');
        detailBtn.href = '#';
        detailBtn.className = 'btn btn-primary btn-sm';
        detailBtn.textContent = 'Sipariş Detayı';
        detailBtn.addEventListener('click', (e) => handleOrderAction(e, order.id, 'detay')); 
        footer.appendChild(detailBtn);
    }
    
    if (order.canRepeat) {
        const repeatBtn = document.createElement('a');
        repeatBtn.href = '#';
        repeatBtn.className = 'btn btn-primary btn-sm';
        repeatBtn.textContent = 'Siparişi Tekrarla';
        repeatBtn.addEventListener('click', (e) => handleOrderAction(e, order.id, 'tekrarla'));
        footer.appendChild(repeatBtn);
    }
    
    if (order.canRate) {
        const rateBtn = document.createElement('a');
        rateBtn.href = '#';
        rateBtn.className = 'btn btn-secondary btn-sm';
        rateBtn.textContent = 'Siparişi Değerlendir';
        rateBtn.addEventListener('click', (e) => handleOrderAction(e, order.id, 'degerlendir'));
        footer.appendChild(rateBtn);
    }

    card.appendChild(header);
    card.appendChild(seller);
    if (order.type === 'active') {
        card.appendChild(items); 
    }
    card.appendChild(footer);
    
    return card;
}

async function renderOrders() {
    const activeSection = document.getElementById('active-orders');
    const pastSection = document.getElementById('past-orders');

    try {
        const activeResponse = await MOCK_API.getActiveOrders();
        if (activeResponse.success && activeSection) {
        
            activeSection.querySelectorAll('.order-card').forEach(card => card.remove());
            
            activeResponse.data.forEach(order => {
                const card = createOrderCard(order); 
                activeSection.appendChild(card); 
            });

            if (activeResponse.data.length === 0) {
                 const p = document.createElement('p');
                 p.textContent = 'Aktif siparişiniz bulunmamaktadır.';
                 activeSection.appendChild(p);
            }
        }
    } catch(e) {
        console.error("Aktif siparişler yüklenirken hata oluştu:", e);
    }


    try {
        const pastResponse = await MOCK_API.getPastOrders();
        if (pastResponse.success && pastSection) {
        
            pastSection.querySelectorAll('.order-card').forEach(card => card.remove());

            pastResponse.data.forEach(order => {
                const card = createOrderCard(order);
                pastSection.appendChild(card); 
            });
            
             if (pastResponse.data.length === 0) {
                 const p = document.createElement('p');
                 p.textContent = 'Geçmiş siparişiniz bulunmamaktadır.';
                 pastSection.appendChild(p);
            }
        }
    } catch(e) {
         console.error("Geçmiş siparişler yüklenirken hata oluştu:", e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderOrders();
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("Kullanıcı çıkış yaptı.");
            alert("Başarıyla çıkış yaptınız.");
        });
    }

});
