"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ClipboardList, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EditableField } from "./EditableField";
import { ItemControls } from "./ItemControls";
import { OriginBadge } from "./OriginBadge";
import { SectionHeader } from "./SectionHeader";
import { AddRequirementDialog, type NewRequirement } from "./AddRequirementDialog";
import {
  addRequirement,
  deleteRequirement,
  editRequirementText,
  toggleRequirementPin,
  toggleRequirementPriority,
} from "./kitMutations";
import { toast } from "@/components/ui/toast";
import type { KitEditor } from "./useKitEditor";

export function RequirementsSection({ editor }: { editor: KitEditor }) {
  const [filter, setFilter] = React.useState<"all" | "must" | "nice">("all");

  const rawRequirements = editor.kit.role.requirements;
  // Pinned items stay prominent, sorted by order
  const sortedRequirements = [...rawRequirements].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return a.order - b.order;
  });

  const filtered = sortedRequirements.filter((r) => {
    if (filter === "must") return r.priority === "must";
    if (filter === "nice") return r.priority === "nice";
    return true;
  });

  const mustCount = rawRequirements.filter((r) => r.priority === "must").length;
  const niceCount = rawRequirements.filter((r) => r.priority === "nice").length;

  const [addOpen, setAddOpen] = React.useState(false);

  const handleAddRequirement = async (content: NewRequirement) => {
    await editor.mutateNow("requirements.add", addRequirement(content));
    toast.success("Requirement added", {
      description: `Added as a ${content.priority === "must" ? "must-have" : "nice-to-have"}.`,
    });
  };

  return (
    <Card>
      <SectionHeader
        icon={<ClipboardList className="size-4" />}
        title="Role requirements"
        count={rawRequirements.length}
        description="What the job description asks for. Every question traces back to one of these."
        onRegenerate={() => void editor.regenerate("requirements", "requirements")}
        regenerating={editor.regenerating.has("requirements")}
        error={editor.regenerateError.requirements}
        action={
          <Button type="button" variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="size-4 text-[#ff7a5c]" />
            <span>Add requirement</span>
          </Button>
        }
      />

      <CardContent className="flex flex-col gap-4 pt-5">
        {rawRequirements.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="group"
              aria-label="Filter requirements"
              className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1"
            >
              {(
                [
                  ["all", `All (${rawRequirements.length})`],
                  ["must", `Must-have (${mustCount})`],
                  ["nice", `Nice-to-have (${niceCount})`],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={`h-8 rounded-lg px-3 text-sm font-semibold transition-colors ${
                    filter === value
                      ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                      : "text-white/55 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-[13px] text-white/45">
              Click a priority tag to switch must / nice-to-have
            </span>
          </div>
        )}

        {/* Requirements list */}
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          <AnimatePresence initial={false}>
            {filtered.map((r) => {
              const isMust = r.priority === "must";
              return (
                <motion.li
                  key={r.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className={`group relative flex flex-col gap-2 rounded-lg border bg-[#141414] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:border-white/[0.14] sm:flex-row sm:items-start sm:gap-4 ${
                    r.pinned ? "border-primary/30 bg-primary/[0.05]" : "border-white/[0.08]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      editor.mutateNow(`requirement:${r.id}.priority`, toggleRequirementPriority(r.id));
                      toast.success(`Marked as ${isMust ? "nice-to-have" : "must-have"}`);
                    }}
                    title={`Click to switch to ${isMust ? "nice-to-have" : "must-have"}`}
                    className={`mt-1.5 inline-flex h-7 w-fit shrink-0 items-center rounded-lg px-2.5 text-xs font-bold transition-transform active:scale-95 sm:w-28 sm:justify-center ${
                      isMust
                        ? "bg-[#dc3019] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] hover:bg-[#c92c16]"
                        : "bg-white/[0.06] text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {isMust ? "Must-have" : "Nice-to-have"}
                  </button>

                  <div className="min-w-0 flex-1">
                    <EditableField
                      value={r.text}
                      onChange={(value) =>
                        editor.editField(`requirement:${r.id}.text`, editRequirementText(r.id, value))
                      }
                      status={editor.status[`requirement:${r.id}.text`]}
                      ariaLabel={`Requirement text (${r.kind || "general"})`}
                      placeholder="Describe the competency or requirement…"
                      rows={1}
                      className="text-[15px] font-medium leading-relaxed text-white/90"
                    />
                  </div>

                  <div className="flex shrink-0 items-center gap-2 sm:mt-1.5">
                    {r.kind && (
                      <span className="inline-flex h-6 items-center rounded-lg bg-white/[0.05] px-2 text-xs font-semibold capitalize text-white/60">
                        {r.kind}
                      </span>
                    )}
                    <OriginBadge origin={r.origin} pinned={r.pinned} />
                    <ItemControls
                      pinned={r.pinned}
                      onTogglePin={() => {
                        editor.mutateNow(`requirement:${r.id}.pinned`, toggleRequirementPin(r.id));
                        toast.success(r.pinned ? "Requirement unpinned" : "Requirement pinned");
                      }}
                      onDelete={() => editor.mutateNow(`requirement:${r.id}.delete`, deleteRequirement(r.id))}
                      deleteLabel="Delete requirement"
                    />
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="rounded-lg border border-dashed border-border/70 p-6 text-center flex flex-col items-center justify-center gap-2">
              <ShieldCheck className="size-8 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">
                {rawRequirements.length === 0
                  ? "No requirements extracted yet. Click Add requirement or Regenerate to populate."
                  : `No ${filter === "must" ? "must-have" : "nice-to-have"} requirements found.`}
              </p>
              {rawRequirements.length === 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddOpen(true)}
                  className="rounded-lg text-xs gap-1 mt-1"
                >
                  <Plus className="size-3 text-[#ff7a5c]" />
                  <span>Add your first requirement</span>
                </Button>
              )}
            </div>
          )}
        </ul>
      </CardContent>

      <AddRequirementDialog open={addOpen} onOpenChange={setAddOpen} onAdd={handleAddRequirement} />
    </Card>
  );
}
