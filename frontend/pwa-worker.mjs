export function serviceWorkerSource({ assets, precache, version }) {
  return `
const CACHE = 'medicalsys-static-${version}';
const ALLOWED = new Set(${JSON.stringify([...assets, '/index.html', '/favicon.svg', '/manifest.webmanifest'])});
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(${JSON.stringify(['/index.html', '/favicon.svg', '/manifest.webmanifest', ...new Set(precache)])}))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('medicalsys-static-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api') || url.pathname.startsWith('/uploads')) return;
  if (event.request.mode === 'navigate') { event.respondWith(fetch(event.request).catch(() => caches.match('/index.html'))); return; }
  if (url.search || !ALLOWED.has(url.pathname)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request); if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok && response.type === 'basic') await cache.put(event.request, response.clone());
    return response;
  }));
});`;
}
