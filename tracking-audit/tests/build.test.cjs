const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const {checkCommerce}=require('../../hanaz-customer/scripts/check-commerce.cjs');
test('deployment blocks missing backend, missing migrations and network failures without mutations',async()=>{
 const env={SUPABASE_URL:'https://database.example',SITE_ORIGIN:'https://store.example',SESSION_SECRET:'x'.repeat(48),SUPABASE_SERVICE_ROLE_KEY:'sb_secret_INVALID_LOCAL_FIXTURE'};
 let calls=0;
 const ready=async(url,options)=>{calls++;assert.equal(url,'https://database.example/rest/v1/');assert.equal(options.method,undefined);assert.equal(options.redirect,'error');return {ok:true,json:async()=>({paths:Object.fromEntries(['hanaz_submit','hanaz_rate_limit','hanaz_claim_events','hanaz_event_allowed','hanaz_finish_event','hanaz_is_commerce_admin'].map(n=>['/rpc/'+n,{}]))})};};
 await assert.rejects(checkCommerce({},ready),/not configured/);assert.equal(calls,0);
 await assert.rejects(checkCommerce({...env,SESSION_SECRET:'short'},ready),/32 characters/);
 await assert.rejects(checkCommerce({...env,SUPABASE_SERVICE_ROLE_KEY:'sb_publishable_TEST'},ready),/server-only/);
 await assert.rejects(checkCommerce(env,async()=>({ok:true,json:async()=>({paths:{}})})),/migrations are missing/);
 await assert.rejects(checkCommerce(env,async()=>{throw new Error('Do not expose credentials or upstream details');}),e=>!e.message.includes('credentials or upstream')&&e.message.includes('Cannot verify'));
 await checkCommerce(env,ready);assert.equal(calls,1);
});
test('deployment public configuration never accepts or exports server secrets',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'hanaz-build-test-'));
 fs.mkdirSync(path.join(root,'scripts'));fs.mkdirSync(path.join(root,'js'));
 const script=path.join(root,'scripts/configure-public.cjs');fs.copyFileSync(path.join(__dirname,'../../hanaz-customer/scripts/configure-public.cjs'),script);
 const run=key=>spawnSync(process.execPath,[script],{encoding:'utf8',env:{...process.env,SUPABASE_URL:'https://staging.example',SUPABASE_PUBLISHABLE_KEY:key,META_ACCESS_TOKEN:'DUMMY_SERVER_TOKEN_MUST_NOT_APPEAR'}});
 await t.test('missing public key fails the build',()=>{assert.notEqual(run('').status,0);assert.equal(fs.existsSync(path.join(root,'js/supabase-client.js')),false);});
 await t.test('service-role and secret keys are rejected',()=>{
  assert.notEqual(run('sb_secret_DUMMY_NOT_A_REAL_SECRET').status,0);
  const jwt='e30.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.dummy';assert.notEqual(run(jwt).status,0);
 });
 await t.test('only the explicit public URL/key reach the browser file',()=>{
  assert.equal(run('sb_publishable_LOCAL_TEST').status,0);const source=fs.readFileSync(path.join(root,'js/supabase-client.js'),'utf8');assert.ok(source.includes('https://staging.example'));assert.ok(source.includes('sb_publishable_LOCAL_TEST'));assert.ok(!source.includes('DUMMY_SERVER_TOKEN'));assert.ok(!source.includes('SERVICE_ROLE'));
 });
});
test('production can retain the existing public client without weakening preview or secret validation',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'hanaz-build-production-'));
 fs.mkdirSync(path.join(root,'scripts'));fs.mkdirSync(path.join(root,'js'));
 const script=path.join(root,'scripts/configure-public.cjs'),client=path.join(root,'js/supabase-client.js');
 fs.copyFileSync(path.join(__dirname,'../../hanaz-customer/scripts/configure-public.cjs'),script);
 const original="var SUPABASE_URL = 'https://existing.example';\nvar SUPABASE_ANON_KEY = 'sb_publishable_EXISTING_PUBLIC';\n";
 const run=overrides=>{fs.writeFileSync(client,original);const env={...process.env};delete env.SUPABASE_URL;delete env.SUPABASE_PUBLISHABLE_KEY;return spawnSync(process.execPath,[script],{encoding:'utf8',env:{...env,VERCEL_ENV:'production',...overrides}});};
 assert.equal(run({}).status,0);
 assert.match(fs.readFileSync(client,'utf8'),/existing\.example/);
 assert.notEqual(run({VERCEL_ENV:'preview'}).status,0);
 assert.notEqual(run({SUPABASE_URL:'https://other.example'}).status,0);
 assert.notEqual(run({SUPABASE_PUBLISHABLE_KEY:'sb_secret_INVALID_TEST'}).status,0);
 assert.notEqual(run({SUPABASE_URL:'not-a-url',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_TEST'}).status,0);
 assert.equal(run({SUPABASE_URL:'https://staging.example',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_TEST',VERCEL_ENV:'preview'}).status,0);
 assert.match(fs.readFileSync(client,'utf8'),/staging\.example/);
});
