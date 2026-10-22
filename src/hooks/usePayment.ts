import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

declare global {
  interface Window { Razorpay: any; }
}

type CheckoutPaymentMethod = 'razorpay' | 'cod';

interface PaymentOptions {
  jobId: string;
  amount: number;
  customerName: string;
  customerMobile: string;
  paymentMethod: CheckoutPaymentMethod;
  onSuccess: () => void;
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

  const initiatePayment = useCallback(async ({
    jobId, amount, customerName, customerMobile, paymentMethod, onSuccess, onFailure, onCancel,
  }: PaymentOptions) => {
    setIsProcessing(true);
    try {
      if (paymentMethod === 'razorpay') {
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded) {
          toast.error('Failed to load payment gateway');
          setIsProcessing(false);
          onFailure();
          return;
        }
      }

      localStorage.setItem('printf_payment_job_id', jobId);
      localStorage.setItem('printf_last_payment_method', paymentMethod);

      const { data, error } = await supabase.functions.invoke('create-order', {
        body: {
          job_id: jobId,
          amount,
          customer_name: customerName.trim(),
          customer_mobile: customerMobile.trim(),
          payment_method: paymentMethod,
          callback_url: \`\${window.location.origin}/payment-callback\`,
        },
      });

      if (error || !data?.success) {
        console.error('Order creation error:', error ?? data);
        toast.error(data?.error || 'Failed to create your order. Please try again.');
        setIsProcessing(false);
        onFailure();
        return;
      }

      if (data.print_order_id) localStorage.setItem('printf_print_order_id', data.print_order_id);
      if (data.order_number !== undefined) localStorage.setItem('printf_order_number', String(data.order_number));

      if (data.already_paid) {
        toast.success(\`Order #\${data.order_number ?? ''} is already recorded as paid.\`);
        setIsProcessing(false);
        onSuccess();
        return;
      }

      // COD is created server-side and the print job is queued without opening Razorpay.
      if (paymentMethod === 'cod') {
        toast.success(\`Order #\${data.order_number ?? ''} placed. Pay cash when collecting your print.\`);
        setIsProcessing(false);
        onSuccess();
        return;
      }

      if (!data.order_id || !data.key_id) {
        toast.error('Payment service returned an incomplete order. Please try again.');
        setIsProcessing(false);
        onFailure();
        return;
      }

      localStorage.setItem('printf_razorpay_order_id', data.order_id);
      localStorage.setItem('printf_order_id', data.order_id);
      const razorpayOptions = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: 'PrintF',
        description: 'Print Job Payment',
        order_id: data.order_id,
        handler: async (response: any) => {
          try {
            const { data: verification, error: verifyError } = await supabase.functions.invoke('verify-payment', {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                job_id: jobId,
              },
            });
            if (verifyError || !verification?.success) {
              toast.error(verification?.error || 'Payment verification failed');
              onFailure();
            } else {
              toast.success('Payment successful! Your job was sent to the printer.');
              localStorage.removeItem('printf_payment_job_id');
              localStorage.removeItem('printf_order_id');
              localStorage.removeItem('printf_razorpay_order_id');
              onSuccess();
            }
          } catch (err) {
            console.error('Verification error:', err);
            toast.error('Payment verification failed');
            onFailure();
          } finally {
            setIsProcessing(false);
          }
        },
        theme: { color: '#22c55e' },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            toast.info('Payment cancelled');
            onCancel?.();
          },
          escape: true,
          backdropclose: false,
          confirm_close: true,
        },
      };
      new window.Razorpay(razorpayOptions).open();
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Checkout failed. Please try again.');
      setIsProcessing(false);
      onFailure();
    }
  }, [loadRazorpayScript]);

  return { initiatePayment, isProcessing };
}
