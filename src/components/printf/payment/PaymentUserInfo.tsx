import { User, Mail, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaymentUserInfoProps {
  email: string;
  phone?: string;
  onEditEmail?: () => void;
}

export function PaymentUserInfo({ email, phone, onEditEmail }: PaymentUserInfoProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Your Details</h3>
        </div>
        {onEditEmail && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={onEditEmail}
          >
            <Edit2 className="w-3 h-3 mr-1" />
            Edit
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Mail className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">Contact Info</p>
          <p className="text-sm font-medium text-foreground truncate">{email}</p>
          {phone && <p className="text-xs text-muted-foreground mt-0.5">{phone}</p>}
        </div>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-success" />
        OTP & receipt will be sent to this email
      </p>
    </div>
  );
}
