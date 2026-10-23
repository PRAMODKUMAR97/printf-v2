import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Clock, FileText, Printer, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusSkeleton } from '@/components/printf/loading/Skeletons';
import { usePrintFlow } from '@/components/printf/flow/PrintFlowContext';
import { useRealtimeJob } from '@/hooks/useRealtimeJob';

const STATUS_CONFIG = {
  pending: { icon: Clock, title: 'Preparing your job', description: 'Confirming your payment with the station.', tone: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  ready: { icon: FileText, title: 'Queued for printing', description: 'The station has your job and will start shortly.', tone: 'text-accent', dot: 'bg-accent' },
  printing: { icon: Printer, title: 'Printing now', description: 'Your document is moving through the tray.', tone: 'text-accent', dot: 'bg-accent' },
  completed: { icon: CheckCircle2, title: 'Print complete', description: 'Collect your document from the tray.', tone: 'text-success', dot: 'bg-success' },
  failed: { icon: XCircle, title: 'Print failed', description: 'Nothing was charged twice. Start a new job to retry.', tone: 'text-destructive', dot: 'bg-destructive' },
  expired: { icon: Clock, title: 'Job expired', description: 'This job is no longer available. Start a new print.', tone: 'text-muted-foreground', dot: 'bg-muted-foreground' },
} as const;
const TIMELINE: Array<keyof typeof STATUS_CONFIG> = ['pending', 'ready', 'printing', 'completed'];

const StatusPage = () => {
  const { job: flowJob, selectedPrinter, reset, setIsPrinting } = usePrintFlow();
  const storedJobId = typeof window !== 'undefined' ? window.localStorage.getItem('printf_payment_job_id') : null;
  const [paymentMethod] = useState<'razorpay' | 'cod'>(() => typeof window !== 'undefined' && window.localStorage.getItem('printf_last_payment_method') === 'cod' ? 'cod' : 'razorpay');
  const [orderNumber] = useState<string | null>(() => typeof window !== 'undefined' ? window.localStorage.getItem('printf_order_number') : null);
  const { job: liveJob } = useRealtimeJob(flowJob?.id ?? storedJobId);
  const job = liveJob ?? flowJob;
  const status = (liveJob?.status ?? flowJob?.status ?? 'pending') as keyof typeof STATUS_CONFIG;
  useEffect(() => { setIsPrinting(status === 'printing'); }, [status, setIsPrinting]);

  if (!job) return <div className="container mx-auto px-6 py-14"><StatusSkeleton /></div>;
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = config.icon;
  const activeIndex = TIMELINE.indexOf(status);

  return (
    <div className="container mx-auto px-6 py-14">
      <div className="mx-auto w-full max-w-xl space-y-6 animate-rise">
        <div className="panel-raised overflow-hidden">
          <div className="border-b border-border px-7 py-6">
            <p className="eyebrow">Final step</p>
            <h1 className="mt-2 font-display text-3xl text-foreground">{paymentMethod === 'cod' ? 'Your order is placed' : 'Your print is on its way'}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {paymentMethod === 'cod'
                ? <>Order{orderNumber ? <> <span className="font-medium text-foreground">#{orderNumber}</span></> : ''} is queued at <span className="text-foreground">{selectedPrinter?.name ?? 'the station'}</span>. Please pay cash when collecting your print.</>
                : <>Payment confirmed — the job was released to <span className="text-foreground">{selectedPrinter?.name ?? 'the station'}</span> automatically.</>}
            </p>
          </div>
          <div className="flex items-start gap-4 px-7 py-6">
            <span className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-muted"><Icon className={cn('h-5 w-5', config.tone)} /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-2"><span className={cn('h-1.5 w-1.5 rounded-full animate-pulse', config.dot)} /><h2 className="font-display text-xl text-foreground">{config.title}</h2></div>
              <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
            </div>
          </div>
          <ol className="space-y-4 border-t border-border px-7 py-6">
            {TIMELINE.map((stage, index) => {
              const done = activeIndex >= 0 && index < activeIndex;
              const current = stage === status;
              return <li key={stage} className="flex items-center gap-3">
                <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[0.5625rem] tabular-nums transition-colors duration-500', done && 'bg-accent text-accent-foreground', current && 'bg-foreground text-background', !done && !current && 'bg-muted text-muted-foreground')}>{done ? <CheckCircle2 className="h-3 w-3" /> : index + 1}</span>
                <span className={cn('text-sm capitalize transition-colors duration-500', current ? 'text-foreground' : 'text-muted-foreground')}>{stage === 'completed' ? 'Collected' : stage}</span>
              </li>;
            })}
          </ol>
          <div className="border-t border-border px-7 py-5 space-y-3">
            {orderNumber && <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Order number</span><span className="pl-4 font-medium text-foreground">#{orderNumber}</span></div>}
            <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Payment</span><span className="pl-4 text-foreground">{paymentMethod === 'cod' ? 'Cash on Delivery · Pending collection' : 'Razorpay · Online'}</span></div>
            <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Document</span><span className="truncate pl-4 text-foreground">{job.file_name}</span></div>
          </div>
        </div>
        <Button variant="outline" size="lg" className="w-full" onClick={reset}>Start a new print</Button>
      </div>
    </div>
  );
};
export default StatusPage;
