import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { X, Camera, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QRScannerProps {
  onScan: (printfId: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMounted = useRef(true);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // SCANNING state
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.log('Scanner stop error (ignored):', e);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    if (!isMounted.current) return;
    
    try {
      setError(null);
      setHasPermission(null);

      // Request camera permission first
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        stream.getTracks().forEach(track => track.stop());
        setHasPermission(true);
      } catch (permErr: any) {
        setHasPermission(false);
        if (permErr.name === 'NotAllowedError') {
          setError('Camera access denied. Please allow camera access in your browser settings.');
        } else if (permErr.name === 'NotFoundError') {
          setError('No camera found on this device.');
        } else {
          setError('Could not access camera. Please check your permissions.');
        }
        return;
      }

      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!isMounted.current) return;

      const html5QrCode = new Html5Qrcode('qr-reader', { verbose: false });
      scannerRef.current = html5QrCode;

      setIsScanning(true);

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1,
        },
        (decodedText) => {
          if (!isMounted.current) return;
          
          // Parse the QR code - expecting format: printf:<id> or just the ID
          let printfId = decodedText;
          if (decodedText.startsWith('printf:')) {
            printfId = decodedText.replace('printf:', '');
          }
          
          // Validate UUID format
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (uuidRegex.test(printfId)) {
            stopScanner();
            onScan(printfId);
          }
        },
        () => {
          // QR code not detected - silent
        }
      );
    } catch (err: any) {
      console.error('QR Scanner error:', err);
      if (isMounted.current) {
        setIsScanning(false);
        setError('Failed to start camera. Please try again.');
      }
    }
  }, [onScan, stopScanner]);

  useEffect(() => {
    isMounted.current = true;
    startScanner();
    
    return () => {
      isMounted.current = false;
      stopScanner();
    };
  }, [startScanner, stopScanner]);

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background animate-fade-in">
      <div className="container mx-auto px-4 py-6 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Scan QR Code</h2>
              <p className="text-sm text-muted-foreground">Point camera at PrintF QR</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={handleClose}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Scanner Area */}
        <div className="flex-1 flex items-center justify-center">
          <div className="relative w-full max-w-sm">
            {/* Scanner Container */}
            <div 
              className={cn(
                "relative aspect-square rounded-2xl overflow-hidden",
                error ? "bg-muted" : "bg-black"
              )}
            >
              <div id="qr-reader" className="w-full h-full" style={{ border: 'none' }} />
              
              {/* Scanning overlay */}
              {isScanning && !error && (
                <div className="absolute inset-0 pointer-events-none">
                  {/* Corner brackets */}
                  <div className="absolute top-6 left-6 w-12 h-12 border-l-4 border-t-4 border-success rounded-tl-lg" />
                  <div className="absolute top-6 right-6 w-12 h-12 border-r-4 border-t-4 border-success rounded-tr-lg" />
                  <div className="absolute bottom-6 left-6 w-12 h-12 border-l-4 border-b-4 border-success rounded-bl-lg" />
                  <div className="absolute bottom-6 right-6 w-12 h-12 border-r-4 border-b-4 border-success rounded-br-lg" />
                  
                  {/* Scan line animation */}
                  <div className="absolute left-6 right-6 h-0.5 bg-success/80 animate-scan-line" />
                </div>
              )}

              {/* Loading state */}
              {hasPermission === null && !error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
                  <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                  <p className="text-muted-foreground text-sm">Accessing camera...</p>
                </div>
              )}

              {/* Error state */}
              {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-muted">
                  <Camera className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-sm mb-4">{error}</p>
                  <Button
                    variant="outline"
                    onClick={startScanner}
                  >
                    Try Again
                  </Button>
                </div>
              )}
            </div>

            {/* Instructions */}
            {isScanning && !error && (
              <p className="text-center text-sm text-muted-foreground mt-6">
                Position the QR code within the frame
              </p>
            )}
          </div>
        </div>

        {/* Cancel Button */}
        <Button
          variant="outline"
          className="w-full h-14 rounded-xl text-lg"
          onClick={handleClose}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
