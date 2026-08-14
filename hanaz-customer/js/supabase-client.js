var SUPABASE_URL = 'https://xipbscxjsfzgkslckpjk.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_l4rLObIIdRuHilUY7qQI1g_MF0Bb_1-';

// Create the Supabase client and expose it globally.
// We use var (not const) so re-execution does not throw "already declared".
// We overwrite window.supabase (the CDN namespace) with the ready-to-use client
// so that all pages can simply call: supabase.from('...').select('*')
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabase = supabase;
