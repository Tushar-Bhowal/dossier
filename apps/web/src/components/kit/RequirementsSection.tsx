"use client";

import { AnimatePresence, motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EditableField } from "./EditableField";
import { ItemControls } from "./ItemControls";
import { OriginBadge } from "./OriginBadge";
import { SectionHeader } from "./SectionHeader";
import { addRequirement, deleteRequirement, editRequirementText, toggleRequirementPin } from "./kitMutations";
import type { KitEditor } from "./useKitEditor";

export function RequirementsSection({ editor }: { editor: KitEditor }) {
  const requirements = [...editor.kit.role.requirements].sort((a, b) => a.order - b.order);

  return (
    <Card>
      <SectionHeader
        title="Requirements"
        onRegenerate={() => void editor.regenerate("requirements", "requirements")}
        regenerating={editor.regenerating.has("requirements")}
        error={editor.regenerateError.requirements}
      />
      <CardContent>
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {requirements.map((r) => (
              <motion.li
                key={r.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-start gap-2 rounded-md border border-border p-2"
              >
                <Badge variant={r.priority === "must" ? "default" : "secondary"} className="mt-1 shrink-0">
                  {r.priority}
                </Badge>
                <div className="flex-1">
                  <EditableField
                    value={r.text}
                    onChange={(value) => editor.editField(`requirement:${r.id}.text`, editRequirementText(r.id, value))}
                    status={editor.status[`requirement:${r.id}.text`]}
                    ariaLabel={`Requirement text (${r.kind})`}
                    rows={1}
                  />
                  <OriginBadge origin={r.origin} pinned={r.pinned} />
                </div>
                <ItemControls
                  pinned={r.pinned}
                  onTogglePin={() => editor.mutateNow(`requirement:${r.id}.pinned`, toggleRequirementPin(r.id))}
                  onDelete={() => editor.mutateNow(`requirement:${r.id}.delete`, deleteRequirement(r.id))}
                  deleteLabel="Delete requirement"
                />
              </motion.li>
            ))}
          </AnimatePresence>
          {requirements.length === 0 ? <li className="text-sm text-muted-foreground">No requirements extracted.</li> : null}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => editor.mutateNow("requirements.add", addRequirement())}
        >
          Add requirement
        </Button>
      </CardContent>
    </Card>
  );
}
