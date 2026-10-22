import { useState } from 'react';
import { Mail, ArrowRight, ArrowLeft, User, Phone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmailInputProps {
  email: string;
  onEmailChange: (email: string) => void;
  customerName: string;
  onCustomerNameChange: (name: string) => void;
  customerMobile: string;
  onCustomerMobileChange: (mobile: string) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading: boolean;
}

export function EmailInput({
  email, onEmailChange, customerName, onCustomerNameChange,
  customerMobile, onCustomerMobileChange, onBack, onNext, isLoading,
}: EmailInputProps) {
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (customerName.trim().length < 2) { setError('Please enter your name'); return; }
    const digits = customerMobile.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) { setError('Please enter a valid mobile number'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Please enter a valid email address'); return; }
    setError('');
    onNext();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) handleSubmit();
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6 animate-fade-in">
      <div className="bg-card border border-border rounded-2xl p-6 shadow-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-foreground">Enter Your Details</h3>
          <p className="text-sm text-muted-foreground">Add your contact details for receipts, order updates and OTP verification</p>
        </div>
        <div className="space-y-3">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input type="text" autoComplete="name" placeholder="Your full name" value={customerName}
              onChange={(e) => { onCustomerNameChange(e.target.value); setError(''); }} onKeyDown={handleKeyPress}
              maxLength={100} className="h-14 pl-11 text-base font-medium rounded-xl" required />
          </div>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input type="tel" autoComplete="tel" inputMode="tel" placeholder="Mobile number" value={customerMobile}
              onChange={(e) => { onCustomerMobileChange(e.target.value); setError(''); }} onKeyDown={handleKeyPress}
              maxLength={20} className="h-14 pl-11 text-base font-medium rounded-xl" required />
          </div>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input type="email" autoComplete="email" placeholder="your@email.com" value={email}
              onChange={(e) => { onEmailChange(e.target.value); setError(''); }} onKeyDown={handleKeyPress}
              className={cn('h-14 pl-11 text-base font-medium rounded-xl', error && 'border-destructive focus-visible:ring-destructive')} required />
          </div>
          {error && <p className="text-sm text-destructive animate-fade-in">{error}</p>}
        </div>
        <p className="text-xs text-muted-foreground text-center">By continuing, you agree to receive email notifications for your print order.</p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />Back
        </Button>
        <Button className={cn('flex-1 h-12 rounded-xl', 'bg-success hover:bg-success/90 text-success-foreground')}
          onClick={handleSubmit} disabled={isLoading || !email.includes('@') || customerName.trim().length < 2 || customerMobile.replace(/\D/g, '').length < 10}>
          {isLoading ? (
            <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-success-foreground/30 border-t-success-foreground rounded-full animate-spin" />Processing...</span>
          ) : <>Continue to Payment<ArrowRight className="w-4 h-4 ml-2" /></>}
        </Button>
      </div>
    </div>
  );
}
