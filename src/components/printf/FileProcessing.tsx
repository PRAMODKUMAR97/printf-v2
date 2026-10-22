import { useEffect, useState } from 'react';
import { FileSearch, FileText, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ProcessingStage = 'verifying' | 'processing' | 'completed';

interface FileProcessingProps {
  stage: ProcessingStage;
  progress: number;
  fileName: string;
  pageCount?: number;
}
const stages = [
  { id: 'verifying', label: 'Verifying file', icon: FileSearch },
  { id: 'processing', label: 'Processing pages', icon: FileText },
  { id: 'completed', label: 'Upload complete', icon: Check },
] as const;

export function FileProcessing({ stage, progress, fileName, pageCount }: FileProcessingProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedProgress(progress), 100);
    return () => clearTimeout(timer);
  }, [progress]);
  const currentIndex = stages.findIndex((s) => s.id === stage);

  return (
    <div className="mx-auto w-full max-w-xl animate-rise">
      <div className="panel-raised overflow-hidden">
        <div className="flex items-center gap-4 border-b border-border px-7 py-6">
          <div className="relative h-11 w-9 flex-shrink-0">
            <span className="absolute inset-0 rotate-[6deg] rounded-md border border-border bg-card" />
            <span className="absolute inset-0 flex items-end justify-center rounded-md border border-border bg-card shadow-elev-1">
              <FileText className="mb-2 h-3.5 w-3.5 text-accent" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">{fileName}</p>
            <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
              {pageCount ? pageCount + ' page' + (pageCount > 1 ? 's' : '') + ' detected' : 'Reading document…'}
            </p>
          </div>
        </div>
        <div className="divide-y divide-border">
          {stages.map((s, index) => {
            const Icon = s.icon;
            const isActive = index === currentIndex;
            const isCompleted = index < currentIndex;
            const isPending = index > currentIndex;
            return (
              <div key={s.id} data-active={isActive} className={cn('accent-rule flex items-center gap-4 px-7 py-4 transition-opacity duration-500', isPending && 'opacity-40')}>
                <div className={cn('flex h-7 w-7 items-center justify-center rounded-full transition-all duration-500 ease-out-soft',
                  isActive && 'bg-foreground text-background', isCompleted && 'bg-accent/10 text-accent', isPending && 'bg-muted text-muted-foreground')}>
                  {isActive && stage !== 'completed' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
                    isCompleted || (isActive && stage === 'completed') ? <Check className="h-3.5 w-3.5" /> :
                    <Icon className="h-3.5 w-3.5" />}
                </div>
                <p className={cn('flex-1 text-sm transition-colors duration-500', isActive ? 'font-medium text-foreground' : 'text-muted-foreground')}>{s.label}</p>
                {isCompleted && <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-accent">Done</span>}
              </div>
            );
          })}
        </div>
        <div className="space-y-3 px-7 py-6">
          <div className="relative h-px w-full overflow-hidden bg-border">
            <span className="absolute inset-y-0 left-0 bg-accent transition-all duration-700 ease-out-soft" style={{ width: animatedProgress + '%' }} />
            {stage !== 'completed' && <span className="absolute inset-y-0 left-0 w-1/4 animate-sweep bg-gradient-to-r from-transparent via-accent/50 to-transparent" />}
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">{stage === 'completed' ? 'Ready' : 'Uploading'}</span>
            <span className="stat-number text-2xl text-foreground">{animatedProgress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
