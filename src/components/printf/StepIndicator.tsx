import { UploadStep } from '@/types/printf';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface StepIndicatorProps { currentStep: UploadStep; }

const steps = [
  { id: 'upload' as const, label: 'Upload' },
  { id: 'settings' as const, label: 'Settings' },
  { id: 'payment' as const, label: 'Payment' },
  { id: 'status' as const, label: 'Collect' },
];

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);
  return (
    <nav aria-label="Progress" className="mx-auto mb-12 w-full max-w-xl">
      <ol className="flex items-stretch">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = step.id === currentStep;
          return (
            <li key={step.id} className="flex-1">
              <div className="relative h-px w-full overflow-hidden bg-border">
                <span className={cn('absolute inset-y-0 left-0 bg-accent transition-all duration-[900ms] ease-out-soft', isCompleted || isCurrent ? 'w-full' : 'w-0')} />
              </div>
              <div className="flex items-center gap-2 pt-3">
                <span className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-full text-[0.5625rem] font-medium tabular-nums transition-all duration-500 ease-out-soft',
                  isCompleted && 'bg-accent text-accent-foreground',
                  isCurrent && 'bg-foreground text-background',
                  !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
                )}>{isCompleted ? <Check className="h-2.5 w-2.5" /> : index + 1}</span>
                <span className={cn('text-[0.6875rem] uppercase tracking-[0.12em] transition-colors duration-500', isCurrent ? 'text-foreground' : 'text-muted-foreground')}>{step.label}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
