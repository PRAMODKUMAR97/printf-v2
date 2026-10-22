import { PrintSettings as PrintSettingsType, PrintLayout } from '@/types/printf';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ArrowRight, Minus, Plus, Palette, Copy, Maximize, Files, FileText, LayoutGrid, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { countSelectedPages, countSheets } from '@/hooks/usePrintJob';
import { LayoutPreviewDialog } from '@/components/printf/LayoutPreviewDialog';

interface PrintSettingsProps {
  settings: PrintSettingsType;
  onSettingsChange: (settings: Partial<PrintSettingsType>) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading: boolean;
  pageCount: number;
  amount: number;
}
const layouts: { value: PrintLayout; label: string; hint: string }[] = [
  { value: 1, label: 'One per sheet', hint: 'Standard, full size' },
  { value: 2, label: '2-in-1', hint: 'Two pages per sheet' },
  { value: 4, label: '4-in-1', hint: 'Four pages per sheet' },
];

export function PrintSettings({ settings, onSettingsChange, onBack, onNext, isLoading, pageCount, amount }: PrintSettingsProps) {
  const selectedPages = countSelectedPages(settings.page_range, pageCount);
  const sheetsPerCopy = countSheets(selectedPages, settings.layout);
  const totalSheets = sheetsPerCopy * Math.max(1, settings.copies);
  const limitMatch = settings.page_range.match(/^1\s*-\s*(\d+)$/);
  const pageLimit = settings.page_range.trim() ? Math.max(1, Math.min(pageCount, limitMatch ? Number(limitMatch[1]) : selectedPages)) : pageCount;
  const setPageLimit = (next: number) => {
    const value = Math.max(1, Math.min(pageCount, next));
    onSettingsChange({ page_range: value >= pageCount ? '' : '1-' + value });
  };
  const setCopies = (value: number) => onSettingsChange({ copies: Math.max(1, Math.min(50, value)) });

  return (
    <div className="w-full space-y-6 animate-rise">
      <section className="panel-raised overflow-hidden">
        <header className="flex items-end justify-between gap-6 border-b border-border px-7 py-6">
          <div><p className="eyebrow">Step two</p><h2 className="mt-2 font-display text-3xl text-foreground">Print options</h2><p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">Auto-fitted to A4</p></div>
          <div className="text-right"><p className="stat-number text-4xl leading-none text-foreground">{pageCount}</p><p className="mt-1 text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">Pages</p></div>
        </header>

        <div className="accent-rule flex items-center justify-between gap-6 border-b border-border px-7 py-6" data-active={settings.color}>
          <div><span className="flex items-center gap-2.5"><Palette className="h-4 w-4 text-primary" /><Label className="text-base font-medium text-foreground">Colour output</Label></span><p className="mt-1 text-sm text-muted-foreground">{settings.color ? 'Full colour — ₹10 per sheet' : 'Black & white — ₹2 per sheet'}</p></div>
          <Switch checked={settings.color} onCheckedChange={(color) => onSettingsChange({ color })} />
        </div>

        <div className="accent-rule flex items-center justify-between gap-6 border-b border-border px-7 py-6" data-active={settings.duplex}>
          <div><span className="flex items-center gap-2.5"><Copy className="h-4 w-4 text-primary" /><Label className="text-base font-medium text-foreground">Double-sided</Label></span><p className="mt-1 text-sm text-muted-foreground">Print on both sides of each sheet</p></div>
          <div className="flex items-center gap-3"><LayoutPreviewDialog kind="duplex" layout={settings.layout} label="Double-sided" /><Switch checked={settings.duplex} onCheckedChange={(duplex) => onSettingsChange({ duplex })} /></div>
        </div>

        <div className="accent-rule flex items-center justify-between gap-6 border-b border-border px-7 py-6" data-active={settings.borderless}>
          <div><span className="flex items-center gap-2.5"><Maximize className="h-4 w-4 text-primary" /><Label className="text-base font-medium text-foreground">Borderless</Label></span><p className="mt-1 text-sm text-muted-foreground">{settings.borderless ? 'Edge-to-edge, no white margin' : 'Standard margins around the page'}</p></div>
          <Switch checked={settings.borderless} onCheckedChange={(borderless) => onSettingsChange({ borderless })} />
        </div>

        <div className="flex items-center justify-between gap-6 border-b border-border px-7 py-6">
          <div><span className="flex items-center gap-2.5"><Files className="h-4 w-4 text-primary" /><Label className="text-base font-medium text-foreground">Copies</Label></span><p className="mt-1 text-sm text-muted-foreground">How many sets to print</p></div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="icon" aria-label="Decrease copies" onClick={() => setCopies(settings.copies - 1)} disabled={settings.copies <= 1}><Minus className="h-4 w-4" /></Button>
            <span className="stat-number w-10 text-center text-2xl text-foreground">{settings.copies}</span>
            <Button type="button" variant="outline" size="icon" aria-label="Increase copies" onClick={() => setCopies(settings.copies + 1)} disabled={settings.copies >= 50}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>

        {pageCount > 1 && <div className="border-b border-border px-7 py-6">
          <div className="flex items-start justify-between gap-4"><div><span className="flex items-center gap-2.5"><FileText className="h-4 w-4 text-primary" /><Label className="text-base font-medium text-foreground">Pages</Label></span><p className="mt-1 text-sm text-muted-foreground">Start at page 1 and stop at your chosen page</p></div><LayoutPreviewDialog kind="pages" layout={settings.layout} pageLimit={pageLimit} pageCount={pageCount} label="Pages" /></div>
          <div className="mt-4 flex flex-wrap items-center gap-3"><Button type="button" variant={settings.page_range.trim() ? 'outline' : 'secondary'} onClick={() => onSettingsChange({ page_range: '' })}>All {pageCount} pages</Button>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-1.5"><span className="pl-2 text-sm text-muted-foreground">Up to page</span>
              <Button type="button" variant="outline" size="icon" aria-label="Fewer pages" onClick={() => setPageLimit(pageLimit - 1)} disabled={pageLimit <= 1}><Minus className="h-4 w-4" /></Button>
              <Input value={String(pageLimit)} onChange={(event) => { const n = parseInt(event.target.value.replace(/\D/g, ''), 10); if (!Number.isNaN(n)) setPageLimit(n); }} inputMode="numeric" aria-label="Print up to page" className="h-10 w-16 text-center" />
              <Button type="button" variant="outline" size="icon" aria-label="More pages" onClick={() => setPageLimit(pageLimit + 1)} disabled={pageLimit >= pageCount}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{pageLimit + ' of ' + pageCount + ' pages selected'}</p>
        </div>}

        <div className="px-7 py-6">
          <span className="flex items-center gap-2.5"><LayoutGrid className="h-4 w-4 text-primary" /><Label className="text-base font-medium text-foreground">Layout</Label></span>
          <p className="mt-1 text-sm text-muted-foreground">Fit multiple pages onto one A4 sheet to reduce sheet count</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">{layouts.map((layout) => {
            const active = settings.layout === layout.value;
            return <div key={layout.value} className="relative">
              <button type="button" onClick={() => onSettingsChange({ layout: layout.value })} aria-pressed={active}
                className={cn('w-full rounded-lg border px-4 py-3 pr-11 text-left transition-all duration-300', active ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:-translate-y-0.5 hover:shadow-sm')}>
                <span className="block text-sm font-medium text-foreground">{layout.label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{layout.hint}</span>
              </button>
              <div className="absolute right-2 top-2"><LayoutPreviewDialog kind="layout" layout={layout.value} label={layout.label} /></div>
            </div>;
          })}</div>
        </div>
      </section>

      <section className="panel flex items-end justify-between gap-6 px-7 py-6">
        <div><p className="flex items-center gap-2 text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground"><Receipt className="h-3.5 w-3.5 text-primary" />Total</p><p className="mt-2 text-sm text-muted-foreground">{selectedPages + ' pages = ' + sheetsPerCopy + ' sheets × ' + settings.copies + ' copies (' + totalSheets + ' sheets total)'}</p></div>
        <p className="stat-number text-5xl leading-none text-foreground">₹{amount.toFixed(2)}</p>
      </section>

      <div className="flex gap-3">
        <Button variant="outline" size="lg" className="flex-1" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
        <Button variant="secondary" size="lg" className="flex-[1.4]" onClick={onNext} disabled={isLoading}>
          {isLoading ? <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-secondary-foreground/30 border-t-secondary-foreground" />Processing</span> : <>Continue<ArrowRight className="ml-2 h-4 w-4" /></>}
        </Button>
      </div>
    </div>
  );
}
