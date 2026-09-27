-- REQUIRED before traffic goes to the new server checkout.
-- Populate verified admin Auth UUIDs before release if your separate admin app writes directly.
begin;
create table public.hanaz_commerce_admins(user_id uuid primary key);
alter table public.hanaz_commerce_admins enable row level security;
revoke all on public.hanaz_commerce_admins from public,anon,authenticated;
create function public.hanaz_is_commerce_admin() returns boolean
language sql security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.hanaz_commerce_admins where user_id=auth.uid());
$$;
revoke all on function public.hanaz_is_commerce_admin() from public;
grant execute on function public.hanaz_is_commerce_admin() to anon,authenticated,service_role;
-- This function intentionally uses invoker rights: server RPCs run as their owner;
-- PostgREST browser calls run as anon/authenticated. Existing RLS still applies to admins.
create function public.hanaz_guard_order_write() returns trigger
language plpgsql set search_path=pg_catalog,public as $$
begin
 if current_user in ('anon','authenticated') and not public.hanaz_is_commerce_admin() then
  raise insufficient_privilege using message='Orders must use the server checkout';
 end if;
 if TG_OP='DELETE' then return old; end if; return new;
end $$;
create trigger hanaz_guard_orders before insert or update or delete on public.orders for each row execute function public.hanaz_guard_order_write();
create trigger hanaz_guard_items before insert or update or delete on public.order_items for each row execute function public.hanaz_guard_order_write();
create trigger hanaz_guard_products before insert or update or delete on public.products for each row execute function public.hanaz_guard_order_write();
commit;
