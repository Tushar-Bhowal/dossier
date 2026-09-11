"use client";

import { Card, CardContent } from "@/components/ui/card";
import { EditableField } from "./EditableField";
import { SectionHeader } from "./SectionHeader";
import { editCompanyBriefField } from "./kitMutations";
import type { KitEditor } from "./useKitEditor";

export function CompanyBriefCard({ editor }: { editor: KitEditor }) {
  const { kit } = editor;
  const brief = kit.company_brief;

  return (
    <Card>
      <SectionHeader
        title="Company brief"
        onRegenerate={() => void editor.regenerate("company_brief", "company_brief")}
        regenerating={editor.regenerating.has("company_brief")}
        error={editor.regenerateError.company_brief}
      />
      <CardContent className="flex flex-col gap-3 text-sm">
        <EditableField
          value={brief.summary}
          onChange={(value) => editor.editField("company_brief.summary", editCompanyBriefField("summary", value))}
          status={editor.status["company_brief.summary"]}
          ariaLabel="Company brief summary"
          rows={2}
        />
        <EditableField
          value={brief.what_they_do}
          onChange={(value) => editor.editField("company_brief.what_they_do", editCompanyBriefField("what_they_do", value))}
          status={editor.status["company_brief.what_they_do"]}
          ariaLabel="What the company does"
          rows={2}
        />
        {brief.sources.length > 0 ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Sources</span>
            <ul className="flex flex-col gap-0.5">
              {brief.sources.map((s) => (
                <li key={s} className="min-w-0 truncate text-xs text-muted-foreground">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
