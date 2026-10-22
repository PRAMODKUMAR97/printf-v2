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

## Server-side secrets
Set these in the PrintF v2 Supabase Edge Function secrets page; never commit them:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (optional if the configured sender default is valid)

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions at runtime. Never expose a service-role key in browser code.

## Printer station configuration
Copy `printf-agent/config.example.json` to `printf-agent/config.json` and fill in the station UUID and matching station API key from the same row in `public.printfs`. Do not commit the real config or logs. 24/7 operation also requires power, network, computer and printer availability; service auto-start alone cannot guarantee uninterrupted service.
