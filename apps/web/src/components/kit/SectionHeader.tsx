"use client";

import * as React from "react";
import { Loader2, RefreshCw } from "lucide-react";
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
    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border/40">
      <div className="flex items-start gap-2.5 min-w-0">
        {icon && (
          <div className="flex size-8 shrink-0 items-center justify-center rounded bg-secondary/80 border border-border/60 text-[#FB4128] mt-0.5">
            {icon}
          </div>
        )}
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
              {title}
            </CardTitle>
            {count !== undefined && (
              <Badge variant="secondary" className="px-1.5 py-0 h-5 text-xs font-semibold rounded bg-secondary/80">
                {count}
              </Badge>
            )}
            {badge}
          </div>
          {description && (
            <CardDescription className="text-xs text-muted-foreground leading-relaxed">
              {description}
            </CardDescription>
          )}
          {error && <span className="text-xs text-destructive font-medium">{error}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
        {action}
        <Button
          variant="outline"
          size="sm"
          onClick={onRegenerate}
          disabled={regenerating}
          className="rounded h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground border-border/70 hover:bg-accent gap-1.5 transition-colors"
          title="Regenerate this section with AI"
        >
          <RefreshCw className={`size-3.5 ${regenerating ? "animate-spin text-[#FB4128]" : ""}`} />
          <span>{regenerating ? "Regenerating…" : "Regenerate"}</span>
        </Button>
      </div>
    </CardHeader>
  );
}
