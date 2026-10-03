(()=>{'use strict';
const SUPABASE_URL = 'https://eznqzduljevrtwdlaxqk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_KiYRfW2jD10Kdlzak5a98Q_YSt8-D0h';
 
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
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
const roles={owner:{name:'OWNER',pages:['sale','overview','bills','reports','kds','shift','stock','recipes','menuadmin','dashboard','risk','audit','backup'],disc:100,pay:1,approve:1,bank:1},manager:{name:'QUẢN LÝ',pages:['sale','overview','bills','reports','kds','shift','stock','recipes','dashboard','risk','audit'],disc:20,pay:1,approve:1},cashier:{name:'THU NGÂN',pages:['sale','bills','shift','dashboard'],disc:5,pay:1},waiter:{name:'PHỤC VỤ',pages:['sale'],disc:0},kitchen:{name:'BẾP',pages:['kds']},bar:{name:'BAR',pages:['kds']},stock:{name:'KHO/KẾ TOÁN',pages:['stock','recipes','dashboard','audit']}};
const seedMenu=[
['CF01','Americano','Americano','CÀ PHÊ',75000,'bar'],['CF02','Cappuccino','Cappuccino','CÀ PHÊ',85000,'bar'],['TE01','Trà đào Mây','May Peach Tea','TRÀ',85000,'bar'],['SG01','Mây Signature Coffee','May Signature Coffee','SIGNATURE',95000,'bar'],
['AP01','Spring Rolls','Spring Rolls','KHAI VỊ',120000,'kitchen'],['SO01','Súp cá hồi','Salmon Soup','SÚP',150000,'kitchen'],['PA01','Mì Ý bò băm','Beef Bolognese','MÌ Ý',220000,'kitchen'],['PZ01','Beef Pizza','Beef Pizza','PIZZA',280000,'kitchen'],['BG01','Beef Burger','Beef Burger','BURGER',220000,'kitchen'],['MC01','Salmon Steak','Salmon Steak','CÁ HỒI',350000,'kitchen'],['MC02','Sturgeon Hotpot','Sturgeon Hotpot','CÁ TẦM',650000,'kitchen']
].map((x,i)=>({id:i+1,code:x[0],name:x[1],en:x[2],cat:x[3],price:x[4],station:x[5],active:true}));
const seedIng=[['SALMON','Cá hồi','g',250,5000],['POTATO','Khoai tây','g',30,5000],['SAUCE','Sốt nền','g',80,3000],['VEG','Rau','g',40,3000],['COFFEE','Hạt cà phê','g',450,3000],['MILK','Sữa','ml',35,10000]].map((x,i)=>({id:i+1,code:x[0],name:x[1],unit:x[2],cost:x[3],qty:x[4],actual:x[4]}));
const defaultState=()=>({version:1,user:null,table:null,tableStatus:{},orders:{},menu:seedMenu,ingredients:seedIng,recipes:{10:[{ing:1,qty:200},{ing:2,qty:150},{ing:3,qty:50},{ing:4,qty:50}],1:[{ing:5,qty:18}]},tickets:[],payments:[],bills:[],discounts:{},bank:'Chưa cấu hình',audit:[],risks:[],stockMoves:[],shift:null,closedShifts:[],billSeq:1});
let S;try{S=JSON.parse(localStorage.getItem('MAY_POS_V3'))}catch(e){};if(!S||!S.menu)S=defaultState();let cat='TẤT CẢ',search='';
const save=()=>localStorage.setItem('MAY_POS_V3',JSON.stringify(S));
function log(action,detail,risk=false){const x={id:Date.now()+Math.random(),time:now(),user:S.user||'SYSTEM',action,detail};S.audit.unshift(x);if(risk)S.risks.unshift(x);save()}
function toast(t){const e=$('toast');e.textContent=t;e.style.display='block';setTimeout(()=>e.style.display='none',1100)}
function modal(html){$('modalBody').innerHTML=html;$('modal').classList.add('show')}
function closeModal(){$('modal').classList.remove('show')}
$('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal()});
function total(table=S.table){const a=S.orders[table]||[],sub=a.reduce((s,x)=>s+x.price*x.qty,0),d=S.discounts[table]||0;return{sub,d,total:sub*(1-d/100)}}
function nav(){const r=roles[S.user];$('nav').innerHTML='';if(!r)return;r.pages.forEach((p,i)=>{let b=document.createElement('button');b.dataset.page=p;b.textContent={sale:'Bán hàng',overview:'Tổng quan',bills:'Hóa đơn',reports:'Báo cáo',kds:S.user==='bar'?'Bar':S.user==='kitchen'?'Bếp':'Bếp/Bar',shift:'Ca & tiền',stock:'Kho',recipes:'Công thức',menuadmin:'Menu',dashboard:'Dashboard',risk:'Kiểm soát',audit:'Audit Log',backup:'Sao lưu'}[p];if(i===0)b.className='navon';b.onclick=()=>show(p,b);$('nav').appendChild(b)});let o=document.createElement('button');o.textContent='Đăng xuất';o.onclick=logout;$('nav').appendChild(o)}
function show(p,b){document.querySelectorAll('.page').forEach(x=>x.classList.remove('on'));$(p).classList.add('on');document.querySelectorAll('nav button').forEach(x=>x.classList.remove('navon'));if(b)b.classList.add('navon');render()}
function render(){if(!S.user)return;$('userName').innerHTML=esc(roles[S.user].name)+(S.username?' · '+esc(S.username):'')+' <span id=liveDot class=live></span>';setLiveBadge();renderSale();renderKDS();renderShift();renderStock();renderRecipes();renderMenuAdmin();renderDashboard();renderRisk();renderAudit();renderOverview();renderBills();renderReports();save()}
function renderSale(){
 $('tables').innerHTML='';for(let i=1;i<=20;i++){let a=S.orders[i]||[],st=S.tableStatus[i]||'',b=document.createElement('button');b.className='table'+(S.table===i?' selected':'')+(a.length?' busy':'')+(st==='waiting'?' waiting':'');b.innerHTML='<b>Bàn '+String(i).padStart(2,'0')+'</b><br>'+(st==='waiting'?'CHỜ THANH TOÁN':a.length?'ĐANG PHỤC VỤ':'TRỐNG');b.onclick=()=>{S.table=i;S.orders[i]??=[];save();renderSale()};$('tables').appendChild(b)}
 let cats=['TẤT CẢ',...new Set(S.menu.filter(x=>x.active&&!x.hidden).map(x=>x.cat))];$('cats').innerHTML='';cats.forEach(c=>{let b=document.createElement('button');b.className='cat'+(cat===c?' on':'');b.textContent=c;b.onclick=()=>{cat=c;renderSale()};$('cats').appendChild(b)});
 let ms=S.menu.filter(x=>x.active&&!x.hidden&&(cat==='TẤT CẢ'||x.cat===cat)&&(!search||x.name.toLowerCase().includes(search)||(x.en||'').toLowerCase().includes(search)||String(x.code||'').toLowerCase().includes(search)));$('products').innerHTML='';ms.forEach(p=>{let b=document.createElement('button');b.className='product';b.innerHTML='<b>'+(p.signature?'★ ':'')+esc(p.name)+'</b><br>'+(p.marketPrice?'Thời giá':money(p.price))+(p.unit?'<small>/'+esc(p.unit)+'</small>':'');b.onclick=()=>addItem(p.id);$('products').appendChild(b)});
 const a=S.orders[S.table]||[];$('billHead').textContent=S.table?'BÀN '+String(S.table).padStart(2,'0')+' · '+a.reduce((n,x)=>n+x.qty,0)+' MÓN':'CHƯA CHỌN BÀN';$('order').innerHTML=a.length?'':'<div class=empty>Bấm món bên trái → món sẽ hiện tại đây ngay.</div>';
 a.forEach(x=>{let d=document.createElement('div');d.className='item';d.innerHTML='<div><div class=itemname>'+x.name+'</div><small>'+money(x.price)+' × '+x.qty+' = '+money(x.price*x.qty)+'</small><br><small>'+(x.note?'Ghi chú: '+x.note:'')+'</small></div><div class=qty><button data-q="'+x.id+'" data-d="-1">−</button><b>'+x.qty+'</b><button data-q="'+x.id+'" data-d="1">+</button><button data-note="'+x.id+'">✎</button></div>';$('order').appendChild(d)});
 document.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>changeQty(b.dataset.q,+b.dataset.d));document.querySelectorAll('[data-note]').forEach(b=>b.onclick=()=>noteItem(b.dataset.note));
 let t=total();$('billSummary').innerHTML=t.d?'<p>Tạm tính: '+money(t.sub)+'<br>Giảm: '+t.d+'%</p>':'';$('total').textContent=money(t.total)
}
function addItem(id){if(!S.table)return alert('Hãy chọn bàn trước.');if(['kitchen','bar','stock'].includes(S.user))return alert('Tài khoản này không có quyền order.');let p=S.menu.find(x=>x.id===id);if(!p)return;let price=p.price;if(p.marketPrice){const v=prompt('Món theo thời giá – nhập giá bán cho '+p.name+(p.unit?' (/'+p.unit+')':''),p.price||'');if(v===null)return;price=Number(String(v).replace(/[^\d]/g,''));if(!price)return alert('Giá không hợp lệ.')}let a=S.orders[S.table]??=[];let x=a.find(q=>q.id===id&&q.price===price&&!q.note);if(x)x.qty++;else a.push({id:p.id,name:p.name,price,station:p.station,unit:p.unit||'',qty:1,sent:0,note:''});S.tableStatus[S.table]='busy';log('THÊM MÓN','Bàn '+S.table+': '+p.name);pushTable(S.table);renderSale();toast('✓ '+p.name+' đã vào hóa đơn')}
function changeQty(id,d){let a=S.orders[S.table]||[],x=a.find(q=>String(q.id)===String(id));if(!x)return;if(d<0&&x.sent>=x.qty)return alert('Món đã gửi Bếp/Bar. Muốn hủy phải dùng HỦY MÓN.');x.qty+=d;if(x.qty<=0)a.splice(a.indexOf(x),1);log('ĐỔI SỐ LƯỢNG','Bàn '+S.table+', món '+id+', '+d);pushTable(S.table);renderSale()}
function noteItem(id){let x=(S.orders[S.table]||[]).find(q=>String(q.id)===String(id));if(!x)return;let n=prompt('Ghi chú món',x.note||'');if(n!==null){x.note=n;log('GHI CHÚ MÓN','Bàn '+S.table+': '+x.name+' | '+n);pushTable(S.table);renderSale()}}
function sendOrder(){if(!S.table)return alert('Chọn bàn.');const rows=[];(S.orders[S.table]||[]).forEach(x=>{let delta=x.qty-(x.sent||0);if(delta>0){const id=uid(),created=Date.now();S.tickets.push({id,table:S.table,itemId:x.id,item:x.name,qty:delta,note:x.note,station:x.station,status:'MỚI',created,by:who()});rows.push({id,table_no:S.table,item_id:String(x.id),item:x.name,qty:delta,note:x.note||'',station:x.station||'',status:'MỚI',created_by:who(),created_at:new Date(created).toISOString()});x.sent=x.qty}});if(!rows.length)return alert('Không có món mới để gửi.');log('GỬI BẾP/BAR','Bàn '+S.table+': '+rows.length+' dòng món');save();render();toast('Đã gửi Bếp/Bar');sb.from('pos_tickets').insert(rows).then(({error})=>{if(error)syncFail('vé bếp',error)});pushTable(S.table)}
function renderKDS(){let station=S.user==='bar'?'bar':S.user==='kitchen'?'kitchen':null;$('kdsTitle').textContent=station==='bar'?'BAR DISPLAY':station==='kitchen'?'KITCHEN DISPLAY':'BẾP / BAR';let ts=S.tickets.filter(t=>t.status!=='ĐÃ PHỤC VỤ'&&(!station||t.station===station));$('tickets').innerHTML=ts.length?'':'<div class=empty>Chưa có món.</div>';ts.forEach(t=>{let d=document.createElement('div');d.className='ticket '+(t.status==='MỚI'?'new':t.status==='HOÀN THÀNH'?'done':'');let mins=Math.floor((Date.now()-t.created)/60000);d.innerHTML='<h3>Bàn '+String(t.table).padStart(2,'0')+'</h3><b>'+t.qty+' × '+t.item+'</b><p>'+(t.note||'')+'</p><p><span class=badge>'+t.status+'</span> · '+mins+' phút</p><button data-ticket="'+t.id+'" class=primary>CẬP NHẬT</button>';$('tickets').appendChild(d)});document.querySelectorAll('[data-ticket]').forEach(b=>b.onclick=()=>advanceTicket(b.dataset.ticket))}
function advanceTicket(id){let t=S.tickets.find(x=>String(x.id)===String(id)),flow=['MỚI','ĐANG LÀM','HOÀN THÀNH','ĐÃ PHỤC VỤ'];if(!t)return;t.status=flow[Math.min(flow.indexOf(t.status)+1,3)];const nowIso=new Date().toISOString(),patch={status:t.status,updated_at:nowIso};if(t.status==='HOÀN THÀNH'){t.done=Date.now();patch.done_at=nowIso}if(t.status==='ĐÃ PHỤC VỤ'){t.served=Date.now();patch.served_at=nowIso;if(!t.done){t.done=t.served;patch.done_at=nowIso}}log('TRẠNG THÁI MÓN','Bàn '+t.table+': '+t.item+' → '+t.status);save();renderKDS();sb.from('pos_tickets').update(patch).eq('id',t.id).then(({error})=>{if(error)syncFail('trạng thái món',error)})}
function doDiscount(){if(!S.table)return alert('Chọn bàn.');let max=roles[S.user].disc||0;if(!max)return alert('Không có quyền giảm giá.');let d=Number(prompt('Nhập % giảm. Tối đa '+max+'%'));if(!d)return;if(d>max){log('TỪ CHỐI GIẢM GIÁ','Yêu cầu '+d+'%',true);return alert('Vượt quyền.')}S.discounts[S.table]=d;log('GIẢM GIÁ','Bàn '+S.table+': '+d+'%',true);pushTable(S.table);renderSale()}
function voidItem(){if(!roles[S.user].approve)return alert('Cần Quản lý/OWNER duyệt.');let a=S.orders[S.table]||[];if(!a.length)return alert('Không có món.');let i=Number(prompt(a.map((x,i)=>(i+1)+'. '+x.name+' × '+x.qty).join('\n')+'\nNhập số thứ tự món:'))-1;if(i<0||i>=a.length)return;let why=prompt('Lý do hủy (bắt buộc):');if(!why)return alert('Bắt buộc có lý do.');let x=a[i],waste=(x.sent||0)>0;restoreOrWaste(x,waste);a.splice(i,1);log('HỦY MÓN','Bàn '+S.table+': '+x.name+' | '+why+' | '+(waste?'ĐÃ CHẾ BIẾN/HAO HỤT':'CHƯA CHẾ BIẾN'),true);pushTable(S.table);render()}
function restoreOrWaste(item,waste){if(!item.sent)return;let rec=S.recipes[item.id]||[];if(!waste)rec.forEach(r=>{let ing=S.ingredients.find(i=>i.id===r.ing);if(ing)ing.qty+=r.qty*item.sent})}
function markWaiting(){if(!S.table)return alert('Chọn bàn.');S.tableStatus[S.table]='waiting';log('CHỜ THANH TOÁN','Bàn '+S.table);pushTable(S.table);renderSale()}
function pay(){if(!roles[S.user].pay)return alert('Không có quyền thanh toán.');let t=total();if(!S.table||!t.total)return alert('Không có hóa đơn.');modal('<h2>Thanh toán · Bàn '+S.table+'</h2><p>Tạm tính: <b>'+money(t.sub)+'</b><br>Giảm: <b>'+t.d+'%</b></p><div class=total>'+money(t.total)+'</div><select id=pm><option>Tiền mặt</option><option>QR/Chuyển khoản</option><option>Thẻ</option><option>Kết hợp</option></select><input id=guests type=number min=0 placeholder="Số khách"><input id=cashGiven type=number placeholder="Khách đưa (tiền mặt)"><input id=splitCash type=number placeholder="Nếu kết hợp: tiền mặt"><input id=splitQR type=number placeholder="Nếu kết hợp: QR"><button id=confirmPay class="primary wide">XÁC NHẬN</button><button id=printBill class="wide">IN BILL 80MM</button>');$('confirmPay').onclick=confirmPay;$('printBill').onclick=()=>window.print()}
async function confirmPay(){let t=total(),m=$('pm').value;if(m.includes('QR')&&S.bank==='Chưa cấu hình')return alert('OWNER chưa cấu hình tài khoản nhận tiền.');let parts={};if(m==='Kết hợp'){parts.cash=+$('splitCash').value||0;parts.qr=+$('splitQR').value||0;if(Math.abs(parts.cash+parts.qr-t.total)>1)return alert('Tổng tiền kết hợp chưa bằng số phải thanh toán.')}else parts[m]=t.total;let given=+$('cashGiven').value||0;if(m==='Tiền mặt'&&given&&given<t.total)return alert('Tiền khách đưa chưa đủ.');const btn=$('confirmPay');btn.disabled=true;btn.textContent='ĐANG LƯU...';const table=S.table,items=JSON.parse(JSON.stringify(S.orders[table]||[]));const{data,error}=await sb.from('pos_bills').insert({id:uid(),table_no:table,items,subtotal:t.sub,discount:t.d,total:t.total,method:m,parts,guests:+$('guests').value||0,created_by:who()}).select().single();if(error){btn.disabled=false;btn.textContent='XÁC NHẬN';syncFail('hóa đơn',error);return alert('Chưa lưu được hóa đơn lên hệ thống. Kiểm tra mạng rồi bấm XÁC NHẬN lại.\n('+error.message+')')}applyBillRow(data);S.bills.sort(byTime);rebuildPayments();deductInventory(items);log('THANH TOÁN','Bill #'+data.bill_no+' · Bàn '+table+' · '+money(t.total)+' · '+m+(given>t.total?' · Trả lại '+money(given-t.total):''));S.orders[table]=[];delete S.discounts[table];delete S.tableStatus[table];pushTable(table);closeModal();render();toast('✓ Thanh toán thành công'+(given>t.total?' · Trả lại '+money(given-t.total):''))}
function deductInventory(items){items.forEach(it=>(S.recipes[it.id]||[]).forEach(r=>{let ing=S.ingredients.find(x=>x.id===r.ing);if(ing){ing.qty-=r.qty*it.qty;S.stockMoves.unshift({time:now(),type:'BÁN HÀNG',ingredient:ing.name,qty:-(r.qty*it.qty),note:it.name})}}))}
function moveTable(){if(!S.table)return alert('Chọn bàn nguồn.');let to=Number(prompt('Chuyển Bàn '+S.table+' sang bàn số:'));if(!to||to<1||to>20||to===S.table)return;if((S.orders[to]||[]).length)return alert('Bàn đích đang có order.');S.orders[to]=S.orders[S.table]||[];S.orders[S.table]=[];S.tableStatus[to]=S.tableStatus[S.table];delete S.tableStatus[S.table];log('CHUYỂN BÀN','Bàn '+S.table+' → '+to);pushTable(S.table);pushTable(to);S.table=to;render()}
function mergeTable(){if(!S.table)return alert('Chọn bàn đích.');let from=Number(prompt('Gộp bàn số nào vào Bàn '+S.table+'?'));if(!from||from===S.table)return;let a=S.orders[from]||[];if(!a.length)return alert('Bàn nguồn trống.');let dest=S.orders[S.table]??=[];a.forEach(x=>{let d=dest.find(y=>y.id===x.id&&y.note===x.note);d?d.qty+=x.qty:dest.push(x)});S.orders[from]=[];delete S.tableStatus[from];log('GỘP BÀN','Bàn '+from+' → '+S.table);pushTable(from);pushTable(S.table);render()}
function splitBill(){let a=S.orders[S.table]||[];if(!a.length)return alert('Không có món.');let i=Number(prompt(a.map((x,i)=>(i+1)+'. '+x.name+' × '+x.qty).join('\n')+'\nChọn món muốn tách:'))-1;if(i<0||i>=a.length)return;let to=Number(prompt('Tách sang bàn số:'));if(!to||to<1||to>20)return;S.orders[to]??=[];S.orders[to].push(a.splice(i,1)[0]);log('TÁCH HÓA ĐƠN','Bàn '+S.table+' → Bàn '+to);pushTable(S.table);pushTable(to);render()}
function renderShift(){let ps=S.payments,rev=ps.reduce((s,x)=>s+x.amount,0),cash=0,qr=0,card=0;ps.forEach(p=>{if(p.method==='Tiền mặt')cash+=p.amount;else if(p.method==='QR/Chuyển khoản')qr+=p.amount;else if(p.method==='Thẻ')card+=p.amount;else{cash+=p.parts.cash||0;qr+=p.parts.qr||0}});$('shiftStats').innerHTML=stats([['Doanh thu',money(rev)],['Tiền mặt',money(cash)],['QR',money(qr)],['Thẻ',money(card)],['Trạng thái',S.shift?'ĐANG MỞ':'ĐÃ ĐÓNG']])}
function stats(arr){return arr.map(x=>'<div class=stat>'+x[0]+'<b>'+x[1]+'</b></div>').join('')}
function openShift(){if(!roles[S.user].pay)return alert('Không có quyền mở ca.');if(S.shift)return alert('Ca đang mở.');S.shift={opened:Date.now(),opening:+$('opening').value||0,user:S.user};log('MỞ CA','Quỹ đầu ca '+money(S.shift.opening));renderShift()}
function closeShift(){if(!S.shift)return alert('Chưa mở ca.');let cash=S.payments.reduce((s,p)=>s+(p.method==='Tiền mặt'?p.amount:p.method==='Kết hợp'?(p.parts.cash||0):0),0),other=+$('otherIncome').value||0,exp=+$('expense').value||0,expected=S.shift.opening+cash+other-exp,actual=+$('actualCash').value||0,diff=actual-expected,reason=$('shiftReason').value.trim();if(diff!==0&&!reason)return alert('Có chênh lệch, bắt buộc nhập lý do.');let rec={...S.shift,closed:Date.now(),cash,other,expense:exp,expected,actual,diff,reason};S.closedShifts.push(rec);log('ĐÓNG CA','Chênh '+money(diff)+' | '+(reason||'Không chênh'),diff!==0);S.shift=null;$('shiftResult').innerHTML='<p>Hệ thống: <b>'+money(expected)+'</b> · Thực tế: <b>'+money(actual)+'</b> · Chênh: <b>'+money(diff)+'</b></p>';renderShift()}
function renderStock(){$('stockIngredient').innerHTML=S.ingredients.map(i=>'<option value="'+i.id+'">'+i.name+' ('+i.unit+')</option>').join('');$('stockTable').innerHTML='<table><tr><th>Mã</th><th>Nguyên liệu</th><th>ĐVT</th><th>Giá nhập</th><th>Tồn LT</th><th>Tồn TT</th><th>Chênh</th></tr>'+S.ingredients.map(i=>'<tr><td>'+i.code+'</td><td>'+i.name+'</td><td>'+i.unit+'</td><td>'+money(i.cost)+'</td><td>'+i.qty.toFixed(2)+'</td><td>'+Number(i.actual??i.qty).toFixed(2)+'</td><td>'+((i.actual??i.qty)-i.qty).toFixed(2)+'</td></tr>').join('')+'</table>';$('stockMoves').innerHTML=S.stockMoves.slice(0,30).map(x=>'<div class=log>'+x.time+' · <b>'+x.type+'</b> · '+x.ingredient+' · '+x.qty+' · '+(x.note||'')+'</div>').join('')}
function addIngredient(){let code=prompt('Mã nguyên liệu:');if(!code)return;let name=prompt('Tên nguyên liệu:');if(!name)return;let unit=prompt('Đơn vị:','g')||'g';S.ingredients.push({id:Math.max(0,...S.ingredients.map(x=>x.id))+1,code,name,unit,cost:0,qty:0,actual:0});log('THÊM NGUYÊN LIỆU',code+' '+name);render()}
function postStock(){let ing=S.ingredients.find(x=>x.id===+$('stockIngredient').value),type=$('stockType').value,q=+$('stockQty').value||0,c=+$('stockCost').value||0,n=$('stockSupplier').value;if(!ing||q<0)return alert('Dữ liệu chưa hợp lệ.');if(type==='NHẬP'){if(c)ing.cost=c;ing.qty+=q;ing.actual=(ing.actual??0)+q}else if(type==='XUẤT'||type==='HỦY'){ing.qty-=q;ing.actual=(ing.actual??ing.qty)-q}else if(type==='KIỂM KÊ'){ing.actual=q}S.stockMoves.unshift({time:now(),type,ingredient:ing.name,qty:q,note:n});log(type+' KHO',ing.name+' '+q+' '+ing.unit+' | '+n,type==='HỦY'||type==='KIỂM KÊ');render()}
function renderRecipes(){$('recipeList').innerHTML=S.menu.filter(m=>m.station==='kitchen'||m.station==='bar').map(m=>{let rs=S.recipes[m.id]||[],cost=rs.reduce((s,r)=>{let i=S.ingredients.find(x=>x.id===r.ing);return s+(i?i.cost*r.qty:0)},0),fc=m.price?cost/m.price*100:0;return '<div class=log><b>'+m.name+'</b> · Giá bán '+money(m.price)+' · Giá vốn '+money(cost)+' · Food Cost <b>'+fc.toFixed(1)+'%</b>'+(fc>35?' ⚠️ VƯỢT 35%':'')+'<br>'+rs.map(r=>{let i=S.ingredients.find(x=>x.id===r.ing);return i?i.name+': '+r.qty+i.unit:''}).join(' · ')+' <button data-recipe="'+m.id+'">SỬA</button></div>'}).join('');document.querySelectorAll('[data-recipe]').forEach(b=>b.onclick=()=>editRecipe(b.dataset.recipe))}
function editRecipe(mid){let m=S.menu.find(x=>String(x.id)===String(mid));let text=(S.recipes[mid]||[]).map(r=>{let i=S.ingredients.find(x=>x.id===r.ing);return i?i.code+':'+r.qty:''}).join(',');let v=prompt('Công thức '+m.name+' theo dạng MÃ:SL, MÃ:SL',text);if(v===null)return;let arr=[];v.split(',').forEach(part=>{let [c,q]=part.trim().split(':'),i=S.ingredients.find(x=>x.code===c);if(i&&+q>0)arr.push({ing:i.id,qty:+q})});S.recipes[mid]=arr;log('SỬA CÔNG THỨC',m.name+' | '+v);render()}
function renderDashboard(){let bills=S.bills.filter(b=>!b.cancelled),day=bills.filter(b=>dayKey(b.time)===today()),rev=day.reduce((s,b)=>s+b.total,0),month=today().slice(0,7),mrev=bills.filter(b=>dayKey(b.time).slice(0,7)===month).reduce((s,b)=>s+b.total,0),avg=day.length?rev/day.length:0,disc=day.reduce((s,b)=>s+(b.subtotal-b.total),0);let cash=0,qr=0,card=0;S.payments.filter(p=>dayKey(p.time)===today()).forEach(p=>{if(p.method==='Tiền mặt')cash+=p.amount;else if(p.method==='QR/Chuyển khoản')qr+=p.amount;else if(p.method==='Thẻ')card+=p.amount;else{cash+=p.parts.cash||0;qr+=p.parts.qr||0}});$('dashStats').innerHTML=stats([['Doanh thu hôm nay',money(rev)],['Doanh thu tháng',money(mrev)],['Số bill',day.length],['Bill TB',money(avg)],['Tiền mặt',money(cash)],['QR',money(qr)],['Thẻ',money(card)],['Giảm giá',money(disc)],['Hủy món',S.risks.filter(x=>x.action==='HỦY MÓN').length]]);let counts={};bills.forEach(b=>b.items.forEach(i=>counts[i.name]=(counts[i.name]||0)+i.qty));$('topItems').innerHTML='<h3>Top món</h3>'+Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(x=>'<div class=log>'+x[0]+' <b>'+x[1]+'</b></div>').join('')}
function renderRisk(){$('bankInfo').textContent=S.bank;$('riskLog').innerHTML=S.risks.map(x=>'<div class=log><b>'+x.action+'</b> · '+x.time+' · '+x.user+'<br>'+x.detail+'</div>').join('')||'Chưa có cảnh báo.'}
function setBank(){if(!roles[S.user].bank)return alert('Chỉ OWNER được thay đổi.');let v=prompt('Ngân hàng - Chủ tài khoản - Số tài khoản',S.bank);if(!v)return;let old=S.bank;S.bank=v;log('SỬA TÀI KHOẢN NHẬN TIỀN',old+' → '+v,true);render()}
function renderAudit(){$('auditLog').innerHTML=S.audit.slice(0,300).map(x=>'<div class=log><b>'+x.action+'</b> · '+x.time+' · '+x.user+'<br>'+x.detail+'</div>').join('')}
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

async function pushTable(t){t=Number(t);if(!t)return;const rev=Date.now();tableRev[t]=rev;
  const{error}=await sb.from('pos_table_orders').upsert({table_no:t,items:S.orders[t]||[],status:S.tableStatus[t]||'',discount:S.discounts[t]||0,rev,client_id:CLIENT,updated_by:who(),updated_at:new Date().toISOString()});
  if(error)syncFail('bàn '+t,error)}
function applyTableRow(r){const t=Number(r.table_no);if(!t)return false;
  if(r.client_id===CLIENT&&Number(r.rev)<(tableRev[t]||0))return false; // bản cũ của chính máy này → bỏ qua
  S.orders[t]=Array.isArray(r.items)?r.items:[];
  if(r.status)S.tableStatus[t]=r.status;else delete S.tableStatus[t];
  if(Number(r.discount))S.discounts[t]=Number(r.discount);else delete S.discounts[t];
  return true}
function applyTicketRow(r){const t={id:r.id,table:Number(r.table_no),itemId:r.item_id,item:r.item,qty:r.qty,note:r.note||'',station:r.station,status:r.status,created:msOf(r.created_at),done:msOf(r.done_at),served:msOf(r.served_at),by:r.created_by};
  const i=S.tickets.findIndex(x=>String(x.id)===String(r.id));if(i>=0)S.tickets[i]=t;else S.tickets.push(t)}
function applyBillRow(r){const b={id:r.bill_no||'…',uid:r.id,table:r.table_no,items:r.items||[],subtotal:+r.subtotal||0,discount:+r.discount||0,total:+r.total||0,method:r.method,parts:r.parts||{},guests:+r.guests||0,time:msOf(r.created_at),user:r.created_by,cancelled:!!r.cancelled,cancelReason:r.cancel_reason,cancelledBy:r.cancelled_by,cancelledAt:msOf(r.cancelled_at)};
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
  S.orders={};S.tableStatus={};S.discounts={};o.data.forEach(applyTableRow);
  S.tickets=[];t.data.forEach(applyTicketRow);
  S.bills=[];b.data.forEach(applyBillRow);S.bills.sort(byTime);rebuildPayments();
  save();return true}

function beep(){try{const c=new (window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator(),g=c.createGain();o.frequency.value=880;g.gain.value=.15;o.connect(g);g.connect(c.destination);o.start();setTimeout(()=>{o.stop();c.close()},250)}catch(e){}}
function setLiveBadge(){const e=$('liveDot');if(e){e.textContent=liveOK?'● Trực tuyến':'○ Đang kết nối';e.className=liveOK?'live on':'live'}}
function startLive(){stopLive();
  liveChannel=sb.channel('pos-live-'+CLIENT.slice(0,8))
   .on('postgres_changes',{event:'*',schema:'public',table:'pos_table_orders'},p=>{if(p.new&&applyTableRow(p.new)){save();renderSale();renderOverview()}})
   .on('postgres_changes',{event:'*',schema:'public',table:'pos_tickets'},p=>{if(!p.new||!p.new.id)return;const isNew=!S.tickets.some(x=>String(x.id)===String(p.new.id));applyTicketRow(p.new);save();renderKDS();if(isNew&&$('kds').classList.contains('on'))beep()})
   .on('postgres_changes',{event:'*',schema:'public',table:'pos_bills'},p=>{if(!p.new||!p.new.id)return;applyBillRow(p.new);S.bills.sort(byTime);rebuildPayments();save();renderShift();renderDashboard();renderOverview();renderBills();renderReports()})
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
function showBill(u){const b=S.bills.find(x=>x.uid===u);if(!b)return;const can=!b.cancelled&&roles[S.user]&&roles[S.user].approve;
  modal('<div class=printarea><h2>Hóa đơn #'+b.id+'</h2><p>Mây ơi Sapa<br>'+new Date(b.time).toLocaleString('vi-VN')+' · Bàn '+pad(b.table)+'<br>Thu ngân: '+esc(b.user||'')+(b.guests?' · '+b.guests+' khách':'')+'</p>'+(b.cancelled?'<div class="notice voidnote">ĐÃ HỦY · '+esc(b.cancelReason||'')+' · '+esc(b.cancelledBy||'')+(b.cancelledAt?' · '+new Date(b.cancelledAt).toLocaleString('vi-VN'):'')+'</div>':'')+'<table><tr><th>Món</th><th>SL</th><th>Thành tiền</th></tr>'+b.items.map(i=>'<tr><td>'+esc(i.name)+(i.note?'<br><small>'+esc(i.note)+'</small>':'')+'</td><td>'+i.qty+'</td><td>'+money(i.price*i.qty)+'</td></tr>').join('')+'</table><p>Tạm tính: '+money(b.subtotal)+(b.discount?'<br>Giảm: '+b.discount+'%':'')+'</p><div class=total>'+money(b.total)+'</div><p>Thanh toán: '+esc(b.method||'')+'</p></div><button id=printOld class="primary wide">IN LẠI HÓA ĐƠN</button>'+(can?'<button id=cancelBill class="danger wide" style="margin-top:7px">HỦY HÓA ĐƠN</button>':'')+'<button id=closeM class=wide style="margin-top:7px">ĐÓNG</button>');
  $('printOld').onclick=()=>{document.body.classList.add('printing-modal');window.print();setTimeout(()=>document.body.classList.remove('printing-modal'),800)};
  $('closeM').onclick=closeModal;if(can)$('cancelBill').onclick=()=>cancelBill(b)}
async function cancelBill(b){const why=prompt('Lý do hủy hóa đơn #'+b.id+' (bắt buộc):');if(!why)return;if(!confirm('Hủy hóa đơn #'+b.id+' – '+money(b.total)+'?'))return;
  const{data,error}=await sb.from('pos_bills').update({cancelled:true,cancel_reason:why,cancelled_by:who(),cancelled_at:new Date().toISOString()}).eq('id',b.uid).select().single();
  if(error){syncFail('hủy hóa đơn',error);return alert('Không hủy được: '+error.message)}
  applyBillRow(data);rebuildPayments();log('HỦY HÓA ĐƠN','#'+b.id+' · '+money(b.total)+' · '+why,true);closeModal();render();toast('Đã hủy hóa đơn #'+b.id)}

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
  else if(type==='cancel'){const cb=S.bills.filter(x=>x.cancelled&&x.time>=a&&x.time<b);const vi=(S.risks||[]).filter(x=>x.action==='HỦY MÓN');
    head=['Loại','Thời gian','Nội dung','Người thực hiện'];rows=cb.map(x=>['Hủy hóa đơn',new Date(x.time).toLocaleString('vi-VN'),'#'+x.id+' · Bàn '+pad(x.table)+' · '+money(x.total)+' · '+esc(x.cancelReason||''),esc(x.cancelledBy||'')]).concat(vi.map(x=>['Hủy món',esc(x.time),esc(x.detail),esc(x.user)]));note='Hủy món hiện lấy từ nhật ký trên máy này.'}
  else if(type==='stock'){head=['Mã','Nguyên liệu','ĐVT','Tồn','Giá nhập','Giá trị tồn'];rows=S.ingredients.map(i=>[esc(i.code),esc(i.name),esc(i.unit),Number(i.qty).toFixed(2),money(i.cost),money(i.qty*i.cost)]);rows.push(['','<b>Tổng</b>','','','','<b>'+money(S.ingredients.reduce((s,i)=>s+i.qty*i.cost,0))+'</b>']);note='Tồn kho hiện lưu trên máy này.'}
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
async function saveMenu(old){if(!roles[S.user]||!roles[S.user].approve)return alert('Chỉ OWNER / QUẢN LÝ được sửa thực đơn.');
  const v={code:$('mfCode').value.trim(),name:$('mfName').value.trim(),en:$('mfEn').value.trim(),cat:$('mfCat').value.trim()||'KHÁC',course:$('mfCourse').value,unit:$('mfUnit').value.trim()||'Phần',price:+$('mfPrice').value||0,cost:+$('mfCost').value||0,station:$('mfStation').value,desc:$('mfDesc').value.trim(),signature:$('mfSig').checked,marketPrice:$('mfMarket').checked,hidden:$('mfHidden').checked,active:!$('mfStop').checked};
  if(!v.code||!v.name)return alert('Nhập mã món và tên món.');
  if(!v.marketPrice&&!v.price)return alert('Nhập giá bán, hoặc bật "Món thay đổi theo thời giá".');
  if(S.menu.some(x=>String(x.code).toLowerCase()===v.code.toLowerCase()&&(!old||String(x.id)!==String(old.id))))return alert('Mã món đã tồn tại.');
  const row={code:v.code,name:v.name,name_en:v.en,category:v.cat,price:v.price,station:v.station,active:v.active,unit:v.unit,cost:v.cost,is_signature:v.signature,is_market_price:v.marketPrice,description:v.desc,hidden:v.hidden,course:v.course};
  const btn=$('mfSave');btn.disabled=true;btn.textContent='ĐANG LƯU...';
  const{data,error}=await(old?sb.from('menu_items').update(row).eq('id',old.id).select().single():sb.from('menu_items').insert(row).select().single());
  if(error){btn.disabled=false;btn.textContent='LƯU';console.error(error);return alert('Chưa lưu được món: '+error.message+(/column|schema/i.test(error.message)?'\n→ Hãy chạy file SQL cập nhật trong Supabase trước.':''))}
  const mm=mapMenu(data);
  if(old){const i=S.menu.findIndex(x=>String(x.id)===String(old.id));if(i>=0)S.menu[i]=mm;log('SỬA MÓN',old.code+' '+old.name+' → '+v.name+' · '+money(v.price)+' · '+(v.active?'Đang bán':'Ngừng bán'),true)}
  else{S.menu.push(mm);log('THÊM MÓN',v.code+' '+v.name)}
  closeModal();render();toast('✓ Đã lưu '+v.name)}
function addMenu(){menuForm(null)}
function editMenu(id){const m=S.menu.find(x=>String(x.id)===String(id));if(m)menuForm(m)}

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
Object.assign(actions,{exportReport});
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
 
