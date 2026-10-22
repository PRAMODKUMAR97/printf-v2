interface PaymentPriceBreakdownProps {
  pageCount: number;
  isColor: boolean;
  copies: number;
  totalAmount: number;
  layout?: number;
  sheets?: number;
}
const PRICE_PER_PAGE_BW = 2;
const PRICE_PER_PAGE_COLOR = 10;
const PLATFORM_FEE_PERCENT = 0;
const GST_PERCENT = 0;

export function PaymentPriceBreakdown({ pageCount, isColor, copies, totalAmount, layout = 1, sheets }: PaymentPriceBreakdownProps) {
  const pricePerPage = isColor ? PRICE_PER_PAGE_COLOR : PRICE_PER_PAGE_BW;
  const sheetsPerCopy = sheets ?? Math.ceil(pageCount / Math.max(1, layout));
  const baseCost = sheetsPerCopy * pricePerPage * copies;
  const platformFee = Math.round(baseCost * PLATFORM_FEE_PERCENT) / 100;
  const gst = Math.round(baseCost * GST_PERCENT) / 100;
  const formatAmount = (amt: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(amt);

  return (
    <section className="panel overflow-hidden">
      <header className="border-b border-border px-6 py-4">
        <h3 className="text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">Price breakdown</h3>
      </header>
      <div className="divide-y divide-border">
        <div className="flex items-start justify-between gap-6 px-6 py-4">
          <div>
            <p className="text-sm text-foreground">Print cost</p>
            <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
              {sheetsPerCopy} sheet{sheetsPerCopy > 1 ? 's' : ''} × {formatAmount(pricePerPage)} ({isColor ? 'colour' : 'B&W'})
              {copies > 1 && ' × ' + copies + ' copies'}
            </p>
            {layout > 1 && <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{pageCount} page{pageCount > 1 ? 's' : ''} at {layout}-in-1</p>}
          </div>
          <span className="text-sm font-medium text-foreground tabular-nums">{formatAmount(baseCost)}</span>
        </div>
        {platformFee > 0 && <div className="flex items-center justify-between gap-6 px-6 py-4"><p className="text-sm text-foreground">Platform fee</p><span className="text-sm text-foreground tabular-nums">{formatAmount(platformFee)}</span></div>}
        {gst > 0 && <div className="flex items-center justify-between gap-6 px-6 py-4"><p className="text-sm text-foreground">GST (18%)</p><span className="text-sm text-foreground tabular-nums">{formatAmount(gst)}</span></div>}
        <div className="flex items-end justify-between gap-6 px-6 py-5">
          <div><p className="text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">Total payable</p><p className="mt-1 text-xs text-muted-foreground">Inclusive of all taxes</p></div>
          <span className="stat-number text-4xl leading-none text-foreground">{formatAmount(totalAmount)}</span>
        </div>
      </div>
    </section>
  );
}
