import { useState, useEffect, useCallback } from 'react';
import { OTP, PrintJob } from '@/types/printf';
import { Button } from '@/components/ui/button';
import { Check, Clock, Send, Loader2, RefreshCw, Printer, AlertCircle, CheckCircle2, FileText, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { cn } from '@/lib/utils';
import { useRealtimeJob } from '@/hooks/useRealtimeJob';

interface OTPVerificationProps {
  otp: OTP;
  job: PrintJob;
  email?: string;
  paymentMethod?: 'razorpay' | 'cod';
  orderNumber?: number | null;
  onNewPrint: () => void;
  onVerified: () => void;
}

const RESEND_COOLDOWN = 30;

// Status configuration for different job states
const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    title: 'Waiting for Verification',
    description: 'Enter your OTP to start printing',
    color: 'muted-foreground',
    bgColor: 'bg-muted/50',
    borderColor: 'border-border',
  },
  ready: {
    icon: FileText,
    title: 'Queued for printing',
    description: 'Your job is queued and waiting for the PrintF',
    color: 'secondary',
    bgColor: 'bg-secondary/10',
    borderColor: 'border-secondary/30',
  },
  printing: {
    icon: Printer,
    title: 'Printing...',
    description: 'Your document is being printed right now!',
    color: 'primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/30',
  },
  completed: {
    icon: CheckCircle2,
    title: 'Print Complete!',
    description: 'Your document has been printed successfully',
    color: 'success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/30',
  },
  failed: {
    icon: XCircle,
    title: 'Print Failed',
    description: 'Something went wrong. Please try again.',
    color: 'destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/30',
  },
};

export function OTPVerification({ otp, job: initialJob, email, paymentMethod = 'razorpay', orderNumber, onNewPrint, onVerified }: OTPVerificationProps) {
  const [enteredOTP, setEnteredOTP] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [attempts, setAttempts] = useState(0);

  // Real-time job status subscription
  const { job: realtimeJob, isSubscribed } = useRealtimeJob(initialJob.id);
  const job = realtimeJob || initialJob;


  // Determine current status from real-time data or optimistic local state
  // If locally verified but DB still says pending, show ready (Queued)
  const dbStatus = job.status as keyof typeof STATUS_CONFIG;
  const effectiveStatus = (isVerified && dbStatus === 'pending') ? 'ready' : dbStatus;

  const statusConfig = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.pending;
  const isPrintComplete = effectiveStatus === 'completed';
  const isPrinting = effectiveStatus === 'printing';
  const isReady = effectiveStatus === 'ready';
  const hasFailed = effectiveStatus === 'failed';

  // Show toast when status changes
  useEffect(() => {
    if (effectiveStatus === 'printing') {
      toast.info('🖨️ Your document is now printing!');
    } else if (effectiveStatus === 'completed') {
      toast.success('✅ Print complete! Collect your document.');
    } else if (effectiveStatus === 'failed') {
      toast.error('❌ Print failed. Please try again.');
    }
  }, [effectiveStatus]);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const expiresAt = new Date(otp.expires_at).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeLeft(diff);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [otp.expires_at]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isExpired = timeLeft === 0;

  const verifyOTP = useCallback(async () => {
    if (enteredOTP.length !== 6 || isVerifying) return;
    if (!email) {
      setVerificationError('Email address is missing. Start a new print order.');
      return;
    }
    setIsVerifying(true);
    setVerificationError('');
    try {
      const { data, error } = await supabase.functions.invoke('secure-otp', {
        body: { action: 'verify', otp: enteredOTP, job_id: job.id, email },
      });
      if (error) throw error;
      if (data?.verified) {
        setIsVerified(true);
        toast.success('OTP verified. Your print order is confirmed.');
        onVerified();
      } else {
        setAttempts((prev) => prev + 1);
        setVerificationError(data?.error || 'Incorrect OTP. Please try again.');
        setEnteredOTP('');
        if (data?.locked) toast.error(data.error);
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      setVerificationError('Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  }, [enteredOTP, job.id, email, isVerifying, onVerified]);

  const resendOTP = useCallback(async () => {
    if (!email || resendCooldown > 0 || isResending) return;
    setIsResending(true);
    try {
      const { data, error } = await supabase.functions.invoke('secure-otp', {
        body: { action: 'send', job_id: job.id, email },
      });
      if (error || !data?.success) throw error || new Error(data?.error || 'OTP send failed');
      const seconds = Number(data.expires_in_seconds) || 300;
      otp.expires_at = new Date(Date.now() + seconds * 1000).toISOString();
      setTimeLeft(seconds);
      toast.success('A new OTP was sent to your email.');
      setResendCooldown(RESEND_COOLDOWN);
      setVerificationError('');
      setEnteredOTP('');
      setAttempts(0);
    } catch (error) {
      console.error('Error resending OTP:', error);
      toast.error('Failed to resend OTP. Please try again.');
    } finally {
      setIsResending(false);
    }
  }, [email, job.id, otp, resendCooldown, isResending]);

  // Auto-verify when all 6 digits have been entered
  useEffect(() => {
    if (enteredOTP.length === 6 && !isVerifying && !isVerified) {
      verifyOTP();
    }
  }, [enteredOTP, verifyOTP, isVerifying, isVerified]);

  if (isVerified) {
    const StatusIcon = statusConfig.icon;

    return (
      <div className="w-full max-w-md mx-auto space-y-6 animate-fade-in">
        {/* Real-time Connection Indicator */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className={cn(
            "w-2 h-2 rounded-full",
            isSubscribed ? "bg-success animate-pulse" : "bg-muted-foreground"
          )} />
          {isSubscribed ? "Live updates active" : "Connecting..."}
        </div>

        {/* Animated Status Card */}
        <div className={cn(
          "relative overflow-hidden rounded-2xl p-8 text-center transition-all duration-500",
          statusConfig.bgColor,
          "border",
          statusConfig.borderColor
        )}>
          {/* Animated Background Circles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className={cn(
              "absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-20 transition-all duration-1000",
              isPrintComplete ? "bg-success scale-110" : isPrinting ? "bg-primary animate-pulse" : "bg-secondary"
            )} />
            <div className={cn(
              "absolute -bottom-10 -left-10 w-32 h-32 rounded-full opacity-10 transition-all duration-1000",
              isPrintComplete ? "bg-success scale-110" : isPrinting ? "bg-primary animate-pulse" : "bg-secondary"
            )} style={{ animationDelay: '0.5s' }} />
          </div>

          {/* Icon with Animation */}
          <div className="relative z-10">
            <div className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 transition-all duration-500",
              isPrintComplete ? "bg-success/20" : isPrinting ? "bg-primary/20" : hasFailed ? "bg-destructive/20" : "bg-secondary/20"
            )}>
              {isPrintComplete ? (
                <div className="animate-scale-in">
                  <CheckCircle2 className="w-10 h-10 text-success" />
                </div>
              ) : isPrinting ? (
                <div className="relative">
                  <Printer className="w-10 h-10 text-primary" />
                  {/* Printing Animation - Paper coming out */}
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 overflow-hidden">
                    <div className="w-5 h-8 bg-white border border-primary/30 rounded-sm animate-[slideDown_1.5s_ease-in-out_infinite] origin-top" />
                  </div>
                </div>
              ) : hasFailed ? (
                <XCircle className="w-10 h-10 text-destructive" />
              ) : (
                <StatusIcon className={cn("w-10 h-10", `text-${statusConfig.color}`)} />
              )}
            </div>

            {/* Status Text */}
            <h2 className={cn(
              "text-2xl font-bold mb-3 transition-colors duration-500",
              `text-${statusConfig.color}`
            )}>
              {statusConfig.title}
            </h2>
            <p className="text-muted-foreground">
              {statusConfig.description}
            </p>

            {/* Progress Indicator for printing/ready states */}
            {(isPrinting || isReady) && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <div className="flex gap-1">
                  <span className={cn("w-2 h-2 rounded-full animate-bounce", isPrinting ? "bg-primary" : "bg-secondary")} style={{ animationDelay: '0ms' }} />
                  <span className={cn("w-2 h-2 rounded-full animate-bounce", isPrinting ? "bg-primary" : "bg-secondary")} style={{ animationDelay: '150ms' }} />
                  <span className={cn("w-2 h-2 rounded-full animate-bounce", isPrinting ? "bg-primary" : "bg-secondary")} style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            {/* Success Checkmark Animation */}
            {isPrintComplete && (
              <div className="mt-4 animate-fade-in">
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-success/10 text-success rounded-full text-sm font-medium">
                  <Check className="w-4 h-4" />
                  Ready to collect
                </span>
              </div>
            )}

            {/* Failed state retry button */}
            {hasFailed && (
              <div className="mt-4">
                <Button
                  variant="destructive"
                  size="sm"
                  className="rounded-full"
                  onClick={onNewPrint}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Status Timeline */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="space-y-3">
            {/* Pending */}
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                "bg-success text-success-foreground"
              )}>
                <Check className="w-3 h-3" />
              </div>
              <span className="text-sm text-muted-foreground">{paymentMethod === 'cod' ? 'COD order created' : 'Payment verified'}</span>
            </div>

            {/* Ready */}
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                isReady || isPrinting || isPrintComplete
                  ? "bg-success text-success-foreground"
                  : "bg-muted text-muted-foreground"
              )}>
                {isReady || isPrinting || isPrintComplete ? <Check className="w-3 h-3" /> : "2"}
              </div>
              <span className={cn("text-sm", isReady ? "text-secondary font-medium" : "text-muted-foreground")}>
                {isReady ? "In queue..." : "Queued for printing"}
              </span>
            </div>

            {/* Printing */}
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                isPrinting ? "bg-primary text-primary-foreground animate-pulse" :
                  isPrintComplete ? "bg-success text-success-foreground" :
                    "bg-muted text-muted-foreground"
              )}>
                {isPrintComplete ? <Check className="w-3 h-3" /> : isPrinting ? <Printer className="w-3 h-3" /> : "3"}
              </div>
              <span className={cn("text-sm", isPrinting ? "text-primary font-medium" : "text-muted-foreground")}>
                {isPrinting ? "Printing now..." : "Printing"}
              </span>
            </div>

            {/* Complete */}
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                isPrintComplete
                  ? "bg-success text-success-foreground"
                  : "bg-muted text-muted-foreground"
              )}>
                {isPrintComplete ? <Check className="w-3 h-3" /> : "4"}
              </div>
              <span className={cn("text-sm", isPrintComplete ? "text-success font-medium" : "text-muted-foreground")}>
                {isPrintComplete ? "Complete!" : "Complete"}
              </span>
            </div>
          </div>
        </div>

        {/* File Details */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">File</span>
            <span className="text-foreground font-medium truncate max-w-[60%]">
              {job.file_name}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Pages</span>
            <span className="text-foreground font-medium">
              {job.settings_json.page_count || 1}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Color</span>
            <span className="text-foreground font-medium">
              {job.settings_json.color ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Double-sided</span>
            <span className="text-foreground font-medium">
              {job.settings_json.duplex ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <span className={cn("font-medium flex items-center gap-1", `text-${statusConfig.color}`)}>
              <StatusIcon className="w-3 h-3" />
              {statusConfig.title}
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full h-12 rounded-xl animate-fade-in"
          style={{ animationDelay: '0.3s' }}
          onClick={onNewPrint}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Start New Print
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Header */}
      <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <Check className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-primary">{paymentMethod === 'cod' ? 'Cash on Delivery Order Placed!' : 'Payment Successful!'}</p>
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit OTP sent to your email to verify your print order
          </p>
        </div>
      </div>

      {/* OTP Entry Card */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">Enter 6-digit OTP</p>

          <div className="flex justify-center mb-4">
            <InputOTP
              maxLength={6}
              value={enteredOTP}
              onChange={setEnteredOTP}
              disabled={isExpired || isVerifying}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="w-14 h-16 text-2xl" />
                <InputOTPSlot index={1} className="w-14 h-16 text-2xl" />
                <InputOTPSlot index={2} className="w-14 h-16 text-2xl" />
                <InputOTPSlot index={3} className="w-12 h-14 sm:w-14 sm:h-16 text-2xl" />
                <InputOTPSlot index={4} className="w-12 h-14 sm:w-14 sm:h-16 text-2xl" />
                <InputOTPSlot index={5} className="w-12 h-14 sm:w-14 sm:h-16 text-2xl" />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {/* Verification Error */}
          {verificationError && (
            <div className="flex items-center justify-center gap-2 text-destructive mb-4">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{verificationError}</span>
            </div>
          )}

          {/* Verify Button */}
          <Button
            className="w-full h-12 rounded-xl mb-4"
            onClick={verifyOTP}
            disabled={enteredOTP.length !== 6 || isVerifying || isExpired}
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <Printer className="w-4 h-4 mr-2" />
                Verify & Print
              </>
            )}
          </Button>

          {/* Resend Button */}
          {email && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={resendOTP}
              disabled={resendCooldown > 0 || isResending || isExpired}
            >
              {isResending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : resendCooldown > 0 ? (
                <>
                  <Clock className="w-4 h-4 mr-2" />
                  Resend ({resendCooldown}s)
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Resend OTP
                </>
              )}
            </Button>
          )}
        </div>

        {/* Email Info */}
        {email && (
          <div className="mt-4 p-3 bg-muted/50 rounded-xl text-center">
            <p className="text-sm text-muted-foreground">
              OTP sent to <span className="font-medium text-foreground">{email}</span>
            </p>
          </div>
        )}

        {/* Timer */}
        <div className={`mt-4 p-4 rounded-xl ${isExpired ? 'bg-destructive/10' : 'bg-muted/50'}`}>
          <div className="flex items-center justify-center gap-2">
            <Clock className={`w-5 h-5 ${isExpired ? 'text-destructive' : 'text-muted-foreground'}`} />
            <span className={`text-lg font-semibold ${isExpired ? 'text-destructive' : 'text-foreground'}`}>
              {isExpired ? 'OTP Expired' : formatTime(timeLeft)}
            </span>
          </div>
          <p className="text-xs text-center text-muted-foreground mt-1">
            {isExpired ? 'Please create a new print job' : 'Time remaining'}
          </p>
        </div>
      </div>

      {/* Job Details */}
      <div className="bg-muted/30 rounded-2xl p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">File</span>
          <span className="text-foreground font-medium truncate max-w-[60%]">
            {job.file_name}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Color</span>
          <span className="text-foreground font-medium">
            {job.settings_json.color ? 'Yes' : 'No'}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Double-sided</span>
          <span className="text-foreground font-medium">
            {job.settings_json.duplex ? 'Yes' : 'No'}
          </span>
        </div>
      </div>

      {/* New Print Button */}
      <Button
        variant="outline"
        className="w-full h-12 rounded-xl"
        onClick={onNewPrint}
      >
        <RefreshCw className="w-4 h-4 mr-2" />
        Start New Print
      </Button>
    </div>
  );
}
