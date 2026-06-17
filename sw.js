self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open('onion-store').then((cache) => cache.addAll([
            '/',
            '/index.html',
            '/app.js',
            '/manifest.json'
        ]))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(caches.match(e.request).then((response) => response || fetch(e.request)));
});