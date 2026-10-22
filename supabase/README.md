# PrintF v2 Supabase functions

This directory contains source for PrintF v2's Edge Functions and database migrations.

The project uses Razorpay for online payments and Cash on Delivery (COD); Cashfree is not an active payment method. Keep the checkout UI in the existing visual design.

Required Edge Functions:
- printer-agent
- printer-auth
- public-printfs
- create-job
- create-order
- verify-payment
- job-status
- secure-upload
- secure-job
- secure-otp
- secure-payment
- cashfree-create-order (legacy endpoint; returns 410 Gone)
- cashfree-webhook (legacy endpoint; returns 410 Gone)

Never commit service-role keys, Razorpay secrets, Resend keys, or station API keys. Configure server secrets in Supabase Edge Function secrets instead.
