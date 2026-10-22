import { useEffect, useState } from 'react';
import { useRealtimeJob } from '@/hooks/useRealtimeJob';
import { cn } from '@/lib/utils';
import { CheckCircle, Clock, Printer, AlertCircle, Loader2 } from 'lucide-react';

interface JobStatusTrackerProps {
  jobId: string;
}

const statusConfig = {
  pending: {
    icon: Clock,
    label: 'Pending',
    description: 'Waiting for payment',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  ready: {
    icon: CheckCircle,
    label: 'Ready',
    description: 'Ready to print at PrintF',
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  printing: {
    icon: Printer,
    label: 'Printing',
    description: 'Your document is printing',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  completed: {
    icon: CheckCircle,
    label: 'Completed',
    description: 'Print job completed',
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  failed: {
    icon: AlertCircle,
    label: 'Failed',
    description: 'Print job failed',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
  expired: {
    icon: Clock,
    label: 'Expired',
    description: 'Job has expired',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
};

export function JobStatusTracker({ jobId }: JobStatusTrackerProps) {
  const { job, isSubscribed } = useRealtimeJob(jobId);
  const [prevStatus, setPrevStatus] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (job?.status && job.status !== prevStatus) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 500);
      setPrevStatus(job.status);
    }
  }, [job?.status, prevStatus]);

  if (!job) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const config = statusConfig[job.status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <div className={cn(
      'rounded-2xl p-6 transition-all duration-300',
      config.bgColor,
      isAnimating && 'scale-105'
    )}>
      <div className="flex items-center gap-4">
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center',
          config.bgColor
        )}>
          <Icon className={cn('w-6 h-6', config.color)} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className={cn('font-semibold', config.color)}>
              {config.label}
            </h3>
            {isSubscribed && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                Live
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{config.description}</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mt-6 flex items-center justify-between">
        {['pending', 'ready', 'printing', 'completed'].map((step, index) => {
          const stepIndex = ['pending', 'ready', 'printing', 'completed'].indexOf(job.status);
          const isCompleted = index <= stepIndex;
          const isCurrent = step === job.status;

          return (
            <div key={step} className="flex items-center flex-1">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors',
                isCompleted ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                isCurrent && 'ring-2 ring-primary ring-offset-2'
              )}>
                {index + 1}
              </div>
              {index < 3 && (
                <div className={cn(
                  'flex-1 h-0.5 mx-2 transition-colors',
                  isCompleted && index < stepIndex ? 'bg-primary' : 'bg-muted'
                )} />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>Pending</span>
        <span>Ready</span>
        <span>Printing</span>
        <span>Done</span>
      </div>
    </div>
  );
}
