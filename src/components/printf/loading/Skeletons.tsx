
import { Loader2 } from 'lucide-react';

export function Shimmer({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}
export function ProgressHairline() {
  return <div className="progress-hairline" aria-hidden="true" />;
}
export function RouteSkeleton() {
  return <div className="mx-auto w-full max-w-xl py-10"><div className="panel-raised space-y-5 p-7"><ProgressHairline /><Shimmer className="h-3 w-1/4 skeleton-text" /><Shimmer className="h-7 w-2/3 skeleton-text" /><Shimmer className="h-3 w-full skeleton-text" /><Shimmer className="h-3 w-5/6 skeleton-text" /><div className="flex items-center gap-3 pt-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /><span className="text-xs text-muted-foreground">Preparing your PrintF workspace…</span></div></div></div>;
}
export function PrintfListSkeleton() {
  return <div className="overflow-hidden rounded-2xl border border-border bg-card">{[1,2,3].map(n=><div key={n} className="flex items-center gap-5 border-b border-border px-6 py-5 last:border-0"><Shimmer className="h-3 w-5 skeleton-text" /><div className="flex-1 space-y-2"><Shimmer className="h-3 w-1/3 skeleton-text" /><Shimmer className="h-2.5 w-2/3 skeleton-text" /></div><Shimmer className="h-3 w-16 skeleton-text" /></div>)}</div>;
}
export function PaymentSummarySkeleton() {
  return <div className="mx-auto w-full max-w-xl space-y-5"><div className="panel-raised space-y-4 p-7"><ProgressHairline /><Shimmer className="h-3 w-1/4 skeleton-text" /><Shimmer className="h-7 w-1/2 skeleton-text" /><Shimmer className="h-3 w-full skeleton-text" /><Shimmer className="h-3 w-4/5 skeleton-text" /></div><div className="panel space-y-4 p-7"><Shimmer className="h-3 w-1/3 skeleton-text" /><Shimmer className="h-3 w-full skeleton-text" /><Shimmer className="h-3 w-5/6 skeleton-text" /></div></div>;
}
export function StatusSkeleton() {
  return <div className="mx-auto w-full max-w-xl"><div className="panel-raised space-y-5 p-7"><ProgressHairline /><Shimmer className="h-3 w-1/4 skeleton-text" /><Shimmer className="h-7 w-2/3 skeleton-text" /><Shimmer className="h-3 w-full skeleton-text" /><Shimmer className="h-3 w-4/5 skeleton-text" /><div className="border-t border-border pt-5 space-y-3"><Shimmer className="h-3 w-full skeleton-text" /><Shimmer className="h-3 w-4/5 skeleton-text" /><Shimmer className="h-3 w-2/3 skeleton-text" /></div></div></div>;
}

