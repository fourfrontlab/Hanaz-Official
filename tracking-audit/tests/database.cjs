const {PGlite}=require('@electric-sql/pglite');const fs=require('node:fs');const path=require('node:path');
async function database(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;create function auth.uid() returns uuid language sql as $$select null::uuid$$;
 create table products(id uuid primary key,title text,sale_price numeric,base_price numeric,cost_price numeric,in_stock boolean);
 create table orders(id uuid primary key,order_number text unique,customer_name text,phone text,address text,payment_method text check(payment_method in ('cod','bank_deposit','easypaisa','jazzcash')),payment_status text default 'unpaid',status text default 'pending',total_amount numeric);
 create table order_items(order_id uuid references orders(id),product_id uuid references products(id),title_snapshot text,qty int,price_at_order numeric,cost_at_order numeric);
 create table contact_messages(id uuid default gen_random_uuid(),full_name text,email text,subject text,message text);
 grant select,insert,update,delete on orders,order_items to anon,authenticated;
 `);
 for(const p of require('./fixture.cjs'))await db.query('insert into products values($1,$2,$3,$4,$5,$6)',[p.id,p.title,p.sale_price,p.base_price,p.cost_price,p.in_stock]);
 for(const file of ['001_commerce.sql','002_protect_order_writes.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'../database',file),'utf8'));
 const rpc=async(name,args)=>{
  const entries=Object.entries(args);const argsSql=entries.map(([name],i)=>`${name} => $${i+1}`).join(',');
  const sql=name==='hanaz_claim_events'?`select to_jsonb(x) as value from public.${name}(${argsSql}) x`:`select public.${name}(${argsSql}) as value`;
  const q=await db.query(sql,entries.map(([,v])=>typeof v==='object'&&v!==null?JSON.stringify(v):v));
  return name==='hanaz_claim_events'?q.rows.map(r=>r.value):q.rows[0].value;
 };
 return {db,rpc};
}
module.exports={database};
