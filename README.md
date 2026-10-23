# PrintF v2 — Self-service Cloud Printing

PrintF lets customers upload documents, choose print settings, pay online or choose Cash on Delivery, and track printing without changing the existing customer interface design.

## Repository layout

- `src/` — existing React + TypeScript + Vite website and its UI components.
- `src/pages/admin/OrdersAdminPage.tsx` — responsive order-management page at `/admin/orders`.
- `supabase/functions/` — source for all 13 Edge Function names deployed in PrintF v2.
- `supabase/migrations/` — database and private file-storage policy migrations.
- `printf-agent/` — Windows print agent, configuration template, and service installer.

## Checkout features

- Customer name, mobile number, and email.
- Razorpay online payments.
- Cash on Delivery, including COD collection status.
- Secure email OTP flow.
- Order number, payment status, and print status.
- Administrator controls for order status and cash collection.

**UI/UX requirement:** the existing customer UI should remain consistent. Feature additions use the established component styling; do not redesign the website or add a college/location field.

## Local development

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env`.
3. Run `npm ci`.
4. Run `npm run dev`.
5. Run `npm run build` to validate a production bundle.

## PrintF v2 configuration and deployment

The browser client is configured for the Supabase project reference `unqongjwukgjbasvpyup`. The publishable key may be used in browser code; never put a service-role key or gateway secret in frontend source.

Live Supabase changes are **not deployed automatically on every Git push**. Use GitHub Actions after adding the required encrypted repository secrets under **Settings → Secrets and variables → Actions**:

**Deploy PrintF v2 Edge Functions** requires `SUPABASE_ACCESS_TOKEN`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` (a verified Resend sender). This workflow writes the server-side payment/email secrets to PrintF v2 and deploys all 13 function folders from the repository.

**Apply PrintF v2 Database Migration** requires `SUPABASE_DB_URL`, the PrintF v2 PostgreSQL connection string with SSL enabled. It applies `supabase/migrations/20261023000000_printf_v2_orders_storage_policies.sql` and records the migration version. Review that SQL file before manually dispatching the workflow.

The legacy `cashfree-create-order` and `cashfree-webhook` names return a deprecation response; active checkout is Razorpay + COD.

## Printer agent

Copy `printf-agent/config.example.json` to `printf-agent/config.json`. Set the station UUID and its matching station API key from the same `public.printfs` row. Run `printf-agent/install_service.bat` as Administrator to install/start the Windows service. Do not commit the real config file or runtime logs.

For PDF settings such as page ranges, 2-up/4-up layout, copies, colour and duplex, install SumatraPDF on the printer PC so the agent can use its silent-print interface. Without it, the fallback uses Windows shell printing and relies on printer-driver defaults for colour/duplex. For DOC/DOCX files, install LibreOffice so the agent can convert to PDF and use the same settings; otherwise it falls back to the Windows registered handler, where some settings depend on that handler and printer driver.

24/7 availability depends on continuous power, network, printer, and backend availability. The service installer configures automatic startup and restart recovery and disables no system settings by itself; disable Windows sleep manually. No software agent can guarantee uninterrupted printing if the PC, printer, power, or network is unavailable.

## Security notes

- Customer orders are read/update-restricted to authorized administrators in RLS.
- Document storage is private; public uploads are limited to UUID-named files under `jobs/` with supported extensions.
- Edge Functions use server-only credentials supplied by Supabase.
- Existing production database records are not included in this repository.
