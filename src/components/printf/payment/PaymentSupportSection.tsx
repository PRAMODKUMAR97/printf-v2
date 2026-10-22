const links = [
  { label: 'Help', href: '/support' },
  { label: 'Support', href: '/contact' },
  { label: 'Refund policy', href: '/refunds' },
  { label: 'Terms', href: '/terms' },
];
export function PaymentSupportSection() {
  return (
    <div className="space-y-3 border-t border-border pt-5">
      <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {links.map((link) => <a key={link.label} href={link.href} className="text-xs text-muted-foreground underline decoration-transparent underline-offset-4 transition-colors duration-300 hover:text-foreground hover:decoration-hairline">{link.label}</a>)}
      </nav>
      <p className="text-center text-xs text-muted-foreground">Questions? <span className="font-medium text-foreground">support@printfapp.site</span></p>
    </div>
  );
}
