// MÂY POS Touch – chỉ lưu sẵn KHUNG ỨNG DỤNG để mở được khi mạng chập chờn.
// Không bao giờ lưu/đọc hộ dữ liệu bán hàng: mọi yêu cầu tới máy chủ dữ liệu (supabase.co) đi thẳng mạng.
const CACHE = 'may-touch-1.0';
const SHELL = ['./', './index.html', './touch.css', './touch.js', './core.js', '../style.css', './manifest.webmanifest', './icon-192.png', './icon-512.png', './supabase.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  const shell = (u.origin === location.origin && (u.pathname.includes('/touch/') || u.pathname.endsWith('/style.css')));
  if (!shell) return; // dữ liệu, font, mọi thứ khác: để trình duyệt tự xử lý
  e.respondWith(fetch(r).then(res => { if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(r, c)); } return res; })
    .catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || (r.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
