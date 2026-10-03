-- MÂY POS – Giai đoạn 2b: thêm phiếu ĐIỀU CHỈNH kho (+/−, bắt buộc lý do)
-- Chạy sau supabase_giai_doan_2.sql. An toàn khi chạy lại.

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
