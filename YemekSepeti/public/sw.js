const CACHE_NAME = 'ev-lezzetleri-v1';
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
