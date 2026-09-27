const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {database}=require('./database.cjs');const core=require('../../hanaz-customer/server/core');const worker=require('../../hanaz-customer/server/meta-worker');
const env={META_ENABLED:'true',META_MODE:'test',META_PIXEL_ID:'568351333004084',META_ACCESS_TOKEN:'LOCAL_TEST_TOKEN',META_TEST_EVENT_CODE:'LOCAL_TEST',SITE_ORIGIN:'https://staging.example',SESSION_SECRET:'a'.repeat(48)};
const order=(payment='cod')=>({name:'Local Test',phone:'923001234567',address:'Synthetic address',payment_method:payment,expected_total:4197,items:[{id:'7ff4066c-ca6d-4fc2-8405-46289d66f05f',qty:2},{id:'0aa58f95-83d6-45f6-a7f3-2c1ed3b3ac39',qty:1}]});
const ctx={enabled:true,consent_claim:true,delivery_mode:'test',dataset_id:'568351333004084',event_source_url:'https://staging.example/checkout.html',user_data:{ph:[core.hash('923001234567')],client_user_agent:'local-test'}};
test('atomic commerce, authoritative values, consent, retries and backend-only payment transition',async t=>{
 const {db,rpc}=await database();const sid=randomUUID();const submit=(action,data,key=randomUUID(),session=sid)=>rpc('hanaz_submit',{p_session:session,p_action:action,p_key:key,p_data:data,p_context:ctx});
 await submit('consent',{accepted:true});let first,key=randomUUID();
 await t.test('concurrent same request creates exactly one COD order and one logical Purchase',async()=>{
  const results=await Promise.all(Array.from({length:8},()=>submit('checkout',order(),key)));first=results[0];results.forEach(r=>assert.deepEqual(r,first));
  assert.equal(first.event.name,'Purchase');assert.equal(first.event.data.value,4197);assert.equal(first.event.data.num_items,3);assert.equal(first.payment_status,'unpaid');
  assert.equal((await db.query('select count(*)::int n from orders')).rows[0].n,1);
  assert.equal((await db.query('select status from orders limit 1')).rows[0].status,'Pending');
  const out=(await db.query('select * from hanaz_meta_outbox')).rows;assert.equal(out.length,1);assert.equal(out[0].payload.event_id,first.event.id);assert.equal(out[0].payload.event_name,'Purchase');assert.equal(out[0].payload.action_source,'website');
 });
 await t.test('modified duplicate, forged total and unavailable product roll back fully',async()=>{
  await assert.rejects(submit('checkout',{...order(),name:'Changed'},key));
  await assert.rejects(submit('checkout',{...order(),expected_total:1}));
  await assert.rejects(submit('checkout',{...order(),items:[{id:randomUUID(),qty:1}]}));
  assert.equal((await db.query('select count(*)::int n from orders')).rows[0].n,1);
 });
 await t.test('item insertion failure rolls back the header and event',async()=>{
  await db.exec(`create function fail_test_item() returns trigger language plpgsql as $$ begin raise exception 'synthetic item failure'; end $$;create trigger fail_test before insert on order_items for each row execute function fail_test_item();`);
  await assert.rejects(submit('checkout',order()));await db.exec('drop trigger fail_test on order_items');
  assert.equal((await db.query('select count(*)::int n from orders')).rows[0].n,1);
 });
 await t.test('manual transfer has no Purchase until paid; duplicate paid updates reuse one event',async()=>{
  const r=await submit('checkout',order('easypaisa'));assert.equal(r.event,undefined);
  await db.query("update orders set payment_status='paid' where order_number=$1",[r.order_number]);await db.query("update orders set payment_status='paid' where order_number=$1",[r.order_number]);
  assert.equal((await db.query('select count(*)::int n from hanaz_meta_outbox')).rows[0].n,2);
 });
 await t.test('failed/cancelled manual payment never qualifies',async()=>{
  const r=await submit('checkout',order('bank_deposit'));await db.query("update orders set status='Cancelled',payment_status='paid' where order_number=$1",[r.order_number]);
  assert.equal((await db.query('select count(*)::int n from hanaz_meta_outbox')).rows[0].n,2);
 });
 await t.test('declined consent preserves order creation and suppresses pending jobs',async()=>{
  await submit('consent',{accepted:false});assert.equal((await submit('checkout',order())).event,undefined);
  assert.equal((await db.query("select count(*)::int n from hanaz_meta_outbox where status='suppressed'")).rows[0].n,2);
  assert.equal((await submit('checkout',order(),key)).event,undefined);
 });
 await t.test('accepted contact gets one Lead only after insertion; consultation never sends details',async()=>{
  await submit('consent',{accepted:true});const key=randomUUID(),contact={kind:'contact',name:'Test',email:'test@example.invalid',subject:'Question',message:'Test message'};
  const a=await submit('lead',contact,key),b=await submit('lead',contact,key);assert.deepEqual(a,b);assert.equal(a.event.name,'Lead');
  const c=await submit('lead',{...contact,kind:'consultation',phone:'923001234567',message:'private health content'});assert.equal(c.event,undefined);
  assert.equal((await db.query('select count(*)::int n from contact_messages')).rows[0].n,2);
  assert.ok(!(JSON.stringify((await db.query('select payload from hanaz_meta_outbox')).rows)).includes('private health'));
 });
 await t.test('worker leases prevent duplicate claims; API failures preserve order and event ID',async()=>{
  const before=(await db.query('select count(*)::int n from orders')).rows[0].n;
  const counts=await worker.run({env,call:rpc,fetcher:async()=>new Response(JSON.stringify({error:{code:2,is_transient:true}}),{status:503})});assert.equal(counts.retry,1);
  const r=(await db.query("select * from hanaz_meta_outbox where status='pending'")).rows[0];assert.equal(r.attempts,1);
  await db.exec("update hanaz_meta_outbox set next_attempt_at=now() where status='pending'");
  const a=await rpc('hanaz_claim_events',{}),b=await rpc('hanaz_claim_events',{});assert.equal(a.length,1);assert.equal(b.length,0);assert.equal(a[0].id,r.id);
  assert.equal((await db.query('select count(*)::int n from orders')).rows[0].n,before);
 });
 await t.test('browser/public-key clients cannot modify orders or call trusted RPCs',async()=>{
  await db.exec('set role anon');await assert.rejects(db.query("update orders set payment_status='paid'"));await assert.rejects(rpc('hanaz_claim_events',{}));await db.exec('reset role');
  await db.exec('set role authenticated');await assert.rejects(db.query("update orders set total_amount=1"));await db.exec('reset role');
 });
 await t.test('persistent endpoint rate limits bound submissions',async()=>{for(let i=0;i<30;i++)assert.equal(await rpc('hanaz_rate_limit',{p_bucket:'test'}),true);assert.equal(await rpc('hanaz_rate_limit',{p_bucket:'test'}),false);});
 await t.test('cancelled COD retries never return a cached browser Purchase',async()=>{
  const k=randomUUID(),r=await submit('checkout',order(),k);await db.query("update orders set status='Cancelled' where order_number=$1",[r.order_number]);assert.equal((await submit('checkout',order(),k)).event,undefined);
 });
 await t.test('retry expiry, exhausted attempts, environment isolation and revoked leased jobs',async()=>{
  await db.exec("update hanaz_meta_outbox set status='dead' where status='sending'");
  const r=await submit('checkout',order());await db.exec("update hanaz_meta_outbox set delivery_mode='live' where status='pending'");
  const result=await worker.run({env,call:rpc,fetcher:async()=>{throw Error('MUST NOT SEND TEST JOB IN LIVE MODE')}});assert.equal(result.suppressed,1);
  await submit('checkout',order());await db.exec("update hanaz_meta_outbox set attempts=6 where status='pending'");assert.equal((await rpc('hanaz_claim_events',{})).length,0);
  await submit('checkout',order());await db.exec("update hanaz_meta_outbox set created_at=now()-interval '25 hours' where status='pending'");assert.equal((await rpc('hanaz_claim_events',{})).length,0);
  await submit('checkout',order());const jobs=await rpc('hanaz_claim_events',{});assert.equal(jobs.length,1);await submit('consent',{accepted:false});assert.equal(await rpc('hanaz_event_allowed',{p_id:jobs[0].id,p_lease:jobs[0].lease}),false);
 });
 await db.close();
});
test('HTTP origin, CSRF, signed session, method and body validation; public config contains no secrets',async()=>{
 const {handlerFactory}=require('../../hanaz-customer/api/commerce');let calls=0;
 const handler=handlerFactory({env,rpc:async(name)=>{calls++;return name==='hanaz_rate_limit'?true:{accepted:true};}});
 async function request(method,headers={},body){const out={headers:{},setHeader(k,v){this.headers[k]=v},end(v){this.body=JSON.parse(v)}};await handler({method,headers,body,socket:{}},out);return out;}
 const cfg=await request('GET');assert.equal(cfg.statusCode,200);assert.equal(cfg.body.enabled,false);assert.ok(!JSON.stringify(cfg.body).includes(env.META_ACCESS_TOKEN));
 const cookie=cfg.headers['Set-Cookie'].split(';')[0];const headers={cookie,origin:env.SITE_ORIGIN,'x-hanaz-csrf':cfg.body.csrf,'content-type':'application/json'};
 assert.equal((await request('POST',{...headers,origin:'https://attacker.invalid'},{action:'consent',data:{accepted:true}})).statusCode,403);
 assert.equal((await request('POST',{...headers,'x-hanaz-csrf':'bad'},{action:'consent',data:{accepted:true}})).statusCode,403);
 assert.equal((await request('POST',headers,{action:'Purchase',data:{value:1},key:randomUUID()})).statusCode,400);
 assert.equal((await request('POST',{...headers,'content-length':'20000'},{action:'consent',data:{accepted:true}})).statusCode,413);
 assert.equal((await request('DELETE',headers)).statusCode,405);assert.equal(calls,0);
 assert.equal((await request('POST',headers,{action:'consent',data:{accepted:true}})).statusCode,200);assert.equal(calls,2);
});
test('normalization, URL hygiene, config fail-closed and Meta transport',async()=>{
 assert.equal(core.phone('0300-1234567'),'923001234567');assert.equal(core.email(' TEST@EXAMPLE.INVALID '),'test@example.invalid');
 const user=core.matching({phone:'03001234567',email:' TEST@EXAMPLE.INVALID '},{fbp:'fb.1.1789300000000.123'});assert.equal(user.ph[0],core.hash('923001234567'));assert.equal(user.em[0],core.hash('test@example.invalid'));assert.equal(user.fbp,'fb.1.1789300000000.123');
 assert.equal(core.metaConfig({...env,META_MODE:'live',META_TEST_EVENT_CODE:''}).enabled,false);
 const context=core.context({headers:{'user-agent':'local'},socket:{}},{action:'checkout',context:{fbc:'invented'},url:'https://staging.example/?phone=secret'},env);assert.equal(context.event_source_url,'https://staging.example/checkout.html');assert.equal(context.user_data.fbc,undefined);
 const payload={event_name:'Purchase',event_id:randomUUID(),event_time:Math.floor(Date.now()/1000),action_source:'website',user_data:user};let sent;
 const r=await worker.deliver(payload,{env,fetcher:async(url,init)=>{sent={url,init};return new Response('{"events_received":1}',{status:200});}});
 assert.equal(r.outcome,'sent');assert.ok(sent.url.endsWith('/v26.0/568351333004084/events'));assert.ok(!sent.url.includes(env.META_ACCESS_TOKEN));assert.equal(JSON.parse(sent.init.body).test_event_code,'LOCAL_TEST');
 assert.equal((await worker.deliver(payload,{env,fetcher:async()=>{throw Error('offline')}})).outcome,'retry');
 assert.equal((await worker.deliver(payload,{env,fetcher:async()=>new Response('{"error":{"code":190}}',{status:400})})).outcome,'dead');
});

test('production inventory trigger is preserved and insufficient or hidden stock is rejected',async()=>{
 const {db,rpc}=await database(),session=randomUUID();
 const submit=()=>rpc('hanaz_submit',{p_session:session,p_action:'checkout',p_key:randomUUID(),p_data:order(),p_context:{...ctx,enabled:false}});
 await db.exec('update products set stock_quantity=1');await assert.rejects(submit());assert.equal((await db.query('select count(*)::int n from orders')).rows[0].n,0);
 await db.exec('update products set stock_quantity=10,is_active=false');await assert.rejects(submit());
 await db.exec('update products set is_active=true');await submit();
 assert.equal((await db.query('select stock_quantity from products where id=$1',[order().items[0].id])).rows[0].stock_quantity,8);
 await db.close();
});
