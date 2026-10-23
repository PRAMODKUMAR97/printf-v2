import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Header } from '@/components/printf/Header';
import { QRScanner } from '@/components/printf/QRScanner';
import { PrintFlowProvider, usePrintFlow } from '@/components/printf/flow/PrintFlowContext';
import { UploadStep, Printf } from '@/types/printf';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePrinterAvailability } from '@/hooks/usePrinterAvailability';
import { isStationOrderable } from '@/lib/printfAvailability';

export const stepToPath: Record<UploadStep, string> = {
  printf: '/printers', upload: '/upload', processing: '/processing', settings: '/settings', phone: '/payment', payment: '/payment', otp: '/verify-otp', status: '/status',
};
const FlowShell = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { step, job, selectPrintf, setSelectedPrinter, selectedPrinter, selectedPrintfId, showQRScanner, setShowQRScanner, reset } = usePrintFlow();
  useEffect(() => {
    const target = stepToPath[step];
    if (location.pathname !== target) navigate(target, { replace: true });
  }, [step, location.pathname, navigate]);

  const monitorEnabled = step !== 'printf';
  const stationOffline = usePrinterAvailability(selectedPrintfId, monitorEnabled);
  const warnedRef = useRef(false);
  useEffect(() => {
    if (!monitorEnabled || !stationOffline || (selectedPrinter && isStationOrderable(selectedPrinter))) {
      // Allow a new notification if the same station later goes offline again.
      warnedRef.current = false;
      return;
    }
    if (warnedRef.current) return;
    warnedRef.current = true;
    const name = selectedPrinter?.name ?? 'The selected station';
    if (job?.id) {
      // Don't discard a paid/in-progress order if its station temporarily loses power or Wi-Fi.
      // The job remains in Supabase and the station agent can pick it up when it reconnects.
      toast.error(`${name} is offline. Your saved print job will remain queued while the station reconnects.`);
      return;
    }
    toast.error(`${name} went offline. Please choose another station.`);
    setSelectedPrinter(null);
    reset();
  }, [stationOffline, monitorEnabled, step, job?.id, selectedPrinter, setSelectedPrinter, reset]);

  const handleQRScan = async (printfId: string) => {
    setShowQRScanner(false);
    const { data: printf, error } = await supabase.from('printfs_public').select('*').eq('id', printfId).single();
    if (error || !printf) { toast.error('PrintF not found. Please try again.'); return; }
    if (!isStationOrderable(printf)) { toast.error(`${printf.name} is currently unavailable. Please try again later.`); return; }
    setSelectedPrinter(printf as Printf);
    selectPrintf(printfId);
    toast.success(`Connected to ${printf.name}`);
  };
  return (
    <>
      <div className="min-h-screen bg-background">
        <Header />
        <main className="ambient-canvas pt-24"><Outlet /></main>
        {step !== 'printf' && <footer className="border-t border-border"><div className="container mx-auto flex flex-col items-center justify-between gap-3 px-6 py-8 sm:flex-row"><span className="font-display text-lg text-foreground">PrintF</span><p className="text-xs text-muted-foreground">© {new Date().getFullYear()} PrintF — self-service cloud printing.</p></div></footer>}
      </div>
      {showQRScanner && <QRScanner onScan={handleQRScan} onClose={() => setShowQRScanner(false)} />}
    </>
  );
};
const FlowLayout = () => <PrintFlowProvider><FlowShell /></PrintFlowProvider>;
export default FlowLayout;
