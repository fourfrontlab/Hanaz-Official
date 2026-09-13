// Build-time configuration. Only the public Supabase key is written to a browser file.
const fs = require('node:fs');
const path = require('node:path');
// Keep the existing production public configuration when no override is supplied.
// Previews must explicitly select their own project to avoid production test writes.
const useBundled = process.env.VERCEL_ENV === 'production' &&
  process.env.SUPABASE_URL === undefined && process.env.SUPABASE_PUBLISHABLE_KEY === undefined;
const bundled = useBundled ? fs.readFileSync(path.join(__dirname, '../js/supabase-client.js'), 'utf8') : '';
const url = useBundled ? bundled.match(/var SUPABASE_URL = ['"]([^'"]+)['"]/ )?.[1] : process.env.SUPABASE_URL;
const key = useBundled ? bundled.match(/var SUPABASE_ANON_KEY = ['"]([^'"]+)['"]/ )?.[1] : process.env.SUPABASE_PUBLISHABLE_KEY;
let publicKey = typeof key === 'string' && key.startsWith('sb_publishable_');
if (key && !publicKey) {
  try { publicKey = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; } catch {}
}
let validUrl = false;
try { const parsed = new URL(url); validUrl = parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.search && !parsed.hash; } catch {}
if (!validUrl || !publicKey) {
  throw new Error('Set SUPABASE_URL and a public SUPABASE_PUBLISHABLE_KEY for this deployment. Secret/service keys are rejected.');
}
fs.writeFileSync(path.join(__dirname, '../js/supabase-client.js'),
  `var SUPABASE_URL = ${JSON.stringify(url)};\nvar SUPABASE_ANON_KEY = ${JSON.stringify(key)};\nvar supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);\nwindow.supabase = supabase;\n`);
console.log(useBundled ? 'Using the existing Hanaz production public Supabase configuration.' : 'Public Supabase client configured for this deployment.');
