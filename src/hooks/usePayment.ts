import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

declare global { interface Window { Razorpay: any; } }

export interface PaymentCompletion {
  payment_method: 'razorpay' | 'cod';
  order_number?: number;
  amount?: number;
  expires_in_seconds?: number;
}

interface PaymentOptions {
  jobId: string;
  amount: number;
  email: string;
  phone?: string;
  customerName: string;
  customerMobile: string;
  paymentMethod: 'razorpay' | 'cod';
  onSuccess: (otpCode?: string, details?: PaymentCompletion) => void;
  onFailure: () => void;
  onCancel?: () => void;
}

export function usePayment() {
  const [isProcessing, setIsProcessing] = useState(false);
  const loadRazorpayScript = useCallback((): Promise<boolean> => new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  }), []);

  const sendOtp = async (jobId: string, email: string) => {
    const { data, error } = await supabase.functions.invoke('secure-otp', { body: { action: 'send', job_id: jobId, email } });
    if (error || !data?.success) {
      console.error('OTP delivery error:', error ?? data?.error);
      toast.error('Order recorded, but OTP email could not be sent. Use Resend OTP below.');
      return 300;
    }
    return Number(data.expires_in_seconds) || 300;
  };

  const initiatePayment = useCallback(async ({
    jobId, amount, email, phone, customerName, customerMobile, paymentMethod,
    onSuccess, onFailure, onCancel,
  }: PaymentOptions) => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-order', {
        body: {
          job_id: jobId, amount, customer_name: customerName.trim(),
          customer_mobile: customerMobile.trim(), payment_method: paymentMethod,
          callback_url: `${window.location.origin}/payment-callback`,
        },
      });
      if (error || !data?.success) {
        console.error('Order creation error:', error ?? data);
        toast.error(data?.error || 'Failed to create order. Please try again.');
        setIsProcessing(false);
        onFailure();
        return;
      }

      localStorage.setItem('printf_payment_job_id', jobId);
      localStorage.setItem('printf_email', email);
      if (paymentMethod === 'cod') {
        const expires = await sendOtp(jobId, email);
        toast.success(`Cash on Delivery order #${data.order_number} created.`);
        setIsProcessing(false);
        onSuccess(undefined, { payment_method: 'cod', order_number: Number(data.order_number), amount, expires_in_seconds: expires });
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error('Failed to load payment gateway');
        setIsProcessing(false);
        onFailure();
        return;
      }
      if (!data.order_id || !data.key_id) {
        toast.error(data.error || 'Payment service returned an invalid order.');
        setIsProcessing(false);
        onFailure();
        return;
      }
      localStorage.setItem('printf_order_id', data.order_id);

      const razorpay = new window.Razorpay({
        key: data.key_id, amount: data.amount, currency: data.currency || 'INR',
        name: 'PrintF', description: `Print Job${data.order_number ? ` #${data.order_number}` : ''}`,
        order_id: data.order_id,
        prefill: { name: customerName, email, contact: customerMobile || phone || '' },
        theme: { color: '#22c55e' },
        handler: async (response: any) => {
          try {
            const { data: verified, error: verifyError } = await supabase.functions.invoke('verify-payment', {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                job_id: jobId,
              },
            });
            if (verifyError || !verified?.success) {
              console.error('Payment verification error:', verifyError ?? verified);
              toast.error(verified?.error || 'Payment verification failed. If charged, contact support before retrying.');
              onFailure();
              return;
            }
            const expires = await sendOtp(jobId, email);
            toast.success('Payment verified. Check your email for the OTP.');
            localStorage.removeItem('printf_payment_job_id');
            localStorage.removeItem('printf_order_id');
            localStorage.removeItem('printf_email');
            onSuccess(undefined, { payment_method: 'razorpay', order_number: Number(data.order_number) || undefined, amount, expires_in_seconds: expires });
          } catch (err) {
            console.error('Verification request failed:', err);
            toast.error('Payment verification could not be completed. Please contact support before retrying.');
            onFailure();
          } finally { setIsProcessing(false); }
        },
        modal: {
          ondismiss: () => { setIsProcessing(false); toast.info('Payment cancelled'); onCancel?.(); },
          escape: true, backdropclose: false, confirm_close: true,
        },
      });
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
