import { createContext, useContext, useState, ReactNode } from 'react';
import { usePrintJob } from '@/hooks/usePrintJob';
import { Printf } from '@/types/printf';

type PrintJobApi = ReturnType<typeof usePrintJob>;
interface PrintFlowValue extends PrintJobApi {
  selectedPrinter: Printf | null;
  setSelectedPrinter: (printf: Printf | null) => void;
  isPrinting: boolean;
  setIsPrinting: (v: boolean) => void;
  showQRScanner: boolean;
  setShowQRScanner: (v: boolean) => void;
}
const PrintFlowContext = createContext<PrintFlowValue | null>(null);
export const PrintFlowProvider = ({ children }: { children: ReactNode }) => {
  const printJob = usePrintJob();
  const [selectedPrinter, setSelectedPrinter] = useState<Printf | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  return <PrintFlowContext.Provider value={{ ...printJob, selectedPrinter, setSelectedPrinter, isPrinting, setIsPrinting, showQRScanner, setShowQRScanner }}>{children}</PrintFlowContext.Provider>;
};
export const usePrintFlow = () => {
  const ctx = useContext(PrintFlowContext);
  if (!ctx) throw new Error('usePrintFlow must be used inside PrintFlowProvider');
  return ctx;
};
