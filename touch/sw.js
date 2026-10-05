/* MÂY POS Touch – service worker CHỈ cho thư mục /touch/ (không ảnh hưởng bản V1 ở thư mục gốc). */
const CACHE = 'may-touch-v0.1';
const SHELL = ['./', './index.html', './touch.css', './touch.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('may-touch-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || !u.pathname.includes('/touch/')) return; // chỉ phục vụ file của /touch/
  // Mạng trước (luôn lấy bản mới nhất), mất mạng thì dùng bản đã lưu để app vẫn mở được.
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});
