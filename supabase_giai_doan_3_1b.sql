-- =====================================================================
-- MÂY POS – Giai đoạn 3.1b: sửa lỗi phục vụ không gọi thêm được món
-- vào bàn đã có món gửi Bếp/Bar (pha INSERT của lệnh upsert bị kiểm tra
-- như bàn trống); thu ngân thanh toán bàn đã được Quản lý giảm giá.
-- Chỉ thay 2 hàm kiểm tra. Không đổi dữ liệu.
-- =====================================================================
create or replace function public.pos_table_orders_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_max numeric; r record; v_old_disc numeric := 0;
begin
  if coalesce(current_setting('pos.sys', true), '') = '1' then return new; end if;   -- chỉ hàm máy chủ (gửi bếp / thanh toán)
  if not (public.pos_has('order') or public.pos_has('pay') or public.pos_has('move_table')) then
    raise exception 'Không có quyền gọi món';
  end if;
  -- Lệnh upsert (insert ... on conflict do update): pha INSERT chạy trước khi biết trùng khóa.
  -- Nếu bàn đã có dòng, bỏ qua kiểm tra ở pha này; pha UPDATE ngay sau đó kiểm tra đầy đủ.
  if tg_op = 'INSERT' and exists (select 1 from public.pos_table_orders where table_no = new.table_no) then
    return new;
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
-- Thanh toán: giảm giá chỉ cần khớp đơn bàn (đã kiểm quyền người áp giảm giá)
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
    -- Giảm giá đã được kiểm tra quyền khi người có quyền áp vào đơn bàn; ở đây chỉ cần khớp đơn bàn
    if coalesce(new.discount, 0) < 0 or coalesce(new.discount, 0) > 100 then raise exception 'Giảm giá không hợp lệ'; end if;
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

alter function public.pos_bills_guard() set search_path = public, pg_temp;
revoke all on function public.pos_bills_guard() from public, anon;
alter function public.pos_table_orders_guard() set search_path = public, pg_temp;
revoke all on function public.pos_table_orders_guard() from public, anon;
select 'ĐÃ SỬA 3.1b' as ket_qua;
