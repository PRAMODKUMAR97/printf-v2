import { Lock, BadgeCheck, ShieldCheck } from 'lucide-react';

export function PaymentTrustBadges() {
  return (
    <div className="panel flex items-stretch divide-x divide-border overflow-hidden">
      <div className="flex flex-1 items-center gap-2.5 px-4 py-4"><Lock className="h-3.5 w-3.5 flex-shrink-0 text-accent" /><span className="text-xs text-muted-foreground">256-bit encrypted</span></div>
      <div className="flex flex-1 items-center gap-2.5 px-4 py-4"><BadgeCheck className="h-3.5 w-3.5 flex-shrink-0 text-accent" /><span className="text-xs text-muted-foreground">PCI-DSS certified</span></div>
      <div className="hidden flex-1 items-center gap-2.5 px-4 py-4 sm:flex"><ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 text-accent" /><span className="text-xs text-muted-foreground">RBI approved</span></div>
    </div>
  );
}
