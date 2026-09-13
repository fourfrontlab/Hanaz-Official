const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const catalog=require('./fixture.cjs');
const root=path.resolve(__dirname,'../../hanaz-customer');
const stub=`window.__records={};window.supabase={auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({})},from(table){let id;let inserted;const q={select(){return q},eq(k,v){if(k==='id')id=v;return q},order(){return q},limit(){return q},insert(data){inserted=data;return q},single(){return q},then(resolve){if(inserted){(window.__records[table]??=[]).push(inserted);resolve({error:null,data:null,status:201});}else resolve({error:null,data:id?${JSON.stringify(catalog)}.find(p=>p.id===id):${JSON.stringify(catalog)}})}};return q;},rpc:async()=>({data:[],error:null})};`;
const localDb=require('./database.cjs').database();
let failAction='';let failAfter=false;
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 res.setHeader('Content-Security-Policy',"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; media-src 'self';");
 // The preview has no route or proxy to any production service.
 if(url.pathname==='/__supabase.js'||url.pathname==='/js/supabase-client.js'){res.setHeader('Content-Type','text/javascript');return res.end(stub)}
 if(url.pathname==='/__test/state'&&localDb){const {db}=await localDb;const out={};for(const table of ['orders','order_items','contact_messages','hanaz_meta_outbox'])out[table]=(await db.query(`select * from ${table}`)).rows;res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(out));}
 if(url.pathname==='/__test/reset-rate'&&localDb){const {db}=await localDb;await db.exec('truncate hanaz_rate_limits');return res.end('ok');}
 if(url.pathname==='/__test/fail'){failAction=url.searchParams.get('action')||'';failAfter=url.searchParams.get('after')==='1';return res.end('ok');}
 if(url.pathname==='/api/commerce'&&localDb){
  const {rpc}=await localDb;let raw='';for await(const c of req)raw+=c;try{req.body=raw?JSON.parse(raw):undefined;}catch{res.statusCode=400;return res.end('{}');}
  const env={SITE_ORIGIN:'http://127.0.0.1:'+(process.env.PORT||4173),SESSION_SECRET:'local-test-session-secret-never-use-in-production',META_ENABLED:'true',META_MODE:'test',META_ACCESS_TOKEN:'LOCAL_TEST_ONLY',META_TEST_EVENT_CODE:'LOCAL_TEST',META_PIXEL_ID:'123456789012345'};
  const call=async(name,args)=>{if(name==='hanaz_submit'&&args.p_action===failAction){if(failAfter)await rpc(name,args);throw Error('synthetic failure');}return rpc(name,args);};
  return require('../../hanaz-customer/api/commerce').handlerFactory({env,rpc:call})(req,res);
 }
 if(url.pathname.startsWith('/api/')){res.statusCode=503;res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({error:'Local test API not configured'}))}
 let name=url.pathname==='/'?'/index.html':url.pathname;
 if(name==='/product-detail.html')name=url.searchParams.get('id')===catalog[1].id?'/pdp-face-wash.html':'/pdp-vitamin-c.html';
 const file=path.resolve(root,'.'+name);
 if(!file.startsWith(root+path.sep)){res.statusCode=403;return res.end()}
 try{let b=fs.readFileSync(file);const ext=path.extname(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.mp4':'video/mp4'})[ext]||'application/octet-stream');
 if(ext==='.html')b=b.toString().replace(/<script\b[^>]*src=["']https?:[^>]*>\s*<\/script>/gi,'').replace(/<!-- Meta Pixel Code -->[\s\S]*?<!-- End Meta Pixel Code -->/g,'');
 res.end(b);
 }catch{res.statusCode=404;res.end('Not found')}
});
server.listen(process.env.PORT||4173,'127.0.0.1',()=>console.log('Isolated preview on '+(process.env.PORT||4173)+'; production traffic blocked'));
