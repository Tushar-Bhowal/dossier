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
    <Card>
      <SectionHeader
        icon={<Building2 className="size-4" />}
        title={`${companyName} brief`}
        description="What the company does and how it hires, from its own pages."
        onRegenerate={() => void editor.regenerate("company_brief", "company_brief")}
        regenerating={editor.regenerating.has("company_brief")}
        error={editor.regenerateError.company_brief}
      />

      <CardContent className="grid gap-4 pt-5 lg:grid-cols-2">
        {/* Executive Summary */}
        <div className="flex flex-col gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] p-5">
          <div className="flex items-center gap-2">
            <Briefcase className="size-4 text-[#ff7a5c]" />
            <h3 className="text-[15px] font-semibold text-white">Summary</h3>
          </div>
          <EditableField
            value={brief.summary}
            onChange={(value) =>
              editor.editField("company_brief.summary", editCompanyBriefField("summary", value))
            }
            status={editor.status["company_brief.summary"]}
            ariaLabel="Company brief summary"
            placeholder="High-level overview of the company, mission, and industry scale…"
            rows={2}
            className="text-[15px] leading-relaxed text-white/80"
          />
        </div>

        {/* What They Do & Engineering Focus */}
        <div className="flex flex-col gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] p-5">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-[#ff7a5c]" />
            <h3 className="text-[15px] font-semibold text-white">What they do</h3>
          </div>
          <EditableField
            value={brief.what_they_do}
            onChange={(value) =>
              editor.editField("company_brief.what_they_do", editCompanyBriefField("what_they_do", value))
            }
            status={editor.status["company_brief.what_they_do"]}
            ariaLabel="What the company does"
            placeholder="Core products, revenue drivers, engineering challenges, and technical architecture…"
            rows={2}
            className="text-[15px] leading-relaxed text-white/80"
          />
        </div>

        {/* Verified Research Sources */}
        {brief.sources.length > 0 && (
          <div className="flex flex-col gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] p-5 lg:col-span-2">
            <div className="flex items-center gap-2 text-[15px] font-semibold text-white">
              <Link2 className="size-4 text-[#ff7a5c]" />
              <span>Sources ({brief.sources.length})</span>
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
                    className="group inline-flex h-8 max-w-full items-center gap-1.5 truncate rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[13px] text-white/60 transition-colors hover:border-white/20 hover:text-white"
                    title={s}
                  >
                    <Globe className="size-3 text-muted-foreground/70 shrink-0 group-hover:text-[#ff7a5c] transition-colors" />
                    <span className="font-medium text-foreground/90 truncate">{hostname}</span>
                    {path && (
                      <span className="text-xs text-muted-foreground truncate opacity-70">{path}</span>
                    )}
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
