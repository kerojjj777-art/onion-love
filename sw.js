// 定義當前版本號，每次更新程式碼時，請修改這裡的版號 (例如變成 v0.0.2)
const CACHE_NAME = 'onion-store-v0.0.7';

// 加上 ?v=0.0.1 可以強制瀏覽器向伺服器拉取最新檔案，避免死守舊快取
const ASSETS = [
    './',
    './index.html?v=0.0.1',
    './app.js?v=0.0.1',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
    self.skipWaiting(); // 強制新的 Service Worker 立即接管
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (e) => {
    // 清除舊版本的快取
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
    // 採用 Network-First (網路優先) 策略，斷線時才退回快取
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});
