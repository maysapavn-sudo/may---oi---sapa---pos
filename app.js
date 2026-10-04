(()=>{'use strict';
const SUPABASE_URL = 'https://eznqzduljevrtwdlaxqk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_KiYRfW2jD10Kdlzak5a98Q_YSt8-D0h';
 
// Thiết bị: mã riêng từng máy (chỉ là tùy chọn của máy, không phải dữ liệu nghiệp vụ)
const asciiOnly=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').replace(/[^\x20-\x7E]/g,'').trim();
const DEVICE=(()=>{let d=null;try{d=JSON.parse(localStorage.getItem('MAY_POS_DEVICE')||'null')}catch(e){}if(!d||!d.id){d={id:Math.random().toString(36).slice(2,8).toUpperCase(),name:''};try{localStorage.setItem('MAY_POS_DEVICE',JSON.stringify(d))}catch(e){}}return d})();
const deviceLabel=()=>(asciiOnly(DEVICE.name)||'May')+' #'+DEVICE.id;
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { global: { headers: { 'x-pos-device': deviceLabel() } } });
async function loadMenuFromSupabase() {
  const { data, error } = await sb
    .from('menu_items')
    .select('*')
    .order('code');
 
  if (error) {
    console.error('Lỗi tải menu Supabase:', error);
    return false;
  }
 
  console.log('MENU SUPABASE:', data);
  return data;
}
      
const $=id=>document.getElementById(id), money=n=>new Intl.NumberFormat('vi-VN').format(Math.round(Number(n)||0))+' đ', now=()=>new Date().toLocaleString('vi-VN'), today=()=>dayKey(Date.now());
const ROLE_NAMES={owner:'OWNER',manager:'QUẢN LÝ',cashier:'THU NGÂN',waiter:'PHỤC VỤ',kitchen:'BẾP',bar:'BAR',stock:'KHO/KẾ TOÁN'};
const _ALL={order:1,pay:1,void_sent:1,move_table:1,bill_cancel:1,bill_view:1,reports:1,kds_kitchen:1,kds_bar:1,shift:1,cash:1,stock:1,recipes:1,menu:1,audit:1,import:1};
const _T=o=>Object.fromEntries(Object.keys(o).map(k=>[k,true]));
// Quyền mặc định theo vai trò – khớp với hàm pos_role_default_perms() trên máy chủ
const ROLE_DEFAULTS={owner:{..._T(_ALL),settings:true,staff:true},manager:_T(_ALL),cashier:_T({order:1,pay:1,move_table:1,bill_view:1,shift:1,cash:1}),waiter:_T({order:1}),kitchen:_T({kds_kitchen:1}),bar:_T({kds_bar:1}),stock:_T({stock:1,recipes:1,import:1})};
let P={};const has=k=>!!P[k];
const PAGES=[['sale',()=>has('order')||has('pay')],['kds',()=>has('kds_kitchen')||has('kds_bar')],['overview',()=>has('reports')],['bills',()=>has('bill_view')||has('reports')],['reports',()=>has('reports')],['notify',()=>has('reports')||has('shift')||has('stock')||has('kds_kitchen')||has('kds_bar')],['shift',()=>has('shift')||has('cash')],['stock',()=>has('stock')||has('import')],['recipes',()=>has('recipes')||has('import')],['menuadmin',()=>has('menu')],['dashboard',()=>has('reports')],['staff',()=>has('staff')],['risk',()=>has('audit')||has('settings')],['audit',()=>has('audit')],['backup',()=>has('settings')]];
const roles=new Proxy({},{get:(_,r)=>{if(typeof r!=='string'||!ROLE_NAMES[r])return undefined;const me=typeof S!=='undefined'&&r===S.user;return{name:ROLE_NAMES[r],pages:me?PAGES.filter(x=>x[1]()).map(x=>x[0]):[],disc:me?(+P.discount_max||0):0,pay:me&&has('pay'),approve:me&&has('void_sent'),bank:me&&has('settings')}}});
const seedMenu=[
['CF01','Americano','Americano','CÀ PHÊ',75000,'bar'],['CF02','Cappuccino','Cappuccino','CÀ PHÊ',85000,'bar'],['TE01','Trà đào Mây','May Peach Tea','TRÀ',85000,'bar'],['SG01','Mây Signature Coffee','May Signature Coffee','SIGNATURE',95000,'bar'],
['AP01','Spring Rolls','Spring Rolls','KHAI VỊ',120000,'kitchen'],['SO01','Súp cá hồi','Salmon Soup','SÚP',150000,'kitchen'],['PA01','Mì Ý bò băm','Beef Bolognese','MÌ Ý',220000,'kitchen'],['PZ01','Beef Pizza','Beef Pizza','PIZZA',280000,'kitchen'],['BG01','Beef Burger','Beef Burger','BURGER',220000,'kitchen'],['MC01','Salmon Steak','Salmon Steak','CÁ HỒI',350000,'kitchen'],['MC02','Sturgeon Hotpot','Sturgeon Hotpot','CÁ TẦM',650000,'kitchen']
].map((x,i)=>({id:i+1,code:x[0],name:x[1],en:x[2],cat:x[3],price:x[4],station:x[5],active:true}));
const seedIng=[['SALMON','Cá hồi','g',250,5000],['POTATO','Khoai tây','g',30,5000],['SAUCE','Sốt nền','g',80,3000],['VEG','Rau','g',40,3000],['COFFEE','Hạt cà phê','g',450,3000],['MILK','Sữa','ml',35,10000]].map((x,i)=>({id:i+1,code:x[0],name:x[1],unit:x[2],cost:x[3],qty:x[4],actual:x[4]}));
const defaultState=()=>({version:1,user:null,table:null,tableStatus:{},orders:{},meta:{},menu:[],ingredients:[],recipes:{},tickets:[],payments:[],bills:[],discounts:{},bank:'Chưa cấu hình',audit:[],risks:[],stockMoves:[],shift:null,closedShifts:[],billSeq:1});
// Dữ liệu nghiệp vụ chỉ lấy từ Supabase – không đọc/ghi localStorage
let S=defaultState();try{localStorage.removeItem('MAY_POS_V3')}catch(e){};let cat='TẤT CẢ',search='';
const save=()=>{};
function toast(t){const e=$('toast');e.textContent=t;e.style.display='block';setTimeout(()=>e.style.display='none',1100)}
function modal(html){$('modalBody').innerHTML=html;$('modal').classList.add('show')}
function closeModal(){$('modal').classList.remove('show')}
$('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal()});
function total(table=S.table){const a=S.orders[table]||[],sub=a.reduce((s,x)=>s+x.price*x.qty,0),d=S.discounts[table]||0;return{sub,d,total:sub*(1-d/100)}}
function nav(){const r=roles[S.user];$('nav').innerHTML='';if(!r)return;r.pages.forEach((p,i)=>{let b=document.createElement('button');b.dataset.page=p;b.textContent={sale:'Bán hàng',overview:'Tổng quan',bills:'Hóa đơn',reports:'Báo cáo',booking:'Đặt chỗ',notify:'Thông báo',kds:kdsStation()==='bar'?'Bar':kdsStation()==='kitchen'?'Bếp':'Bếp/Bar',staff:'Nhân viên',shift:'Ca & tiền',stock:'Kho',recipes:'Công thức',menuadmin:'Menu',dashboard:'Dashboard',risk:'Kiểm soát',audit:'Audit Log',backup:'Sao lưu'}[p];if(i===0)b.className='navon';b.onclick=()=>show(p,b);$('nav').appendChild(b)});let o=document.createElement('button');o.textContent='Đăng xuất';o.onclick=logout;$('nav').appendChild(o)}
function show(p,b){if(p==='staff')loadStaff();document.querySelectorAll('.page').forEach(x=>x.classList.remove('on'));$(p).classList.add('on');document.querySelectorAll('nav button').forEach(x=>x.classList.remove('navon'));if(b)b.classList.add('navon');render()}
function render(){if(!S.user)return;$('userName').innerHTML=esc(roles[S.user].name)+(S.username?' · '+esc(S.username):'')+' <span id=liveDot class=live></span>';setLiveBadge();renderSale();renderKDS();renderShift();renderStock();renderRecipes();renderMenuAdmin();renderDashboard();renderRisk();renderAudit();renderOverview();renderBills();renderReports();renderBooking();renderNotify();renderStaff();renderStoreInfo();save()}
function renderSale(){
 $('tables').innerHTML='';for(let i=1;i<=20;i++){let a=S.orders[i]||[],st=S.tableStatus[i]||'',b=document.createElement('button');b.className='table'+(S.table===i?' selected':'')+(a.length?' busy':'')+(st==='waiting'?' waiting':'');b.innerHTML='<b>Bàn '+String(i).padStart(2,'0')+'</b><br>'+(st==='waiting'?'CHỜ THANH TOÁN':a.length?'ĐANG PHỤC VỤ':'TRỐNG');b.onclick=()=>{S.table=i;S.orders[i]??=[];save();renderSale()};$('tables').appendChild(b)}
 let cats=['TẤT CẢ',...new Set(S.menu.filter(x=>x.active&&!x.hidden).map(x=>x.cat))];$('cats').innerHTML='';cats.forEach(c=>{let b=document.createElement('button');b.className='cat'+(cat===c?' on':'');b.textContent=c;b.onclick=()=>{cat=c;renderSale()};$('cats').appendChild(b)});
 let ms=S.menu.filter(x=>x.active&&!x.hidden&&(cat==='TẤT CẢ'||x.cat===cat)&&(!search||x.name.toLowerCase().includes(search)||(x.en||'').toLowerCase().includes(search)||String(x.code||'').toLowerCase().includes(search)));$('products').innerHTML='';ms.forEach(p=>{let b=document.createElement('button');b.className='product';b.innerHTML='<b>'+(p.signature?'★ ':'')+esc(p.name)+'</b><br>'+(p.marketPrice?'Thời giá':money(p.price))+(p.unit?'<small>/'+esc(p.unit)+'</small>':'');b.onclick=()=>addItem(p.id);$('products').appendChild(b)});
 const a=S.orders[S.table]||[];$('billHead').textContent=S.table?'BÀN '+String(S.table).padStart(2,'0')+' · '+a.reduce((n,x)=>n+x.qty,0)+' MÓN':'CHƯA CHỌN BÀN';$('order').innerHTML=a.length?'':'<div class=empty>Bấm món bên trái → món sẽ hiện tại đây ngay.</div>';
 a.forEach(x=>{let d=document.createElement('div');d.className='item';d.innerHTML='<div><div class=itemname>'+x.name+'</div><small>'+money(x.price)+' × '+x.qty+' = '+money(x.price*x.qty)+'</small><br><small>'+(x.note?'Ghi chú: '+x.note:'')+'</small></div><div class=qty><button data-q="'+x.id+'" data-d="-1">−</button><b>'+x.qty+'</b><button data-q="'+x.id+'" data-d="1">+</button><button data-note="'+x.id+'">✎</button></div>';$('order').appendChild(d)});
 document.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>changeQty(b.dataset.q,+b.dataset.d));document.querySelectorAll('[data-note]').forEach(b=>b.onclick=()=>noteItem(b.dataset.note));
 let t=total();$('billSummary').innerHTML=t.d?'<p>Tạm tính: '+money(t.sub)+'<br>Giảm: '+t.d+'%</p>':'';$('total').textContent=money(t.total)
}
function addItem(id){if(!S.table)return alert('Hãy chọn bàn trước.');if(!has('order'))return alert('Tài khoản này không có quyền gọi món.');let p=S.menu.find(x=>x.id===id);if(!p)return;let price=p.price;if(p.marketPrice){const v=prompt('Món theo thời giá – nhập giá bán cho '+p.name+(p.unit?' (/'+p.unit+')':''),p.price||'');if(v===null)return;price=Number(String(v).replace(/[^\d]/g,''));if(!price)return alert('Giá không hợp lệ.')}let a=S.orders[S.table]??=[];let x=a.find(q=>q.id===id&&q.price===price&&!q.note);if(x)x.qty++;else a.push({id:p.id,name:p.name,price,station:p.station,unit:p.unit||'',qty:1,sent:0,note:''});S.tableStatus[S.table]='busy';log('THÊM MÓN','Bàn '+S.table+': '+p.name);pushTable(S.table);renderSale();toast('✓ '+p.name+' đã vào hóa đơn')}
function changeQty(id,d){let a=S.orders[S.table]||[],x=a.find(q=>String(q.id)===String(id));if(!x)return;if(d<0&&x.sent>=x.qty)return alert('Món đã gửi Bếp/Bar. Muốn hủy phải dùng HỦY MÓN.');x.qty+=d;if(x.qty<=0)a.splice(a.indexOf(x),1);log('ĐỔI SỐ LƯỢNG','Bàn '+S.table+', món '+id+', '+d);pushTable(S.table);renderSale()}
function noteItem(id){let x=(S.orders[S.table]||[]).find(q=>String(q.id)===String(id));if(!x)return;let n=prompt('Ghi chú món',x.note||'');if(n!==null){x.note=n;log('GHI CHÚ MÓN','Bàn '+S.table+': '+x.name+' | '+n);pushTable(S.table);renderSale()}}
async function sendOrder(){if(!has('order'))return alert('Không có quyền gửi Bếp/Bar.');if(!S.table)return alert('Chọn bàn.');const table=S.table;
  if(!(S.orders[table]||[]).some(x=>x.qty>(x.sent||0)))return alert('Không có món mới để gửi.');
  const btn=$('send');if(btn)btn.disabled=true;
  try{if(pushing[table])await pushing[table];              // đảm bảo máy chủ đã có đơn mới nhất
    const batch=uid();const{data,error}=await sb.rpc('pos_send_order',{p_table:table,p_batch:batch});
    if(error){if(/POS_CONFLICT/.test(error.message))return reloadTable(table,true);syncFail('gửi Bếp/Bar',error);return alert('Chưa gửi được Bếp/Bar: '+error.message)}
    await reloadTable(table,false);
    if(!data||!data.count)return alert('Không có món mới để gửi (đã được gửi từ máy khác).');
    const tk=await sb.from('pos_tickets').select('*').eq('batch_id',batch);(tk.data||[]).forEach(applyTicketRow);save();render();
    toast('Đã gửi Bếp/Bar · lần #'+data.round);if(PRINT.onSend)printBatch(batch,['kitchen','bar'],false)}
  finally{if(btn)btn.disabled=false}}
function renderKDS(){let station=kdsStation();$('kdsTitle').textContent=station==='bar'?'BAR DISPLAY':station==='kitchen'?'KITCHEN DISPLAY':'BẾP / BAR';let ts=S.tickets.filter(t=>t.status!=='ĐÃ PHỤC VỤ'&&(!station||(station==='bar')===(t.station==='bar')));$('tickets').innerHTML=ts.length?'':'<div class=empty>Chưa có món.</div>';ts.forEach(t=>{let d=document.createElement('div');d.className='ticket '+(t.status==='MỚI'?'new':t.status==='HOÀN THÀNH'?'done':'');let mins=Math.floor((Date.now()-t.created)/60000);d.innerHTML='<h3>Bàn '+String(t.table).padStart(2,'0')+'</h3><b>'+t.qty+' × '+esc(t.item)+'</b><p>'+esc(t.note||'')+'</p><p><span class=badge>'+t.status+'</span> · '+mins+' phút</p><p><small>Lần #'+(t.round||1)+' · '+esc(t.by||'')+' · '+(t.station==='bar'?'Bar':'Bếp')+'</small></p><button data-ticket="'+t.id+'" class=primary>CẬP NHẬT</button>'+(t.batch?' <button data-reprint="'+t.batch+'|'+(t.station==='bar'?'bar':'kitchen')+'">'+(t.printed?'IN LẠI':'IN PHIẾU')+'</button>':'');$('tickets').appendChild(d)});document.querySelectorAll('[data-ticket]').forEach(b=>b.onclick=()=>advanceTicket(b.dataset.ticket));document.querySelectorAll('[data-reprint]').forEach(b=>b.onclick=()=>{const[bt,st]=b.dataset.reprint.split('|');printBatch(bt,[st],true)})}
function advanceTicket(id){let t=S.tickets.find(x=>String(x.id)===String(id)),flow=['MỚI','ĐANG LÀM','HOÀN THÀNH','ĐÃ PHỤC VỤ'];if(!t)return;t.status=flow[Math.min(flow.indexOf(t.status)+1,3)];const nowIso=new Date().toISOString(),patch={status:t.status,updated_at:nowIso};if(t.status==='HOÀN THÀNH'){t.done=Date.now();patch.done_at=nowIso}if(t.status==='ĐÃ PHỤC VỤ'){t.served=Date.now();patch.served_at=nowIso;if(!t.done){t.done=t.served;patch.done_at=nowIso}}log('TRẠNG THÁI MÓN','Bàn '+t.table+': '+t.item+' → '+t.status);save();renderKDS();let qy=sb.from('pos_tickets').update(patch).eq('id',t.id);TFLOW.slice(TFLOW.indexOf(t.status)).forEach(st=>{qy=qy.neq('status',st)});qy.then(({error})=>{if(error)syncFail('trạng thái món',error)})}
function doDiscount(){if(!S.table)return alert('Chọn bàn.');let max=roles[S.user].disc||0;if(!max)return alert('Không có quyền giảm giá.');let d=Number(prompt('Nhập % giảm. Tối đa '+max+'%'));if(!d)return;if(d>max){log('TỪ CHỐI GIẢM GIÁ','Yêu cầu '+d+'%',true);return alert('Vượt quyền.')}S.discounts[S.table]=d;log('GIẢM GIÁ','Bàn '+S.table+': '+d+'%',true);pushTable(S.table);renderSale()}
function markWaiting(){if(!has('order')&&!has('pay'))return alert('Không có quyền.');if(!S.table)return alert('Chọn bàn.');S.tableStatus[S.table]='waiting';log('CHỜ THANH TOÁN','Bàn '+S.table);pushTable(S.table);renderSale()}
function pay(){if(!roles[S.user].pay)return alert('Không có quyền thanh toán.');let t=total();if(!S.table||!t.total)return alert('Không có hóa đơn.');modal('<h2>Thanh toán · Bàn '+S.table+'</h2><p>Tạm tính: <b>'+money(t.sub)+'</b><br>Giảm: <b>'+t.d+'%</b></p><div class=total>'+money(t.total)+'</div><select id=pm><option>Tiền mặt</option><option>QR/Chuyển khoản</option><option>Thẻ</option><option>Kết hợp</option></select><input id=guests type=number min=0 placeholder="Số khách"><input id=cashGiven type=number placeholder="Khách đưa (tiền mặt)"><input id=splitCash type=number placeholder="Nếu kết hợp: tiền mặt"><input id=splitQR type=number placeholder="Nếu kết hợp: QR"><button id=confirmPay class="primary wide">XÁC NHẬN</button><button id=printBill class="wide">IN TẠM TÍNH</button>');$('confirmPay').onclick=confirmPay;$('printBill').onclick=printTempBill}
async function confirmPay(){let t=total(),m=$('pm').value;if(m.includes('QR')&&S.bank==='Chưa cấu hình')return alert('OWNER chưa cấu hình tài khoản nhận tiền.');let parts={};if(m==='Kết hợp'){parts.cash=+$('splitCash').value||0;parts.qr=+$('splitQR').value||0;if(Math.abs(parts.cash+parts.qr-t.total)>1)return alert('Tổng tiền kết hợp chưa bằng số phải thanh toán.')}else parts[m]=t.total;let given=+$('cashGiven').value||0;if(m==='Tiền mặt'&&given&&given<t.total)return alert('Tiền khách đưa chưa đủ.');const btn=$('confirmPay');btn.disabled=true;btn.textContent='ĐANG LƯU...';if(pushing[S.table])await pushing[S.table];const table=S.table,items=JSON.parse(JSON.stringify(S.orders[table]||[]));const cashPart=m==='Tiền mặt'?t.total:m==='Kết hợp'?(+parts.cash||0):0,cashGiven=cashPart&&given>=cashPart?given:null,change=cashGiven?Math.round(cashGiven-cashPart):null;
  const{data,error}=await sb.from('pos_bills').insert({id:uid(),table_no:table,items,subtotal:t.sub,discount:t.d,total:t.total,method:m,parts,guests:+$('guests').value||0,created_by:who(),cash_given:cashGiven,change_amount:change}).select().single();if(error){btn.disabled=false;btn.textContent='XÁC NHẬN';if(/POS_PAID|POS_CONFLICT/.test(error.message)){closeModal();await reloadTable(table,false);return alert(error.message.replace(/^.*?POS_(PAID|CONFLICT): */,''))}syncFail('hóa đơn',error);return alert('Chưa lưu được hóa đơn lên hệ thống. Kiểm tra mạng rồi bấm XÁC NHẬN lại.\n('+error.message+')')}applyBillRow(data);S.bills.sort(byTime);rebuildPayments();S.orders[table]=[];S.meta[table]={};delete S.discounts[table];delete S.tableStatus[table];reloadTable(table,false);closeModal();render();toast('✓ Thanh toán thành công'+(change?' · Trả lại '+money(change):''));paidModal(S.bills.find(x=>x.uid===data.id))}
function moveTable(){if(!has('move_table'))return alert('Không có quyền chuyển bàn.');if(!S.table)return alert('Chọn bàn nguồn.');let to=Number(prompt('Chuyển Bàn '+S.table+' sang bàn số:'));if(!to||to<1||to>20||to===S.table)return;if((S.orders[to]||[]).length)return alert('Bàn đích đang có order.');S.orders[to]=S.orders[S.table]||[];S.orders[S.table]=[];S.tableStatus[to]=S.tableStatus[S.table];delete S.tableStatus[S.table];log('CHUYỂN BÀN','Bàn '+S.table+' → '+to);pushTable(S.table);pushTable(to);S.table=to;render()}
function mergeTable(){if(!has('move_table'))return alert('Không có quyền gộp bàn.');if(!S.table)return alert('Chọn bàn đích.');let from=Number(prompt('Gộp bàn số nào vào Bàn '+S.table+'?'));if(!from||from===S.table)return;let a=S.orders[from]||[];if(!a.length)return alert('Bàn nguồn trống.');let dest=S.orders[S.table]??=[];a.forEach(x=>{let d=dest.find(y=>y.id===x.id&&y.note===x.note);d?d.qty+=x.qty:dest.push(x)});S.orders[from]=[];delete S.tableStatus[from];log('GỘP BÀN','Bàn '+from+' → '+S.table);pushTable(from);pushTable(S.table);render()}
function splitBill(){if(!has('move_table'))return alert('Không có quyền tách hóa đơn.');let a=S.orders[S.table]||[];if(!a.length)return alert('Không có món.');let i=Number(prompt(a.map((x,i)=>(i+1)+'. '+x.name+' × '+x.qty).join('\n')+'\nChọn món muốn tách:'))-1;if(i<0||i>=a.length)return;let to=Number(prompt('Tách sang bàn số:'));if(!to||to<1||to>20)return;S.orders[to]??=[];S.orders[to].push(a.splice(i,1)[0]);log('TÁCH HÓA ĐƠN','Bàn '+S.table+' → Bàn '+to);pushTable(S.table);pushTable(to);render()}
function stats(arr){return arr.map(x=>'<div class=stat>'+x[0]+'<b>'+x[1]+'</b></div>').join('')}
function renderDashboard(){let bills=S.bills.filter(b=>!b.cancelled),day=bills.filter(b=>dayKey(b.time)===today()),rev=day.reduce((s,b)=>s+b.total,0),month=today().slice(0,7),mrev=bills.filter(b=>dayKey(b.time).slice(0,7)===month).reduce((s,b)=>s+b.total,0),avg=day.length?rev/day.length:0,disc=day.reduce((s,b)=>s+(b.subtotal-b.total),0);let cash=0,qr=0,card=0;S.payments.filter(p=>dayKey(p.time)===today()).forEach(p=>{if(p.method==='Tiền mặt')cash+=p.amount;else if(p.method==='QR/Chuyển khoản')qr+=p.amount;else if(p.method==='Thẻ')card+=p.amount;else{cash+=p.parts.cash||0;qr+=p.parts.qr||0}});$('dashStats').innerHTML=stats([['Doanh thu hôm nay',money(rev)],['Doanh thu tháng',money(mrev)],['Số bill',day.length],['Bill TB',money(avg)],['Tiền mặt',money(cash)],['QR',money(qr)],['Thẻ',money(card)],['Giảm giá',money(disc)],['Hủy món',S.risks.filter(x=>x.action==='HỦY MÓN').length]]);let counts={};bills.forEach(b=>b.items.forEach(i=>counts[i.name]=(counts[i.name]||0)+i.qty));$('topItems').innerHTML='<h3>Top món</h3>'+Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(x=>'<div class=log>'+x[0]+' <b>'+x[1]+'</b></div>').join('')}
function exportData(){let blob=new Blob([JSON.stringify(S,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='MAY_POS_BACKUP_'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function restoreData(){let f=$('importData').files[0];if(!f)return alert('Chọn file JSON.');let r=new FileReader();r.onload=()=>{try{let x=JSON.parse(r.result);if(!x.menu||!x.orders)throw Error();S=x;save();alert('Khôi phục thành công.');location.reload()}catch(e){alert('File không hợp lệ.')}};r.readAsText(f)}
function resetDemo(){if(confirm('Xóa toàn bộ dữ liệu demo?')){S=defaultState();save();location.reload()}}
 
// =====================================================================
// ĐỒNG BỘ SUPABASE – đơn bàn, vé Bếp/Bar, hóa đơn dùng chung mọi máy
// =====================================================================
const uid=()=>(window.crypto&&crypto.randomUUID)?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)});
const CLIENT=uid(), tableRev={}, HISTORY_DAYS=62;
let liveChannel=null, liveOK=false, pollTimer=null, lastReport=null;
const pad=n=>String(n??'').padStart(2,'0');
const msOf=v=>v?new Date(v).getTime():null;
const byTime=(a,b)=>a.time-b.time;
function dayKey(ts){const d=new Date(ts);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function fmtDay(k){const[y,m,d]=k.split('-');const w=['CN','T2','T3','T4','T5','T6','T7'][new Date(+y,+m-1,+d).getDay()];return d+'/'+m+'/'+y+' ('+w+')'}
function fmtTime(ts){return new Date(ts).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function who(){return S.username||(roles[S.user]&&roles[S.user].name)||S.user||''}
function syncFail(what,error){console.error('Lỗi đồng bộ '+what+':',error);toast('⚠️ Chưa lưu được '+what+' lên hệ thống')}

function mapMenu(x){return{id:x.id,code:x.code||'',name:x.name||'',en:x.name_en||'',cat:x.category||'KHÁC',price:Number(x.price)||0,station:x.station||'kitchen',active:x.active!==false,unit:x.unit||'Phần',cost:Number(x.cost)||0,signature:!!x.is_signature,marketPrice:!!x.is_market_price,desc:x.description||'',hidden:!!x.hidden,course:x.course||''}}
async function loadMenuMapped(){const d=await loadMenuFromSupabase();if(d)S.menu=d.map(mapMenu);return !!d}

async function fetchAll(make){let all=[],from=0;for(;;){const{data,error}=await make().range(from,from+999);if(error)return{error};all=all.concat(data||[]);if(!data||data.length<1000)return{data:all};from+=1000}}

// Gửi trạng thái bàn lên server theo thứ tự: mỗi bàn chỉ 1 lệnh đang chạy, lệnh sau luôn mang trạng thái mới nhất
const pushing={},pushDirty={};
function pushTable(t){t=Number(t);if(!t)return Promise.resolve();if(pushing[t]){pushDirty[t]=true;return pushing[t]}
  pushing[t]=(async()=>{try{do{pushDirty[t]=false;await pushTableNow(t)}while(pushDirty[t])}finally{delete pushing[t]}})();return pushing[t]}
// serverRev: phiên bản bàn mới nhất máy này đã nhận từ máy chủ (máy chủ từ chối nếu máy khác đã sửa sau đó)
const serverRev={};
async function pushTableNow(t){const rev=Math.max(Date.now(),(tableRev[t]||0)+1,(serverRev[t]||0)+1);tableRev[t]=rev;
  const{data,error}=await sb.from('pos_table_orders').upsert({table_no:t,items:S.orders[t]||[],status:S.tableStatus[t]||'',discount:S.discounts[t]||0,meta:S.meta[t]||{},rev,base_rev:serverRev[t]??null,client_id:CLIENT,updated_by:who(),updated_at:new Date().toISOString()}).select('rev');
  if(error){if(/POS_CONFLICT/.test(error.message))return reloadTable(t,true);syncFail('bàn '+t,error);if(/giá|quyền|gửi/i.test(error.message)){alert(error.message);return reloadTable(t,false)}return}
  const r=data&&data[0];if(r){serverRev[t]=Math.max(serverRev[t]||0,Number(r.rev));tableRev[t]=Math.max(tableRev[t]||0,Number(r.rev))}}
// Tải lại một bàn từ máy chủ (khi bị máy khác cập nhật trước, hoặc sau khi thanh toán / gửi bếp)
async function reloadTable(t,conflict){t=Number(t);const{data,error}=await sb.from('pos_table_orders').select('*').eq('table_no',t);
  if(error)return syncFail('bàn '+t,error);const r=data&&data[0];
  if(r)applyTableRow(r,true);else{S.orders[t]=[];S.meta[t]={};delete S.discounts[t];delete S.tableStatus[t]}
  save();render();if(conflict)alert('Bàn '+t+' vừa được cập nhật ở máy khác. Đã tải lại dữ liệu mới nhất – vui lòng kiểm tra và thao tác lại.')}
function applyTableRow(r,force){const t=Number(r.table_no);if(!t)return false;
  if(!force&&r.client_id===CLIENT&&Number(r.rev)<(tableRev[t]||0))return false; // bản cũ của chính máy này → bỏ qua
  serverRev[t]=Math.max(force?0:(serverRev[t]||0),Number(r.rev)||0);
  S.orders[t]=Array.isArray(r.items)?r.items:[];S.meta[t]=r.meta||{};
  if(r.status)S.tableStatus[t]=r.status;else delete S.tableStatus[t];
  if(Number(r.discount))S.discounts[t]=Number(r.discount);else delete S.discounts[t];
  return true}
const TFLOW=['MỚI','ĐANG LÀM','HOÀN THÀNH','ĐÃ PHỤC VỤ'];
function applyTicketRow(r){const old=S.tickets.find(x=>String(x.id)===String(r.id));if(old&&TFLOW.indexOf(r.status)<TFLOW.indexOf(old.status))return; // tín hiệu cũ đến muộn → không lùi trạng thái
  const t={id:r.id,table:Number(r.table_no),itemId:r.item_id,item:r.item,qty:r.qty,note:r.note||'',station:r.station,status:r.status,created:msOf(r.created_at),done:msOf(r.done_at),served:msOf(r.served_at),by:r.created_by,batch:r.batch_id,round:r.round,printed:+r.print_count||0};
  const i=S.tickets.findIndex(x=>String(x.id)===String(r.id));if(i>=0)S.tickets[i]=t;else S.tickets.push(t)}
function applyBillRow(r){const b={id:r.bill_no||'…',uid:r.id,table:r.table_no,items:r.items||[],subtotal:+r.subtotal||0,discount:+r.discount||0,total:+r.total||0,method:r.method,parts:r.parts||{},guests:+r.guests||0,time:msOf(r.created_at),user:r.created_by,cashGiven:r.cash_given==null?null:+r.cash_given,change:r.change_amount==null?null:+r.change_amount,printCount:+r.print_count||0,device:r.device||'',cancelled:!!r.cancelled,cancelReason:r.cancel_reason,cancelledBy:r.cancelled_by,cancelledAt:msOf(r.cancelled_at)};
  const i=S.bills.findIndex(x=>x.uid===r.id);if(i>=0)S.bills[i]=b;else S.bills.push(b)}
function rebuildPayments(){const d=today();S.payments=S.bills.filter(b=>!b.cancelled&&dayKey(b.time)===d).map(b=>({bill:b.id,amount:b.total,method:b.method,parts:b.parts,time:b.time}))}

async function loadLive(){
  const since=new Date();since.setHours(0,0,0,0);since.setDate(since.getDate()-HISTORY_DAYS);const iso=since.toISOString();
  const[o,t,b]=await Promise.all([
    fetchAll(()=>sb.from('pos_table_orders').select('*').order('table_no')),
    fetchAll(()=>sb.from('pos_tickets').select('*').gte('created_at',iso).order('created_at')),
    fetchAll(()=>sb.from('pos_bills').select('*').gte('created_at',iso).order('created_at'))
  ]);
  const err=o.error||t.error||b.error;
  if(err){syncFail('dữ liệu',err);if(String(err.message||'').includes('pos_'))toast('⚠️ Chưa chạy file SQL cập nhật trong Supabase');return false}
  S.orders={};S.tableStatus={};S.discounts={};S.meta={};o.data.forEach(r=>applyTableRow(r));
  S.tickets=[];t.data.forEach(applyTicketRow);
  S.bills=[];b.data.forEach(applyBillRow);S.bills.sort(byTime);rebuildPayments();
  await loadExtras();
  save();return true}

function beep(){try{const c=new (window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator(),g=c.createGain();o.frequency.value=880;g.gain.value=.15;o.connect(g);g.connect(c.destination);o.start();setTimeout(()=>{o.stop();c.close()},250)}catch(e){}}
function setLiveBadge(){const e=$('liveDot');if(e){e.textContent=liveOK?'● Trực tuyến':'○ Đang kết nối';e.className=liveOK?'live on':'live'}}
function startLive(){stopLive();
  liveChannel=sb.channel('pos-live-'+CLIENT.slice(0,8))
   .on('postgres_changes',{event:'*',schema:'public',table:'pos_table_orders'},p=>{if(p.new&&applyTableRow(p.new)){save();renderSale();renderOverview()}})
   .on('postgres_changes',{event:'*',schema:'public',table:'pos_tickets'},p=>{if(!p.new||!p.new.id)return;const isNew=!S.tickets.some(x=>String(x.id)===String(p.new.id));applyTicketRow(p.new);save();renderKDS();if(isNew){if($('kds').classList.contains('on'))beep();queueKdsPrint(S.tickets.find(x=>String(x.id)===String(p.new.id))||{})}})
   .on('postgres_changes',{event:'*',schema:'public',table:'pos_bills'},p=>{if(!p.new||!p.new.id)return;applyBillRow(p.new);S.bills.sort(byTime);rebuildPayments();save();renderShift();renderDashboard();renderOverview();renderBills();renderReports()})
   .on('postgres_changes',{event:'*',schema:'public',table:'pos_ingredients'},()=>scheduleReload(['ings']))
   .on('postgres_changes',{event:'*',schema:'public',table:'pos_stock'},()=>scheduleReload(['stock']))
   .on('postgres_changes',{event:'*',schema:'public',table:'pos_stock_moves'},()=>scheduleReload(['moves']))
   .on('postgres_changes',{event:'*',schema:'public',table:'pos_recipes'},()=>scheduleReload(['rec']))
   .on('postgres_changes',{event:'*',schema:'public',table:'pos_shifts'},()=>scheduleReload(['shifts']))
   .on('postgres_changes',{event:'*',schema:'public',table:'pos_cash_moves'},()=>scheduleReload(['cash']))
   .on('postgres_changes',{event:'*',schema:'public',table:'pos_audit'},()=>scheduleReload(['audit']))
   .on('postgres_changes',{event:'*',schema:'public',table:'pos_settings'},()=>scheduleReload(['settings']))
   .on('postgres_changes',{event:'*',schema:'public',table:'pos_reservations'},()=>scheduleReload(['resv']))
   .on('postgres_changes',{event:'*',schema:'public',table:'menu_items'},async()=>{if(await loadMenuMapped()){save();renderSale();renderMenuAdmin();renderRecipes()}})
   .subscribe(s=>{liveOK=s==='SUBSCRIBED';console.log('Realtime:',s);setLiveBadge()});
  // Dự phòng: nếu mất kết nối tức thời thì 15 giây tải lại 1 lần
  pollTimer=setInterval(async()=>{if(liveOK||!S.user)return;if(await loadLive())render()},15000)}
function stopLive(){if(liveChannel){sb.removeChannel(liveChannel);liveChannel=null}liveOK=false;if(pollTimer){clearInterval(pollTimer);pollTimer=null}}
document.addEventListener('visibilitychange',async()=>{if(document.visibilityState==='visible'&&S.user){if(await loadLive())render()}});
setInterval(()=>{if(S.user&&$('overview')&&$('overview').classList.contains('on'))renderOverview()},60000);

// =====================================================================
// TỔNG QUAN (kiểu CukCuk)
// =====================================================================
function validBills(){return S.bills.filter(b=>!b.cancelled)}
function sumBills(a){return a.reduce((s,b)=>s+b.total,0)}
function dayStart(off){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+off);return d.getTime()}
function billsBetween(a,b){return validBills().filter(x=>x.time>=a&&x.time<b)}
function pct(cur,prev){if(!prev)return cur?null:0;return(cur-prev)/prev*100}
function pctHtml(v){if(v===null)return'<b class=up>mới ↑</b>';return'<b class='+(v>=0?'up':'down')+'>'+(v>0?'+':'')+v.toFixed(0)+'% '+(v>=0?'↑':'↓')+'</b>'}
function bars(rows,fmt=money){const max=Math.max(1,...rows.map(r=>r[1]));return rows.map(r=>'<div class=barrow><span class=barlab>'+esc(r[0])+'</span><span class=bartrack><i style="width:'+(r[1]/max*100).toFixed(1)+'%"></i></span><b>'+fmt(r[1])+'</b></div>').join('')}
function renderOverview(){if(!$('ovMain'))return;
  const now=Date.now(),t0=dayStart(0),el=now-t0;
  const tb=billsBetween(t0,now+1),yb=billsBetween(dayStart(-1),dayStart(-1)+el),wb=billsBetween(dayStart(-7),dayStart(-7)+el);
  const rev=sumBills(tb),yRev=sumBills(yb),wRev=sumBills(wb),pY=pct(rev,yRev),pW=pct(rev,wRev);
  const guests=tb.reduce((s,b)=>s+(b.guests||0),0),avg=tb.length?rev/tb.length:0;
  const open=Object.keys(S.orders).filter(k=>(S.orders[k]||[]).length),openVal=open.reduce((s,k)=>s+total(+k).total,0);
  const cancelled=S.bills.filter(b=>b.cancelled&&b.time>=t0);
  const counts={};tb.forEach(b=>b.items.forEach(i=>counts[i.name]=(counts[i.name]||0)+i.qty));const top=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const hours={};tb.forEach(b=>{const h=new Date(b.time).getHours();hours[h]=(hours[h]||0)+b.total});const peak=Object.entries(hours).sort((a,b)=>b[1]-a[1])[0];
  const disc=tb.reduce((s,b)=>s+(b.subtotal-b.total),0);
  const late=S.tickets.filter(t=>(t.status==='MỚI'||t.status==='ĐANG LÀM')&&now-t.created>15*60000).length;
  $('ovUpdated').textContent='Hôm nay · Cập nhật lúc '+fmtTime(now);
  $('ovMain').innerHTML='<div class=ovlabel>DOANH THU HÔM NAY</div><div class=ovbig>'+money(rev)+'</div><div class=ovrow><span>So với hôm qua (cùng giờ)</span>'+pctHtml(pY)+'</div><div class=ovrow><span>So với ngày này tuần trước</span>'+pctHtml(pW)+'</div>';
  $('ovStats').innerHTML=stats([['Hóa đơn',tb.length],['Bill trung bình',money(avg)],['Số khách',guests||'—'],['Bàn đang phục vụ',open.length],['Chưa thanh toán',money(openVal)],['Giảm giá',money(disc)],['Hóa đơn hủy',cancelled.length]]);
  const L=[];
  if(!tb.length&&!open.length)L.push('Hôm nay chưa có hóa đơn nào được thanh toán.');
  else{
    if(pY===null)L.push('Doanh thu hôm nay đạt <b>'+money(rev)+'</b>, trong khi hôm qua cùng giờ chưa có doanh thu.');
    else L.push('Doanh thu hôm nay '+(pY>=0?'<b class=up>tăng '+pY.toFixed(1)+'%</b>':'<b class=down>giảm '+Math.abs(pY).toFixed(1)+'%</b>')+' so với hôm qua cùng giờ ('+money(yRev)+').'+(Math.abs(pY)>=40?' Đây là mức <b class='+(pY>=0?'up':'down')+'>biến động mạnh</b>'+(pY<0?', nên kiểm tra nguyên nhân (lượng khách, thời tiết, nhân sự, món hết).':'.'):''));
    if(pW!==null&&wRev)L.push('So với cùng ngày tuần trước: '+(pW>=0?'tăng ':'giảm ')+Math.abs(pW).toFixed(1)+'%.');
    if(top.length)L.push('Món bán chạy nhất: <b>'+esc(top[0][0])+'</b> ('+top[0][1]+' phần)'+(top[1]?', tiếp theo là '+esc(top[1][0])+' ('+top[1][1]+')':'')+'.');
    if(peak)L.push('Khung giờ doanh thu cao nhất: <b>'+peak[0]+'h–'+(+peak[0]+1)+'h</b> ('+money(peak[1])+').');
    if(open.length)L.push(open.length+' bàn đang phục vụ, tạm tính <b>'+money(openVal)+'</b> chưa thanh toán.');
    if(rev&&disc/(rev+disc)>0.1)L.push('<b class=down>Giảm giá chiếm '+(disc/(rev+disc)*100).toFixed(1)+'% tiền hàng</b>, cao hơn mức thông thường, nên kiểm tra.');
    if(cancelled.length)L.push('<b class=down>Có '+cancelled.length+' hóa đơn bị hủy hôm nay</b>, xem ở mục Hóa đơn.');
  }
  if(late)L.push('<b class=down>'+late+' món chờ Bếp/Bar quá 15 phút.</b>');
  {const rv=(S.resv||[]).filter(r=>r.status!=='HỦY'&&r.at>=t0&&r.at<dayStart(1));if(rv.length)L.push('Hôm nay có <b>'+rv.length+' lượt đặt chỗ</b> ('+rv.reduce((s,r)=>s+r.guests,0)+' khách), '+rv.filter(r=>r.status==='ĐÃ ĐẾN').length+' đã đến.');const ls=lowStock();if(ls.length)L.push('<b class=down>'+ls.length+' nguyên liệu dưới mức tối thiểu</b>: '+ls.slice(0,4).map(i=>esc(i.name)).join(', ')+(ls.length>4?'…':'')+'.')}
  $('ovAnalysis').innerHTML='<div class=aititle>✦ Mây phân tích</div><p>'+L.join('</p><p>')+'</p>';
  $('ovTop').innerHTML=top.slice(0,5).map((x,i)=>'<div class=log>'+(i+1)+'. '+esc(x[0])+'<b style=float:right>'+x[1]+'</b></div>').join('')||'<div class=empty>Chưa có món bán ra hôm nay.</div>';
  const days=[];for(let i=6;i>=0;i--){const a=dayStart(-i);days.push([fmtDay(dayKey(a)).slice(0,5)+' '+fmtDay(dayKey(a)).slice(-4),sumBills(billsBetween(a,dayStart(-i+1)))])}
  $('ovWeek').innerHTML=bars(days)}

// =====================================================================
// HÓA ĐƠN
// =====================================================================
function rangeBounds(r){const t0=dayStart(0);
  if(r==='yesterday')return[dayStart(-1),t0];
  if(r==='7d')return[dayStart(-6),dayStart(1)];
  if(r==='30d')return[dayStart(-29),dayStart(1)];
  if(r==='month'){const d=new Date();d.setDate(1);d.setHours(0,0,0,0);return[d.getTime(),dayStart(1)]}
  if(r==='lastmonth'){const a=new Date();a.setDate(1);a.setHours(0,0,0,0);const e=a.getTime();a.setMonth(a.getMonth()-1);return[a.getTime(),e]}
  return[t0,dayStart(1)]}
function renderBills(){if(!$('billList'))return;
  const[a,b]=rangeBounds($('billRange').value),q=($('billSearch').value||'').trim().toLowerCase();
  let list=S.bills.filter(x=>x.time>=a&&x.time<b);
  if(q)list=list.filter(x=>String(x.id).includes(q)||String(x.table)===q.replace(/^bàn\s*/,'')||(x.user||'').toLowerCase().includes(q)||(x.method||'').toLowerCase().includes(q));
  list=list.slice().sort((x,y)=>y.time-x.time);const valid=list.filter(x=>!x.cancelled);
  $('billSummaryBar').innerHTML=stats([['Số hóa đơn',valid.length],['Doanh thu',money(sumBills(valid))],['Đã hủy',list.length-valid.length]]);
  if(!list.length){$('billList').innerHTML='<div class=empty>Không có hóa đơn trong khoảng này.</div>';return}
  const g={};list.forEach(x=>(g[dayKey(x.time)]??=[]).push(x));
  $('billList').innerHTML=Object.entries(g).map(([d,arr])=>'<div class=dayhead><span>'+fmtDay(d)+'</span><b>'+money(sumBills(arr.filter(x=>!x.cancelled)))+'</b></div>'+arr.map(x=>'<button class=billrow data-bill="'+x.uid+'"><span><b>#'+x.id+'</b><small>'+fmtTime(x.time)+' · Bàn '+pad(x.table)+(x.user?' · '+esc(x.user):'')+'</small></span><span class=billamt>'+(x.cancelled?'<em class=void>Đã hủy</em> ':'')+money(x.total)+'<small>'+esc(x.method||'')+'</small></span></button>').join('')).join('');
  document.querySelectorAll('[data-bill]').forEach(el=>el.onclick=()=>showBill(el.dataset.bill))}
function showBill(u){const b=S.bills.find(x=>x.uid===u);if(!b)return;const can=!b.cancelled&&has('bill_cancel');
  modal('<div class=printarea><h2>Hóa đơn #'+b.id+'</h2><p>Mây ơi Sapa<br>'+new Date(b.time).toLocaleString('vi-VN')+' · Bàn '+pad(b.table)+'<br>Thu ngân: '+esc(b.user||'')+(b.guests?' · '+b.guests+' khách':'')+'</p>'+(b.cancelled?'<div class="notice voidnote">ĐÃ HỦY · '+esc(b.cancelReason||'')+' · '+esc(b.cancelledBy||'')+(b.cancelledAt?' · '+new Date(b.cancelledAt).toLocaleString('vi-VN'):'')+'</div>':'')+'<table><tr><th>Món</th><th>SL</th><th>Thành tiền</th></tr>'+b.items.map(i=>'<tr><td>'+esc(i.name)+(i.note?'<br><small>'+esc(i.note)+'</small>':'')+'</td><td>'+i.qty+'</td><td>'+money(i.price*i.qty)+'</td></tr>').join('')+'</table><p>Tạm tính: '+money(b.subtotal)+(b.discount?'<br>Giảm: '+b.discount+'%':'')+'</p><div class=total>'+money(b.total)+'</div><p>Thanh toán: '+esc(b.method||'')+(b.cashGiven?' · khách đưa '+money(b.cashGiven)+' · trả lại '+money(b.change||0):'')+'<br><small class=muted>Đã in '+(b.printCount||0)+' lần'+(b.device?' · thiết bị '+esc(b.device):'')+'</small></p></div><button id=printOld class="primary wide">'+(b.printCount?'IN LẠI HÓA ĐƠN':'IN HÓA ĐƠN')+'</button>'+(can?'<button id=cancelBill class="danger wide" style="margin-top:7px">HỦY HÓA ĐƠN</button>':'')+'<button id=closeM class=wide style="margin-top:7px">ĐÓNG</button>');
  $('printOld').onclick=async()=>{await printBill(b);closeModal()};
  $('closeM').onclick=closeModal;if(can)$('cancelBill').onclick=()=>cancelBill(b)}
async function cancelBill(b){const why=prompt('Lý do hủy hóa đơn #'+b.id+' (bắt buộc):');if(!why)return;if(!confirm('Hủy hóa đơn #'+b.id+' – '+money(b.total)+'?'))return;
  const{data,error}=await sb.from('pos_bills').update({cancelled:true,cancel_reason:why,cancelled_by:who(),cancelled_at:new Date().toISOString()}).eq('id',b.uid).select().single();
  if(error){syncFail('hủy hóa đơn',error);return alert('Không hủy được: '+error.message)}
  applyBillRow(data);rebuildPayments();closeModal();render();toast('Đã hủy hóa đơn #'+b.id)}

// =====================================================================
// BÁO CÁO
// =====================================================================
function htmlTable(h,r){return'<div class=tablewrap><table><tr>'+h.map(x=>'<th>'+x+'</th>').join('')+'</tr>'+r.map(row=>'<tr>'+row.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</table></div>'}
function renderReports(){if(!$('reportOut'))return;
  const type=$('reportType').value,[a,b]=rangeBounds($('reportRange').value),list=billsBetween(a,b);let head=[],rows=[],chart='',note='';
  if(type==='revenue'){const g={};list.forEach(x=>{const d=dayKey(x.time);g[d]??={n:0,rev:0,sub:0,gu:0};g[d].n++;g[d].rev+=x.total;g[d].sub+=x.subtotal;g[d].gu+=x.guests||0});const ks=Object.keys(g).sort();
    head=['Ngày','Số HĐ','Khách','Tiền hàng','Giảm giá','Doanh thu'];rows=ks.map(k=>[fmtDay(k),g[k].n,g[k].gu,money(g[k].sub),money(g[k].sub-g[k].rev),money(g[k].rev)]);
    if(ks.length)rows.push(['<b>Tổng</b>','<b>'+list.length+'</b>','<b>'+list.reduce((s,x)=>s+(x.guests||0),0)+'</b>','<b>'+money(list.reduce((s,x)=>s+x.subtotal,0))+'</b>','<b>'+money(list.reduce((s,x)=>s+x.subtotal-x.total,0))+'</b>','<b>'+money(sumBills(list))+'</b>']);
    chart=bars(ks.map(k=>[k.slice(8)+'/'+k.slice(5,7),g[k].rev]))}
  else if(type==='items'){const g={};list.forEach(x=>x.items.forEach(i=>{g[i.name]??={q:0,rev:0};g[i.name].q+=i.qty;g[i.name].rev+=i.qty*i.price*(1-(x.discount||0)/100)}));const e=Object.entries(g).sort((p,q)=>q[1].q-p[1].q);
    head=['#','Món','Số lượng','Doanh thu'];rows=e.map((x,i)=>[i+1,esc(x[0]),x[1].q,money(x[1].rev)]);chart=bars(e.slice(0,10).map(x=>[x[0],x[1].q]),n=>n)}
  else if(type==='staff'){const g={};list.forEach(x=>{const k=x.user||'Không rõ';g[k]??={n:0,rev:0};g[k].n++;g[k].rev+=x.total});const e=Object.entries(g).sort((p,q)=>q[1].rev-p[1].rev);
    head=['Nhân viên','Số HĐ','Doanh thu','Bill TB'];rows=e.map(x=>[esc(x[0]),x[1].n,money(x[1].rev),money(x[1].rev/x[1].n)]);chart=bars(e.map(x=>[x[0],x[1].rev]))}
  else if(type==='method'){const g={'Tiền mặt':0,'QR/Chuyển khoản':0,'Thẻ':0};list.forEach(x=>{if(x.method==='Kết hợp'){g['Tiền mặt']+=+x.parts.cash||0;g['QR/Chuyển khoản']+=+x.parts.qr||0}else g[x.method]=(g[x.method]||0)+x.total});const e=Object.entries(g);const tot=e.reduce((s,x)=>s+x[1],0);
    head=['Phương thức','Số tiền','Tỷ lệ'];rows=!list.length?[]:e.map(x=>[x[0],money(x[1]),tot?(x[1]/tot*100).toFixed(1)+'%':'0%']);chart=bars(e)}
  else if(type==='guests'){const g={};list.forEach(x=>{const d=dayKey(x.time);g[d]??={gu:0,rev:0,n:0};g[d].gu+=x.guests||0;g[d].rev+=x.total;g[d].n++});const ks=Object.keys(g).sort();
    head=['Ngày','Số HĐ','Số khách','Doanh thu','TB / khách'];rows=ks.map(k=>[fmtDay(k),g[k].n,g[k].gu,money(g[k].rev),g[k].gu?money(g[k].rev/g[k].gu):'—']);chart=bars(ks.map(k=>[k.slice(8)+'/'+k.slice(5,7),g[k].gu]),n=>n);note='Số khách lấy từ ô "Số khách" khi thanh toán.'}
  else if(type==='hours'){const g={};list.forEach(x=>{const h=new Date(x.time).getHours();g[h]??={n:0,rev:0};g[h].n++;g[h].rev+=x.total});const ks=Object.keys(g).map(Number).sort((p,q)=>p-q);
    head=['Khung giờ','Số HĐ','Doanh thu'];rows=ks.map(h=>[h+'h–'+(h+1)+'h',g[h].n,money(g[h].rev)]);chart=bars(ks.map(h=>[h+'h',g[h].rev]))}
  else if(type==='kitchen'){const ts=S.tickets.filter(t=>t.created>=a&&t.created<b&&t.done);const g={};ts.forEach(t=>{const m=(t.done-t.created)/60000;g[t.item]??={n:0,sum:0,max:0,st:t.station};g[t.item].n+=t.qty;g[t.item].sum+=m*t.qty;g[t.item].max=Math.max(g[t.item].max,m)});const e=Object.entries(g).sort((p,q)=>q[1].sum/q[1].n-p[1].sum/p[1].n);
    head=['Món','Trạm','SL đã làm','TB (phút)','Lâu nhất (phút)'];rows=e.map(x=>[esc(x[0]),x[1].st==='bar'?'Bar':'Bếp',x[1].n,(x[1].sum/x[1].n).toFixed(1),x[1].max.toFixed(1)]);chart=bars(e.slice(0,10).map(x=>[x[0],+(x[1].sum/x[1].n).toFixed(1)]),n=>n+' ph');note='Tính từ lúc gửi bếp đến lúc bấm HOÀN THÀNH.'}
  else if(type==='cancel'){const cb=S.bills.filter(x=>x.cancelled&&x.time>=a&&x.time<b);const vi=(S.audit||[]).filter(x=>x.action==='HỦY MÓN'&&x.at>=a&&x.at<b);
    head=['Loại','Thời gian','Nội dung','Người thực hiện'];rows=cb.map(x=>['Hủy hóa đơn',new Date(x.time).toLocaleString('vi-VN'),'#'+x.id+' · Bàn '+pad(x.table)+' · '+money(x.total)+' · '+esc(x.cancelReason||''),esc(x.cancelledBy||'')]).concat(vi.map(x=>['Hủy món',esc(x.time),esc(x.detail),esc(x.user)]));note='Hủy món lấy từ nhật ký hệ thống.'}
  else if(type==='stock'){head=['Mã','Nguyên liệu','ĐVT','Kho tổng','Bếp','Bar','Tổng tồn','Giá nhập','Giá trị tồn'];rows=S.ings.map(i=>{const st=stockOf(i.id),t=totalStock(i.id);return[esc(i.code),esc(i.name),esc(i.unit),fmtQ(st.KHO),fmtQ(st.BEP),fmtQ(st.BAR),fmtQ(t),money(i.cost),money(t*i.cost)]});if(rows.length)rows.push(['','<b>Tổng</b>','','','','','','','<b>'+money(S.ings.reduce((s,i)=>s+totalStock(i.id)*i.cost,0))+'</b>'])}
  else if(type==='stockmove'){const ms=S.moves.filter(m=>m.time>=a&&m.time<b);const g={};ms.forEach(m=>{const k=m.ing;g[k]??={in:0,out:0,sale:0,waste:0,adj:0};const t=m.type;if(t==='NHẬP')g[k].in+=m.qty;else if(t==='BÁN HÀNG'||t==='HOÀN HĐ HỦY')g[k].sale+=-m.qty;else if(t==='HỦY'||t==='HAO HỤT')g[k].waste+=-m.qty;else if(t==='KIỂM KÊ'||t==='ĐIỀU CHỈNH')g[k].adj+=m.qty;else if(t==='XUẤT')g[k].out+=-m.qty});head=['Nguyên liệu','Nhập','Xuất','Bán (theo CT)','Hủy / hao hụt','Kiểm kê / điều chỉnh','Giá trị hao hụt'];rows=Object.entries(g).map(([k,v])=>{const i=ingById(k)||{name:'#'+k,unit:'',cost:0};return[esc(i.name)+' ('+esc(i.unit)+')',fmtQ(v.in),fmtQ(v.out),fmtQ(v.sale),fmtQ(v.waste),'<b class='+(v.adj<0?'down':'')+'>'+fmtQ(v.adj)+'</b>',money((v.waste-Math.min(v.adj,0))*i.cost)]});note='Tổng hợp nhập – xuất – bán – hao hụt theo phiếu kho trên hệ thống.'}
  else if(type==='cashflow'){const cm=S.cash.filter(c=>c.time>=a&&c.time<b);const sales=sumBills(list);const thu=cm.filter(c=>c.type==='THU').reduce((s,c)=>s+c.amount,0),chi=cm.filter(c=>c.type==='CHI').reduce((s,c)=>s+c.amount,0);const g={};cm.forEach(c=>{const k=c.type+' · '+(c.cat||'Khác');g[k]=(g[k]||0)+c.amount});head=['Khoản','Số tiền'];rows=[['<b>Doanh thu bán hàng</b>',money(sales)],['<b>Thu khác</b>',money(thu)],['<b>Tổng chi</b>',money(chi)],['<b>Chênh lệch thu – chi</b>','<b class='+(sales+thu-chi<0?'down':'up')+'>'+money(sales+thu-chi)+'</b>']].concat(Object.entries(g).sort().map(([k,v])=>[esc(k),money(v)]));chart=bars([['Doanh thu',sales],['Thu khác',thu],['Chi',chi]]);note='Tình hình thu chi: doanh thu hóa đơn + phiếu thu, trừ phiếu chi.'}
  $('reportOut').innerHTML=(note?'<p class=muted>'+note+'</p>':'')+(chart&&rows.length?'<div class=chartbox>'+chart+'</div>':'')+(rows.length?htmlTable(head,rows):'<div class=empty>Không có dữ liệu trong khoảng này.</div>');
  lastReport={head,rows,type}}
function exportReport(){if(!lastReport||!lastReport.rows.length)return alert('Không có dữ liệu để xuất.');
  const strip=s=>String(s).replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
  const csv=[lastReport.head,...lastReport.rows].map(r=>r.map(c=>'"'+strip(c).replace(/"/g,'""')+'"').join(',')).join('\r\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'}));a.download='BAO_CAO_'+lastReport.type+'_'+today()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

// =====================================================================
// THỰC ĐƠN – CHI TIẾT MÓN (kiểu CukCuk)
// =====================================================================
function renderMenuAdmin(){if(!$('menuTable'))return;
  const q=($('menuSearch')?$('menuSearch').value:'').trim().toLowerCase(),mk=$('menuMarketOnly')&&$('menuMarketOnly').checked;
  const list=S.menu.filter(m=>(!q||(m.name+' '+m.code+' '+m.cat).toLowerCase().includes(q))&&(!mk||m.marketPrice));
  $('menuCount').textContent='Tất cả ('+S.menu.length+' món)'+(list.length!==S.menu.length?' · đang lọc '+list.length:'');
  $('menuTable').innerHTML=list.length?list.map(m=>'<button class=menurow data-menu="'+esc(m.id)+'"><span class=mthumb>'+(m.station==='bar'?'🍹':'🍽')+'</span><span class=mtext><b>'+(m.signature?'★ ':'')+esc(m.name)+'</b><small>'+esc(m.code)+' · '+esc(m.cat)+' · '+(m.station==='bar'?'Bar':'Bếp')+'</small></span><span class=mprice>'+(m.marketPrice?'Thời giá':money(m.price))+'/'+esc(m.unit||'Phần')+'<small>'+(!m.active?'<em class=void>Ngừng bán</em>':m.hidden?'<em>Ẩn khỏi thực đơn</em>':'Đang bán')+'</small></span></button>').join(''):'<div class=empty>Không tìm thấy món.</div>';
  document.querySelectorAll('[data-menu]').forEach(b=>b.onclick=()=>editMenu(b.dataset.menu))}
function fld(l,h){return'<label class=fld><span>'+l+'</span>'+h+'</label>'}
function tog(id,l,on){return'<label class=tog><span>'+l+'</span><input type=checkbox id='+id+(on?' checked':'')+'><i></i></label>'}
function menuForm(m){const isNew=!m;m=m||{code:'',name:'',en:'',cat:'',price:0,cost:0,unit:'Phần',station:'kitchen',course:'Món chính',signature:false,marketPrice:false,desc:'',hidden:false,active:true};
  const cats=[...new Set(S.menu.map(x=>x.cat).filter(Boolean))];
  modal('<h2>'+(isNew?'Thêm món':'Chi tiết món')+'</h2><div class=mform>'+
   fld('Mã món','<input id=mfCode value="'+esc(m.code)+'">')+fld('Tên món','<input id=mfName value="'+esc(m.name)+'">')+fld('Tên tiếng Anh','<input id=mfEn value="'+esc(m.en)+'">')+
   fld('Nhóm thực đơn','<input id=mfCat list=mfCats value="'+esc(m.cat)+'"><datalist id=mfCats>'+cats.map(c=>'<option value="'+esc(c)+'">').join('')+'</datalist>')+
   fld('Thứ tự món','<select id=mfCourse>'+['Khai vị','Món chính','Tráng miệng','Đồ uống','Khác'].map(c=>'<option'+(m.course===c?' selected':'')+'>'+c+'</option>').join('')+'</select>')+
   fld('Đơn vị tính','<input id=mfUnit list=mfUnits value="'+esc(m.unit)+'"><datalist id=mfUnits>'+['Phần','Đĩa','Bát','Nồi','Ly','Cốc','Chai','Lon','Kg','Cái','Suất','Bộ'].map(u=>'<option value="'+u+'">').join('')+'</datalist>')+
   fld('Giá bán','<input id=mfPrice type=number min=0 value="'+(m.price||0)+'">')+fld('Giá vốn','<input id=mfCost type=number min=0 value="'+(m.cost||0)+'"><small id=mfMargin class=muted></small>')+
   fld('Chế biến tại','<select id=mfStation><option value=kitchen'+(m.station!=='bar'?' selected':'')+'>Bếp</option><option value=bar'+(m.station==='bar'?' selected':'')+'>Bar</option></select>')+
   fld('Mô tả','<textarea id=mfDesc rows=2>'+esc(m.desc)+'</textarea>')+
   tog('mfSig','Là món đặc trưng',m.signature)+tog('mfMarket','Món thay đổi theo thời giá',m.marketPrice)+tog('mfHidden','Không hiển thị trên thực đơn',m.hidden)+tog('mfStop','Ngừng bán',!m.active)+
   '</div><button id=mfSave class="primary wide">LƯU</button><button id=mfCancel class=wide style="margin-top:7px">ĐÓNG</button>');
  const upd=()=>{const p=+$('mfPrice').value||0,c=+$('mfCost').value||0;$('mfMargin').textContent=p?'Tỷ lệ giá vốn '+(c/p*100).toFixed(1)+'% · Lãi gộp '+money(p-c):''};
  $('mfPrice').oninput=upd;$('mfCost').oninput=upd;upd();$('mfCancel').onclick=closeModal;$('mfSave').onclick=()=>saveMenu(isNew?null:m)}
async function saveMenu(old){if(!has('menu'))return alert('Không có quyền sửa thực đơn.');
  const v={code:$('mfCode').value.trim(),name:$('mfName').value.trim(),en:$('mfEn').value.trim(),cat:$('mfCat').value.trim()||'KHÁC',course:$('mfCourse').value,unit:$('mfUnit').value.trim()||'Phần',price:+$('mfPrice').value||0,cost:+$('mfCost').value||0,station:$('mfStation').value,desc:$('mfDesc').value.trim(),signature:$('mfSig').checked,marketPrice:$('mfMarket').checked,hidden:$('mfHidden').checked,active:!$('mfStop').checked};
  if(!v.code||!v.name)return alert('Nhập mã món và tên món.');
  if(!v.marketPrice&&!v.price)return alert('Nhập giá bán, hoặc bật "Món thay đổi theo thời giá".');
  if(S.menu.some(x=>String(x.code).toLowerCase()===v.code.toLowerCase()&&(!old||String(x.id)!==String(old.id))))return alert('Mã món đã tồn tại.');
  const row={code:v.code,name:v.name,name_en:v.en,category:v.cat,price:v.price,station:v.station,active:v.active,unit:v.unit,cost:v.cost,is_signature:v.signature,is_market_price:v.marketPrice,description:v.desc,hidden:v.hidden,course:v.course};
  const btn=$('mfSave');btn.disabled=true;btn.textContent='ĐANG LƯU...';
  const{data,error}=await(old?sb.from('menu_items').update(row).eq('id',old.id).select().single():sb.from('menu_items').insert(row).select().single());
  if(error){btn.disabled=false;btn.textContent='LƯU';console.error(error);return alert('Chưa lưu được món: '+error.message+(/column|schema/i.test(error.message)?'\n→ Hãy chạy file SQL cập nhật trong Supabase trước.':''))}
  const mm=mapMenu(data);
  if(old){const i=S.menu.findIndex(x=>String(x.id)===String(old.id));if(i>=0)S.menu[i]=mm}
  else{S.menu.push(mm)}
  closeModal();render();toast('✓ Đã lưu '+v.name)}
function addMenu(){menuForm(null)}
function editMenu(id){const m=S.menu.find(x=>String(x.id)===String(id));if(m)menuForm(m)}

// =====================================================================
// GIAI ĐOẠN 2 – Kho nhiều điểm, Công thức, Ca & Quỹ tiền, Nhật ký,
//               Cài đặt, Đặt chỗ, Thông báo (dùng chung qua Supabase)
// =====================================================================
const LOCS={KHO:'Kho tổng',BEP:'Bếp',BAR:'Bar'};
const MOVE_TYPES=['NHẬP','XUẤT','HỦY','CHUYỂN','ĐIỀU CHỈNH','KIỂM KÊ'];
const CASH_CATS=['Mua nguyên liệu','Điện / nước / gas','Lương / thưởng','Sửa chữa','Nộp tiền về chủ','Thu khác','Chi khác'];
const RES_STATUS={'ĐÃ ĐẶT':'res-new','ĐÃ ĐẾN':'res-ok','HỦY':'res-off','KHÔNG ĐẾN':'res-off'};
const num=v=>{const n=Number(String(v??'').replace(/[^\d.-]/g,''));return isFinite(n)?n:0};
const fmtQ=n=>(Math.round(Number(n||0)*100)/100).toLocaleString('vi-VN');
const fmtDT=ts=>ts?new Date(ts).toLocaleString('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'}):'';
const can=list=>list.includes(S.user);
function ensureP2(){S.ings??=[];S.stock??={};S.moves??=[];S.rec??={};S.shiftOpen??=null;S.shifts??=[];S.cash??=[];S.audit??=[];S.resv??=[];if(typeof S.bank!=='string')S.bank='Chưa cấu hình'}
ensureP2();

// ---------- Nhật ký: ghi lên máy chủ ----------
function log(action,detail,risk=false){
  const x={id:'tmp'+Date.now()+Math.random(),time:now(),at:Date.now(),user:who()||S.user||'SYSTEM',action,detail:String(detail??''),risk:!!risk,pending:true};
  S.audit.unshift(x);S.risks=S.audit.filter(a=>a.risk);save();
  if(S.user)sb.from('pos_audit').insert({actor:x.user,role:S.user,action,detail:x.detail,risk:!!risk}).then(({error})=>{if(error)console.error('Lỗi ghi nhật ký:',error)})}

// ---------- Tải dữ liệu giai đoạn 2 ----------
async function q(make){const r=await fetchAll(make);if(r.error){console.warn('Bỏ qua (không có quyền hoặc chưa có bảng):',r.error.message);return null}return r.data}
const loaders={
  ings:async()=>{const d=await q(()=>sb.from('pos_ingredients').select('*').order('code'));if(d)S.ings=d.map(x=>({id:x.id,code:x.code,name:x.name,unit:x.unit,cost:+x.cost||0,min:+x.min_qty||0,active:x.active!==false}))},
  stock:async()=>{const d=await q(()=>sb.from('pos_stock').select('*'));if(d){S.stock={};d.forEach(r=>{(S.stock[r.ingredient_id]??={KHO:0,BEP:0,BAR:0})[r.location]=+r.qty||0})}},
  moves:async()=>{const since=new Date(dayStart(-HISTORY_DAYS)).toISOString();const d=await q(()=>sb.from('pos_stock_moves').select('*').gte('created_at',since).order('created_at',{ascending:false}));if(d)S.moves=d.map(r=>({id:r.id,ing:r.ingredient_id,loc:r.location,qty:+r.qty,type:r.type,cost:r.unit_cost,note:r.note||'',ref:r.ref||'',by:r.created_by,time:msOf(r.created_at)}))},
  rec:async()=>{const d=await q(()=>sb.from('pos_recipes').select('*'));if(d){S.rec={};d.forEach(r=>(S.rec[r.menu_item_id]??=[]).push({ing:r.ingredient_id,qty:+r.qty}))}},
  shifts:async()=>{const d=await q(()=>sb.from('pos_shifts').select('*').order('opened_at',{ascending:false}).limit(60));if(d){const m=d.map(r=>({id:r.id,status:r.status,openedBy:r.opened_by,opened:msOf(r.opened_at),opening:+r.opening||0,closedBy:r.closed_by,closed:msOf(r.closed_at),cashSales:+r.cash_sales||0,cashIn:+r.cash_in||0,cashOut:+r.cash_out||0,expected:+r.expected||0,actual:+r.actual||0,diff:+r.diff||0,reason:r.reason||''}));S.shiftOpen=m.find(s=>s.status==='open')||null;S.shifts=m.filter(s=>s.status==='closed')}},
  cash:async()=>{const since=new Date(dayStart(-HISTORY_DAYS)).toISOString();const d=await q(()=>sb.from('pos_cash_moves').select('*').gte('created_at',since).order('created_at',{ascending:false}));if(d)S.cash=d.map(r=>({id:r.id,shift:r.shift_id,type:r.type,method:r.method,amount:+r.amount,cat:r.category||'',note:r.note||'',by:r.created_by,time:msOf(r.created_at)}))},
  audit:async()=>{if(!has('audit')){S.audit=[];S.risks=[];return}const{data,error}=await sb.from('pos_audit').select('*').order('at',{ascending:false}).limit(500);if(error)return;S.audit=(data||[]).map(r=>({id:r.id,at:msOf(r.at),time:new Date(r.at).toLocaleString('vi-VN'),user:r.actor||'',role:r.role,device:r.device||'',action:r.action,detail:r.detail||'',risk:!!r.risk}));S.risks=S.audit.filter(a=>a.risk)},
  settings:async()=>{const d=await q(()=>sb.from('pos_settings').select('*'));if(!d)return;const b=d.find(x=>x.key==='bank');
    const st=d.find(x=>x.key==='store');S.store=st&&st.value&&typeof st.value==='object'?st.value:{};
    S.bank=b?String(b.value):'Chưa cấu hình'},
  resv:async()=>{const since=new Date(dayStart(-31)).toISOString();const d=await q(()=>sb.from('pos_reservations').select('*').gte('reserve_at',since).order('reserve_at'));if(d)S.resv=d.map(r=>({id:r.id,name:r.guest_name,phone:r.phone||'',guests:+r.guests||0,at:msOf(r.reserve_at),table:r.table_no,deposit:+r.deposit||0,note:r.note||'',status:r.status,by:r.created_by}))}
};
async function loadExtras(keys=Object.keys(loaders)){ensureP2();await Promise.all(keys.map(k=>loaders[k]().catch(e=>console.warn(k,e))));save()}
const reloadTimers={};
function scheduleReload(keys){const k=keys.join(',');clearTimeout(reloadTimers[k]);reloadTimers[k]=setTimeout(async()=>{await loadExtras(keys);render()},400)}

// ---------- Tồn kho ----------
const stockOf=id=>S.stock[id]||{KHO:0,BEP:0,BAR:0};
const totalStock=id=>{const s=stockOf(id);return(s.KHO||0)+(s.BEP||0)+(s.BAR||0)};
const ingById=id=>S.ings.find(i=>String(i.id)===String(id));
const lowStock=()=>S.ings.filter(i=>i.active&&i.min>0&&totalStock(i.id)<i.min);
function renderStock(){if(!$('stockTable'))return;ensureP2();
  const qy=($('stockSearch')?.value||'').trim().toLowerCase(),list=S.ings.filter(i=>!qy||(i.code+' '+i.name).toLowerCase().includes(qy));
  const total=S.ings.reduce((s,i)=>s+totalStock(i.id)*i.cost,0);
  $('stockSum').innerHTML=stats([['Số nguyên liệu',S.ings.length],['Giá trị tồn',money(total)],['Dưới mức tối thiểu',lowStock().length]]);
  $('stockTable').innerHTML=list.length?htmlTable(['Mã','Nguyên liệu','ĐVT','Giá nhập','Kho tổng','Bếp','Bar','Tổng','Tối thiểu','Giá trị',''],list.map(i=>{const s=stockOf(i.id),t=totalStock(i.id),low=i.min>0&&t<i.min;return[esc(i.code),(low?'<b class=down>⚠ ':'<b>')+esc(i.name)+'</b>'+(i.active?'':' <em>(ngừng)</em>'),esc(i.unit),money(i.cost),fmtQ(s.KHO),fmtQ(s.BEP),fmtQ(s.BAR),'<b'+(low?' class=down':'')+'>'+fmtQ(t)+'</b>',fmtQ(i.min),money(t*i.cost),(has('stock')||has('import'))?'<button data-ing="'+i.id+'">Sửa</button>':'']})):'<div class=empty>Chưa có nguyên liệu. Bấm “+ Nguyên liệu” để thêm.</div>';
  document.querySelectorAll('[data-ing]').forEach(b=>b.onclick=()=>ingForm(ingById(b.dataset.ing)));
  const sel=$('stockIngredient'),cur=sel.value;sel.innerHTML=S.ings.filter(i=>i.active).map(i=>'<option value="'+i.id+'">'+esc(i.code+' · '+i.name)+' ('+esc(i.unit)+')</option>').join('');if(cur)sel.value=cur;
  const tp=$('stockType').value;$('stockToWrap').style.display=tp==='CHUYỂN'?'':'none';$('stockCostWrap').style.display=tp==='NHẬP'?'':'none';
  $('stockQtyLabel').textContent=tp==='KIỂM KÊ'?'Số lượng thực tế đếm được':tp==='ĐIỀU CHỈNH'?'Số lượng điều chỉnh (+ tăng / − giảm)':'Số lượng';if(tp==='ĐIỀU CHỈNH')$('stockQty').removeAttribute('min');else $('stockQty').setAttribute('min','0');
  const f=$('moveFilter')?.value||'';const mv=S.moves.filter(m=>!f||m.type.startsWith(f)).slice(0,150);
  $('stockMoves').innerHTML=mv.length?htmlTable(['Thời gian','Loại','Nguyên liệu','Kho','SL','Ghi chú','Người ghi'],mv.map(m=>{const i=ingById(m.ing);return[fmtDT(m.time),esc(m.type),esc(i?i.name:'#'+m.ing),LOCS[m.loc]||m.loc,'<b class='+(m.qty<0?'down':'up')+'>'+(m.qty>0?'+':'')+fmtQ(m.qty)+'</b> '+esc(i?i.unit:''),esc([m.note,m.ref].filter(Boolean).join(' · ')),esc(m.by||'')]})):'<div class=empty>Chưa có phiếu kho.</div>'}
function ingForm(i){if(!(has('stock')||has('import')))return alert('Không có quyền sửa nguyên liệu.');const isNew=!i;i=i||{code:'',name:'',unit:'g',cost:0,min:0,active:true};
  modal('<h2>'+(isNew?'Thêm nguyên liệu':'Sửa nguyên liệu')+'</h2>'+fld('Mã nguyên liệu','<input id=ifCode value="'+esc(i.code)+'">')+fld('Tên nguyên liệu','<input id=ifName value="'+esc(i.name)+'">')+fld('Đơn vị tính','<input id=ifUnit list=ifUnits value="'+esc(i.unit)+'"><datalist id=ifUnits>'+['g','kg','ml','l','cái','quả','con','gói','chai','lon','hộp'].map(u=>'<option value="'+u+'">').join('')+'</datalist>')+fld('Giá nhập / 1 đơn vị','<input id=ifCost type=number min=0 step=any value="'+i.cost+'">')+fld('Mức tồn tối thiểu (cảnh báo)','<input id=ifMin type=number min=0 step=any value="'+i.min+'">')+tog('ifStop','Ngừng sử dụng',!i.active)+'<button id=ifSave class="primary wide">LƯU</button><button id=ifCancel class=wide style="margin-top:7px">ĐÓNG</button>');
  $('ifCancel').onclick=closeModal;$('ifSave').onclick=async()=>{const row={code:$('ifCode').value.trim(),name:$('ifName').value.trim(),unit:$('ifUnit').value.trim()||'g',cost:num($('ifCost').value),min_qty:num($('ifMin').value),active:!$('ifStop').checked,updated_at:new Date().toISOString()};
    if(!row.code||!row.name)return alert('Nhập mã và tên nguyên liệu.');if(S.ings.some(x=>x.code.toLowerCase()===row.code.toLowerCase()&&(isNew||x.id!==i.id)))return alert('Mã nguyên liệu đã tồn tại.');
    $('ifSave').disabled=true;const{error}=await(isNew?sb.from('pos_ingredients').insert(row):sb.from('pos_ingredients').update(row).eq('id',i.id));
    if(error){$('ifSave').disabled=false;return alert('Chưa lưu được: '+error.message)}log(isNew?'THÊM NGUYÊN LIỆU':'SỬA NGUYÊN LIỆU',row.code+' '+row.name+' · '+row.unit+' · tối thiểu '+row.min_qty);closeModal();await loadExtras(['ings']);render();toast('✓ Đã lưu '+row.name)}}
function addIngredient(){ingForm(null)}
async function postStock(){if(!has('stock'))return alert('Không có quyền ghi phiếu kho.');
  const type=$('stockType').value,ing=ingById($('stockIngredient').value),loc=$('stockLoc').value,to=$('stockTo').value,qty=num($('stockQty').value),cost=num($('stockCost').value),note=$('stockSupplier').value.trim();
  if(!ing)return alert('Chọn nguyên liệu.');if(type==='ĐIỀU CHỈNH'?qty===0:type==='KIỂM KÊ'?($('stockQty').value===''||qty<0):!(qty>0))return alert(type==='KIỂM KÊ'?'Nhập số lượng thực tế đếm được.':type==='ĐIỀU CHỈNH'?'Nhập số lượng điều chỉnh khác 0 (số âm để giảm).':'Nhập số lượng lớn hơn 0.');
  if(type==='CHUYỂN'&&to===loc)return alert('Kho nhận phải khác kho xuất.');
  if(type!=='NHẬP'&&type!=='KIỂM KÊ'&&type!=='ĐIỀU CHỈNH'){const have=stockOf(ing.id)[loc]||0;if(qty>have&&!confirm('Tồn '+LOCS[loc]+' chỉ còn '+fmtQ(have)+' '+ing.unit+'. Vẫn ghi phiếu?'))return}
  if((type==='HỦY'||type==='ĐIỀU CHỈNH')&&!note)return alert('Phiếu '+type+' bắt buộc ghi lý do.');
  const btn=$('postStock');btn.disabled=true;
  const{error}=await sb.rpc('pos_stock_post',{p_type:type,p_ing:ing.id,p_loc:loc,p_qty:qty,p_to:type==='CHUYỂN'?to:null,p_cost:type==='NHẬP'&&cost>0?cost:null,p_note:note||null});
  btn.disabled=false;if(error)return alert('Chưa ghi được phiếu: '+error.message);
  log(type+' KHO',ing.name+' · '+(type==='ĐIỀU CHỈNH'&&qty>0?'+':'')+fmtQ(qty)+' '+ing.unit+' · '+LOCS[loc]+(type==='CHUYỂN'?' → '+LOCS[to]:'')+(note?' · '+note:''),type==='HỦY'||type==='KIỂM KÊ'||type==='ĐIỀU CHỈNH');
  $('stockQty').value='';$('stockCost').value='';$('stockSupplier').value='';await loadExtras(['ings','stock','moves']);render();toast('✓ Đã ghi phiếu '+type)}

// ---------- Công thức ----------
function recipeCost(mid){return(S.rec[mid]||[]).reduce((s,r)=>{const i=ingById(r.ing);return s+(i?i.cost*r.qty:0)},0)}
function renderRecipes(){if(!$('recipeList'))return;ensureP2();const qy=($('recipeSearch')?.value||'').trim().toLowerCase();
  const list=S.menu.filter(m=>m.active&&(!qy||(m.name+' '+m.code).toLowerCase().includes(qy)));const editable=has('recipes')||has('import');
  const done=S.menu.filter(m=>(S.rec[m.id]||[]).length).length;
  $('recipeSum').innerHTML=stats([['Món đang bán',S.menu.filter(m=>m.active).length],['Đã có định lượng',done],['Food cost > 35%',S.menu.filter(m=>m.price&&recipeCost(m.id)/m.price>.35).length]]);
  $('recipeList').innerHTML=list.length?htmlTable(['Món','Giá bán','Định lượng','Giá vốn (CT)','Food cost',''],list.map(m=>{const rs=S.rec[m.id]||[],c=recipeCost(m.id),fc=m.price?c/m.price*100:0;return['<b>'+esc(m.name)+'</b><br><small>'+esc(m.code)+' · '+(m.station==='bar'?'Bar':'Bếp')+'</small>',money(m.price),rs.length?rs.map(r=>{const i=ingById(r.ing);return i?esc(i.name)+' '+fmtQ(r.qty)+esc(i.unit):''}).join('<br>'):'<em class=muted>Chưa có</em>',rs.length?money(c):'—',rs.length?'<b class='+(fc>35?'down':'up')+'>'+fc.toFixed(1)+'%</b>':'—',editable?'<button data-recipe="'+esc(m.id)+'">Định lượng</button>':'']})):'<div class=empty>Không có món.</div>';
  document.querySelectorAll('[data-recipe]').forEach(b=>b.onclick=()=>editRecipe(b.dataset.recipe))}
function editRecipe(mid){const m=S.menu.find(x=>String(x.id)===String(mid));if(!m)return;if(!S.ings.length)return alert('Chưa có nguyên liệu. Vào Kho → “+ Nguyên liệu” trước.');
  const opts=sel=>S.ings.filter(i=>i.active||String(i.id)===String(sel)).map(i=>'<option value="'+i.id+'"'+(String(i.id)===String(sel)?' selected':'')+'>'+esc(i.code+' · '+i.name+' ('+i.unit+')')+'</option>').join('');
  const row=r=>'<div class=recrow><select class=rIng>'+opts(r?r.ing:'')+'</select><input class=rQty type=number min=0 step=any placeholder="SL" value="'+(r?r.qty:'')+'"><button class=rDel title="Bỏ dòng">✕</button></div>';
  modal('<h2>Định lượng · '+esc(m.name)+'</h2><p class=muted>Lượng nguyên liệu cho 1 '+esc(m.unit||'phần')+'. Khi thanh toán, hệ thống tự trừ ở kho '+(m.station==='bar'?'Bar':'Bếp')+'.</p><div id=recRows>'+((S.rec[m.id]||[]).map(row).join('')||row(null))+'</div><button id=recAdd class=wide>+ Thêm nguyên liệu</button><p id=recCost class=muted></p><button id=recSave class="primary wide">LƯU</button><button id=recCancel class=wide style="margin-top:7px">ĐÓNG</button>');
  const calc=()=>{let c=0;document.querySelectorAll('.recrow').forEach(r=>{const i=ingById(r.querySelector('.rIng').value);c+=i?i.cost*num(r.querySelector('.rQty').value):0});$('recCost').textContent='Giá vốn theo công thức: '+money(c)+(m.price?' · Food cost '+(c/m.price*100).toFixed(1)+'%':'')};
  const bind=()=>{document.querySelectorAll('.rDel').forEach(b=>b.onclick=()=>{b.parentElement.remove();calc()});document.querySelectorAll('.rIng,.rQty').forEach(e=>e.oninput=e.onchange=calc)};
  $('recAdd').onclick=()=>{$('recRows').insertAdjacentHTML('beforeend',row(null));bind();calc()};bind();calc();$('recCancel').onclick=closeModal;
  $('recSave').onclick=async()=>{const rows={};document.querySelectorAll('.recrow').forEach(r=>{const ing=r.querySelector('.rIng').value,qq=num(r.querySelector('.rQty').value);if(ing&&qq>0)rows[ing]=(rows[ing]||0)+qq});
    const old=(S.rec[m.id]||[]).map(r=>String(r.ing)),keep=Object.keys(rows),del=old.filter(x=>!keep.includes(x));$('recSave').disabled=true;
    if(keep.length){const{error}=await sb.from('pos_recipes').upsert(keep.map(k=>({menu_item_id:Number(m.id),ingredient_id:Number(k),qty:rows[k]})));if(error){$('recSave').disabled=false;return alert('Chưa lưu được: '+error.message)}}
    if(del.length){const{error}=await sb.from('pos_recipes').delete().eq('menu_item_id',Number(m.id)).in('ingredient_id',del.map(Number));if(error){$('recSave').disabled=false;return alert('Chưa bỏ được dòng cũ: '+error.message)}}
    await loadExtras(['rec']);const c=recipeCost(m.id);if(c>0&&has('menu'))await sb.from('menu_items').update({cost:Math.round(c)}).eq('id',m.id);
    log('SỬA CÔNG THỨC',m.name+' · '+keep.map(k=>{const i=ingById(k);return(i?i.code:k)+':'+rows[k]}).join(', '));closeModal();await loadMenuMapped();render();toast('✓ Đã lưu định lượng '+m.name)}}

// ---------- Ca & Quỹ tiền ----------
function billCash(b){return b.method==='Tiền mặt'?b.total:b.method==='Kết hợp'?(+b.parts.cash||0):0}
function shiftFigures(sh){const from=sh.opened,to=sh.closed||Date.now();const bs=validBills().filter(b=>b.time>=from&&b.time<=to);const cm=S.cash.filter(c=>c.shift===sh.id||(!c.shift&&c.time>=from&&c.time<=to));
  const cashSales=bs.reduce((s,b)=>s+billCash(b),0),qr=bs.reduce((s,b)=>s+(b.method==='QR/Chuyển khoản'?b.total:b.method==='Kết hợp'?(+b.parts.qr||0):0),0),card=bs.filter(b=>b.method==='Thẻ').reduce((s,b)=>s+b.total,0);
  const cashIn=cm.filter(c=>c.type==='THU'&&c.method==='Tiền mặt').reduce((s,c)=>s+c.amount,0),cashOut=cm.filter(c=>c.type==='CHI'&&c.method==='Tiền mặt').reduce((s,c)=>s+c.amount,0);
  return{bills:bs.length,rev:bs.reduce((s,b)=>s+b.total,0),cashSales,qr,card,cashIn,cashOut,expected:sh.opening+cashSales+cashIn-cashOut,moves:cm}}
function renderShift(){if(!$('shiftStats'))return;ensureP2();const sh=S.shiftOpen,payOK=has('shift');
  if(sh){const f=shiftFigures(sh);$('shiftStats').innerHTML='<div class="notice">CA ĐANG MỞ · từ '+fmtDT(sh.opened)+' · '+esc(sh.openedBy||'')+'</div>'+stats([['Quỹ đầu ca',money(sh.opening)],['Doanh thu trong ca',money(f.rev)],['Tiền mặt bán hàng',money(f.cashSales)],['QR / chuyển khoản',money(f.qr)],['Thẻ',money(f.card)],['Phiếu thu (TM)',money(f.cashIn)],['Phiếu chi (TM)',money(f.cashOut)],['Tiền mặt phải có trong két',money(f.expected)]])}
  else $('shiftStats').innerHTML='<div class="notice voidnote">CHƯA MỞ CA</div>'+stats([['Doanh thu hôm nay',money(S.payments.reduce((s,p)=>s+p.amount,0))],['Số hóa đơn hôm nay',S.payments.length]]);
  $('openBox').style.display=!sh&&payOK?'':'none';$('closeBox').style.display=sh&&payOK?'':'none';$('cashBox').style.display=has('cash')?'':'none';
  if(sh){const f=shiftFigures(sh),a=$('actualCash').value;$('closePreview').textContent=a===''?'':'Chênh lệch: '+money(num(a)-f.expected)+(num(a)-f.expected===0?' (khớp)':'')}
  const cs=S.cash.filter(c=>dayKey(c.time)===today()||(sh&&c.shift===sh.id));
  $('cashList').innerHTML=cs.length?htmlTable(['Thời gian','Loại','Hạng mục','Hình thức','Số tiền','Ghi chú','Người lập'],cs.map(c=>[fmtDT(c.time),'<b class='+(c.type==='THU'?'up':'down')+'>'+c.type+'</b>',esc(c.cat),esc(c.method),'<b>'+money(c.amount)+'</b>',esc(c.note),esc(c.by||'')])):'<div class=empty>Chưa có phiếu thu / chi hôm nay.</div>';
  $('shiftHistory').innerHTML=S.shifts.length?htmlTable(['Mở ca','Đóng ca','Quỹ đầu','TM bán hàng','Thu','Chi','Phải có','Thực tế','Chênh','Lý do'],S.shifts.slice(0,15).map(s=>[fmtDT(s.opened)+'<br><small>'+esc(s.openedBy||'')+'</small>',fmtDT(s.closed)+'<br><small>'+esc(s.closedBy||'')+'</small>',money(s.opening),money(s.cashSales),money(s.cashIn),money(s.cashOut),money(s.expected),money(s.actual),'<b class='+(s.diff<0?'down':s.diff>0?'up':'')+'>'+money(s.diff)+'</b>',esc(s.reason)])):'<div class=empty>Chưa có ca nào được đóng.</div>'}
async function openShift(){if(!has('shift'))return alert('Không có quyền mở ca.');await loadExtras(['shifts']);if(S.shiftOpen){render();return alert('Đang có ca mở (từ '+fmtDT(S.shiftOpen.opened)+' bởi '+S.shiftOpen.openedBy+').')}
  const opening=num($('opening').value);const{error}=await sb.from('pos_shifts').insert({id:uid(),status:'open',opened_by:who(),opening});
  if(error)return alert(/one_open|duplicate/.test(error.message)?'Máy khác vừa mở ca. Đang tải lại…':'Chưa mở được ca: '+error.message);
  $('opening').value='';await loadExtras(['shifts']);render();toast('✓ Đã mở ca')}
async function closeShift(){const sh=S.shiftOpen;if(!sh)return alert('Chưa mở ca.');if(!has('shift'))return alert('Không có quyền đóng ca.');
  if($('actualCash').value==='')return alert('Nhập số tiền mặt thực tế đếm được trong két.');
  await loadExtras(['cash']);const f=shiftFigures(sh),actual=num($('actualCash').value),diff=actual-f.expected,reason=$('shiftReason').value.trim();
  if(diff!==0&&!reason)return alert('Chênh lệch '+money(diff)+'. Bắt buộc nhập lý do.');
  if(!confirm('Đóng ca?\nPhải có: '+money(f.expected)+'\nThực tế: '+money(actual)+'\nChênh: '+money(diff)))return;
  const{error}=await sb.from('pos_shifts').update({status:'closed',closed_by:who(),closed_at:new Date().toISOString(),cash_sales:f.cashSales,cash_in:f.cashIn,cash_out:f.cashOut,expected:f.expected,actual,diff,reason}).eq('id',sh.id);
  if(error)return alert('Chưa đóng được ca: '+error.message);
  $('actualCash').value='';$('shiftReason').value='';await loadExtras(['shifts']);render();$('shiftResult').innerHTML='<p>Đã đóng ca. Phải có <b>'+money(f.expected)+'</b> · Thực tế <b>'+money(actual)+'</b> · Chênh <b>'+money(diff)+'</b></p>'}
async function postCash(){if(!has('cash'))return alert('Không có quyền lập phiếu thu / chi.');
  const type=$('cashType').value,amount=num($('cashAmount').value),cat=$('cashCat').value.trim(),method=$('cashMethod').value,note=$('cashNote').value.trim();
  if(!(amount>0))return alert('Nhập số tiền lớn hơn 0.');if(!note&&!cat)return alert('Nhập hạng mục hoặc ghi chú.');
  const{error}=await sb.from('pos_cash_moves').insert({id:uid(),shift_id:S.shiftOpen?S.shiftOpen.id:null,type,method,amount,category:cat,note,created_by:who()});
  if(error)return alert('Chưa lưu được phiếu: '+error.message);
  $('cashAmount').value='';$('cashNote').value='';await loadExtras(['cash']);render();toast('✓ Đã lập phiếu '+type)}

// ---------- Kiểm soát & Nhật ký ----------
function renderRisk(){if(!$('bankInfo'))return;$('bankInfo').textContent=S.bank;const rs=S.audit.filter(a=>a.risk);
  $('riskLog').innerHTML=rs.length?rs.slice(0,200).map(x=>'<div class=log><b>'+esc(x.action)+'</b> · '+esc(x.time)+' · '+esc(x.user)+'<br>'+esc(x.detail)+'</div>').join(''):'Chưa có cảnh báo.'}
function setBank(){if(!has('settings'))return alert('Chỉ OWNER được thay đổi.');
  modal('<h2>Tài khoản nhận tiền</h2><p class=muted>Thông tin này hiện cho thu ngân khi khách chuyển khoản.</p>'+fld('Ngân hàng - Chủ tài khoản - Số tài khoản','<input id=bkVal value="'+esc(S.bank==='Chưa cấu hình'?'':S.bank)+'">')+'<button id=bkSave class="primary wide">LƯU</button><button id=bkCancel class=wide style="margin-top:7px">ĐÓNG</button>');
  $('bkCancel').onclick=closeModal;$('bkSave').onclick=async()=>{const v=$('bkVal').value.trim();if(!v)return alert('Nhập thông tin tài khoản.');const old=S.bank;
    const{error}=await sb.from('pos_settings').upsert({key:'bank',value:v,updated_by:who(),updated_at:new Date().toISOString()});if(error)return alert('Chưa lưu được: '+error.message);
    closeModal();await loadExtras(['settings']);render();toast('✓ Đã lưu tài khoản nhận tiền')}}
function renderAudit(){if(!$('auditLog'))return;const qy=($('auditSearch')?.value||'').trim().toLowerCase();const list=S.audit.filter(x=>!qy||(x.action+' '+x.detail+' '+x.user+' '+(x.device||'')).toLowerCase().includes(qy)).slice(0,300);
  $('auditLog').innerHTML=list.length?list.map(x=>'<div class=log>'+(x.risk?'⚠️ ':'')+'<b>'+esc(x.action)+'</b> · '+esc(x.time)+' · '+esc(x.user)+(x.role?' ('+esc(ROLE_NAMES[x.role]||x.role)+')':'')+(x.device?' · 🖥 '+esc(x.device):'')+(x.pending?' <em class=muted>(đang gửi)</em>':'')+'<br>'+esc(x.detail)+'</div>').join(''):'<div class=empty>Chưa có nhật ký.</div>'}

// ---------- Hủy món: ghi hao hụt theo công thức ----------
function voidItem(){if(!has('order')&&!has('void_sent'))return alert('Không có quyền.');let a=S.orders[S.table]||[];if(!a.length)return alert('Không có món.');
  let i=Number(prompt(a.map((x,i)=>(i+1)+'. '+x.name+' × '+x.qty).join('\n')+'\nNhập số thứ tự món:'))-1;if(i<0||i>=a.length)return;
  let x=a[i],cooked=Math.min(x.sent||0,x.qty);if(cooked>0&&!has('void_sent'))return alert('Món đã gửi Bếp/Bar – cần Quản lý/OWNER hủy.');let why=prompt('Lý do hủy (bắt buộc):');if(!why)return alert('Bắt buộc có lý do.');
  if(cooked>0&&Number(x.id))sb.rpc('pos_waste_item',{p_menu_item:Number(x.id),p_qty:cooked,p_note:'Hủy món bàn '+S.table+': '+why}).then(({error})=>{if(error)console.error('Lỗi ghi hao hụt:',error)});
  a.splice(i,1);log('HỦY MÓN','Bàn '+S.table+': '+x.name+' × '+x.qty+' | '+why+' | '+(cooked?'ĐÃ GỬI BẾP '+cooked+' → HAO HỤT':'CHƯA CHẾ BIẾN'),true);pushTable(S.table);render()}

// ---------- Đặt chỗ ----------
function resvForm(r){const isNew=!r;const d=r?new Date(r.at):new Date(Date.now()+3600e3);d.setSeconds(0,0);const local=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
  r=r||{name:'',phone:'',guests:2,table:'',deposit:0,note:''};
  modal('<h2>'+(isNew?'Đặt chỗ mới':'Sửa đặt chỗ')+'</h2>'+fld('Tên khách','<input id=rvName value="'+esc(r.name)+'">')+fld('Số điện thoại','<input id=rvPhone type=tel value="'+esc(r.phone)+'">')+fld('Thời gian đến','<input id=rvAt type=datetime-local value="'+local+'">')+fld('Số khách','<input id=rvGuests type=number min=1 value="'+r.guests+'">')+fld('Bàn','<select id=rvTable><option value="">Chưa xếp bàn</option>'+Array.from({length:20},(_,k)=>'<option value="'+(k+1)+'"'+(Number(r.table)===k+1?' selected':'')+'>Bàn '+pad(k+1)+'</option>').join('')+'</select>')+fld('Tiền đặt cọc','<input id=rvDeposit type=number min=0 value="'+r.deposit+'">')+fld('Ghi chú','<textarea id=rvNote rows=2>'+esc(r.note)+'</textarea>')+'<p id=rvWarn class=down></p><button id=rvSave class="primary wide">LƯU</button><button id=rvCancel class=wide style="margin-top:7px">ĐÓNG</button>');
  const chk=()=>{const t=Number($('rvTable').value),at=new Date($('rvAt').value).getTime();const c=t&&S.resv.find(x=>x.table===t&&x.status==='ĐÃ ĐẶT'&&(isNew||x.id!==r.id)&&Math.abs(x.at-at)<2*3600e3);$('rvWarn').textContent=c?'⚠ Bàn '+pad(t)+' đã có '+c.name+' đặt lúc '+fmtDT(c.at):''};
  $('rvTable').onchange=$('rvAt').onchange=chk;chk();$('rvCancel').onclick=closeModal;
  $('rvSave').onclick=async()=>{const name=$('rvName').value.trim(),at=$('rvAt').value;if(!name||!at)return alert('Nhập tên khách và thời gian.');
    const row={guest_name:name,phone:$('rvPhone').value.trim(),reserve_at:new Date(at).toISOString(),guests:Math.max(1,num($('rvGuests').value)),table_no:Number($('rvTable').value)||null,deposit:num($('rvDeposit').value),note:$('rvNote').value.trim(),updated_at:new Date().toISOString()};
    $('rvSave').disabled=true;const{error}=await(isNew?sb.from('pos_reservations').insert({...row,id:uid(),status:'ĐÃ ĐẶT',created_by:who()}):sb.from('pos_reservations').update(row).eq('id',r.id));
    if(error){$('rvSave').disabled=false;return alert('Chưa lưu được: '+error.message)}
    log(isNew?'ĐẶT CHỖ':'SỬA ĐẶT CHỖ',name+' · '+row.guests+' khách · '+fmtDT(row.reserve_at)+(row.table_no?' · Bàn '+pad(row.table_no):''));closeModal();await loadExtras(['resv']);render();toast('✓ Đã lưu đặt chỗ '+name)}}
async function setResv(id,status){const r=S.resv.find(x=>x.id===id);if(!r)return;if(status!=='ĐÃ ĐẾN'&&!confirm('Chuyển đặt chỗ của '+r.name+' sang "'+status+'"?'))return;
  const{error}=await sb.from('pos_reservations').update({status,updated_at:new Date().toISOString()}).eq('id',id);if(error)return alert('Chưa cập nhật được: '+error.message);
  log('ĐẶT CHỖ → '+status,r.name+' · '+fmtDT(r.at)+(r.table?' · Bàn '+pad(r.table):''),status==='HỦY'&&r.deposit>0);await loadExtras(['resv']);
  if(status==='ĐÃ ĐẾN'&&r.table){S.table=r.table;S.orders[r.table]??=[];const b=[...document.querySelectorAll('#nav button')].find(x=>x.dataset.page==='sale');show('sale',b);toast('Khách '+r.name+' đã đến · Bàn '+pad(r.table))}else render()}
function renderBooking(){if(!$('resvList'))return;ensureP2();const rg=$('resvRange').value,t0=dayStart(0);
  let list=S.resv.filter(r=>rg==='today'?r.at>=t0&&r.at<dayStart(1):rg==='tomorrow'?r.at>=dayStart(1)&&r.at<dayStart(2):rg==='7d'?r.at>=t0&&r.at<dayStart(7):rg==='past'?r.at<t0:r.at>=t0);
  if(rg==='past')list=list.slice().reverse();
  const todays=S.resv.filter(r=>r.at>=t0&&r.at<dayStart(1)&&r.status!=='HỦY');
  $('resvSum').innerHTML=stats([['Đặt chỗ hôm nay',todays.length],['Khách dự kiến',todays.reduce((s,r)=>s+r.guests,0)],['Đã đến',todays.filter(r=>r.status==='ĐÃ ĐẾN').length],['Tiền cọc hôm nay',money(todays.reduce((s,r)=>s+r.deposit,0))]]);
  if(!list.length){$('resvList').innerHTML='<div class=empty>Không có đặt chỗ trong khoảng này.</div>';return}
  const g={};list.forEach(r=>(g[dayKey(r.at)]??=[]).push(r));
  $('resvList').innerHTML=Object.entries(g).map(([d,a])=>'<div class=dayhead><span>'+fmtDay(d)+'</span><b>'+a.filter(r=>r.status!=='HỦY').reduce((s,r)=>s+r.guests,0)+' khách</b></div>'+a.map(r=>{const late=r.status==='ĐÃ ĐẶT'&&Date.now()-r.at>30*60000;return'<div class=resvrow><div><b>'+fmtTime(r.at)+' · '+esc(r.name)+'</b> <span class="badge '+(RES_STATUS[r.status]||'')+'">'+r.status+'</span>'+(late?' <span class="badge res-late">TRỄ</span>':'')+'<br><small>'+r.guests+' khách'+(r.table?' · Bàn '+pad(r.table):' · chưa xếp bàn')+(r.phone?' · '+esc(r.phone):'')+(r.deposit?' · cọc '+money(r.deposit):'')+(r.note?' · '+esc(r.note):'')+'</small></div><div class=rowgap>'+(r.status==='ĐÃ ĐẶT'?'<button data-rv="'+r.id+'" data-st="ĐÃ ĐẾN" class=primary>Khách đến</button><button data-rvedit="'+r.id+'">Sửa</button><button data-rv="'+r.id+'" data-st="KHÔNG ĐẾN">Không đến</button><button data-rv="'+r.id+'" data-st="HỦY" class=danger>Hủy</button>':(r.phone?'<a class=btnlink href="tel:'+esc(r.phone)+'">Gọi</a>':''))+'</div></div>'}).join('')).join('');
  document.querySelectorAll('[data-rv]').forEach(b=>b.onclick=()=>setResv(b.dataset.rv,b.dataset.st));document.querySelectorAll('[data-rvedit]').forEach(b=>b.onclick=()=>resvForm(S.resv.find(x=>x.id===b.dataset.rvedit)))}
function addResv(){resvForm(null)}

// ---------- Thông báo ----------
function notifications(){ensureP2();const N=[],now_=Date.now(),t0=dayStart(0);
  S.resv.filter(r=>r.status==='ĐÃ ĐẶT'&&r.at>=now_-30*60000&&r.at<=now_+3*3600e3).forEach(r=>N.push({lv:'info',ic:'📅',t:'Khách đặt chỗ sắp đến: '+r.name+' · '+r.guests+' khách · '+fmtTime(r.at)+(r.table?' · Bàn '+pad(r.table):' · chưa xếp bàn'),go:'booking'}));
  S.resv.filter(r=>r.status==='ĐÃ ĐẶT'&&now_-r.at>30*60000&&r.at>=t0).forEach(r=>N.push({lv:'warn',ic:'⏰',t:'Khách đặt '+fmtTime(r.at)+' chưa đến: '+r.name+(r.phone?' · '+r.phone:''),go:'booking'}));
  if(has('order')||has('kds_kitchen')||has('kds_bar'))S.tickets.filter(t=>(t.status==='MỚI'||t.status==='ĐANG LÀM')&&now_-t.created>15*60000).forEach(t=>N.push({lv:'warn',ic:'🍳',t:'Món chờ '+Math.floor((now_-t.created)/60000)+' phút: '+t.qty+' × '+t.item+' · Bàn '+pad(t.table),go:'kds'}));
  lowStock().forEach(i=>N.push({lv:'warn',ic:'📦',t:'Sắp hết '+i.name+': còn '+fmtQ(totalStock(i.id))+' '+i.unit+' (tối thiểu '+fmtQ(i.min)+')',go:'stock'}));
  if(has('shift')&&!S.shiftOpen&&S.payments.length)N.push({lv:'warn',ic:'💵',t:'Đã có '+S.payments.length+' hóa đơn hôm nay nhưng chưa mở ca',go:'shift'});
  if(S.shiftOpen&&now_-S.shiftOpen.opened>14*3600e3)N.push({lv:'warn',ic:'💵',t:'Ca mở từ '+fmtDT(S.shiftOpen.opened)+' (quá 14 giờ) – nhớ đóng ca',go:'shift'});
  S.shifts.filter(s=>s.closed>=t0&&s.diff!==0).forEach(s=>N.push({lv:'warn',ic:'⚖️',t:'Đóng ca lệch '+money(s.diff)+' · '+(s.closedBy||'')+(s.reason?' · '+s.reason:''),go:'shift'}));
  S.bills.filter(b=>b.cancelled&&(b.cancelledAt||b.time)>=t0).forEach(b=>N.push({lv:'warn',ic:'🧾',t:'Hủy hóa đơn #'+b.id+' · '+money(b.total)+' · '+(b.cancelledBy||'')+' · '+(b.cancelReason||''),go:'bills'}));
  S.audit.filter(a=>a.risk&&a.at>=t0&&a.action!=='ĐÓNG CA').slice(0,30).forEach(a=>N.push({lv:'info',ic:'🛡️',t:a.action+' · '+a.detail+' · '+a.user,go:'risk'}));
  return N}
function renderNotify(){const N=notifications(),warn=N.filter(n=>n.lv==='warn').length;const b=[...document.querySelectorAll('#nav button')].find(x=>x.dataset.page==='notify');if(b)b.innerHTML='Thông báo'+(warn?' <span class=nbadge>'+warn+'</span>':'');
  if(!$('notifyList'))return;const pages=roles[S.user]?roles[S.user].pages:[];
  $('notifyList').innerHTML=N.length?N.map((n,i)=>'<button class="notice-row '+n.lv+'" data-go="'+(pages.includes(n.go)?n.go:'')+'"><span>'+n.ic+'</span><span>'+esc(n.t)+'</span></button>').join(''):'<div class=empty>Không có thông báo. Mọi thứ ổn ✓</div>';
  document.querySelectorAll('[data-go]').forEach(x=>x.onclick=()=>{const p=x.dataset.go;if(!p)return;show(p,[...document.querySelectorAll('#nav button')].find(y=>y.dataset.page===p))})}
setInterval(()=>{if(S.user)renderNotify()},60000);

// =====================================================================
// GIAI ĐOẠN 3 – Phân quyền theo quyền hạn, Nhân viên, In phiếu Bếp/Bar,
//               In hóa đơn 80mm, Nhập dữ liệu thật (CSV / Excel)
// =====================================================================
const PERM_LABELS={order:'Gọi món / gửi Bếp-Bar',pay:'Thanh toán',move_table:'Chuyển / gộp / tách bàn',void_sent:'Hủy món đã gửi Bếp/Bar',bill_view:'Xem & in lại hóa đơn',bill_cancel:'Hủy hóa đơn',reports:'Xem doanh thu / báo cáo',kds_kitchen:'Màn hình Bếp',kds_bar:'Màn hình Bar',shift:'Mở / đóng ca',cash:'Phiếu thu / chi',stock:'Kho (nhập/xuất/chuyển/kiểm kê)',recipes:'Công thức định lượng',import:'Nhập dữ liệu (CSV/Excel)',menu:'Sửa thực đơn',audit:'Xem Audit Log / Kiểm soát'};
const STAFF_ROLES=['manager','cashier','waiter','kitchen','bar','stock'];
async function loadPerms(role){P={};try{const{data,error}=await sb.rpc('pos_my_perms');if(!error&&data&&data.role){P=data;return}}catch(e){}
  P={...(ROLE_DEFAULTS[role]||{}),role,discount_max:{owner:100,manager:20,cashier:5}[role]||0}}
const kdsStation=()=>has('kds_kitchen')&&has('kds_bar')?null:has('kds_bar')?'bar':has('kds_kitchen')?'kitchen':null;

// ---------- Tùy chọn in theo từng máy (lưu trên máy này) ----------
const PRINT=(()=>{let p;try{p=JSON.parse(localStorage.getItem('MAY_POS_PRINT')||'null')}catch(e){}return Object.assign({onSend:false,kdsAuto:false,autoBill:false},p||{})})();
const savePrint=()=>{try{localStorage.setItem('MAY_POS_PRINT',JSON.stringify(PRINT))}catch(e){}};
function deviceForm(){modal('<h2>Thiết bị & máy in</h2><p class=muted>Thiết lập riêng cho máy này. Tên thiết bị được ghi vào Audit Log cho mọi thao tác.</p>'+fld('Tên thiết bị (vd: Quay thu ngan, Tablet bep)','<input id=dvName value="'+esc(DEVICE.name)+'" maxlength=40>')+'<p class=muted>Mã máy: '+esc(DEVICE.id)+'</p>'+
  tog('dvOnSend','In phiếu Bếp/Bar ngay khi bấm GỬI (máy order có máy in)',PRINT.onSend)+tog('dvKds','Tự in phiếu mới đến (máy Bếp/Bar có máy in)',PRINT.kdsAuto)+tog('dvBill','Tự in hóa đơn sau khi thanh toán',PRINT.autoBill)+
  '<p class=muted>Máy in nhiệt 80mm: chọn khổ giấy 80mm, lề "Không". Để in không hỏi, chạy Chrome với tùy chọn --kiosk-printing.</p><button id=dvTest class=wide>IN THỬ</button><button id=dvSave class="primary wide" style="margin-top:7px">LƯU</button><button id=dvClose class=wide style="margin-top:7px">ĐÓNG</button>');
  $('dvClose').onclick=closeModal;$('dvTest').onclick=()=>printHTML('<div class=slip><div class=slip-h>IN THỬ</div><div class=slip-big>'+esc(storeInfo().name)+'</div><div>Máy: '+esc(deviceLabel())+'</div><div>'+fmtDT(Date.now())+'</div><hr><div>Khổ 80mm · 0123456789012345678901234567890123456789</div></div>');
  $('dvSave').onclick=()=>{PRINT.onSend=$('dvOnSend').checked;PRINT.kdsAuto=$('dvKds').checked;PRINT.autoBill=$('dvBill').checked;savePrint();const nm=$('dvName').value.trim();
    if(nm!==DEVICE.name){DEVICE.name=nm;try{localStorage.setItem('MAY_POS_DEVICE',JSON.stringify(DEVICE))}catch(e){};closeModal();toast('Đã lưu · đang tải lại để áp dụng tên thiết bị');setTimeout(()=>location.reload(),600)}else{closeModal();toast('✓ Đã lưu thiết lập máy in')}}}

// ---------- Máy in 80mm ----------
function printHTML(html){let a=$('printArea');if(!a){a=document.createElement('div');a.id='printArea';document.body.appendChild(a)}a.innerHTML=html;window.__lastPrint=html;
  document.body.classList.add('printing');try{window.print()}catch(e){console.error(e)}setTimeout(()=>document.body.classList.remove('printing'),800)}
function storeInfo(){const s=S.store||{};return{name:s.name||'MÂY ƠI SAPA',address:s.address||'',phone:s.phone||'',footer:s.footer||'Cảm ơn quý khách – Hẹn gặp lại!'}}

// Phiếu Bếp/Bar theo từng lần gửi
function slipHTML(station,rows,o){const t=rows[0]||{};
  return'<div class=slip><div class=slip-h>'+(station==='bar'?'PHIẾU BAR':'PHIẾU BẾP')+'</div><div class=slip-big>BÀN '+pad(t.table)+'</div>'+
  '<div class=slip-row><span>Lần gửi</span><b>#'+(t.round||1)+'</b></div><div class=slip-row><span>Giờ gửi</span><span>'+fmtDT(t.created)+'</span></div><div class=slip-row><span>NV order</span><span>'+esc(t.by||'')+'</span></div>'+
  (o&&o.reprint?'<div class=slip-re>*** IN LẠI – lần '+o.count+' ***</div>':'')+'<hr>'+
  rows.map(r=>'<div class=slip-item><b>'+r.qty+' × '+esc(r.item)+'</b>'+(r.note?'<div class=slip-note>» '+esc(r.note)+'</div>':'')+'</div>').join('')+
  '<hr><div class=slip-f>'+rows.reduce((s,r)=>s+r.qty,0)+' món · in '+fmtTime(Date.now())+'</div></div>'}
async function printBatch(batch,stations,manual){let html='';
  for(const st of stations){const rows=S.tickets.filter(t=>t.batch===batch&&(st==='bar'?t.station==='bar':t.station!=='bar'));if(!rows.length)continue;
    let count=1;const{data,error}=await sb.rpc('pos_ticket_printed',{p_batch:batch,p_station:st==='bar'?'bar':'kitchen'});
    if(error){if(manual)return alert('Không ghi nhận được lần in: '+error.message)}else count=+data||1;
    rows.forEach(r=>r.printed=count);html+=(html?'<div class=pagebreak></div>':'')+slipHTML(st,rows,{reprint:count>1,count})}
  if(html)printHTML(html)}
const kdsQueue=new Set();let kdsTimer=null;
function queueKdsPrint(t){if(!PRINT.kdsAuto||!(has('kds_kitchen')||has('kds_bar'))||!t.batch)return;const st=kdsStation();if(st&&(st==='bar')!==(t.station==='bar'))return;
  kdsQueue.add(t.batch);clearTimeout(kdsTimer);kdsTimer=setTimeout(async()=>{const bs=[...kdsQueue];kdsQueue.clear();
    for(const b of bs){const{data}=await sb.from('pos_tickets').select('station,print_count').eq('batch_id',b);const done=new Set((data||[]).filter(r=>+r.print_count>0).map(r=>r.station==='bar'?'bar':'kitchen'));
      const stations=(st?[st]:['kitchen','bar']).filter(s=>!done.has(s)&&S.tickets.some(x=>x.batch===b&&(s==='bar')===(x.station==='bar')));if(stations.length)await printBatch(b,stations,false)}},1500)}

// Hóa đơn 80mm
function billHTML(b,o){const st=storeInfo(),temp=o&&o.temp;
  const rows=(b.items||[]).map(i=>'<div class=bl-item><div>'+esc(i.name)+'</div><div class=slip-row><span>'+i.qty+' × '+money(i.price)+'</span><b>'+money(i.qty*i.price)+'</b></div>'+(i.note?'<div class=slip-note>» '+esc(i.note)+'</div>':'')+'</div>').join('');
  const disc=b.subtotal-b.total;
  return'<div class=slip><div class=bl-store>'+esc(st.name)+'</div>'+(st.address?'<div class=bl-c>'+esc(st.address)+'</div>':'')+(st.phone?'<div class=bl-c>ĐT: '+esc(st.phone)+'</div>':'')+
  '<div class=slip-h>'+(temp?'PHIẾU TẠM TÍNH':'HÓA ĐƠN THANH TOÁN')+'</div>'+(temp?'<div class=slip-re>CHƯA THANH TOÁN</div>':'')+(o&&o.count>1?'<div class=slip-re>*** IN LẠI – lần '+o.count+' ***</div>':'')+
  (temp?'':'<div class=slip-row><span>Số HĐ</span><b>#'+esc(b.id)+'</b></div>')+'<div class=slip-row><span>Bàn</span><b>'+pad(b.table)+'</b></div>'+
  '<div class=slip-row><span>'+(temp?'Nhân viên':'Thu ngân')+'</span><span>'+esc(b.user||who())+'</span></div><div class=slip-row><span>Thời gian</span><span>'+fmtDT(b.time||Date.now())+'</span></div>'+(b.guests?'<div class=slip-row><span>Số khách</span><span>'+b.guests+'</span></div>':'')+
  '<hr>'+rows+'<hr><div class=slip-row><span>Tạm tính</span><span>'+money(b.subtotal)+'</span></div>'+(disc>0?'<div class=slip-row><span>Giảm giá ('+b.discount+'%)</span><span>−'+money(disc)+'</span></div>':'')+
  '<div class="slip-row bl-total"><span>TỔNG CỘNG</span><b>'+money(b.total)+'</b></div>'+
  (temp?'':'<div class=slip-row><span>Thanh toán</span><span>'+esc(b.method||'')+'</span></div>'+(b.method==='Kết hợp'?'<div class=slip-row><span>· Tiền mặt</span><span>'+money(b.parts.cash)+'</span></div><div class=slip-row><span>· Chuyển khoản</span><span>'+money(b.parts.qr)+'</span></div>':'')+
   (b.cashGiven?'<div class=slip-row><span>Khách đưa</span><span>'+money(b.cashGiven)+'</span></div><div class=slip-row><span>Trả lại</span><b>'+money(b.change||0)+'</b></div>':'')+(b.cancelled?'<div class=slip-re>ĐÃ HỦY</div>':''))+
  '<hr><div class=bl-c>'+esc(st.footer)+'</div></div>'}
async function printBill(b){const{data,error}=await sb.rpc('pos_bill_printed',{p_bill:b.uid});if(error)return alert('Không ghi nhận được lần in: '+error.message);
  b.printCount=+data||1;printHTML(billHTML(b,{count:b.printCount}))}
function printTempBill(){if(!S.table)return alert('Chọn bàn.');const a=S.orders[S.table]||[];if(!a.length)return alert('Bàn chưa có món.');const t=total();
  printHTML(billHTML({table:S.table,items:a,subtotal:t.sub,discount:t.d,total:t.total,user:who(),time:Date.now()},{temp:true}));
  log('IN TẠM TÍNH','Bàn '+S.table+' · '+money(t.total)+' · '+a.reduce((n,x)=>n+x.qty,0)+' món')}
function paidModal(b){modal('<h2>✓ Thanh toán thành công</h2><div class=notice>Hóa đơn #'+esc(b.id)+' · Bàn '+pad(b.table)+'</div><div class=total>'+money(b.total)+'</div>'+(b.cashGiven?'<p>Khách đưa: <b>'+money(b.cashGiven)+'</b><br>Trả lại khách: <b class=up style="font-size:22px">'+money(b.change||0)+'</b></p>':'')+'<button id=pmPrint class="primary wide">IN HÓA ĐƠN</button><button id=pmClose class=wide style="margin-top:7px">ĐÓNG</button>');
  $('pmPrint').onclick=async()=>{await printBill(b);closeModal()};$('pmClose').onclick=closeModal;if(PRINT.autoBill)printBill(b)}

// ---------- Nhân viên (chỉ OWNER) ----------
async function loadStaff(){if(!has('staff'))return;const{data,error}=await sb.rpc('pos_staff_list');if(error){S.staffErr=error.message;S.staff=[]}else{S.staffErr='';S.staff=data||[]}renderStaff()}
function effPerm(u,k){const ov=u.perms||{};return k in ov?!!ov[k]:!!(ROLE_DEFAULTS[u.role_code]||{})[k]}
function renderStaff(){if(!$('staffList'))return;const L=S.staff||[];
  $('staffList').innerHTML=S.staffErr?'<div class="notice voidnote">'+esc(S.staffErr)+'</div>':L.length?htmlTable(['Nhân viên','Email đăng nhập','Vai trò','Trạng thái','Quyền riêng','Đăng nhập gần nhất',''],L.map(u=>{const ov=Object.entries(u.perms||{}).filter(([k])=>k!=='discount_max').map(([k,v])=>(v?'+':'−')+(PERM_LABELS[k]||k));if(u.perms&&u.perms.discount_max!=null)ov.push('Giảm tối đa '+u.perms.discount_max+'%');
    return['<b>'+esc(u.username)+'</b>'+(u.full_name?'<br><small>'+esc(u.full_name)+'</small>':''),esc(u.email||'—'),esc(ROLE_NAMES[u.role_code]||u.role_code),u.active?'<span class=up>Hoạt động</span>':'<span class=down>Đã khóa</span>',ov.length?'<small>'+esc(ov.join(' · '))+'</small>':'<small class=muted>Mặc định theo vai trò</small>',u.last_sign_in_at?fmtDT(u.last_sign_in_at):'—',u.role_code==='owner'?'<small class=muted>Chủ quán</small>':'<button data-staff="'+esc(u.id)+'">Sửa</button>']})):'<div class=empty>Đang tải…</div>';
  document.querySelectorAll('[data-staff]').forEach(b=>b.onclick=()=>staffForm(L.find(x=>x.id===b.dataset.staff)))}
function staffForm(u){const isNew=!u;u=u||{email:'',username:'',full_name:'',role_code:'waiter',active:true,perms:{}};
  const permBox=()=>'<div class=permgrid>'+Object.keys(PERM_LABELS).map(k=>'<label class=chk><input type=checkbox data-perm="'+k+'"'+(effPerm({role_code:$('sfRole')?$('sfRole').value:u.role_code,perms:u.perms},k)?' checked':'')+'> '+PERM_LABELS[k]+'</label>').join('')+'</div>';
  modal('<h2>'+(isNew?'Thêm nhân viên':'Sửa nhân viên')+'</h2>'+(isNew?'<div class=notice style="font-weight:400">Bước 1: tạo tài khoản đăng nhập trong <b>Supabase → Authentication → Users → Add user</b> (nhập email + mật khẩu, bật <i>Auto confirm</i>).<br>Bước 2: nhập đúng email đó ở đây để gán vai trò.</div>':'')+
   fld('Email đăng nhập','<input id=sfEmail type=email value="'+esc(u.email||'')+'"'+(isNew?'':' readonly')+'>')+fld('Tên hiển thị (ghi trên phiếu, hóa đơn, Audit)','<input id=sfUser value="'+esc(u.username||'')+'">')+fld('Họ tên','<input id=sfName value="'+esc(u.full_name||'')+'">')+
   fld('Vai trò','<select id=sfRole>'+STAFF_ROLES.map(r=>'<option value="'+r+'"'+(r===u.role_code?' selected':'')+'>'+ROLE_NAMES[r]+'</option>').join('')+'</select>')+
   fld('Giảm giá tối đa (%) – để trống = theo vai trò','<input id=sfDisc type=number min=0 max=100 value="'+(u.perms&&u.perms.discount_max!=null?u.perms.discount_max:'')+'">')+
   '<h3>Quyền <small class=muted>(đã chọn sẵn theo vai trò, có thể thêm/bớt)</small></h3><div id=sfPerms>'+permBox()+'</div>'+tog('sfLock','Khóa tài khoản (không cho đăng nhập POS)',!u.active)+
   '<button id=sfSave class="primary wide">LƯU</button><button id=sfCancel class=wide style="margin-top:7px">ĐÓNG</button>');
  $('sfRole').onchange=()=>{u={...u,perms:{}};$('sfPerms').innerHTML=permBox()};$('sfCancel').onclick=closeModal;
  $('sfSave').onclick=async()=>{const role=$('sfRole').value,def=ROLE_DEFAULTS[role]||{},perms={};
    document.querySelectorAll('[data-perm]').forEach(c=>{const k=c.dataset.perm;if(!!def[k]!==c.checked)perms[k]=c.checked});
    if($('sfDisc').value!=='')perms.discount_max=Math.max(0,Math.min(100,num($('sfDisc').value)));
    const email=$('sfEmail').value.trim(),user=$('sfUser').value.trim();if(!email||!user)return alert('Nhập email và tên hiển thị.');
    $('sfSave').disabled=true;const{error}=await sb.rpc('pos_staff_save',{p_email:email,p_username:user,p_full_name:$('sfName').value.trim()||null,p_role:role,p_active:!$('sfLock').checked,p_perms:perms});
    if(error){$('sfSave').disabled=false;return alert(error.message)}closeModal();toast('✓ Đã lưu nhân viên '+user);loadStaff()}}
function addStaff(){staffForm(null)}

// ---------- Thông tin in hóa đơn (OWNER) ----------
function storeForm(){if(!has('settings'))return alert('Chỉ OWNER được sửa.');const s=storeInfo();
  modal('<h2>Thông tin in hóa đơn</h2>'+fld('Tên quán','<input id=stName value="'+esc(s.name)+'">')+fld('Địa chỉ','<input id=stAddr value="'+esc(s.address)+'">')+fld('Điện thoại','<input id=stPhone value="'+esc(s.phone)+'">')+fld('Lời chào cuối hóa đơn','<input id=stFoot value="'+esc(s.footer)+'">')+'<button id=stSave class="primary wide">LƯU</button><button id=stClose class=wide style="margin-top:7px">ĐÓNG</button>');
  $('stClose').onclick=closeModal;$('stSave').onclick=async()=>{const v={name:$('stName').value.trim()||'MÂY ƠI SAPA',address:$('stAddr').value.trim(),phone:$('stPhone').value.trim(),footer:$('stFoot').value.trim()};
    const{error}=await sb.from('pos_settings').upsert({key:'store',value:v,updated_by:who(),updated_at:new Date().toISOString()});if(error)return alert('Chưa lưu được: '+error.message);S.store=v;closeModal();render();toast('✓ Đã lưu thông tin in hóa đơn')}}

// ---------- Nhập dữ liệu thật (CSV / Excel / dán từ Excel) ----------
const normKey=s=>asciiOnly(s).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
const IMP_COLS={ingredients:{code:['ma','ma_nl','ma_nguyen_lieu','code'],name:['ten','ten_nl','ten_nguyen_lieu','name'],unit:['dvt','don_vi','don_vi_tinh','unit'],cost:['gia_von','gia_nhap','don_gia','gia','cost'],min:['ton_toi_thieu','toi_thieu','muc_toi_thieu','min'],kho:['ton_kho_tong','ton_kho','kho_tong','ton_dau_kho'],bep:['ton_bep','bep'],bar:['ton_bar','bar']},
  recipes:{menu:['ma_mon','ma_mon_an','menu_code'],ing:['ma_nguyen_lieu','ma_nl','nguyen_lieu','ingredient_code'],qty:['so_luong','dinh_luong','sl','qty','luong']}};
const IMP_TEMPLATES={ingredients:'ma,ten,dvt,gia_von,ton_toi_thieu,ton_kho_tong,ton_bep,ton_bar',recipes:'ma_mon,ten_mon,ma_nguyen_lieu,so_luong'};
function parseNumVN(v){let s=String(v??'').trim().replace(/\s|đ|vnd/gi,'');if(s==='')return null;
  if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
  else if(s.includes(','))s=/^\d{1,3}(,\d{3})+$/.test(s)?s.replace(/,/g,''):s.replace(',','.');
  else if(/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
  const n=Number(s);return isFinite(n)?n:NaN}
function parseDelimited(text){text=String(text||'').replace(/^﻿/,'').replace(/\r\n?/g,'\n');const first=text.split('\n')[0]||'';
  const d=first.includes('\t')?'\t':(first.split(';').length>first.split(',').length?';':',');const rows=[];let row=[],cell='',q=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else q=false}else cell+=c}
    else if(c==='"')q=true;else if(c===d){row.push(cell);cell=''}else if(c==='\n'){row.push(cell);rows.push(row);row=[];cell=''}else cell+=c}
  if(cell!==''||row.length){row.push(cell);rows.push(row)}return rows.filter(r=>r.some(x=>String(x).trim()!==''))}
let IMP=null;
function impAnalyze(){const kind=$('impKind').value,rows=parseDelimited($('impText').value);IMP=null;
  if(rows.length<2){$('impPreview').innerHTML='<div class="notice voidnote">Chưa có dữ liệu. Dán bảng (có dòng tiêu đề) hoặc chọn file.</div>';$('impCommit').disabled=true;return}
  const head=rows[0].map(normKey),map={};Object.entries(IMP_COLS[kind]).forEach(([k,al])=>{const i=head.findIndex(h=>al.includes(h));if(i>=0)map[k]=i});
  const need=kind==='ingredients'?['code']:['menu','ing','qty'];const miss=need.filter(k=>!(k in map));
  if(miss.length){$('impPreview').innerHTML='<div class="notice voidnote">Thiếu cột: '+miss.map(k=>IMP_COLS[kind][k][0]).join(', ')+'. Tải file mẫu để xem đúng tên cột.</div>';$('impCommit').disabled=true;return}
  const get=(r,k)=>k in map?String(r[map[k]]??'').trim():'';const out=[];const seen=new Set();
  rows.slice(1).forEach((r,ix)=>{const e=[];let it;
    if(kind==='ingredients'){const code=get(r,'code'),ex=S.ings.find(i=>i.code.toLowerCase()===code.toLowerCase());
      it={line:ix+2,code,name:get(r,'name'),unit:get(r,'unit'),cost:parseNumVN(get(r,'cost')),min:parseNumVN(get(r,'min')),kho:parseNumVN(get(r,'kho')),bep:parseNumVN(get(r,'bep')),bar:parseNumVN(get(r,'bar')),exist:ex};
      if(!code)e.push('thiếu mã');if(seen.has(code.toLowerCase()))e.push('trùng mã trong file');seen.add(code.toLowerCase());
      if(!ex&&!it.name)e.push('nguyên liệu mới cần tên');if(!ex&&!it.unit)e.push('nguyên liệu mới cần ĐVT');
      ['cost','min','kho','bep','bar'].forEach(k=>{if(Number.isNaN(it[k])||(it[k]!=null&&it[k]<0))e.push(k+' không hợp lệ')});
      it.action=ex?'Cập nhật':'Thêm mới'}
    else{const mc=get(r,'menu'),ic=get(r,'ing'),m=S.menu.find(x=>String(x.code).toLowerCase()===mc.toLowerCase()),g=S.ings.find(x=>x.code.toLowerCase()===ic.toLowerCase());
      it={line:ix+2,menuCode:mc,ingCode:ic,qty:parseNumVN(get(r,'qty')),menu:m,ing:g};
      if(!mc&&!ic&&get(r,'qty')===''){return}
      if(!m)e.push('không có món mã "'+mc+'" trong thực đơn');if(!g)e.push('chưa có nguyên liệu mã "'+ic+'" (nhập nguyên liệu trước)');
      if(!(it.qty>0))e.push('số lượng phải > 0');const key=(mc+'|'+ic).toLowerCase();if(seen.has(key))e.push('trùng dòng món–nguyên liệu');seen.add(key);it.action='Định lượng'}
    it.err=e;out.push(it)});
  const bad=out.filter(x=>x.err.length);IMP={kind,rows:out};
  const head2=kind==='ingredients'?['Dòng','Mã','Tên','ĐVT','Giá vốn','Tối thiểu','Tồn đầu (Kho/Bếp/Bar)','Thao tác','Kiểm tra']:['Dòng','Mã món','Món','Nguyên liệu','Số lượng','Kiểm tra'];
  $('impPreview').innerHTML='<div class="notice'+(bad.length?' voidnote':'')+'">'+out.length+' dòng · '+(out.length-bad.length)+' hợp lệ · '+bad.length+' lỗi'+(bad.length?' – sửa lỗi rồi kiểm tra lại (không ghi khi còn lỗi).':' – sẵn sàng ghi vào hệ thống.')+'</div>'+
    htmlTable(head2,out.slice(0,300).map(x=>kind==='ingredients'?[x.line,esc(x.code),esc(x.name||(x.exist?x.exist.name:'')),esc(x.unit||(x.exist?x.exist.unit:'')),x.cost==null?'—':money(x.cost),x.min==null?'—':fmtQ(x.min),[x.kho,x.bep,x.bar].map(v=>v==null?'—':fmtQ(v)).join(' / '),x.action,x.err.length?'<b class=down>'+esc(x.err.join('; '))+'</b>':'<span class=up>OK</span>']:
      [x.line,esc(x.menuCode),esc(x.menu?x.menu.name:''),esc(x.ing?x.ing.name+' ('+x.ing.unit+')':x.ingCode),x.qty==null?'—':fmtQ(x.qty),x.err.length?'<b class=down>'+esc(x.err.join('; '))+'</b>':'<span class=up>OK</span>']));
  $('impCommit').disabled=!!bad.length||!out.length}
async function impCommit(){if(!IMP||IMP.rows.some(x=>x.err.length))return;const btn=$('impCommit');btn.disabled=true;let done=0,fails=[];
  if(IMP.kind==='ingredients'){if(!(has('stock')||has('import')))return alert('Không có quyền nhập nguyên liệu.');
    for(const x of IMP.rows){const row={updated_at:new Date().toISOString()};if(x.name)row.name=x.name;if(x.unit)row.unit=x.unit;if(x.cost!=null)row.cost=x.cost;if(x.min!=null)row.min_qty=x.min;
      const{error}=x.exist?await sb.from('pos_ingredients').update(row).eq('id',x.exist.id):await sb.from('pos_ingredients').insert({code:x.code,name:x.name,unit:x.unit,cost:x.cost||0,min_qty:x.min||0});
      if(error)fails.push('Dòng '+x.line+': '+error.message);else done++}
    await loadExtras(['ings']);
    for(const x of IMP.rows){const g=S.ings.find(i=>i.code.toLowerCase()===x.code.toLowerCase());if(!g)continue;
      for(const [k,loc] of [['kho','KHO'],['bep','BEP'],['bar','BAR']])if(x[k]!=null){const{error}=await sb.rpc('pos_stock_post',{p_type:'KIỂM KÊ',p_ing:g.id,p_loc:loc,p_qty:x[k],p_to:null,p_cost:null,p_note:'Tồn đầu kỳ (import)'});if(error)fails.push('Tồn '+x.code+'/'+loc+': '+error.message)}}
    log('IMPORT NGUYÊN LIỆU',done+' dòng ('+IMP.rows.filter(x=>!x.exist).length+' mới, '+IMP.rows.filter(x=>x.exist).length+' cập nhật)'+(fails.length?' · lỗi '+fails.length:''),false);
    await loadExtras(['ings','stock','moves'])}
  else{if(!(has('recipes')||has('import')))return alert('Không có quyền nhập định lượng.');const byMenu={};IMP.rows.forEach(x=>(byMenu[x.menu.id]??=[]).push(x));
    for(const [mid,list] of Object.entries(byMenu)){const{error}=await sb.from('pos_recipes').upsert(list.map(x=>({menu_item_id:Number(mid),ingredient_id:Number(x.ing.id),qty:x.qty})));
      if(error){fails.push('Món '+list[0].menuCode+': '+error.message);continue}
      if($('impReplace').checked){const keep=list.map(x=>String(x.ing.id)),del=(S.rec[mid]||[]).map(r=>String(r.ing)).filter(i=>!keep.includes(i));
        if(del.length){const r2=await sb.from('pos_recipes').delete().eq('menu_item_id',Number(mid)).in('ingredient_id',del.map(Number));if(r2.error)fails.push('Món '+list[0].menuCode+' (bỏ dòng cũ): '+r2.error.message)}}
      done+=list.length}
    await loadExtras(['rec']);if(has('menu'))for(const mid of Object.keys(byMenu)){const c=recipeCost(mid);if(c>0)await sb.from('menu_items').update({cost:Math.round(c)}).eq('id',Number(mid))}
    log('IMPORT ĐỊNH LƯỢNG',done+' dòng cho '+Object.keys(byMenu).length+' món'+($('impReplace').checked?' (thay toàn bộ định lượng các món này)':'')+(fails.length?' · lỗi '+fails.length:''),false);await loadMenuMapped()}
  render();$('impPreview').innerHTML='<div class="notice'+(fails.length?' voidnote':'')+'">Đã ghi '+done+' dòng.'+(fails.length?'<br>Lỗi:<br>'+fails.map(esc).join('<br>'):'')+'</div>';btn.disabled=true;IMP=null;toast('✓ Đã nhập '+done+' dòng')}
function downloadText(name,text){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+text],{type:'text/csv;charset=utf-8'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function impTemplate(){const k=$('impKind').value;downloadText(k==='ingredients'?'MAU_NGUYEN_LIEU.csv':'MAU_DINH_LUONG.csv',IMP_TEMPLATES[k]+'\r\n')}
function impMenuList(){const csvq=v=>'"'+String(v??'').replace(/"/g,'""')+'"';downloadText('DANH_SACH_MON_'+today()+'.csv',IMP_TEMPLATES.recipes+'\r\n'+S.menu.filter(m=>m.active).map(m=>[csvq(m.code),csvq(m.name),'',''].join(',')).join('\r\n')+'\r\n')}
function loadScript(src){return new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(new Error('Không tải được thư viện đọc Excel'));document.head.appendChild(s)})}
async function impFile(){const f=$('impFile').files[0];if(!f)return;try{if(/\.(xlsx|xls)$/i.test(f.name)){if(!window.XLSX)await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
      const wb=XLSX.read(await f.arrayBuffer(),{type:'array'});$('impText').value=XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]],{FS:'\t'})}else $('impText').value=await f.text();impAnalyze()}catch(e){alert(e.message)}}
function renderStoreInfo(){if(!$('storeInfo'))return;const s=storeInfo();$('storeInfo').innerHTML='<b>'+esc(s.name)+'</b>'+(s.address?'<br>'+esc(s.address):'')+(s.phone?'<br>ĐT: '+esc(s.phone):'')+'<br><small class=muted>'+esc(s.footer)+'</small>';const b=$('storeEdit');if(b)b.style.display=has('settings')?'':'none';const k=$('impBox');if(k)k.style.display=has('import')?'':'none'}

async function login() {
  const email = $('loginEmail').value.trim();
  const password = $('loginPin').value;
  const errorBox = $('loginError');
  errorBox.textContent = '';
 
  if (!email || !password) {
    errorBox.textContent = 'Nhập email và mật khẩu.';
    return;
  }
 
  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password
  });
 
  if (error) {
      errorBox.textContent = 'Lỗi: ' + error.message;
    return;
}
 
  await loadUser(data.user);
}
 
async function loadUser(user) {
  const { data, error } = await sb
    .from('users')
    .select('username, role_code, active')
    .eq('auth_user_id', user.id)
    .single();
 
  if (error || !data || !data.active || !roles[data.role_code]) {
    await sb.auth.signOut();
    $('loginError').textContent =
      'Tài khoản chưa được cấp quyền sử dụng POS.';
    return;
  }
 
await loadPerms(data.role_code);
await loadMenuMapped();
  S.user = data.role_code;
  S.username = data.username || '';
  await loadLive();
  startLive();
  $('login').classList.add('hide');
  nav();
  show(roles[S.user].pages[0]);
  render();
}
 
async function logout() {
  stopLive();
  P = {};
  await sb.auth.signOut();
  S.username = null;
  S.user = null;
  $('login').classList.remove('hide');
  $('loginPin').value = '';
  $('loginError').textContent = '';
  $('nav').innerHTML = '';
}
 
$('loginBtn').onclick = login;
$('loginPin').addEventListener('keydown', e => {
  if (e.key === 'Enter') login();
});
$('searchMenu').oninput = e => { search = e.target.value.trim().toLowerCase(); renderSale(); };
 
// Gắn sự kiện cho các nút (trước đây bị thiếu nên bấm không có tác dụng)
const actions = {
  send: sendOrder, discount: doDiscount, voidItem: voidItem, splitBill: splitBill,
  markPay: markWaiting, pay: pay, moveTable: moveTable, mergeTable: mergeTable,
  openShift: openShift, closeShift: closeShift, addIngredient: addIngredient,
  postStock: postStock, addMenu: addMenu, setBank: setBank,
  exportData: exportData, restoreData: restoreData, resetDemo: resetDemo
};
Object.assign(actions,{exportReport,postCash,addResv,printTemp:printTempBill,addStaff,reloadStaff:loadStaff,storeEdit:storeForm,deviceBtn:deviceForm,impCheck:impAnalyze,impCommit,impTemplate,impMenuList});
{const f=$('impFile');if(f)f.onchange=impFile;const k=$('impKind');if(k)k.onchange=()=>{$('impReplaceWrap').style.display=k.value==='recipes'?'':'none';impAnalyze()}}
['stockType','stockSearch','moveFilter'].forEach(id=>{const e=$(id);if(e)e.oninput=e.onchange=renderStock});
['recipeSearch'].forEach(id=>{const e=$(id);if(e)e.oninput=renderRecipes});
['auditSearch'].forEach(id=>{const e=$(id);if(e)e.oninput=renderAudit});
['resvRange'].forEach(id=>{const e=$(id);if(e)e.onchange=renderBooking});
['actualCash'].forEach(id=>{const e=$(id);if(e)e.oninput=renderShift});
['billRange','billSearch'].forEach(id=>{const e=$(id);if(e)e.oninput=e.onchange=renderBills});
['reportType','reportRange'].forEach(id=>{const e=$(id);if(e)e.onchange=renderReports});
['menuSearch','menuMarketOnly'].forEach(id=>{const e=$(id);if(e)e.oninput=e.onchange=renderMenuAdmin});
Object.entries(actions).forEach(([id, fn]) => { const el = $(id); if (el) el.onclick = fn; });
 
(async function init() {
  const { data } = await sb.auth.getUser();
  if (data.user) {
    await loadUser(data.user);
  }
})();
})();
 
