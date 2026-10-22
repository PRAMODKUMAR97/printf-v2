import { forwardRef } from 'react';
import { Printer } from 'lucide-react';

export const Header = forwardRef<HTMLElement>(function Header(_, ref) {
  return (
    <header ref={ref} className="fixed top-0 left-0 right-0 z-50 glass-effect">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl printf-gradient flex items-center justify-center shadow-lg">
              <Printer className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold printf-gradient-text font-display">
                PrintF
              </h1>
              <p className="text-xs text-muted-foreground">
                Self-Service Printing
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 text-success text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Online
            </span>
          </div>
        </div>
      </div>
    </header>
  );
});
