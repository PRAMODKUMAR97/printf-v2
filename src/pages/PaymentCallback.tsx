import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [otpCode, setOtpCode] = useState<string | null>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      // Get params from Razorpay redirect callback
      const razorpay_payment_id = searchParams.get('razorpay_payment_id');
      const razorpay_order_id = searchParams.get('razorpay_order_id');
      const razorpay_signature = searchParams.get('razorpay_signature');
      
      // Get job ID and phone from localStorage
      const job_id = localStorage.getItem('printf_payment_job_id');
      const phone_number = localStorage.getItem('printf_phone_number');

      console.log('Payment callback:', {
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature,
        job_id,
        phone_number,
      });

      if (!razorpay_payment_id || !razorpay_order_id) {
        console.error('Missing payment details in callback');
        setStatus('failed');
        toast.error('Payment details missing');
        return;
      }

      if (!job_id) {
        console.error('No job ID found');
        setStatus('failed');
        toast.error('Payment session expired');
        return;
      }

      try {
        // Verify payment on backend (OTP is generated and SMS sent here)
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: {
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            job_id,
            phone_number,
          },
        });

        if (error) {
          console.error('Verification error:', error);
          setStatus('failed');
          toast.error('Payment verification failed');
          return;
        }

        // Get OTP from server response
        setOtpCode(data?.otp_code || null);

        // Clear stored data
        localStorage.removeItem('printf_payment_job_id');
        localStorage.removeItem('printf_order_id');
        localStorage.removeItem('printf_phone_number');

        setStatus('success');
        
        if (data?.sms_sent) {
          toast.success('Payment successful! OTP sent to your phone.');
        } else {
          toast.success('Payment successful!');
        }

        // Clear stored data
        localStorage.removeItem('printf_payment_job_id');
        localStorage.removeItem('printf_order_id');

        setStatus('success');
        toast.success('Payment successful!');

      } catch (err) {
        console.error('Error:', err);
        setStatus('failed');
        toast.error('Something went wrong');
      }
    };

    verifyPayment();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md mx-auto">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 text-primary mx-auto animate-spin" />
            <h1 className="text-2xl font-bold text-foreground">Verifying Payment...</h1>
            <p className="text-muted-foreground">Please wait</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-24 h-24 bg-success/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-14 h-14 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Payment Successful!</h1>
            
            {otpCode && (
              <div className="mt-6 p-6 bg-card border border-border rounded-2xl">
                <p className="text-sm text-muted-foreground mb-2">Your OTP Code</p>
                <p className="text-5xl font-bold text-foreground tracking-[0.5em] font-mono">
                  {otpCode}
                </p>
                <p className="text-sm text-muted-foreground mt-4">
                  Show this at the PrintF
                </p>
              </div>
            )}

            <button
              onClick={() => navigate('/')}
              className="mt-6 px-8 py-3 bg-primary text-primary-foreground rounded-xl font-medium"
            >
              Done
            </button>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="w-24 h-24 bg-destructive/20 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="w-14 h-14 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Payment Failed</h1>
            <p className="text-muted-foreground">Something went wrong</p>
            <button
              onClick={() => navigate('/')}
              className="mt-6 px-8 py-3 bg-primary text-primary-foreground rounded-xl font-medium"
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
