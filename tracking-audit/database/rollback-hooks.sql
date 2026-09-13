-- Emergency full-source rollback only. First disable Meta and stop the worker scheduler.
-- Keep all order records, event IDs and delivery ledgers for reconciliation.
begin;
drop trigger if exists hanaz_paid_order on public.orders;
drop trigger if exists hanaz_guard_orders on public.orders;
drop trigger if exists hanaz_guard_items on public.order_items;
drop trigger if exists hanaz_guard_products on public.products;
commit;
