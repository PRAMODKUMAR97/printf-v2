import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProgressHairline, Shimmer } from '@/components/printf/loading/Skeletons';

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  useEffect(() => {
    const verifyPayment = async () => {
      const razorpay_payment_id = searchParams.get('razorpay_payment_id');
      const razorpay_order_id = searchParams.get('razorpay_order_id');
      const razorpay_signature = searchParams.get('razorpay_signature');
      const job_id = localStorage.getItem('printf_payment_job_id');
      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) { setStatus('failed'); toast.error('Payment details missing'); return; }
      if (!job_id) { setStatus('failed'); toast.error('Payment session expired'); return; }
      try {
        const { data: verification, error } = await supabase.functions.invoke('verify-payment', { body: { razorpay_payment_id, razorpay_order_id, razorpay_signature, job_id } });
        if (error || !verification?.success) { console.error('Verification error:', error ?? verification); setStatus('failed'); toast.error('Payment verification failed'); return; }
        localStorage.removeItem('printf_payment_job_id');
        localStorage.removeItem('printf_order_id');
        localStorage.removeItem('printf_razorpay_order_id');
        setStatus('success');
        toast.success('Payment verified. Check your email for the print verification code.');
      } catch (err) { console.error('Error:', err); setStatus('failed'); toast.error('Something went wrong'); }
    };
    void verifyPayment();
  }, [searchParams]);
  return <div className="min-h-screen bg-background flex items-center justify-center p-4"><div className="w-full max-w-md space-y-6 text-center">
    {status === 'loading' && <div className="w-full animate-rise text-left" aria-busy="true" aria-live="polite"><span className="sr-only">Verifying payment</span><div className="overflow-hidden rounded-2xl border border-border bg-card shadow-elev-1"><ProgressHairline /><div className="space-y-6 px-7 py-8"><div className="space-y-3"><p className="text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">Verifying payment</p><h1 className="font-display text-3xl text-foreground">Confirming with the bank…</h1></div><div className="space-y-3"><Shimmer className="skeleton-text h-2.5 w-3/4" /><Shimmer className="skeleton-text h-2.5 w-1/2" /></div><div className="skeleton h-20 w-full rounded-xl" /></div></div></div>}
    {status === 'success' && <div className="animate-rise space-y-6"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success/15"><CheckCircle2 className="h-11 w-11 text-success" /></div><div className="space-y-2"><h1 className="font-display text-3xl text-foreground">Payment successful</h1><p className="text-sm text-muted-foreground">Payment is verified. Complete the email OTP step to release your job for printing.</p></div><Button variant="secondary" size="lg" className="w-full" onClick={() => navigate('/printers')}>Back to stations</Button></div>}
    {status === 'failed' && <div className="animate-rise space-y-6"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/15"><XCircle className="h-11 w-11 text-destructive" /></div><div className="space-y-2"><h1 className="font-display text-3xl text-foreground">Payment failed</h1><p className="text-sm text-muted-foreground">Nothing was charged twice. You can start the print again.</p></div><Button variant="outline" size="lg" className="w-full" onClick={() => navigate('/printers')}>Start over</Button></div>}
  </div></div>;
}
