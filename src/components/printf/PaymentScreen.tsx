import { useState } from 'react';
import { PrintJob } from '@/types/printf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Lock, Shield, Banknote, CreditCard } from 'lucide-react';
import { ProgressHairline } from '@/components/printf/loading/Skeletons';
import { usePayment } from '@/hooks/usePayment';
import { PaymentTrustBadges } from './payment/PaymentTrustBadges';
import { PaymentOrderSummary } from './payment/PaymentOrderSummary';
import { PaymentPriceBreakdown } from './payment/PaymentPriceBreakdown';
import { PaymentConfidenceSection } from './payment/PaymentConfidenceSection';
import { PaymentSupportSection } from './payment/PaymentSupportSection';

type CheckoutPaymentMethod = 'razorpay' | 'cod';

interface PaymentScreenProps {
  job: PrintJob;
  amount: number;
  printerName?: string;
  printerLocation?: string;
  onBack: () => void;
  onSuccess: () => void;
}

export function PaymentScreen({ job, amount, printerName, printerLocation, onBack, onSuccess }: PaymentScreenProps) {
  const { initiatePayment, isProcessing } = usePayment();
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('razorpay');
  const [validationError, setValidationError] = useState<string | null>(null);
  const settings = job.settings_json;
  const pageCount = settings.page_count || 1;

  const triggerPayment = () => {
    const normalizedName = customerName.trim();
    const digits = customerMobile.replace(/\D/g, '');
    if (normalizedName.length < 2 || normalizedName.length > 100) {
      setValidationError('Enter your name (2–100 characters).');
      return;
    }
    if (digits.length < 10 || digits.length > 15) {
      setValidationError('Enter a valid mobile number with 10–15 digits.');
      return;
    }
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(customerEmail.trim())) {
      setValidationError('Enter a valid email address for your print OTP.');
      return;
    }
    setValidationError(null);
    initiatePayment({
      jobId: job.id,
      amount,
      customerName: normalizedName,
      customerMobile: customerMobile.trim(),
      customerEmail: customerEmail.trim().toLowerCase(),
      paymentMethod,
      onSuccess,
      onFailure: () => {},
      onCancel: onBack,
    });
  };

  const formatAmount = (amt: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(amt);

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 pb-10 animate-rise">
      <div className="flex items-start gap-4">
        <Button variant="outline" size="icon" className="mt-1 flex-shrink-0 rounded-full" onClick={onBack} disabled={isProcessing} aria-label="Go back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <p className="eyebrow">Step three</p>
          <h2 className="mt-2 font-display text-3xl leading-none text-foreground">Checkout</h2>
          <p className="mt-2 text-sm text-muted-foreground">Review your order, then choose how to pay.</p>
        </div>
      </div>

      <PaymentTrustBadges />

      {isProcessing && (
        <div className="panel-raised overflow-hidden px-0 py-0" aria-busy="true" aria-live="polite">
          <ProgressHairline />
          <div className="px-7 py-8 text-center">
            <h3 className="font-display text-2xl text-foreground">{paymentMethod === 'cod' ? 'Placing your order' : 'Opening secure payment'}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{paymentMethod === 'cod' ? 'Saving your order and sending it to the station.' : 'Complete your payment in the popup window.'}</p>
            <p className="stat-number mt-5 text-3xl text-foreground">{formatAmount(amount)}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <PaymentOrderSummary job={job} printerName={printerName} printerLocation={printerLocation} />
        <PaymentPriceBreakdown pageCount={settings.selected_pages || pageCount} isColor={settings.color} copies={settings.copies || 1} totalAmount={amount} layout={settings.layout || 1} sheets={settings.sheets} />
        <PaymentConfidenceSection />
      </div>

      <section className="panel-raised space-y-4 p-5 sm:p-6" aria-labelledby="customer-details-heading">
        <div>
          <h3 id="customer-details-heading" className="font-display text-xl text-foreground">Customer details</h3>
          <p className="mt-1 text-sm text-muted-foreground">Used for your order record and collection.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="customer-name">Full name</Label>
          <Input id="customer-name" name="customer_name" autoComplete="name" placeholder="Enter your name" maxLength={100}
            value={customerName} onChange={(event) => { setCustomerName(event.target.value); setValidationError(null); }}
            disabled={isProcessing} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="customer-mobile">Mobile number</Label>
          <Input id="customer-mobile" name="customer_mobile" type="tel" inputMode="tel" autoComplete="tel"
            placeholder="Enter your mobile number" maxLength={20} value={customerMobile}
            onChange={(event) => { setCustomerMobile(event.target.value); setValidationError(null); }}
            disabled={isProcessing} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="customer-email">Email address</Label>
          <Input id="customer-email" name="customer_email" type="email" inputMode="email" autoComplete="email"
            placeholder="Enter your email address" maxLength={254} value={customerEmail}
            onChange={(event) => { setCustomerEmail(event.target.value); setValidationError(null); }}
            disabled={isProcessing} required />
          <p className="text-xs text-muted-foreground">We’ll send your one-time print verification code here.</p>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="payment-method-heading">
        <div className="flex items-center justify-between">
          <h3 id="payment-method-heading" className="text-sm font-semibold text-foreground">Payment method</h3>
          <span className="text-xs text-muted-foreground">Choose one</span>
        </div>
        <button type="button" onClick={() => setPaymentMethod('razorpay')} disabled={isProcessing}
          aria-pressed={paymentMethod === 'razorpay'}
          className={paymentMethod === 'razorpay' ? 'flex w-full items-center gap-3 rounded-xl border-2 border-success bg-success/5 p-4 text-left transition-colors' : 'flex w-full items-center gap-3 rounded-xl border-2 border-border bg-card p-4 text-left transition-colors hover:border-muted-foreground/30'}>
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted"><CreditCard className="h-5 w-5 text-foreground" /></span>
          <span className="flex-1">
            <span className="block font-medium text-foreground">Pay online with Razorpay</span>
            <span className="mt-1 block text-xs text-muted-foreground">UPI, cards and net banking</span>
          </span>
          <span className={paymentMethod === 'razorpay' ? 'h-4 w-4 rounded-full border-2 border-success bg-success ring-2 ring-success/20' : 'h-4 w-4 rounded-full border-2 border-muted-foreground/50'} />
        </button>
        <button type="button" onClick={() => setPaymentMethod('cod')} disabled={isProcessing}
          aria-pressed={paymentMethod === 'cod'}
          className={paymentMethod === 'cod' ? 'flex w-full items-center gap-3 rounded-xl border-2 border-success bg-success/5 p-4 text-left transition-colors' : 'flex w-full items-center gap-3 rounded-xl border-2 border-border bg-card p-4 text-left transition-colors hover:border-muted-foreground/30'}>
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted"><Banknote className="h-5 w-5 text-foreground" /></span>
          <span className="flex-1">
            <span className="block font-medium text-foreground">Cash on Delivery</span>
            <span className="mt-1 block text-xs text-muted-foreground">Pay cash when collecting your print</span>
          </span>
          <span className={paymentMethod === 'cod' ? 'h-4 w-4 rounded-full border-2 border-success bg-success ring-2 ring-success/20' : 'h-4 w-4 rounded-full border-2 border-muted-foreground/50'} />
        </button>
        {paymentMethod === 'cod' && (
          <p className="rounded-lg bg-muted/60 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            Your order will be queued after placement. The station must mark the cash as received before the order is considered paid.
          </p>
        )}
      </section>

      {validationError && <p role="alert" className="text-sm text-destructive">{validationError}</p>}

      <div className="space-y-4">
        <Button variant="secondary" className="h-14 w-full rounded-xl text-base" onClick={triggerPayment} disabled={isProcessing}>
          {isProcessing ? (
            <span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />Processing</span>
          ) : paymentMethod === 'cod' ? (
            <span className="flex items-center gap-2"><Banknote className="h-4 w-4" />Place COD order · {formatAmount(amount)}</span>
          ) : (
            <span className="flex items-center gap-2"><Lock className="h-4 w-4" />Pay {formatAmount(amount)}</span>
          )}
        </Button>
        <div className="flex items-center justify-center gap-5 text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground">
          <span>Encrypted</span><span className="h-1 w-1 rounded-full bg-border" />
          <span>No card stored</span><span className="h-1 w-1 rounded-full bg-border" />
          <span>{paymentMethod === 'cod' ? 'Cash at collection' : 'Instant receipt'}</span>
        </div>
        <Button variant="ghost" className="w-full" onClick={onBack} disabled={isProcessing}>Cancel and go back</Button>
      </div>

      <PaymentSupportSection />
      {paymentMethod === 'razorpay' ? (
        <div className="flex items-center justify-center gap-2 pt-1"><Shield className="h-3.5 w-3.5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Secured by <span className="font-medium text-foreground">Razorpay</span></p></div>
      ) : (
        <div className="flex items-center justify-center gap-2 pt-1"><Shield className="h-3.5 w-3.5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Cash collection is recorded in your order status.</p></div>
      )}
    </div>
  );
}
