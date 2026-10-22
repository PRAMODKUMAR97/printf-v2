import { PrintfFinder } from '@/components/printf/PrintfFinder';
import { usePrintFlow } from '@/components/printf/flow/PrintFlowContext';
import { Printf } from '@/types/printf';
import { toast } from 'sonner';

const PrintersPage = () => {
  const { selectPrintf, setSelectedPrinter, setShowQRScanner } = usePrintFlow();
  const handlePrintfSelect = (printf: Printf) => {
    setSelectedPrinter(printf);
    selectPrintf(printf.id);
    toast.success(`Selected ${printf.name}`);
  };
  return <div className="container mx-auto px-6 py-14"><PrintfFinder onPrintfSelect={handlePrintfSelect} onScanQR={() => setShowQRScanner(true)} /></div>;
};
export default PrintersPage;
