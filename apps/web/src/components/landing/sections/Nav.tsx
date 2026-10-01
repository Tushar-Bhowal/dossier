"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "../motion/Reveal";
import { PrimaryButton } from "../Buttons";

const LINKS = [
  { href: "#product", label: "Product" },
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#faq", label: "FAQ" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
      <div
        className={cn(
          "mx-auto max-w-[1080px] rounded-lg border backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300",
          scrolled || open
            ? "border-white/10 bg-[#0e0e0e]/80 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.8)]"
            : "border-white/[0.07] bg-white/[0.03]",
        )}
      >
        <nav aria-label="Main" className="flex h-14 items-center justify-between pl-4 pr-2 sm:h-16 sm:pl-5">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <Image src="/logo.png" alt="" width={30} height={30} priority className="size-[30px]" />
            <span className="text-[17px] font-bold tracking-[-0.02em]">Dossier</span>
          </Link>

          <ul className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="rounded-lg px-3.5 py-2 text-[15px] font-medium text-white/70 transition-colors hover:text-white"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-1.5">
            <Link
              href="/login"
              className="hidden rounded-lg px-3.5 py-2 text-[15px] font-medium text-white/70 transition-colors hover:text-white sm:block"
            >
              Sign in
            </Link>
            <PrimaryButton href="/login?mode=register" size="sm">
              Start free <ArrowUpRight className="size-4" aria-hidden />
            </PrimaryButton>
            <button
              type="button"
              className="flex size-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/5 md:hidden"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </nav>

        <AnimatePresence>
          {open && (
            <motion.div
              id="mobile-menu"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="overflow-hidden md:hidden"
            >
              <ul className="flex flex-col gap-1 border-t border-white/[0.06] p-2">
                {[...LINKS, { href: "/login", label: "Sign in" }].map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-3 py-3 text-base font-medium text-white/75 hover:bg-white/5 hover:text-white"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
