import { Mail, FileText, RefreshCcw, Headphones } from 'lucide-react';

export function PaymentConfidenceSection() {
  return (
    <div className="bg-muted/30 rounded-xl p-4 space-y-3">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What you get</h4>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-start gap-2">
          <Mail className="w-4 h-4 text-success mt-0.5" />
          <p className="text-xs text-muted-foreground">Receipt sent to email</p>
        </div>
        <div className="flex items-start gap-2">
          <FileText className="w-4 h-4 text-success mt-0.5" />
          <p className="text-xs text-muted-foreground">Invoice available</p>
        </div>
        <div className="flex items-start gap-2">
          <RefreshCcw className="w-4 h-4 text-success mt-0.5" />
          <p className="text-xs text-muted-foreground">Refund if print fails</p>
        </div>
        <div className="flex items-start gap-2">
          <Headphones className="w-4 h-4 text-success mt-0.5" />
          <p className="text-xs text-muted-foreground">24/7 Support</p>
        </div>
      </div>
    </div>
  );
}
