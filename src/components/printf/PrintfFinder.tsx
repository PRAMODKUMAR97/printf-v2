import { forwardRef, useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowUpRight, Crosshair, QrCode, RefreshCw, Search, WifiOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Printf } from '@/types/printf';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { isManualFulfilmentStation, isStationOrderable } from '@/lib/printfAvailability';

interface PrintfFinderProps {
  onPrintfSelect: (printf: Printf) => void;
  onScanQR: () => void;
}

interface PrintfWithDistance extends Printf {
  distance?: number;
}

export const PrintfFinder = forwardRef<HTMLDivElement, PrintfFinderProps>(function PrintfFinder(
  { onPrintfSelect, onScanQR },
  ref,
) {
  const [searchQuery, setSearchQuery] = useState('');
  const [printfs, setPrintfs] = useState<PrintfWithDistance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const fetchPrintfs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('printfs_public')
        .select('*')
        .order('name');

      if (fetchError) throw fetchError;

      // Canara Engineering College accepts manual print orders all day, even while
      // the printer computer is not sending a live heartbeat.
      setPrintfs(((data || []) as PrintfWithDistance[]).filter(isStationOrderable));
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

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        toast.success('Location found! Search for the closest PrintF station.');
        setIsGettingLocation(false);
      },
      (locationError) => {
        console.error('Geolocation error:', locationError);
        toast.error('Unable to get your location. Please search manually.');
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

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
    <div ref={ref} className="mx-auto w-full max-w-3xl">
      <div className="mb-10 max-w-xl animate-rise">
        <p className="eyebrow">Step one</p>
        <h1 className="mt-3 font-display text-display-sm text-foreground balance">
          Choose a station <span className="italic text-muted-foreground">near you</span>
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Every PrintF station reports its own status. Pick one from the live list, or scan the
          code printed on the machine in front of you.
        </p>
      </div>

      <div className="mb-8 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name or location"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-12 rounded-xl pl-11"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 shrink-0 rounded-xl"
          onClick={handleRetry}
          disabled={isLoading}
          title="Refresh list"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 shrink-0 rounded-xl"
          onClick={getUserLocation}
          disabled={isGettingLocation}
          title="Use my location"
        >
          {isGettingLocation ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
          ) : (
            <Crosshair className="h-4 w-4" />
          )}
        </Button>
      </div>

      {isLoading ? (
        <div className="panel px-6 py-16 text-center">
          <span className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-success/30 border-t-success" />
          <p className="mt-4 text-sm text-muted-foreground">Finding nearby PrintF stations...</p>
        </div>
      ) : error ? (
        <div className="panel px-6 py-16 text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5">
            <WifiOff className="h-6 w-6 text-destructive" />
          </div>
          <h3 className="font-display text-2xl text-foreground">Connection lost</h3>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{error}</p>
          <Button onClick={handleRetry} className="mt-7">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      ) : filteredPrintfs.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-elev-1">
          {filteredPrintfs.map((printf, index) => {
            const manualOrderStation = isManualFulfilmentStation(printf);

            return (
              <button
                key={printf.id}
                className={cn(
                  'accent-rule group flex w-full items-center gap-5 px-6 py-5 text-left transition-colors duration-300',
                  'hover:bg-surface-sunken',
                  index !== 0 && 'border-t border-border',
                )}
                onClick={() => onPrintfSelect(printf)}
                style={{ animationDelay: `${index * 45}ms` }}
              >
                <span className="w-6 shrink-0 text-xs tabular-nums tracking-[0.08em] text-muted-foreground/70">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium tracking-[-0.01em] text-foreground">
                    {printf.name}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {manualOrderStation
                      ? 'Orders accepted 24/7 · College delivery within 24 hours'
                      : printf.location}
                  </p>
                </div>
                <span className="hidden items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground sm:flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {manualOrderStation ? 'Open 24/7' : 'Online'}
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all duration-300 ease-out-soft group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
              </button>
            );
          })}
        </div>
      ) : searchQuery ? (
        <div className="panel px-6 py-16 text-center">
          <Search className="mx-auto mb-5 h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nothing matches “{searchQuery}”</p>
          <Button variant="outline" size="sm" className="mt-6" onClick={() => setSearchQuery('')}>
            Clear search
          </Button>
        </div>
      ) : (
        <div className="panel px-6 py-16 text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-sunken">
            <AlertCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-display text-2xl text-foreground">No stations online</h3>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Nothing is reporting in right now. Refresh in a moment, or scan the code on a
            machine directly.
          </p>
          <Button onClick={handleRetry} variant="outline" className="mt-7">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      )}

      <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-background via-background/95 to-transparent px-6 pb-6 pt-12">
        <div className="pointer-events-auto mx-auto max-w-3xl">
          <Button variant="secondary" className="h-14 w-full rounded-xl text-base" onClick={onScanQR}>
            <QrCode className="mr-2 h-5 w-5" />
            Scan station code
          </Button>
        </div>
      </div>

      <div className="h-28" />
    </div>
  );
});
