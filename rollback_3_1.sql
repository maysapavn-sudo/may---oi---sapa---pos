-- =====================================================================
-- MÂY POS – HOÀN TÁC Giai đoạn 3.1 (chỉ dùng khi cần quay lại trạng thái trước 3.1)
-- Khôi phục policy / function / quyền từ bản sao lưu pos_backup.snapshot (label 'truoc_3_1').
-- KHÔNG xóa dữ liệu nghiệp vụ. Sau khi chạy, cần đưa app.js về bản trước 3.1 trên GitHub.
-- =====================================================================
do $$
begin
  if not exists (select 1 from pos_backup.snapshot where label = 'truoc_3_1') then
    raise exception 'Không có bản sao lưu truoc_3_1 – dừng hoàn tác';
  end if;
end $$;

drop trigger if exists pos_audit_lock_trg        on public.pos_audit;
drop trigger if exists pos_audit_truncate_trg    on public.pos_audit;
drop trigger if exists pos_bills_clear_table_trg on public.pos_bills;
drop function if exists public.pos_audit_lock();
drop function if exists public.pos_bills_clear_table();
drop function if exists public.pos_send_order(int, uuid);
drop function if exists public.pos_check_items(jsonb, jsonb);

-- Function: nội dung + cấu hình như trước
do $$
declare r record;
begin
  for r in select name, definition from pos_backup.snapshot where label = 'truoc_3_1' and kind = 'function' loop
    execute r.definition;
    execute format('alter function %s reset all', r.name);
  end loop;
  -- cấu hình search_path cũ (nếu có) nằm trong định nghĩa → chạy lại để áp dụng
  for r in select definition from pos_backup.snapshot where label = 'truoc_3_1' and kind = 'function' loop
    execute r.definition;
  end loop;
end $$;

-- Policy: như trước
do $$
declare r record;
begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
  for r in select definition from pos_backup.snapshot where label = 'truoc_3_1' and kind = 'policy' loop
    execute r.definition;
  end loop;
end $$;

-- Quyền: như mặc định Supabase trước 3.1
grant all on all tables    in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
alter default privileges in schema public grant all on tables    to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, public;
do $$
declare r record;
begin
  for r in select p.oid::regprocedure sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prokind = 'f' and p.proname <> 'rls_auto_enable' loop
    if r.proname in ('_pos_audit', '_pos_stock_delta') then
      execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    else
      execute format('grant execute on function %s to public, anon, authenticated', r.sig);
    end if;
  end loop;
end $$;

select 'ĐÃ HOÀN TÁC 3.1' as ket_qua,
  (select count(*) from pg_policies where schemaname = 'public') as so_policy,
  (select count(*) from pos_backup.snapshot where label = 'truoc_3_1' and kind = 'policy') as so_policy_sao_luu;
