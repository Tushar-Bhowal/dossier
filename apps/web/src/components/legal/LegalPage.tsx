import * as React from "react";
import { Nav } from "@/components/landing/sections/Nav";
import { Footer } from "@/components/landing/sections/Footer";
import { Container } from "@/components/landing/SectionHeading";

export interface LegalSection {
  id: string;
  title: string;
  body: React.ReactNode;
}

export function LegalPage({
  title,
  intro,
  updated,
  sections,
}: {
  title: string;
  intro: React.ReactNode;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <>
      <Nav />
      <main id="top" className="w-full pb-24 pt-32 sm:pt-40">
        <Container className="grid gap-12 lg:grid-cols-[220px_minmax(0,720px)] lg:justify-center lg:gap-16">
          <nav aria-label="On this page" className="hidden lg:block">
            <div className="sticky top-32">
              <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-white/50">On this page</p>
              <ul className="mt-4 flex flex-col gap-1">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="block rounded-lg py-1.5 text-[15px] font-medium text-white/65 transition-colors hover:text-white"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <article className="min-w-0">
            <p className="text-sm font-semibold text-[#ff7a5c]">Last updated {updated}</p>
            <h1 className="mt-3 text-[40px] font-semibold leading-[1.1] tracking-[-0.04em] text-white sm:text-[52px]">
              {title}
            </h1>
            <div className="mt-6 text-lg leading-relaxed text-white/70">{intro}</div>

            <div className="mt-12 flex flex-col gap-12">
              {sections.map((s) => (
                <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-28">
                  <h2 id={`${s.id}-h`} className="text-[22px] font-semibold tracking-[-0.02em] text-white">
                    {s.title}
                  </h2>
                  <div className="mt-4 flex flex-col gap-4 text-base leading-relaxed text-white/75">{s.body}</div>
                </section>
              ))}
            </div>
          </article>
        </Container>
      </main>
      <Footer />
    </>
  );
}

export function Facts({ items }: { items: { label: string; text: React.ReactNode }[] }) {
  return (
    <dl className="flex flex-col divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-white/[0.02]">
      {items.map((item) => (
        <div key={item.label} className="grid gap-1 px-5 py-4 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-6">
          <dt className="text-[15px] font-semibold text-white">{item.label}</dt>
          <dd className="text-[15px] leading-relaxed text-white/70">{item.text}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-white/30">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
