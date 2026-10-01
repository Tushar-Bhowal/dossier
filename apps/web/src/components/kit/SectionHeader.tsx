"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SectionHeaderProps {
  title: string;
  icon?: React.ReactNode;
  description?: string;
  count?: number;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  onRegenerate: () => void;
  regenerating: boolean;
  error?: string;
}

export function SectionHeader({
  title,
  icon,
  description,
  count,
  badge,
  action,
  onRegenerate,
  regenerating,
  error,
}: SectionHeaderProps) {
  return (
    <CardHeader className="flex flex-col gap-4 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3.5">
        {icon && (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-[#ff7a5c] ring-1 ring-primary/25 [&_svg]:size-[18px]">
            {icon}
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-xl font-semibold tracking-[-0.02em] text-white">{title}</CardTitle>
            {count !== undefined && <Badge variant="outline">{count}</Badge>}
            {badge}
          </div>
          {description && (
            <CardDescription className="text-sm leading-relaxed text-white/60">{description}</CardDescription>
          )}
          {error && <span className="text-sm font-medium text-destructive">{error}</span>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
        {action}
        <Button
          variant="outline"
          onClick={onRegenerate}
          disabled={regenerating}
          title="Regenerate this section"
        >
          <RefreshCw className={`size-4 ${regenerating ? "animate-spin text-[#ff7a5c]" : ""}`} />
          <span>{regenerating ? "Regenerating…" : "Regenerate"}</span>
        </Button>
      </div>
    </CardHeader>
  );
}
