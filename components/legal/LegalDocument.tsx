import type { ReactNode } from "react";

export interface LegalSection {
  /** Anchor id, so a section can be linked to directly (e.g. /terms#refunds). */
  id: string;
  /** Section number. Code and UI copy cite these, so keep them stable. */
  n: number;
  title: string;
  body: ReactNode;
}

/**
 * The shared layout for the Terms of Service and Privacy Policy: heading,
 * last-updated date, a short plain-English summary, a contents list and the
 * numbered sections.
 */
export function LegalDocument({
  title,
  accent,
  updated,
  summary,
  sections,
}: {
  title: string;
  accent: string;
  updated: string;
  summary: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <main className="min-h-screen bg-dark-darker">
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="max-w-3xl">
          <p className="font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-3.5">
            Legal
          </p>
          <h1 className="font-headline text-[32px] sm:text-4xl font-black italic leading-none tracking-tighter text-light mb-4">
            {title} <span className="text-primary">{accent}</span>
          </h1>
          <p className="text-[13px] text-muted-dark font-headline uppercase tracking-widest mb-10">
            Last updated: {updated}
          </p>

          <div className="rounded-[12px] border border-dark-lighter bg-dark px-5 py-4 mb-8">
            <p className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary mb-2">
              In short
            </p>
            <div className="text-[14px] text-muted-light leading-relaxed space-y-2">{summary}</div>
          </div>

          <nav aria-label="Contents" className="mb-12">
            <p className="font-headline text-[11px] font-bold uppercase tracking-widest text-light mb-3">
              Contents
            </p>
            <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[14px]">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-muted hover:text-primary transition-colors">
                    {s.n}. {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="space-y-10 text-[15px] text-muted leading-relaxed">
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="font-headline text-sm font-bold uppercase tracking-[0.15em] text-light mb-4">
                  {s.n}. {s.title}
                </h2>
                <div className="space-y-4">{s.body}</div>
              </section>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

/** A numbered clause inside a section, e.g. "5.3 Insurance". */
export function Clause({ n, title, children }: { n: string; title?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p>
        <span className="text-light font-semibold">
          {n}
          {title && <> {title}</>}
        </span>
      </p>
      {children}
    </div>
  );
}

export function Bullets({ children }: { children: ReactNode }) {
  return <ul className="list-disc pl-5 space-y-1.5 marker:text-muted-dark">{children}</ul>;
}

export function MailLink({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} className="text-primary hover:underline break-all">
      {email}
    </a>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-primary hover:underline">
      {children}
    </a>
  );
}
