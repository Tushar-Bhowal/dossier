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
    <div className="flex items-center gap-1">
      <Badge variant={VARIANT[origin]} className="text-[0.65rem]">
        {origin}
      </Badge>
      {pinned ? (
        <Badge variant="secondary" className="text-[0.65rem]">
          pinned
        </Badge>
      ) : null}
    </div>
  );
}
