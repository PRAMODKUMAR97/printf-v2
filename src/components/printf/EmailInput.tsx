import { useState } from 'react';
import { Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmailInputProps {
  email: string;
  onEmailChange: (email: string) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading: boolean;
}

export function EmailInput({
  email,
  onEmailChange,
  onBack,
  onNext,
  isLoading,
}: EmailInputProps) {
  const [error, setError] = useState('');

  const validateEmail = (emailValue: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailValue)) {
      setError('Please enter a valid email address');
      return false;
    }
    setError('');
    return true;
  };

  const handleEmailChange = (value: string) => {
    onEmailChange(value);
    if (error && value.includes('@')) {
      setError('');
    }
  };

  const handleSubmit = () => {
    if (validateEmail(email)) {
      onNext();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6 animate-fade-in">
      <div className="bg-card border border-border rounded-2xl p-6 shadow-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-foreground">Enter Your Email</h3>
          <p className="text-sm text-muted-foreground">
            We'll send the verification code to this email after payment
          </p>
        </div>

        <div className="space-y-3">
          <Input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            onKeyPress={handleKeyPress}
            className={cn(
              'h-14 text-lg font-medium rounded-xl',
              error && 'border-destructive focus-visible:ring-destructive'
            )}
          />
          {error && (
            <p className="text-sm text-destructive animate-fade-in">{error}</p>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          By continuing, you agree to receive email notifications for your print job
        </p>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1 h-12 rounded-xl"
          onClick={onBack}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          className={cn(
            'flex-1 h-12 rounded-xl',
            'bg-success hover:bg-success/90 text-success-foreground'
          )}
          onClick={handleSubmit}
          disabled={isLoading || !email.includes('@')}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-success-foreground/30 border-t-success-foreground rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            <>
              Continue to Payment
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
