import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PrintJob, PrintSettings } from '@/types/printf';

const STATUS_POLL_MS = 5000;

/**
 * Polls the server-side job-status function instead of selecting print_jobs
 * directly from the browser. The function returns a safe projection that omits
 * the private storage path; polling also works when anonymous table SELECT /
 * Realtime access is intentionally restricted by RLS.
 */
export function useRealtimeJob(jobId: string | null) {
  const [job, setJob] = useState<PrintJob | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setIsSubscribed(false);
      return;
    }

    let active = true;
    let inFlight = false;

    const refreshJob = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const { data, error } = await supabase.functions.invoke('job-status', {
          body: { job_id: jobId },
        });
        if (!active) return;
        if (error || !data?.job || data.job.id !== jobId) {
          setIsSubscribed(false);
          return;
        }

        const safeJob = data.job as Record<string, unknown>;
        const mapped: PrintJob = {
          id: String(safeJob.id),
          printf_id: typeof safeJob.printf_id === 'string' ? safeJob.printf_id : null,
          file_name: String(safeJob.file_name ?? ''),
          file_size: Number(safeJob.file_size ?? 0),
          settings_json: safeJob.settings_json as PrintSettings,
          status: safeJob.status as PrintJob['status'],
          locked: Boolean(safeJob.locked),
          expiry_time: String(safeJob.expiry_time ?? ''),
          created_at: String(safeJob.created_at ?? ''),
          updated_at: String(safeJob.updated_at ?? ''),
        };

        setJob((previous) => {
          if (previous && previous.id === mapped.id && previous.updated_at === mapped.updated_at && previous.status === mapped.status) {
            return previous;
          }
          return mapped;
        });
        setIsSubscribed(true);
      } catch (error) {
        if (active) {
          console.error('Could not refresh print job status:', error);
          setIsSubscribed(false);
        }
      } finally {
        inFlight = false;
      }
    };

    void refreshJob();
    const timer = window.setInterval(() => void refreshJob(), STATUS_POLL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [jobId]);

  return { job, isSubscribed };
}
