import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

declare global {
  interface RazorpayResponse {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }
  interface RazorpayOptions {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    prefill: { name: string; contact: string };
    theme: { color: string };
    handler: (response: RazorpayResponse) => void | Promise<void>;
    modal: { ondismiss: () => void; escape: boolean; backdropclose: boolean; confirm_close: boolean };
  }
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

export type CheckoutPaymentMethod = 'razorpay' | 'cod';

export interface PaymentCompletion {
  payment_method: CheckoutPaymentMethod;
  order_number: number | null;
  print_order_id: string | null;
  amount: number;
  customer_name: string;
  customer_mobile: string;
  manual_fulfilment: boolean;
  delivery_otp_sent: boolean;
}

interface PaymentOptions {
  jobId: string;
  amount: number;
  customerName: string;
  customerMobile: string;
  paymentMethod: CheckoutPaymentMethod;
  manualFulfilment?: boolean;
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
    jobId, amount, customerName, customerMobile, paymentMethod, manualFulfilment = false,
    onSuccess, onFailure, onCancel,
  }: PaymentOptions) => {
    setIsProcessing(true);
    const orderCustomer = {
      customer_name: customerName.trim(),
      customer_mobile: customerMobile.trim(),
    };

    const sendDeliveryOtp = async (printOrderId: string | null) => {
      if (!printOrderId) return false;
      const { data: sms, error: smsError } = await supabase.functions.invoke('delivery-otp', {
        body: { action: 'send', order_id: printOrderId },
      });
      if (smsError || !sms?.success) {
        console.error('Delivery SMS error:', smsError ?? sms);
        toast.error(sms?.error || 'Your order was placed, but we could not send the delivery SMS. Please try again from the order screen.');
        return false;
      }
      return true;
    };

    const complete = (method: CheckoutPaymentMethod, orderNumber: number | null, printOrderId: string | null, actualAmount: number, deliveryOtpSent: boolean) => {
      onSuccess({
        payment_method: method,
        order_number: orderNumber,
        print_order_id: printOrderId,
        amount: actualAmount,
        ...orderCustomer,
        manual_fulfilment: manualFulfilment,
        delivery_otp_sent: deliveryOtpSent,
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

      const { data, error } = await supabase.functions.invoke('create-order', {
        body: {
          job_id: jobId,
          amount,
          customer_name: orderCustomer.customer_name,
          customer_mobile: orderCustomer.customer_mobile,
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
        const savedMethod: CheckoutPaymentMethod = data.payment_method === 'cod' ? 'cod' : 'razorpay';
        const savedAmount = Number(data.amount ?? amount);
        toast.success('Order #' + (orderNumber ?? '') + ' is already recorded as paid.');
        setIsProcessing(false);
        const smsSent = await sendDeliveryOtp(data.print_order_id ?? null);
        complete(savedMethod, orderNumber, data.print_order_id ?? null, savedAmount, smsSent);
        return;
      }

      if (paymentMethod === 'cod' || data.payment_method === 'cod') {
        const smsSent = await sendDeliveryOtp(data.print_order_id ?? null);
        toast.success(smsSent ? 'Order #' + (orderNumber ?? '') + ' placed. The delivery OTP was sent by SMS.' : 'Order #' + (orderNumber ?? '') + ' placed.');
        setIsProcessing(false);
        complete('cod', orderNumber, data.print_order_id ?? null, confirmedAmount, smsSent);
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
        prefill: { name: customerName.trim(), contact: customerMobile.trim() },
        theme: { color: '#22c55e' },
        handler: async (response) => {
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

            const printOrderId = verification.print_order_id ?? data.print_order_id ?? null;
            const smsSent = await sendDeliveryOtp(printOrderId);
            toast.success(smsSent ? 'Payment verified. Your delivery OTP was sent by SMS.' : 'Payment verified. Your order is in the delivery queue.');
            localStorage.removeItem('printf_order_id');
            localStorage.removeItem('printf_razorpay_order_id');
            complete('razorpay', orderNumber, printOrderId, amount, smsSent);
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
