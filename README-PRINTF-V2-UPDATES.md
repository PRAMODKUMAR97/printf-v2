# PrintF v2 — Developer Notes

## Non-negotiable UI requirement
The existing PrintF customer UI and UX should be preserved. Checkout additions follow existing spacing, colors, input styles and cards; do not redesign existing screens. No college/location field is collected.

## Implemented repository features
- Customer name, mobile number and email at checkout.
- Razorpay and Cash on Delivery (COD) choices.
- Server-side Razorpay verification and secure email OTP endpoints.
- Responsive admin order view at `/admin/orders`, authenticated through Supabase Auth and the admin role.
- Order/payment/print status and COD collection tracking.
- Printer-agent Windows service installer and non-secret config template.
- Source code for the 13 Edge Function names currently deployed in PrintF v2.

## Local development
1. Use Node.js 20+.
2. Copy `.env.example` to `.env` and verify the Supabase v2 URL/publishable key.
3. Run `npm install` then `npm run dev`.
4. Run `npm run build` before deployment.

## GitHub-managed Supabase deployment

Deployment is intentionally **manual**, not triggered by every push to `main`. Open **Actions** in this repo after adding repository secrets at **Settings → Secrets and variables → Actions**.

For `.github/workflows/deploy-supabase-functions.yml`, add:
- `SUPABASE_ACCESS_TOKEN`: a Supabase access token with permissions to manage the PrintF v2 project.
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`: a sender address verified in Resend.

Then run **Deploy PrintF v2 Edge Functions** from Actions. It updates the server-side secrets for project `unqongjwukgjbasvpyup` and deploys the 13 function folders in this repo.

For `.github/workflows/apply-supabase-migration.yml`, add:
- `SUPABASE_DB_URL`: the PrintF v2 PostgreSQL connection string with SSL enabled. Store it as a GitHub secret, never in a committed file.

Then run **Apply PrintF v2 Database Migration** from Actions. It runs only `supabase/migrations/20261022_printf_v2_orders_storage_policies.sql`. Review this migration before dispatching it.

Supabase injects `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` into Edge Functions at runtime. Never expose the service-role key in browser code or commit any of these secrets.

## Printer station configuration
Copy `printf-agent/config.example.json` to `printf-agent/config.json` and fill in the station UUID and matching station API key from the same row in `public.printfs`. Do not commit the real config or logs. 24/7 operation also requires power, network, computer and printer availability; service auto-start alone cannot guarantee uninterrupted service.
