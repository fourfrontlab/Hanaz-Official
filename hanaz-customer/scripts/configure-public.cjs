// Build-time configuration. Only the public Supabase key is written to a browser file.
const fs = require('node:fs');
const path = require('node:path');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
let publicKey = typeof key === 'string' && key.startsWith('sb_publishable_');
if (key && !publicKey) {
  try { publicKey = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; } catch {}
}
if (!url || new URL(url).protocol !== 'https:' || !publicKey) {
  throw new Error('Set SUPABASE_URL and a public SUPABASE_PUBLISHABLE_KEY for this deployment. Secret/service keys are rejected.');
}
fs.writeFileSync(path.join(__dirname, '../js/supabase-client.js'),
  `var SUPABASE_URL = ${JSON.stringify(url)};\nvar SUPABASE_ANON_KEY = ${JSON.stringify(key)};\nvar supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);\nwindow.supabase = supabase;\n`);
console.log('Public Supabase client configured for this deployment.');
