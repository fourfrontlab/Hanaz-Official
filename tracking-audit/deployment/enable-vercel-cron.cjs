// Optional: run after confirming your Vercel plan supports a once-per-minute cron.
// An existing external scheduler can instead GET /api/meta-worker with the secret header.
const fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'../../hanaz-customer/vercel.json');
const config=JSON.parse(fs.readFileSync(file,'utf8'));
config.crons=(config.crons||[]).filter(c=>c.path!=='/api/meta-worker');
config.crons.push({path:'/api/meta-worker',schedule:'* * * * *'});
fs.writeFileSync(file,JSON.stringify(config,null,2)+'\n');
console.log('Added one-minute worker schedule. Configure CRON_SECRET in hosting secrets before deploying.');
