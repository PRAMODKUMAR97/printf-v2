import { useState } from 'react';
import { PrintJob } from '@/types/printf';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Lock, Shield, CreditCard, Banknote } from 'lucide-react';
import { usePayment, PaymentCompletion } from '@/hooks/usePayment';
import { PaymentTrustBadges } from './payment/PaymentTrustBadges';
import { PaymentOrderSummary } from './payment/PaymentOrderSummary';
import { PaymentPriceBreakdown } from './payment/PaymentPriceBreakdown';
import { PaymentUserInfo } from './payment/PaymentUserInfo';
import { PaymentConfidenceSection } from './payment/PaymentConfidenceSection';
import { PaymentSupportSection } from './payment/PaymentSupportSection';
import { Separator } from '@/components/ui/separator';

interface PaymentScreenProps {
  job: PrintJob;
  amount: number;
  email: string;
  customerName: string;
  phone?: string;
  printerName?: string;
  printerLocation?: string;
  onBack: () => void;
  onSuccess: (otpCode?: string, details?: PaymentCompletion) => void;
}

export function PaymentScreen({ job, amount, email, customerName, phone, printerName, printerLocation, onBack, onSuccess }: PaymentScreenProps) {
  const { initiatePayment, isProcessing } = usePayment();
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'cod'>('razorpay');
  const settings = job.settings_json;
  const pageCount = settings.page_count || 1;
  const formatAmount = (amt: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 0,
  }).format(amt);

  const triggerPayment = () => initiatePayment({
    jobId: job.id, amount, email, phone, customerName, customerMobile: phone || '',
    paymentMethod, onSuccess, onFailure: () => {}, onCancel: onBack,
  });

  return (
    <div className="w-full max-w-lg mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={onBack} disabled={isProcessing}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1"><h2 className="text-xl font-bold text-foreground font-display">Secure Payment</h2><p className="text-sm text-muted-foreground">Complete your print order</p></div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 rounded-full"><Lock className="w-3.5 h-3.5 text-success" /><span className="text-xs font-medium text-success">Secure</span></div>
      </div>
      <PaymentTrustBadges />
      {isProcessing && <div className="bg-card border border-border rounded-xl p-6 text-center space-y-4">
        <div className="flex justify-center"><Loader2 className="w-12 h-12 text-success animate-spin" /></div>
        <div><h3 className="text-lg font-semibold text-foreground">Processing Order...</h3><p className="text-sm text-muted-foreground mt-1">Keep this window open while your order is confirmed</p></div>
        <div className="flex items-center justify-center gap-2 text-success"><Lock className="w-4 h-4" /><span className="text-sm font-medium">{formatAmount(amount)}</span></div>
      </div>}
      <div className="space-y-4">
        <PaymentUserInfo email={email} customerName={customerName} phone={phone} onEditEmail={onBack} />
        <PaymentOrderSummary job={job} printerName={printerName} printerLocation={printerLocation} />
        <PaymentPriceBreakdown pageCount={pageCount} isColor={settings.color} copies={settings.copies || 1} totalAmount={amount} />
        <PaymentConfidenceSection />
      </div>
      <Separator />
      <div className="space-y-4">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Payment Method</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button type="button" disabled={isProcessing} onClick={() => setPaymentMethod('razorpay')}
              className={`text-left rounded-xl border-2 p-4 transition-all ${paymentMethod === 'razorpay' ? 'border-success bg-success/5' : 'border-border bg-card hover:border-muted-foreground/30'}`}>
              <div className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-success" /><span className="font-medium text-foreground">Online Payment</span></div>
              <p className="text-xs text-muted-foreground mt-2">UPI, cards and net banking via Razorpay</p>
              <p className="text-xs font-semibold text-success mt-2">{paymentMethod === 'razorpay' ? 'Selected' : 'Select'}</p>
            </button>
            <button type="button" disabled={isProcessing} onClick={() => setPaymentMethod('cod')}
              className={`text-left rounded-xl border-2 p-4 transition-all ${paymentMethod === 'cod' ? 'border-success bg-success/5' : 'border-border bg-card hover:border-muted-foreground/30'}`}>
              <div className="flex items-center gap-2"><Banknote className="w-5 h-5 text-success" /><span className="font-medium text-foreground">Cash on Delivery</span></div>
              <p className="text-xs text-muted-foreground mt-2">Pay cash when you collect your printout</p>
              <p className="text-xs font-semibold text-success mt-2">{paymentMethod === 'cod' ? 'Selected' : 'Select'}</p>
            </button>
          </div>
        </div>
        <Button className="w-full bg-success hover:bg-success/90 text-success-foreground py-6 text-lg font-semibold shadow-lg shadow-success/20" onClick={triggerPayment} disabled={isProcessing}>
          {isProcessing ? <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />Processing...</span> :
            paymentMethod === 'cod' ? <span className="flex items-center gap-2"><Banknote className="w-5 h-5" />Place COD Order · {formatAmount(amount)}</span> :
            <span className="flex items-center gap-2"><Lock className="w-5 h-5" />Pay {formatAmount(amount)} Securely</span>}
        </Button>
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" />Safe & Secure</span>
          <span className="flex items-center gap-1"><Lock className="w-3.5 h-3.5" />Encrypted</span><span>No card stored</span>
        </div>
        <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground" onClick={onBack} disabled={isProcessing}>Cancel & Go Back</Button>
      </div>
      <PaymentSupportSection />
      <div className="flex items-center justify-center gap-2 pt-2"><Shield className="w-4 h-4 text-muted-foreground" /><p className="text-xs text-muted-foreground">Secured by <span className="font-semibold">{paymentMethod === 'cod' ? 'PrintF' : 'Razorpay'}</span> • 100% Safe</p></div>
    </div>
  );
}
