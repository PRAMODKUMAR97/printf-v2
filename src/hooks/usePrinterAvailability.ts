import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const ONLINE_WINDOW_MS = 15_000;
const CHECK_INTERVAL_MS = 5_000;

/** Watches a selected station's heartbeat throughout the print flow. */
export function usePrinterAvailability(printfId: string | null, enabled = true) {
  const [isOffline, setIsOffline] = useState(false);
  useEffect(() => {
    if (!printfId || !enabled) { setIsOffline(false); return; }
    let cancelled = false;
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      const { data, error } = await supabase.from('printfs_public').select('id,status,last_seen').eq('id', printfId).maybeSingle();
      if (cancelled || error) return;
      const fresh = !!data && data.status === 'online' && !!data.last_seen && Date.now() - new Date(data.last_seen).getTime() < ONLINE_WINDOW_MS;
      setIsOffline(!fresh);
    };
    void check();
    const intervalId = window.setInterval(check, CHECK_INTERVAL_MS);
    window.addEventListener('focus', check);
    return () => { cancelled = true; window.clearInterval(intervalId); window.removeEventListener('focus', check); };
  }, [printfId, enabled]);
  return isOffline;
}
