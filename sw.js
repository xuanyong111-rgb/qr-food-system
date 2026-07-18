const CACHE_NAME = 'wuwangxin-pos-v1';

// 仅放入最核心的、100% 确定存在的静态资源路径
const urlsToCache = [
    './login.html',
    './shops.js',
    './manifest.json',
    './images/icon-192.png',
    './images/icon-512.png'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // 使用 map 单个执行添加，遇到不存在的文件自动跳过，绝不抛出崩溃异常
            return Promise.all(
                urlsToCache.map(url => {
                    return cache.add(url).catch(err => {
                        console.warn('PWA 静态资源缓存跳过（可能文件不存在）:', url, err);
                    });
                })
            );
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
    if (event.request.url.includes('firebasedatabase.app') || event.request.url.includes('googleapis.com')) {
        return;
    }
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});