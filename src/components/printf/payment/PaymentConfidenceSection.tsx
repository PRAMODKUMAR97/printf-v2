const items = ['Instant on-screen receipt', 'Invoice on request', 'Refunded if the print fails', 'Support around the clock'];
export function PaymentConfidenceSection() {
  return (
    <section className="panel-sunken px-6 py-5">
      <h4 className="text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">What's included</h4>
      <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {items.map((item) => <li key={item} className="flex items-start gap-2.5 text-xs text-muted-foreground"><span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-accent" />{item}</li>)}
      </ul>
    </section>
  );
}
