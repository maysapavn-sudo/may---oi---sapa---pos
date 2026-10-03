-- =====================================================================
-- MÂY POS – Cập nhật database (giai đoạn 1: đồng bộ nhiều máy + kiểu CukCuk)
-- Chạy trong Supabase → SQL Editor → New query → dán toàn bộ → Run.
-- An toàn khi chạy lại nhiều lần. KHÔNG xóa bảng hay dữ liệu có sẵn.
-- =====================================================================

-- 1. Hàm kiểm tra quyền
create or replace function public.is_pos_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users
    where auth_user_id::text = auth.uid()::text and active = true
  );
$$;

create or replace function public.is_pos_role(allowed text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users
    where auth_user_id::text = auth.uid()::text and active = true
      and role_code = any(allowed)
  );
$$;

-- 2. Đơn đang mở của từng bàn
create table if not exists public.pos_table_orders (
  table_no    int primary key,
  items       jsonb not null default '[]'::jsonb,
  status      text  not null default '',
  discount    numeric not null default 0,
  rev         bigint not null default 0,
  client_id   text,
  updated_by  text,
  updated_at  timestamptz not null default now()
);

-- 3. Vé Bếp/Bar
create table if not exists public.pos_tickets (
  id          uuid primary key,
  table_no    int  not null,
  item_id     text,
  item        text not null,
  qty         int  not null,
  note        text,
  station     text,
  status      text not null default 'MỚI',
  created_by  text,
  created_at  timestamptz not null default now(),
  done_at     timestamptz,
  served_at   timestamptz,
  updated_at  timestamptz not null default now()
);
alter table public.pos_tickets add column if not exists created_by text;
alter table public.pos_tickets add column if not exists done_at timestamptz;
alter table public.pos_tickets add column if not exists served_at timestamptz;
create index if not exists pos_tickets_status_idx on public.pos_tickets (status);
create index if not exists pos_tickets_created_idx on public.pos_tickets (created_at);

-- 4. Hóa đơn
create table if not exists public.pos_bills (
  id            uuid primary key,
  bill_no       bigint generated always as identity,
  table_no      int,
  items         jsonb not null default '[]'::jsonb,
  subtotal      numeric not null default 0,
  discount      numeric not null default 0,
  total         numeric not null default 0,
  method        text,
  parts         jsonb not null default '{}'::jsonb,
  guests        int not null default 0,
  created_by    text,
  created_at    timestamptz not null default now(),
  cancelled     boolean not null default false,
  cancel_reason text,
  cancelled_by  text,
  cancelled_at  timestamptz
);
alter table public.pos_bills add column if not exists guests int not null default 0;
alter table public.pos_bills add column if not exists cancelled boolean not null default false;
alter table public.pos_bills add column if not exists cancel_reason text;
alter table public.pos_bills add column if not exists cancelled_by text;
alter table public.pos_bills add column if not exists cancelled_at timestamptz;
create index if not exists pos_bills_created_idx on public.pos_bills (created_at);

-- 5. Thông tin món kiểu CukCuk (thêm cột, không đụng cột cũ)
alter table public.menu_items add column if not exists unit text default 'Phần';
alter table public.menu_items add column if not exists cost numeric default 0;
alter table public.menu_items add column if not exists is_signature boolean default false;
alter table public.menu_items add column if not exists is_market_price boolean default false;
alter table public.menu_items add column if not exists description text;
alter table public.menu_items add column if not exists hidden boolean default false;
alter table public.menu_items add column if not exists course text;

-- 6. Bảo mật (Row Level Security)
alter table public.pos_table_orders enable row level security;
alter table public.pos_tickets      enable row level security;
alter table public.pos_bills        enable row level security;
alter table public.menu_items       enable row level security;

drop policy if exists "pos_table_orders_all" on public.pos_table_orders;
create policy "pos_table_orders_all" on public.pos_table_orders
  for all to authenticated using (public.is_pos_user()) with check (public.is_pos_user());

drop policy if exists "pos_tickets_all" on public.pos_tickets;
create policy "pos_tickets_all" on public.pos_tickets
  for all to authenticated using (public.is_pos_user()) with check (public.is_pos_user());

drop policy if exists "pos_bills_select" on public.pos_bills;
create policy "pos_bills_select" on public.pos_bills
  for select to authenticated using (public.is_pos_user());

drop policy if exists "pos_bills_insert" on public.pos_bills;
create policy "pos_bills_insert" on public.pos_bills
  for insert to authenticated with check (public.is_pos_user());

-- Chỉ OWNER / QUẢN LÝ được hủy hóa đơn
drop policy if exists "pos_bills_cancel" on public.pos_bills;
create policy "pos_bills_cancel" on public.pos_bills
  for update to authenticated
  using (public.is_pos_role(array['owner','manager']))
  with check (public.is_pos_role(array['owner','manager']));

-- Menu: nhân viên POS xem được; chỉ OWNER / QUẢN LÝ thêm, sửa
drop policy if exists "menu_items_pos_select" on public.menu_items;
create policy "menu_items_pos_select" on public.menu_items
  for select to authenticated using (public.is_pos_user());

drop policy if exists "menu_items_pos_insert" on public.menu_items;
create policy "menu_items_pos_insert" on public.menu_items
  for insert to authenticated with check (public.is_pos_role(array['owner','manager']));

drop policy if exists "menu_items_pos_update" on public.menu_items;
create policy "menu_items_pos_update" on public.menu_items
  for update to authenticated
  using (public.is_pos_role(array['owner','manager']))
  with check (public.is_pos_role(array['owner','manager']));

-- 7. Bật Realtime (cập nhật tức thời giữa các máy)
do $$
declare t text;
begin
  foreach t in array array['pos_table_orders','pos_tickets','pos_bills','menu_items'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Kiểm tra: phải thấy 4 dòng menu_items, pos_bills, pos_table_orders, pos_tickets
select tablename from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename in ('menu_items','pos_bills','pos_table_orders','pos_tickets')
order by tablename;
