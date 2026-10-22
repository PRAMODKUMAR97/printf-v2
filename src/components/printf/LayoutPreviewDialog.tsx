import { useState } from 'react';
import { Info } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from '@/components/ui/dialog';
import { PrintLayout } from '@/types/printf';

type PreviewKind = 'layout' | 'duplex' | 'pages';
interface LayoutPreviewDialogProps {
  kind: PreviewKind;
  layout: PrintLayout;
  duplex?: boolean;
  pageLimit?: number;
  pageCount?: number;
  label: string;
}
const PAPER = 'fill-card stroke-border';
const SLOT = 'fill-primary/10 stroke-primary/40';

function Sheet({ cols, rows, landscape, numbers }: { cols: number; rows: number; landscape?: boolean; numbers: number[] }) {
  const w = landscape ? 220 : 156;
  const h = landscape ? 156 : 220;
  const pad = 12;
  const gap = 10;
  const cellW = (w - pad * 2 - gap * (cols - 1)) / cols;
  const cellH = (h - pad * 2 - gap * (rows - 1)) / rows;
  return (
    <svg viewBox={'0 0 ' + w + ' ' + h} className="h-[220px] w-auto drop-shadow-sm" role="img">
      <rect x="1" y="1" width={w - 2} height={h - 2} rx="4" className={PAPER} strokeWidth="1.5" />
      {numbers.map((n, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = pad + col * (cellW + gap);
        const y = pad + row * (cellH + gap);
        return <g key={i}>
          <rect x={x} y={y} width={cellW} height={cellH} rx="2" className={SLOT} strokeWidth="1" />
          <text x={x + cellW / 2} y={y + cellH / 2 + 6} textAnchor="middle" className="fill-primary" style={{ fontSize: 18, fontWeight: 600 }}>{n}</text>
        </g>;
      })}
    </svg>
  );
}
function DuplexDiagram() {
  return <div className="flex items-center justify-center gap-8">
    <div className="text-center"><Sheet cols={1} rows={1} numbers={[1]} /><p className="mt-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">Front</p></div>
    <div className="text-center"><Sheet cols={1} rows={1} numbers={[2]} /><p className="mt-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">Back</p></div>
  </div>;
}
function PagesDiagram({ limit, total }: { limit: number; total: number }) {
  const shown = Math.min(total, 8);
  const pages = Array.from({ length: shown }, (_, i) => i + 1);
  return <div className="text-center">
    <div className="flex flex-wrap items-center justify-center gap-2">
      {pages.map((p) => <div key={p} className={p <= limit
        ? 'flex h-16 w-12 items-center justify-center rounded-md border border-primary/50 bg-primary/10 text-sm font-semibold text-primary shadow-sm'
        : 'flex h-16 w-12 items-center justify-center rounded-md border border-dashed border-border bg-muted/40 text-sm text-muted-foreground/60'}>{p}</div>)}
      {total > shown && <span className="text-sm text-muted-foreground">…{total}</span>}
    </div>
    <p className="mt-4 text-xs uppercase tracking-[0.14em] text-muted-foreground">
      {limit === 1 ? 'Page 1 prints' : 'Pages 1–' + limit + ' print'}{limit < total ? ' · ' + (total - limit) + ' skipped' : ''}
    </p>
  </div>;
}
export function LayoutPreviewDialog({ kind, layout, label, pageLimit = 1, pageCount = 1 }: LayoutPreviewDialogProps) {
  const [open, setOpen] = useState(false);
  const isDuplex = kind === 'duplex';
  const isPages = kind === 'pages';
  const body = isPages ? <PagesDiagram limit={pageLimit} total={pageCount} /> : isDuplex ? <DuplexDiagram /> : layout === 4
    ? <div className="text-center"><Sheet cols={2} rows={2} numbers={[1, 2, 3, 4]} /><p className="mt-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">4 pages on one A4 sheet</p></div>
    : layout === 2
      ? <div className="text-center"><Sheet cols={2} rows={1} landscape numbers={[1, 2]} /><p className="mt-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">2 pages side by side, sheet turned landscape</p></div>
      : <div className="text-center"><Sheet cols={1} rows={1} numbers={[1]} /><p className="mt-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">One page per A4 sheet</p></div>;
  const description = isPages
    ? 'Printing always starts at page 1 and runs up to the page number you set. Set it to 4 on a 10-page document and pages 1 to 4 are printed — the rest are skipped, and you only pay for what prints.'
    : isDuplex
      ? 'With double-sided on, pages are printed on both sides of each sheet — page 1 on the front, page 2 on the back, and so on. With it off, each page gets its own sheet, front side only.'
      : layout === 1
        ? 'Every page is scaled to fill a full A4 sheet.'
        : 'Pages are grouped ' + layout + ' at a time and tiled onto a single A4 sheet, so you pay for ' + layout + '× fewer sheets.';
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><button type="button" aria-label={'How ' + label + ' prints'} className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary hover:shadow-sm"><Info className="h-4 w-4" /></button></DialogTrigger>
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle className="font-display text-2xl">{label} preview</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <div className="flex items-center justify-center py-4">{body}</div>
    </DialogContent>
  </Dialog>;
}
