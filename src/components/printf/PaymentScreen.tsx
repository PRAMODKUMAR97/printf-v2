import { PrintJob } from '@/types/printf';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Lock, Shield } from 'lucide-react';
import { usePayment } from '@/hooks/usePayment';
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
  phone?: string;
  printerName?: string;
  printerLocation?: string;
  onBack: () => void;
  onSuccess: (otpCode?: string) => void;
}

export function PaymentScreen({
  job,
  amount,
  email,
  phone,
  printerName,
  printerLocation,
  onBack,
  onSuccess
}: PaymentScreenProps) {
  const { initiatePayment, isProcessing } = usePayment();

  const settings = job.settings_json;
  const pageCount = settings.page_count || 1;

  const triggerPayment = () => {
    initiatePayment({
      jobId: job.id,
      amount: amount,
      email: email,
      phone: phone,
      onSuccess: onSuccess,
      onFailure: () => { },
      onCancel: onBack,
    });
  };

  const formatAmount = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amt);
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={onBack}
          disabled={isProcessing}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-foreground font-display">Secure Payment</h2>
          <p className="text-sm text-muted-foreground">Complete your print order</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 rounded-full">
          <Lock className="w-3.5 h-3.5 text-success" />
          <span className="text-xs font-medium text-success">Secure</span>
        </div>
      </div>

      {/* Trust Badges */}
      <PaymentTrustBadges />

      {/* Processing State Overlay */}
      {isProcessing && (
        <div className="bg-card border border-border rounded-xl p-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="relative">
              <Loader2 className="w-12 h-12 text-success animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Shield className="w-5 h-5 text-success" />
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Opening Payment...</h3>
            <p className="text-sm text-muted-foreground mt-1">Complete your payment in the secure popup</p>
          </div>
          <div className="flex items-center justify-center gap-2 text-success">
            <Lock className="w-4 h-4" />
            <span className="text-sm font-medium">{formatAmount(amount)}</span>
          </div>
        </div>
      )}

      {/* Order Details */}
      <div className="space-y-4">
        {/* User Info */}
        <PaymentUserInfo email={email} phone={phone} onEditEmail={onBack} />

        {/* Order Summary */}
        <PaymentOrderSummary
          job={job}
          printerName={printerName}
          printerLocation={printerLocation}
        />

        {/* Price Breakdown */}
        <PaymentPriceBreakdown
          pageCount={pageCount}
          isColor={settings.color}
          copies={settings.copies || 1}
          totalAmount={amount}
        />

        {/* Confidence Section */}
        <PaymentConfidenceSection />
      </div>

      <Separator />

      {/* Payment Action */}
      <div className="space-y-4">
        {/* Main Pay Button */}
        <Button
          className="w-full bg-success hover:bg-success/90 text-success-foreground py-6 text-lg font-semibold shadow-lg shadow-success/20"
          onClick={triggerPayment}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Pay {formatAmount(amount)} Securely
            </span>
          )}
        </Button>

        {/* Security Microcopy */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" />
            Safe & Secure
          </span>
          <span className="flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" />
            Encrypted
          </span>
          <span>No card stored</span>
        </div>

        {/* Cancel Button */}
        <Button
          variant="ghost"
          className="w-full text-muted-foreground hover:text-foreground"
          onClick={onBack}
          disabled={isProcessing}
        >
          Cancel & Go Back
        </Button>
      </div>

      {/* Support Section */}
      <PaymentSupportSection />

      {/* Razorpay Badge */}
      <div className="flex items-center justify-center gap-2 pt-2">
        <Shield className="w-4 h-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Secured by <span className="font-semibold">Razorpay</span> • 100% Safe
        </p>
      </div>
    </div>
  );
}
