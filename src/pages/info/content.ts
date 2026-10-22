import { company as c } from './companyInfo';

export type Section =
  | { heading: string; body: string[] }
  | { heading: string; items: { q: string; a: string[] }[] };

export type PageContent = {
  eyebrow: string;
  title: string;
  intro: string;
  note?: string;
  sections: Section[];
};

export const aboutContent: PageContent = {
  eyebrow: 'About',
  title: 'Printing, without the counter queue.',
  intro: c.productName + ' turns a nearby print station into a self-service kiosk you can control from your phone — choose a station, upload a file, select settings, pay, and collect.',
  sections: [
    { heading: 'How it works', body: ['Choose an online PrintF station, upload your document, confirm print settings, select a payment method, and follow the status shown on screen.'] },
    { heading: 'Designed for privacy', body: ['Print jobs are linked to a station and are intended to be released only through the supported PrintF workflow. Collect your documents promptly after printing.'] },
    { heading: 'Contact', body: ['For product questions or business enquiries, contact ' + c.supportEmail + '.'] },
  ],
};

export const contactContent: PageContent = {
  eyebrow: 'Contact',
  title: 'Talk to the PrintF team.',
  intro: 'Contact us if you have a question about your print order, station availability, payments, or a business partnership.',
  sections: [
    { heading: 'Customer support', body: ['Email: ' + c.supportEmail, 'Phone: ' + c.phone, 'Support hours: ' + c.supportHours] },
    { heading: 'Business enquiries', body: ['Email: ' + c.businessEmail, 'Website: ' + c.website] },
  ],
};

export const supportContent: PageContent = {
  eyebrow: 'Support',
  title: 'Let’s get your print moving.',
  intro: 'If something does not look right, keep your order number handy and contact the support team.',
  sections: [
    { heading: 'Before contacting support', body: ['Note the selected station, document name, order number, payment method, and the status displayed on the website. Do not email passwords, API keys, or full payment credentials.'] },
    { heading: 'Contact options', body: ['Email ' + c.supportEmail + ' or call ' + c.phone + ' during ' + c.supportHours + '.'] },
  ],
};

export const faqsContent: PageContent = {
  eyebrow: 'FAQs',
  title: 'Good questions, clear answers.',
  intro: 'The essentials for a smooth PrintF session.',
  sections: [
    { heading: 'Using PrintF', items: [
      { q: 'What files can I print?', a: ['The current upload interface supports PDF, Word, PNG, and JPEG images, subject to the website’s file-size limit.'] },
      { q: 'Do I need to create an account?', a: ['The self-service printing flow is designed to let customers start without creating a general website account.'] },
      { q: 'What happens if a station goes offline?', a: ['The website reports station availability based on its last heartbeat. If the station is offline, select an available station or contact support.'] },
    ] },
    { heading: 'Payments and orders', items: [
      { q: 'Which payment methods are supported?', a: ['The checkout offers online payment through Razorpay and Cash on Delivery when that option is available.'] },
      { q: 'When do I pay for a COD order?', a: ['Pay cash when collecting the printed document. COD collection must be recorded in the order status by the station or administrator.'] },
      { q: 'My payment appears successful but the job is not moving. What should I do?', a: ['Keep the order number and contact ' + c.supportEmail + '. Avoid paying a second time before support checks the order.'] },
    ] },
  ],
};

export const privacyContent: PageContent = {
  eyebrow: 'Privacy',
  title: 'Your document is your business.',
  intro: 'PrintF processes contact and job information to create and fulfil a print order.',
  note: 'Last updated: ' + c.lastUpdated + '. This page is a general privacy summary, not legal advice.',
  sections: [
    { heading: 'Information collected', body: ['Checkout may collect customer name and mobile number for order handling, along with information needed to process payment and printing. A college or campus-location field is not part of the checkout requirement.'] },
    { heading: 'Purpose of processing', body: ['Order details are used to associate the customer with a print job, display the order to authorized operators, track payment and printing status, and support order enquiries. Payment processing is handled through the selected gateway.'] },
    { heading: 'Access and retention', body: ['Access to order information should be restricted to authorized administrators and backend functions. Print files and customer details should not be made publicly readable. Retention should follow the service’s published policy and applicable law.'] },
    { heading: 'Questions', body: ['For privacy questions, contact ' + c.supportEmail + '.'] },
  ],
};

export const termsContent: PageContent = {
  eyebrow: 'Terms',
  title: 'A few things before you print.',
  intro: 'By using PrintF, you agree to provide accurate order information and use the service lawfully.',
  note: 'Last updated: ' + c.lastUpdated + '. Have the final terms reviewed for your business and local legal requirements before relying on them as a legal contract.',
  sections: [
    { heading: 'Customer responsibilities', body: ['Upload only documents you are authorized to print. Check the selected station and print settings before submitting an order. Collect printed pages promptly and protect any order number or verification code.'] },
    { heading: 'Pricing and payment', body: ['The checkout displays the calculated charge before you confirm. Online payments must be verified by the payment backend. If you select Cash on Delivery, pay the displayed amount at collection.'] },
    { heading: 'Availability', body: ['Station availability depends on the printer, connected computer, power, network, and backend service. Temporary interruption may delay an order. Contact support with the order number if a job appears stuck.'] },
    { heading: 'Contact', body: ['For questions about these terms, email ' + c.supportEmail + '.'] },
  ],
};

export const refundsContent: PageContent = {
  eyebrow: 'Refunds',
  title: 'Payment issues should be traceable.',
  intro: 'If a payment was made but the print job did not complete, contact support before submitting another payment.',
  note: 'Last updated: ' + c.lastUpdated + '. The exact refund and cancellation policy should be finalized by the business before launch.',
  sections: [
    { heading: 'Request help', body: ['Email ' + c.supportEmail + ' with the order number, payment reference if available, date, and a short description of what happened. Do not send card PINs, passwords, or gateway secrets.'] },
    { heading: 'Review', body: ['Support should review the order, payment record, and print-job status before deciding on a retry, cancellation, or refund. Refund timing depends on the payment provider and bank.'] },
    { heading: 'Cash on Delivery', body: ['COD orders that have not been collected should be reviewed through the order status. When cash is received, an authorized operator should record collection so the order ledger stays accurate.'] },
  ],
};
