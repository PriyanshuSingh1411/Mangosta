import type { ReactNode } from "react";
import Link from "next/link";
import Navigation from "@/app/components/Navigation";
import Footer from "@/app/components/Footer";

/** Date shown as "Last updated" on the Privacy Policy and Terms. */
export const POLICIES_LAST_UPDATED = "9 October 2026";

export type LegalSection = { id: string; title: string; body: ReactNode };

/**
 * Shared layout for Privacy, Terms and FAQ: page heading, an "On this page"
 * list of sections, then the sections themselves.
 */
export default function LegalPage({
  eyebrow,
  title,
  intro,
  updated,
  sections,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  updated?: string;
  sections: LegalSection[];
  children?: ReactNode;
}) {
  return (
    <>
      <Navigation />
      <main
        id="main-content"
        className="min-h-screen bg-void px-5 pb-24 pt-28 sm:px-8 sm:pt-32 lg:px-12"
      >
        <div className="mx-auto max-w-4xl">
          <header className="border-b border-line pb-8 sm:pb-10">
            <p className="label-technical mb-4 text-stone">{eyebrow}</p>
            <h1 className="type-title text-bone">{title}</h1>
            {updated && <p className="mt-4 text-xs text-stone">Last updated: {updated}</p>}
            {intro && (
              <div className="mt-6 max-w-2xl text-sm leading-7 text-bone-dim sm:text-base sm:leading-8">
                {intro}
              </div>
            )}
          </header>

          {sections.length > 2 && (
            <nav aria-label="On this page" className="border-b border-line py-6">
              <p className="label-technical mb-3 text-stone">ON THIS PAGE</p>
              <ol className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                {sections.map((section, index) => (
                  <li key={section.id} className="min-w-0">
                    <Link
                      href={`#${section.id}`}
                      className="text-stone transition-colors hover:text-bone"
                    >
                      <span className="mr-2 font-mono text-xs text-stone-dark">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {section.title}
                    </Link>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <div className="legal-content">
            {sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-28 border-b border-line py-8 sm:py-10"
              >
                <h2 className="type-heading text-bone">
                  <span className="mr-3 font-mono text-sm text-stone-dark">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {section.title}
                </h2>
                <div className="mt-4 space-y-4 text-sm leading-7 text-bone-dim sm:text-[15px]">
                  {section.body}
                </div>
              </section>
            ))}
          </div>

          {children}
        </div>
      </main>
      <Footer />
    </>
  );
}

/** A bulleted list styled for the legal pages. */
export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-stone-dark">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

/** Inline link styled for the legal pages. */
export function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  const className = "text-bone underline decoration-line-strong underline-offset-4 hover:decoration-bone";
  return href.startsWith("/") ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
