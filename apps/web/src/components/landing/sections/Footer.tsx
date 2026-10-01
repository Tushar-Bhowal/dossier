import Image from "next/image";
import Link from "next/link";
import { Container } from "../SectionHeading";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { href: "#product", label: "Platform" },
      { href: "#how", label: "How it works" },
      { href: "#features", label: "Features" },
      { href: "#loop", label: "The loop" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "#principles", label: "Principles" },
      { href: "#faq", label: "FAQ" },
    ],
  },
  {
    heading: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/register", label: "Create account" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="overflow-hidden border-t border-white/[0.06] pt-14">
      <Container className="flex flex-col gap-12 sm:flex-row sm:justify-between">
        <div className="max-w-xs">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <Image src="/logo.png" alt="" width={28} height={28} className="size-7" />
            <span className="text-[17px] font-bold tracking-[-0.02em]">Dossier</span>
          </Link>
          <p className="mt-4 text-base leading-relaxed text-white/65">
            Interview prep for any role, researched for you.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
          {COLUMNS.map((c) => (
            <div key={c.heading}>
              <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-white/50">
                {c.heading}
              </p>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-[15px] font-medium text-white/70 transition-colors hover:text-white"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>
      <Container className="mt-14">
        <div className="flex items-center justify-between border-t border-white/[0.06] pt-6">
          <p className="text-sm text-white/55">© {new Date().getFullYear()} Dossier</p>
          <a href="#top" className="text-sm text-white/55 transition-colors hover:text-foreground">
            Back to top
          </a>
        </div>
      </Container>
      <div aria-hidden className="pointer-events-none mt-10 select-none overflow-hidden">
        <p className="text-center text-[26vw] font-semibold leading-[0.8] tracking-[-0.06em] text-transparent [background-image:linear-gradient(to_bottom,rgba(255,255,255,0.09),transparent_85%)] [-webkit-background-clip:text] [background-clip:text] xl:text-[340px]">
          Dossier
        </p>
      </div>
    </footer>
  );
}
