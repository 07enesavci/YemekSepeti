(function() {
    const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';
    function authHeaders() {
        const t = localStorage.getItem('token');
        const h = { 'Content-Type': 'application/json' };
        if (t) h['Authorization'] = 'Bearer ' + t;
        return h;
    }
    function escapeHtml(s) {
        if (!s) return '';
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }
    async function load() {
        const loading = document.getElementById('favorites-loading');
        const empty = document.getElementById('favorites-empty');
        const list = document.getElementById('favorites-list');
        if (!loading || !empty || !list) return;
        try {
            const res = await fetch(baseUrl + '/api/favorites', { credentials: 'include', headers: authHeaders() });
            const data = await res.json();
            loading.style.display = 'none';
            if (!data.success || !data.favorites || data.favorites.length === 0) {
                empty.style.display = 'block';
                return;
            }
            list.style.display = 'grid';
            list.innerHTML = data.favorites.map(s => `
                <div class="card" data-seller-id="${s.id}" style="overflow: hidden;">
                    <div style="position: relative; height: 160px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; font-weight: bold;">
                        ${escapeHtml((s.name || 'Restoran').substring(0, 2))}
                        <span class="seller-status-badge" style="display:none; position:absolute; top:8px; right:8px; padding:3px 10px; border-radius:20px; font-size:0.75rem; font-weight:600; color:#fff;"></span>
                    </div>
                    <div class="card-content">
                        <h3 style="margin: 0 0 0.5rem 0;">${escapeHtml(s.name)}</h3>
                        <p style="margin: 0 0 0.5rem 0; color: #666; font-size: 0.9rem;">⭐ ${(s.rating || 0).toFixed(1)} · ${s.totalReviews || 0} değerlendirme</p>
                        <p style="margin: 0 0 1rem 0; font-size: 0.85rem; color: #888;">📍 ${escapeHtml(s.location)}</p>
                        <a href="/buyer/seller-profile/${s.id}" class="btn btn-primary btn-full">Menüyü Gör</a>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            loading.style.display = 'none';
            empty.style.display = 'block';
            const p = empty.querySelector('p');
            if (p) p.textContent = 'Favoriler yüklenirken bir hata oluştu.';
        }
    }
    function initFavoritesSocket() {
        if (!window.__socketManager) {
            setTimeout(initFavoritesSocket, 300);
            return;
        }
        // Favori restoran açıldı/kapandığında badge'i göster/güncelle
        window.__socketManager.on('seller_status_updated', function (data) {
            if (!data || data.sellerId == null) return;
            const card = document.querySelector(`[data-seller-id="${data.sellerId}"]`);
            if (!card) return;
            const badge = card.querySelector('.seller-status-badge');
            if (!badge) return;
            badge.textContent = data.isOpen ? 'Açık' : 'Kapalı';
            badge.style.background = data.isOpen ? '#22c55e' : '#ef4444';
            badge.style.display = 'inline-block';
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
    else load();
    initFavoritesSocket();
})();
