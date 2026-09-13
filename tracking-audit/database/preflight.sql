-- Read-only schema/security review; no customer rows or secret values.
select table_name,column_name,data_type,udt_name,is_nullable,column_default,character_maximum_length
from information_schema.columns where table_schema='public'
and table_name in ('products','orders','order_items','contact_messages') order by table_name,ordinal_position;
select c.relname,con.conname,pg_get_constraintdef(con.oid) from pg_constraint con join pg_class c on c.oid=con.conrelid
where c.relnamespace='public'::regnamespace and c.relname in ('products','orders','order_items','contact_messages');
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename in ('products','orders','order_items','contact_messages');
select event_object_table,trigger_name,action_timing,event_manipulation,action_statement from information_schema.triggers
where event_object_schema='public' and event_object_table in ('products','orders','order_items','contact_messages');
select routine_name from information_schema.routines where routine_schema='public'
and routine_name in ('get_order_by_number_and_phone','get_order_items_by_number_and_phone','get_orders_by_phone');
