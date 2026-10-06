/* =====================================================================
   MÂY POS Touch – BẢN CHẠY THỬ (dữ liệu mẫu)
   - KHÔNG kết nối Supabase, KHÔNG ghi dữ liệu bán hàng thật.
   - "Máy chủ mẫu" nằm trong bộ nhớ trình duyệt của chính máy này (khóa MAY_TOUCH_DEMO_*),
     tách hẳn khỏi khóa của bản V1 (MAY_POS_*).
   - Cơ chế hàng chờ / mất mạng / xung đột / mã lệnh chống ghi trùng mô phỏng đúng 3.1d,
     để khi tích hợp, giao diện Touch gọi thẳng các hàm của 3.1d thay cho máy chủ mẫu.
   ===================================================================== */
(() => {
'use strict';
const VERSION = 'touch-0.2';
const K = { srv: 'MAY_TOUCH_DEMO_SERVER_V1', obx: 'MAY_TOUCH_DEMO_OUTBOX_V1', ui: 'MAY_TOUCH_DEMO_UI_V1' };

// Thực đơn: bản chụp thực đơn đang bán (chỉ đọc, 05/10/2026)
const MENU = [
 ['VIETNAM COFFEE','Cà phê đen',48000,'bar'],['VIETNAM COFFEE','Cà phê nâu',48000,'bar'],['VIETNAM COFFEE','Cà phê muối',65000,'bar'],['VIETNAM COFFEE','Cà phê trứng',65000,'bar'],
 ['COFFEE ITALIA','Espresso Double',58000,'bar'],['COFFEE ITALIA','Cappuccino',68000,'bar'],['COFFEE ITALIA','Latte',68000,'bar'],
 ['TRÀ / TEA','Trà đào cam xả',65000,'bar'],['TRÀ / TEA','Trà gừng xả mật ong',58000,'bar'],['TRÀ / TEA','Trà hoa ngũ sắc mật ong',65000,'bar'],
 ['NƯỚC ÉP / JUICES','Nước ép cam',65000,'bar'],['NƯỚC ÉP / JUICES','Nước ép dứa',65000,'bar'],['NƯỚC ÉP / JUICES','Nước ép dưa hấu',65000,'bar'],['NƯỚC ÉP / JUICES','Nước chanh leo',65000,'bar'],
 ['SINH TỐ / SMOOTHIES','Sinh tố bơ',68000,'bar'],['SINH TỐ / SMOOTHIES','Sinh tố xoài',68000,'bar'],['SINH TỐ / SMOOTHIES','Sinh tố chuối',68000,'bar'],
 ['ĐỒ ĐÁ XAY / ICE BLENDED','Cà phê đá xay',75000,'bar'],['ĐỒ ĐÁ XAY / ICE BLENDED','Cà phê Caramel đá xay',75000,'bar'],['ĐỒ ĐÁ XAY / ICE BLENDED','Matcha đá xay',75000,'bar'],['ĐỒ ĐÁ XAY / ICE BLENDED','Socola đá xay',75000,'bar'],
 ['BIA CHAI / BEERS','Bia Hà Nội',45000,'bar'],['BIA CHAI / BEERS','Bia Sài Gòn',45000,'bar'],
 ['ĐỒ ĂN VẶT / SNACKS','Thịt trâu sấy',155000,'kitchen'],['ĐỒ ĂN VẶT / SNACKS','Thịt lợn sấy',155000,'kitchen'],['ĐỒ ĂN VẶT / SNACKS','Hướng dương',30000,'kitchen']
].map(([cat, name, price, station], i) => ({ id: i + 1, cat, name, price, station }));
const CAT_COLOR = { 'VIETNAM COFFEE':'#8A5A2B','COFFEE ITALIA':'#6B4A33','TRÀ / TEA':'#7A8F2E','NƯỚC ÉP / JUICES':'#E07A12','SINH TỐ / SMOOTHIES':'#4F9A3A','ĐỒ ĐÁ XAY / ICE BLENDED':'#2F7FA8','BIA CHAI / BEERS':'#C9A21B','ĐỒ ĂN VẶT / SNACKS':'#B4502C' };
const CAT_BG = { 'VIETNAM COFFEE':'#EADCCB','COFFEE ITALIA':'#E6D6C6','TRÀ / TEA':'#E4E9CF','NƯỚC ÉP / JUICES':'#FBE1C2','SINH TỐ / SMOOTHIES':'#DDEBCF','ĐỒ ĐÁ XAY / ICE BLENDED':'#D8E7EE','BIA CHAI / BEERS':'#F3E2B3','ĐỒ ĂN VẶT / SNACKS':'#F1D5CB' };
const KIND = m => /COFFEE/.test(m.cat) || /gừng/.test(m.name) ? 'cup' : /BIA/.test(m.cat) ? 'bottle' : m.station === 'kitchen' ? 'bowl' : 'glass';
const GLYPH = {
  cup: '<path d="M10 16h24v12a10 10 0 0 1-10 10h-4a10 10 0 0 1-10-10z"/><path d="M34 19h3a5 5 0 0 1 0 10h-3"/><path d="M18 6c-2 3 2 4 0 7M25 6c-2 3 2 4 0 7"/>',
  bottle: '<path d="M20 4h8v8l4 6v24a3 3 0 0 1-3 3H19a3 3 0 0 1-3-3V18l4-6z"/><path d="M16 26h16"/>',
  glass: '<path d="M12 8h24l-3 32a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3z"/><path d="M13.5 20h21"/><path d="M30 4l-4 14"/>',
  bowl: '<path d="M6 22h36a18 18 0 0 1-36 0z"/><path d="M16 14c0-3 3-3 3-6M24 14c0-3 3-3 3-6M32 14c0-3 3-3 3-6"/>'
};
const glyph = m => '<svg viewBox="0 0 48 48" fill="none" stroke="#3B4A40" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + GLYPH[KIND(m)] + '</svg>';
const areaOf = t => (AREAS.find(a => a.tables.includes(Number(t))) || {}).name || '';
const CAT_SHORT = { 'VIETNAM COFFEE':'Cà phê Việt','COFFEE ITALIA':'Cà phê Ý','TRÀ / TEA':'Trà','NƯỚC ÉP / JUICES':'Nước ép','SINH TỐ / SMOOTHIES':'Sinh tố','ĐỒ ĐÁ XAY / ICE BLENDED':'Đá xay','BIA CHAI / BEERS':'Bia','ĐỒ ĂN VẶT / SNACKS':'Đồ ăn vặt' };
// Khu vực: mẫu (bản V1 chưa có khu vực trong dữ liệu)
const AREAS = [{ id: 'A', name: 'Khu A', tables: [1,2,3,4,5,6,7,8,9,10] }, { id: 'B', name: 'Khu B', tables: [11,12,13,14,15,16,17,18,19,20] }];
const ROLES = {
  waiter:  { name: 'Phục vụ',  user: 'Lan',  device: 'May1 Order',    views: ['tables', 'order'] },
  kitchen: { name: 'Bếp',      user: 'Hùng', device: 'May2 Bep',      views: ['kds'], station: 'kitchen' },
  bar:     { name: 'Bar',      user: 'Mai',  device: 'May3 Bar',      views: ['kds'], station: 'bar' },
  cashier: { name: 'Thu ngân', user: 'Hoa',  device: 'May4 Thu ngan', views: ['pay', 'tables', 'order'] },
  manager: { name: 'Quản lý',  user: 'Quản lý', device: 'May5 Quan ly', views: ['tables', 'order', 'kds', 'pay'] }
};
const VIEW_LABEL = { tables: 'Bàn', order: 'Order', kds: 'Bếp/Bar', pay: 'Thanh toán' };
const NOTE_CHIPS = ['Ít đá', 'Không đá', 'Ít đường', 'Không đường', 'Ít cay', 'Mang về', 'Làm nhanh'];

// ---------- tiện ích ----------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => Math.round(Number(n) || 0).toLocaleString('vi-VN') + 'đ';
const pad = n => String(n).padStart(2, '0');
const hm = ms => { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2));
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
const itemKey = x => x.id + '|' + x.price + '|' + (x.note || '');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const readJ = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? d; } catch (e) { return d; } };
const writeJ = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
const I = {
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  plus: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>',
  send: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>',
  clock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E7A45" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l4 4 10-10"/></svg>',
  wifiOff: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M2 8.5a15 15 0 0 1 20 0"/><path d="M5 12a10 10 0 0 1 14 0"/><path d="M8.5 15.5a5 5 0 0 1 7 0"/><path d="M3 3l18 18"/></svg>',
  search: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4A5A50" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  up: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A5A50" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>',
  retry: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>',
  warn: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>',
  dl: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0F5C33" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M12 7v7"/><path d="M9 11l3 3 3-3"/></svg>',
  more: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
  logo: '<svg width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 24l8-11 5 6 4-5 9 10z"/><path d="M9 9a4 4 0 0 1 7-2a3 3 0 0 1 5 2"/></svg>',
  grid: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  cart: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6h15l-2 9H8z"/><path d="M6 6L5 3H2"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/></svg>',
  fire: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 2 1 3 2 3 4"/></svg>',
  cash: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>'
};

// =====================================================================
// MÁY CHỦ MẪU (thay cho Supabase trong bản chạy thử). Dùng chung giữa các tab trên CÙNG máy.
// =====================================================================
const NET = { sim: false };
const isOnline = () => navigator.onLine !== false && !NET.sim;
class NetErr extends Error { constructor() { super('TypeError: Failed to fetch'); this.net = true; } }
function srvLoad() {
  let s = readJ(K.srv, null);
  if (!s || s.v !== 1) s = seed();
  return s;
}
function srvSave(s) { writeJ(K.srv, s); }
function seed() {
  const s = { v: 1, rev: 1, tables: {}, tickets: [], bills: [], billNo: 100 };
  const put = (t, lines, status) => { s.tables[t] = { items: lines.map(([n, q, sent, note]) => { const m = MENU.find(x => x.name === n); return { id: m.id, name: m.name, price: m.price, station: m.station, qty: q, sent, note: note || '' }; }), rev: Date.now() - 600000 + t, meta: { ops: [], round: 1 }, status: status || 'busy' }; };
  put(3, [['Thịt lợn sấy', 1, 1], ['Cà phê muối', 2, 2]]);
  put(9, [['Hướng dương', 3, 3], ['Bia Hà Nội', 4, 4]]);
  put(15, [['Thịt trâu sấy', 2, 2, 'Ít cay'], ['Trà đào cam xả', 2, 0]]);
  put(7, [['Cà phê muối', 2, 2], ['Thịt trâu sấy', 1, 1], ['Trà đào cam xả', 1, 1], ['Sinh tố bơ', 2, 2]], 'waiting');
  const tk = (t, n, q, st, mins, round, note) => s.tickets.push({ id: uid(), table: t, item: n, qty: q, station: MENU.find(x => x.name === n).station, status: st, created: Date.now() - mins * 60000, round, by: 'Lan', note: note || '' });
  tk(3, 'Thịt lợn sấy', 1, 'ĐANG LÀM', 14, 1); tk(3, 'Cà phê muối', 2, 'HOÀN THÀNH', 15, 1);
  tk(15, 'Thịt trâu sấy', 2, 'MỚI', 2, 1, 'Ít cay'); tk(9, 'Hướng dương', 3, 'HOÀN THÀNH', 8, 1); tk(9, 'Bia Hà Nội', 4, 'ĐANG LÀM', 3, 1);
  srvSave(s); return s;
}
async function call(fn) { // mọi lệnh "lên máy chủ" đi qua đây: mất mạng thì lỗi như thật
  await sleep(120 + Math.random() * 180);
  if (!isOnline()) throw new NetErr();
  const s = srvLoad(); const r = fn(s); srvSave(s); return r;
}
const api = {
  table: t => call(s => JSON.parse(JSON.stringify(s.tables[t] || null))),
  upsert: (t, row, baseRev) => call(s => {
    const cur = s.tables[t];
    if ((cur ? cur.rev : null) !== baseRev) { const e = new Error('POS_CONFLICT: Bàn ' + t + ' vừa được cập nhật ở máy khác'); e.conflict = true; throw e; }
    const rev = Math.max(Date.now(), (cur ? cur.rev : 0) + 1);
    s.tables[t] = { items: row.items, status: row.status || 'busy', meta: row.meta || {}, rev }; return rev;
  }),
  send: (t, by) => call(s => { // như pos_send_order: chỉ gửi phần chưa gửi, ghi nhận sent ngay trên máy chủ
    const o = s.tables[t]; if (!o) return { count: 0 };
    const round = ((o.meta && o.meta.round) || 0) + 1; let count = 0;
    o.items.forEach(x => { const d = x.qty - (x.sent || 0); if (d > 0) { s.tickets.push({ id: uid(), table: t, item: x.name, qty: d, station: x.station, status: 'MỚI', created: Date.now(), round, by, note: x.note || '' }); x.sent = x.qty; count += d; } });
    if (count) { o.meta = Object.assign({}, o.meta, { round }); o.rev = Math.max(Date.now(), o.rev + 1); }
    return { count, round };
  }),
  advance: id => call(s => { const t = s.tickets.find(x => x.id === id); const f = ['MỚI', 'ĐANG LÀM', 'HOÀN THÀNH', 'ĐÃ PHỤC VỤ']; if (t) t.status = f[Math.min(f.indexOf(t.status) + 1, 3)]; return t && t.status; }),
  pay: (t, method, given, by) => call(s => {
    const o = s.tables[t];
    if (!o || !o.items.length) { const e = new Error('Bàn ' + t + ' không còn món chờ thanh toán (có thể đã được thanh toán ở máy khác)'); e.paid = true; throw e; }
    const total = o.items.reduce((a, x) => a + x.price * x.qty, 0);
    if (method === 'Tiền mặt' && given && given < total) throw new Error('Tiền khách đưa chưa đủ');
    const bill = { no: ++s.billNo, table: t, items: o.items, total, method, given: given || null, change: given ? given - total : null, by, at: Date.now() };
    s.bills.push(bill); s.tables[t] = { items: [], status: '', meta: {}, rev: Math.max(Date.now(), o.rev + 1) }; return bill;
  }),
  otherDevice: t => { const s = srvLoad(); const o = s.tables[t] || { items: [], meta: {}, rev: null, status: 'busy' }; const m = MENU.find(x => x.name === 'Cà phê đen'); const x = o.items.find(i => itemKey(i) === itemKey({ id: m.id, price: m.price })); if (x) x.qty++; else o.items.push({ id: m.id, name: m.name, price: m.price, station: m.station, qty: 1, sent: 0, note: '' }); o.rev = Math.max(Date.now(), (o.rev || 0) + 1); o.status = 'busy'; s.tables[t] = o; srvSave(s); }
};

// =====================================================================
// HÀNG CHỜ MÓN CHƯA ĐỒNG BỘ – cùng quy tắc với 3.1d
// =====================================================================
let OBX = readJ(K.obx, {}); const GONE = new Set();
function obxMerge() { const d = readJ(K.obx, {}); for (const t of Object.keys(d)) { const dt = d[t]; if (!dt || !dt.ops) continue; const m = OBX[t]; if (!m || !m.ops || !m.ops.length) { const ops = dt.ops.filter(x => !GONE.has(x.id)); if (ops.length) OBX[t] = Object.assign({}, dt, { ops }); continue; } dt.ops.forEach(x => { if (!GONE.has(x.id) && !m.ops.some(y => y.id === x.id)) m.ops.push(x); }); } }
function saveObx() { obxMerge(); for (const k of Object.keys(OBX)) { if (OBX[k] && OBX[k].ops) OBX[k].ops = OBX[k].ops.filter(x => !GONE.has(x.id)); if (!OBX[k] || !OBX[k].ops || !OBX[k].ops.length) delete OBX[k]; } if (!writeJ(K.obx, OBX)) toast('Trình duyệt không cho lưu tạm món. Nếu mất mạng, đừng tải lại trang.'); }
const obx = t => { const o = OBX[t]; return o && o.ops && o.ops.length ? o : null; };
const obxQty = o => o.ops.reduce((s, x) => s + x.qty, 0);
const obxCount = () => Object.values(OBX).reduce((n, o) => n + (o && o.ops ? obxQty(o) : 0), 0);
const knownRev = {};
function obxAdd(t, item) {
  let o = OBX[t]; if (!o || !o.ops || !o.ops.length) o = OBX[t] = { base: knownRev[t] ?? null, ops: [], state: 'pending', sentRev: null };
  const op = o.ops.find(x => !x.tried && itemKey(x.item) === itemKey(item));
  if (op) op.qty++; else o.ops.push({ id: uid(), item, qty: 1, tried: false, at: Date.now(), by: ROLES[U.role].user });
  saveObx();
}
const syncing = {};
function syncTable(t) { t = Number(t); if (!obx(t)) return Promise.resolve('ok'); if (syncing[t]) return syncing[t];
  syncing[t] = (async () => { let r = 'offline'; try { r = await syncNow(t); return r; } catch (e) { return 'offline'; } finally { delete syncing[t]; render(); if (r === 'ok' && obx(t) && OBX[t].state === 'pending') setTimeout(() => syncTable(t), 30); } })(); return syncing[t]; }
async function syncNow(t) {
  for (let loop = 0; loop < 6; loop++) {
    obxMerge(); const o = obx(t); if (!o) { saveObx(); return 'ok'; }
    let R; try { R = await api.table(t); } catch (e) { o.lastErr = e.message; saveObx(); return 'offline'; }
    const rowRev = R ? R.rev : null, applied = new Set(((R && R.meta && R.meta.ops) || []).map(String));
    o.ops.forEach(x => { if (applied.has(String(x.id))) GONE.add(x.id); }); o.ops = o.ops.filter(x => !applied.has(String(x.id)));
    if (R) knownRev[t] = R.rev;
    if (!o.ops.length) { delete OBX[t]; saveObx(); return 'ok'; }
    if (o.sentRev != null && rowRev === o.sentRev) o.base = rowRev;
    if (o.state === 'conflict' || o.state === 'error') { saveObx(); return o.state; }
    if (rowRev !== (o.base ?? null)) { o.state = 'conflict'; o.srv = R ? R.items.map(x => x.qty + '× ' + x.name).join(', ') : ''; saveObx(); toast('Bàn ' + t + ': xung đột – cần xử lý món chưa đồng bộ'); return 'conflict'; }
    const items = JSON.parse(JSON.stringify((R && R.items) || []));
    o.ops.forEach(op => { const it = op.item, x = items.find(q => itemKey(q) === itemKey(it)); if (x) x.qty += op.qty; else items.push({ id: it.id, name: it.name, price: it.price, station: it.station, qty: op.qty, sent: 0, note: it.note || '' }); });
    const meta = Object.assign({}, (R && R.meta) || {}); meta.ops = [...(meta.ops || []), ...o.ops.map(x => x.id)].slice(-300);
    o.ops.forEach(x => { x.tried = true; }); saveObx();
    try { const rev = await api.upsert(t, { items, status: (R && R.status) || 'busy', meta }, rowRev); o.sentRev = rev; saveObx(); }
    catch (e) { if (e.conflict) continue; if (e.net) { o.lastErr = e.message; saveObx(); return 'offline'; } o.state = 'error'; o.msg = e.message; saveObx(); return 'error'; }
  }
  return 'retry';
}
async function syncAll() { for (const t of Object.keys(OBX)) if (obx(t) && OBX[t].state === 'pending') await syncTable(t); }
async function obxReady(t, what) { const o = obx(t); if (!o) return true; if (o.state === 'pending') await syncTable(t); if (!obx(t)) return true;
  toast('Bàn ' + t + ' còn ' + obxQty(obx(t)) + ' món CHƯA ĐỒNG BỘ – chưa thể ' + what); return false; }

// =====================================================================
// GIAO DIỆN
// =====================================================================
let U = Object.assign({ role: null, view: 'tables', area: 'all', table: null, cat: 'all', q: '', payTable: null, method: 'Tiền mặt', given: '' }, readJ(K.ui, {}));
const saveUi = () => writeJ(K.ui, { role: U.role, view: U.view, area: U.area, table: U.table, cat: U.cat });
let SRV = srvLoad();
function refresh() { SRV = srvLoad(); for (const t of Object.keys(SRV.tables)) knownRev[t] = SRV.tables[t].rev; }
refresh();
let toastTimer = null;
function toast(msg) { const e = $('#toast'); e.textContent = msg; e.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { e.hidden = true; }, 2600); }
const role = () => ROLES[U.role];
const has = v => role() && role().views.includes(v);

function statusPill() {
  const p = obxCount();
  if (!isOnline()) return '<span class="pill off">' + I.wifiOff + 'MẤT MẠNG' + (p ? '<span class="long"> · ' + p + ' món chờ</span>' : '') + '</span>';
  if (p) return '<span class="pill pend">' + I.clock + p + '<span class="long"> món CHƯA ĐỒNG BỘ</span><span class="short"> chờ</span></span>';
  return '<span class="pill on"><span class="dot"></span>Trực tuyến</span>';
}
function topBar() {
  const r = role(); let mid = '';
  const brand = '<div class="brand">' + I.logo + '<div><b>MÂY POS</b><small>Mây ơi Sapa</small></div></div>';
  if (U.view === 'order' && U.table) mid = '<button class="crumb" data-act="go" data-v="tables" aria-label="Về danh sách bàn">' + I.back + '<span>Bàn ' + pad(U.table) + '<small> · ' + esc(areaOf(U.table)) + '</small></span></button>';
  else if (U.view === 'kds') { const n = SRV.tickets.filter(x => x.status !== 'ĐÃ PHỤC VỤ' && x.status !== 'HOÀN THÀNH' && (!r.station || x.station === r.station)).length;
    mid = '<div class="vtitle"><b>' + (r.station === 'kitchen' ? 'BẾP' : r.station === 'bar' ? 'BAR' : 'BẾP + BAR') + '</b><span class="long">' + esc(r.device) + (r.station ? ' · chỉ hiện món ' + (r.station === 'kitchen' ? 'Bếp' : 'Bar') : '') + '</span></div><span class="pill cnt">' + n + '<span class="long"> phiếu đang chờ</span><span class="short"> chờ</span></span>'; }
  else if (U.view === 'pay') mid = '<div class="vtitle"><b>THU NGÂN</b><span class="long">' + esc(r.device) + '</span></div>';
  else mid = '<div class="vtitle"><b>Chọn bàn</b><span>' + esc(r.user) + ' · ' + esc(r.name) + '</span></div>';
  return '<header class="top' + (U.view === 'order' ? ' has-crumb' : '') + '">' + brand + mid + '<div class="grow"></div>' + statusPill() +
    '<div class="who"><b>' + esc(r.user) + '</b><span>' + esc(r.name) + ' · ' + esc(r.device) + '</span></div>' +
    '<button class="iconbtn" data-act="menu" aria-label="Tùy chọn bản chạy thử">' + I.more + '</button></header>' +
    '<div class="demo">BẢN CHẠY THỬ · DỮ LIỆU MẪU<span class="long"> · không kết nối, không ghi dữ liệu bán hàng thật</span></div>';
}
function netBar() {
  if (!isOnline()) return '<div class="netbar" role="status">' + I.wifiOff + '<span><b>Đang mất mạng.</b> Vẫn gọi món được – món giữ trên máy, tự gửi khi có mạng.<span class="long"> Chưa gửi Bếp/Bar, chưa thanh toán được.</span></span></div>';
  const c = Object.keys(OBX).filter(t => obx(t) && OBX[t].state !== 'pending');
  if (c.length) return '<div class="netbar conflict" role="alert"><span><b>Cần xử lý:</b> ' + c.map(t => 'Bàn ' + pad(t)).join(', ') + ' có món chưa đồng bộ bị xung đột. Mở bàn để chọn THÊM VÀO BÀN hoặc BỎ.</span></div>';
  return '';
}
function navBar() {
  const v = role().views; if (v.length < 2 || U.view === 'order') return '';
  const icon = { tables: I.grid, order: I.cart, kds: I.fire, pay: I.cash };
  return '<nav class="navb" aria-label="Màn hình">' + v.map(x => '<button data-act="go" data-v="' + x + '"' + (U.view === x ? ' aria-current="page"' : '') + '>' + icon[x] + VIEW_LABEL[x] + '</button>').join('') + '</nav>';
}

// ---------- Bàn ----------
function tableState(t) {
  const o = obx(t), row = SRV.tables[t];
  if (o && o.state !== 'pending') return { cls: 'conf', txt: 'XUNG ĐỘT' };
  if (o) return { cls: 'pend', txt: 'CHƯA ĐỒNG BỘ' };
  if (row && row.items.length) { const tot = row.items.reduce((a, x) => a + x.price * x.qty, 0); return row.status === 'waiting' ? { cls: 'wait', txt: 'CHỜ THANH TOÁN' } : { cls: 'busy', txt: money(tot) }; }
  return { cls: '', txt: 'Trống' };
}
function viewTables() {
  const areas = [{ id: 'all', name: 'Tất cả' }, ...AREAS];
  const list = U.area === 'all' ? AREAS.flatMap(a => a.tables) : AREAS.find(a => a.id === U.area).tables;
  return '<section class="tables"><div class="chips" role="group" aria-label="Khu vực">' + areas.map(a => '<button class="chip" data-act="area" data-v="' + a.id + '" aria-pressed="' + (U.area === a.id) + '">' + esc(a.name) + '</button>').join('') + '</div>' +
    '<div class="tgrid">' + list.map(t => { const s = tableState(t); return '<button class="tb ' + s.cls + '" data-act="table" data-v="' + t + '"><b>' + pad(t) + '</b><span>' + (s.cls === 'pend' || s.cls === 'conf' ? I.clock + ' ' : '') + esc(s.txt) + '</span></button>'; }).join('') + '</div>' +
    '<div class="legend"><span><i style="background:#fff;border:2px solid #D3DCD5"></i>Trống</span><span><i style="background:#0F5C33"></i>Đang phục vụ</span><span><i style="background:#FFF1D6;border:2px solid #E48B0B"></i>Chờ thanh toán</span><span><i style="border:2px dashed #8A4B00"></i>Chưa đồng bộ</span></div></section>';
}

// ---------- Order ----------
function cartModel(t) {
  const row = SRV.tables[t] || { items: [] }, o = obx(t);
  const fresh = row.items.filter(x => x.qty > (x.sent || 0)).map(x => ({ ...x, n: x.qty - (x.sent || 0) }));
  const sent = row.items.filter(x => (x.sent || 0) > 0).map(x => ({ ...x, n: x.sent }));
  const pend = o ? o.ops : [];
  const total = row.items.reduce((a, x) => a + x.price * x.qty, 0) + pend.reduce((a, x) => a + x.item.price * x.qty, 0);
  const qty = row.items.reduce((a, x) => a + x.qty, 0) + pend.reduce((a, x) => a + x.qty, 0);
  const newQty = fresh.reduce((a, x) => a + x.n, 0);
  return { row, o, fresh, sent, pend, total, qty, newQty };
}
function qtyInCart(t, m) { const c = cartModel(t); return c.row.items.filter(x => x.id === m.id).reduce((a, x) => a + x.qty, 0) + c.pend.filter(x => x.item.id === m.id).reduce((a, x) => a + x.qty, 0); }
function viewOrder() {
  if (!U.table) return viewTables();
  const t = U.table, cats = ['all', ...new Set(MENU.map(m => m.cat))];
  const q = norm(U.q.trim());
  const items = MENU.filter(m => q ? norm(m.name).includes(q) : (U.cat === 'all' || m.cat === U.cat));
  const prod = items.map(m => { const n = qtyInCart(t, m), nm = esc(m.name);
    return '<article class="pc' + (n ? ' in' : '') + '">' +
      '<button class="tap" data-act="add" data-v="' + m.id + '" aria-label="Thêm 1 ' + nm + '"><span class="ph" style="background:' + (CAT_BG[m.cat] || '#E6ECE8') + '">' + glyph(m) + (n ? '<span class="q">' + n + '</span>' : '') + '</span>' +
      '<span class="info"><span class="nm">' + nm + '</span><span class="meta"><b class="pr">' + money(m.price) + '</b><span class="st">' + (m.station === 'kitchen' ? 'Bếp' : 'Bar') + '</span></span></span></button>' +
      '<div class="ctl">' + (n ? '<button class="btn mi" data-act="minusMenu" data-v="' + m.id + '" aria-label="Bớt 1 ' + nm + '">' + I.minus + '</button><b class="qv">' + n + '</b><button class="btn g pl" data-act="add" data-v="' + m.id + '" aria-label="Thêm 1 ' + nm + '">' + I.plus + '</button>'
        : '<button class="btn go add" data-act="add" data-v="' + m.id + '" aria-label="Thêm 1 ' + nm + '">' + I.plus + '<span>Thêm</span></button>') + '</div></article>'; }).join('');
  return '<section class="order"><div class="menu">' +
    '<label class="search">' + I.search + '<span class="sr">Tìm món</span><input id="q" type="search" autocomplete="off" placeholder="Tìm món – gõ không dấu cũng được" value="' + esc(U.q) + '">' + (U.q ? '<button data-act="clearq" aria-label="Xóa tìm kiếm">' + I.x + '</button>' : '') + '</label>' +
    '<div class="chips" role="group" aria-label="Danh mục món">' + cats.map(c => '<button class="chip" data-act="cat" data-v="' + esc(c) + '" aria-pressed="' + (!q && U.cat === c) + '">' + esc(c === 'all' ? 'Tất cả' : (CAT_SHORT[c] || c)) + '</button>').join('') + '</div>' +
    '<div class="pgrid" id="pgrid">' + (prod || '<div class="empty">Không có món khớp “' + esc(U.q) + '”.</div>') + '</div></div>' +
    '<aside class="cart" aria-label="Giỏ món">' + cartPanel(t, false) + '</aside>' + cartBar(t) + '</section>';
}
function cartBody(t) {
  const c = cartModel(t); let h = '';
  if (c.o) {
    const q = obxQty(c.o), money2 = money(c.pend.reduce((a, x) => a + x.item.price * x.qty, 0));
    const mine = c.pend.map(x => x.qty + '× ' + esc(x.item.name)).join(' · ');
    if (c.o.state === 'conflict') h += '<section class="pendbox conf" role="alert"><div class="ttl">' + I.warn + '<b>XUNG ĐỘT · CHƯA ĐỒNG BỘ</b></div>' +
      '<p>Trong lúc máy này chưa đồng bộ, <b>máy khác đã sửa Bàn ' + pad(t) + '</b>. Món của máy này chưa được lưu và <b>không tự ghi đè</b>.</p>' +
      '<div class="cmp"><span>MÁY CHỦ ĐANG CÓ</span><span>' + (esc(c.o.srv) || 'Chưa có món') + '</span></div>' +
      '<div class="cmp mine"><span>MÓN TRÊN MÁY NÀY CHƯA LƯU</span><b>' + mine + '</b></div>' +
      '<button class="btn g tall" data-act="obxApply">THÊM VÀO BÀN<small>giữ món của máy này, cộng vào bản mới nhất</small></button>' +
      '<button class="btn danger" data-act="obxDrop">BỎ ' + q + ' MÓN NÀY</button>' +
      '<p class="hint">Chưa chọn thì bàn này chưa gửi Bếp/Bar và chưa thanh toán được.</p></section>';
    else h += '<section class="pendbox' + (c.o.state === 'error' ? ' conf' : '') + '"><b>' + (c.o.state === 'error' ? 'MÁY CHỦ TỪ CHỐI – CHƯA ĐỒNG BỘ' : 'CHƯA ĐỒNG BỘ · ' + q + ' món · ' + money2) + '</b><span>' +
      (c.o.state === 'error' ? esc(c.o.msg || '') : 'Giữ an toàn trên máy này, kể cả khi tải lại trang hay tắt trình duyệt. Tự gửi lên khi có mạng.') + '</span>' +
      '<div class="row"><button class="btn go w" data-act="obxRetry">' + I.retry + 'THỬ LẠI NGAY</button><button class="btn danger" data-act="obxDrop">BỎ</button></div></section>';
    h += '<div class="sec pend">' + I.clock + 'CHƯA ĐỒNG BỘ</div>' + c.pend.map(x => '<div class="line pend"><div class="info"><div class="nm">' + esc(x.item.name) + '</div><div class="sub">' + money(x.item.price) + ' × ' + x.qty + '</div>' + (x.item.note ? '<div class="note">' + esc(x.item.note) + '</div>' : '') + (x.tried ? '<div class="tag">đã gửi đi, chờ máy chủ xác nhận</div>' : '') + '</div>' +
      (x.tried ? '' : '<button class="btn sq" data-act="pendMinus" data-v="' + x.id + '" aria-label="Bớt 1 ' + esc(x.item.name) + '">' + I.minus + '</button>') + '<span class="qn">' + x.qty + '</span>' +
      (x.tried ? '' : '<button class="btn sq" data-act="pendNote" data-v="' + x.id + '" aria-label="Ghi chú ' + esc(x.item.name) + '">✎</button>') + '</div>').join('');
  }
  if (c.fresh.length) h += '<div class="sec new">MÓN MỚI · CHƯA GỬI</div>' + c.fresh.map(x => '<div class="line"><div class="info"><div class="nm">' + esc(x.name) + '</div><div class="sub">' + money(x.price) + ' × ' + x.n + ' = ' + money(x.price * x.n) + '</div>' + (x.note ? '<div class="note">' + esc(x.note) + '</div>' : '') + '</div>' +
      '<button class="btn sq" data-act="lineMinus" data-v="' + esc(itemKey(x)) + '" aria-label="Bớt 1 ' + esc(x.name) + '">' + I.minus + '</button><span class="qn">' + x.n + '</span><button class="btn sq g" data-act="linePlus" data-v="' + esc(itemKey(x)) + '" aria-label="Thêm 1 ' + esc(x.name) + '">' + I.plus + '</button></div>').join('');
  if (c.sent.length) h += '<div class="sec">ĐÃ GỬI BẾP/BAR</div>' + c.sent.map(x => '<div class="line sent">' + I.check + '<div class="info"><div class="nm" style="font-weight:600">' + esc(x.name) + '</div>' + (x.note ? '<div class="note">' + esc(x.note) + '</div>' : '') + '</div><b class="sx">× ' + x.n + '</b></div>').join('');
  if (!h) h = '<div class="empty">Chạm vào món bên cạnh để thêm.<br>Mỗi lần chạm = 1 phần.</div>';
  return h;
}
function sendButton(t) {
  const c = cartModel(t);
  if (!has('order')) return '';
  if (!isOnline()) return '<button class="send" disabled>Chờ có mạng để gửi Bếp/Bar</button>';
  if (c.o && c.o.state !== 'pending') return '<button class="send" disabled>Xử lý xung đột trước khi gửi</button>';
  const n = c.newQty + (c.o ? obxQty(c.o) : 0);
  if (!n) return '<button class="send" disabled>Chưa có món mới để gửi</button>';
  return '<button class="send" data-act="send">' + I.send + 'GỬI BẾP / BAR · ' + n + ' món</button>';
}
function cartPanel(t, inSheet) {
  const c = cartModel(t);
  return '<div class="chead"><h2>Giỏ món · Bàn ' + pad(t) + '</h2><span>' + c.qty + ' món</span>' + (inSheet ? '<button class="btn sq" data-act="closeSheet" aria-label="Đóng">' + I.x + '</button>' : '') + '</div>' +
    '<div class="clist">' + cartBody(t) + '</div><div class="cfoot"><div class="tot"><span>Tạm tính (' + c.qty + ' món)</span><b>' + money(c.total) + '</b></div>' + sendButton(t) + '</div>';
}
function cartBar(t) {
  const c = cartModel(t), p = c.o ? obxQty(c.o) : 0, n = c.newQty + p;
  const names = [...c.pend.map(x => x.qty + ' ' + x.item.name), ...c.fresh.map(x => x.n + ' ' + x.name)].join(' · ') || (c.sent.length ? 'Đã gửi hết' : 'Chưa có món');
  return '<div class="cartbar"><button class="sum" data-act="openCart" aria-label="Mở giỏ món"><span class="cnt' + (p ? ' p' : '') + '">' + n + '</span><span class="txt"><b>' + (p ? p + ' món CHƯA ĐỒNG BỘ' : 'Giỏ: ' + n + ' món mới') + '</b><span>' + esc(names) + '</span></span><b class="am">' + money(c.total) + '</b>' + I.up + '</button>' + sendButton(t) + '</div>';
}

// ---------- Bếp / Bar ----------
function viewKds() {
  const st = role().station; const now = Date.now();
  const tks = SRV.tickets.filter(x => x.status !== 'ĐÃ PHỤC VỤ' && (!st || x.station === st)).sort((a, b) => a.created - b.created);
  const col = (s, title, color) => { const list = tks.filter(x => x.status === s);
    return '<div class="kcol"><h2><i style="background:' + color + '"></i>' + title + ' <span style="font-weight:600;color:#4A5A50">· ' + list.length + '</span></h2>' + (list.map(x => { const m = Math.floor((now - x.created) / 60000), late = s !== 'HOÀN THÀNH' && m >= 12;
      const cls = s === 'ĐANG LÀM' ? 'doing' : s === 'HOÀN THÀNH' ? 'done' : ''; const btn = s === 'MỚI' ? 'BẮT ĐẦU LÀM' : s === 'ĐANG LÀM' ? 'XONG – BÁO PHỤC VỤ' : 'ĐÃ MANG RA';
      return '<article class="tk ' + cls + (late ? ' late' : '') + '"><div class="th"><b>Bàn ' + pad(x.table) + '</b><span class="age">' + m + ' phút' + (late ? ' · trễ' : '') + '</span></div><div class="it">' + x.qty + ' × ' + esc(x.item) + '</div>' + (x.note ? '<div class="nt">Ghi chú: ' + esc(x.note) + '</div>' : '') +
        '<div class="by">Lần #' + x.round + ' · ' + esc(x.by) + ' · gửi ' + hm(x.created) + (st ? '' : ' · ' + (x.station === 'bar' ? 'Bar' : 'Bếp')) + '</div><div class="act"><button class="main" data-act="advance" data-v="' + x.id + '">' + btn + '</button>' + (s === 'MỚI' ? '<button class="re" data-act="print">IN LẠI</button>' : '') + '</div></article>'; }).join('') || '<div class="empty" style="padding:20px">Không có phiếu.</div>') + '</div>'; };
  return '<section class="kds">' + col('MỚI', 'MỚI', '#E48B0B') + col('ĐANG LÀM', 'ĐANG LÀM', '#2F6FB5') + col('HOÀN THÀNH', 'HOÀN THÀNH', '#1E9E55') + '</section>';
}

// ---------- Thu ngân ----------
function viewPay() {
  const tabs = Object.keys(SRV.tables).map(Number).filter(t => SRV.tables[t].items.length || obx(t)).sort((a, b) => (SRV.tables[b].status === 'waiting') - (SRV.tables[a].status === 'waiting') || a - b);
  if (!U.payTable || !tabs.includes(U.payTable)) U.payTable = tabs[0] || null;
  const list = '<div class="plist"><h2>Bàn cần thanh toán</h2>' + (tabs.map(t => { const row = SRV.tables[t], tot = row.items.reduce((a, x) => a + x.price * x.qty, 0), o = obx(t);
      return '<button class="pt' + (row.status === 'waiting' ? ' wait' : '') + (o ? ' pend' : '') + '" data-act="payTable" data-v="' + t + '" aria-pressed="' + (U.payTable === t) + '"><span class="r1"><b>Bàn ' + pad(t) + '</b><b>' + money(tot) + '</b></span><span>' + (o ? 'CHƯA ĐỒNG BỘ – chưa thanh toán được' : (row.status === 'waiting' ? 'CHỜ THANH TOÁN' : 'Đang phục vụ') + ' · ' + row.items.reduce((a, x) => a + x.qty, 0) + ' món') + '</span></button>'; }).join('') || '<div class="empty">Chưa có bàn nào.</div>') + '</div>';
  if (!U.payTable) return '<section class="pay">' + list + '</section>';
  const t = U.payTable, row = SRV.tables[t], tot = row.items.reduce((a, x) => a + x.price * x.qty, 0);
  const given = Number(String(U.given).replace(/[^\d]/g, '')) || 0, change = given ? given - tot : null;
  const r50 = Math.ceil(tot / 50000) * 50000, r100 = Math.ceil(tot / 100000) * 100000;
  const quick = [...new Set([tot, r50, r100, 500000, 1000000].filter(v => v >= tot))].slice(0, 6);
  const blocked = !!obx(t) || !isOnline();
  return '<section class="pay">' + list +
    '<div class="bill"><div class="bh"><h2>Bàn ' + pad(t) + '</h2><span>' + esc(areaOf(t)) + '</span></div>' + row.items.map(x => '<div class="brow"><span>' + esc(x.name) + (x.note ? ' <small style="color:#4A5A50">(' + esc(x.note) + ')</small>' : '') + '</span><span>× ' + x.qty + '</span><b>' + (x.price * x.qty).toLocaleString('vi-VN') + '</b></div>').join('') +
      '<div style="margin-top:auto;display:flex;flex-direction:column;gap:6px"><div class="tot"><span>Tạm tính</span><span>' + money(tot) + '</span></div><div class="tot"><span>Giảm giá</span><span>0%</span></div><div class="tot"><b style="font-size:20px">TỔNG</b><b class="big">' + money(tot) + '</b></div><button class="btn go" data-act="print">IN TẠM TÍNH</button></div></div>' +
    '<div class="paybox"><h3>Phương thức</h3><div class="g2">' + ['Tiền mặt', 'Thẻ', 'QR', 'Kết hợp'].map(m => m === 'QR' ? '<button class="opt" disabled style="justify-content:center;height:58px;border-style:dashed;color:#4A5A50">QR · chưa cấu hình</button>' : '<button class="opt" style="justify-content:center;height:58px" data-act="method" data-v="' + m + '" aria-pressed="' + (U.method === m) + '">' + m + '</button>').join('') + '</div>' +
      (U.method === 'Tiền mặt' ? '<h3>Khách đưa</h3><div class="g3">' + quick.map(v => '<button class="opt" style="justify-content:center;height:54px;font-size:16px" data-act="given" data-v="' + v + '" aria-pressed="' + (given === v) + '">' + (v === tot ? 'Đủ tiền' : v.toLocaleString('vi-VN')) + '</button>').join('') + '</div>' +
        '<label style="display:flex;flex-direction:column;gap:6px;font-size:14px;color:#4A5A50">Số khác<input id="given" class="field" inputmode="numeric" value="' + (given ? given.toLocaleString('vi-VN') : '') + '" placeholder="Nhập số tiền khách đưa"></label>' +
        '<div class="change"><span style="font-weight:700">Trả lại khách</span><b>' + (change == null ? '—' : change < 0 ? 'Thiếu ' + money(-change) : money(change)) + '</b></div>' : '') +
      '<button class="send" style="margin-top:auto" data-act="pay"' + (blocked || (U.method === 'Tiền mặt' && given && given < tot) ? ' disabled' : '') + '>' + (blocked ? (!isOnline() ? 'Chờ có mạng để thanh toán' : 'Bàn còn món CHƯA ĐỒNG BỘ') : 'XÁC NHẬN THANH TOÁN') + '</button></div></section>';
}

// ---------- Chọn vai trò ----------
function viewRoles() {
  return '<section class="roles"><div class="hero"><div class="logo">' + I.logo.replace('width="30" height="30"', 'width="62" height="62"').replace('#FFFFFF', '#0F5C33') + '</div><b>MÂY POS</b><span>Mây ơi Sapa · Touch · bản chạy thử</span></div>' +
    '<div class="card"><h2>Chọn vai trò để thử</h2>' + Object.entries(ROLES).map(([k, r]) => '<button class="opt" data-act="role" data-v="' + k + '"><b>' + esc(r.name) + '</b><small>' + esc(r.views.map(v => VIEW_LABEL[v]).join(' · ')) + '</small></button>').join('') +
    '<p class="note">Bản thật sẽ đăng nhập bằng tài khoản như V1 và tự mở đúng màn hình theo quyền.</p></div>' +
    '<div class="card install">' + I.dl + '<span><b>Cài MÂY POS lên màn hình chính</b><br>Mở toàn màn hình như app, không thanh địa chỉ.</span><button class="btn g" data-act="install">CÀI</button></div></section>';
}

function render() {
  if (isOnline()) refresh(); // mất mạng: giữ dữ liệu máy chủ lần cuối nhìn thấy, như máy thật
  const app = $('#app'), keepQ = document.activeElement && document.activeElement.id === 'q', pos = keepQ ? document.activeElement.selectionStart : null;
  const keepScroll = [...document.querySelectorAll('.pgrid,.clist,.tgrid,.kcol,.plist,.bill')].map(e => e.scrollTop);
  if (!U.role || !ROLES[U.role]) { app.innerHTML = viewRoles(); return; }
  if (!has(U.view)) U.view = role().views[0];
  const body = U.view === 'order' ? viewOrder() : U.view === 'kds' ? viewKds() : U.view === 'pay' ? viewPay() : viewTables();
  app.className = 'v-' + U.view;
  app.innerHTML = topBar() + netBar() + '<main class="main">' + body + '</main>' + navBar();
  [...document.querySelectorAll('.pgrid,.clist,.tgrid,.kcol,.plist,.bill')].forEach((e, i) => { if (keepScroll[i]) e.scrollTop = keepScroll[i]; });
  if (keepQ) { const q = $('#q'); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (e) {} } }
  const sh = $('#sheet'); if (!sh.hidden && sh.dataset.kind === 'cart' && U.table) sh.innerHTML = '<div class="panel">' + cartPanel(U.table, true) + '</div>';
  saveUi();
}

// ---------- bảng trượt ----------
function openSheet(kind, html) { const sh = $('#sheet'); sh.dataset.kind = kind; sh.innerHTML = '<div class="panel">' + html + '</div>'; sh.hidden = false; }
function closeSheet() { const sh = $('#sheet'); sh.hidden = true; sh.innerHTML = ''; }
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
function menuSheet() {
  openSheet('menu', '<div class="ph"><h2>Tùy chọn bản chạy thử</h2><button class="btn sq" data-act="closeSheet" aria-label="Đóng">' + I.x + '</button></div><div class="pb">' +
    '<button class="opt" data-act="toggleNet" aria-pressed="' + NET.sim + '">' + I.wifiOff + (NET.sim ? 'Đang giả lập MẤT MẠNG – bấm để có mạng lại' : 'Giả lập MẤT MẠNG') + '</button>' +
    (U.table && has('order') ? '<button class="opt" data-act="other">Giả lập máy khác sửa Bàn ' + pad(U.table) + ' <small>(thêm 1 Cà phê đen)</small></button>' : '') +
    '<button class="opt" data-act="fullscreen">Toàn màn hình</button>' +
    '<button class="opt" data-act="install">Cài lên màn hình chính</button>' +
    '<button class="opt" data-act="switchRole">Đổi vai trò <small>(' + esc(role().name) + ')</small></button>' +
    '<button class="opt" data-act="reset">Xóa dữ liệu mẫu, làm lại từ đầu</button>' +
    '<p style="margin:4px 0 0;font-size:13px;color:#4A5A50">' + VERSION + ' · dữ liệu mẫu chỉ nằm trên máy này. Mở thêm tab Bếp/Bar trên cùng máy để xem phiếu chạy theo thời gian thực.</p></div>');
}
function noteSheet(opId) {
  const o = obx(U.table); const op = o && o.ops.find(x => x.id === opId); if (!op) return;
  const cur = op.item.note || '';
  openSheet('note', '<div class="ph"><h2>Ghi chú · ' + esc(op.item.name) + '</h2><button class="btn sq" data-act="closeSheet" aria-label="Đóng">' + I.x + '</button></div><div class="pb"><div class="notechips">' +
    NOTE_CHIPS.map(c => '<button data-act="noteChip" data-v="' + esc(c) + '" aria-pressed="' + cur.split(', ').includes(c) + '">' + esc(c) + '</button>').join('') + '</div>' +
    '<label style="display:flex;flex-direction:column;gap:6px;font-size:14px;color:#4A5A50">Ghi chú khác<input id="noteText" class="field" value="' + esc(cur) + '"></label></div>' +
    '<div class="pf"><button class="send" style="height:60px" data-act="noteSave" data-v="' + op.id + '">LƯU GHI CHÚ</button></div>');
}

// ---------- hành động ----------
const A = {
  role: v => { U.role = v; U.view = ROLES[v].views[0]; U.table = null; render(); },
  switchRole: () => { closeSheet(); U.role = null; render(); },
  go: v => { if (v === 'order' && !U.table) { U.view = 'tables'; toast('Chọn bàn trước'); } else U.view = v; closeSheet(); render(); },
  area: v => { U.area = v; render(); },
  table: v => { U.table = Number(v); U.q = ''; U.view = has('order') ? 'order' : U.view; render(); if (obx(U.table)) syncTable(U.table); },
  cat: v => { U.cat = v; U.q = ''; render(); },
  clearq: () => { U.q = ''; render(); },
  add: v => { const m = MENU.find(x => x.id === Number(v)); if (!m || !U.table) return; obxAdd(U.table, { id: m.id, name: m.name, price: m.price, station: m.station, note: '' }); render(); if (navigator.vibrate) navigator.vibrate(12); syncTable(U.table); },
  minusMenu: v => { const t = U.table, m = MENU.find(x => x.id === Number(v)); const o = obx(t); const op = o && [...o.ops].reverse().find(x => x.item.id === m.id && !x.tried);
    if (op) return A.pendMinus(op.id); if (o && o.ops.some(x => x.item.id === m.id)) return toast('Món đang chờ máy chủ xác nhận – bớt lại sau giây lát'); const line = (SRV.tables[t] || { items: [] }).items.find(x => x.id === m.id && x.qty > (x.sent || 0)); if (line) return A.lineMinus(itemKey(line)); toast('Món đã gửi Bếp/Bar – muốn hủy phải nhờ Quản lý'); },
  pendMinus: v => { const o = obx(U.table); const op = o && o.ops.find(x => x.id === v); if (!op) return; if (op.tried) return toast('Món đang chờ máy chủ xác nhận – chưa bớt được'); op.qty--; if (op.qty <= 0) { GONE.add(op.id); o.ops.splice(o.ops.indexOf(op), 1); } saveObx(); render(); },
  pendNote: v => noteSheet(v),
  noteChip: (v, el) => { const i = $('#noteText'); const parts = i.value ? i.value.split(', ').filter(Boolean) : []; const k = parts.indexOf(v); if (k >= 0) parts.splice(k, 1); else parts.push(v); i.value = parts.join(', '); el.setAttribute('aria-pressed', String(k < 0)); },
  noteSave: v => { const o = obx(U.table); const op = o && o.ops.find(x => x.id === v); if (op && !op.tried) { op.item = Object.assign({}, op.item, { note: $('#noteText').value.trim() }); saveObx(); } closeSheet(); render(); },
  linePlus: v => { const [id, price, note] = v.split('|'); const m = MENU.find(x => x.id === Number(id)); obxAdd(U.table, { id: m.id, name: m.name, price: Number(price), station: m.station, note: note || '' }); render(); syncTable(U.table); },
  lineMinus: async v => { const t = U.table; if (obx(t)) return toast('Bàn còn món CHƯA ĐỒNG BỘ – chờ đồng bộ rồi bớt'); if (!isOnline()) return toast('Mất mạng – chưa bớt được món đã lưu');
    try { const R = await api.table(t); const items = R.items.map(x => ({ ...x })); const x = items.find(i => itemKey(i) === v && i.qty > (i.sent || 0)); if (!x) return render(); x.qty--; const out = items.filter(i => i.qty > 0); await api.upsert(t, { items: out, status: out.length ? R.status : '', meta: R.meta }, R.rev); render(); }
    catch (e) { toast(e.conflict ? 'Bàn vừa được cập nhật ở máy khác – đã tải lại' : 'Chưa lưu được – kiểm tra mạng'); render(); } },
  send: async () => { const t = U.table; if (!(await obxReady(t, 'gửi Bếp/Bar'))) return render(); if (!isOnline()) return toast('Mất mạng – chưa gửi được');
    try { const r = await api.send(t, ROLES[U.role].user); toast(r.count ? 'Đã gửi Bếp/Bar · ' + r.count + ' món · lần #' + r.round : 'Không có món mới để gửi'); if (navigator.vibrate) navigator.vibrate([20, 40, 20]); } catch (e) { toast('Chưa gửi được: ' + e.message); } closeSheet(); render(); },
  openCart: () => { openSheet('cart', cartPanel(U.table, true)); },
  closeSheet: () => closeSheet(),
  obxRetry: async () => { const o = obx(U.table); if (o && o.state === 'error') { o.state = 'pending'; saveObx(); } const r = await syncTable(U.table); toast(r === 'ok' ? 'Đã đồng bộ' : r === 'offline' ? 'Chưa kết nối được máy chủ' : 'Bàn ' + U.table + ': ' + r); },
  obxApply: async () => { const t = U.table, o = obx(t); if (!o) return; try { const R = await api.table(t); o.base = R ? R.rev : null; o.state = 'pending'; o.srv = ''; saveObx(); await syncTable(t); toast('Đã thêm vào bàn theo bản mới nhất'); } catch (e) { toast('Cần có mạng để xử lý'); } },
  obxDrop: async () => { const t = U.table, o = obx(t); if (!o) return; try { const R = await api.table(t); const ap = new Set(((R && R.meta && R.meta.ops) || []).map(String)); o.ops.forEach(x => { GONE.add(x.id); }); delete OBX[t]; saveObx(); toast(o.ops.some(x => ap.has(String(x.id))) ? 'Các món đã có trên máy chủ' : 'Đã bỏ ' + obxQty(o) + ' món chưa đồng bộ'); render(); } catch (e) { toast('Cần có mạng để kiểm tra trước khi bỏ món'); } },
  advance: async v => { try { await api.advance(v); } catch (e) { toast('Mất mạng – chưa cập nhật được phiếu'); } render(); },
  print: () => toast('Bản chạy thử: chưa nối máy in'),
  payTable: v => { U.payTable = Number(v); U.given = ''; render(); },
  method: v => { U.method = v; render(); },
  given: v => { U.given = String(v); render(); },
  pay: async (v, el) => { const t = U.payTable; if (!(await obxReady(t, 'thanh toán'))) return render(); el.disabled = true; el.textContent = 'ĐANG LƯU…';
    const given = Number(String(U.given).replace(/[^\d]/g, '')) || 0;
    try { const b = await api.pay(t, U.method, U.method === 'Tiền mặt' ? given : 0, ROLES[U.role].user); U.given = ''; toast('Đã thanh toán HĐ mẫu #' + b.no + (b.change ? ' · trả lại ' + money(b.change) : '')); }
    catch (e) { toast(e.net ? 'Mất mạng – chưa thanh toán. Không có hóa đơn nào được tạo.' : e.message); }
    render(); },
  toggleNet: () => { NET.sim = !NET.sim; closeSheet(); render(); if (isOnline()) syncAll(); },
  other: () => { api.otherDevice(U.table); closeSheet(); toast('Máy khác vừa thêm 1 Cà phê đen vào Bàn ' + pad(U.table)); render(); },
  fullscreen: () => { closeSheet(); const d = document.documentElement; if (document.fullscreenElement) document.exitFullscreen(); else if (d.requestFullscreen) d.requestFullscreen().catch(() => toast('Trình duyệt không cho toàn màn hình – hãy cài lên màn hình chính')); else toast('Trên iPhone/iPad: bấm Chia sẻ → Thêm vào MH chính'); },
  install: async () => { closeSheet(); if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; } else toast('Chrome: menu ⋮ → Cài đặt ứng dụng. iPhone/iPad: Chia sẻ → Thêm vào MH chính'); },
  reset: () => { if (!confirm('Xóa toàn bộ dữ liệu mẫu trên máy này?')) return; localStorage.removeItem(K.srv); localStorage.removeItem(K.obx); OBX = {}; GONE.clear(); closeSheet(); U.table = null; refresh(); render(); toast('Đã làm lại dữ liệu mẫu'); },
  menu: () => menuSheet()
};
document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; const f = A[b.dataset.act]; if (f) { e.preventDefault(); f(b.dataset.v, b); } });
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });
document.addEventListener('input', e => {
  if (e.target.id === 'q') { U.q = e.target.value; render(); }
  if (e.target.id === 'given') { U.given = e.target.value; const pos = e.target.selectionStart; render(); const g = $('#given'); if (g) { g.focus(); try { g.setSelectionRange(g.value.length, g.value.length); } catch (x) {} } }
});
window.addEventListener('storage', e => { if (e.key === K.srv) render(); if (e.key === K.obx) { obxMerge(); render(); } });
window.addEventListener('online', () => { render(); syncAll(); });
window.addEventListener('offline', () => render());
setInterval(() => { if (isOnline() && Object.keys(OBX).length) syncAll(); if (U.view === 'kds') render(); }, 8000);
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {}));
render(); syncAll();
window.__touch = { api, OBX: () => OBX, NET, U, render, syncAll };
})();
