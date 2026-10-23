import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export type CheckoutPaymentMethod = 'razorpay' | 'cod';

export interface PaymentCompletion {
  payment_method: CheckoutPaymentMethod;
  order_number: number | null;
  amount: number;
  customer_email: string;
  customer_name: string;
  customer_mobile: string;
  expires_in_seconds: number;
  otp_sent: boolean;
}

interface PaymentOptions {
  jobId: string;
  amount: number;
  customerName: string;
  customerMobile: string;
  customerEmail: string;
  paymentMethod: CheckoutPaymentMethod;
  onSuccess: (details: PaymentCompletion) => void;
  onFailure: () => void;
  onCancel?: () => void;
}

export function usePayment() {
  const [isProcessing, setIsProcessing] = useState(false);

  const loadRazorpayScript = useCallback((): Promise<boolean> => new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  }), []);

  const initiatePayment = useCallback(async ({
    jobId, amount, customerName, customerMobile, customerEmail, paymentMethod,
    onSuccess, onFailure, onCancel,
  }: PaymentOptions) => {
    setIsProcessing(true);
    const normalizedEmail = customerEmail.trim().toLowerCase();
    const orderCustomer = {
      customer_email: normalizedEmail,
      customer_name: customerName.trim(),
      customer_mobile: customerMobile.trim(),
    };

    const sendOtp = async (): Promise<{ sent: boolean; seconds: number }> => {
      try {
        const { data, error } = await supabase.functions.invoke('secure-otp', {
          body: { action: 'send', job_id: jobId, email: normalizedEmail },
        });
        if (error || !data?.success) {
          console.error('OTP send failed:', error ?? data?.error);
          toast.error(data?.error || 'Order saved, but the OTP email could not be sent. Use Resend OTP.');
          return { sent: false, seconds: 300 };
        }
        const seconds = Number(data.expires_in_seconds) || 300;
        window.localStorage.setItem('printf_otp_sent_job_id', jobId);
        window.localStorage.setItem('printf_otp_sent_email', normalizedEmail);
        window.localStorage.setItem('printf_otp_expires_at', String(Date.now() + seconds * 1000));
        return { sent: true, seconds };
      } catch (error) {
        console.error('OTP send failed:', error);
        toast.error('Order saved, but the OTP email could not be sent. Use Resend OTP.');
        return { sent: false, seconds: 300 };
      }
    };

    const complete = (method: CheckoutPaymentMethod, orderNumber: number | null, actualAmount: number, otp: {sent: boolean; seconds: number}) => {
      onSuccess({
        payment_method: method,
        order_number: orderNumber,
        amount: actualAmount,
        ...orderCustomer,
        expires_in_seconds: otp.seconds,
        otp_sent: otp.sent,
      });
    };

    try {
      if (paymentMethod === 'razorpay') {
        const loaded = await loadRazorpayScript();
        if (!loaded) {
          toast.error('Failed to load payment gateway');
          setIsProcessing(false);
          onFailure();
          return;
        }
      }

      localStorage.setItem('printf_payment_job_id', jobId);
      localStorage.setItem('printf_last_payment_method', paymentMethod);
      localStorage.setItem('printf_customer_email', normalizedEmail);

      const { data, error } = await supabase.functions.invoke('create-order', {
        body: {
          job_id: jobId,
          amount,
          customer_name: orderCustomer.customer_name,
          customer_mobile: orderCustomer.customer_mobile,
          customer_email: normalizedEmail,
          payment_method: paymentMethod,
          callback_url: window.location.origin + '/payment-callback',
        },
      });

      if (error || !data || data.success !== true) {
        console.error('Order creation error:', error ?? data);
        toast.error(data?.error || 'Failed to create your order. Please try again.');
        setIsProcessing(false);
        onFailure();
        return;
      }

      const orderNumber = data.order_number === undefined || data.order_number === null
        ? null : Number(data.order_number);
      const confirmedAmount = Number(data.amount ?? amount);
      if (data.print_order_id) localStorage.setItem('printf_print_order_id', data.print_order_id);
      if (orderNumber !== null) localStorage.setItem('printf_order_number', String(orderNumber));

      if (data.already_paid) {
        const otp = await sendOtp();
        toast.success('Order #' + (orderNumber ?? '') + ' is already recorded as paid.');
        setIsProcessing(false);
        complete(paymentMethod, orderNumber, amount, otp);
        return;
      }

      if (paymentMethod === 'cod' || data.payment_method === 'cod') {
        const otp = await sendOtp();
        if (otp.sent) {
          toast.success('Order #' + (orderNumber ?? '') + ' placed. Verification code sent to email.');
        } else {
          toast.error('Order #' + (orderNumber ?? '') + ' was saved. Resend the verification code before printing.');
        }
        setIsProcessing(false);
        complete('cod', orderNumber, confirmedAmount, otp);
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

      const razorpay = new window.Razorpay({
        key: data.key_id,
        amount: data.amount,
        currency: data.currency || 'INR',
        name: 'PrintF',
        description: 'Print Job Payment',
        order_id: data.order_id,
        prefill: { name: customerName.trim(), email: normalizedEmail, contact: customerMobile.trim() },
        theme: { color: '#22c55e' },
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
              console.error('Payment verification error:', verifyError ?? verification);
              toast.error(verification?.error || 'Payment verification failed. If charged, contact support before retrying.');
              onFailure();
              return;
            }

            const otp = await sendOtp();
            if (otp.sent) toast.success('Payment verified. Check your email for the print verification code.');
            else toast.error('Payment is verified. Resend the print verification code before printing.');
            localStorage.removeItem('printf_order_id');
            localStorage.removeItem('printf_razorpay_order_id');
            complete('razorpay', orderNumber, amount, otp);
          } catch (err) {
            console.error('Payment verification error:', err);
            toast.error('Payment verification failed. If charged, contact support.');
            onFailure();
          } finally {
            setIsProcessing(false);
          }
        },
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
      });
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
