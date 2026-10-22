import { PaymentScreen } from '@/components/printf/PaymentScreen';
import { PaymentSummarySkeleton } from '@/components/printf/loading/Skeletons';
import { usePrintFlow } from '@/components/printf/flow/PrintFlowContext';
const PaymentPage = () => {
  const { job, amount, selectedPrinter, setStep, handlePaymentSuccess } = usePrintFlow();
  if (!job) return <div className="container mx-auto px-6 py-14"><PaymentSummarySkeleton /></div>;
  return <div className="container mx-auto px-6 py-14"><PaymentScreen job={job} amount={amount} printerName={selectedPrinter?.name} printerLocation={selectedPrinter?.location} onBack={() => setStep('settings')} onSuccess={handlePaymentSuccess} /></div>;
};
export default PaymentPage;
