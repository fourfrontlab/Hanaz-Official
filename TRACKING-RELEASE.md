# Hanaz Meta tracking release

## Production deployment investigation — 2026-09-14

The merged release failed because Vercel had no environment variables. Production public Supabase settings and the verified canonical `SITE_ORIGIN` have now been configured; `META_ENABLED=false` remains explicit. The server key and session secret are still required.

Read-only production schema inspection confirmed no tracking migrations are installed, capitalized order statuses (`Pending`, `Cancelled`, etc.), lowercase accepted payment-method identifiers, and an existing stock-deduction trigger. The migration now inserts `Pending`, locks product rows before checkout, and rejects inactive or insufficient-stock products while retaining the existing deduction trigger. Regression fixtures enforce the actual status/payment constraints and stock behavior.

`npm run build` now checks server configuration and uses read-only Supabase API schema discovery to verify required backend functions before building the public client. It stops an incomplete checkout backend from replacing the prior successful deployment. It does not execute migrations or create test orders. This readiness check is not full end-to-end checkout or Meta validation.

Production SQL validation was cancelled at the owner's request; no production migration was executed. The current release therefore remains blocked from activation. Complete a separately authorized database rollout and verified admin allowlist, then configure server secrets and redeploy. Never bypass this check merely to obtain a green deployment.

Local verification after these changes: 22 backend/build checks passed. No production purchases, charges, or Meta events were generated. Existing browser verification results below predate this deployment repair; storefront markup and shopping JavaScript were not changed in this repair.

Rollback for this repair: revert its Git commit if needed; the failed deployment does not replace the prior successful Vercel deployment. No database rollback is required because no migration was executed. The added public environment configuration applies only to new deployments.

The updated storefront is in `hanaz-customer/`, preserving the existing hosting root. See [the audit and deployment handoff](tracking-audit/HANAZ-HANDOFF.md) for the event map, COD/payment rules, required secrets, migration review and rollback.

This branch is not ready for production activation until the Supabase schema/admin workflow is reviewed, migrations are applied, server environment variables and a worker schedule are configured, and Meta Test Events/Diagnostics are verified. No production token is committed.

Run backend/build checks from `tracking-audit/` with `npm ci` and `npm test`. To run the isolated browser suite, set `PORT=4174`, run `npm run preview`, then run `npm run test:browser` in another terminal. The browser suite uses installed Windows Chrome and blocks all external requests.

Local verification before publication: 19 backend/build checks and 11 browser scenarios passed. The browser and application source are unchanged by repository packaging; test import paths were adjusted to the existing storefront directory.
