
App · JS
(()=>{'use strict';
const SUPABASE_URL = 'https://eznqzduljevrtwdlaxqk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_KiYRfW2jD10Kdlzak5a98Q_YSt8-D0h';
 
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
async function loadMenuFromSupabase() {
  const { data, error } = await sb
    .from('menu_items')
    .select('*')
    .eq('active', true);
 
  if (error) {
    console.error('Lỗi tải menu Supabase:', error);
    return false;
  }
 
  console.log('MENU SUPABASE:', data);
  return data;
}
      
const $=id=>document.getElementById(id), money=n=>new Intl.NumberFormat('vi-VN').format(Math.round(Number(n)||0))+' đ', now=()=>new Date().toLocaleString('vi-VN'), today=()=>new Date().toISOString().slice(0,10);
const roles={owner:{name:'OWNER',pages:['sale','kds','shift','stock','recipes','menuadmin','dashboard','risk','audit','backup'],disc:100,pay:1,approve:1,bank:1},manager:{name:'QUẢN LÝ',pages:['sale','kds','shift','stock','recipes','dashboard','risk','audit'],disc:20,pay:1,approve:1},cashier:{name:'THU NGÂN',pages:['sale','shift','dashboard'],disc:5,pay:1},waiter:{name:'PHỤC VỤ',pages:['sale'],disc:0},kitchen:{name:'BẾP',pages:['kds']},bar:{name:'BAR',pages:['kds']},stock:{name:'KHO/KẾ TOÁN',pages:['stock','recipes','dashboard','audit']}};
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
function nav(){const r=roles[S.user];$('nav').innerHTML='';if(!r)return;r.pages.forEach((p,i)=>{let b=document.createElement('button');b.dataset.page=p;b.textContent={sale:'Bán hàng',kds:S.user==='bar'?'Bar':S.user==='kitchen'?'Bếp':'Bếp/Bar',shift:'Ca & tiền',stock:'Kho',recipes:'Công thức',menuadmin:'Menu',dashboard:'Dashboard',risk:'Kiểm soát',audit:'Audit Log',backup:'Sao lưu'}[p];if(i===0)b.className='navon';b.onclick=()=>show(p,b);$('nav').appendChild(b)});let o=document.createElement('button');o.textContent='Đăng xuất';o.onclick=logout;$('nav').appendChild(o)}
function show(p,b){document.querySelectorAll('.page').forEach(x=>x.classList.remove('on'));$(p).classList.add('on');document.querySelectorAll('nav button').forEach(x=>x.classList.remove('navon'));if(b)b.classList.add('navon');render()}
function render(){if(!S.user)return;$('userName').textContent=roles[S.user].name;renderSale();renderKDS();renderShift();renderStock();renderRecipes();renderMenuAdmin();renderDashboard();renderRisk();renderAudit();save()}
function renderSale(){
 $('tables').innerHTML='';for(let i=1;i<=20;i++){let a=S.orders[i]||[],st=S.tableStatus[i]||'',b=document.createElement('button');b.className='table'+(S.table===i?' selected':'')+(a.length?' busy':'')+(st==='waiting'?' waiting':'');b.innerHTML='<b>Bàn '+String(i).padStart(2,'0')+'</b><br>'+(st==='waiting'?'CHỜ THANH TOÁN':a.length?'ĐANG PHỤC VỤ':'TRỐNG');b.onclick=()=>{S.table=i;S.orders[i]??=[];save();renderSale()};$('tables').appendChild(b)}
 let cats=['TẤT CẢ',...new Set(S.menu.map(x=>x.cat))];$('cats').innerHTML='';cats.forEach(c=>{let b=document.createElement('button');b.className='cat'+(cat===c?' on':'');b.textContent=c;b.onclick=()=>{cat=c;renderSale()};$('cats').appendChild(b)});
 let ms=S.menu.filter(x=>x.active&&(cat==='TẤT CẢ'||x.cat===cat)&&(!search||x.name.toLowerCase().includes(search)||x.en.toLowerCase().includes(search)));$('products').innerHTML='';ms.forEach(p=>{let b=document.createElement('button');b.className='product';b.innerHTML='<b>'+p.name+'</b><br>'+money(p.price);b.onclick=()=>addItem(p.id);$('products').appendChild(b)});
 const a=S.orders[S.table]||[];$('billHead').textContent=S.table?'BÀN '+String(S.table).padStart(2,'0')+' · '+a.reduce((n,x)=>n+x.qty,0)+' MÓN':'CHƯA CHỌN BÀN';$('order').innerHTML=a.length?'':'<div class=empty>Bấm món bên trái → món sẽ hiện tại đây ngay.</div>';
 a.forEach(x=>{let d=document.createElement('div');d.className='item';d.innerHTML='<div><div class=itemname>'+x.name+'</div><small>'+money(x.price)+' × '+x.qty+' = '+money(x.price*x.qty)+'</small><br><small>'+(x.note?'Ghi chú: '+x.note:'')+'</small></div><div class=qty><button data-q="'+x.id+'" data-d="-1">−</button><b>'+x.qty+'</b><button data-q="'+x.id+'" data-d="1">+</button><button data-note="'+x.id+'">✎</button></div>';$('order').appendChild(d)});
 document.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>changeQty(b.dataset.q,+b.dataset.d));document.querySelectorAll('[data-note]').forEach(b=>b.onclick=()=>noteItem(b.dataset.note));
 let t=total();$('billSummary').innerHTML=t.d?'<p>Tạm tính: '+money(t.sub)+'<br>Giảm: '+t.d+'%</p>':'';$('total').textContent=money(t.total)
}
function addItem(id){if(!S.table)return alert('Hãy chọn bàn trước.');if(['kitchen','bar','stock'].includes(S.user))return alert('Tài khoản này không có quyền order.');let p=S.menu.find(x=>x.id===id),a=S.orders[S.table]??=[];let x=a.find(q=>q.id===id);if(x)x.qty++;else a.push({id:p.id,name:p.name,price:p.price,station:p.station,qty:1,sent:0,note:''});S.tableStatus[S.table]='busy';log('THÊM MÓN','Bàn '+S.table+': '+p.name);renderSale();toast('✓ '+p.name+' đã vào hóa đơn')}
function changeQty(id,d){let a=S.orders[S.table]||[],x=a.find(q=>String(q.id)===String(id));if(!x)return;if(d<0&&x.sent>=x.qty)return alert('Món đã gửi Bếp/Bar. Muốn hủy phải dùng HỦY MÓN.');x.qty+=d;if(x.qty<=0)a.splice(a.indexOf(x),1);log('ĐỔI SỐ LƯỢNG','Bàn '+S.table+', món '+id+', '+d);renderSale()}
function noteItem(id){let x=(S.orders[S.table]||[]).find(q=>String(q.id)===String(id));if(!x)return;let n=prompt('Ghi chú món',x.note||'');if(n!==null){x.note=n;log('GHI CHÚ MÓN','Bàn '+S.table+': '+x.name+' | '+n);renderSale()}}
function sendOrder(){if(!S.table)return alert('Chọn bàn.');let n=0;(S.orders[S.table]||[]).forEach(x=>{let delta=x.qty-(x.sent||0);if(delta>0){S.tickets.push({id:Date.now()+Math.random(),table:S.table,itemId:x.id,item:x.name,qty:delta,note:x.note,station:x.station,status:'MỚI',created:Date.now()});x.sent=x.qty;n++}});if(!n)return alert('Không có món mới để gửi.');log('GỬI BẾP/BAR','Bàn '+S.table+': '+n+' dòng món');save();render();toast('Đã gửi Bếp/Bar')}
function renderKDS(){let station=S.user==='bar'?'bar':S.user==='kitchen'?'kitchen':null;$('kdsTitle').textContent=station==='bar'?'BAR DISPLAY':station==='kitchen'?'KITCHEN DISPLAY':'BẾP / BAR';let ts=S.tickets.filter(t=>t.status!=='ĐÃ PHỤC VỤ'&&(!station||t.station===station));$('tickets').innerHTML=ts.length?'':'<div class=empty>Chưa có món.</div>';ts.forEach(t=>{let d=document.createElement('div');d.className='ticket '+(t.status==='MỚI'?'new':t.status==='HOÀN THÀNH'?'done':'');let mins=Math.floor((Date.now()-t.created)/60000);d.innerHTML='<h3>Bàn '+String(t.table).padStart(2,'0')+'</h3><b>'+t.qty+' × '+t.item+'</b><p>'+(t.note||'')+'</p><p><span class=badge>'+t.status+'</span> · '+mins+' phút</p><button data-ticket="'+t.id+'" class=primary>CẬP NHẬT</button>';$('tickets').appendChild(d)});document.querySelectorAll('[data-ticket]').forEach(b=>b.onclick=()=>advanceTicket(b.dataset.ticket))}
function advanceTicket(id){let t=S.tickets.find(x=>String(x.id)===String(id)),flow=['MỚI','ĐANG LÀM','HOÀN THÀNH','ĐÃ PHỤC VỤ'];if(!t)return;t.status=flow[Math.min(flow.indexOf(t.status)+1,3)];log('TRẠNG THÁI MÓN','Bàn '+t.table+': '+t.item+' → '+t.status);renderKDS()}
function doDiscount(){if(!S.table)return alert('Chọn bàn.');let max=roles[S.user].disc||0;if(!max)return alert('Không có quyền giảm giá.');let d=Number(prompt('Nhập % giảm. Tối đa '+max+'%'));if(!d)return;if(d>max){log('TỪ CHỐI GIẢM GIÁ','Yêu cầu '+d+'%',true);return alert('Vượt quyền.')}S.discounts[S.table]=d;log('GIẢM GIÁ','Bàn '+S.table+': '+d+'%',true);renderSale()}
function voidItem(){if(!roles[S.user].approve)return alert('Cần Quản lý/OWNER duyệt.');let a=S.orders[S.table]||[];if(!a.length)return alert('Không có món.');let i=Number(prompt(a.map((x,i)=>(i+1)+'. '+x.name+' × '+x.qty).join('\n')+'\nNhập số thứ tự món:'))-1;if(i<0||i>=a.length)return;let why=prompt('Lý do hủy (bắt buộc):');if(!why)return alert('Bắt buộc có lý do.');let x=a[i],waste=(x.sent||0)>0;restoreOrWaste(x,waste);a.splice(i,1);log('HỦY MÓN','Bàn '+S.table+': '+x.name+' | '+why+' | '+(waste?'ĐÃ CHẾ BIẾN/HAO HỤT':'CHƯA CHẾ BIẾN'),true);render()}
function restoreOrWaste(item,waste){if(!item.sent)return;let rec=S.recipes[item.id]||[];if(!waste)rec.forEach(r=>{let ing=S.ingredients.find(i=>i.id===r.ing);if(ing)ing.qty+=r.qty*item.sent})}
function markWaiting(){if(!S.table)return alert('Chọn bàn.');S.tableStatus[S.table]='waiting';log('CHỜ THANH TOÁN','Bàn '+S.table);renderSale()}
function pay(){if(!roles[S.user].pay)return alert('Không có quyền thanh toán.');let t=total();if(!S.table||!t.total)return alert('Không có hóa đơn.');modal('<h2>Thanh toán · Bàn '+S.table+'</h2><p>Tạm tính: <b>'+money(t.sub)+'</b><br>Giảm: <b>'+t.d+'%</b></p><div class=total>'+money(t.total)+'</div><select id=pm><option>Tiền mặt</option><option>QR/Chuyển khoản</option><option>Thẻ</option><option>Kết hợp</option></select><input id=cashGiven type=number placeholder="Khách đưa (tiền mặt)"><input id=splitCash type=number placeholder="Nếu kết hợp: tiền mặt"><input id=splitQR type=number placeholder="Nếu kết hợp: QR"><button id=confirmPay class="primary wide">XÁC NHẬN</button><button id=printBill class="wide">IN BILL 80MM</button>');$('confirmPay').onclick=confirmPay;$('printBill').onclick=()=>window.print()}
function confirmPay(){let t=total(),m=$('pm').value;if(m.includes('QR')&&S.bank==='Chưa cấu hình')return alert('OWNER chưa cấu hình tài khoản nhận tiền.');let parts={};if(m==='Kết hợp'){parts.cash=+$('splitCash').value||0;parts.qr=+$('splitQR').value||0;if(Math.abs(parts.cash+parts.qr-t.total)>1)return alert('Tổng tiền kết hợp chưa bằng số phải thanh toán.')}else parts[m]=t.total;let given=+$('cashGiven').value||0;if(m==='Tiền mặt'&&given&&given<t.total)return alert('Tiền khách đưa chưa đủ.');let bill={id:S.billSeq++,table:S.table,items:JSON.parse(JSON.stringify(S.orders[S.table])),subtotal:t.sub,discount:t.d,total:t.total,method:m,parts,time:Date.now(),user:S.user};deductInventory(bill.items);S.bills.push(bill);S.payments.push({bill:bill.id,amount:t.total,method:m,parts,time:Date.now()});log('THANH TOÁN','Bill #'+bill.id+' · Bàn '+S.table+' · '+money(t.total)+' · '+m);S.orders[S.table]=[];delete S.discounts[S.table];delete S.tableStatus[S.table];closeModal();render();toast('✓ Thanh toán thành công')}
function deductInventory(items){items.forEach(it=>(S.recipes[it.id]||[]).forEach(r=>{let ing=S.ingredients.find(x=>x.id===r.ing);if(ing){ing.qty-=r.qty*it.qty;S.stockMoves.unshift({time:now(),type:'BÁN HÀNG',ingredient:ing.name,qty:-(r.qty*it.qty),note:it.name})}}))}
function moveTable(){if(!S.table)return alert('Chọn bàn nguồn.');let to=Number(prompt('Chuyển Bàn '+S.table+' sang bàn số:'));if(!to||to<1||to>20||to===S.table)return;if((S.orders[to]||[]).length)return alert('Bàn đích đang có order.');S.orders[to]=S.orders[S.table]||[];S.orders[S.table]=[];S.tableStatus[to]=S.tableStatus[S.table];delete S.tableStatus[S.table];log('CHUYỂN BÀN','Bàn '+S.table+' → '+to);S.table=to;render()}
function mergeTable(){if(!S.table)return alert('Chọn bàn đích.');let from=Number(prompt('Gộp bàn số nào vào Bàn '+S.table+'?'));if(!from||from===S.table)return;let a=S.orders[from]||[];if(!a.length)return alert('Bàn nguồn trống.');let dest=S.orders[S.table]??=[];a.forEach(x=>{let d=dest.find(y=>y.id===x.id&&y.note===x.note);d?d.qty+=x.qty:dest.push(x)});S.orders[from]=[];delete S.tableStatus[from];log('GỘP BÀN','Bàn '+from+' → '+S.table);render()}
function splitBill(){let a=S.orders[S.table]||[];if(!a.length)return alert('Không có món.');let i=Number(prompt(a.map((x,i)=>(i+1)+'. '+x.name+' × '+x.qty).join('\n')+'\nChọn món muốn tách:'))-1;if(i<0||i>=a.length)return;let to=Number(prompt('Tách sang bàn số:'));if(!to||to<1||to>20)return;S.orders[to]??=[];S.orders[to].push(a.splice(i,1)[0]);log('TÁCH HÓA ĐƠN','Bàn '+S.table+' → Bàn '+to);render()}
function renderShift(){let ps=S.payments,rev=ps.reduce((s,x)=>s+x.amount,0),cash=0,qr=0,card=0;ps.forEach(p=>{if(p.method==='Tiền mặt')cash+=p.amount;else if(p.method==='QR/Chuyển khoản')qr+=p.amount;else if(p.method==='Thẻ')card+=p.amount;else{cash+=p.parts.cash||0;qr+=p.parts.qr||0}});$('shiftStats').innerHTML=stats([['Doanh thu',money(rev)],['Tiền mặt',money(cash)],['QR',money(qr)],['Thẻ',money(card)],['Trạng thái',S.shift?'ĐANG MỞ':'ĐÃ ĐÓNG']])}
function stats(arr){return arr.map(x=>'<div class=stat>'+x[0]+'<b>'+x[1]+'</b></div>').join('')}
function openShift(){if(!roles[S.user].pay)return alert('Không có quyền mở ca.');if(S.shift)return alert('Ca đang mở.');S.shift={opened:Date.now(),opening:+$('opening').value||0,user:S.user};log('MỞ CA','Quỹ đầu ca '+money(S.shift.opening));renderShift()}
function closeShift(){if(!S.shift)return alert('Chưa mở ca.');let cash=S.payments.reduce((s,p)=>s+(p.method==='Tiền mặt'?p.amount:p.method==='Kết hợp'?(p.parts.cash||0):0),0),other=+$('otherIncome').value||0,exp=+$('expense').value||0,expected=S.shift.opening+cash+other-exp,actual=+$('actualCash').value||0,diff=actual-expected,reason=$('shiftReason').value.trim();if(diff!==0&&!reason)return alert('Có chênh lệch, bắt buộc nhập lý do.');let rec={...S.shift,closed:Date.now(),cash,other,expense:exp,expected,actual,diff,reason};S.closedShifts.push(rec);log('ĐÓNG CA','Chênh '+money(diff)+' | '+(reason||'Không chênh'),diff!==0);S.shift=null;$('shiftResult').innerHTML='<p>Hệ thống: <b>'+money(expected)+'</b> · Thực tế: <b>'+money(actual)+'</b> · Chênh: <b>'+money(diff)+'</b></p>';renderShift()}
function renderStock(){$('stockIngredient').innerHTML=S.ingredients.map(i=>'<option value="'+i.id+'">'+i.name+' ('+i.unit+')</option>').join('');$('stockTable').innerHTML='<table><tr><th>Mã</th><th>Nguyên liệu</th><th>ĐVT</th><th>Giá nhập</th><th>Tồn LT</th><th>Tồn TT</th><th>Chênh</th></tr>'+S.ingredients.map(i=>'<tr><td>'+i.code+'</td><td>'+i.name+'</td><td>'+i.unit+'</td><td>'+money(i.cost)+'</td><td>'+i.qty.toFixed(2)+'</td><td>'+Number(i.actual??i.qty).toFixed(2)+'</td><td>'+((i.actual??i.qty)-i.qty).toFixed(2)+'</td></tr>').join('')+'</table>';$('stockMoves').innerHTML=S.stockMoves.slice(0,30).map(x=>'<div class=log>'+x.time+' · <b>'+x.type+'</b> · '+x.ingredient+' · '+x.qty+' · '+(x.note||'')+'</div>').join('')}
function addIngredient(){let code=prompt('Mã nguyên liệu:');if(!code)return;let name=prompt('Tên nguyên liệu:');if(!name)return;let unit=prompt('Đơn vị:','g')||'g';S.ingredients.push({id:Math.max(0,...S.ingredients.map(x=>x.id))+1,code,name,unit,cost:0,qty:0,actual:0});log('THÊM NGUYÊN LIỆU',code+' '+name);render()}
function postStock(){let ing=S.ingredients.find(x=>x.id===+$('stockIngredient').value),type=$('stockType').value,q=+$('stockQty').value||0,c=+$('stockCost').value||0,n=$('stockSupplier').value;if(!ing||q<0)return alert('Dữ liệu chưa hợp lệ.');if(type==='NHẬP'){if(c)ing.cost=c;ing.qty+=q;ing.actual=(ing.actual??0)+q}else if(type==='XUẤT'||type==='HỦY'){ing.qty-=q;ing.actual=(ing.actual??ing.qty)-q}else if(type==='KIỂM KÊ'){ing.actual=q}S.stockMoves.unshift({time:now(),type,ingredient:ing.name,qty:q,note:n});log(type+' KHO',ing.name+' '+q+' '+ing.unit+' | '+n,type==='HỦY'||type==='KIỂM KÊ');render()}
function renderRecipes(){$('recipeList').innerHTML=S.menu.filter(m=>m.station==='kitchen'||m.station==='bar').map(m=>{let rs=S.recipes[m.id]||[],cost=rs.reduce((s,r)=>{let i=S.ingredients.find(x=>x.id===r.ing);return s+(i?i.cost*r.qty:0)},0),fc=m.price?cost/m.price*100:0;return '<div class=log><b>'+m.name+'</b> · Giá bán '+money(m.price)+' · Giá vốn '+money(cost)+' · Food Cost <b>'+fc.toFixed(1)+'%</b>'+(fc>35?' ⚠️ VƯỢT 35%':'')+'<br>'+rs.map(r=>{let i=S.ingredients.find(x=>x.id===r.ing);return i?i.name+': '+r.qty+i.unit:''}).join(' · ')+' <button data-recipe="'+m.id+'">SỬA</button></div>'}).join('');document.querySelectorAll('[data-recipe]').forEach(b=>b.onclick=()=>editRecipe(b.dataset.recipe))}
function editRecipe(mid){let m=S.menu.find(x=>String(x.id)===String(mid));let text=(S.recipes[mid]||[]).map(r=>{let i=S.ingredients.find(x=>x.id===r.ing);return i?i.code+':'+r.qty:''}).join(',');let v=prompt('Công thức '+m.name+' theo dạng MÃ:SL, MÃ:SL',text);if(v===null)return;let arr=[];v.split(',').forEach(part=>{let [c,q]=part.trim().split(':'),i=S.ingredients.find(x=>x.code===c);if(i&&+q>0)arr.push({ing:i.id,qty:+q})});S.recipes[mid]=arr;log('SỬA CÔNG THỨC',m.name+' | '+v);render()}
function renderMenuAdmin(){$('menuTable').innerHTML='<table><tr><th>Mã</th><th>Tên</th><th>Nhóm</th><th>Giá</th><th>Trạm</th><th>Trạng thái</th><th></th></tr>'+S.menu.map(m=>'<tr><td>'+m.code+'</td><td>'+m.name+'</td><td>'+m.cat+'</td><td>'+money(m.price)+'</td><td>'+m.station+'</td><td>'+(m.active?'Đang bán':'Ngừng')+'</td><td><button data-menu="'+m.id+'">SỬA</button></td></tr>').join('')+'</table>';document.querySelectorAll('[data-menu]').forEach(b=>b.onclick=()=>editMenu(b.dataset.menu))}
function addMenu(){let code=prompt('Mã món:');if(!code)return;let name=prompt('Tên món:');if(!name)return;let price=+prompt('Giá bán:');let cat=prompt('Nhóm:','MÓN CHÍNH')||'MÓN CHÍNH',station=prompt('Trạm: kitchen hoặc bar','kitchen')||'kitchen';S.menu.push({id:Math.max(0,...S.menu.map(x=>x.id))+1,code,name,en:name,cat,price,station,active:true});log('THÊM MÓN',code+' '+name);render()}
function editMenu(id){let m=S.menu.find(x=>String(x.id)===String(id));let name=prompt('Tên món:',m.name);if(name===null)return;let price=+prompt('Giá:',m.price),catv=prompt('Nhóm:',m.cat),active=confirm('OK = ĐANG BÁN; Cancel = NGỪNG BÁN');let old=JSON.stringify(m);Object.assign(m,{name,price,cat:catv,active});log('SỬA MÓN',old+' → '+JSON.stringify(m),true);render()}
function renderDashboard(){let bills=S.bills,day=bills.filter(b=>new Date(b.time).toISOString().slice(0,10)===today()),rev=day.reduce((s,b)=>s+b.total,0),month=new Date().toISOString().slice(0,7),mrev=bills.filter(b=>new Date(b.time).toISOString().slice(0,7)===month).reduce((s,b)=>s+b.total,0),avg=day.length?rev/day.length:0,disc=day.reduce((s,b)=>s+(b.subtotal-b.total),0);let cash=0,qr=0,card=0;S.payments.filter(p=>new Date(p.time).toISOString().slice(0,10)===today()).forEach(p=>{if(p.method==='Tiền mặt')cash+=p.amount;else if(p.method==='QR/Chuyển khoản')qr+=p.amount;else if(p.method==='Thẻ')card+=p.amount;else{cash+=p.parts.cash||0;qr+=p.parts.qr||0}});$('dashStats').innerHTML=stats([['Doanh thu hôm nay',money(rev)],['Doanh thu tháng',money(mrev)],['Số bill',day.length],['Bill TB',money(avg)],['Tiền mặt',money(cash)],['QR',money(qr)],['Thẻ',money(card)],['Giảm giá',money(disc)],['Hủy món',S.risks.filter(x=>x.action==='HỦY MÓN').length]]);let counts={};bills.forEach(b=>b.items.forEach(i=>counts[i.name]=(counts[i.name]||0)+i.qty));$('topItems').innerHTML='<h3>Top món</h3>'+Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(x=>'<div class=log>'+x[0]+' <b>'+x[1]+'</b></div>').join('')}
function renderRisk(){$('bankInfo').textContent=S.bank;$('riskLog').innerHTML=S.risks.map(x=>'<div class=log><b>'+x.action+'</b> · '+x.time+' · '+x.user+'<br>'+x.detail+'</div>').join('')||'Chưa có cảnh báo.'}
function setBank(){if(!roles[S.user].bank)return alert('Chỉ OWNER được thay đổi.');let v=prompt('Ngân hàng - Chủ tài khoản - Số tài khoản',S.bank);if(!v)return;let old=S.bank;S.bank=v;log('SỬA TÀI KHOẢN NHẬN TIỀN',old+' → '+v,true);render()}
function renderAudit(){$('auditLog').innerHTML=S.audit.slice(0,300).map(x=>'<div class=log><b>'+x.action+'</b> · '+x.time+' · '+x.user+'<br>'+x.detail+'</div>').join('')}
function exportData(){let blob=new Blob([JSON.stringify(S,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='MAY_POS_BACKUP_'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function restoreData(){let f=$('importData').files[0];if(!f)return alert('Chọn file JSON.');let r=new FileReader();r.onload=()=>{try{let x=JSON.parse(r.result);if(!x.menu||!x.orders)throw Error();S=x;save();alert('Khôi phục thành công.');location.reload()}catch(e){alert('File không hợp lệ.')}};r.readAsText(f)}
function resetDemo(){if(confirm('Xóa toàn bộ dữ liệu demo?')){S=defaultState();save();location.reload()}}
 
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
 
const menuData = await loadMenuFromSupabase();
if (menuData) {
  S.menu = menuData.map(x => ({
    id: x.id,
    code: x.code,
    name: x.name,
    en: x.name_en || '',
    cat: x.category,
    price: Number(x.price),
    station: x.station,
    active: x.active
  }));
} 
  
  S.user = data.role_code;
  $('login').classList.add('hide');
  nav();
  show(roles[S.user].pages[0]);
  render();
}
 
async function logout() {
  await sb.auth.signOut();
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
Object.entries(actions).forEach(([id, fn]) => { const el = $(id); if (el) el.onclick = fn; });
 
(async function init() {
  const { data } = await sb.auth.getUser();
  if (data.user) {
    await loadUser(data.user);
  }
})();
})();
 
