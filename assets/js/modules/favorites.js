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
                <div class="card" style="overflow: hidden;">
                    <div style="height: 160px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; font-weight: bold;">
                        ${(s.name || 'Restoran').substring(0, 2)}
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
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
    else load();
})();
