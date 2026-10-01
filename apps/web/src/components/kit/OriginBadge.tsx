import type { Origin } from "@dossier/core";
import { cn } from "@/lib/utils";

const STYLE: Record<Origin, string> = {
  generated: "bg-white/[0.05] text-white/55",
  template: "bg-white/[0.05] text-white/55",
  edited: "bg-sky-500/10 text-sky-300",
  manual: "bg-emerald-500/10 text-emerald-300",
};

const pill = "inline-flex h-6 items-center rounded-lg px-2 text-xs font-semibold";

export function OriginBadge({ origin, pinned }: { origin: Origin; pinned?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className={cn(pill, STYLE[origin])}>{origin}</span>
      {pinned ? <span className={cn(pill, "bg-primary/15 text-[#ff7a5c]")}>pinned</span> : null}
    </div>
  );
}
