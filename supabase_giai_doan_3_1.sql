-- =====================================================================
-- MÂY POS – Giai đoạn 3.1: KHÓA BẢO MẬT & CHỐNG GIAN LẬN (production)
-- Chạy sau giai đoạn 1, 2, 2b, 3. An toàn khi chạy lại. KHÔNG xóa dữ liệu.
--  0. Sao lưu policy / function / quyền / trigger hiện tại vào schema pos_backup
--  1. Khóa bảng cũ (orders, order_items, kitchen_tickets, tables, menu đọc công khai…)
--  2. Thu hồi toàn bộ quyền của anon (người chưa đăng nhập)
--  3. Khóa function: search_path cố định, chỉ authenticated được gọi
--  4. Audit Log chỉ ghi thêm
--  5. Chống gian lận: giá món, gửi trùng phiếu, thanh toán 2 lần,
--     ghi đè dữ liệu cũ, tiền đóng ca do máy chủ tính
-- Hoàn tác: rollback_3_1.sql
-- =====================================================================

-- ---------- 0. SAO LƯU TRƯỚC KHI SỬA ----------
create schema if not exists pos_backup;
revoke all on schema pos_backup from public, anon, authenticated;
create table if not exists pos_backup.snapshot (
  id bigserial primary key, label text not null, kind text not null, name text not null,
  definition text, taken_at timestamptz not null default now()
);
revoke all on all tables in schema pos_backup from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pos_backup.snapshot where label = 'truoc_3_1') then
    insert into pos_backup.snapshot(label, kind, name, definition)
    select 'truoc_3_1', 'policy', tablename || '.' || policyname,
           format('create policy %I on public.%I as %s for %s to %s%s%s;', policyname, tablename, permissive, cmd,
                  array_to_string(roles, ', '), coalesce(' using (' || qual || ')', ''), coalesce(' with check (' || with_check || ')', ''))
      from pg_policies where schemaname = 'public';
    insert into pos_backup.snapshot(label, kind, name, definition)
    select 'truoc_3_1', 'function', p.oid::regprocedure::text, pg_get_functiondef(p.oid)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f';
    insert into pos_backup.snapshot(label, kind, name, definition)
    select 'truoc_3_1', 'function_acl', p.oid::regprocedure::text, coalesce(p.proacl::text, '(mặc định)')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f';
    insert into pos_backup.snapshot(label, kind, name, definition)
    select 'truoc_3_1', 'table_acl', c.relname, coalesce(c.relacl::text, '(mặc định)') || ' · rls=' || c.relrowsecurity
      from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p','v','m');
    insert into pos_backup.snapshot(label, kind, name, definition)
    select 'truoc_3_1', 'trigger', c.relname || '.' || t.tgname, pg_get_triggerdef(t.oid)
      from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and not t.tgisinternal;
  end if;
end $$;

-- ---------- 1. BẢNG CŨ (bản thử nghiệm): bỏ quyền công khai ----------
-- Dữ liệu trong các bảng cũ được GIỮ NGUYÊN, chỉ không ai đọc/ghi qua API nữa.
drop policy if exists "pilot kitchen tickets" on public.kitchen_tickets;
drop policy if exists "pilot order items"     on public.order_items;
drop policy if exists "pilot orders"          on public.orders;
drop policy if exists "pilot read tables"     on public.tables;
drop policy if exists "pilot read menu"       on public.menu_items;
-- Mọi policy còn mở cho anon / public (kể cả bảng cũ khác tên) → bỏ
do $$
declare r record;
begin
  for r in select tablename, policyname from pg_policies
            where schemaname = 'public' and ('anon' = any(roles) or 'public' = any(roles)) loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Bật RLS cho MỌI bảng trong public (bảng chưa có policy = không ai truy cập được qua API)
do $$
declare r record;
begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind in ('r','p') loop
    execute format('alter table public.%I enable row level security', r.relname);
  end loop;
end $$;

-- ---------- 2. QUYỀN BẢNG: anon = 0 ----------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

-- Đặt chỗ (chưa dùng): chỉ người bán hàng
drop policy if exists "pos_reservations_select" on public.pos_reservations;
drop policy if exists "pos_reservations_insert" on public.pos_reservations;
drop policy if exists "pos_reservations_update" on public.pos_reservations;
create policy "pos_reservations_select" on public.pos_reservations for select to authenticated using (public.pos_has('order') or public.pos_has('pay'));
create policy "pos_reservations_insert" on public.pos_reservations for insert to authenticated with check (public.pos_has('order') or public.pos_has('pay'));
create policy "pos_reservations_update" on public.pos_reservations for update to authenticated using (public.pos_has('order') or public.pos_has('pay')) with check (public.pos_has('order') or public.pos_has('pay'));

-- ---------- 4. AUDIT LOG: chỉ ghi thêm, không ai sửa / xóa ----------
create or replace function public.pos_audit_lock()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'Nhật ký thao tác chỉ được ghi thêm, không được sửa hoặc xóa';
end $$;
drop trigger if exists pos_audit_lock_trg on public.pos_audit;
create trigger pos_audit_lock_trg before update or delete on public.pos_audit for each row execute function public.pos_audit_lock();
drop trigger if exists pos_audit_truncate_trg on public.pos_audit;
create trigger pos_audit_truncate_trg before truncate on public.pos_audit for each statement execute function public.pos_audit_lock();

-- ---------- 5a. GIÁ MÓN: phải đúng giá thực đơn (trừ món theo thời giá) ----------
create or replace function public.pos_check_items(p_items jsonb, p_old jsonb)
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
declare e jsonb; m record; v_id bigint; v_qty numeric; v_sent numeric; v_price numeric;
begin
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then raise exception 'Danh sách món không hợp lệ'; end if;
  for e in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    begin
      v_id := (e->>'id')::bigint; v_qty := (e->>'qty')::numeric; v_sent := coalesce((e->>'sent')::numeric, 0); v_price := (e->>'price')::numeric;
    exception when others then raise exception 'Dữ liệu món không hợp lệ: %', coalesce(e->>'name', '?');
    end;
    select id, name, price, station, coalesce(is_market_price, false) mk into m from public.menu_items where id = v_id;
    if not found then raise exception 'Món không có trong thực đơn: %', coalesce(e->>'name', '?'); end if;
    if v_qty is null or v_qty <= 0 or v_qty <> trunc(v_qty) then raise exception 'Số lượng không hợp lệ: %', m.name; end if;
    if v_sent < 0 or v_sent > v_qty then raise exception 'Số lượng đã gửi Bếp/Bar không hợp lệ: %', m.name; end if;
    if v_price is null or v_price <= 0 and not (m.price = 0 and not m.mk) then raise exception 'Giá không hợp lệ: %', m.name; end if;
    if not m.mk and v_price is distinct from m.price
       and not exists (select 1 from jsonb_array_elements(coalesce(p_old, '[]'::jsonb)) o
                        where o->>'id' = e->>'id' and (o->>'price')::numeric = v_price) then
      raise exception 'Sai giá món % (giá thực đơn %)', m.name, public._pos_money(m.price);
    end if;
    if coalesce(nullif(e->>'station', ''), 'kitchen') is distinct from coalesce(nullif(m.station, ''), 'kitchen') then
      raise exception 'Sai khu chế biến của món %', m.name;
    end if;
  end loop;
end $$;

-- ---------- 5b. ĐƠN BÀN: chống ghi đè dữ liệu cũ, chống tự đánh dấu "đã gửi" ----------
alter table public.pos_table_orders add column if not exists base_rev bigint;

create or replace function public.pos_table_orders_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_max numeric; r record; v_old_disc numeric := 0;
begin
  if coalesce(current_setting('pos.sys', true), '') = '1' then return new; end if;   -- chỉ hàm máy chủ (gửi bếp / thanh toán)
  if not (public.pos_has('order') or public.pos_has('pay') or public.pos_has('move_table')) then
    raise exception 'Không có quyền gọi món';
  end if;
  if tg_op = 'UPDATE' then
    -- bản ghi cũ đến muộn từ cùng một máy → bỏ qua
    if new.client_id is not distinct from old.client_id and coalesce(new.rev, 0) < coalesce(old.rev, 0) then return null; end if;
    -- máy khác đã sửa bàn này sau lần tải gần nhất → từ chối, máy này phải tải lại
    if new.base_rev is distinct from old.rev then
      raise exception 'POS_CONFLICT: Bàn % vừa được cập nhật ở máy khác', new.table_no;
    end if;
    new.rev := greatest(coalesce(new.rev, 0), coalesce(old.rev, 0) + 1);
    v_old_disc := coalesce(old.discount, 0);
  end if;
  perform public.pos_check_items(new.items, case when tg_op = 'UPDATE' then old.items else '[]'::jsonb end);
  if coalesce(new.discount, 0) <> v_old_disc then
    v_max := coalesce((public.pos_my_perms() ->> 'discount_max')::numeric, 0);
    if coalesce(new.discount, 0) > v_max or coalesce(new.discount, 0) < 0 then
      raise exception 'Vượt quyền giảm giá (tối đa % phần trăm)', v_max;
    end if;
  end if;
  -- So sánh số lượng "đã gửi Bếp/Bar" theo từng món
  for r in
    with o as (select i->>'id' id, sum(coalesce((i->>'sent')::numeric, 0)) s
                 from jsonb_array_elements(case when tg_op = 'UPDATE' then coalesce(old.items, '[]'::jsonb) else '[]'::jsonb end) i group by 1),
         n as (select i->>'id' id, sum(coalesce((i->>'sent')::numeric, 0)) s from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) i group by 1)
    select coalesce(o.id, n.id) id, coalesce(o.s, 0) os, coalesce(n.s, 0) ns from o full join n on n.id = o.id
  loop
    if r.ns < r.os and not (public.pos_has('void_sent') or public.pos_has('move_table')
         or (public.pos_has('pay') and jsonb_array_length(coalesce(new.items, '[]'::jsonb)) = 0)) then
      raise exception 'Không có quyền hủy / bớt món đã gửi Bếp/Bar';
    end if;
    if r.ns > r.os and not public.pos_has('move_table') then
      raise exception 'Món chỉ được đánh dấu đã gửi qua chức năng GỬI BẾP/BAR';
    end if;
  end loop;
  new.updated_by := public.pos_user_name();
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists pos_table_orders_guard_trg on public.pos_table_orders;
create trigger pos_table_orders_guard_trg before insert or update on public.pos_table_orders for each row execute function public.pos_table_orders_guard();

-- ---------- 5c. GỬI BẾP/BAR: chỉ qua hàm máy chủ, khóa bàn → không thể gửi trùng ----------
create or replace function public.pos_send_order(p_table int, p_batch uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare o record; e jsonb; v_round int; v_delta numeric; v_items jsonb := '[]'::jsonb; v_rows jsonb := '[]'::jsonb;
        v_id uuid; v_k int := 0; v_b int := 0; v_txt text := ''; v_rev bigint;
begin
  if not public.pos_has('order') then raise exception 'Không có quyền gửi Bếp/Bar'; end if;
  select * into o from public.pos_table_orders where table_no = p_table for update;
  if not found then raise exception 'Bàn % chưa có món', p_table; end if;
  v_round := coalesce((o.meta->>'round')::int, 0) + 1;
  for e in select * from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) loop
    v_delta := coalesce((e->>'qty')::numeric, 0) - coalesce((e->>'sent')::numeric, 0);
    if v_delta > 0 then
      v_id := gen_random_uuid();
      insert into public.pos_tickets(id, table_no, item_id, item, qty, note, station, status, batch_id, round)
      values (v_id, p_table, e->>'id', coalesce(e->>'name', '?'), v_delta, coalesce(e->>'note', ''), coalesce(nullif(e->>'station', ''), 'kitchen'), 'MỚI', p_batch, v_round);
      v_rows := v_rows || jsonb_build_object('id', v_id, 'qty', v_delta, 'item', e->>'name', 'station', coalesce(nullif(e->>'station', ''), 'kitchen'));
      if coalesce(e->>'station', '') = 'bar' then v_b := v_b + 1; else v_k := v_k + 1; end if;
      v_txt := v_txt || case when v_txt = '' then '' else ', ' end || v_delta || '×' || coalesce(e->>'name', '?');
      e := e || jsonb_build_object('sent', (e->>'qty')::numeric);
    end if;
    v_items := v_items || jsonb_build_array(e);
  end loop;
  if jsonb_array_length(v_rows) = 0 then
    return jsonb_build_object('count', 0, 'rev', o.rev, 'round', v_round - 1);
  end if;
  v_rev := greatest(coalesce(o.rev, 0) + 1, (extract(epoch from clock_timestamp()) * 1000)::bigint);
  perform set_config('pos.sys', '1', true);
  update public.pos_table_orders
     set items = v_items, rev = v_rev, client_id = 'server', updated_by = public.pos_user_name(), updated_at = now(),
         meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('round', v_round, 'last', (extract(epoch from clock_timestamp()) * 1000)::bigint),
         status = case when coalesce(status, '') = '' then 'busy' else status end
   where table_no = p_table;
  perform set_config('pos.sys', '', true);
  perform public._pos_audit('GỬI BẾP/BAR', 'Bàn ' || p_table || ' · lần #' || v_round || ' · ' || v_txt || ' (Bếp ' || v_k || ' / Bar ' || v_b || ' dòng)', false);
  return jsonb_build_object('count', jsonb_array_length(v_rows), 'round', v_round, 'rev', v_rev, 'tickets', v_rows);
end $$;

-- Phiếu chỉ được tạo qua pos_send_order
drop policy if exists "pos_tickets_insert" on public.pos_tickets;

-- ---------- 5d. THANH TOÁN: khớp đơn bàn trên máy chủ, khóa bàn → không thể thanh toán 2 lần ----------
create or replace function public.pos_bills_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_sub numeric; v_max numeric; o record; v_a jsonb; v_b jsonb; v_cash numeric; v_c numeric; v_q numeric;
begin
  if tg_op = 'INSERT' then
    if not public.pos_has('pay') then raise exception 'Không có quyền thanh toán'; end if;
    if new.table_no is null then raise exception 'Hóa đơn phải gắn với bàn'; end if;
    -- Khóa đơn bàn: máy thứ hai thanh toán cùng lúc sẽ phải chờ rồi bị từ chối
    select * into o from public.pos_table_orders where table_no = new.table_no for update;
    if not found or jsonb_array_length(coalesce(o.items, '[]'::jsonb)) = 0 then
      raise exception 'POS_PAID: Bàn % không còn món chờ thanh toán (có thể đã được thanh toán ở máy khác)', new.table_no;
    end if;
    select coalesce(jsonb_agg(x order by x::text), '[]'::jsonb) into v_a from (
      select jsonb_build_object('id', i->>'id', 'price', (i->>'price')::numeric, 'qty', (i->>'qty')::numeric) x
        from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) i) s;
    select coalesce(jsonb_agg(x order by x::text), '[]'::jsonb) into v_b from (
      select jsonb_build_object('id', i->>'id', 'price', (i->>'price')::numeric, 'qty', (i->>'qty')::numeric) x
        from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) i) s;
    if v_a is distinct from v_b then
      raise exception 'POS_CONFLICT: Đơn bàn % đã thay đổi, vui lòng tải lại trước khi thanh toán', new.table_no;
    end if;
    if coalesce(new.discount, 0) <> coalesce(o.discount, 0) then raise exception 'Giảm giá trên hóa đơn không khớp đơn bàn'; end if;
    new.items := o.items;      -- dùng đúng dữ liệu món đã kiểm tra trên máy chủ
    select coalesce(sum((i->>'price')::numeric * (i->>'qty')::numeric), 0) into v_sub
      from jsonb_array_elements(new.items) i;
    if abs(v_sub - coalesce(new.subtotal, 0)) > 1 then raise exception 'Tạm tính không khớp danh sách món'; end if;
    v_max := coalesce((public.pos_my_perms() ->> 'discount_max')::numeric, 0);
    if coalesce(new.discount, 0) < 0 or coalesce(new.discount, 0) > v_max then
      raise exception 'Vượt quyền giảm giá (tối đa % phần trăm)', v_max;
    end if;
    if abs(round(v_sub * (1 - coalesce(new.discount, 0) / 100)) - round(coalesce(new.total, 0))) > 1 then
      raise exception 'Tổng tiền không khớp tạm tính và giảm giá';
    end if;
    -- Phương thức & tiền mặt
    if coalesce(new.method, '') not in ('Tiền mặt', 'QR/Chuyển khoản', 'Thẻ', 'Kết hợp') then raise exception 'Phương thức thanh toán không hợp lệ'; end if;
    if new.method = 'Kết hợp' then
      v_c := coalesce((new.parts->>'cash')::numeric, 0); v_q := coalesce((new.parts->>'qr')::numeric, 0);
      if v_c < 0 or v_q < 0 or abs(v_c + v_q - new.total) > 1 then raise exception 'Tiền mặt + chuyển khoản không bằng tổng hóa đơn'; end if;
      new.parts := jsonb_build_object('cash', v_c, 'qr', v_q); v_cash := v_c;
    else
      new.parts := jsonb_build_object(new.method, new.total); v_cash := case when new.method = 'Tiền mặt' then new.total else 0 end;
    end if;
    if new.cash_given is not null then
      if v_cash <= 0 or new.cash_given < v_cash then raise exception 'Tiền khách đưa không hợp lệ'; end if;
      new.change_amount := new.cash_given - v_cash;
    else
      new.change_amount := null;
    end if;
    new.created_by := public.pos_user_name();
    new.created_at := now();
    new.device := public.pos_device();
    new.cancelled := false; new.cancel_reason := null; new.cancelled_by := null; new.cancelled_at := null;
    new.print_count := 0;
    return new;
  end if;
  -- UPDATE: chỉ được hủy (một chiều) hoặc tăng số lần in qua hàm in
  if (new.id, new.bill_no, new.table_no, new.items, new.subtotal, new.discount, new.total, new.method, new.parts,
      new.guests, new.created_by, new.created_at, new.cash_given, new.change_amount, new.device)
     is distinct from
     (old.id, old.bill_no, old.table_no, old.items, old.subtotal, old.discount, old.total, old.method, old.parts,
      old.guests, old.created_by, old.created_at, old.cash_given, old.change_amount, old.device) then
    raise exception 'Không được sửa nội dung hóa đơn đã thanh toán';
  end if;
  if new.print_count is distinct from old.print_count and coalesce(current_setting('pos.print', true), '') <> '1' then
    raise exception 'Chỉ cập nhật số lần in qua chức năng in';
  end if;
  if new.cancelled is distinct from old.cancelled then
    if old.cancelled then raise exception 'Hóa đơn đã hủy không thể khôi phục'; end if;
    if not public.pos_has('bill_cancel') then raise exception 'Không có quyền hủy hóa đơn'; end if;
    if coalesce(trim(new.cancel_reason), '') = '' then raise exception 'Hủy hóa đơn bắt buộc có lý do'; end if;
    new.cancelled_by := public.pos_user_name();
    new.cancelled_at := now();
  elsif (new.cancel_reason, new.cancelled_by, new.cancelled_at) is distinct from (old.cancel_reason, old.cancelled_by, old.cancelled_at) then
    raise exception 'Không được sửa thông tin hủy';
  end if;
  return new;
end $$;

-- Sau khi lập hóa đơn: máy chủ tự làm trống bàn (cùng giao dịch)
create or replace function public.pos_bills_clear_table()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform set_config('pos.sys', '1', true);
  update public.pos_table_orders
     set items = '[]'::jsonb, status = '', discount = 0, meta = '{}'::jsonb, client_id = 'server',
         rev = greatest(coalesce(rev, 0) + 1, (extract(epoch from clock_timestamp()) * 1000)::bigint),
         updated_by = public.pos_user_name(), updated_at = now()
   where table_no = new.table_no;
  perform set_config('pos.sys', '', true);
  return null;
end $$;
drop trigger if exists pos_bills_clear_table_trg on public.pos_bills;
create trigger pos_bills_clear_table_trg after insert on public.pos_bills for each row execute function public.pos_bills_clear_table();

-- Không ai được xóa hóa đơn / phiếu / ca / phiếu thu chi / phiếu kho qua API
revoke delete on public.pos_bills, public.pos_tickets, public.pos_shifts, public.pos_cash_moves,
                 public.pos_stock_moves, public.pos_stock, public.pos_audit from authenticated;

-- ---------- 5e. ĐÓNG CA: máy chủ tự tính tiền phải có ----------
create or replace function public.pos_shifts_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_sales numeric; v_in numeric; v_out numeric;
begin
  if tg_op = 'INSERT' then
    new.opened_by := public.pos_user_name(); new.opened_at := now(); new.status := 'open';
    new.closed_by := null; new.closed_at := null;
    new.cash_sales := null; new.cash_in := null; new.cash_out := null; new.expected := null; new.actual := null; new.diff := null;
    if coalesce(new.opening, 0) < 0 then raise exception 'Quỹ đầu ca không hợp lệ'; end if;
    return new;
  end if;
  if old.status = 'closed' then raise exception 'Ca đã đóng không thể sửa'; end if;
  if (new.id, new.opened_by, new.opened_at, new.opening) is distinct from (old.id, old.opened_by, old.opened_at, old.opening) then
    raise exception 'Không được sửa thông tin mở ca';
  end if;
  if new.status = 'closed' then
    if new.actual is null or new.actual < 0 then raise exception 'Nhập số tiền mặt thực tế'; end if;
    select coalesce(sum(case when method = 'Tiền mặt' then total
                             when method = 'Kết hợp' then coalesce((parts->>'cash')::numeric, 0) else 0 end), 0)
      into v_sales from public.pos_bills where not cancelled and created_at >= old.opened_at and created_at <= now();
    select coalesce(sum(amount) filter (where type = 'THU'), 0), coalesce(sum(amount) filter (where type = 'CHI'), 0)
      into v_in, v_out from public.pos_cash_moves
     where method = 'Tiền mặt' and (shift_id = old.id or (shift_id is null and created_at >= old.opened_at and created_at <= now()));
    new.cash_sales := v_sales; new.cash_in := v_in; new.cash_out := v_out;
    new.expected := coalesce(old.opening, 0) + v_sales + v_in - v_out;
    new.diff := new.actual - new.expected;
    if new.diff <> 0 and coalesce(trim(new.reason), '') = '' then
      raise exception 'Chênh lệch % – bắt buộc nhập lý do', public._pos_money(new.diff);
    end if;
    new.closed_by := public.pos_user_name(); new.closed_at := now();
  else
    new.cash_sales := old.cash_sales; new.cash_in := old.cash_in; new.cash_out := old.cash_out;
    new.expected := old.expected; new.actual := old.actual; new.diff := old.diff; new.closed_by := null; new.closed_at := null;
  end if;
  return new;
end $$;

-- ---------- 3. FUNCTION: search_path cố định, anon không được gọi ----------
do $$
declare f record;
begin
  for f in select p.oid::regprocedure sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prokind = 'f' and p.proname <> 'rls_auto_enable' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    if f.proname like '\_pos\_%' then
      execute format('revoke all on function %s from authenticated', f.sig);
    else
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
    execute format('alter function %s set search_path = public, pg_temp', f.sig);
  end loop;
end $$;

-- Kết quả nhanh
select
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity) as bang_chua_bat_rls,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p','v','m')
      and (has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('anon', c.oid, 'INSERT')
        or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE'))) as bang_anon_con_quyen,
  (select count(*) from pg_policies where schemaname = 'public' and ('anon' = any(roles) or 'public' = any(roles))) as policy_cho_anon,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.proname <> 'rls_auto_enable' and has_function_privilege('anon', p.oid, 'EXECUTE')) as ham_anon_goi_duoc,
  (select count(*) from pos_backup.snapshot where label = 'truoc_3_1') as so_muc_sao_luu;
