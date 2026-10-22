import { useEffect, useState } from 'react';
import { FileSearch, FileText, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

export type ProcessingStage = 'verifying' | 'processing' | 'completed';

interface FileProcessingProps {
  stage: ProcessingStage;
  progress: number;
  fileName: string;
  pageCount?: number;
}

const stages = [
  { id: 'verifying', label: 'Verifying Files', icon: FileSearch },
  { id: 'processing', label: 'Processing Files', icon: FileText },
  { id: 'completed', label: 'Uploaded Successfully', icon: CheckCircle },
] as const;

export function FileProcessing({ stage, progress, fileName, pageCount }: FileProcessingProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedProgress(progress), 100);
    return () => clearTimeout(timer);
  }, [progress]);

  const getCurrentStageIndex = () => {
    return stages.findIndex(s => s.id === stage);
  };

  const currentIndex = getCurrentStageIndex();

  return (
    <div className="w-full max-w-md mx-auto space-y-6 animate-fade-in">
      <div className="bg-card border border-border rounded-2xl p-6 shadow-lg space-y-6">
        {/* File info */}
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
            <FileText className="w-6 h-6 text-secondary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{fileName}</p>
            {pageCount && (
              <p className="text-sm text-muted-foreground">
                {pageCount} page{pageCount > 1 ? 's' : ''} detected
              </p>
            )}
          </div>
        </div>

        {/* Processing stages */}
        <div className="space-y-4">
          {stages.map((s, index) => {
            const Icon = s.icon;
            const isActive = index === currentIndex;
            const isCompleted = index < currentIndex;
            const isPending = index > currentIndex;

            return (
              <div
                key={s.id}
                className={cn(
                  'flex items-center gap-4 p-3 rounded-xl transition-all duration-300',
                  isActive && 'bg-success/10 border border-success/20',
                  isCompleted && 'opacity-60',
                  isPending && 'opacity-40'
                )}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                    isActive && 'bg-success text-success-foreground',
                    isCompleted && 'bg-success/20 text-success',
                    isPending && 'bg-muted text-muted-foreground'
                  )}
                >
                  {isActive && stage !== 'completed' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isCompleted || (isActive && stage === 'completed') ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1">
                  <p
                    className={cn(
                      'font-medium transition-colors',
                      isActive && 'text-success',
                      isCompleted && 'text-muted-foreground',
                      isPending && 'text-muted-foreground'
                    )}
                  >
                    {s.label}
                  </p>
                </div>
                {isCompleted && (
                  <span className="text-xs text-success font-medium">Done</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <Progress value={animatedProgress} className="h-2" />
          <p className="text-sm text-muted-foreground text-center">
            {stage === 'completed' ? 'Upload complete!' : `${animatedProgress}%`}
          </p>
        </div>
      </div>
    </div>
  );
}
