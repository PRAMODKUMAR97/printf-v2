# PrintF v2

PrintF v2 is a self-service cloud printing application. The repository is being prepared to preserve the current website UI/UX while integrating Razorpay and Cash on Delivery, secure print-job storage, the printer agent, and administrator order tracking.

## Security

Never commit `.env` files, Supabase service-role keys, Razorpay secrets, printer station API keys, or personal customer data. Configure secrets through the deployment environment.

## Current integration target

Supabase project reference: `unqongjwukgjbasvpyup` (PrintF v2).

## Feature requirements

- Keep the existing user-interface design and user experience unchanged.
- Collect customer name and mobile number only; do not add a college-location field.
- Support Razorpay and Cash on Delivery.
- Track order status, print status, payment status, and COD collection status.
- Keep printer agent recovery/retry support for long-running operation.

Implementation and deployment status should be verified before accepting production orders.
