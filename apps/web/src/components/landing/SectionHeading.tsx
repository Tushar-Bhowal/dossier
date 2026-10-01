import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./motion/Reveal";

export function Accent({ children }: { children: React.ReactNode }) {
  return <span className="text-gradient">{children}</span>;
}

export function Eyebrow({
  icon: Icon,
  children,
  className,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-3.5 text-sm font-medium text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur",
        className,
      )}
    >
      <span className="flex size-6 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Icon className="size-3.5" aria-hidden />
      </span>
      {children}
    </p>
  );
}

export function SectionHeading({
  icon,
  eyebrow,
  title,
  sub,
  className,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <Reveal className={cn("mx-auto flex max-w-3xl flex-col items-center text-center", className)}>
      <Eyebrow icon={icon}>{eyebrow}</Eyebrow>
      <h2 className="mt-6 text-balance text-[36px] font-semibold leading-[1.06] tracking-[-0.04em] text-white sm:text-[56px]">
        {title}
      </h2>
      {sub && (
        <p className="mt-5 max-w-2xl text-pretty text-[17px] leading-relaxed text-white/70 sm:text-xl">
          {sub}
        </p>
      )}
    </Reveal>
  );
}

export function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1200px] px-4 sm:px-6", className)}>{children}</div>;
}

export function Section({
  id,
  children,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("relative scroll-mt-24 py-24 sm:py-36", className)}>
      {children}
    </section>
  );
}

// A soft orange bloom in a card's corner — the "lit from inside" look instead of flat black panels.
export function cardGlow(position = "50% 0%") {
  return {
    backgroundImage: `radial-gradient(120% 80% at ${position}, rgba(251,65,40,0.10), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))`,
  };
}
