import { Shield, Lock, CheckCircle2, BadgeCheck } from 'lucide-react';

export function PaymentTrustBadges() {
  return (
    <div className="space-y-4">
      {/* Main trust banner */}
      <div className="bg-success/10 border border-success/20 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="font-semibold text-success text-sm">100% Secure Payment</p>
            <p className="text-xs text-muted-foreground">Your transaction is protected end-to-end</p>
          </div>
        </div>
      </div>

      {/* Trust badges grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
          <Lock className="w-4 h-4 text-primary" />
          <span className="text-xs text-muted-foreground">Encrypted</span>
        </div>
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
          <BadgeCheck className="w-4 h-4 text-primary" />
          <span className="text-xs text-muted-foreground">PCI-DSS</span>
        </div>
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          <span className="text-xs text-muted-foreground">RBI Approved</span>
        </div>
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
          <Shield className="w-4 h-4 text-primary" />
          <span className="text-xs text-muted-foreground">Razorpay</span>
        </div>
      </div>
    </div>
  );
}
