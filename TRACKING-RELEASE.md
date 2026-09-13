# Hanaz Meta tracking release

The updated storefront is in `hanaz-customer/`, preserving the existing hosting root. See [the audit and deployment handoff](tracking-audit/HANAZ-HANDOFF.md) for the event map, COD/payment rules, required secrets, migration review and rollback.

This branch is not ready for production activation until the Supabase schema/admin workflow is reviewed, migrations are applied, server environment variables and a worker schedule are configured, and Meta Test Events/Diagnostics are verified. No production token is committed.

Run backend/build checks from `tracking-audit/` with `npm ci` and `npm test`. To run the isolated browser suite, set `PORT=4174`, run `npm run preview`, then run `npm run test:browser` in another terminal. The browser suite uses installed Windows Chrome and blocks all external requests.

Local verification before publication: 19 backend/build checks and 11 browser scenarios passed. The browser and application source are unchanged by repository packaging; test import paths were adjusted to the existing storefront directory.
