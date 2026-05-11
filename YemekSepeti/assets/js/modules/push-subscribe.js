/**
 * Web Push subscription yardımcısı.
 *  - Service Worker'ı kaydeder
 *  - window.enablePushNotifications() / window.disablePushNotifications() expose eder
 *  - Header bildirim dropdown'unda toggle butonu oluşturur
 */
(function () {
    const baseUrl = (typeof window.getBaseUrl === 'function') ? window.getBaseUrl() : '';

    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
        return outputArray;
    }

    function isSupported() {
        return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    }

    async function getRegistration() {
        if (!isSupported()) return null;
        try {
            return await navigator.serviceWorker.ready;
        } catch (e) { return null; }
    }

    async function getCurrentSubscription() {
        const reg = await getRegistration();
        if (!reg) return null;
        try { return await reg.pushManager.getSubscription(); } catch (e) { return null; }
    }

    async function fetchPublicKey() {
        try {
            const res = await fetch(baseUrl + '/api/push/public-key', { credentials: 'include' });
            if (!res.ok) return null;
            const data = await res.json();
            return data.success ? data.publicKey : null;
        } catch (e) { return null; }
    }

    async function enable() {
        if (!isSupported()) {
            alert('Tarayıcınız bildirimleri desteklemiyor.');
            return false;
        }
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            alert('Bildirim izni reddedildi.');
            return false;
        }
        const reg = await getRegistration();
        if (!reg) return false;

        const publicKey = await fetchPublicKey();
        if (!publicKey) {
            alert('Push servisi sunucuda yapılandırılmamış.');
            return false;
        }

        let sub;
        try {
            sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });
        } catch (e) {
            console.error('Push subscribe error:', e);
            alert('Bildirim aboneliği başarısız: ' + e.message);
            return false;
        }

        try {
            const subJson = sub.toJSON();
            const res = await fetch(baseUrl + '/api/push/subscribe', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subJson)
            });
            if (!res.ok) throw new Error('Sunucu kaydı başarısız');
            updateToggleUI(true);
            return true;
        } catch (e) {
            await sub.unsubscribe().catch(() => {});
            alert('Abonelik kaydedilemedi: ' + e.message);
            return false;
        }
    }

    async function disable() {
        const sub = await getCurrentSubscription();
        if (!sub) { updateToggleUI(false); return true; }
        try {
            await fetch(baseUrl + '/api/push/unsubscribe', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint: sub.endpoint })
            });
        } catch (e) {}
        try { await sub.unsubscribe(); } catch (e) {}
        updateToggleUI(false);
        return true;
    }

    function updateToggleUI(isOn) {
        const btn = document.getElementById('push-toggle-btn');
        if (!btn) return;
        btn.textContent = isOn ? '🔕 Bildirimleri Kapat' : '🔔 Bildirimleri Aç';
        btn.dataset.enabled = isOn ? '1' : '0';
    }

    async function injectToggleButton() {
        const dropdown = document.getElementById('header-notifications-dropdown');
        if (!dropdown) return;
        if (document.getElementById('push-toggle-btn')) return;

        // Dropdown başlığının altına ekle
        const btn = document.createElement('button');
        btn.id = 'push-toggle-btn';
        btn.className = 'btn btn-sm btn-secondary';
        btn.style.cssText = 'width: calc(100% - 2rem); margin: 0.5rem 1rem; display: block;';
        btn.textContent = '🔔 Bildirimleri Aç';

        const firstChild = dropdown.firstElementChild;
        if (firstChild) dropdown.insertBefore(btn, firstChild.nextSibling);
        else dropdown.appendChild(btn);

        const sub = await getCurrentSubscription();
        updateToggleUI(!!sub);

        btn.addEventListener('click', async function () {
            btn.disabled = true;
            if (btn.dataset.enabled === '1') {
                await disable();
            } else {
                await enable();
            }
            btn.disabled = false;
        });
    }

    async function registerServiceWorker() {
        if (!isSupported()) return;
        try {
            await navigator.serviceWorker.register('/sw.js');
        } catch (e) {
            console.warn('SW register hatası:', e.message);
        }
    }

    window.enablePushNotifications = enable;
    window.disablePushNotifications = disable;
    window.isPushSupported = isSupported;

    document.addEventListener('DOMContentLoaded', function () {
        registerServiceWorker();
        // Dropdown gec yüklenebilir; biraz bekle
        setTimeout(injectToggleButton, 800);
    });
})();
