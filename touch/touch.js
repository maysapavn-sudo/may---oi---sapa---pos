/* =====================================================================
   MÂY POS Touch – giao diện cảm ứng cho Phục vụ / Bếp / Bar / Thu ngân / Quản lý
   - KHÔNG có logic nghiệp vụ riêng: mọi dữ liệu đọc từ lõi 3.1d (window.MAYPOS.snap(), bản sao chỉ đọc)
     và mọi thao tác gọi đúng hàm của 3.1d (hàng chờ, chống ghi trùng, xung đột, khóa thanh toán giữ nguyên).
   - Chỉ lưu trên máy: màn hình đang mở, danh mục, ô tìm kiếm (khóa MAY_TOUCH_UI) – không phải dữ liệu bán hàng.
   ===================================================================== */
(() => {
'use strict';
const VERSION = 'touch-1.0';
const M = window.MAYPOS;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => Math.round(Number(n) || 0).toLocaleString('vi-VN') + 'đ';
const pad = n => String(n).padStart(2, '0');
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
const hm = ms => { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const UIKEY = 'MAY_TOUCH_UI';
let UI = (() => { try { return Object.assign({ view: null, cat: 'all', q: '', more: null }, JSON.parse(localStorage.getItem(UIKEY) || '{}')); } catch (e) { return { view: null, cat: 'all', q: '', more: null }; } })();
UI.q = '';
const saveUi = () => { try { localStorage.setItem(UIKEY, JSON.stringify({ view: UI.view, cat: UI.cat, more: UI.more, user: UI.user })); } catch (e) {} };

if (!M) { document.body.insertAdjacentHTML('afterbegin', '<div style="padding:20px;background:#FDE7E4;color:#8E1B12;font:16px sans-serif">Không tải được lõi MÂY POS. Hãy tải lại trang.</div>'); return; }

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
  more: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
  logo: '<svg width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 24l8-11 5 6 4-5 9 10z"/><path d="M9 9a4 4 0 0 1 7-2a3 3 0 0 1 5 2"/></svg>',
  grid: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  fire: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 2 1 3 2 3 4"/></svg>',
  cash: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>',
  dots: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  up: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A5A50" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>',
  retry: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>',
  warn: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>',
  pen: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>'
};
const GLYPH = {
  cup: '<path d="M10 16h24v12a10 10 0 0 1-10 10h-4a10 10 0 0 1-10-10z"/><path d="M34 19h3a5 5 0 0 1 0 10h-3"/><path d="M18 6c-2 3 2 4 0 7M25 6c-2 3 2 4 0 7"/>',
  bottle: '<path d="M20 4h8v8l4 6v24a3 3 0 0 1-3 3H19a3 3 0 0 1-3-3V18l4-6z"/><path d="M16 26h16"/>',
  glass: '<path d="M12 8h24l-3 32a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3z"/><path d="M13.5 20h21"/><path d="M30 4l-4 14"/>',
  bowl: '<path d="M6 22h36a18 18 0 0 1-36 0z"/><path d="M16 14c0-3 3-3 3-6M24 14c0-3 3-3 3-6M32 14c0-3 3-3 3-6"/>'
};
const TILE = ['#EADCCB', '#E4E9CF', '#FBE1C2', '#DDEBCF', '#D8E7EE', '#F3E2B3', '#F1D5CB', '#E6D6C6', '#E2DDEF', '#D9EBE4'];
const tileBg = c => { let h = 0; for (const ch of String(c)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return TILE[h % TILE.length]; };
const kind = m => { const c = norm(m.cat + ' ' + m.name); return /bia|beer|ruou|wine|soda|coca|pepsi|nuoc suoi|lavie/.test(c) ? 'bottle' : /ca phe|coffee|espresso|latte|cappuc|tra gung|tra nong|hot/.test(c) ? 'cup' : m.station === 'bar' ? 'glass' : 'bowl'; };
const glyph = m => '<svg viewBox="0 0 48 48" fill="none" stroke="#3B4A40" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + GLYPH[kind(m)] + '</svg>';
const PAGE_LABEL = { overview: 'Tổng quan', bills: 'Hóa đơn', reports: 'Báo cáo', booking: 'Đặt chỗ', notify: 'Thông báo', shift: 'Ca & tiền', stock: 'Kho', recipes: 'Công thức', menuadmin: 'Thực đơn', dashboard: 'Dashboard', staff: 'Nhân viên', risk: 'Kiểm soát', audit: 'Nhật ký', backup: 'Sao lưu' };
const VIEW_LABEL = { tables: 'Bàn', pay: 'Thanh toán', kds: 'Bếp/Bar', more: 'Quản lý' };

let S = null; // bản chụp chỉ đọc mới nhất
const online = () => navigator.onLine !== false;
const obxOf = t => { const o = S && S.obx && S.obx[t]; return o && o.ops && o.ops.length ? o : null; };
const obxQty = o => o.ops.reduce((a, x) => a + x.qty, 0);
const otherPages = () => S.pages.filter(p => p !== 'sale' && p !== 'kds');
function viewsFor() {
  const v = [];
  if (S.pages.includes('sale')) v.push('tables');
  if (S.pages.includes('sale') && S.canPay) v.push('pay');
  if (S.pages.includes('kds')) v.push('kds');
  if (otherPages().length) v.push('more');
  return v;
}
function landing() {
  const v = viewsFor();
  if (S.user === 'cashier' && v.includes('pay')) return 'pay';
  if ((S.user === 'kitchen' || S.user === 'bar') && v.includes('kds')) return 'kds';
  return v[0] || 'more';
}
const canOrder = () => !!(S.perms && S.perms.order);

// ---------- chuyển màn: giữ trang V1 tương ứng đang "mở" để 3.1d chạy đúng (vd: tiếng báo phiếu mới ở Bếp) ----------
function v1PageFor(view) { return view === 'kds' ? 'kds' : view === 'more' ? (UI.more || otherPages()[0]) : 'sale'; }
function syncV1Page() { const p = v1PageFor(UI.view); if (!p || !S.pages.includes(p)) return; const cur = document.querySelector('main .page.on'); if (!cur || cur.id !== p) M.show(p); }
function go(view) {
  S = M.snap();
  if (view === 'order' && !S.table) view = 'tables';
  UI.view = view; saveUi(); closeSheet(); syncV1Page(); draw();
  const m = $('#t-main'); if (m) m.scrollTop = 0;
}
// chọn bàn bằng đúng nút bàn của 3.1d
function selectTable(t) { const b = document.querySelectorAll('#tables > button')[t - 1]; if (b) b.click(); }

// ---------- vẽ ----------
function statusPill() {
  const p = S.obxCount;
  if (!online()) return '<span class="pill off">' + I.wifiOff + 'MẤT MẠNG' + (p ? '<span class="long"> · ' + p + ' món chờ</span>' : '') + '</span>';
  if (p) return '<span class="pill pend">' + I.clock + p + '<span class="long"> món CHƯA ĐỒNG BỘ</span><span class="short"> chờ</span></span>';
  return S.live ? '<span class="pill on"><span class="dot"></span>Trực tuyến</span>' : '<span class="pill wait"><span class="dot"></span>Đang kết nối</span>';
}
function topBar() {
  let mid = '';
  const brand = '<div class="brand">' + I.logo + '<div><b>MÂY POS</b><small>Mây ơi Sapa</small></div></div>';
  if (UI.view === 'order' && S.table) mid = '<button class="crumb" data-act="go" data-v="tables" aria-label="Về danh sách bàn">' + I.back + '<span>Bàn ' + pad(S.table) + '</span></button>';
  else if (UI.view === 'kds') {
    const n = S.tickets.filter(x => x.status !== 'HOÀN THÀNH' && (!S.station || (S.station === 'bar') === (x.station === 'bar'))).length;
    mid = '<div class="vtitle"><b>' + (S.station === 'kitchen' ? 'BẾP' : S.station === 'bar' ? 'BAR' : 'BẾP + BAR') + '</b><span class="long">' + (S.station ? 'chỉ hiện món ' + (S.station === 'kitchen' ? 'Bếp' : 'Bar') : 'tất cả phiếu') + '</span></div><span class="pill cnt">' + n + '<span class="long"> phiếu đang chờ</span><span class="short"> chờ</span></span>';
  } else if (UI.view === 'pay') mid = '<div class="vtitle"><b>THU NGÂN</b></div>';
  else if (UI.view === 'more') mid = '<div class="vtitle"><b>' + esc(PAGE_LABEL[UI.more] || 'Quản lý') + '</b></div>';
  else mid = '<div class="vtitle"><b>Chọn bàn</b><span>' + esc(S.username || S.roleName) + '</span></div>';
  return '<header class="top' + (UI.view === 'order' ? ' has-crumb' : '') + '">' + brand + mid + '<div class="grow"></div>' + statusPill() +
    '<div class="who"><b>' + esc(S.username || S.roleName) + '</b><span>' + esc(S.roleName) + ' · ' + esc(S.device) + '</span></div>' +
    '<button class="iconbtn" data-act="menu" aria-label="Tùy chọn">' + I.more + '</button></header>';
}
function netBar() {
  if (!online()) return '<div class="netbar" role="status">' + I.wifiOff + '<span><b>Đang mất mạng.</b> Vẫn gọi món được – món giữ trên máy, tự gửi khi có mạng.<span class="long"> Chưa gửi Bếp/Bar, chưa thanh toán được.</span></span></div>';
  const c = Object.keys(S.obx || {}).filter(t => obxOf(t) && S.obx[t].state !== 'pending');
  if (c.length) return '<div class="netbar conflict" role="alert"><span><b>Cần xử lý:</b> ' + c.map(t => 'Bàn ' + pad(t)).join(', ') + ' có món chưa đồng bộ bị ' + (c.some(t => S.obx[t].state === 'conflict') ? 'xung đột' : 'máy chủ từ chối') + '. Mở bàn để xử lý.</span></div>';
  return '';
}
function navBar() {
  const v = viewsFor(); if (v.length < 2 || UI.view === 'order') return '';
  const icon = { tables: I.grid, pay: I.cash, kds: I.fire, more: I.dots };
  const cur = UI.view === 'order' ? 'tables' : UI.view;
  return '<nav class="navb" aria-label="Màn hình">' + v.map(x => '<button data-act="go" data-v="' + x + '"' + (cur === x ? ' aria-current="page"' : '') + '>' + icon[x] + VIEW_LABEL[x] + '</button>').join('') + '</nav>';
}

// ----- Bàn -----
function tableState(t) {
  const o = obxOf(t), row = S.tables[t];
  if (o && o.state !== 'pending') return { cls: 'conf', txt: o.state === 'conflict' ? 'XUNG ĐỘT' : 'BỊ TỪ CHỐI' };
  if (o) return { cls: 'pend', txt: 'CHƯA ĐỒNG BỘ' };
  if (row.status === 'waiting' && row.items.length) return { cls: 'wait', txt: 'CHỜ THANH TOÁN' };
  if (row.items.length) return { cls: 'busy', txt: money(row.total.total) };
  return { cls: '', txt: 'Trống' };
}
function viewTables() {
  let h = '<section class="tview"><div class="tgrid">';
  for (let t = 1; t <= 20; t++) { const s = tableState(t); h += '<button class="tb ' + s.cls + '" data-act="table" data-v="' + t + '"><b>' + pad(t) + '</b><span>' + (s.cls === 'pend' || s.cls === 'conf' ? I.clock + ' ' : '') + esc(s.txt) + '</span></button>'; }
  return h + '</div><div class="tlegend"><span><i style="background:#fff;border:2px solid #D3DCD5"></i>Trống</span><span><i style="background:#0F5C33"></i>Đang phục vụ</span><span><i style="background:#FFF1D6;border:2px solid #E48B0B"></i>Chờ thanh toán</span><span><i style="border:2px dashed #8A4B00"></i>Chưa đồng bộ</span></div></section>';
}

// ----- Order -----
function cartModel(t) {
  const row = S.tables[t], o = obxOf(t);
  const fresh = row.items.filter(x => x.qty > (x.sent || 0)).map(x => ({ ...x, n: x.qty - (x.sent || 0) }));
  const sent = row.items.filter(x => (x.sent || 0) > 0).map(x => ({ ...x, n: x.sent }));
  const pend = o ? o.ops : [];
  const psub = pend.reduce((a, x) => a + x.item.price * x.qty, 0);
  const qty = row.items.reduce((a, x) => a + x.qty, 0) + pend.reduce((a, x) => a + x.qty, 0);
  const newQty = fresh.reduce((a, x) => a + x.n, 0);
  return { row, o, fresh, sent, pend, psub, qty, newQty, total: row.total.total + psub * (1 - (row.discount || 0) / 100) };
}
const qtyInCart = (c, id) => c.row.items.filter(x => x.id === id).reduce((a, x) => a + x.qty, 0) + c.pend.filter(x => x.item.id === id).reduce((a, x) => a + x.qty, 0);
function viewOrder() {
  const t = S.table; if (!t) return viewTables();
  const c = cartModel(t), menu = S.menu;
  const cats = ['all', ...new Set(menu.map(m => m.cat))];
  if (UI.cat !== 'all' && !cats.includes(UI.cat)) UI.cat = 'all';
  const q = norm(UI.q.trim());
  const items = menu.filter(m => q ? (norm(m.name).includes(q) || norm(m.en).includes(q) || norm(m.code).includes(q)) : (UI.cat === 'all' || m.cat === UI.cat));
  const prod = items.map(m => { const n = qtyInCart(c, m.id), nm = esc(m.name);
    return '<article class="pc' + (n ? ' in' : '') + '">' +
      '<button class="tap" data-act="add" data-v="' + m.id + '" aria-label="Thêm 1 ' + nm + '"><span class="ph" style="background:' + tileBg(m.cat) + '">' + glyph(m) + (n ? '<span class="q">' + n + '</span>' : '') + '</span>' +
      '<span class="info"><span class="nm">' + (m.signature ? '★ ' : '') + nm + '</span><span class="meta"><b class="pr">' + (m.marketPrice ? 'Thời giá' : money(m.price)) + (m.unit && m.unit !== 'Phần' ? '<small>/' + esc(m.unit) + '</small>' : '') + '</b><span class="st">' + (m.station === 'bar' ? 'Bar' : 'Bếp') + '</span></span></span></button>' +
      '<div class="ctl">' + (n ? '<button class="btn mi" data-act="minusMenu" data-v="' + m.id + '" aria-label="Bớt 1 ' + nm + '">' + I.minus + '</button><b class="qv">' + n + '</b><button class="btn g pl" data-act="add" data-v="' + m.id + '" aria-label="Thêm 1 ' + nm + '">' + I.plus + '</button>'
        : '<button class="btn go add" data-act="add" data-v="' + m.id + '" aria-label="Thêm 1 ' + nm + '">' + I.plus + '<span>Thêm</span></button>') + '</div></article>'; }).join('');
  return '<section class="order"><div class="menu">' +
    '<label class="search">' + I.search + '<span class="sr">Tìm món</span><input id="tq" type="search" autocomplete="off" placeholder="Tìm món – gõ không dấu cũng được" value="' + esc(UI.q) + '">' + (UI.q ? '<button data-act="clearq" aria-label="Xóa tìm kiếm">' + I.x + '</button>' : '') + '</label>' +
    '<div class="chips" role="group" aria-label="Danh mục món">' + cats.map(k => '<button class="chip" data-act="cat" data-v="' + esc(k) + '" aria-pressed="' + (!q && UI.cat === k) + '">' + esc(k === 'all' ? 'Tất cả' : k) + '</button>').join('') + '</div>' +
    '<div class="pgrid" id="pgrid">' + (prod || '<div class="tempty">' + (menu.length ? 'Không có món khớp “' + esc(UI.q) + '”.' : 'Chưa tải được thực đơn.') + '</div>') + '</div></div>' +
    '<aside class="cart" aria-label="Giỏ món">' + cartPanel(t, false) + '</aside>' + cartBar(t) + '</section>';
}
function cartBody(t) {
  const c = cartModel(t); let h = '';
  if (c.o) {
    const q = obxQty(c.o), mine = c.pend.map(x => x.qty + '× ' + esc(x.item.name)).join(' · ');
    if (c.o.state === 'conflict') h += '<section class="pendbox conf" role="alert"><div class="ttl">' + I.warn + '<b>XUNG ĐỘT · CHƯA ĐỒNG BỘ</b></div>' +
      '<p>Trong lúc máy này chưa đồng bộ, <b>máy khác đã sửa Bàn ' + pad(t) + '</b>. Món của máy này chưa được lưu và <b>không tự ghi đè</b>.</p>' +
      '<div class="cmp"><span>MÁY CHỦ ĐANG CÓ</span><span>' + (esc(c.o.srv) || 'Chưa có món') + '</span></div>' +
      '<div class="cmp mine"><span>MÓN TRÊN MÁY NÀY CHƯA LƯU</span><b>' + mine + '</b></div>' +
      '<button class="btn g tall" data-act="obxApply">THÊM VÀO BÀN<small>giữ món của máy này, cộng vào bản mới nhất</small></button>' +
      '<button class="btn danger" data-act="obxDrop">BỎ ' + q + ' MÓN NÀY</button>' +
      '<p class="hint">Chưa chọn thì bàn này chưa gửi Bếp/Bar và chưa thanh toán được.</p></section>';
    else h += '<section class="pendbox' + (c.o.state === 'error' ? ' conf' : '') + '"><b>' + (c.o.state === 'error' ? 'MÁY CHỦ TỪ CHỐI – CHƯA ĐỒNG BỘ' : 'CHƯA ĐỒNG BỘ · ' + q + ' món · ' + money(c.psub)) + '</b><span>' +
      (c.o.state === 'error' ? esc(c.o.msg || '') : 'Giữ an toàn trên máy này, kể cả khi tải lại trang hay tắt trình duyệt. Tự gửi lên khi có mạng.') + '</span>' +
      '<div class="row"><button class="btn go w" data-act="obxRetry">' + I.retry + 'THỬ LẠI NGAY</button><button class="btn danger" data-act="obxDrop">BỎ</button></div></section>';
    h += '<div class="sec pend">' + I.clock + 'CHƯA ĐỒNG BỘ</div>' + c.pend.map(x => '<div class="line pend"><div class="info"><div class="nm">' + esc(x.item.name) + '</div><div class="sub">' + money(x.item.price) + ' × ' + x.qty + '</div>' + (x.item.note ? '<div class="note">' + esc(x.item.note) + '</div>' : '') + (x.tried ? '<div class="tag">đã gửi đi, chờ máy chủ xác nhận</div>' : '') + '</div>' +
      (x.tried ? '' : '<button class="btn sq" data-act="pendMinus" data-v="' + esc(x.id) + '" aria-label="Bớt 1 ' + esc(x.item.name) + '">' + I.minus + '</button>') + '<span class="qn">' + x.qty + '</span></div>').join('');
  }
  if (c.fresh.length) h += '<div class="sec new">MÓN MỚI · CHƯA GỬI</div>' + c.fresh.map(x => '<div class="line"><div class="info"><div class="nm">' + esc(x.name) + '</div><div class="sub">' + money(x.price) + ' × ' + x.n + ' = ' + money(x.price * x.n) + '</div>' + (x.note ? '<div class="note">' + esc(x.note) + '</div>' : '') + '</div>' +
      '<button class="btn sq" data-act="lineMinus" data-v="' + esc(x.id) + '" aria-label="Bớt 1 ' + esc(x.name) + '">' + I.minus + '</button><span class="qn">' + x.n + '</span><button class="btn sq g" data-act="linePlus" data-v="' + esc(x.id) + '" aria-label="Thêm 1 ' + esc(x.name) + '">' + I.plus + '</button><button class="btn sq nt" data-act="note" data-v="' + esc(x.id) + '" aria-label="Ghi chú ' + esc(x.name) + '">' + I.pen + '</button></div>').join('');
  if (c.sent.length) h += '<div class="sec">ĐÃ GỬI BẾP/BAR</div>' + c.sent.map(x => '<div class="line sent">' + I.check + '<div class="info"><div class="nm">' + esc(x.name) + '</div>' + (x.note ? '<div class="note">' + esc(x.note) + '</div>' : '') + '</div><b class="sx">× ' + x.n + '</b></div>').join('');
  if (!h) h = '<div class="tempty">Chạm vào món bên cạnh để thêm.<br>Mỗi lần chạm = 1 phần.</div>';
  return h;
}
function sendButton(t) {
  const c = cartModel(t);
  if (!canOrder()) return '';
  if (!online()) return '<button class="send" disabled>Chờ có mạng để gửi Bếp/Bar</button>';
  if (c.o && c.o.state !== 'pending') return '<button class="send" disabled>Xử lý xung đột trước khi gửi</button>';
  const n = c.newQty + (c.o ? obxQty(c.o) : 0);
  if (!n) return '<button class="send" disabled>Chưa có món mới để gửi</button>';
  return '<button class="send" data-act="send">' + I.send + 'GỬI BẾP / BAR · ' + n + ' món</button>';
}
function cartPanel(t, inSheet) {
  const c = cartModel(t);
  return '<div class="chead"><h2>' + (inSheet ? 'Bàn ' : 'Giỏ món · Bàn ') + pad(t) + '</h2><span>' + c.qty + ' món</span><button class="btn moreb" data-act="tableMenu" aria-label="Thao tác khác của bàn">' + I.dots + '<span>Khác</span></button>' + (inSheet ? '<button class="btn sq" data-act="closeSheet" aria-label="Đóng">' + I.x + '</button>' : '') + '</div>' +
    '<div class="clist">' + cartBody(t) + '</div><div class="cfoot"><div class="tot"><span>Tạm tính (' + c.qty + ' món)' + (c.row.discount ? ' · giảm ' + c.row.discount + '%' : '') + '</span><b>' + money(c.total) + '</b></div>' +
    sendButton(t) + '</div>';
}
function cartBar(t) {
  const c = cartModel(t), p = c.o ? obxQty(c.o) : 0, n = c.newQty + p;
  const names = [...c.pend.map(x => x.qty + ' ' + x.item.name), ...c.fresh.map(x => x.n + ' ' + x.name)].join(' · ') || (c.sent.length ? 'Đã gửi hết' : 'Chưa có món');
  return '<div class="cartbar"><button class="sum" data-act="openCart" aria-label="Mở giỏ món"><span class="cnt' + (p ? ' p' : '') + '">' + n + '</span><span class="txt"><b>' + (p ? p + ' món CHƯA ĐỒNG BỘ' : 'Giỏ: ' + n + ' món mới') + '</b><span>' + esc(names) + '</span></span><b class="am">' + money(c.total) + '</b>' + I.up + '</button>' +
    sendButton(t) + '</div>';
}

// ----- Bếp / Bar -----
function viewKds() {
  const st = S.station, now = Date.now();
  const tks = S.tickets.filter(x => !st || (st === 'bar') === (x.station === 'bar')).sort((a, b) => a.created - b.created);
  const col = (s, color) => { const list = tks.filter(x => x.status === s);
    return '<div class="kcol"><h2><i style="background:' + color + '"></i>' + s + ' <span>· ' + list.length + '</span></h2>' + (list.map(x => { const m = Math.max(0, Math.floor((now - x.created) / 60000)), late = s !== 'HOÀN THÀNH' && m >= 12;
      const cls = s === 'ĐANG LÀM' ? 'doing' : s === 'HOÀN THÀNH' ? 'done' : ''; const btn = s === 'MỚI' ? 'BẮT ĐẦU LÀM' : s === 'ĐANG LÀM' ? 'XONG – BÁO PHỤC VỤ' : 'ĐÃ MANG RA';
      return '<article class="tk ' + cls + (late ? ' late' : '') + '"><div class="th"><b>Bàn ' + pad(x.table) + '</b><span class="age">' + m + ' phút' + (late ? ' · trễ' : '') + '</span></div><div class="it">' + x.qty + ' × ' + esc(x.item) + '</div>' + (x.note ? '<div class="nt">Ghi chú: ' + esc(x.note) + '</div>' : '') +
        '<div class="by">Lần #' + (x.round || 1) + ' · ' + esc(x.by || '') + (x.created ? ' · gửi ' + hm(x.created) : '') + (st ? '' : ' · ' + (x.station === 'bar' ? 'Bar' : 'Bếp')) + '</div><div class="act"><button class="main" data-act="advance" data-v="' + esc(x.id) + '">' + btn + '</button>' + (x.batch ? '<button class="re" data-act="reprint" data-v="' + esc(x.batch) + '|' + (x.station === 'bar' ? 'bar' : 'kitchen') + '">' + (x.printed ? 'IN LẠI' : 'IN PHIẾU') + '</button>' : '') + '</div></article>'; }).join('') || '<div class="tempty">Không có phiếu.</div>') + '</div>'; };
  return '<section class="kds">' + col('MỚI', '#E48B0B') + col('ĐANG LÀM', '#2F6FB5') + col('HOÀN THÀNH', '#1E9E55') + '</section>';
}

// ----- Thu ngân -----
function viewPay() {
  const list = []; for (let t = 1; t <= 20; t++) if (S.tables[t].items.length || obxOf(t)) list.push(t);
  list.sort((a, b) => (S.tables[b].status === 'waiting') - (S.tables[a].status === 'waiting') || a - b);
  const sel = list.includes(S.table) ? S.table : null;
  const side = '<div class="plist"><h2>Bàn cần thanh toán</h2>' + (list.map(t => { const r = S.tables[t], o = obxOf(t), n = r.items.reduce((a, x) => a + x.qty, 0);
    return '<button class="pt' + (r.status === 'waiting' ? ' wait' : '') + (o ? ' pend' : '') + '" data-act="payTable" data-v="' + t + '" aria-pressed="' + (sel === t) + '"><span class="r1"><b>Bàn ' + pad(t) + '</b><b>' + money(r.total.total) + '</b></span><span>' + (o ? 'CHƯA ĐỒNG BỘ – chưa thanh toán được' : (r.status === 'waiting' ? 'CHỜ THANH TOÁN' : 'Đang phục vụ') + ' · ' + n + ' món') + '</span></button>'; }).join('') || '<div class="tempty">Chưa có bàn nào cần thanh toán.</div>') + '</div>';
  if (!sel) return '<section class="pay">' + side + (list.length ? '<div class="pbill pick"><div class="tempty">Chọn bàn bên cạnh để xem hóa đơn.</div></div>' : '') + '</section>';
  const r = S.tables[sel], o = obxOf(sel), blocked = !!o || !online();
  return '<section class="pay">' + side +
    '<div class="pbill"><div class="bh"><h2>Bàn ' + pad(sel) + '</h2><span>' + r.items.reduce((a, x) => a + x.qty, 0) + ' món</span></div>' +
    r.items.map(x => '<div class="brow"><span>' + esc(x.name) + (x.note ? ' <small>(' + esc(x.note) + ')</small>' : '') + '</span><span>× ' + x.qty + '</span><b>' + (x.price * x.qty).toLocaleString('vi-VN') + '</b></div>').join('') +
    '<div class="bsum"><div class="tot"><span>Tạm tính</span><span>' + money(r.total.sub) + '</span></div><div class="tot"><span>Giảm giá</span><span>' + (r.discount || 0) + '%</span></div><div class="tot"><b class="tl">TỔNG</b><b class="big">' + money(r.total.total) + '</b></div></div></div>' +
    '<div class="paybox"><h3>Thanh toán Bàn ' + pad(sel) + '</h3>' +
    (o ? '<div class="pendbox conf"><b>Bàn còn ' + obxQty(o) + ' món CHƯA ĐỒNG BỘ</b><span>Chờ máy order đồng bộ xong (hoặc xử lý xung đột) rồi mới thanh toán.</span></div>' : '') +
    '<button class="send" data-act="pay"' + (blocked ? ' disabled' : '') + '>' + (blocked ? (!online() ? 'Chờ có mạng để thanh toán' : 'Bàn còn món CHƯA ĐỒNG BỘ') : I.cash + 'THANH TOÁN') + '</button>' +
    '<div class="g2"><button class="btn" data-act="v1" data-v="printTemp">IN TẠM TÍNH</button>' + (S.disc ? '<button class="btn" data-act="v1" data-v="discount">GIẢM GIÁ</button>' : '') +
    '<button class="btn" data-act="v1" data-v="markPay">CHỜ THANH TOÁN</button>' + (S.perms.move_table ? '<button class="btn" data-act="v1" data-v="splitBill">TÁCH HÓA ĐƠN</button>' : '') + '</div>' +
    '<p class="hint">Bấm THANH TOÁN để chọn phương thức, nhập tiền khách đưa và xác nhận.</p></div></section>';
}

// ----- Quản lý (các trang có sẵn của V1) -----
function viewMore() {
  const pages = otherPages(); if (!pages.includes(UI.more)) UI.more = pages[0];
  $('#t-pages').innerHTML = '<div class="chips mchips" role="group" aria-label="Trang quản lý">' + pages.map(p => '<button class="chip" data-act="more" data-v="' + p + '" aria-pressed="' + (UI.more === p) + '">' + esc(PAGE_LABEL[p] || p) + '</button>').join('') + '</div>';
  return '';
}

// ---------- bảng trượt ----------
function openSheet(kind, html) { const sh = $('#tsheet'); sh.dataset.kind = kind; sh.innerHTML = '<div class="panel">' + html + '</div>'; sh.hidden = false; }
function closeSheet() { const sh = $('#tsheet'); if (!sh) return; sh.hidden = true; sh.innerHTML = ''; sh.dataset.kind = ''; }
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
function menuSheet() {
  openSheet('menu', '<div class="ph"><h2>Tùy chọn</h2><button class="btn sq" data-act="closeSheet" aria-label="Đóng">' + I.x + '</button></div><div class="pb">' +
    '<div class="who2"><b>' + esc(S.username || S.roleName) + '</b><span>' + esc(S.roleName) + ' · ' + esc(S.device) + '</span></div>' +
    '<button class="opt" data-act="v1" data-v="deviceBtn">Máy in &amp; tên thiết bị</button>' +
    '<button class="opt" data-act="fullscreen">Toàn màn hình</button>' +
    '<button class="opt" data-act="install">Cài MÂY POS lên màn hình chính</button>' +
    '<a class="opt" href="../">Mở giao diện cũ (V1)</a>' +
    '<button class="opt danger" data-act="logout">Đăng xuất' + (S.obxCount ? ' <small>(món chưa đồng bộ vẫn giữ trên máy)</small>' : '') + '</button>' +
    '<p class="ver">' + VERSION + ' · lõi ' + esc(M.core) + '</p></div>');
}
function tableMenu() {
  const p = S.perms, t = S.table, b = (id, label, show) => show ? '<button class="opt" data-act="v1" data-v="' + id + '">' + label + '</button>' : '';
  openSheet('tmenu', '<div class="ph"><h2>Bàn ' + pad(t) + ' · thao tác khác</h2><button class="btn sq" data-act="closeSheet" aria-label="Đóng">' + I.x + '</button></div><div class="pb">' +
    b('markPay', 'Chuyển CHỜ THANH TOÁN', p.order || p.pay) + b('printTemp', 'In tạm tính', true) + b('discount', 'Giảm giá', !!S.disc) +
    b('voidItem', 'Hủy món đã gửi', p.order || p.void_sent) + b('splitBill', 'Tách hóa đơn', p.move_table) + b('moveTable', 'Chuyển bàn', p.move_table) + b('mergeTable', 'Gộp bàn (chọn bàn đích là bàn này)', p.move_table) +
    (S.canPay ? '<button class="opt g" data-act="payHere">Thanh toán bàn này</button>' : '') + '</div>');
}

// ---------- vẽ tổng ----------
let lastUser = null;
function draw() {
  S = M.snap();
  const app = $('#tapp');
  if (!S.user) { app.hidden = true; document.body.classList.remove('t-on'); closeSheet(); lastUser = null; return; }
  if (lastUser !== S.user + '|' + S.username) { // vừa đăng nhập
    lastUser = S.user + '|' + S.username;
    if (UI.user !== lastUser || !UI.view || !viewsFor().concat('order').includes(UI.view)) UI.view = landing();
    UI.user = lastUser; saveUi(); app.hidden = false; document.body.classList.add('t-on'); syncV1Page();
  }
  if (UI.view === 'order' && (!S.table || !canOrder())) UI.view = viewsFor().includes('tables') ? 'tables' : landing();
  if (!viewsFor().concat('order').includes(UI.view)) UI.view = landing();
  const keepQ = document.activeElement && document.activeElement.id === 'tq', pos = keepQ ? document.activeElement.selectionStart : null;
  const SCROLL = '.pgrid,.clist,.tgrid,.kcol,.plist,.pbill,#t-main';
  const keep = [...document.querySelectorAll(SCROLL)].map(e => [e.className || e.id, e.scrollTop]);
  app.className = 'v-' + UI.view;
  $('#t-top').innerHTML = topBar();
  $('#t-net').innerHTML = netBar();
  const more = UI.view === 'more';
  $('#t-more').hidden = !more; $('#t-main').hidden = more;
  $('#t-main').innerHTML = more ? viewMore() : UI.view === 'order' ? viewOrder() : UI.view === 'kds' ? viewKds() : UI.view === 'pay' ? viewPay() : viewTables();
  $('#t-nav').innerHTML = navBar();
  [...document.querySelectorAll(SCROLL)].forEach(e => { const k = keep.find(x => x[0] === (e.className || e.id)); if (k && k[1]) e.scrollTop = k[1]; });
  if (keepQ) { const q = $('#tq'); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (e) {} } }
  const sh = $('#tsheet'); if (!sh.hidden && sh.dataset.kind === 'cart') { if (UI.view === 'order' && S.table) sh.innerHTML = '<div class="panel">' + cartPanel(S.table, true) + '</div>'; else closeSheet(); }
  saveUi();
}
let raf = 0; const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };

// ---------- thao tác (đều gọi hàm của lõi 3.1d) ----------
const A = {
  go: v => go(v),
  table: v => { const t = Number(v); selectTable(t); if (canOrder()) { UI.q = ''; go('order'); } else go('pay'); },
  cat: v => { UI.cat = v; UI.q = ''; draw(); const g = $('#pgrid'); if (g) g.scrollTop = 0; },
  clearq: () => { UI.q = ''; draw(); },
  add: v => { M.addItem(Number(v)); if (navigator.vibrate) navigator.vibrate(12); },
  minusMenu: v => { const id = Number(v), t = S.table, o = obxOf(t);
    const op = o && [...o.ops].reverse().find(x => x.item.id === id && !x.tried);
    if (op) return M.obxMinus(t, op.id);
    if (o && o.ops.some(x => x.item.id === id)) return toast('Món đang chờ máy chủ xác nhận – bớt lại sau giây lát');
    M.changeQty(id, -1); },
  pendMinus: v => M.obxMinus(S.table, v),
  linePlus: v => M.changeQty(Number(v), 1),
  lineMinus: v => M.changeQty(Number(v), -1),
  note: v => M.noteItem(Number(v)),
  send: () => { closeSheet(); M.sendOrder(); if (navigator.vibrate) navigator.vibrate([20, 40, 20]); },
  obxApply: () => M.obxApplyLatest(S.table),
  obxDrop: () => M.obxDrop(S.table),
  obxRetry: () => { const b = document.querySelector('#order [data-obx="retry"]'); if (b) b.click(); else toast('Đang đồng bộ…'); },
  openCart: () => openSheet('cart', cartPanel(S.table, true)),
  closeSheet: () => closeSheet(),
  tableMenu: () => tableMenu(),
  v1: v => { closeSheet(); const b = document.getElementById(v); if (b) b.click(); },
  payHere: () => { closeSheet(); go('pay'); },
  advance: v => M.advanceTicket(v),
  reprint: v => { const [b, st] = v.split('|'); M.reprint(b, st); },
  payTable: v => selectTable(Number(v)),
  pay: () => { M.pay(); },
  more: v => { UI.more = v; saveUi(); M.show(v); draw(); },
  menu: () => menuSheet(),
  logout: () => { closeSheet(); M.logout(); },
  fullscreen: () => { closeSheet(); const d = document.documentElement; if (document.fullscreenElement) document.exitFullscreen(); else if (d.requestFullscreen) d.requestFullscreen().catch(() => toast('Trình duyệt không cho toàn màn hình – hãy cài lên màn hình chính')); else toast('iPhone/iPad: bấm Chia sẻ → Thêm vào MH chính'); },
  install: async () => { closeSheet(); if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; } else toast('Chrome: menu ⋮ → Cài đặt ứng dụng. iPhone/iPad: Chia sẻ → Thêm vào MH chính'); }
};
document.addEventListener('click', e => { const b = e.target.closest('#tapp [data-act], #tsheet [data-act], #login [data-act]'); if (!b || b.disabled) return; const f = A[b.dataset.act]; if (f) { e.preventDefault(); f(b.dataset.v, b); } });
document.addEventListener('click', e => { if (e.target.id === 'tsheet') closeSheet(); });
document.addEventListener('input', e => { if (e.target.id === 'tq') { UI.q = e.target.value; draw(); } });

// thông báo ngắn: dùng chung ô #toast của 3.1d
function toast(msg) { const e = document.getElementById('toast'); if (!e) return; e.textContent = msg; e.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => { e.style.display = 'none'; }, 2200); }

// ---------- hộp thanh toán của 3.1d: thêm nút chọn nhanh tiền khách đưa (chỉ điền ô, 3.1d vẫn tự kiểm tra) ----------
const modalBody = document.getElementById('modalBody');
if (modalBody) new MutationObserver(() => {
  const given = document.getElementById('cashGiven'), ok = document.getElementById('confirmPay');
  document.getElementById('modal').classList.toggle('t-pay', !!(given && ok));
  if (!given || !ok || document.getElementById('tQuick') || !S || !S.table) return;
  const tot = Math.round(S.tables[S.table].total.total); if (!tot) return;
  const vals = [...new Set([tot, Math.ceil(tot / 50000) * 50000, Math.ceil(tot / 100000) * 100000, Math.ceil(tot / 500000) * 500000, 500000, 1000000].filter(v => v >= tot))].slice(0, 6);
  const box = document.createElement('div'); box.id = 'tQuick'; box.className = 'tquick';
  box.innerHTML = '<span>Khách đưa (tiền mặt):</span><div>' + vals.map(v => '<button type="button" data-g="' + v + '">' + (v === tot ? 'Đủ tiền' : v.toLocaleString('vi-VN')) + '</button>').join('') + '</div><p id="tChange"></p>';
  given.insertAdjacentElement('beforebegin', box);
  const upd = () => { const g = Number(given.value) || 0, c = document.getElementById('tChange'); if (c) c.innerHTML = g ? (g >= tot ? 'Trả lại khách: <b>' + money(g - tot) + '</b>' : '<b class="neg">Còn thiếu ' + money(tot - g) + '</b>') : ''; box.querySelectorAll('[data-g]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.g) === g))); };
  box.addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (!b) return; given.value = b.dataset.g; const pm = document.getElementById('pm'); if (pm) pm.value = 'Tiền mặt'; upd(); });
  given.addEventListener('input', upd);
}).observe(modalBody, { childList: true });

// các trang quản lý có sẵn của V1 hiển thị bên trong Touch (chuyển nguyên khối, giữ mọi nút và sự kiện)
{ const mainEl = document.querySelector('body > main'); if (mainEl) $('#t-more').appendChild(mainEl); }
window.addEventListener('maypos:render', schedule);
window.addEventListener('online', schedule);
window.addEventListener('offline', schedule);
setInterval(() => { if (S && S.user && (UI.view === 'kds' || UI.view === 'tables')) schedule(); }, 20000); // cập nhật số phút chờ
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {}));
draw();
window.__touch = { draw, UI, version: VERSION };
})();
