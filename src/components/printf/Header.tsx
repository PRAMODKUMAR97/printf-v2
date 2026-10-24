import { forwardRef, useState } from 'react';
import { Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const menuLinks = [
  { label: 'My Orders', to: '/orders' },
  { label: 'About Us', to: '/about' },
  { label: 'Contact Us', to: '/contact' },
  { label: 'Support / Help Center', to: '/support' },
  { label: 'FAQs', to: '/faqs' },
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Terms & Conditions', to: '/terms' },
  { label: 'Refund Policy', to: '/refunds' },
];

export const Header = forwardRef<HTMLElement>(function Header(_, ref) {
  const [open, setOpen] = useState(false);

  return (
    <header ref={ref} className="fixed top-0 left-0 right-0 z-50 glass-effect">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-2xl leading-none tracking-[-0.02em] text-foreground">PrintF</span>
            <span className="hidden sm:block h-3.5 w-px bg-border" aria-hidden="true" />
            <span className="hidden sm:block text-[0.6875rem] uppercase tracking-[0.16em] text-muted-foreground">Self-service printing</span>
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger aria-label="Open menu" className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface text-foreground transition-all duration-300 hover:shadow-elev-1 hover:-translate-y-px">
              <Menu size={18} strokeWidth={1.75} />
            </SheetTrigger>
            <SheetContent side="right" className="w-[19rem] border-border bg-background">
              <SheetHeader><SheetTitle className="font-display text-2xl tracking-[-0.02em]">Menu</SheetTitle></SheetHeader>
              <nav className="mt-8 flex flex-col">
                {menuLinks.map((link, i) => (
                  <Link key={link.to} to={link.to} onClick={() => setOpen(false)} className="group flex items-baseline gap-4 border-b border-border py-4 transition-colors duration-300 hover:text-foreground">
                    <span className="text-[0.625rem] tracking-[0.16em] text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-base text-foreground/90 transition-transform duration-300 group-hover:translate-x-1">{link.label}</span>
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
});
