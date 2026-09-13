-- Run against a STAGING clone first. Existing tables/columns are a contract, not inferred DDL.
-- This migration does not replace products, orders, order_items, contact_messages or Auth.
begin;
-- Fail early if the existing contract differs. No customer data is returned.
select id,title,sale_price,cost_price,in_stock from public.products limit 0;
select id,order_number,customer_name,phone,address,payment_method,payment_status,status,total_amount from public.orders limit 0;
select order_id,product_id,title_snapshot,qty,price_at_order,cost_at_order from public.order_items limit 0;
select full_name,email,subject,message from public.contact_messages limit 0;

create table public.hanaz_sessions (
 id uuid primary key, consent boolean not null default false, updated_at timestamptz not null default now()
);
create table public.hanaz_requests (
 session_id uuid not null references public.hanaz_sessions(id), request_key uuid not null,
 action text not null, fingerprint jsonb not null, response jsonb, created_at timestamptz not null default now(),
 primary key(session_id,request_key)
);
create table public.hanaz_order_tracking (
 order_id uuid primary key references public.orders(id), session_id uuid not null references public.hanaz_sessions(id),
 consent_at_action boolean not null, event_id uuid not null unique default gen_random_uuid(),
 context jsonb not null, accepted_at timestamptz not null default now(), reported_at timestamptz
);
create table public.hanaz_meta_outbox (
 id uuid primary key, session_id uuid not null references public.hanaz_sessions(id), order_id uuid references public.orders(id),
 payload jsonb not null, delivery_mode text not null, dataset_id text not null,
 status text not null default 'pending' check(status in ('pending','sending','sent','dead','suppressed')),
 attempts int not null default 0, next_attempt_at timestamptz not null default now(),
 created_at timestamptz not null default now(), lease uuid, lease_until timestamptz,
 last_code text, sent_at timestamptz
);
create index on public.hanaz_meta_outbox(status,next_attempt_at);
create table public.hanaz_rate_limits(bucket text primary key,window_start timestamptz not null,hits int not null);

create function public.hanaz_rate_limit(p_bucket text) returns boolean
language plpgsql security definer set search_path=pg_catalog,public as $$
declare n int;
begin
 insert into public.hanaz_rate_limits values(p_bucket,date_trunc('minute',now()),1)
 on conflict(bucket) do update set
 hits=case when hanaz_rate_limits.window_start=date_trunc('minute',now()) then hanaz_rate_limits.hits+1 else 1 end,
 window_start=date_trunc('minute',now()) returning hits into n;
 return n<=30;
end $$;

-- Called only after atomic order+items creation, or a trusted paid-state update.
create function public.hanaz_queue_purchase(p_order uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare o public.orders%rowtype; t public.hanaz_order_tracking%rowtype; custom jsonb; payload jsonb; amount numeric; ct int; et timestamptz;
begin
 select * into t from public.hanaz_order_tracking where order_id=p_order for update;
 if not found or t.reported_at is not null then return null; end if;
 select * into o from public.orders where id=p_order;
 if lower(coalesce(o.status::text,'')) in ('cancelled','canceled','failed','refunded','returned')
 or lower(coalesce(o.payment_status::text,'')) in ('failed','cancelled','canceled','refunded') then return null; end if;
 if o.payment_method::text<>'cod' and o.payment_status::text<>'paid' then return null; end if;
 select sum(qty*price_at_order),count(*) into amount,ct from public.order_items where order_id=p_order;
 if ct=0 or amount is null or amount<=0 or amount<>o.total_amount then return null; end if;
 if exists(select 1 from public.order_items where order_id=p_order and (qty<1 or price_at_order<=0)) then return null; end if;
 -- Purchase is recognized once; a later opt-in must never retroactively report it.
 et=case when o.payment_method::text='cod' then t.accepted_at else clock_timestamp() end;
 update public.hanaz_order_tracking set reported_at=et where order_id=p_order;
 if not t.consent_at_action or not (select consent from public.hanaz_sessions where id=t.session_id)
 or not coalesce((t.context->>'enabled')::boolean,false) then return null; end if;
 select jsonb_build_object('currency','PKR','value',o.total_amount,'content_type','product',
 'content_ids',jsonb_agg(product_id::text order by product_id),
 'contents',jsonb_agg(jsonb_build_object('id',product_id::text,'quantity',qty,'item_price',price_at_order) order by product_id),
 'num_items',sum(qty),'order_id',o.order_number) into custom from public.order_items where order_id=p_order;
 payload=jsonb_build_object('event_name','Purchase','event_id',t.event_id::text,'event_time',floor(extract(epoch from et)),
 'action_source','website','event_source_url',t.context->>'event_source_url','user_data',t.context->'user_data','custom_data',custom);
 insert into public.hanaz_meta_outbox(id,session_id,order_id,payload,delivery_mode,dataset_id) values(t.event_id,t.session_id,p_order,payload,t.context->>'delivery_mode',t.context->>'dataset_id') on conflict(id) do nothing;
 update public.hanaz_order_tracking set context=context-'user_data' where order_id=p_order;
 return jsonb_build_object('name','Purchase','id',t.event_id::text,'data',custom);
end $$;

create function public.hanaz_submit(p_session uuid,p_action text,p_key uuid,p_data jsonb,p_context jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare prior public.hanaz_requests%rowtype; consented boolean; prod public.products%rowtype;
item jsonb; items jsonb='[]'; total numeric=0; oid uuid; number text; v_response jsonb; event jsonb; eid uuid; fingerprint jsonb;
method public.orders.payment_method%type;
begin
 -- Same-session concurrent callbacks and duplicate submissions serialize here.
 perform pg_advisory_xact_lock(hashtextextended(p_session::text,0));
 insert into public.hanaz_sessions(id) values(p_session) on conflict do nothing;
 if p_action='consent' then
  update public.hanaz_sessions set consent=(p_data->>'accepted')::boolean,updated_at=now() where id=p_session;
  if not (p_data->>'accepted')::boolean then
   update public.hanaz_meta_outbox set status='suppressed',payload=payload-'user_data',last_code='consent_revoked'
   where session_id=p_session and status in ('pending','sending');
   update public.hanaz_order_tracking set consent_at_action=false,context='{}' where session_id=p_session;
  end if;
  return jsonb_build_object('accepted',(p_data->>'accepted')::boolean);
 end if;
 if p_action not in ('checkout','lead') or p_key is null then raise exception 'Invalid action'; end if;
 -- Store no raw personal fields in the request ledger. One-way digest uses built-in sha256.
 fingerprint=jsonb_build_object('sha256',encode(sha256(convert_to(p_data::text,'UTF8')),'hex'));
 select * into prior from public.hanaz_requests where session_id=p_session and request_key=p_key;
 if found then
  if prior.action<>p_action or prior.fingerprint<>fingerprint then raise exception 'Idempotency conflict' using errcode='23505'; end if;
  v_response=prior.response;
  -- Do not re-fire browser twins outside the bounded retry/deduplication period.
  if prior.created_at<now()-interval '24 hours'
  or not coalesce((p_context->>'consent_claim')::boolean,false)
  or not (select consent from public.hanaz_sessions where id=p_session)
  or exists(select 1 from public.hanaz_meta_outbox where id=(v_response->'event'->>'id')::uuid and status='suppressed')
  then v_response=v_response-'event'; end if;
  return v_response;
 end if;
 insert into public.hanaz_requests(session_id,request_key,action,fingerprint) values(p_session,p_key,p_action,fingerprint);
 select consent and coalesce((p_context->>'consent_claim')::boolean,false) into consented from public.hanaz_sessions where id=p_session;
 if p_action='checkout' then
  if jsonb_array_length(p_data->'items') not between 1 and 30 or p_data->>'payment_method' not in ('cod','bank_deposit','easypaisa','jazzcash') then raise exception 'Invalid checkout'; end if;
  for item in select value from jsonb_array_elements(p_data->'items') order by value->>'id' loop
   select * into prod from public.products where id=(item->>'id')::uuid for share;
   if not found or prod.in_stock is not true or prod.sale_price is null or prod.sale_price<=0 or (item->>'qty')::int not between 1 and 10 then raise exception 'Unavailable product'; end if;
   if exists(select 1 from jsonb_array_elements(items) j where j->>'id'=prod.id::text) then raise exception 'Duplicate product'; end if;
   total=total+prod.sale_price*(item->>'qty')::int;
   items=items||jsonb_build_object('id',prod.id,'title',prod.title,'price',prod.sale_price,'cost',coalesce(prod.cost_price,0),'qty',(item->>'qty')::int);
  end loop;
  -- Website currently promises free shipping, no coupons or additional tax calculation.
  if total<>(p_data->>'expected_total')::numeric then raise exception 'Price changed'; end if;
  oid=gen_random_uuid();number='HO-'||upper(replace(oid::text,'-',''));
  -- Assign through the existing column type (text/check constraint or an enum).
  method=p_data->>'payment_method';
  -- Never inherit a paid default or accept payment/order status from clients.
  insert into public.orders(id,order_number,customer_name,phone,address,payment_method,payment_status,status,total_amount)
  values(oid,number,p_data->>'name',p_data->>'phone',p_data->>'address',method,'unpaid','pending',total);
  insert into public.order_items(order_id,product_id,title_snapshot,qty,price_at_order,cost_at_order)
  select oid,(j->>'id')::uuid,j->>'title',(j->>'qty')::int,(j->>'price')::numeric,(j->>'cost')::numeric from jsonb_array_elements(items) j;
  insert into public.hanaz_order_tracking(order_id,session_id,consent_at_action,context)
  values(oid,p_session,consented,case when consented then p_context else '{}'::jsonb end);
  event=public.hanaz_queue_purchase(oid);
  v_response=jsonb_build_object('order_number',number,'total',total,'currency','PKR','payment_method',p_data->>'payment_method','payment_status','unpaid');
 else
  insert into public.contact_messages(full_name,email,subject,message)
  values(p_data->>'name',coalesce(p_data->>'email',''),p_data->>'subject',
  case when p_data->>'kind'='consultation' then 'Phone: '||(p_data->>'phone')||E'\n' else '' end||(p_data->>'message'));
  v_response=jsonb_build_object('accepted',true);
  -- Consultation may contain health details. No advertising event or form contents are sent for it.
  if consented and (p_context->>'enabled')::boolean and p_data->>'kind'<>'consultation' then
   eid=gen_random_uuid();event=jsonb_build_object('name','Lead','id',eid::text,'data','{}'::jsonb);
   insert into public.hanaz_meta_outbox(id,session_id,delivery_mode,dataset_id,payload) values(eid,p_session,p_context->>'delivery_mode',p_context->>'dataset_id',jsonb_build_object(
   'event_name','Lead','event_id',eid::text,'event_time',floor(extract(epoch from clock_timestamp())),
   'action_source','website','event_source_url',p_context->>'event_source_url','user_data',p_context->'user_data'));
  end if;
 end if;
 if event is not null then v_response=v_response||jsonb_build_object('event',event); end if;
 update public.hanaz_requests set response=v_response where session_id=p_session and request_key=p_key;
 return v_response;
end $$;

create function public.hanaz_payment_changed() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.payment_status::text='paid' and old.payment_status::text is distinct from 'paid' then perform public.hanaz_queue_purchase(new.id); end if;
 if lower(coalesce(new.status::text,'')) in ('cancelled','canceled','failed','refunded','returned')
 or lower(coalesce(new.payment_status::text,'')) in ('failed','cancelled','canceled','refunded') then
  update public.hanaz_meta_outbox set status='suppressed',last_code='order_ineligible' where order_id=new.id and status in ('pending','sending');
 end if;
 return new;
end $$;
create trigger hanaz_paid_order after update of payment_status,status on public.orders for each row execute function public.hanaz_payment_changed();

create function public.hanaz_claim_events() returns setof public.hanaz_meta_outbox
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 -- Bounded delivery window protects browser/server deduplication on late retries.
 update public.hanaz_meta_outbox set status='dead',last_code='retry_window_expired' where status in ('pending','sending') and (attempts>=6 or created_at<now()-interval '24 hours') and (lease_until is null or lease_until<now());
 return query with picked as (
 select id from public.hanaz_meta_outbox where attempts<6 and created_at>=now()-interval '24 hours'
 and ((status='pending' and next_attempt_at<=now()) or (status='sending' and lease_until<now()))
 order by created_at for update skip locked limit 5
 ) update public.hanaz_meta_outbox o set status='sending',attempts=o.attempts+1,lease=gen_random_uuid(),lease_until=now()+interval '2 minutes'
 from picked where o.id=picked.id returning o.*;
end $$;
create function public.hanaz_event_allowed(p_id uuid,p_lease uuid) returns boolean
language sql security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.hanaz_meta_outbox b join public.hanaz_sessions s on s.id=b.session_id
 left join public.orders o on o.id=b.order_id where b.id=p_id and b.lease=p_lease and b.status='sending'
 and b.lease_until>now() and s.consent and (b.order_id is null or (
 lower(coalesce(o.status::text,'')) not in ('cancelled','canceled','failed','refunded','returned') and
 lower(coalesce(o.payment_status::text,'')) not in ('failed','cancelled','canceled','refunded'))));
$$;
create function public.hanaz_finish_event(p_id uuid,p_lease uuid,p_outcome text,p_code text) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if p_outcome not in ('sent','retry','dead','suppressed') then raise exception 'Invalid outcome'; end if;
 update public.hanaz_meta_outbox set status=case when p_outcome='retry' then case when attempts>=6 then 'dead' else 'pending' end else p_outcome end,
 next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::int)),
 sent_at=case when p_outcome='sent' then now() else sent_at end,last_code=left(p_code,80),lease_until=null,
 payload=case when p_outcome in ('sent','suppressed') then payload-'user_data' else payload end
 where id=p_id and lease=p_lease and status='sending';
 -- Rate-limit hashes are short-lived; ledger keys remain for durable idempotency.
 delete from public.hanaz_rate_limits where window_start<now()-interval '1 day';
 -- Matching fields have no reason to remain after the retry window.
 update public.hanaz_meta_outbox set payload=payload-'user_data' where created_at<now()-interval '2 days' and payload?'user_data';
end $$;

-- Private tables and RPCs: never callable with the site's public key.
do $$ declare n text; f record; begin
 foreach n in array array['hanaz_sessions','hanaz_requests','hanaz_order_tracking','hanaz_meta_outbox','hanaz_rate_limits'] loop
  execute format('alter table public.%I enable row level security',n);
  execute format('revoke all on public.%I from public,anon,authenticated',n);
 end loop;
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname like 'hanaz_%' loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
commit;
