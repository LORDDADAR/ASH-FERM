const cacheName = `warm-farm:${self.registration.scope}:2`;
const assets = [
  './', './index.html', './style.css', './game.js', './manifest.webmanifest',
  './icon-192.png', './icon-512.png',
].map(path => new URL(path, self.registration.scope).href);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll(assets.map(url => new Request(url, { cache: 'reload' })));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const prefix = `warm-farm:${self.registration.scope}:`;
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(prefix) && name !== cacheName)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  url.search = '';
  if (request.method !== 'GET' || !assets.includes(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return await cache.match(url.href) || fetch(request);
  })());
});

self.addEventListener('message', event => {
  if (event.data !== 'check-cache' || !event.ports[0]) return;
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    const files = await Promise.all(assets.map(url => cache.match(url)));
    event.ports[0].postMessage(files.every(Boolean));
  })());
});
