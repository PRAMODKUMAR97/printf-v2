import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PrintJob, PrintSettings } from '@/types/printf';

// Customer job details are read through the short-lived, verified-email access token.
// Direct table reads/realtime subscriptions are intentionally avoided because customer
// access to print_jobs is restricted by RLS.
export function useRealtimeJob(jobId: string | null) {
  const [job, setJob] = useState<PrintJob | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    setJob(null);
    setIsSubscribed(false);
    if (!jobId) return;

    let cancelled = false;
    let fetching = false;
    let timer: number | undefined;

    const pollStatus = async () => {
      if (fetching || cancelled) return;
      fetching = true;
      let continuePolling = true;
      try {
        let accessToken = window.localStorage.getItem('printf_job_access_token');

        // Recover gracefully if OTP succeeded but issuing the token was interrupted.
        if (!accessToken) {
          const email = window.localStorage.getItem('printf_customer_email') || '';
          if (email) {
            const issued = await supabase.functions.invoke('secure-job', {
              body: { action: 'issue', job_id: jobId, email: email.trim().toLowerCase() },
            });
            if (!issued.error && issued.data?.success && typeof issued.data.access_token === 'string') {
              accessToken = issued.data.access_token;
              window.localStorage.setItem('printf_job_access_token', accessToken);
            }
          }
        }

        if (!accessToken) {
          if (!cancelled) setIsSubscribed(false);
          return;
        }

        const { data, error } = await supabase.functions.invoke('secure-job', {
          body: { action: 'status', access_token: accessToken },
        });
        if (cancelled) return;
        if (error || !data?.job) {
          setIsSubscribed(false);
          return;
        }

        const incoming = data.job as Record<string, unknown>;
        const nextStatus = String(incoming.status || 'pending') as PrintJob['status'];
        const nextJob: PrintJob = {
          id: String(incoming.id || jobId),
          printf_id: null,
          file_name: String(incoming.file_name || ''),
          file_size: 0,
          settings_json: (incoming.settings_json || {}) as PrintSettings,
          status: nextStatus,
          locked: incoming.locked === true,
          expiry_time: String(incoming.expiry_time || ''),
          created_at: String(incoming.created_at || ''),
          updated_at: String(incoming.updated_at || ''),
        };
        setJob(nextJob);
        setIsSubscribed(true);
        continuePolling = !['completed', 'failed', 'expired'].includes(nextStatus);
      } catch (error) {
        if (!cancelled) {
          setIsSubscribed(false);
          console.error('Unable to refresh secure print-job status:', error);
        }
      } finally {
        fetching = false;
        if (!cancelled && continuePolling) {
          timer = window.setTimeout(() => { void pollStatus(); }, 4000);
        }
      }
    };

    void pollStatus();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [jobId]);

  return { job, isSubscribed };
}
