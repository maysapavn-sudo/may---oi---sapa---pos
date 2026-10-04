-- =====================================================================
-- MÂY POS – KIỂM THỬ BẢO MẬT & PHÂN QUYỀN PHÍA MÁY CHỦ (bản 3.1)
-- An toàn với dữ liệu thật: toàn bộ bài thử chạy trong một khối được
-- HOÀN TÁC TOÀN BỘ (nhân viên TEST, đơn, hóa đơn, kho… đều không lưu lại).
-- Số hóa đơn được trả về như cũ. Kết quả hiện ở bảng kết quả.
-- =====================================================================
do $$
declare
  res text := ''; pass int := 0; fail int := 0; line text; v text; n int; t record;
  u_mgr uuid := gen_random_uuid(); u_cas uuid := gen_random_uuid(); u_wai uuid := gen_random_uuid();
  u_kit uuid := gen_random_uuid(); u_bar uuid := gen_random_uuid(); u_sto uuid := gen_random_uuid(); u_own uuid;
  m_k bigint; m_b bigint; p_k numeric; p_b numeric; s_b text; ing bigint; tbl int := 9999;
  rev bigint; bill uuid := gen_random_uuid(); tk uuid; tb uuid; sub numeric; v_tot numeric;
  v_seq text; v_last bigint; v_called boolean; v_keep bigint; anon_open text := ''; anon_n int := 0;
  items_ok jsonb; open_shift boolean; v_email text;
begin
  v_seq := pg_get_serial_sequence('public.pos_bills', 'bill_no');
  execute format('select last_value, is_called from %s', v_seq) into v_last, v_called;
 begin   -- khối thử: luôn hoàn tác ở cuối
  -- ---------- Hàm kiểm tra tạm (mất khi hoàn tác) ----------
  execute $f$
  create function pg_temp.ck(p_label text, p_who uuid, p_sql text, p_expect text) returns text language plpgsql as $b$
  declare n int; m text;
  begin
    execute 'reset role';
    if p_who is null then perform set_config('request.jwt.claim.sub', '', true); execute 'set local role anon';
    else perform set_config('request.jwt.claim.sub', p_who::text, true); execute 'set local role authenticated'; end if;
    begin
      execute p_sql; get diagnostics n = row_count;
      execute 'reset role';
      if p_expect is null then return '✓ ' || p_label; end if;
      if p_expect = '0rows' then return case when n = 0 then '✓ ' || p_label || ' (0 dòng bị tác động)' else '✗ ' || p_label || ': tác động ' || n || ' dòng' end; end if;
      return '✗ ' || p_label || ': KHÔNG bị chặn';
    exception when others then
      m := sqlerrm; execute 'reset role';
      if p_expect is not null and p_expect <> '0rows' and m ilike '%' || p_expect || '%' then return '✓ ' || p_label || ' → ' || left(m, 80); end if;
      if p_expect = '0rows' and m ilike '%permission denied%' then return '✓ ' || p_label || ' → ' || left(m, 60); end if;
      return '✗ ' || p_label || ': ' || left(m, 160);
    end;
  end $b$;$f$;
  execute $f$
  create function pg_temp.val(p_who uuid, p_sql text) returns text language plpgsql as $b$
  declare r text;
  begin
    execute 'reset role';
    if p_who is null then execute 'set local role anon';
    else perform set_config('request.jwt.claim.sub', p_who::text, true); execute 'set local role authenticated'; end if;
    begin execute p_sql into r; exception when others then r := 'LỖI: ' || sqlerrm; end;
    execute 'reset role';
    return r;
  end $b$;$f$;

  -- ---------- Chuẩn bị ----------
  select id, price into m_k, p_k from public.menu_items where coalesce(station,'kitchen') <> 'bar' and price > 0 and not coalesce(is_market_price,false) order by id limit 1;
  select id, price, station into m_b, p_b, s_b from public.menu_items where station = 'bar' and price > 0 and not coalesce(is_market_price,false) order by id limit 1;
  select auth_user_id into u_own from public.users where role_code = 'owner' limit 1;
  select email into v_email from auth.users where id::text = u_own::text;
  insert into public.users(auth_user_id, username, role_code) values
    (u_mgr,'TEST-quanly','manager'),(u_cas,'TEST-thungan','cashier'),(u_wai,'TEST-phucvu','waiter'),
    (u_kit,'TEST-bep','kitchen'),(u_bar,'TEST-bar','bar'),(u_sto,'TEST-kho','stock');
  insert into public.pos_ingredients(code,name,unit) values ('ZZTEST-31','TEST 3.1','g') returning id into ing;
  insert into public.pos_stock(ingredient_id, location, qty) values (ing, 'BEP', 1000);
  insert into public.pos_recipes(menu_item_id, ingredient_id, qty) values (m_k, ing, 100)
    on conflict (menu_item_id, ingredient_id) do update set qty = 100;
  select exists(select 1 from public.pos_shifts where status = 'open') into open_shift;
  perform set_config('request.headers', '{"x-pos-device":"TEST-THIET-BI-31"}', true);
  items_ok := jsonb_build_array(
    jsonb_build_object('id',m_k,'name','K','price',p_k,'qty',2,'sent',0,'station','kitchen','note',''),
    jsonb_build_object('id',m_b,'name','B','price',p_b,'qty',1,'sent',0,'station','bar','note',''));

  -- ================= 1. ANON (chưa đăng nhập) =================
  for t in select c.relname from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
            where ns.nspname = 'public' and c.relkind in ('r','p','v','m') order by 1 loop
    anon_n := anon_n + 1;
    line := pg_temp.ck('x', null, format('select 1 from public.%I limit 1', t.relname), 'permission denied');
    if left(line, 1) <> '✓' then anon_open := anon_open || ' ' || t.relname || '(đọc)'; end if;
    line := pg_temp.ck('x', null, format('dele' || 'te from public.%I where false', t.relname), 'permission denied');
    if left(line, 1) <> '✓' then anon_open := anon_open || ' ' || t.relname || '(ghi)'; end if;
  end loop;
  if anon_open = '' then res := res || E'\n✓ ANON: 0/' || anon_n || ' bảng đọc/ghi được'; pass := pass + 1;
  else res := res || E'\n✗ ANON còn mở:' || anon_open; fail := fail + 1; end if;
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.prokind = 'f' and p.proname <> 'rls_auto_enable' and has_function_privilege('anon', p.oid, 'EXECUTE');
  if n = 0 then res := res || E'\n✓ ANON: 0 hàm RPC gọi được'; pass := pass + 1; else res := res || E'\n✗ ANON gọi được ' || n || ' hàm'; fail := fail + 1; end if;
  line := pg_temp.ck('ANON gọi pos_send_order', null, 'select public.pos_send_order(1, gen_random_uuid())', 'permission denied');
  res := res || E'\n' || line; if left(line,1) = '✓' then pass := pass + 1; else fail := fail + 1; end if;
  select count(*) into n from pg_policies where schemaname = 'public' and ('anon' = any(roles) or 'public' = any(roles));
  if n = 0 then res := res || E'\n✓ Không còn policy nào mở cho anon/public'; pass := pass + 1; else res := res || E'\n✗ Còn ' || n || ' policy mở cho anon/public'; fail := fail + 1; end if;
  select count(*) into n from pg_class c join pg_namespace ns on ns.oid = c.relnamespace where ns.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity;
  if n = 0 then res := res || E'\n✓ RLS bật 100% bảng'; pass := pass + 1; else res := res || E'\n✗ ' || n || ' bảng chưa bật RLS'; fail := fail + 1; end if;

  -- ================= 2. PHỤC VỤ =================
  for line in select unnest(array[
    pg_temp.ck('Phục vụ tạo đơn bàn', u_wai, format('insert into public.pos_table_orders(table_no,items,status,discount,rev,client_id) values (%s, %L::jsonb, ''busy'', 0, 1, ''TEST'')', tbl, items_ok), null)
  ]) loop res := res || E'\n' || line; if left(line,1) = '✓' then pass := pass + 1; else fail := fail + 1; end if; end loop;
  select o.rev into rev from public.pos_table_orders o where table_no = tbl;
  for line in select unnest(array[
    pg_temp.ck('Phục vụ sửa giá món', u_wai, format('update public.pos_table_orders set items = jsonb_set(items, ''{0,price}'', ''1000''), base_rev = %s where table_no = %s', rev, tbl), 'Sai giá'),
    pg_temp.ck('Phục vụ thêm món không có trong thực đơn', u_wai, format('update public.pos_table_orders set items = items || ''[{"id":987654321,"name":"X","price":1,"qty":1,"sent":0}]''::jsonb, base_rev = %s where table_no = %s', rev, tbl), 'không có trong thực đơn'),
    pg_temp.ck('Phục vụ đổi khu Bếp/Bar', u_wai, format('update public.pos_table_orders set items = jsonb_set(items, ''{0,station}'', ''"bar"''), base_rev = %s where table_no = %s', rev, tbl), 'khu chế biến'),
    pg_temp.ck('Phục vụ tự giảm giá', u_wai, format('update public.pos_table_orders set discount = 10, base_rev = %s where table_no = %s', rev, tbl), 'Vượt quyền giảm giá'),
    pg_temp.ck('Phục vụ tự đánh dấu đã gửi (né phiếu bếp)', u_wai, format('update public.pos_table_orders set items = jsonb_set(items, ''{0,sent}'', ''2''), base_rev = %s where table_no = %s', rev, tbl), 'chỉ được đánh dấu đã gửi'),
    pg_temp.ck('Ghi đè bằng dữ liệu cũ (sai phiên bản)', u_wai, format('update public.pos_table_orders set status = ''x'', base_rev = %s where table_no = %s', rev - 1, tbl), 'POS_CONFLICT'),
    pg_temp.ck('Phục vụ tự chèn phiếu bếp', u_wai, format('insert into public.pos_tickets(id,table_no,item,qty,station) values (gen_random_uuid(), %s, ''X'', 1, ''kitchen'')', tbl), 'row-level security'),
    pg_temp.ck('Phục vụ gửi Bếp/Bar (qua máy chủ)', u_wai, format('select public.pos_send_order(%s, gen_random_uuid())', tbl), null)
  ]) loop res := res || E'\n' || line; if left(line,1) = '✓' then pass := pass + 1; else fail := fail + 1; end if; end loop;
  v := pg_temp.val(u_wai, format('select (public.pos_send_order(%s, gen_random_uuid()))->>''count''', tbl));
  select count(*) into n from public.pos_tickets where table_no = tbl;
  if v = '0' and n = 2 then res := res || E'\n✓ Gửi lại không có món mới → 0 phiếu; tổng 2 phiếu (không trùng)'; pass := pass + 1;
  else res := res || E'\n✗ Gửi trùng: lần 2 = ' || coalesce(v,'?') || ', tổng phiếu ' || n; fail := fail + 1; end if;
  select created_by into v from public.pos_tickets where table_no = tbl limit 1;
  if v = 'TEST-phucvu' then res := res || E'\n✓ Phiếu ghi đúng người gửi (máy chủ)'; pass := pass + 1; else res := res || E'\n✗ Người gửi: ' || coalesce(v,'?'); fail := fail + 1; end if;
  select id into tk from public.pos_tickets where table_no = tbl and station <> 'bar' limit 1;
  select id into tb from public.pos_tickets where table_no = tbl and station = 'bar' limit 1;
  select o.rev into rev from public.pos_table_orders o where table_no = tbl;
  for line in select unnest(array[
    pg_temp.ck('Phục vụ bớt món đã gửi bếp', u_wai, format('update public.pos_table_orders set items = jsonb_set(items, ''{0,sent}'', ''1''), base_rev = %s where table_no = %s', rev, tbl), 'hủy / bớt món đã gửi'),
    pg_temp.ck('Phục vụ thanh toán', u_wai, format('insert into public.pos_bills(id,table_no,items,subtotal,discount,total,method) values (gen_random_uuid(), %s, ''[]'', 0, 0, 0, ''Tiền mặt'')', tbl), 'quyền thanh toán'),
    pg_temp.ck('Phục vụ sửa giá thực đơn', u_wai, format('update public.menu_items set price = 1 where id = %s', m_k), '0rows'),
    pg_temp.ck('Phục vụ đọc Audit Log', u_wai, 'update public.pos_audit set detail = detail where false', '0rows'),
    pg_temp.ck('Phục vụ tự đổi vai trò thành OWNER', u_wai, format('update public.users set role_code = ''owner'' where auth_user_id = %L', u_wai), '0rows')
  ]) loop res := res || E'\n' || line; if left(line,1) = '✓' then pass := pass + 1; else fail := fail + 1; end if; end loop;
  v := pg_temp.val(u_wai, 'select count(*) from public.pos_bills');
  if v = '0' then res := res || E'\n✓ Phục vụ không xem được doanh thu (0 hóa đơn)'; pass := pass + 1; else res := res || E'\n✗ Phục vụ xem được hóa đơn: ' || v; fail := fail + 1; end if;
  v := pg_temp.val(u_wai, 'select count(*) from public.pos_audit');
  if v = '0' then res := res || E'\n✓ Phục vụ không xem được Audit Log'; pass := pass + 1; else res := res || E'\n✗ Phục vụ xem được Audit: ' || v; fail := fail + 1; end if;
  v := pg_temp.val(u_wai, 'select (public.pos_my_perms())->>''role'' || coalesce((public.pos_my_perms())->>''pay'',''-'')');
  if v = 'waiter-' then res := res || E'\n✓ Quyền lấy từ máy chủ theo tài khoản (waiter, không có thanh toán)'; pass := pass + 1; else res := res || E'\n✗ pos_my_perms: ' || coalesce(v,'?'); fail := fail + 1; end if;

  -- ================= 3. BẾP / BAR =================
  for line in select unnest(array[
    pg_temp.ck('Bếp cập nhật phiếu Bếp', u_kit, format('update public.pos_tickets set status = ''ĐANG LÀM'' where id = %L', tk), null),
    pg_temp.ck('Bếp cập nhật phiếu Bar', u_kit, format('update public.pos_tickets set status = ''ĐANG LÀM'' where id = %L', tb), '0rows'),
    pg_temp.ck('Bếp sửa số lượng phiếu', u_kit, format('update public.pos_tickets set qty = 9 where id = %L', tk), 'Không được sửa nội dung phiếu'),
    pg_temp.ck('Bar cập nhật phiếu Bar', u_bar, format('update public.pos_tickets set status = ''HOÀN THÀNH'' where id = %L', tb), null),
    pg_temp.ck('Bar cập nhật phiếu Bếp', u_bar, format('update public.pos_tickets set status = ''HOÀN THÀNH'' where id = %L', tk), '0rows')
  ]) loop res := res || E'\n' || line; if left(line,1) = '✓' then pass := pass + 1; else fail := fail + 1; end if; end loop;
  v := pg_temp.val(u_kit, 'select (select count(*) from public.pos_bills) + (select count(*) from public.pos_shifts) + (select count(*) from public.pos_cash_moves) + (select count(*) from public.pos_table_orders)');
  if v = '0' then res := res || E'\n✓ Bếp không xem được doanh thu / ca / thu chi / giá bàn'; pass := pass + 1; else res := res || E'\n✗ Bếp xem được: ' || v; fail := fail + 1; end if;
  perform pg_temp.ck('x', u_kit, format('update public.pos_tickets set status = ''MỚI'' where id = %L', tk), null);
  select status into v from public.pos_tickets where id = tk;
  if v = 'ĐANG LÀM' then res := res || E'\n✓ Trạng thái phiếu không lùi được'; pass := pass + 1; else res := res || E'\n✗ Trạng thái phiếu: ' || coalesce(v,'?'); fail := fail + 1; end if;

  -- ================= 4. THU NGÂN & HÓA ĐƠN =================
  select o.rev into rev from public.pos_table_orders o where table_no = tbl;
  for line in select unnest(array[
    pg_temp.ck('Thu ngân giảm 10% (vượt quyền 5%)', u_cas, format('update public.pos_table_orders set discount = 10, base_rev = %s where table_no = %s', rev, tbl), 'Vượt quyền giảm giá'),
    pg_temp.ck('Thu ngân sửa kho', u_cas, format('select public.pos_stock_post(''NHẬP'', %s, ''KHO'', 5, null, null, ''x'')', ing), 'quyền'),
    pg_temp.ck('Thu ngân sửa giá thực đơn', u_cas, format('update public.menu_items set price = 1 where id = %s', m_k), '0rows')
  ]) loop res := res || E'\n' || line; if left(line,1) = '✓' then pass := pass + 1; else fail := fail + 1; end if; end loop;
  select o.items into items_ok from public.pos_table_orders o where table_no = tbl;
  sub := 2 * p_k + p_b;
  for line in select unnest(array[
    pg_temp.ck('Thanh toán giá món bị sửa thấp', u_cas, format('insert into public.pos_bills(id,table_no,items,subtotal,discount,total,method) values (gen_random_uuid(), %s, %L::jsonb, %s, 0, %s, ''Tiền mặt'')', tbl, jsonb_set(items_ok, '{0,price}', '1000'), 2000 + p_b, 2000 + p_b), 'POS_CONFLICT'),
    pg_temp.ck('Thanh toán tổng tiền thấp hơn', u_cas, format('insert into public.pos_bills(id,table_no,items,subtotal,discount,total,method) values (gen_random_uuid(), %s, %L::jsonb, %s, 0, 1000, ''Tiền mặt'')', tbl, items_ok, sub), 'Tổng tiền không khớp'),
    pg_temp.ck('Tự giảm giá lúc thanh toán', u_cas, format('insert into public.pos_bills(id,table_no,items,subtotal,discount,total,method) values (gen_random_uuid(), %s, %L::jsonb, %s, 5, %s, ''Tiền mặt'')', tbl, items_ok, sub, round(sub * 0.95)), 'không khớp đơn bàn'),
    pg_temp.ck('Tiền khách đưa ít hơn', u_cas, format('insert into public.pos_bills(id,table_no,items,subtotal,discount,total,method,cash_given) values (gen_random_uuid(), %s, %L::jsonb, %s, 0, %s, ''Tiền mặt'', 1000)', tbl, items_ok, sub, sub), 'Tiền khách đưa'),
    pg_temp.ck('Thu ngân thanh toán hợp lệ (giả mạo người lập)', u_cas, format('insert into public.pos_bills(id,table_no,items,subtotal,discount,total,method,cash_given,change_amount,created_by) values (%L, %s, %L::jsonb, %s, 0, %s, ''Tiền mặt'', %s, 999999, ''GIA-MAO'')', bill, tbl, items_ok, sub, sub, sub + 50000), null),
    pg_temp.ck('Thanh toán lần 2 cùng bàn', u_cas, format('insert into public.pos_bills(id,table_no,items,subtotal,discount,total,method) values (gen_random_uuid(), %s, %L::jsonb, %s, 0, %s, ''Tiền mặt'')', tbl, items_ok, sub, sub), 'POS_PAID')
  ]) loop res := res || E'\n' || line; if left(line,1) = '✓' then pass := pass + 1; else fail := fail + 1; end if; end loop;
  select created_by || '|' || change_amount::bigint || '|' || device into v from public.pos_bills where id = bill;
  if v = 'TEST-thungan|50000|TEST-THIET-BI-31' then res := res || E'\n✓ Máy chủ ghi đúng người, thiết bị, tự tính tiền trả lại 50.000'; pass := pass + 1; else res := res || E'\n✗ Hóa đơn ghi: ' || coalesce(v,'?'); fail := fail + 1; end if;
  select jsonb_array_length(items) into n from public.pos_table_orders where table_no = tbl;
  if n = 0 then res := res || E'\n✓ Máy chủ tự làm trống bàn sau thanh toán'; pass := pass + 1; else res := res || E'\n✗ Bàn còn ' || n || ' món'; fail := fail + 1; end if;
  select qty into v_tot from public.pos_stock where ingredient_id = ing and location = 'BEP';
  if v_tot = 800 then res := res || E'\n✓ Trừ kho đúng 1 lần (1000 → 800)'; pass := pass + 1; else res := res || E'\n✗ Tồn sau bán: ' || v_tot; fail := fail + 1; end if;
  for line in select unnest(array[
    pg_temp.ck('Thu ngân sửa tiền hóa đơn đã thanh toán', u_cas, format('update public.pos_bills set total = 1 where id = %L', bill), '0rows'),
    pg_temp.ck('Thu ngân hủy hóa đơn', u_cas, format('update public.pos_bills set cancelled = true, cancel_reason = ''x'' where id = %L', bill), '0rows'),
    pg_temp.ck('Xóa hóa đơn', u_own, format('dele' || 'te from public.pos_bills where id = %L', bill), 'permission denied'),
    pg_temp.ck('OWNER sửa nội dung hóa đơn đã thanh toán', u_own, format('update public.pos_bills set method = ''Thẻ'' where id = %L', bill), 'Không được sửa nội dung hóa đơn'),
    pg_temp.ck('Tự tăng số lần in', u_own, format('update public.pos_bills set print_count = 5 where id = %L', bill), 'chức năng in'),
    pg_temp.ck('Quản lý hủy hóa đơn có lý do', u_mgr, format('update public.pos_bills set cancelled = true, cancel_reason = ''TEST hủy'' where id = %L', bill), null),
    pg_temp.ck('Hủy lần 2 / sửa lý do hủy', u_mgr, format('update public.pos_bills set cancel_reason = ''khác'' where id = %L', bill), 'Không được sửa thông tin hủy'),
    pg_temp.ck('Khôi phục hóa đơn đã hủy', u_own, format('update public.pos_bills set cancelled = false where id = %L', bill), 'không thể khôi phục')
  ]) loop res := res || E'\n' || line; if left(line,1) = '✓' then pass := pass + 1; else fail := fail + 1; end if; end loop;
  select total into v_tot from public.pos_bills where id = bill;
  if v_tot = sub then res := res || E'\n✓ Tổng hóa đơn không đổi sau mọi thao tác sửa trái phép'; pass := pass + 1; else res := res || E'\n✗ Tổng hóa đơn bị đổi: ' || v_tot; fail := fail + 1; end if;
  select qty into v_tot from public.pos_stock where ingredient_id = ing and location = 'BEP';
  select count(*) into n from public.pos_stock_moves where ingredient_id = ing and type = 'HOÀN HĐ HỦY';
  if v_tot = 1000 and n = 1 then res := res || E'\n✓ Hoàn kho đúng 1 lần khi hủy (800 → 1000)'; pass := pass + 1; else res := res || E'\n✗ Hoàn kho: tồn ' || v_tot || ', số phiếu hoàn ' || n; fail := fail + 1; end if;

  -- ================= 5. AUDIT LOG / VAI TRÒ =================
  for line in select unnest(array[
    pg_temp.ck('OWNER sửa Audit Log', u_own, 'update public.pos_audit set detail = ''sửa'' where true', '0rows'),
    pg_temp.ck('OWNER xóa Audit Log', u_own, 'dele' || 'te from public.pos_audit where true', 'permission denied'),
    pg_temp.ck('Quản lý ghi Audit giả danh OWNER', u_mgr, 'insert into public.pos_audit(action, detail, actor, role, device) values (''TEST-GIA'', ''x'', ''owner'', ''owner'', ''may-gia'')', null),
    pg_temp.ck('Quản lý tự nâng quyền nhân viên', u_mgr, format('select public.pos_staff_save(''x@test.vn'', ''x'', null, ''manager'', true, ''{}''::jsonb)'), 'OWNER'),
    pg_temp.ck('OWNER đổi tài khoản OWNER qua màn Nhân viên', u_own, format('select public.pos_staff_save(%L, ''x'', null, ''waiter'', true, ''{}''::jsonb)', v_email), 'OWNER')
  ]) loop res := res || E'\n' || line; if left(line,1) = '✓' then pass := pass + 1; else fail := fail + 1; end if; end loop;
  select actor || '|' || role || '|' || device into v from public.pos_audit where action = 'TEST-GIA';
  if v = 'TEST-quanly|manager|TEST-THIET-BI-31' then res := res || E'\n✓ Audit ghi đúng người thật (không giả danh được)'; pass := pass + 1; else res := res || E'\n✗ Audit ghi: ' || coalesce(v,'?'); fail := fail + 1; end if;
  begin
    update public.pos_audit set detail = detail where action = 'TEST-GIA';
    res := res || E'\n✗ Audit sửa được bằng quyền quản trị'; fail := fail + 1;
  exception when others then res := res || E'\n✓ Audit chỉ ghi thêm (kể cả quyền quản trị CSDL bị chặn)'; pass := pass + 1; end;
  select role_code into v from public.users where auth_user_id = u_wai;
  if v = 'waiter' then res := res || E'\n✓ Vai trò phục vụ không bị đổi'; pass := pass + 1; else res := res || E'\n✗ Vai trò bị đổi: ' || v; fail := fail + 1; end if;

  -- ================= 6. KHO / CA =================
  for line in select unnest(array[
    pg_temp.ck('Kho nhập kho', u_sto, format('select public.pos_stock_post(''NHẬP'', %s, ''KHO'', 5, null, null, ''TEST'')', ing), null),
    pg_temp.ck('Bếp nhập kho', u_kit, format('select public.pos_stock_post(''NHẬP'', %s, ''KHO'', 5, null, null, ''TEST'')', ing), 'quyền'),
    pg_temp.ck('Kho thanh toán', u_sto, format('insert into public.pos_bills(id,table_no,items,subtotal,discount,total,method) values (gen_random_uuid(), %s, ''[]'', 0, 0, 0, ''Tiền mặt'')', tbl), 'quyền thanh toán')
  ]) loop res := res || E'\n' || line; if left(line,1) = '✓' then pass := pass + 1; else fail := fail + 1; end if; end loop;
  if not open_shift then
    for line in select unnest(array[
      pg_temp.ck('Thu ngân mở ca', u_cas, 'insert into public.pos_shifts(id, opening) values (''00000000-0000-0000-0000-0000000031c1'', 300000)', null),
      pg_temp.ck('Đóng ca lệch không lý do', u_cas, 'update public.pos_shifts set status = ''closed'', actual = 100, expected = 100, diff = 0 where id = ''00000000-0000-0000-0000-0000000031c1''', 'lý do'),
      pg_temp.ck('Đóng ca (khai sai "phải có")', u_cas, 'update public.pos_shifts set status = ''closed'', actual = 300000, expected = 1, diff = 0 where id = ''00000000-0000-0000-0000-0000000031c1''', null)
    ]) loop res := res || E'\n' || line; if left(line,1) = '✓' then pass := pass + 1; else fail := fail + 1; end if; end loop;
    select expected::bigint || '|' || diff::bigint into v from public.pos_shifts where id = '00000000-0000-0000-0000-0000000031c1';
    if v = '300000|0' then res := res || E'\n✓ Máy chủ tự tính "phải có" = 300.000 (bỏ qua số khai sai)'; pass := pass + 1; else res := res || E'\n✗ Ca: ' || coalesce(v,'?'); fail := fail + 1; end if;
  else
    res := res || E'\n• Bỏ qua thử đóng ca: đang có ca thật mở';
  end if;

  -- ---------- KẾT THÚC: HOÀN TÁC TOÀN BỘ dữ liệu thử ----------
  raise exception '__HOAN_TAC__';
 exception when others then
  if sqlerrm <> '__HOAN_TAC__' then res := res || E'\n✗ LỖI BẤT NGỜ: ' || sqlerrm; fail := fail + 1; end if;
 end;
  execute 'reset role';
  select max(bill_no) into v_keep from public.pos_bills;
  if v_keep is not null and v_keep > v_last then perform setval(v_seq, v_keep, true);
  else perform setval(v_seq, v_last, v_called); end if;
  perform set_config('pos.kq', format(E'KẾT QUẢ KIỂM THỬ BẢO MẬT 3.1: %s ĐẠT / %s LỖI (đã hoàn tác toàn bộ, không lưu dữ liệu)%s', pass, fail, res), false);
end $$;
select current_setting('pos.kq') as ket_qua;
