-- =====================================================================
-- MÂY POS – KIỂM THỬ PHÂN QUYỀN PHÍA MÁY CHỦ (an toàn với dữ liệu thật)
-- Tạo nhân viên TEST tạm thời, giả lập từng vai trò, thử việc ĐƯỢC PHÉP và
-- KHÔNG ĐƯỢC PHÉP. Cuối bài luôn báo lỗi có chủ đích để HOÀN TÁC TOÀN BỘ:
-- không lưu lại bất kỳ dòng dữ liệu nào. Kết quả nằm trong thông báo lỗi.
-- =====================================================================
do $$
declare
  res text := ''; pass int := 0; fail int := 0;
  u_mgr uuid := gen_random_uuid(); u_cas uuid := gen_random_uuid(); u_wai uuid := gen_random_uuid();
  u_kit uuid := gen_random_uuid(); u_bar uuid := gen_random_uuid(); u_sto uuid := gen_random_uuid(); u_own uuid;
  m_k bigint; m_b bigint; p_k numeric; p_b numeric; ing bigint; bill uuid := gen_random_uuid(); bill2 uuid := gen_random_uuid();
  tk uuid := gen_random_uuid(); tb uuid := gen_random_uuid(); n int; t text; perms jsonb; sh uuid := gen_random_uuid();
  tbl int := 9999;   -- bàn ảo, không trùng bàn thật
  procedure_dummy int;
  v_seq text; v_last bigint; v_called boolean; v_keep bigint;
begin
  -- ---------- Chuẩn bị (quyền quản trị) ----------
  -- Ghi nhớ số hóa đơn hiện tại để trả lại sau bài test (không làm nhảy số HĐ thật)
  v_seq := pg_get_serial_sequence('public.pos_bills', 'bill_no');
  execute format('select last_value, is_called from %s', v_seq) into v_last, v_called;
  select id, price into m_k, p_k from public.menu_items where station = 'kitchen' and price > 0 order by id limit 1;
  select id, price into m_b, p_b from public.menu_items where station = 'bar' and price > 0 order by id limit 1;
  select auth_user_id into u_own from public.users where role_code = 'owner' limit 1;
  insert into public.users(auth_user_id, username, role_code) values
    (u_mgr,'TEST-quanly','manager'),(u_cas,'TEST-thungan','cashier'),(u_wai,'TEST-phucvu','waiter'),
    (u_kit,'TEST-bep','kitchen'),(u_bar,'TEST-bar','bar'),(u_sto,'TEST-kho','stock');
  insert into public.pos_ingredients(code,name,unit) values ('ZZTEST-QUYEN','TEST quyền','g') returning id into ing;
  perform set_config('request.headers', '{"x-pos-device":"TEST-THIET-BI-01"}', true);

  -- Hàm tiện ích dạng khối lặp: đổi người dùng
  -- (dùng execute để đổi vai trò Postgres sang authenticated như khi gọi từ app)

  -- ================= PHỤC VỤ (waiter) =================
  perform set_config('request.jwt.claim.sub', u_wai::text, true); execute 'set local role authenticated';
  perms := public.pos_my_perms();
  begin insert into public.pos_table_orders(table_no, items, status, discount)
        values (tbl, jsonb_build_array(jsonb_build_object('id',m_k,'name','K','price',p_k,'qty',2,'sent',0,'station','kitchen'),
                                       jsonb_build_object('id',m_b,'name','B','price',p_b,'qty',1,'sent',0,'station','bar')), 'busy', 0)
        on conflict (table_no) do update set items = excluded.items;
        res := res || E'\n✓ Phục vụ gọi món (tạo đơn bàn)'; pass := pass + 1;
  exception when others then res := res || E'\n✗ Phục vụ gọi món: ' || sqlerrm; fail := fail + 1; end;
  begin insert into public.pos_tickets(id, table_no, item_id, item, qty, station, batch_id, round, created_by)
        values (tk, tbl, m_k::text, 'K', 2, 'kitchen', gen_random_uuid(), 1, 'GIA-MAO'), (tb, tbl, m_b::text, 'B', 1, 'bar', gen_random_uuid(), 1, 'GIA-MAO');
        update public.pos_table_orders set items = (select jsonb_agg(i || jsonb_build_object('sent', i->'qty')) from jsonb_array_elements(items) i) where table_no = tbl;
        res := res || E'\n✓ Phục vụ gửi Bếp/Bar (tạo phiếu + đánh dấu đã gửi)'; pass := pass + 1;
  exception when others then res := res || E'\n✗ Phục vụ gửi Bếp/Bar: ' || sqlerrm; fail := fail + 1; end;
  begin update public.pos_table_orders set discount = 10 where table_no = tbl;
        res := res || E'\n✗ Phục vụ GIẢM GIÁ: KHÔNG bị chặn'; fail := fail + 1;
  exception when others then res := res || E'\n✓ Chặn phục vụ giảm giá: ' || sqlerrm; pass := pass + 1; end;
  begin update public.pos_table_orders set items = '[]'::jsonb where table_no = tbl;
        res := res || E'\n✗ Phục vụ HỦY MÓN ĐÃ GỬI: KHÔNG bị chặn'; fail := fail + 1;
  exception when others then res := res || E'\n✓ Chặn phục vụ hủy món đã gửi: ' || sqlerrm; pass := pass + 1; end;
  begin insert into public.pos_bills(id, table_no, items, subtotal, discount, total, method)
        values (gen_random_uuid(), tbl, jsonb_build_array(jsonb_build_object('id',m_k,'price',p_k,'qty',1)), p_k, 0, p_k, 'Tiền mặt');
        res := res || E'\n✗ Phục vụ THANH TOÁN: KHÔNG bị chặn'; fail := fail + 1;
  exception when others then res := res || E'\n✓ Chặn phục vụ thanh toán: ' || sqlerrm; pass := pass + 1; end;
  select count(*) into n from public.pos_bills;
  if n = 0 then res := res || E'\n✓ Phục vụ không xem được doanh thu (0 hóa đơn)'; pass := pass + 1; else res := res || E'\n✗ Phục vụ xem được ' || n || ' hóa đơn'; fail := fail + 1; end if;
  select count(*) into n from public.pos_audit;
  if n = 0 then res := res || E'\n✓ Phục vụ không xem được Audit Log'; pass := pass + 1; else res := res || E'\n✗ Phục vụ xem được Audit Log'; fail := fail + 1; end if;
  update public.pos_tickets set status = 'HOÀN THÀNH' where id = tk; get diagnostics n = row_count;
  if n = 0 then res := res || E'\n✓ Phục vụ không cập nhật được phiếu Bếp'; pass := pass + 1; else res := res || E'\n✗ Phục vụ cập nhật được phiếu Bếp'; fail := fail + 1; end if;
  begin perform public.pos_stock_post(p_type => 'NHẬP', p_ing => ing, p_loc => 'KHO', p_qty => 5);
        res := res || E'\n✗ Phục vụ NHẬP KHO: KHÔNG bị chặn'; fail := fail + 1;
  exception when others then res := res || E'\n✓ Chặn phục vụ nhập kho'; pass := pass + 1; end;
  insert into public.pos_audit(actor, role, device, action, detail) values ('GIA-MAO','owner','GIA-MAO','TEST ghi nhật ký','x');
  execute 'reset role';
  select actor || '|' || role || '|' || device into t from public.pos_audit where action = 'TEST ghi nhật ký' order by id desc limit 1;
  if t = 'TEST-phucvu|waiter|TEST-THIET-BI-01' then res := res || E'\n✓ Audit tự ghi đúng người/vai trò/thiết bị, không giả mạo được (' || t || ')'; pass := pass + 1;
  else res := res || E'\n✗ Audit ghi sai: ' || coalesce(t,'(trống)'); fail := fail + 1; end if;
  select created_by into t from public.pos_tickets where id = tk;
  if t = 'TEST-phucvu' then res := res || E'\n✓ Phiếu Bếp ghi đúng nhân viên order (chặn giả mạo tên)'; pass := pass + 1; else res := res || E'\n✗ Phiếu Bếp ghi người gửi: ' || coalesce(t,'?'); fail := fail + 1; end if;

  -- ================= BẾP (kitchen) =================
  perform set_config('request.jwt.claim.sub', u_kit::text, true); execute 'set local role authenticated';
  update public.pos_tickets set status = 'ĐANG LÀM' where id = tk; get diagnostics n = row_count;
  if n = 1 then res := res || E'\n✓ Bếp cập nhật phiếu Bếp'; pass := pass + 1; else res := res || E'\n✗ Bếp không cập nhật được phiếu Bếp'; fail := fail + 1; end if;
  update public.pos_tickets set status = 'ĐANG LÀM' where id = tb; get diagnostics n = row_count;
  if n = 0 then res := res || E'\n✓ Bếp không cập nhật được phiếu Bar'; pass := pass + 1; else res := res || E'\n✗ Bếp cập nhật được phiếu Bar'; fail := fail + 1; end if;
  update public.pos_tickets set status = 'MỚI' where id = tk;
  select count(*) into n from public.pos_tickets where id = tk and status = 'ĐANG LÀM';
  if n = 1 then res := res || E'\n✓ Trạng thái phiếu không lùi được'; pass := pass + 1; else res := res || E'\n✗ Trạng thái phiếu bị lùi'; fail := fail + 1; end if;
  select (select count(*) from public.pos_bills) + (select count(*) from public.pos_cash_moves) + (select count(*) from public.pos_shifts) into n;
  if n = 0 then res := res || E'\n✓ Bếp không xem được doanh thu / ca / thu chi'; pass := pass + 1; else res := res || E'\n✗ Bếp xem được dữ liệu tiền (' || n || ' dòng)'; fail := fail + 1; end if;
  select count(*) into n from public.pos_table_orders;
  if n = 0 then res := res || E'\n✓ Bếp không xem được đơn bàn (giá tiền)'; pass := pass + 1; else res := res || E'\n✗ Bếp xem được đơn bàn'; fail := fail + 1; end if;
  begin insert into public.pos_tickets(id, table_no, item, qty, station) values (gen_random_uuid(), tbl, 'X', 1, 'kitchen');
        res := res || E'\n✗ Bếp TỰ TẠO PHIẾU: KHÔNG bị chặn'; fail := fail + 1;
  exception when others then res := res || E'\n✓ Chặn bếp tự tạo phiếu'; pass := pass + 1; end;
  execute 'reset role';

  -- ================= BAR =================
  perform set_config('request.jwt.claim.sub', u_bar::text, true); execute 'set local role authenticated';
  update public.pos_tickets set status = 'HOÀN THÀNH' where id = tb; get diagnostics n = row_count;
  if n = 1 then res := res || E'\n✓ Bar cập nhật phiếu Bar'; pass := pass + 1; else res := res || E'\n✗ Bar không cập nhật được phiếu Bar'; fail := fail + 1; end if;
  update public.pos_tickets set status = 'HOÀN THÀNH' where id = tk; get diagnostics n = row_count;
  if n = 0 then res := res || E'\n✓ Bar không cập nhật được phiếu Bếp'; pass := pass + 1; else res := res || E'\n✗ Bar cập nhật được phiếu Bếp'; fail := fail + 1; end if;
  select count(*) into n from public.pos_bills;
  if n = 0 then res := res || E'\n✓ Bar không xem được doanh thu'; pass := pass + 1; else res := res || E'\n✗ Bar xem được doanh thu'; fail := fail + 1; end if;
  execute 'reset role';

  -- ================= THU NGÂN (cashier) =================
  perform set_config('request.jwt.claim.sub', u_cas::text, true); execute 'set local role authenticated';
  begin insert into public.pos_shifts(id, opening) values (sh, 300000);
        insert into public.pos_cash_moves(id, shift_id, type, amount, category, created_by) values (gen_random_uuid(), sh, 'CHI', 10000, 'TEST', 'GIA-MAO');
        res := res || E'\n✓ Thu ngân mở ca + lập phiếu chi'; pass := pass + 1;
  exception when others then res := res || E'\n✗ Thu ngân mở ca / phiếu chi: ' || sqlerrm; fail := fail + 1; end;
  begin insert into public.pos_bills(id, table_no, items, subtotal, discount, total, method, created_by)
        values (bill2, tbl, jsonb_build_array(jsonb_build_object('id',m_k,'price',p_k,'qty',1)), p_k, 10, round(p_k*0.9), 'Tiền mặt', 'GIA-MAO');
        res := res || E'\n✗ Thu ngân giảm 10% (vượt 5%): KHÔNG bị chặn'; fail := fail + 1;
  exception when others then res := res || E'\n✓ Chặn thu ngân giảm vượt quyền: ' || sqlerrm; pass := pass + 1; end;
  begin insert into public.pos_bills(id, table_no, items, subtotal, discount, total, method)
        values (gen_random_uuid(), tbl, jsonb_build_array(jsonb_build_object('id',m_k,'price',p_k,'qty',1)), p_k, 0, 1000, 'Tiền mặt');
        res := res || E'\n✗ Hóa đơn tổng tiền sai: KHÔNG bị chặn'; fail := fail + 1;
  exception when others then res := res || E'\n✓ Chặn hóa đơn tổng tiền không khớp: ' || sqlerrm; pass := pass + 1; end;
  begin insert into public.pos_bills(id, table_no, items, subtotal, discount, total, method, created_by, cash_given, change_amount)
        values (bill, tbl, jsonb_build_array(jsonb_build_object('id',m_k,'price',p_k,'qty',2,'station','kitchen'),jsonb_build_object('id',m_b,'price',p_b,'qty',1,'station','bar')),
                2*p_k+p_b, 5, (2*p_k+p_b)*0.95, 'Tiền mặt', 'GIA-MAO', 1000000, 1000000-(2*p_k+p_b)*0.95);
        res := res || E'\n✓ Thu ngân thanh toán (giảm 5% đúng quyền)'; pass := pass + 1;
  exception when others then res := res || E'\n✗ Thu ngân thanh toán: ' || sqlerrm; fail := fail + 1; end;
  begin update public.pos_bills set total = 1 where id = bill; get diagnostics n = row_count;
        if n = 0 then res := res || E'\n✓ Chặn thu ngân sửa doanh thu đã thanh toán'; pass := pass + 1; else res := res || E'\n✗ Thu ngân SỬA được doanh thu'; fail := fail + 1; end if;
  exception when others then res := res || E'\n✓ Chặn thu ngân sửa doanh thu đã thanh toán'; pass := pass + 1; end;
  begin update public.pos_bills set cancelled = true, cancel_reason = 'x' where id = bill; get diagnostics n = row_count;
        if n = 0 then res := res || E'\n✓ Chặn thu ngân hủy hóa đơn'; pass := pass + 1; else res := res || E'\n✗ Thu ngân HỦY được hóa đơn'; fail := fail + 1; end if;
  exception when others then res := res || E'\n✓ Chặn thu ngân hủy hóa đơn'; pass := pass + 1; end;
  delete from public.pos_bills where id = bill; get diagnostics n = row_count;
  if n = 0 then res := res || E'\n✓ Không ai xóa được hóa đơn'; pass := pass + 1; else res := res || E'\n✗ Xóa được hóa đơn'; fail := fail + 1; end if;
  begin perform public.pos_stock_post(p_type => 'ĐIỀU CHỈNH', p_ing => ing, p_loc => 'KHO', p_qty => 5, p_note => 'x');
        res := res || E'\n✗ Thu ngân SỬA KHO: KHÔNG bị chặn'; fail := fail + 1;
  exception when others then res := res || E'\n✓ Chặn thu ngân sửa kho'; pass := pass + 1; end;
  select count(*) into n from public.pos_audit;
  if n = 0 then res := res || E'\n✓ Thu ngân không xem được Audit Log'; pass := pass + 1; else res := res || E'\n✗ Thu ngân xem được Audit Log'; fail := fail + 1; end if;
  begin insert into public.pos_settings(key, value) values ('bank', '"HACK"') on conflict (key) do update set value = excluded.value;
        res := res || E'\n✗ Thu ngân SỬA TÀI KHOẢN NHẬN TIỀN: KHÔNG bị chặn'; fail := fail + 1;
  exception when others then res := res || E'\n✓ Chặn thu ngân sửa tài khoản nhận tiền'; pass := pass + 1; end;
  update public.menu_items set price = 1 where id = m_k; get diagnostics n = row_count;
  if n = 0 then res := res || E'\n✓ Thu ngân không sửa được giá món'; pass := pass + 1; else res := res || E'\n✗ Thu ngân sửa được giá món'; fail := fail + 1; end if;
  begin perform public.pos_staff_list(); res := res || E'\n✗ Thu ngân XEM DANH SÁCH NHÂN VIÊN: KHÔNG bị chặn'; fail := fail + 1;
  exception when others then res := res || E'\n✓ Chặn thu ngân quản lý nhân viên'; pass := pass + 1; end;
  select count(*) into n from public.pos_bills where id = bill;
  if n = 1 then res := res || E'\n✓ Thu ngân xem được hóa đơn (để in lại)'; pass := pass + 1; else res := res || E'\n✗ Thu ngân không xem được hóa đơn'; fail := fail + 1; end if;
  begin n := public.pos_bill_printed(bill); n := public.pos_bill_printed(bill);
        if n = 2 then res := res || E'\n✓ In hóa đơn: lần 2 được đánh dấu IN LẠI'; pass := pass + 1; else res := res || E'\n✗ Đếm số lần in sai: ' || n; fail := fail + 1; end if;
  exception when others then res := res || E'\n✗ In hóa đơn: ' || sqlerrm; fail := fail + 1; end;
  execute 'reset role';
  select created_by || '|' || device into t from public.pos_bills where id = bill;
  if t = 'TEST-thungan|TEST-THIET-BI-01' then res := res || E'\n✓ Hóa đơn ghi đúng thu ngân + thiết bị (chặn giả mạo)'; pass := pass + 1; else res := res || E'\n✗ Hóa đơn ghi người/thiết bị: ' || coalesce(t,'?'); fail := fail + 1; end if;
  select count(*) into n from public.pos_audit where action = 'IN LẠI HÓA ĐƠN' and actor = 'TEST-thungan';
  if n = 1 then res := res || E'\n✓ In lại hóa đơn có ghi Audit Log'; pass := pass + 1; else res := res || E'\n✗ In lại không ghi Audit'; fail := fail + 1; end if;
  select count(*) into n from public.pos_audit where action in ('THANH TOÁN','MỞ CA','PHIẾU CHI') and actor = 'TEST-thungan' and device = 'TEST-THIET-BI-01';
  if n = 3 then res := res || E'\n✓ Máy chủ tự ghi Audit: THANH TOÁN, MỞ CA, PHIẾU CHI (người + thiết bị)'; pass := pass + 1; else res := res || E'\n✗ Audit tự động thiếu (' || n || '/3)'; fail := fail + 1; end if;

  -- ================= KHO (stock) =================
  perform set_config('request.jwt.claim.sub', u_sto::text, true); execute 'set local role authenticated';
  begin perform public.pos_stock_post(p_type => 'NHẬP', p_ing => ing, p_loc => 'KHO', p_qty => 100, p_cost => 10, p_note => 'TEST');
        perform public.pos_stock_post(p_type => 'CHUYỂN', p_ing => ing, p_loc => 'KHO', p_qty => 40, p_to => 'BEP', p_note => 'TEST');
        perform public.pos_stock_post(p_type => 'KIỂM KÊ', p_ing => ing, p_loc => 'BEP', p_qty => 38, p_note => 'TEST');
        res := res || E'\n✓ Kho nhập / chuyển / kiểm kê'; pass := pass + 1;
  exception when others then res := res || E'\n✗ Kho thao tác: ' || sqlerrm; fail := fail + 1; end;
  select count(*) into n from public.pos_bills;
  if n = 0 then res := res || E'\n✓ Kho không xem được doanh thu'; pass := pass + 1; else res := res || E'\n✗ Kho xem được doanh thu'; fail := fail + 1; end if;
  begin insert into public.pos_bills(id, table_no, items, subtotal, discount, total, method)
        values (gen_random_uuid(), tbl, jsonb_build_array(jsonb_build_object('id',m_k,'price',p_k,'qty',1)), p_k, 0, p_k, 'Tiền mặt');
        res := res || E'\n✗ Kho THANH TOÁN: KHÔNG bị chặn'; fail := fail + 1;
  exception when others then res := res || E'\n✓ Chặn kho thanh toán'; pass := pass + 1; end;
  select count(*) into n from public.pos_audit;
  if n = 0 then res := res || E'\n✓ Kho không xem được Audit Log'; pass := pass + 1; else res := res || E'\n✗ Kho xem được Audit Log'; fail := fail + 1; end if;
  execute 'reset role';

  -- ================= QUẢN LÝ (manager) =================
  perform set_config('request.jwt.claim.sub', u_mgr::text, true); execute 'set local role authenticated';
  select count(*) into n from public.pos_audit;
  if n > 0 then res := res || E'\n✓ Quản lý xem được Audit Log'; pass := pass + 1; else res := res || E'\n✗ Quản lý không xem được Audit Log'; fail := fail + 1; end if;
  begin update public.pos_table_orders set discount = 25 where table_no = tbl;
        res := res || E'\n✗ Quản lý giảm 25% (vượt 20%): KHÔNG bị chặn'; fail := fail + 1;
  exception when others then res := res || E'\n✓ Chặn quản lý giảm vượt 20%'; pass := pass + 1; end;
  begin update public.pos_bills set cancelled = true, cancel_reason = 'TEST quản lý hủy' where id = bill; get diagnostics n = row_count;
        if n = 1 then res := res || E'\n✓ Quản lý hủy hóa đơn (có lý do)'; pass := pass + 1; else res := res || E'\n✗ Quản lý không hủy được'; fail := fail + 1; end if;
  exception when others then res := res || E'\n✗ Quản lý hủy hóa đơn: ' || sqlerrm; fail := fail + 1; end;
  begin update public.pos_bills set total = 1 where id = bill;
        res := res || E'\n✗ Quản lý SỬA SỐ TIỀN hóa đơn: KHÔNG bị chặn'; fail := fail + 1;
  exception when others then res := res || E'\n✓ Chặn cả quản lý sửa số tiền hóa đơn: ' || sqlerrm; pass := pass + 1; end;
  begin update public.pos_bills set cancelled = false where id = bill;
        res := res || E'\n✗ KHÔI PHỤC hóa đơn đã hủy: KHÔNG bị chặn'; fail := fail + 1;
  exception when others then res := res || E'\n✓ Chặn khôi phục hóa đơn đã hủy'; pass := pass + 1; end;
  begin perform public.pos_staff_list(); res := res || E'\n✗ Quản lý QUẢN LÝ NHÂN VIÊN: KHÔNG bị chặn'; fail := fail + 1;
  exception when others then res := res || E'\n✓ Chặn quản lý quản lý nhân viên (chỉ OWNER)'; pass := pass + 1; end;
  begin insert into public.pos_settings(key, value) values ('bank', '"HACK"') on conflict (key) do update set value = excluded.value;
        res := res || E'\n✗ Quản lý SỬA TÀI KHOẢN NHẬN TIỀN: KHÔNG bị chặn'; fail := fail + 1;
  exception when others then res := res || E'\n✓ Chặn quản lý sửa tài khoản nhận tiền'; pass := pass + 1; end;
  execute 'reset role';

  -- ================= QUYỀN RIÊNG do OWNER cấp =================
  update public.users set perms = '{"pay":true,"discount_max":3}'::jsonb where auth_user_id = u_wai;
  update public.users set perms = '{"audit":false,"bill_cancel":false}'::jsonb where auth_user_id = u_mgr;
  update public.users set perms = '{"staff":true,"settings":true}'::jsonb where auth_user_id = u_cas;
  perform set_config('request.jwt.claim.sub', u_wai::text, true); execute 'set local role authenticated';
  perms := public.pos_my_perms();
  if (perms->>'pay')::boolean and (perms->>'discount_max')::numeric = 3 then res := res || E'\n✓ OWNER cấp thêm quyền thanh toán + giảm 3% cho phục vụ'; pass := pass + 1; else res := res || E'\n✗ Cấp quyền riêng không có tác dụng: ' || perms::text; fail := fail + 1; end if;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', u_mgr::text, true); execute 'set local role authenticated';
  select count(*) into n from public.pos_audit;
  if n = 0 then res := res || E'\n✓ OWNER thu hồi quyền xem Audit của quản lý'; pass := pass + 1; else res := res || E'\n✗ Thu hồi quyền không có tác dụng'; fail := fail + 1; end if;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', u_cas::text, true); execute 'set local role authenticated';
  perms := public.pos_my_perms();
  if coalesce((perms->>'staff')::boolean, false) = false and coalesce((perms->>'settings')::boolean, false) = false then
    res := res || E'\n✓ Không thể cấp quyền chủ quán (nhân viên / cài đặt) cho nhân viên'; pass := pass + 1;
  else res := res || E'\n✗ Cấp được quyền chủ quán cho nhân viên'; fail := fail + 1; end if;
  execute 'reset role';

  -- ================= OWNER: không thay đổi được tài khoản OWNER =================
  if u_own is not null then
    select email into t from auth.users where id = u_own;
    perform set_config('request.jwt.claim.sub', u_own::text, true); execute 'set local role authenticated';
    begin perform public.pos_staff_save(t, 'owner', null, 'cashier', true, '{}'::jsonb);
          res := res || E'\n✗ Hạ quyền OWNER: KHÔNG bị chặn'; fail := fail + 1;
    exception when others then res := res || E'\n✓ Không ai đổi được tài khoản OWNER: ' || sqlerrm; pass := pass + 1; end;
    begin perform public.pos_staff_list(); res := res || E'\n✓ OWNER xem được danh sách nhân viên'; pass := pass + 1;
    exception when others then res := res || E'\n✗ OWNER không xem được nhân viên: ' || sqlerrm; fail := fail + 1; end;
    begin perform public.pos_staff_save('khong-ton-tai@may.vn', 'X', null, 'cashier', true, '{}'::jsonb);
          res := res || E'\n✗ Thêm nhân viên với email chưa có tài khoản: KHÔNG bị chặn'; fail := fail + 1;
    exception when others then res := res || E'\n✓ Báo rõ khi email chưa có tài khoản đăng nhập'; pass := pass + 1; end;
    execute 'reset role';
    -- Nếu có tài khoản đăng nhập chưa gán vai trò: thử OWNER gán vai trò (rồi hoàn tác)
    select a.email into t from auth.users a where not exists (select 1 from public.users u where u.auth_user_id = a.id) limit 1;
    if t is not null then
      perform set_config('request.jwt.claim.sub', u_own::text, true); execute 'set local role authenticated';
      begin perform public.pos_staff_save(t, 'TEST-moi', 'Nhân viên mới', 'waiter', true, '{"pay":true}'::jsonb);
            res := res || E'\n✓ OWNER thêm nhân viên + cấp quyền riêng'; pass := pass + 1;
      exception when others then res := res || E'\n✗ OWNER thêm nhân viên: ' || sqlerrm; fail := fail + 1; end;
      execute 'reset role';
    else
      res := res || E'\n• Bỏ qua thử thêm nhân viên mới: chưa có tài khoản đăng nhập nào chưa gán vai trò';
    end if;
  end if;

  -- ---------- KẾT THÚC: báo kết quả và HOÀN TÁC TOÀN BỘ ----------
  execute 'reset role';
  select max(bill_no) into v_keep from public.pos_bills where table_no is distinct from tbl;
  if v_keep is not null and v_keep > v_last then perform setval(v_seq, v_keep, true);
  else perform setval(v_seq, v_last, v_called); end if;
  raise exception E'KẾT QUẢ KIỂM THỬ QUYỀN: % ĐẠT / % LỖI (đã hoàn tác toàn bộ, không lưu dữ liệu)%', pass, fail, res;
end $$;
