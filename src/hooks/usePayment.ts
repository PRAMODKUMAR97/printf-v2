import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

declare global {
  interface Window {
    Razorpay: any;
  }
}

type CheckoutPaymentMethod = 'razorpay' | 'cod';

interface PaymentConfirmation {
  payment_method: CheckoutPaymentMethod;
  order_number: number | null;
  amount: number;
  expires_in_seconds?: number;
}

interface PaymentOptions {
  jobId: string;
  amount: number;
  email: string;
  phone?: string;
  customerName: string;
  customerMobile: string;
  paymentMethod: CheckoutPaymentMethod;
  onSuccess: (otpCode?: string, details?: PaymentConfirmation) => void;
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
    jobId, amount, email, phone, customerName, customerMobile, paymentMethod,
    onSuccess, onFailure, onCancel,
  }: PaymentOptions) => {
    setIsProcessing(true);

    const sendOtp = async (): Promise<boolean> => {
      try {
        const result = await supabase.functions.invoke('secure-otp', {
          body: { action: 'send', job_id: jobId, email },
        });
        if (result.error || !result.data?.success) {
          console.error('OTP request failed:', result.error ?? result.data?.error);
          return false;
        }
        return true;
      } catch (error) {
        console.error('OTP request failed:', error);
        return false;
      }
    };

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
      localStorage.setItem('printf_email', email);
      localStorage.setItem('printf_last_payment_method', paymentMethod);

      const { data, error } = await supabase.functions.invoke('create-order', {
        body: {
          job_id: jobId,
          amount,
          customer_name: customerName.trim(),
          customer_mobile: customerMobile.trim(),
          customer_email: email.trim().toLowerCase(),
          payment_method: paymentMethod,
          callback_url: window.location.origin + '/payment-callback',
        },
      });

      if (error || !data?.success) {
        console.error('Order creation error:', error ?? data);
        toast.error(data?.error || 'Failed to create your order. Please try again.');
        setIsProcessing(false);
        onFailure();
        return;
      }

      const orderNumber = data.order_number === undefined || data.order_number === null ? null : Number(data.order_number);
      if (data.print_order_id) localStorage.setItem('printf_print_order_id', data.print_order_id);
      if (orderNumber !== null) localStorage.setItem('printf_order_number', String(orderNumber));

      if (data.already_paid) {
        await sendOtp();
        toast.success('Order #' + (orderNumber ?? '') + ' is already recorded.');
        setIsProcessing(false);
        onSuccess(undefined, {
          payment_method: paymentMethod,
          order_number: orderNumber,
          amount,
          expires_in_seconds: 300,
        });
        return;
      }

      if (paymentMethod === 'cod' || data.payment_method === 'cod') {
        const otpSent = await sendOtp();
        if (otpSent) {
          toast.success('Order #' + (orderNumber ?? '') + ' placed. Verification code sent to email.');
        } else {
          toast.error('Order #' + (orderNumber ?? '') + ' was saved, but email OTP could not be sent. Use Resend OTP.');
        }
        setIsProcessing(false);
        onSuccess(undefined, {
          payment_method: 'cod',
          order_number: orderNumber,
          amount: Number(data.amount ?? amount),
          expires_in_seconds: 300,
        });
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
        prefill: { email, contact: phone || customerMobile },
        theme: { color: '#22c55e' },
        handler: async function (response: any) {
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
              return;
            }

            const otpSent = await sendOtp();
            if (otpSent) {
              toast.success('Payment successful! Your verification code was sent to email.');
            } else {
              toast.error('Payment is verified, but the OTP email could not be sent. Use Resend OTP.');
            }
            localStorage.removeItem('printf_payment_job_id');
            localStorage.removeItem('printf_order_id');
            localStorage.removeItem('printf_razorpay_order_id');
            onSuccess(undefined, {
              payment_method: 'razorpay',
              order_number: orderNumber,
              amount,
              expires_in_seconds: 300,
            });
          } catch (err) {
            console.error('Verification error:', err);
            toast.error('Payment verification failed');
            onFailure();
          } finally {
            setIsProcessing(false);
          }
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            toast.info('Payment cancelled');
            if (onCancel) onCancel();
          },
          escape: true,
          backdropclose: false,
          confirm_close: true,
        },
      };

      const razorpay = new window.Razorpay(razorpayOptions);
      razorpay.open();
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Checkout failed. Please try again.');
      setIsProcessing(false);
      onFailure();
    }
  }, [loadRazorpayScript]);

  return { initiatePayment, isProcessing };
}
