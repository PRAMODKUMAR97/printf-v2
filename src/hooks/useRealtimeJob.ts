import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PrintJob, PrintSettings } from '@/types/printf';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtimeJob(jobId: string | null) {
  const [job, setJob] = useState<PrintJob | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    let channel: RealtimeChannel;

    const setupSubscription = async () => {
      // Fetch initial job data
      const { data } = await supabase
        .from('print_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      
      if (data) {
        setJob({
          ...data,
          settings_json: data.settings_json as unknown as PrintSettings,
          status: data.status as PrintJob['status'],
        });
      }

      // Subscribe to realtime changes
      channel = supabase
        .channel(`job-${jobId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'print_jobs',
            filter: `id=eq.${jobId}`,
          },
          (payload) => {
            const updatedJob = payload.new as any;
            setJob({
              ...updatedJob,
              settings_json: updatedJob.settings_json as PrintSettings,
              status: updatedJob.status as PrintJob['status'],
            });
          }
        )
        .subscribe((status) => {
          setIsSubscribed(status === 'SUBSCRIBED');
        });
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [jobId]);

  return { job, isSubscribed };
}
