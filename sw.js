const CACHE_NAME = 'onion-store-v0.3.5.2';

const ASSETS = [
    './',
    './index.html?v=0.3.5.2',
    './app.js?v=0.3.5.2',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            await Promise.allSettled(
                ASSETS.map((asset) => cache.add(asset).catch((err) => {
                    console.warn('[SW] 快取失敗，已略過：', asset, err);
                }))
            );
        })
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});
