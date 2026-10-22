import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Header } from '@/components/printf/Header';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { PageContent, Section } from './content';
import { aboutContent, contactContent, supportContent, faqsContent, privacyContent, termsContent, refundsContent } from './content';

function hasItems(section: Section): section is Extract<Section, { items: unknown }> {
  return 'items' in section;
}

function InfoPage({ eyebrow, title, intro, note, sections }: PageContent) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-3xl px-6 pb-24 pt-32">
        <Link to="/printers" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground transition-colors duration-300 hover:text-foreground">
          <ArrowLeft size={14} strokeWidth={1.75} /> Back to printing
        </Link>
        <p className="mt-10 text-[0.625rem] uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl leading-[1.1] tracking-[-0.02em] text-foreground sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">{intro}</p>
        {note && <p className="mt-6 border-l border-border pl-4 text-xs leading-relaxed text-muted-foreground/80">{note}</p>}
        <div className="mt-14 space-y-12">
          {sections.map((section) => (
            <section key={section.heading} className="animate-fade-in">
              <h2 className="text-sm uppercase tracking-[0.14em] text-foreground">{section.heading}</h2>
              {hasItems(section) ? (
                <Accordion type="single" collapsible className="mt-2 border-t border-border">
                  {section.items.map((item) => (
                    <AccordionItem key={item.q} value={item.q} className="border-border">
                      <AccordionTrigger className="text-left text-sm text-foreground hover:no-underline">{item.q}</AccordionTrigger>
                      <AccordionContent className="space-y-3 pb-5">
                        {item.a.map((p) => <p key={p} className="text-sm leading-relaxed text-muted-foreground">{p}</p>)}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="mt-4 space-y-3 border-t border-border pt-4">
                  {section.body.map((p) => <p key={p} className="text-sm leading-relaxed text-muted-foreground">{p}</p>)}
                </div>
              )}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

export function AboutPage() { return <InfoPage {...aboutContent} />; }
export function ContactPage() { return <InfoPage {...contactContent} />; }
export function SupportPage() { return <InfoPage {...supportContent} />; }
export function FaqsPage() { return <InfoPage {...faqsContent} />; }
export function PrivacyPage() { return <InfoPage {...privacyContent} />; }
export function TermsPage() { return <InfoPage {...termsContent} />; }
export function RefundsPage() { return <InfoPage {...refundsContent} />; }
