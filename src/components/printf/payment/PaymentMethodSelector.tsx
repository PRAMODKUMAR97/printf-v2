import { useState } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Smartphone, CreditCard, Building2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// UPI App configurations with deep link schemes
const UPI_APPS = [
  { 
    id: 'gpay', 
    name: 'Google Pay', 
    icon: '💳',
    package: 'com.google.android.apps.nbu.paisa.user',
    scheme: 'gpay://',
    color: 'bg-blue-500/10 border-blue-500/20'
  },
  { 
    id: 'phonepe', 
    name: 'PhonePe', 
    icon: '💜',
    package: 'com.phonepe.app',
    scheme: 'phonepe://',
    color: 'bg-purple-500/10 border-purple-500/20'
  },
  { 
    id: 'paytm', 
    name: 'Paytm', 
    icon: '💙',
    package: 'net.one97.paytm',
    scheme: 'paytmmp://',
    color: 'bg-sky-500/10 border-sky-500/20'
  },
  { 
    id: 'bhim', 
    name: 'BHIM', 
    icon: '🇮🇳',
    package: 'in.org.npci.upiapp',
    scheme: 'bhim://',
    color: 'bg-orange-500/10 border-orange-500/20'
  },
];

export type PaymentMethod = 'upi_intent' | 'upi_id' | 'card' | 'netbanking';

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  upiId: string;
  onUpiIdChange: (upiId: string) => void;
  selectedUpiApp: string | null;
  onUpiAppSelect: (appId: string) => void;
}

export function PaymentMethodSelector({
  selectedMethod,
  onMethodChange,
  upiId,
  onUpiIdChange,
  selectedUpiApp,
  onUpiAppSelect,
}: PaymentMethodSelectorProps) {
  const [upiIdError, setUpiIdError] = useState<string | null>(null);

  const validateUpiId = (value: string) => {
    if (!value) {
      setUpiIdError(null);
      return;
    }
    const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
    if (!upiRegex.test(value)) {
      setUpiIdError('Enter valid UPI ID (e.g., name@upi)');
    } else {
      setUpiIdError(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Payment Method</h3>
        <span className="text-xs text-success font-medium flex items-center gap-1">
          <Smartphone className="w-3 h-3" />
          UPI Recommended
        </span>
      </div>

      <RadioGroup 
        value={selectedMethod} 
        onValueChange={(v) => onMethodChange(v as PaymentMethod)}
        className="space-y-3"
      >
        {/* UPI Intent - Pay via App */}
        <div className={cn(
          "relative rounded-xl border-2 transition-all duration-200",
          selectedMethod === 'upi_intent' 
            ? "border-success bg-success/5" 
            : "border-border bg-card hover:border-muted-foreground/30"
        )}>
          <Label 
            htmlFor="upi_intent" 
            className="flex items-start gap-3 p-4 cursor-pointer"
          >
            <RadioGroupItem value="upi_intent" id="upi_intent" className="mt-0.5" />
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Pay via UPI App</p>
                  <p className="text-xs text-muted-foreground">Instant & secure payment</p>
                </div>
                <div className="flex items-center gap-1 px-2 py-0.5 bg-success/10 rounded-full">
                  <span className="text-[10px] font-semibold text-success">FASTEST</span>
                </div>
              </div>
              
              {selectedMethod === 'upi_intent' && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {UPI_APPS.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => onUpiAppSelect(app.id)}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-lg border-2 transition-all",
                        selectedUpiApp === app.id
                          ? "border-success bg-success/10"
                          : `${app.color} hover:border-muted-foreground/40`
                      )}
                    >
                      <span className="text-xl">{app.icon}</span>
                      <span className="text-sm font-medium">{app.name}</span>
                      {selectedUpiApp === app.id && (
                        <ChevronRight className="w-4 h-4 ml-auto text-success" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Label>
        </div>

        {/* UPI ID */}
        <div className={cn(
          "relative rounded-xl border-2 transition-all duration-200",
          selectedMethod === 'upi_id' 
            ? "border-success bg-success/5" 
            : "border-border bg-card hover:border-muted-foreground/30"
        )}>
          <Label 
            htmlFor="upi_id" 
            className="flex items-start gap-3 p-4 cursor-pointer"
          >
            <RadioGroupItem value="upi_id" id="upi_id" className="mt-0.5" />
            <div className="flex-1 space-y-3">
              <div>
                <p className="font-medium text-foreground">Enter UPI ID</p>
                <p className="text-xs text-muted-foreground">Pay using your VPA</p>
              </div>
              
              {selectedMethod === 'upi_id' && (
                <div className="space-y-2 pt-1">
                  <Input
                    type="text"
                    placeholder="yourname@upi"
                    value={upiId}
                    onChange={(e) => {
                      onUpiIdChange(e.target.value);
                      validateUpiId(e.target.value);
                    }}
                    className={cn(
                      "bg-background",
                      upiIdError && "border-destructive"
                    )}
                  />
                  {upiIdError && (
                    <p className="text-xs text-destructive">{upiIdError}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    Example: name@okicici, name@ybl, name@paytm
                  </p>
                </div>
              )}
            </div>
          </Label>
        </div>

        {/* Card Payment */}
        <div className={cn(
          "relative rounded-xl border-2 transition-all duration-200",
          selectedMethod === 'card' 
            ? "border-success bg-success/5" 
            : "border-border bg-card hover:border-muted-foreground/30"
        )}>
          <Label 
            htmlFor="card" 
            className="flex items-center gap-3 p-4 cursor-pointer"
          >
            <RadioGroupItem value="card" id="card" />
            <CreditCard className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium text-foreground">Credit/Debit Card</p>
              <p className="text-xs text-muted-foreground">Visa, Mastercard, RuPay</p>
            </div>
          </Label>
        </div>

        {/* Net Banking */}
        <div className={cn(
          "relative rounded-xl border-2 transition-all duration-200",
          selectedMethod === 'netbanking' 
            ? "border-success bg-success/5" 
            : "border-border bg-card hover:border-muted-foreground/30"
        )}>
          <Label 
            htmlFor="netbanking" 
            className="flex items-center gap-3 p-4 cursor-pointer"
          >
            <RadioGroupItem value="netbanking" id="netbanking" />
            <Building2 className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium text-foreground">Net Banking</p>
              <p className="text-xs text-muted-foreground">All major banks</p>
            </div>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}

export { UPI_APPS };
