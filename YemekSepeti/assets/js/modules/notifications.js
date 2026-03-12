(function() {
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
        } catch (e) {}
    }

    async function markAllRead() {
        try {
            await fetch(baseUrl + '/api/notifications/read-all', { method: 'POST', credentials: 'include', headers: getAuthHeaders() });
        } catch (e) {}
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
            el.addEventListener('click', function() {
                const id = this.dataset.id;
                markRead(id).then(() => updateUnreadBadge());
                this.classList.add('read');
            });
        });
    }

    function escapeHtml(s) {
        if (!s) return '';
        const div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    function updateUnreadBadge() {
        const badge = document.getElementById('header-notifications-badge');
        if (!badge) return;
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

    function init() {
        const btn = document.getElementById('header-notifications-btn');
        const wrap = document.querySelector('.header-notifications-wrap');
        if (!btn || !wrap) return;
        updateUnreadBadge();
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleDropdown();
        });
        document.getElementById('notifications-mark-all-read')?.addEventListener('click', function() {
            markAllRead().then(() => {
                fetchNotifications().then(({ notifications }) => {
                    renderList(notifications.map(n => ({ ...n, isRead: true })));
                    updateUnreadBadge();
                });
            });
        });
        document.addEventListener('click', closeDropdown);
        if (typeof io !== 'undefined') {
            const socket = io(window.location.origin, { query: { userId: window.__userId || '', role: window.__userRole || '' } });
            socket.on('notification', function() {
                updateUnreadBadge();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    window.updateNotificationsBadge = updateUnreadBadge;
})();
