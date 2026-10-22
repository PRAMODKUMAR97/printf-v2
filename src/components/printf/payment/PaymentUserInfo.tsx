import { User, Mail, Edit2, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaymentUserInfoProps {
  email: string;
  customerName?: string;
  phone?: string;
  onEditEmail?: () => void;
}

export function PaymentUserInfo({ email, customerName, phone, onEditEmail }: PaymentUserInfoProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><User className="w-4 h-4 text-primary" /><h3 className="font-semibold text-sm text-foreground">Your Details</h3></div>
        {onEditEmail && <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={onEditEmail}><Edit2 className="w-3 h-3 mr-1" />Edit</Button>}
      </div>
      <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
        {customerName && <p className="text-sm font-semibold text-foreground">{customerName}</p>}
        <div className="flex items-center gap-2 min-w-0"><Mail className="w-4 h-4 text-primary shrink-0" /><p className="text-sm text-foreground truncate">{email}</p></div>
        {phone && <div className="flex items-center gap-2 min-w-0"><Phone className="w-4 h-4 text-primary shrink-0" /><p className="text-sm text-foreground">{phone}</p></div>}
      </div>
      <p className="text-xs text-muted-foreground flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-success" />OTP and receipt updates are sent to your email</p>
    </div>
  );
}
