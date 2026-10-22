import { useState, useEffect, forwardRef, useCallback } from 'react';
import { Search, MapPin, Crosshair, QrCode, Printer, RefreshCw, WifiOff, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Printf } from '@/types/printf';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PrintfFinderProps {
  onPrintfSelect: (printf: Printf) => void;
  onScanQR: () => void;
}

interface PrintfWithDistance extends Printf {
  distance?: number;
}

export const PrintfFinder = forwardRef<HTMLDivElement, PrintfFinderProps>(function PrintfFinder({ onPrintfSelect, onScanQR }, ref) {
  const [searchQuery, setSearchQuery] = useState('');
  const [printfs, setPrintfs] = useState<PrintfWithDistance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Fetch printfs from database
  const fetchPrintfs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('printfs_public')
        .select('*')
        .eq('status', 'online')
        .order('name');

      if (fetchError) throw fetchError;
      setPrintfs((data || []) as PrintfWithDistance[]);
      
      if (data && data.length === 0) {
        // No printers found but no error
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching PrintFs:', err);
      setError('Unable to load printers. Please check your connection.');
      toast.error('Failed to load printers');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrintfs();
  }, [fetchPrintfs]);

  // Get user's current location
  const getUserLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        toast.success('Location found! Showing nearest PrintFs');
        setIsGettingLocation(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast.error('Unable to get your location. Please search manually.');
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Filter printfs based on search
  const filteredPrintfs = printfs.filter((printf) => {
    const query = searchQuery.toLowerCase();
    return (
      printf.name.toLowerCase().includes(query) ||
      printf.location.toLowerCase().includes(query)
    );
  });

  const handleRetry = () => {
    fetchPrintfs();
    toast.info('Refreshing printer list...');
  };

  return (
    <div ref={ref} className="w-full max-w-2xl mx-auto">
      {/* Search Bar */}
      <div className="flex items-center gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search store location"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 rounded-xl border-border bg-card"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-xl flex-shrink-0"
          onClick={handleRetry}
          disabled={isLoading}
          title="Refresh list"
        >
          <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-xl flex-shrink-0"
          onClick={getUserLocation}
          disabled={isGettingLocation}
          title="Use my location"
        >
          {isGettingLocation ? (
            <span className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
          ) : (
            <Crosshair className="w-5 h-5" />
          )}
        </Button>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="text-center py-12">
          <span className="w-8 h-8 border-2 border-success/30 border-t-success rounded-full animate-spin inline-block" />
          <p className="text-muted-foreground mt-4">Finding nearby PrintFs...</p>
        </div>
      ) : error ? (
        /* Error State */
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-6 bg-destructive/10 rounded-full flex items-center justify-center">
            <WifiOff className="w-10 h-10 text-destructive" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2 font-display">
            Connection Error
          </h3>
          <p className="text-muted-foreground max-w-sm mx-auto mb-6">
            {error}
          </p>
          <Button
            onClick={handleRetry}
            className="bg-primary hover:bg-primary/90"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      ) : filteredPrintfs.length > 0 ? (
        <div className="space-y-3">
          {filteredPrintfs.map((printf) => (
            <button
              key={printf.id}
              className="w-full flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-success hover:bg-success/5 transition-all text-left"
              onClick={() => onPrintfSelect(printf)}
            >
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
                <Printer className="w-6 h-6 text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{printf.name}</p>
                <p className="text-sm text-muted-foreground truncate">{printf.location}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  printf.status === 'online' ? 'bg-success' : 'bg-muted'
                )} />
                <span className="capitalize">{printf.status}</span>
              </div>
            </button>
          ))}
        </div>
      ) : searchQuery ? (
        /* No search results */
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">No PrintFs found for "{searchQuery}"</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSearchQuery('')}
          >
            Clear Search
          </Button>
        </div>
      ) : (
        /* No printers available */
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-6 bg-muted/50 rounded-full flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2 font-display">
            No Printers Available
          </h3>
          <p className="text-muted-foreground max-w-sm mx-auto mb-6">
            There are no PrintF printers online at the moment. Try again later or scan a QR code directly.
          </p>
          <Button
            onClick={handleRetry}
            variant="outline"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      )}

      {/* Scan QR Button - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
        <Button
          className={cn(
            'w-full h-14 rounded-xl text-lg font-semibold',
            'bg-success hover:bg-success/90 text-success-foreground'
          )}
          onClick={onScanQR}
        >
          <QrCode className="w-5 h-5 mr-2" />
          Scan QR
        </Button>
      </div>

      {/* Spacer for fixed button */}
      <div className="h-24" />
    </div>
  );
});
