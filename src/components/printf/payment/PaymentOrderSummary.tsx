import { PrintJob } from '@/types/printf';

interface PaymentOrderSummaryProps {
  job: PrintJob;
  printerName?: string;
  printerLocation?: string;
}

export function PaymentOrderSummary({ job, printerName, printerLocation }: PaymentOrderSummaryProps) {
  const settings = job.settings_json;
  const pageCount = settings.page_count || 1;
  const layout = settings.layout || 1;
  const selected = settings.selected_pages || pageCount;
  const sheetsPerCopy = settings.sheets || Math.ceil(selected / Math.max(1, layout));
  const totalSheets = sheetsPerCopy * (settings.copies || 1);
  const rows: Array<{ label: string; value: string; sub?: string }> = [
    { label: 'Document', value: job.file_name, sub: pageCount + ' page' + (pageCount > 1 ? 's' : '') + ' · ' + (job.file_size / 1024).toFixed(1) + ' KB' },
    { label: 'Output', value: settings.color ? 'Colour' : 'Black & white' },
    { label: 'Layout', value: layout === 1 ? 'One per sheet' : String(layout) + '-in-1', sub: settings.duplex ? 'Double-sided' : 'Single-sided' },
    { label: 'Copies', value: String(settings.copies || 1) },
    { label: 'Sheets', value: totalSheets + ' sheet' + (totalSheets > 1 ? 's' : ''), sub: selected + ' page' + (selected > 1 ? 's' : '') + ' selected' },
    { label: 'Station', value: printerName || 'PrintF station', sub: printerLocation },
    { label: 'Estimated time', value: '~' + Math.ceil(totalSheets * 0.5) + ' min' },
    { label: 'Job reference', value: job.id.slice(0, 8).toUpperCase() },
  ];
  return (
    <section className="panel overflow-hidden">
      <header className="border-b border-border px-6 py-4">
        <h3 className="text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">Order summary</h3>
      </header>
      <dl className="divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-6 px-6 py-3.5">
            <dt className="flex-shrink-0 text-sm text-muted-foreground">{row.label}</dt>
            <dd className="min-w-0 text-right">
              <p className="truncate text-sm font-medium text-foreground">{row.value}</p>
              {row.sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.sub}</p>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
