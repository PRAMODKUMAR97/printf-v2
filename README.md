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

## PrintF v2 configuration

The browser client is configured for the Supabase project reference `unqongjwukgjbasvpyup`. The publishable key may be used in browser code; the service-role key and gateway secrets must never be included in frontend source or committed files.

Set these secrets in Supabase Edge Function Secrets:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (optional, if the default sender is configured/verified)

The legacy `cashfree-create-order` and `cashfree-webhook` names return a deprecation response; active checkout is Razorpay + COD.

## Printer agent

Copy `printf-agent/config.example.json` to `printf-agent/config.json`. Set the station UUID and its matching station API key from the same `public.printfs` row. Run `printf-agent/install_service.bat` as Administrator to install/start the Windows service. Do not commit the real config file or runtime logs.

24/7 availability depends on continuous power, network, printer, and backend availability. A Windows service improves auto-start/recovery but cannot guarantee uninterrupted operation on its own.

## Security notes

- Customer orders are read/update-restricted to authorized administrators in RLS.
- Document storage is private; public uploads are limited to UUID-named files under `jobs/` with supported extensions.
- Edge Functions use server-only credentials supplied by Supabase.
- Existing production database records are not included in this repository.
