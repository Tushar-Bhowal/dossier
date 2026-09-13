"use client";

import * as React from "react";
import { Building2, Briefcase, Globe, ExternalLink, Link2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EditableField } from "./EditableField";
import { SectionHeader } from "./SectionHeader";
import { editCompanyBriefField } from "./kitMutations";
import type { KitEditor } from "./useKitEditor";

export function CompanyBriefCard({ editor }: { editor: KitEditor }) {
  const { kit } = editor;
  const brief = kit.company_brief;
  const companyName = kit.source?.company || "Company";

  const formatSourceUrl = (rawUrl: string): { hostname: string; path: string } => {
    try {
      const url = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
      return {
        hostname: url.hostname.replace(/^www\./, ""),
        path: url.pathname === "/" ? "" : url.pathname,
      };
    } catch {
      return { hostname: rawUrl, path: "" };
    }
  };

  return (
    <Card className="rounded-lg border-border/80">
      <SectionHeader
        icon={<Building2 className="size-4" />}
        title={`${companyName} Dossier & Brief`}
        description="Key company intelligence, business model, and engineering context gathered from verified sources."
        onRegenerate={() => void editor.regenerate("company_brief", "company_brief")}
        regenerating={editor.regenerating.has("company_brief")}
        error={editor.regenerateError.company_brief}
      />

      <CardContent className="pt-4 flex flex-col gap-4">
        {/* Executive Summary */}
        <div className="rounded border border-border/60 bg-card/40 p-3.5 sm:p-4 flex flex-col gap-2 transition-colors hover:border-border">
          <div className="flex items-center gap-2">
            <Briefcase className="size-3.5 text-[#FB4128]" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Executive Summary
            </h4>
          </div>
          <EditableField
            value={brief.summary}
            onChange={(value) => editor.editField("company_brief.summary", editCompanyBriefField("summary", value))}
            status={editor.status["company_brief.summary"]}
            ariaLabel="Company brief summary"
            placeholder="High-level overview of the company, mission, and industry scale…"
            rows={2}
            className="text-sm leading-relaxed text-foreground bg-transparent border-border/40 hover:border-border focus:border-border/80"
          />
        </div>

        {/* What They Do & Engineering Focus */}
        <div className="rounded border border-border/60 bg-card/40 p-3.5 sm:p-4 flex flex-col gap-2 transition-colors hover:border-border">
          <div className="flex items-center gap-2">
            <Globe className="size-3.5 text-[#FB4128]" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Core Business & Technical Domains
            </h4>
          </div>
          <EditableField
            value={brief.what_they_do}
            onChange={(value) => editor.editField("company_brief.what_they_do", editCompanyBriefField("what_they_do", value))}
            status={editor.status["company_brief.what_they_do"]}
            ariaLabel="What the company does"
            placeholder="Core products, revenue drivers, engineering challenges, and technical architecture…"
            rows={2}
            className="text-sm leading-relaxed text-foreground bg-transparent border-border/40 hover:border-border focus:border-border/80"
          />
        </div>

        {/* Verified Research Sources */}
        {brief.sources.length > 0 && (
          <div className="rounded border border-border/50 bg-muted/20 p-3 sm:p-3.5 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Link2 className="size-3.5 text-muted-foreground/80" />
              <span>Verified Intelligence Sources ({brief.sources.length})</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-0.5">
              {brief.sources.map((s) => {
                const { hostname, path } = formatSourceUrl(s);
                return (
                  <a
                    key={s}
                    href={s.startsWith("http") ? s : `https://${s}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded border border-border/60 bg-background/80 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-border hover:bg-background transition-colors group max-w-full truncate"
                    title={s}
                  >
                    <Globe className="size-3 text-muted-foreground/70 shrink-0 group-hover:text-[#FB4128] transition-colors" />
                    <span className="font-medium text-foreground/90 truncate">{hostname}</span>
                    {path && <span className="text-[11px] text-muted-foreground truncate opacity-70">{path}</span>}
                    <ExternalLink className="size-2.5 opacity-50 shrink-0 group-hover:opacity-100 transition-opacity ml-0.5" />
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
