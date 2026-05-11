const CACHE_NAME = 'ev-lezzetleri-v2';

self.addEventListener('install', function(event) {
    self.skipWaiting();
});

self.addEventListener('activate', function(event) {
    event.waitUntil(caches.keys().then(function(keys) {
        return Promise.all(keys.map(function(k) {
            if (k !== CACHE_NAME) return caches.delete(k);
        }));
    }).then(function() { return self.clients.claim(); }));
});

self.addEventListener('fetch', function(event) {
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(function() {
                return new Response(
                    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Çevrimdışı</title></head><body style="font-family:sans-serif;text-align:center;padding:2rem;"><h1>Çevrimdışısınız</h1><p>İnternet bağlantınızı kontrol edip sayfayı yenileyin.</p></body></html>',
                    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                );
            })
        );
        return;
    }
    event.respondWith(fetch(event.request));
});

// Web Push: gelen push'u göster
self.addEventListener('push', function(event) {
    let payload = {};
    try {
        if (event.data) payload = event.data.json();
    } catch (e) {
        try { payload = { title: 'Bildirim', body: event.data.text() }; } catch (_) { payload = {}; }
    }

    const title = payload.title || 'Ev Lezzetleri';
    const options = {
        body: payload.body || '',
        icon: payload.icon || '/favicon.png',
        badge: payload.badge || '/favicon.png',
        tag: payload.tag || undefined,
        data: { url: payload.url || '/', ...payload.data },
        vibrate: payload.vibrate || [120, 60, 120],
        requireInteraction: !!payload.requireInteraction
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

// Bildirime tıklayınca ilgili sayfayı aç
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientsArr) {
            // Açık bir sekme varsa odaklan
            for (const client of clientsArr) {
                if (client.url.indexOf(url) !== -1 && 'focus' in client) return client.focus();
            }
            // Yeni sekme aç
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});
