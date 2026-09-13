// Read-only deployment preflight. Never creates orders or changes the database.
async function checkCommerce(env = process.env, request = fetch) {
  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SITE_ORIGIN', 'SESSION_SECRET']
    .filter(name => !env[name]?.trim());
  if (missing.length) throw new Error('Checkout backend is not configured. Set server environment variables: ' + missing.join(', ') + '. The existing deployment must remain live.');
  let origin, database;
  try { origin = new URL(env.SITE_ORIGIN); database = new URL(env.SUPABASE_URL); } catch { throw new Error('Invalid checkout origin or Supabase URL.'); }
  if (origin.protocol !== 'https:' || origin.origin !== env.SITE_ORIGIN || database.protocol !== 'https:' || database.origin !== env.SUPABASE_URL)
    throw new Error('SITE_ORIGIN and SUPABASE_URL must be HTTPS origins without paths or credentials.');
  if (env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  let serverKey = key.startsWith('sb_secret_');
  try { serverKey ||= JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'service_role'; } catch {}
  if (!serverKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY must be a server-only Supabase key.');
  let response, schema;
  try {
    response = await request(database.origin + '/rest/v1/', {
      headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/openapi+json' },
      signal: AbortSignal.timeout(15000), redirect: 'error'
    });
    if (!response.ok) throw new Error('schema');
    schema = await response.json();
  } catch { throw new Error('Cannot verify checkout database readiness. Check the server key, project URL and Supabase availability. No database changes were made.'); }
  const required = ['hanaz_submit', 'hanaz_rate_limit', 'hanaz_claim_events', 'hanaz_event_allowed', 'hanaz_finish_event', 'hanaz_is_commerce_admin'];
  if (required.some(name => !schema.paths?.['/rpc/' + name]))
    throw new Error('Checkout database migrations are missing. Review tracking-audit/database and preserve verified admin access before production activation.');
  console.log('Checkout backend configuration and required database functions verified (read-only).');
}
module.exports = { checkCommerce };
if (require.main === module) checkCommerce().catch(error => { console.error(error.message); process.exitCode = 1; });
