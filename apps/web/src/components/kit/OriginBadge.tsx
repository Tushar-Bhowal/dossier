import { Badge } from "@/components/ui/badge";
import type { Origin } from "@dossier/core";

const VARIANT: Record<Origin, "secondary" | "outline" | "default"> = {
  generated: "outline",
  template: "outline",
  edited: "secondary",
  manual: "default",
};

export function OriginBadge({ origin, pinned }: { origin: Origin; pinned?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Badge variant={VARIANT[origin]} className="text-[0.65rem] px-1.5 py-0 h-5 font-normal rounded-md">
        {origin}
      </Badge>
      {pinned ? (
        <Badge variant="secondary" className="text-[0.65rem] px-1.5 py-0 h-5 font-normal rounded-md">
          pinned
        </Badge>
      ) : null}
    </div>
  );
}
