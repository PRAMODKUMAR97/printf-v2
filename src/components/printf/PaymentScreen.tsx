import { PrintJob } from '@/types/printf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Lock, Shield, Banknote, CreditCard } from 'lucide-react';
import { usePayment } from '@/hooks/usePayment';
import { PaymentTrustBadges } from './payment/PaymentTrustBadges';
import { PaymentOrderSummary } from './payment/PaymentOrderSummary';
import { PaymentPriceBreakdown } from './payment/PaymentPriceBreakdown';
import { PaymentUserInfo } from './payment/PaymentUserInfo';
import { PaymentConfidenceSection } from './payment/PaymentConfidenceSection';
import { PaymentSupportSection } from './payment/PaymentSupportSection';
import { Separator } from '@/components/ui/separator';

type CheckoutPaymentMethod = 'razorpay' | 'cod';

interface PaymentScreenProps {
  job: PrintJob;
  amount: number;
  email: string;
  phone?: string;
  customerName: string;
  onCustomerNameChange: (value: string) => void;
  onCustomerMobileChange: (value: string) => void;
  printerName?: string;
  printerLocation?: string;
  onBack: () => void;
  onSuccess: (otpCode?: string, details?: { payment_method?: 'razorpay' | 'cod'; order_number?: number | null; amount?: number; expires_in_seconds?: number }) => void;
}

export function PaymentScreen({
  job, amount, email, phone, customerName, onCustomerNameChange, onCustomerMobileChange,
  printerName, printerLocation, onBack, onSuccess,
}: PaymentScreenProps) {
  const { initiatePayment, isProcessing } = usePayment();
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('razorpay');
  const [validationError, setValidationError] = useState('');

  const settings = job.settings_json;
  const pageCount = settings.page_count || 1;

  const triggerPayment = () => {
    const normalizedName = customerName.trim();
    const digits = (phone || '').replace(/\D/g, '');
    if (normalizedName.length < 2 || normalizedName.length > 100) {
      setValidationError('Enter your name (2–100 characters).');
      return;
    }
    if (digits.length < 10 || digits.length > 15) {
      setValidationError('Enter a valid mobile number with 10–15 digits.');
      return;
    }
    setValidationError('');
    initiatePayment({
      jobId: job.id,
      amount,
      email,
      phone,
      customerName: normalizedName,
      customerMobile: (phone || '').trim(),
      paymentMethod,
      onSuccess,
      onFailure: () => {},
      onCancel: onBack,
    });
  };

  const formatAmount = (amt: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 0,
  }).format(amt);

  return (
    <div className="w-full max-w-lg mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={onBack} disabled={isProcessing} aria-label="Go back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-foreground font-display">Secure Checkout</h2>
          <p className="text-sm text-muted-foreground">Complete your print order</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 rounded-full">
          <Lock className="w-3.5 h-3.5 text-success" />
          <span className="text-xs font-medium text-success">Secure</span>
        </div>
      </div>

      <PaymentTrustBadges />

      {isProcessing && (
        <div className="bg-card border border-border rounded-xl p-6 text-center space-y-4" aria-busy="true">
          <div className="flex justify-center">
            <div className="relative">
              <Loader2 className="w-12 h-12 text-success animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Shield className="w-5 h-5 text-success" />
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {paymentMethod === 'cod' ? 'Placing your order...' : 'Opening Payment...'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {paymentMethod === 'cod' ? 'Saving your order and sending it to the printer.' : 'Complete your payment in the secure popup.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-success">
            <Lock className="w-4 h-4" />
            <span className="text-sm font-medium">{formatAmount(amount)}</span>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <PaymentUserInfo email={email} phone={phone} onEditEmail={onBack} />
        <PaymentOrderSummary job={job} printerName={printerName} printerLocation={printerLocation} />
        <PaymentPriceBreakdown
          pageCount={settings.page_count || pageCount}
          isColor={settings.color}
          copies={settings.copies || 1}
          totalAmount={amount}
        />
        <PaymentConfidenceSection />
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <div>
          <h3 className="font-semibold text-sm text-foreground">Customer details</h3>
          <p className="text-xs text-muted-foreground mt-1">Used for your order record and collection.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="printf-customer-name" className="text-sm">Full name</Label>
          <Input
            id="printf-customer-name"
            name="customer_name"
            autoComplete="name"
            placeholder="Enter your name"
            maxLength={100}
            value={customerName}
            onChange={(event) => { onCustomerNameChange(event.target.value); setValidationError(''); }}
            disabled={isProcessing}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="printf-customer-mobile" className="text-sm">Mobile number</Label>
          <Input
            id="printf-customer-mobile"
            name="customer_mobile"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Enter your mobile number"
            maxLength={20}
            value={phone || ''}
            onChange={(event) => { onCustomerMobileChange(event.target.value); setValidationError(''); }}
            disabled={isProcessing}
          />
        </div>
        {validationError && <p className="text-sm text-destructive" role="alert">{validationError}</p>}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Payment method</h3>
        <button
          type="button"
          onClick={() => setPaymentMethod('razorpay')}
          disabled={isProcessing}
          aria-pressed={paymentMethod === 'razorpay'}
          className={'flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors ' + (paymentMethod === 'razorpay' ? 'border-success bg-success/5' : 'border-border bg-card hover:border-muted-foreground/40')}
        >
          <span className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center"><CreditCard className="w-5 h-5 text-foreground" /></span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-foreground">Pay online with Razorpay</span>
            <span className="block text-xs text-muted-foreground mt-0.5">UPI, cards and supported online methods</span>
          </span>
          <span className={'h-4 w-4 rounded-full border-2 ' + (paymentMethod === 'razorpay' ? 'border-success bg-success' : 'border-muted-foreground')} />
        </button>
        <button
          type="button"
          onClick={() => setPaymentMethod('cod')}
          disabled={isProcessing}
          aria-pressed={paymentMethod === 'cod'}
          className={'flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors ' + (paymentMethod === 'cod' ? 'border-success bg-success/5' : 'border-border bg-card hover:border-muted-foreground/40')}
        >
          <span className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center"><Banknote className="w-5 h-5 text-foreground" /></span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-foreground">Cash on Delivery</span>
            <span className="block text-xs text-muted-foreground mt-0.5">Pay cash when collecting your printed document</span>
          </span>
          <span className={'h-4 w-4 rounded-full border-2 ' + (paymentMethod === 'cod' ? 'border-success bg-success' : 'border-muted-foreground')} />
        </button>
      </div>

      <Separator />

      <div className="space-y-4">
        <Button
          className="w-full bg-success hover:bg-success/90 text-success-foreground py-6 text-lg font-semibold shadow-lg shadow-success/20"
          onClick={triggerPayment}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />Processing...</span>
          ) : paymentMethod === 'cod' ? (
            <span className="flex items-center gap-2"><Banknote className="w-5 h-5" />Place COD Order — {formatAmount(amount)}</span>
          ) : (
            <span className="flex items-center gap-2"><Lock className="w-5 h-5" />Pay {formatAmount(amount)} Securely</span>
          )}
        </Button>

        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" />Safe & Secure</span>
          <span className="flex items-center gap-1"><Lock className="w-3.5 h-3.5" />Encrypted</span>
          <span>No card stored</span>
        </div>

        <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground" onClick={onBack} disabled={isProcessing}>
          Cancel & Go Back
        </Button>
      </div>

      <PaymentSupportSection />

      {paymentMethod === 'razorpay' && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Secured by <span className="font-semibold">Razorpay</span> • 100% Safe</p>
        </div>
      )}
    </div>
  );
}
