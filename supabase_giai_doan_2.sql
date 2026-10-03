-- =====================================================================
-- MÂY POS – Giai đoạn 2: Kho nhiều điểm, Công thức, Ca & Quỹ tiền,
--             Nhật ký (Audit), Cài đặt, Đặt chỗ
-- Chạy trong Supabase → SQL Editor → New query → dán toàn bộ → Run.
-- An toàn khi chạy lại. KHÔNG xóa bảng hay dữ liệu có sẵn.
-- Cần chạy file giai đoạn 1 (supabase_dong_bo.sql) trước.
-- =====================================================================

-- ---------- 1. Nguyên liệu ----------
create table if not exists public.pos_ingredients (
  id          bigint generated always as identity primary key,
  code        text not null unique,
  name        text not null,
  unit        text not null default 'g',
  cost        numeric not null default 0,      -- giá nhập gần nhất / 1 đơn vị
  min_qty     numeric not null default 0,      -- mức tồn tối thiểu (tổng các kho)
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- 2. Tồn kho theo từng điểm: KHO (kho tổng), BEP, BAR ----------
create table if not exists public.pos_stock (
  ingredient_id bigint not null references public.pos_ingredients(id),
  location      text   not null check (location in ('KHO','BEP','BAR')),
  qty           numeric not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (ingredient_id, location)
);

-- ---------- 3. Phiếu kho (mọi biến động tồn kho) ----------
create table if not exists public.pos_stock_moves (
  id            bigint generated always as identity primary key,
  ingredient_id bigint not null references public.pos_ingredients(id),
  location      text   not null,
  qty           numeric not null,               -- (+) tăng, (−) giảm
  type          text   not null,                -- NHẬP, XUẤT, HỦY, CHUYỂN ĐI, CHUYỂN ĐẾN, ĐIỀU CHỈNH, KIỂM KÊ, BÁN HÀNG, HOÀN HĐ HỦY, HAO HỤT
  unit_cost     numeric,
  note          text,
  ref           text,                           -- tham chiếu (số hóa đơn, mã chuyển kho...)
  created_by    text,
  created_at    timestamptz not null default now()
);
create index if not exists pos_stock_moves_created_idx on public.pos_stock_moves (created_at);
create index if not exists pos_stock_moves_ing_idx on public.pos_stock_moves (ingredient_id);

-- ---------- 4. Công thức (định lượng nguyên liệu cho 1 món) ----------
create table if not exists public.pos_recipes (
  menu_item_id  bigint not null,
  ingredient_id bigint not null references public.pos_ingredients(id),
  qty           numeric not null check (qty > 0),
  primary key (menu_item_id, ingredient_id)
);

-- ---------- 5. Ca làm việc ----------
create table if not exists public.pos_shifts (
  id           uuid primary key,
  status       text not null default 'open' check (status in ('open','closed')),
  opened_by    text,
  opened_at    timestamptz not null default now(),
  opening      numeric not null default 0,     -- quỹ đầu ca
  closed_by    text,
  closed_at    timestamptz,
  cash_sales   numeric,                         -- tiền mặt bán hàng trong ca
  cash_in      numeric,                         -- phiếu thu tiền mặt trong ca
  cash_out     numeric,                         -- phiếu chi tiền mặt trong ca
  expected     numeric,
  actual       numeric,
  diff         numeric,
  reason       text
);
create unique index if not exists pos_shifts_one_open on public.pos_shifts ((status)) where status = 'open';

-- ---------- 6. Phiếu thu / chi (Quỹ tiền) ----------
create table if not exists public.pos_cash_moves (
  id          uuid primary key,
  shift_id    uuid references public.pos_shifts(id),
  type        text not null check (type in ('THU','CHI')),
  method      text not null default 'Tiền mặt',
  amount      numeric not null check (amount > 0),
  category    text,
  note        text,
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists pos_cash_moves_created_idx on public.pos_cash_moves (created_at);

-- ---------- 7. Nhật ký thao tác ----------
create table if not exists public.pos_audit (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       text,
  role        text,
  action      text not null,
  detail      text,
  risk        boolean not null default false
);
create index if not exists pos_audit_at_idx on public.pos_audit (at);

-- ---------- 8. Cài đặt (tài khoản nhận tiền...) ----------
create table if not exists public.pos_settings (
  key         text primary key,
  value       jsonb not null,
  updated_by  text,
  updated_at  timestamptz not null default now()
);

-- ---------- 9. Đặt chỗ ----------
create table if not exists public.pos_reservations (
  id          uuid primary key,
  guest_name  text not null,
  phone       text,
  guests      int  not null default 2,
  reserve_at  timestamptz not null,
  table_no    int,
  deposit     numeric not null default 0,
  note        text,
  status      text not null default 'ĐÃ ĐẶT' check (status in ('ĐÃ ĐẶT','ĐÃ ĐẾN','HỦY','KHÔNG ĐẾN')),
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists pos_reservations_at_idx on public.pos_reservations (reserve_at);

-- =====================================================================
-- HÀM XỬ LÝ KHO (chạy trên máy chủ, an toàn khi nhiều máy cùng thao tác)
-- =====================================================================
create or replace function public.pos_user_name()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select username from public.users where auth_user_id::text = auth.uid()::text limit 1), 'SYSTEM');
$$;

-- Ghi 1 dòng biến động + cập nhật tồn (dùng nội bộ)
create or replace function public._pos_stock_delta(p_ing bigint, p_loc text, p_delta numeric, p_type text,
                                                   p_note text, p_ref text, p_cost numeric, p_by text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_delta = 0 then return; end if;
  insert into public.pos_stock_moves(ingredient_id, location, qty, type, unit_cost, note, ref, created_by)
  values (p_ing, p_loc, p_delta, p_type, p_cost, p_note, p_ref, p_by);
  insert into public.pos_stock(ingredient_id, location, qty, updated_at)
  values (p_ing, p_loc, p_delta, now())
  on conflict (ingredient_id, location)
  do update set qty = public.pos_stock.qty + excluded.qty, updated_at = now();
end $$;
revoke all on function public._pos_stock_delta(bigint,text,numeric,text,text,text,numeric,text) from public, anon, authenticated;

-- Phiếu kho từ màn hình Kho: NHẬP / XUẤT / HỦY / CHUYỂN / ĐIỀU CHỈNH / KIỂM KÊ
create or replace function public.pos_stock_post(p_type text, p_ing bigint, p_loc text, p_qty numeric,
                                                 p_to text default null, p_cost numeric default null,
                                                 p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_by text := public.pos_user_name(); v_cur numeric; v_ref text;
begin
  if not public.is_pos_role(array['owner','manager','stock']) then
    raise exception 'Không có quyền thao tác kho';
  end if;
  if p_loc not in ('KHO','BEP','BAR') then raise exception 'Kho không hợp lệ'; end if;
  if p_qty is null or (p_qty < 0 and p_type <> 'ĐIỀU CHỈNH') then raise exception 'Số lượng không hợp lệ'; end if;
  if not exists (select 1 from public.pos_ingredients where id = p_ing) then raise exception 'Không tìm thấy nguyên liệu'; end if;

  if p_type = 'NHẬP' then
    perform public._pos_stock_delta(p_ing, p_loc, p_qty, 'NHẬP', p_note, null, p_cost, v_by);
    if coalesce(p_cost,0) > 0 then
      update public.pos_ingredients set cost = p_cost, updated_at = now() where id = p_ing;
    end if;
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

-- Hao hụt khi hủy món đã chế biến (trừ nguyên liệu theo công thức)
create or replace function public.pos_waste_item(p_menu_item bigint, p_qty numeric, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare r record; v_loc text; v_by text := public.pos_user_name();
begin
  if not public.is_pos_user() then raise exception 'Không có quyền'; end if;
  select case when station = 'bar' then 'BAR' else 'BEP' end into v_loc from public.menu_items where id = p_menu_item;
  v_loc := coalesce(v_loc,'BEP');
  for r in select ingredient_id, qty from public.pos_recipes where menu_item_id = p_menu_item loop
    perform public._pos_stock_delta(r.ingredient_id, v_loc, -(r.qty * p_qty), 'HAO HỤT', p_note, null, null, v_by);
  end loop;
end $$;
grant execute on function public.pos_waste_item(bigint,numeric,text) to authenticated;

-- Tự trừ kho khi thanh toán, tự hoàn kho khi hủy hóa đơn
create or replace function public.pos_bill_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare it jsonb; r record; v_loc text; v_sign int; v_type text; v_qty numeric; v_mid bigint;
begin
  if tg_op = 'INSERT' then
    v_sign := -1; v_type := 'BÁN HÀNG';
  elsif tg_op = 'UPDATE' and new.cancelled and not coalesce(old.cancelled,false) then
    v_sign := 1;  v_type := 'HOÀN HĐ HỦY';
  else
    return new;
  end if;
  for it in select * from jsonb_array_elements(coalesce(new.items,'[]'::jsonb)) loop
    begin
      v_mid := (it->>'id')::bigint;
    exception when others then
      continue;
    end;
    v_qty := coalesce((it->>'qty')::numeric, 0);
    v_loc := case when it->>'station' = 'bar' then 'BAR' else 'BEP' end;
    for r in select ingredient_id, qty from public.pos_recipes where menu_item_id = v_mid loop
      perform public._pos_stock_delta(r.ingredient_id, v_loc, v_sign * r.qty * v_qty, v_type,
              it->>'name', 'HĐ #' || new.bill_no, null, coalesce(new.created_by,'SYSTEM'));
    end loop;
  end loop;
  return new;
end $$;
drop trigger if exists pos_bills_stock_trg on public.pos_bills;
create trigger pos_bills_stock_trg after insert or update of cancelled on public.pos_bills
  for each row execute function public.pos_bill_stock();

-- =====================================================================
-- BẢO MẬT (Row Level Security)
-- =====================================================================
alter table public.pos_ingredients  enable row level security;
alter table public.pos_stock        enable row level security;
alter table public.pos_stock_moves  enable row level security;
alter table public.pos_recipes      enable row level security;
alter table public.pos_shifts       enable row level security;
alter table public.pos_cash_moves   enable row level security;
alter table public.pos_audit        enable row level security;
alter table public.pos_settings     enable row level security;
alter table public.pos_reservations enable row level security;

-- Nguyên liệu: mọi nhân viên xem; OWNER / QUẢN LÝ / KHO thêm, sửa
drop policy if exists "pos_ingredients_select" on public.pos_ingredients;
create policy "pos_ingredients_select" on public.pos_ingredients for select to authenticated using (public.is_pos_user());
drop policy if exists "pos_ingredients_insert" on public.pos_ingredients;
create policy "pos_ingredients_insert" on public.pos_ingredients for insert to authenticated with check (public.is_pos_role(array['owner','manager','stock']));
drop policy if exists "pos_ingredients_update" on public.pos_ingredients;
create policy "pos_ingredients_update" on public.pos_ingredients for update to authenticated
  using (public.is_pos_role(array['owner','manager','stock'])) with check (public.is_pos_role(array['owner','manager','stock']));

-- Tồn kho & phiếu kho: chỉ xem; ghi qua hàm pos_stock_post / trigger
drop policy if exists "pos_stock_select" on public.pos_stock;
create policy "pos_stock_select" on public.pos_stock for select to authenticated using (public.is_pos_user());
drop policy if exists "pos_stock_moves_select" on public.pos_stock_moves;
create policy "pos_stock_moves_select" on public.pos_stock_moves for select to authenticated using (public.is_pos_user());

-- Công thức: mọi nhân viên xem; OWNER / QUẢN LÝ / KHO sửa
drop policy if exists "pos_recipes_select" on public.pos_recipes;
create policy "pos_recipes_select" on public.pos_recipes for select to authenticated using (public.is_pos_user());
drop policy if exists "pos_recipes_write" on public.pos_recipes;
create policy "pos_recipes_write" on public.pos_recipes for all to authenticated
  using (public.is_pos_role(array['owner','manager','stock'])) with check (public.is_pos_role(array['owner','manager','stock']));

-- Ca: xem mọi nhân viên; mở/đóng: OWNER / QUẢN LÝ / THU NGÂN
drop policy if exists "pos_shifts_select" on public.pos_shifts;
create policy "pos_shifts_select" on public.pos_shifts for select to authenticated using (public.is_pos_user());
drop policy if exists "pos_shifts_insert" on public.pos_shifts;
create policy "pos_shifts_insert" on public.pos_shifts for insert to authenticated with check (public.is_pos_role(array['owner','manager','cashier']));
drop policy if exists "pos_shifts_update" on public.pos_shifts;
create policy "pos_shifts_update" on public.pos_shifts for update to authenticated
  using (public.is_pos_role(array['owner','manager','cashier']) and status = 'open')
  with check (public.is_pos_role(array['owner','manager','cashier']));

-- Thu / chi: xem & thêm: OWNER / QUẢN LÝ / THU NGÂN / KHO (không sửa, không xóa)
drop policy if exists "pos_cash_moves_select" on public.pos_cash_moves;
create policy "pos_cash_moves_select" on public.pos_cash_moves for select to authenticated using (public.is_pos_role(array['owner','manager','cashier','stock']));
drop policy if exists "pos_cash_moves_insert" on public.pos_cash_moves;
create policy "pos_cash_moves_insert" on public.pos_cash_moves for insert to authenticated with check (public.is_pos_role(array['owner','manager','cashier']));

-- Nhật ký: mọi nhân viên ghi; OWNER / QUẢN LÝ / KHO xem; không ai sửa, xóa
drop policy if exists "pos_audit_insert" on public.pos_audit;
create policy "pos_audit_insert" on public.pos_audit for insert to authenticated with check (public.is_pos_user());
drop policy if exists "pos_audit_select" on public.pos_audit;
create policy "pos_audit_select" on public.pos_audit for select to authenticated using (public.is_pos_role(array['owner','manager','stock']));

-- Cài đặt: mọi nhân viên xem; chỉ OWNER sửa
drop policy if exists "pos_settings_select" on public.pos_settings;
create policy "pos_settings_select" on public.pos_settings for select to authenticated using (public.is_pos_user());
drop policy if exists "pos_settings_insert" on public.pos_settings;
create policy "pos_settings_insert" on public.pos_settings for insert to authenticated with check (public.is_pos_role(array['owner']));
drop policy if exists "pos_settings_update" on public.pos_settings;
create policy "pos_settings_update" on public.pos_settings for update to authenticated
  using (public.is_pos_role(array['owner'])) with check (public.is_pos_role(array['owner']));

-- Đặt chỗ: mọi nhân viên xem, thêm, sửa trạng thái (không xóa)
drop policy if exists "pos_reservations_select" on public.pos_reservations;
create policy "pos_reservations_select" on public.pos_reservations for select to authenticated using (public.is_pos_user());
drop policy if exists "pos_reservations_insert" on public.pos_reservations;
create policy "pos_reservations_insert" on public.pos_reservations for insert to authenticated with check (public.is_pos_user());
drop policy if exists "pos_reservations_update" on public.pos_reservations;
create policy "pos_reservations_update" on public.pos_reservations for update to authenticated
  using (public.is_pos_user()) with check (public.is_pos_user());

-- =====================================================================
-- REALTIME
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['pos_ingredients','pos_stock','pos_stock_moves','pos_recipes','pos_shifts',
                           'pos_cash_moves','pos_audit','pos_settings','pos_reservations'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Kiểm tra: phải thấy 9 dòng
select tablename from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename in ('pos_ingredients','pos_stock','pos_stock_moves','pos_recipes','pos_shifts',
                    'pos_cash_moves','pos_audit','pos_settings','pos_reservations')
order by tablename;
