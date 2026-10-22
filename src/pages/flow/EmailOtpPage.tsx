import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, Loader2, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { usePrintFlow } from '@/components/printf/flow/PrintFlowContext';
import { toast } from 'sonner';

const OTP_LENGTH = 6;
const OTP_TTL_SECONDS = 300;
const RESEND_COOLDOWN_SECONDS = 30;

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes + ':' + String(seconds).padStart(2, '0');
}

export default function EmailOtpPage() {
  const navigate = useNavigate();
  const { job, setStep } = usePrintFlow();
  const [email, setEmail] = useState(() =>
    typeof window === 'undefined' ? '' : (window.localStorage.getItem('printf_customer_email') || '')
  );
  const [code, setCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const requestedOnMount = useRef(false);

  const sendOtp = useCallback(async () => {
    if (!job?.id || !email) {
      setSendError('Your order session is missing. Please start the print again.');
      return;
    }
    setIsSending(true);
    setSendError('');
    try {
      const { data, error } = await supabase.functions.invoke('secure-otp', {
        body: { action: 'send', job_id: job.id, email: email.trim().toLowerCase() },
      });
      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Could not send the verification code.');
      }
      const seconds = Number(data.expires_in_seconds) || OTP_TTL_SECONDS;
      setExpiresAt(Date.now() + seconds * 1000);
      setResendAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
      setSent(true);
      setCode('');
      toast.success('A verification code was sent to your email.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not send the verification code.';
      setSendError(message);
      setSent(false);
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  }, [job?.id, email]);

  useEffect(() => {
    if (!job?.id || !email) {
      toast.error('Your order session has expired. Please start a new print.');
      navigate('/printers', { replace: true });
      return;
    }
    if (!requestedOnMount.current) {
      requestedOnMount.current = true;
      void sendOtp();
    }
  }, [job?.id, email, navigate, sendOtp]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const secondsLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0;
  const resendSecondsLeft = resendAt ? Math.max(0, Math.ceil((resendAt - now) / 1000)) : 0;

  const verifyOtp = useCallback(async () => {
    if (!job?.id || code.length !== OTP_LENGTH || isVerifying) return;
    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('secure-otp', {
        body: { action: 'verify', job_id: job.id, email: email.trim().toLowerCase(), otp: code },
      });
      if (error || !data?.verified) {
        throw new Error(data?.error || error?.message || 'Incorrect or expired code.');
      }
      window.localStorage.removeItem('printf_payment_job_id');
      window.localStorage.removeItem('printf_customer_email');
      window.localStorage.removeItem('printf_email');
      window.localStorage.removeItem('printf_order_id');
      window.localStorage.removeItem('printf_razorpay_order_id');
      toast.success('Email verified. Your print job is now queued.');
      setStep('status');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed. Please try again.';
      toast.error(message);
    } finally {
      setIsVerifying(false);
    }
  }, [job?.id, email, code, isVerifying, setStep]);

  return (
    <div className="container mx-auto px-6 py-14">
      <div className="mx-auto w-full max-w-lg animate-rise space-y-6">
        <div className="flex items-start gap-4">
          <span className="mt-1 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="eyebrow">Order verification</p>
            <h1 className="mt-2 font-display text-3xl text-foreground">Check your email</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              We use a one-time code to confirm your order before releasing the document to the printer.
            </p>
          </div>
        </div>

        <section className="panel-raised space-y-5 p-6 sm:p-7" aria-labelledby="otp-heading">
          <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-background text-primary">
              <Mail className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Verification code sent to</p>
              <p className="break-all text-sm font-medium text-foreground">{email}</p>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="printf-email-otp" id="otp-heading" className="text-sm font-medium text-foreground">6-digit verification code</label>
            <Input
              id="printf-email-otp"
              name="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={OTP_LENGTH}
              placeholder="Enter code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\\D/g, '').slice(0, OTP_LENGTH))}
              onKeyDown={(event) => { if (event.key === 'Enter') void verifyOtp(); }}
              disabled={isVerifying}
              aria-describedby="printf-otp-help"
              className="h-14 rounded-xl text-center text-xl font-semibold tracking-[0.45em]"
            />
            <p id="printf-otp-help" className="text-xs text-muted-foreground">
              The code expires in 5 minutes. Check your spam folder if you do not see the email.
            </p>
          </div>

          {sendError && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{sendError}</p>}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {sent ? (secondsLeft > 0 ? 'Expires in ' + formatTime(secondsLeft) : 'Code expired') : 'Preparing code…'}
            </span>
            {resendSecondsLeft > 0 && <span>Resend in {resendSecondsLeft}s</span>}
          </div>

          <Button className="h-12 w-full" onClick={() => void verifyOtp()} disabled={code.length !== OTP_LENGTH || isVerifying || !sent || secondsLeft === 0}>
            {isVerifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying code…</> : 'Verify and queue print'}
          </Button>
          <Button variant="outline" className="w-full" onClick={() => void sendOtp()} disabled={isSending || isVerifying || resendSecondsLeft > 0}>
            {isSending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending code…</> :
              <><RefreshCw className="mr-2 h-4 w-4" />{sent ? 'Resend verification code' : 'Send verification code'}</>}
          </Button>
        </section>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          Order{window.localStorage.getItem('printf_order_number') ? ' #' + window.localStorage.getItem('printf_order_number') : ''} · Your print job remains private until verification succeeds.
        </p>
        <Button variant="ghost" className="w-full" onClick={() => navigate('/printers')}>Cancel and start over</Button>
      </div>
    </div>
  );
}
