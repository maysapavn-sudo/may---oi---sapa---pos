-- =====================================================================
-- MÂY POS – Giai đoạn 3: Phân quyền theo từng quyền hạn, Nhân viên,
--   Audit tự ghi người/giờ/thiết bị, bảo vệ hóa đơn, In phiếu & hóa đơn
-- Chạy sau giai đoạn 1, 2, 2b. An toàn khi chạy lại. KHÔNG xóa dữ liệu.
-- =====================================================================

-- ---------- 1. Cột mới (chỉ thêm, không sửa cột cũ) ----------
alter table public.users            add column if not exists perms jsonb not null default '{}'::jsonb;
alter table public.pos_audit        add column if not exists device text;
alter table public.pos_tickets      add column if not exists batch_id uuid;
alter table public.pos_tickets      add column if not exists round int;
alter table public.pos_tickets      add column if not exists print_count int not null default 0;
alter table public.pos_bills        add column if not exists cash_given numeric;
alter table public.pos_bills        add column if not exists change_amount numeric;
alter table public.pos_bills        add column if not exists print_count int not null default 0;
alter table public.pos_bills        add column if not exists device text;
alter table public.pos_table_orders add column if not exists meta jsonb not null default '{}'::jsonb;

-- ---------- 2. Quyền mặc định theo vai trò ----------
create or replace function public.pos_role_default_perms(p_role text)
returns jsonb language sql immutable as $$
  select (case p_role
    when 'owner'   then '{"order":true,"pay":true,"void_sent":true,"move_table":true,"bill_cancel":true,"bill_view":true,"reports":true,"kds_kitchen":true,"kds_bar":true,"shift":true,"cash":true,"stock":true,"recipes":true,"menu":true,"audit":true,"settings":true,"staff":true,"import":true}'
    when 'manager' then '{"order":true,"pay":true,"void_sent":true,"move_table":true,"bill_cancel":true,"bill_view":true,"reports":true,"kds_kitchen":true,"kds_bar":true,"shift":true,"cash":true,"stock":true,"recipes":true,"menu":true,"audit":true,"import":true}'
    when 'cashier' then '{"order":true,"pay":true,"move_table":true,"bill_view":true,"shift":true,"cash":true}'
    when 'waiter'  then '{"order":true}'
    when 'kitchen' then '{"kds_kitchen":true}'
    when 'bar'     then '{"kds_bar":true}'
    when 'stock'   then '{"stock":true,"recipes":true,"import":true}'
    else '{}' end)::jsonb;
$$;

-- Quyền thực tế của người đang đăng nhập = mặc định theo vai trò + quyền OWNER cấp thêm/bớt
create or replace function public.pos_my_perms()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare u record; d jsonb; lim numeric; ov jsonb;
begin
  select * into u from public.users where auth_user_id::text = auth.uid()::text and active = true limit 1;
  if not found then return '{}'::jsonb; end if;
  select discount_limit into lim from public.roles where code = u.role_code;
  d := public.pos_role_default_perms(u.role_code);
  if u.role_code <> 'owner' then
    select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into ov
      from jsonb_each(coalesce(u.perms, '{}'::jsonb)) as e(k, v)
     where jsonb_typeof(v) = 'boolean' and k not in ('settings', 'staff');   -- quyền chủ quán không cấp cho ai
    d := d || ov;
  end if;
  return d || jsonb_build_object(
    'role', u.role_code, 'username', u.username,
    'discount_max', case when u.role_code = 'owner' then 100
                         else greatest(0, least(100, coalesce((u.perms->>'discount_max')::numeric, lim, 0))) end);
end $$;
grant execute on function public.pos_my_perms() to authenticated;

create or replace function public.pos_has(p text)
returns boolean language sql stable as $$
  select coalesce((public.pos_my_perms() ->> p)::boolean, false);
$$;

create or replace function public.pos_user_role()
returns text language sql stable security definer set search_path = public as $$
  select role_code from public.users where auth_user_id::text = auth.uid()::text limit 1;
$$;

-- Thiết bị: lấy từ header x-pos-device do app gửi kèm mỗi yêu cầu
create or replace function public.pos_device()
returns text language plpgsql stable as $$
declare h text;
begin
  begin
    h := current_setting('request.headers', true)::json ->> 'x-pos-device';
  exception when others then h := null;
  end;
  return coalesce(nullif(left(h, 80), ''), 'không rõ');
end $$;

-- ---------- 3. Nhật ký: máy chủ tự ghi người / vai trò / thiết bị / thời gian ----------
create or replace function public.pos_audit_fill()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.actor  := public.pos_user_name();
  new.role   := coalesce(public.pos_user_role(), 'system');
  new.device := public.pos_device();
  new.at     := now();
  return new;
end $$;
drop trigger if exists pos_audit_fill_trg on public.pos_audit;
create trigger pos_audit_fill_trg before insert on public.pos_audit for each row execute function public.pos_audit_fill();

create or replace function public._pos_audit(p_action text, p_detail text, p_risk boolean)
returns void language sql security definer set search_path = public as $$
  insert into public.pos_audit(action, detail, risk) values (p_action, p_detail, coalesce(p_risk, false));
$$;
revoke all on function public._pos_audit(text, text, boolean) from public, anon, authenticated;

create or replace function public._pos_money(n numeric)
returns text language sql immutable as $$
  select replace(to_char(round(coalesce(n, 0)), 'FM999G999G999G990'), ',', '.') || ' đ';
$$;

-- ---------- 4. Bảo vệ hóa đơn đã thanh toán ----------
create or replace function public.pos_bills_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_sub numeric; v_max numeric;
begin
  if tg_op = 'INSERT' then
    if not public.pos_has('pay') then raise exception 'Không có quyền thanh toán'; end if;
    select coalesce(sum((i->>'price')::numeric * (i->>'qty')::numeric), 0) into v_sub
      from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) i;
    if jsonb_array_length(coalesce(new.items, '[]'::jsonb)) = 0 then raise exception 'Hóa đơn không có món'; end if;
    if abs(v_sub - coalesce(new.subtotal, 0)) > 1 then raise exception 'Tạm tính không khớp danh sách món'; end if;
    v_max := coalesce((public.pos_my_perms() ->> 'discount_max')::numeric, 0);
    if coalesce(new.discount, 0) < 0 or coalesce(new.discount, 0) > v_max then
      raise exception 'Vượt quyền giảm giá (tối đa % phần trăm)', v_max;
    end if;
    if abs(round(v_sub * (1 - coalesce(new.discount, 0) / 100)) - round(coalesce(new.total, 0))) > 1 then
      raise exception 'Tổng tiền không khớp tạm tính và giảm giá';
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
drop trigger if exists pos_bills_guard_trg on public.pos_bills;
create trigger pos_bills_guard_trg before insert or update on public.pos_bills for each row execute function public.pos_bills_guard();

create or replace function public.pos_bills_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public._pos_audit('THANH TOÁN', 'HĐ #' || new.bill_no || ' · Bàn ' || coalesce(new.table_no::text, '?') || ' · ' || public._pos_money(new.total)
      || ' · ' || coalesce(new.method, '') || case when coalesce(new.discount, 0) > 0 then ' · giảm ' || new.discount || '%' else '' end
      || case when coalesce(new.change_amount, 0) > 0 then ' · khách đưa ' || public._pos_money(new.cash_given) || ' · trả lại ' || public._pos_money(new.change_amount) else '' end,
      coalesce(new.discount, 0) > 0);
  elsif new.cancelled and not old.cancelled then
    perform public._pos_audit('HỦY HÓA ĐƠN', 'HĐ #' || new.bill_no || ' · ' || public._pos_money(new.total) || ' · ' || coalesce(new.cancel_reason, ''), true);
  end if;
  return null;
end $$;
drop trigger if exists pos_bills_audit_trg on public.pos_bills;
create trigger pos_bills_audit_trg after insert or update of cancelled on public.pos_bills for each row execute function public.pos_bills_audit();

-- In hóa đơn: tăng số lần in; từ lần 2 là IN LẠI và ghi nhật ký
create or replace function public.pos_bill_printed(p_bill uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int; v_no bigint; v_total numeric;
begin
  if not (public.pos_has('bill_view') or public.pos_has('pay')) then raise exception 'Không có quyền in hóa đơn'; end if;
  perform set_config('pos.print', '1', true);
  update public.pos_bills set print_count = print_count + 1 where id = p_bill returning print_count, bill_no, total into n, v_no, v_total;
  if n is null then raise exception 'Không tìm thấy hóa đơn'; end if;
  if n > 1 then perform public._pos_audit('IN LẠI HÓA ĐƠN', 'HĐ #' || v_no || ' · lần in thứ ' || n || ' · ' || public._pos_money(v_total), true); end if;
  return n;
end $$;
grant execute on function public.pos_bill_printed(uuid) to authenticated;

-- ---------- 5. Đơn bàn: chặn giảm giá vượt quyền, chặn hủy món đã gửi bếp ----------
create or replace function public.pos_table_orders_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_max numeric; r record; v_old_disc numeric := 0;
begin
  if not (public.pos_has('order') or public.pos_has('pay') or public.pos_has('move_table')) then
    raise exception 'Không có quyền gọi món';
  end if;
  -- Bỏ qua bản ghi cũ đến muộn từ cùng một máy (chống ghi đè do mạng chậm)
  if tg_op = 'UPDATE' and new.client_id is not distinct from old.client_id and coalesce(new.rev, 0) < coalesce(old.rev, 0) then
    return null;
  end if;
  if tg_op = 'UPDATE' then v_old_disc := coalesce(old.discount, 0); end if;
  if coalesce(new.discount, 0) <> v_old_disc then
    v_max := coalesce((public.pos_my_perms() ->> 'discount_max')::numeric, 0);
    if coalesce(new.discount, 0) > v_max or coalesce(new.discount, 0) < 0 then
      raise exception 'Vượt quyền giảm giá (tối đa % phần trăm)', v_max;
    end if;
  end if;
  if tg_op = 'UPDATE' and not (public.pos_has('void_sent') or public.pos_has('move_table')
       or (public.pos_has('pay') and jsonb_array_length(coalesce(new.items, '[]'::jsonb)) = 0)) then
    for r in
      with o as (select i->>'id' id, sum(coalesce((i->>'sent')::numeric, 0)) s from jsonb_array_elements(coalesce(old.items, '[]'::jsonb)) i group by 1),
           n as (select i->>'id' id, sum(coalesce((i->>'sent')::numeric, 0)) s from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) i group by 1)
      select o.id from o left join n on n.id = o.id where coalesce(n.s, 0) < o.s
    loop
      raise exception 'Không có quyền hủy / bớt món đã gửi Bếp/Bar';
    end loop;
  end if;
  new.updated_by := public.pos_user_name();
  return new;
end $$;
drop trigger if exists pos_table_orders_guard_trg on public.pos_table_orders;
create trigger pos_table_orders_guard_trg before insert or update on public.pos_table_orders for each row execute function public.pos_table_orders_guard();

-- ---------- 6. Phiếu Bếp/Bar: người gửi do máy chủ ghi, trạng thái chỉ đi tiến ----------
create or replace function public.pos_tickets_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare flow text[] := array['MỚI','ĐANG LÀM','HOÀN THÀNH','ĐÃ PHỤC VỤ'];
begin
  if tg_op = 'INSERT' then
    new.created_by := public.pos_user_name();
    new.status := 'MỚI'; new.print_count := 0; new.done_at := null; new.served_at := null;
    return new;
  end if;
  if (new.id, new.table_no, new.item_id, new.item, new.qty, new.note, new.station, new.created_by, new.created_at, new.batch_id, new.round)
     is distinct from (old.id, old.table_no, old.item_id, old.item, old.qty, old.note, old.station, old.created_by, old.created_at, old.batch_id, old.round) then
    raise exception 'Không được sửa nội dung phiếu đã gửi';
  end if;
  if array_position(flow, new.status) is null or array_position(flow, new.status) < array_position(flow, old.status) then
    new.status := old.status; new.done_at := old.done_at; new.served_at := old.served_at;   -- bỏ qua cập nhật lùi trạng thái
  end if;
  if new.print_count is distinct from old.print_count and coalesce(current_setting('pos.print', true), '') <> '1' then
    new.print_count := old.print_count;
  end if;
  return new;
end $$;
drop trigger if exists pos_tickets_guard_trg on public.pos_tickets;
create trigger pos_tickets_guard_trg before insert or update on public.pos_tickets for each row execute function public.pos_tickets_guard();

-- In phiếu Bếp/Bar theo lần gửi; in lại ghi nhật ký
create or replace function public.pos_ticket_printed(p_batch uuid, p_station text)
returns int language plpgsql security definer set search_path = public as $$
declare prev int; v_table int; v_round int;
begin
  if not (public.pos_has('order') or public.pos_has('kds_kitchen') or public.pos_has('kds_bar')) then raise exception 'Không có quyền in phiếu'; end if;
  select max(print_count), max(table_no), max(round) into prev, v_table, v_round from public.pos_tickets where batch_id = p_batch and station = p_station;
  if prev is null then raise exception 'Không tìm thấy phiếu'; end if;
  perform set_config('pos.print', '1', true);
  update public.pos_tickets set print_count = print_count + 1 where batch_id = p_batch and station = p_station;
  if prev > 0 then
    perform public._pos_audit('IN LẠI PHIẾU ' || case when p_station = 'bar' then 'BAR' else 'BẾP' end,
      'Bàn ' || v_table || ' · lần gửi #' || coalesce(v_round, 1) || ' · lần in thứ ' || (prev + 1), true);
  end if;
  return prev + 1;
end $$;
grant execute on function public.pos_ticket_printed(uuid, text) to authenticated;

-- ---------- 7. Ca & phiếu thu/chi: người thực hiện do máy chủ ghi + nhật ký ----------
create or replace function public.pos_shifts_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.opened_by := public.pos_user_name(); new.opened_at := now(); new.status := 'open';
    new.closed_by := null; new.closed_at := null;
    return new;
  end if;
  if old.status = 'closed' then raise exception 'Ca đã đóng không thể sửa'; end if;
  if (new.id, new.opened_by, new.opened_at, new.opening) is distinct from (old.id, old.opened_by, old.opened_at, old.opening) then
    raise exception 'Không được sửa thông tin mở ca';
  end if;
  if new.status = 'closed' then new.closed_by := public.pos_user_name(); new.closed_at := now(); end if;
  return new;
end $$;
drop trigger if exists pos_shifts_guard_trg on public.pos_shifts;
create trigger pos_shifts_guard_trg before insert or update on public.pos_shifts for each row execute function public.pos_shifts_guard();

create or replace function public.pos_shifts_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public._pos_audit('MỞ CA', 'Quỹ đầu ca ' || public._pos_money(new.opening), false);
  elsif new.status = 'closed' and old.status = 'open' then
    perform public._pos_audit('ĐÓNG CA', 'Phải có ' || public._pos_money(new.expected) || ' · Thực tế ' || public._pos_money(new.actual)
      || ' · Chênh ' || public._pos_money(new.diff) || coalesce(' · ' || nullif(new.reason, ''), ''), coalesce(new.diff, 0) <> 0);
  end if;
  return null;
end $$;
drop trigger if exists pos_shifts_audit_trg on public.pos_shifts;
create trigger pos_shifts_audit_trg after insert or update on public.pos_shifts for each row execute function public.pos_shifts_audit();

create or replace function public.pos_cash_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.created_by := public.pos_user_name(); new.created_at := now();
  return new;
end $$;
drop trigger if exists pos_cash_guard_trg on public.pos_cash_moves;
create trigger pos_cash_guard_trg before insert on public.pos_cash_moves for each row execute function public.pos_cash_guard();

create or replace function public.pos_cash_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public._pos_audit('PHIẾU ' || new.type, public._pos_money(new.amount) || ' · ' || coalesce(new.method, '') || ' · '
    || coalesce(new.category, '') || coalesce(' · ' || nullif(new.note, ''), ''), new.type = 'CHI' and new.amount >= 1000000);
  return null;
end $$;
drop trigger if exists pos_cash_audit_trg on public.pos_cash_moves;
create trigger pos_cash_audit_trg after insert on public.pos_cash_moves for each row execute function public.pos_cash_audit();

-- ---------- 8. Nhật ký thay đổi cài đặt và giá món ----------
create or replace function public.pos_settings_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public._pos_audit('SỬA CÀI ĐẶT', new.key || ': ' || coalesce(case when tg_op = 'UPDATE' then old.value::text end, '(trống)') || ' → ' || new.value::text, true);
  return null;
end $$;
drop trigger if exists pos_settings_audit_trg on public.pos_settings;
create trigger pos_settings_audit_trg after insert or update on public.pos_settings for each row execute function public.pos_settings_audit();

create or replace function public.pos_menu_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return null; end if;   -- thay đổi từ trang quản trị database: không ghi
  if tg_op = 'INSERT' then
    perform public._pos_audit('THÊM MÓN', coalesce(new.code, '') || ' ' || new.name || ' · ' || public._pos_money(new.price), false);
  elsif (new.price, new.active, new.name, coalesce(new.hidden, false)) is distinct from (old.price, old.active, old.name, coalesce(old.hidden, false)) then
    perform public._pos_audit('SỬA MÓN', coalesce(new.code, '') || ' ' || old.name || ': giá ' || public._pos_money(old.price) || ' → ' || public._pos_money(new.price)
      || case when new.active is distinct from old.active then case when new.active then ' · mở bán' else ' · ngừng bán' end else '' end
      || case when new.name is distinct from old.name then ' · tên mới: ' || new.name else '' end, new.price is distinct from old.price or new.active is distinct from old.active);
  end if;
  return null;
end $$;
drop trigger if exists pos_menu_audit_trg on public.menu_items;
create trigger pos_menu_audit_trg after insert or update on public.menu_items for each row execute function public.pos_menu_audit();

-- ---------- 9. Quản lý nhân viên (chỉ OWNER) ----------
create or replace function public.pos_staff_list()
returns table(id uuid, username text, full_name text, role_code text, active boolean, perms jsonb, email text, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.pos_has('staff') then raise exception 'Chỉ OWNER được quản lý nhân viên'; end if;
  return query
    select u.id, u.username, u.full_name, u.role_code, u.active, u.perms, a.email::text, a.last_sign_in_at
      from public.users u left join auth.users a on a.id = u.auth_user_id
     order by case u.role_code when 'owner' then 0 when 'manager' then 1 when 'cashier' then 2 when 'waiter' then 3 else 4 end, u.username;
end $$;
grant execute on function public.pos_staff_list() to authenticated;

create or replace function public.pos_staff_save(p_email text, p_username text, p_full_name text, p_role text, p_active boolean, p_perms jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_auth uuid; v_old record; v_clean jsonb;
begin
  if not public.pos_has('staff') then raise exception 'Chỉ OWNER được quản lý nhân viên'; end if;
  if p_role not in ('manager','cashier','waiter','kitchen','bar','stock') then raise exception 'Vai trò không hợp lệ'; end if;
  if coalesce(trim(p_username), '') = '' then raise exception 'Nhập tên đăng nhập hiển thị'; end if;
  select id into v_auth from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_auth is null then
    raise exception 'Chưa có tài khoản đăng nhập với email %. Tạo trước trong Supabase → Authentication → Add user.', p_email;
  end if;
  select * into v_old from public.users where auth_user_id = v_auth;
  if found and v_old.role_code = 'owner' then raise exception 'Không được thay đổi tài khoản OWNER'; end if;
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into v_clean from jsonb_each(coalesce(p_perms, '{}'::jsonb)) e(k, v)
   where (jsonb_typeof(v) = 'boolean' and k not in ('settings','staff')) or (k = 'discount_max' and jsonb_typeof(v) = 'number');
  if found and v_old.id is not null then
    update public.users set username = trim(p_username), full_name = p_full_name, role_code = p_role, active = coalesce(p_active, true),
           perms = v_clean, updated_at = now() where id = v_old.id;
    perform public._pos_audit('SỬA NHÂN VIÊN', trim(p_username) || ' (' || p_email || ') · ' || v_old.role_code || ' → ' || p_role
      || case when coalesce(p_active, true) then '' else ' · KHÓA' end || ' · quyền riêng ' || v_clean::text, true);
  else
    insert into public.users(auth_user_id, username, full_name, role_code, active, perms)
    values (v_auth, trim(p_username), p_full_name, p_role, coalesce(p_active, true), v_clean);
    perform public._pos_audit('THÊM NHÂN VIÊN', trim(p_username) || ' (' || p_email || ') · ' || p_role || ' · quyền riêng ' || v_clean::text, true);
  end if;
end $$;
grant execute on function public.pos_staff_save(text, text, text, text, boolean, jsonb) to authenticated;

-- ---------- 10. Cập nhật hàm kho theo quyền ----------
create or replace function public.pos_stock_post(p_type text, p_ing bigint, p_loc text, p_qty numeric,
                                                 p_to text default null, p_cost numeric default null,
                                                 p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_by text := public.pos_user_name(); v_cur numeric; v_ref text;
begin
  if not (public.pos_has('stock') or (public.pos_has('import') and p_type in ('NHẬP','KIỂM KÊ'))) then
    raise exception 'Không có quyền thao tác kho';
  end if;
  if p_loc not in ('KHO','BEP','BAR') then raise exception 'Kho không hợp lệ'; end if;
  if p_qty is null or (p_qty < 0 and p_type <> 'ĐIỀU CHỈNH') then raise exception 'Số lượng không hợp lệ'; end if;
  if not exists (select 1 from public.pos_ingredients where id = p_ing) then raise exception 'Không tìm thấy nguyên liệu'; end if;
  if p_type = 'NHẬP' then
    perform public._pos_stock_delta(p_ing, p_loc, p_qty, 'NHẬP', p_note, null, p_cost, v_by);
    if coalesce(p_cost,0) > 0 then update public.pos_ingredients set cost = p_cost, updated_at = now() where id = p_ing; end if;
  elsif p_type in ('XUẤT','HỦY') then
    perform public._pos_stock_delta(p_ing, p_loc, -p_qty, p_type, p_note, null, null, v_by);
  elsif p_type = 'CHUYỂN' then
    if p_to is null or p_to not in ('KHO','BEP','BAR') or p_to = p_loc then raise exception 'Kho nhận không hợp lệ'; end if;
    v_ref := 'CK-' || to_char(now(),'YYMMDDHH24MISS');
    perform public._pos_stock_delta(p_ing, p_loc, -p_qty, 'CHUYỂN ĐI',  coalesce(p_note,'') || ' → ' || p_to, v_ref, null, v_by);
    perform public._pos_stock_delta(p_ing, p_to,   p_qty, 'CHUYỂN ĐẾN', coalesce(p_note,'') || ' ← ' || p_loc, v_ref, null, v_by);
  elsif p_type = 'ĐIỀU CHỈNH' then
    if p_qty = 0 then raise exception 'Số lượng điều chỉnh phải khác 0'; end if;
    if coalesce(trim(p_note),'') = '' then raise exception 'Phiếu điều chỉnh bắt buộc ghi lý do'; end if;
    perform public._pos_stock_delta(p_ing, p_loc, p_qty, 'ĐIỀU CHỈNH', p_note, null, null, v_by);
  elsif p_type = 'KIỂM KÊ' then
    select qty into v_cur from public.pos_stock where ingredient_id = p_ing and location = p_loc;
    perform public._pos_stock_delta(p_ing, p_loc, p_qty - coalesce(v_cur,0), 'KIỂM KÊ',
            'Thực tế ' || p_qty || ' (sổ sách ' || coalesce(v_cur,0) || ')' || coalesce(' · ' || p_note,''), null, null, v_by);
  else
    raise exception 'Loại phiếu không hợp lệ: %', p_type;
  end if;
end $$;
grant execute on function public.pos_stock_post(text,bigint,text,numeric,text,numeric,text) to authenticated;

create or replace function public.pos_waste_item(p_menu_item bigint, p_qty numeric, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare r record; v_loc text; v_by text := public.pos_user_name();
begin
  if not public.pos_has('void_sent') then raise exception 'Không có quyền hủy món đã gửi Bếp/Bar'; end if;
  select case when station = 'bar' then 'BAR' else 'BEP' end into v_loc from public.menu_items where id = p_menu_item;
  v_loc := coalesce(v_loc,'BEP');
  for r in select ingredient_id, qty from public.pos_recipes where menu_item_id = p_menu_item loop
    perform public._pos_stock_delta(r.ingredient_id, v_loc, -(r.qty * p_qty), 'HAO HỤT', p_note, null, null, v_by);
  end loop;
end $$;
grant execute on function public.pos_waste_item(bigint,numeric,text) to authenticated;

-- ---------- 11. Quy tắc truy cập (RLS) theo quyền ----------
-- Đơn bàn
drop policy if exists "pos_table_orders_all" on public.pos_table_orders;
drop policy if exists "pos_table_orders_select" on public.pos_table_orders;
create policy "pos_table_orders_select" on public.pos_table_orders for select to authenticated
  using (public.pos_has('order') or public.pos_has('pay') or public.pos_has('move_table'));
drop policy if exists "pos_table_orders_insert" on public.pos_table_orders;
create policy "pos_table_orders_insert" on public.pos_table_orders for insert to authenticated
  with check (public.pos_has('order') or public.pos_has('pay') or public.pos_has('move_table'));
drop policy if exists "pos_table_orders_update" on public.pos_table_orders;
create policy "pos_table_orders_update" on public.pos_table_orders for update to authenticated
  using (public.pos_has('order') or public.pos_has('pay') or public.pos_has('move_table'))
  with check (public.pos_has('order') or public.pos_has('pay') or public.pos_has('move_table'));

-- Phiếu Bếp/Bar
drop policy if exists "pos_tickets_all" on public.pos_tickets;
drop policy if exists "pos_tickets_select" on public.pos_tickets;
create policy "pos_tickets_select" on public.pos_tickets for select to authenticated
  using (public.pos_has('order') or public.pos_has('pay') or public.pos_has('kds_kitchen') or public.pos_has('kds_bar'));
drop policy if exists "pos_tickets_insert" on public.pos_tickets;
create policy "pos_tickets_insert" on public.pos_tickets for insert to authenticated with check (public.pos_has('order'));
drop policy if exists "pos_tickets_update" on public.pos_tickets;
create policy "pos_tickets_update" on public.pos_tickets for update to authenticated
  using ((station = 'bar' and public.pos_has('kds_bar')) or (station <> 'bar' and public.pos_has('kds_kitchen')))
  with check ((station = 'bar' and public.pos_has('kds_bar')) or (station <> 'bar' and public.pos_has('kds_kitchen')));

-- Hóa đơn (doanh thu)
drop policy if exists "pos_bills_select" on public.pos_bills;
create policy "pos_bills_select" on public.pos_bills for select to authenticated using (public.pos_has('bill_view') or public.pos_has('reports'));
drop policy if exists "pos_bills_insert" on public.pos_bills;
create policy "pos_bills_insert" on public.pos_bills for insert to authenticated with check (public.pos_has('pay'));
drop policy if exists "pos_bills_cancel" on public.pos_bills;
create policy "pos_bills_cancel" on public.pos_bills for update to authenticated
  using (public.pos_has('bill_cancel')) with check (public.pos_has('bill_cancel'));

-- Thực đơn
drop policy if exists "menu_items_pos_insert" on public.menu_items;
create policy "menu_items_pos_insert" on public.menu_items for insert to authenticated with check (public.pos_has('menu'));
drop policy if exists "menu_items_pos_update" on public.menu_items;
create policy "menu_items_pos_update" on public.menu_items for update to authenticated
  using (public.pos_has('menu')) with check (public.pos_has('menu'));

-- Kho, nguyên liệu, công thức
drop policy if exists "pos_ingredients_select" on public.pos_ingredients;
create policy "pos_ingredients_select" on public.pos_ingredients for select to authenticated
  using (public.pos_has('stock') or public.pos_has('recipes') or public.pos_has('reports') or public.pos_has('import'));
drop policy if exists "pos_ingredients_insert" on public.pos_ingredients;
create policy "pos_ingredients_insert" on public.pos_ingredients for insert to authenticated
  with check (public.pos_has('stock') or public.pos_has('import'));
drop policy if exists "pos_ingredients_update" on public.pos_ingredients;
create policy "pos_ingredients_update" on public.pos_ingredients for update to authenticated
  using (public.pos_has('stock') or public.pos_has('import')) with check (public.pos_has('stock') or public.pos_has('import'));
drop policy if exists "pos_stock_select" on public.pos_stock;
create policy "pos_stock_select" on public.pos_stock for select to authenticated
  using (public.pos_has('stock') or public.pos_has('recipes') or public.pos_has('reports'));
drop policy if exists "pos_stock_moves_select" on public.pos_stock_moves;
create policy "pos_stock_moves_select" on public.pos_stock_moves for select to authenticated
  using (public.pos_has('stock') or public.pos_has('recipes') or public.pos_has('reports'));
drop policy if exists "pos_recipes_select" on public.pos_recipes;
create policy "pos_recipes_select" on public.pos_recipes for select to authenticated
  using (public.pos_has('stock') or public.pos_has('recipes') or public.pos_has('reports') or public.pos_has('import'));
drop policy if exists "pos_recipes_write" on public.pos_recipes;
create policy "pos_recipes_write" on public.pos_recipes for all to authenticated
  using (public.pos_has('recipes') or public.pos_has('import')) with check (public.pos_has('recipes') or public.pos_has('import'));

-- Ca & quỹ tiền
drop policy if exists "pos_shifts_select" on public.pos_shifts;
create policy "pos_shifts_select" on public.pos_shifts for select to authenticated
  using (public.pos_has('shift') or public.pos_has('cash') or public.pos_has('reports'));
drop policy if exists "pos_shifts_insert" on public.pos_shifts;
create policy "pos_shifts_insert" on public.pos_shifts for insert to authenticated with check (public.pos_has('shift'));
drop policy if exists "pos_shifts_update" on public.pos_shifts;
create policy "pos_shifts_update" on public.pos_shifts for update to authenticated
  using (public.pos_has('shift') and status = 'open') with check (public.pos_has('shift'));
drop policy if exists "pos_cash_moves_select" on public.pos_cash_moves;
create policy "pos_cash_moves_select" on public.pos_cash_moves for select to authenticated
  using (public.pos_has('cash') or public.pos_has('shift') or public.pos_has('reports'));
drop policy if exists "pos_cash_moves_insert" on public.pos_cash_moves;
create policy "pos_cash_moves_insert" on public.pos_cash_moves for insert to authenticated with check (public.pos_has('cash'));

-- Nhật ký & cài đặt
drop policy if exists "pos_audit_select" on public.pos_audit;
create policy "pos_audit_select" on public.pos_audit for select to authenticated using (public.pos_has('audit'));
drop policy if exists "pos_settings_insert" on public.pos_settings;
create policy "pos_settings_insert" on public.pos_settings for insert to authenticated with check (public.pos_has('settings'));
drop policy if exists "pos_settings_update" on public.pos_settings;
create policy "pos_settings_update" on public.pos_settings for update to authenticated
  using (public.pos_has('settings')) with check (public.pos_has('settings'));

-- Hồ sơ nhân viên: mỗi người chỉ xem hồ sơ của mình (quy tắc có sẵn).
-- OWNER xem danh sách nhân viên qua hàm pos_staff_list() (không mở quyền đọc bảng users).

-- Kiểm tra
select 'perms_owner' as k, public.pos_role_default_perms('owner') ? 'staff' as ok
union all select 'trigger_bills', exists(select 1 from pg_trigger where tgname = 'pos_bills_guard_trg')
union all select 'trigger_audit', exists(select 1 from pg_trigger where tgname = 'pos_audit_fill_trg');
