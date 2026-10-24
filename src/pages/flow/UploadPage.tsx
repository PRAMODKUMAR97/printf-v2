import { FileUpload } from '@/components/printf/FileUpload';
import { StepIndicator } from '@/components/printf/StepIndicator';
import { usePrintFlow } from '@/components/printf/flow/PrintFlowContext';
import heroPrinter from '@/assets/hero-printer.jpg';

const capabilities = [
  {
    index: '01',
    title: 'Any document',
    body: 'PDF, Word, PNG and JPEG land in the queue exactly as you designed them.',
  },
  {
    index: '02',
    title: 'Delivery OTP',
    body: 'Receive a four-digit code after your order is placed and share it only at delivery.',
  },
  {
    index: '03',
    title: 'College delivery',
    body: 'Upload, configure, pay and receive your order within 24 hours on campus.',
  },
];

const UploadPage = () => {
  const { uploadFile } = usePrintFlow();

  return (
    <>
      <section className="container mx-auto px-6 pb-4 pt-10">
        <StepIndicator currentStep="upload" />
        <FileUpload onFileSelect={uploadFile} selectedFile={null} />
      </section>

      <section className="container mx-auto px-6 pb-6 pt-12">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-8">
          <div className="animate-rise">
            <p className="eyebrow">Cloud printing · No account needed</p>
            <h1 className="mt-5 font-display text-display-sm text-foreground balance md:text-display-md">
              Print anything,
              <br />
              <span className="italic text-muted-foreground">anywhere</span> nearby.
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
              Upload a file, set your options and place your order. Your document is printed and
              delivered within 24 hours on campus.
            </p>

            <dl className="mt-10 flex items-stretch divide-x divide-border border-y border-border">
              {[
                { k: 'Setup time', v: '< 60s' },
                { k: 'From', v: '₹2' },
                { k: 'Accounts', v: 'None' },
              ].map((stat) => (
                <div key={stat.k} className="flex-1 py-5 pl-5 first:pl-0">
                  <dd className="stat-number text-3xl leading-none text-foreground">{stat.v}</dd>
                  <dt className="mt-2 text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
                    {stat.k}
                  </dt>
                </div>
              ))}
            </dl>
          </div>

          <div className="perspective-scene relative">
            <div className="animate-float-slow">
              <img
                src={heroPrinter}
                alt="A minimalist PrintF printer with sheets of paper floating in studio light"
                width={1536}
                height={1152}
                loading="eager"
                className="w-full select-none rounded-3xl object-cover mix-blend-multiply"
              />
            </div>
            <div
              className="pointer-events-none absolute inset-x-10 bottom-6 h-10 rounded-[50%] bg-foreground/[0.06] blur-2xl"
              aria-hidden="true"
            />
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="container mx-auto px-6 py-16">
          <h2 className="max-w-lg font-display text-3xl text-foreground balance">
            Built to feel like the machine belongs to you
          </h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
            {capabilities.map((capability) => (
              <article key={capability.index} className="lift bg-card px-7 py-8">
                <p className="font-display text-lg text-muted-foreground/70">{capability.index}</p>
                <h3 className="mt-5 font-sans text-base font-medium tracking-[-0.01em] text-foreground">
                  {capability.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                  {capability.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};
export default UploadPage;
