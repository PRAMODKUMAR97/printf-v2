import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PaymentOptions {
  jobId: string;
  amount: number;
  email: string;
  phone?: string;
  onSuccess: (otpCode?: string) => void;
  onFailure: () => void;
  onCancel?: () => void;
}


export function usePayment() {
  const [isProcessing, setIsProcessing] = useState(false);

  const loadRazorpayScript = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }, []);

  const initiatePayment = useCallback(async ({
    jobId,
    amount,
    email,
    phone,
    onSuccess,
    onFailure,
    onCancel,
  }: PaymentOptions) => {
    setIsProcessing(true);

    try {
      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error('Failed to load payment gateway');
        setIsProcessing(false);
        onFailure();
        return;
      }

      // Store job info and email for callback
      console.log('Initiating payment for:', { email, phone });
      localStorage.setItem('printf_payment_job_id', jobId);
      localStorage.setItem('printf_email', email);

      // Create order via edge function
      const { data, error } = await supabase.functions.invoke('create-order', {
        body: {
          job_id: jobId,
          amount,
          callback_url: `${window.location.origin}/payment-callback`,
        },
      });

      if (error || !data) {
        console.error('Order creation error:', error);
        toast.error('Failed to create payment. Please try again.');
        setIsProcessing(false);
        onFailure();
        return;
      }

      // Store order ID for verification
      localStorage.setItem('printf_order_id', data.order_id);

      // Build Razorpay options
      const razorpayOptions = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: 'PrintF',
        description: 'Print Job Payment',
        order_id: data.order_id,
        // Default configuration (no custom blocks) to ensure all enabled methods (UPI, Cards, etc.) are shown
        // config: { ... }, 

        handler: async function (response: any) {
          try {
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-payment', {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                job_id: jobId,
                email: email,
              },
            });

            if (verifyError) {
              toast.error('Payment verification failed');
              onFailure();
            } else {
              const emailSent = verifyData?.email_sent;
              const otpCode = verifyData?.otp_code;

              if (emailSent) {
                toast.success('Payment successful! OTP sent to your email.');
              } else if (otpCode) {
                toast.success(`Payment successful! Your OTP is: ${otpCode}`, {
                  duration: 10000,
                  description: 'Email service in test mode'
                });
              } else {
                toast.success('Payment successful!');
              }
              localStorage.removeItem('printf_payment_job_id');
              localStorage.removeItem('printf_order_id');
              localStorage.removeItem('printf_email');
              onSuccess(otpCode);
            }
          } catch (err) {
            console.error('Verification error:', err);
            toast.error('Payment verification failed');
            onFailure();
          } finally {
            setIsProcessing(false);
          }
        },
        prefill: {
          email: email,
        },
        theme: {
          color: '#22c55e',
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            toast.info('Payment cancelled');
            if (onCancel) {
              onCancel();
            }
          },
          escape: true,
          backdropclose: false,
          confirm_close: true,
        },
      };

      const razorpay = new window.Razorpay(razorpayOptions);
      razorpay.open();

    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Payment failed. Please try again.');
      setIsProcessing(false);
      onFailure();
    }
  }, [loadRazorpayScript]);

  return { initiatePayment, isProcessing };
}
