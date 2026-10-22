import { PrintSettings as PrintSettingsType } from '@/types/printf';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Palette, FileText, ArrowLeft, ArrowRight, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PrintSettingsProps {
  settings: PrintSettingsType;
  onSettingsChange: (settings: Partial<PrintSettingsType>) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading: boolean;
  pageCount: number;
  amount: number;
}

export function PrintSettings({
  settings,
  onSettingsChange,
  onBack,
  onNext,
  isLoading,
  pageCount,
  amount,
}: PrintSettingsProps) {
  return (
    <div className="w-full max-w-md mx-auto space-y-6 animate-fade-in">
      <div className="bg-card border border-border rounded-2xl p-6 shadow-lg space-y-6">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <FileText className="w-5 h-5 text-secondary" />
          Print Settings
        </h3>

        {/* Page Count Info */}
        <div className="flex items-center gap-4 p-4 bg-success/10 rounded-xl border border-success/20">
          <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
            <Layers className="w-6 h-6 text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold text-success">{pageCount}</p>
            <p className="text-sm text-muted-foreground">
              Page{pageCount > 1 ? 's' : ''} detected
            </p>
          </div>
        </div>

        {/* Color */}
        <div className="flex items-center justify-between py-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
              settings.color ? 'bg-primary/10' : 'bg-muted'
            )}>
              <Palette className={cn(
                'w-5 h-5 transition-colors',
                settings.color ? 'text-primary' : 'text-muted-foreground'
              )} />
            </div>
            <div>
              <Label className="text-sm font-medium text-foreground">Color Print</Label>
              <p className="text-xs text-muted-foreground">
                {settings.color ? '₹10 per page' : '₹2 per page'}
              </p>
            </div>
          </div>
          <Switch
            checked={settings.color}
            onCheckedChange={(color) => onSettingsChange({ color })}
          />
        </div>

        {/* Duplex */}
        <div className="flex items-center justify-between py-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
              settings.duplex ? 'bg-secondary/10' : 'bg-muted'
            )}>
              <Layers className={cn(
                'w-5 h-5 transition-colors',
                settings.duplex ? 'text-secondary' : 'text-muted-foreground'
              )} />
            </div>
            <div>
              <Label className="text-sm font-medium text-foreground">Double-sided</Label>
              <p className="text-xs text-muted-foreground">Print on both sides</p>
            </div>
          </div>
          <Switch
            checked={settings.duplex}
            onCheckedChange={(duplex) => onSettingsChange({ duplex })}
          />
        </div>
      </div>

      {/* Price Summary */}
      <div className="bg-success/10 border border-success/20 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total Amount</span>
          <span className="text-3xl font-bold text-success">
            ₹{amount.toFixed(2)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {pageCount} page{pageCount > 1 ? 's' : ''} × ₹{settings.color ? '10' : '2'} per page
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
          onClick={onNext}
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-success-foreground/30 border-t-success-foreground rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            <>
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
