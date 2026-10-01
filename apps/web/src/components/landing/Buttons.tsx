import Link from "next/link";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-10 px-4 text-[15px]",
  lg: "h-12 px-6 text-base",
};

// #dc3019 rather than the brand #fb4128: white text on the brand colour is 3.56:1, under AA's 4.5:1.
export const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#dc3019] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-2px_0_rgba(0,0,0,0.18),0_8px_32px_-8px_rgba(251,65,40,0.8)] transition-[background-color,transform,box-shadow] duration-200 hover:-translate-y-px hover:bg-[#c92c16] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-0 disabled:pointer-events-none disabled:opacity-70";

export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors duration-200 hover:bg-white/[0.09] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function PrimaryButton({
  href,
  size = "lg",
  className,
  children,
}: {
  href: string;
  size?: keyof typeof SIZES;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={cn(primaryButtonClass, SIZES[size], className)}>
      {children}
    </Link>
  );
}

export function SecondaryButton({
  href,
  size = "lg",
  className,
  children,
}: {
  href: string;
  size?: keyof typeof SIZES;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} className={cn(secondaryButtonClass, SIZES[size], className)}>
      {children}
    </a>
  );
}
