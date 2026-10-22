import { Receipt, Tag, Percent, Calculator } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface PaymentPriceBreakdownProps {
  pageCount: number;
  isColor: boolean;
  copies: number;
  totalAmount: number;
}

// Price constants
const PRICE_PER_PAGE_BW = 2;
const PRICE_PER_PAGE_COLOR = 10;
const PLATFORM_FEE_PERCENT = 0; // No platform fee for now
const GST_PERCENT = 0; // Included in price

export function PaymentPriceBreakdown({ pageCount, isColor, copies, totalAmount }: PaymentPriceBreakdownProps) {
  const pricePerPage = isColor ? PRICE_PER_PAGE_COLOR : PRICE_PER_PAGE_BW;
  const baseCost = pageCount * pricePerPage * copies;
  const platformFee = Math.round(baseCost * PLATFORM_FEE_PERCENT) / 100;
  const gst = Math.round(baseCost * GST_PERCENT) / 100;
  const calculatedTotal = baseCost + platformFee + gst;

  const formatAmount = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amt);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Receipt className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm text-foreground">Price Breakdown</h3>
      </div>

      <div className="space-y-3">
        {/* Base Cost */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-foreground">Print Cost</p>
              <p className="text-xs text-muted-foreground">
                {pageCount} page{pageCount > 1 ? 's' : ''} × {formatAmount(pricePerPage)} ({isColor ? 'Color' : 'B&W'})
                {copies > 1 && ` × ${copies} copies`}
              </p>
            </div>
          </div>
          <span className="text-sm font-medium text-foreground">{formatAmount(baseCost)}</span>
        </div>

        {/* Platform Fee (if any) */}
        {platformFee > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-foreground">Platform Fee</p>
            </div>
            <span className="text-sm text-foreground">{formatAmount(platformFee)}</span>
          </div>
        )}

        {/* GST (if any) */}
        {gst > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-foreground">GST (18%)</p>
            </div>
            <span className="text-sm text-foreground">{formatAmount(gst)}</span>
          </div>
        )}

        <Separator />

        {/* Total */}
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold text-foreground">Total Payable</p>
          <span className="text-xl font-bold text-primary">{formatAmount(totalAmount)}</span>
        </div>

        {/* Tax inclusive note */}
        <p className="text-xs text-muted-foreground text-center">
          All prices are inclusive of applicable taxes
        </p>
      </div>
    </div>
  );
}
