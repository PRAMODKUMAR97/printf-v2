import { FileText, Printer, MapPin, Clock, Palette, Copy } from 'lucide-react';
import { PrintJob } from '@/types/printf';
import { Separator } from '@/components/ui/separator';

interface PaymentOrderSummaryProps {
  job: PrintJob;
  printerName?: string;
  printerLocation?: string;
}

export function PaymentOrderSummary({ job, printerName, printerLocation }: PaymentOrderSummaryProps) {
  const settings = job.settings_json;
  const pageCount = settings.page_count || 1;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm text-foreground">Order Summary</h3>
      </div>

      <div className="space-y-3">
        {/* File Details */}
        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground truncate">{job.file_name}</p>
            <p className="text-xs text-muted-foreground">
              {pageCount} {pageCount > 1 ? 'pages' : 'page'} • {(job.file_size / 1024).toFixed(1)} KB
            </p>
          </div>
        </div>

        <Separator />

        {/* Print Settings */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Print Type</p>
              <p className="text-sm font-medium text-foreground">
                {settings.color ? 'Color' : 'Black & White'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Copy className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Copies</p>
              <p className="text-sm font-medium text-foreground">{settings.copies || 1}</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Printer Info */}
        {(printerName || printerLocation) && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-success" />
              <div>
                <p className="text-xs text-muted-foreground">Printer</p>
                <p className="text-sm font-medium text-foreground">{printerName || 'PrintF Station'}</p>
              </div>
            </div>
            {printerLocation && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                <p className="text-xs text-muted-foreground line-clamp-2">{printerLocation}</p>
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Estimated Time */}
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Estimated Print Time</p>
            <p className="text-sm font-medium text-foreground">~{Math.ceil(pageCount * 0.5)} minutes</p>
          </div>
        </div>

        {/* Order IDs */}
        <div className="bg-muted/30 rounded-lg p-3 space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Job ID</span>
            <span className="text-xs font-mono text-foreground">{job.id.slice(0, 8)}...</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Service</span>
            <span className="text-xs text-foreground">Cloud Print Service – PrintF</span>
          </div>
        </div>
      </div>
    </div>
  );
}
