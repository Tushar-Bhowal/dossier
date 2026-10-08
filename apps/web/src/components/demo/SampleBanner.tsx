import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

// Shown on every screen that runs on demo data until its backend is connected.
export function SampleBanner({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-medium leading-relaxed text-white/70",
        className,
      )}
    >
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-white/60" aria-hidden />
      <span>
        <span className="font-semibold text-white">Sample data.</span> {children}
      </span>
    </p>
  );
}
