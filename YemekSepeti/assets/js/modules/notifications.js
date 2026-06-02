(function () {
    const baseUrl = window.getBaseUrl ? window.getBaseUrl() : '';

    function getAuthHeaders() {
        const token = window.localStorage && window.localStorage.getItem('token');
        const h = { 'Content-Type': 'application/json' };
        if (token) h['Authorization'] = 'Bearer ' + token;
        return h;
    }

    async function fetchNotifications() {
        try {
            const res = await fetch(baseUrl + '/api/notifications?limit=20', { credentials: 'include', headers: getAuthHeaders() });
            if (!res.ok) return { notifications: [], unreadCount: 0 };
            const data = await res.json();
            return { notifications: data.notifications || [], unreadCount: data.unreadCount != null ? data.unreadCount : 0 };
        } catch (e) {
            return { notifications: [], unreadCount: 0 };
        }
    }

    async function fetchUnreadCount() {
        try {
            const res = await fetch(baseUrl + '/api/notifications/unread-count', { credentials: 'include', headers: getAuthHeaders() });
            if (!res.ok) return 0;
            const data = await res.json();
            return data.unreadCount != null ? data.unreadCount : 0;
        } catch (e) {
            return 0;
        }
    }

    async function markRead(id) {
        try {
            await fetch(baseUrl + '/api/notifications/' + id + '/read', { method: 'PUT', credentials: 'include', headers: getAuthHeaders() });
        } catch (e) { }
    }

    async function markAllRead() {
        try {
            await fetch(baseUrl + '/api/notifications/read-all', { method: 'POST', credentials: 'include', headers: getAuthHeaders() });
        } catch (e) { }
    }

    function formatDate(d) {
        if (!d) return '';
        const date = new Date(d);
        const now = new Date();
        const diff = now - date;
        if (diff < 60000) return 'Az önce';
        if (diff < 3600000) return Math.floor(diff / 60000) + ' dk önce';
        if (diff < 86400000) return Math.floor(diff / 3600000) + ' saat önce';
        return date.toLocaleDateString('tr-TR');
    }

    function escapeHtml(s) {
        if (!s) return '';
        const div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    function renderList(notifications) {
        const listEl = document.getElementById('notifications-list');
        const emptyEl = document.getElementById('notifications-empty');
        if (!listEl) return;
        if (!notifications || notifications.length === 0) {
            listEl.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }
        if (emptyEl) emptyEl.style.display = 'none';
        listEl.innerHTML = notifications.map(n => `
            <div class="notifications-item ${n.isRead ? 'read' : ''}" data-id="${n.id}">
                <div class="notifications-item-title">${escapeHtml(n.title)}</div>
                <div class="notifications-item-message">${escapeHtml(n.message)}</div>
                <div class="notifications-item-time">${formatDate(n.createdAt)}</div>
            </div>
        `).join('');
        listEl.querySelectorAll('.notifications-item').forEach(el => {
            el.addEventListener('click', function () {
                const id = this.dataset.id;
                markRead(id).then(() => updateUnreadBadge());
                this.classList.add('read');
            });
        });
    }

    function updateUnreadBadge(countOverride) {
        const badge = document.getElementById('header-notifications-badge');
        if (!badge) return;
        if (countOverride !== undefined) {
            badge.textContent = countOverride > 99 ? '99+' : countOverride;
            badge.style.display = countOverride > 0 ? 'inline' : 'none';
            return;
        }
        fetchUnreadCount().then(count => {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = count > 0 ? 'inline' : 'none';
        });
    }

    function toggleDropdown() {
        const dd = document.getElementById('header-notifications-dropdown');
        if (!dd) return;
        if (dd.style.display === 'block') {
            dd.style.display = 'none';
            return;
        }
        dd.style.display = 'block';
        fetchNotifications().then(({ notifications, unreadCount }) => {
            renderList(notifications);
            const badge = document.getElementById('header-notifications-badge');
            if (badge) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.style.display = unreadCount > 0 ? 'inline' : 'none';
            }
        });
    }

    function closeDropdown(e) {
        const wrap = document.querySelector('.header-notifications-wrap');
        const dd = document.getElementById('header-notifications-dropdown');
        const btn = document.getElementById('header-notifications-btn');
        if (dd && btn && wrap && !wrap.contains(e.target)) dd.style.display = 'none';
    }

    function initSocketListener() {
        // socket-manager hazır değilse bekle
        if (!window.__socketManager) {
            setTimeout(initSocketListener, 300);
            return;
        }

        // 'notification' eventi - createNotification her çağrıldığında gelir
        window.__socketManager.on('notification', function (data) {
            // Rozeti güncelle
            updateUnreadBadge();

            // Dropdown açıksa listeyi de yenile
            const dd = document.getElementById('header-notifications-dropdown');
            if (dd && dd.style.display === 'block') {
                fetchNotifications().then(({ notifications }) => renderList(notifications));
            }
        });

        // Hesap onaylandı/reddedildi bildirimi (satıcı/kurye onayında admin tarafından gönderilir)
        window.__socketManager.on('account_approved', function (data) {
            updateUnreadBadge();
            if (window.__socketManager && window.__socketManager.notifyQueue) {
                // 'account_approved' tipi: "Hesabınız Onaylandı!" başlığı ile gösterilir
                window.__socketManager.notifyQueue('account_approved', null,
                    data && data.message ? data.message : 'Hesabınız onaylandı! Artık platform üzerinde aktif olabilirsiniz.');
            }
            // Sayfayı 2 saniye sonra yenile (onay sonrası yönlendirme için)
            setTimeout(function () {
                if (window.location.pathname.includes('/pending-approval') ||
                    window.location.pathname.includes('/courier/') ||
                    window.location.pathname.includes('/seller/')) {
                    window.location.reload();
                }
            }, 2000);
        });
        window.__socketManager.on('account_rejected', function (data) {
            updateUnreadBadge();
            if (window.__socketManager && window.__socketManager.notifyQueue) {
                // 'account_rejected' tipi: "Başvurunuz Reddedildi" başlığı ile gösterilir
                window.__socketManager.notifyQueue('account_rejected', null,
                    data && data.message ? data.message : 'Başvurunuz reddedildi.');
            }
        });
    }

    function init() {
        const btn = document.getElementById('header-notifications-btn');
        const wrap = btn ? btn.closest('.header-notifications-wrap') : null;
        if (!btn || !wrap) return;

        updateUnreadBadge();

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            toggleDropdown();
        });

        document.getElementById('notifications-mark-all-read')?.addEventListener('click', function () {
            markAllRead().then(() => {
                fetchNotifications().then(({ notifications }) => {
                    renderList(notifications.map(n => ({ ...n, isRead: true })));
                    updateUnreadBadge(0);
                });
            });
        });

        document.addEventListener('click', closeDropdown);

        // __socketManager üzerinden dinle (ayrı socket açma!)
        initSocketListener();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.updateNotificationsBadge = updateUnreadBadge;
})();
