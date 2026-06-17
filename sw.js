// 這裡的版號已經幫你更新到 v0.1.0
const CACHE_NAME = 'onion-store-v0.1.0';

const ASSETS = [
    './',
    './index.html?v=0.1.0',
    './app.js?v=0.1.0',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) return caches.delete(key);
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