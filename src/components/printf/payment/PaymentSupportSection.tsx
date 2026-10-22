import { HelpCircle, MessageCircle, FileQuestion, ShieldCheck } from 'lucide-react';

export function PaymentSupportSection() {
  return (
    <div className="border-t border-border pt-4 space-y-3">
      <div className="flex items-center justify-center gap-4 flex-wrap">
        <a 
          href="#" 
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          Help
        </a>
        <a 
          href="#" 
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Support
        </a>
        <a 
          href="#" 
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <FileQuestion className="w-3.5 h-3.5" />
          Refund Policy
        </a>
        <a 
          href="#" 
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Terms
        </a>
      </div>
      
      <p className="text-center text-xs text-muted-foreground">
        Need help? Contact us at <span className="font-medium text-foreground">support@printf.in</span>
      </p>
    </div>
  );
}
