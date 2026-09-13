"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ClipboardList, Plus, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EditableField } from "./EditableField";
import { ItemControls } from "./ItemControls";
import { OriginBadge } from "./OriginBadge";
import { SectionHeader } from "./SectionHeader";
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

  const handleAddRequirement = () => {
    editor.mutateNow("requirements.add", addRequirement());
    toast.success("Requirement added", {
      description: "Added a new editable role requirement.",
    });
  };

  return (
    <Card className="rounded-lg border-border/80">
      <SectionHeader
        icon={<ClipboardList className="size-4" />}
        title="Role Requirements"
        count={rawRequirements.length}
        description="Core technical and behavioral criteria extracted from the job description."
        onRegenerate={() => void editor.regenerate("requirements", "requirements")}
        regenerating={editor.regenerating.has("requirements")}
        error={editor.regenerateError.requirements}
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddRequirement}
            className="rounded h-8 px-2.5 text-xs text-foreground font-medium gap-1.5 border-border/70 hover:bg-accent transition-colors"
          >
            <Plus className="size-3.5 text-[#FB4128]" />
            <span>Add requirement</span>
          </Button>
        }
      />

      <CardContent className="pt-4 flex flex-col gap-3">
        {/* Filter bar */}
        {rawRequirements.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
            <div className="flex items-center gap-1.5 p-0.5 rounded bg-muted/40 border border-border/40 text-xs">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  filter === "all"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({rawRequirements.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("must")}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  filter === "must"
                    ? "bg-background text-[#FB4128] font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Must-have ({mustCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter("nice")}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  filter === "nice"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Nice-to-have ({niceCount})
              </button>
            </div>

            <span className="text-[11px] text-muted-foreground">
              Tip: Click priority badge to toggle Must / Nice-to-have
            </span>
          </div>
        )}

        {/* Requirements list */}
        <ul className="flex flex-col gap-2.5 list-none p-0 m-0">
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
                  className={`group relative rounded border transition-all p-3 sm:p-3.5 flex flex-col gap-2 bg-card/40 hover:bg-card hover:border-border ${
                    isMust ? "border-l-2 border-l-[#FB4128] border-border/60" : "border-border/60"
                  } ${r.pinned ? "ring-1 ring-primary/20 bg-primary/5" : ""}`}
                >
                  {/* Top line: Priority, Kind, Origin, Controls */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          editor.mutateNow(`requirement:${r.id}.priority`, toggleRequirementPriority(r.id));
                          toast.success(`Marked as ${isMust ? "nice-to-have" : "must-have"}`);
                        }}
                        title={`Click to switch to ${isMust ? "nice-to-have" : "must-have"}`}
                        className="transition-transform active:scale-95"
                      >
                        <Badge
                          variant={isMust ? "default" : "secondary"}
                          className={`text-[0.68rem] px-2 py-0.5 font-medium rounded cursor-pointer ${
                            isMust
                              ? "bg-[#FB4128] text-white hover:bg-[#e03720]"
                              : "bg-secondary/80 text-muted-foreground hover:text-foreground hover:bg-secondary"
                          }`}
                        >
                          {isMust ? "must-have" : "nice-to-have"}
                        </Badge>
                      </button>

                      {r.kind && (
                        <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground/70 px-1.5 py-0.5 rounded bg-muted/40 border border-border/40">
                          {r.kind}
                        </span>
                      )}

                      <OriginBadge origin={r.origin} pinned={r.pinned} />
                    </div>

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

                  {/* Requirement Text */}
                  <div className="pt-0.5">
                    <EditableField
                      value={r.text}
                      onChange={(value) => editor.editField(`requirement:${r.id}.text`, editRequirementText(r.id, value))}
                      status={editor.status[`requirement:${r.id}.text`]}
                      ariaLabel={`Requirement text (${r.kind || "general"})`}
                      placeholder="Describe the competency or requirement…"
                      rows={1}
                      className="bg-transparent border-border/40 hover:border-border focus:border-border/80 text-sm leading-relaxed text-foreground"
                    />
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="rounded border border-dashed border-border/70 p-6 text-center flex flex-col items-center justify-center gap-2">
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
                  onClick={handleAddRequirement}
                  className="rounded text-xs gap-1 mt-1"
                >
                  <Plus className="size-3 text-[#FB4128]" />
                  <span>Add your first requirement</span>
                </Button>
              )}
            </div>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
