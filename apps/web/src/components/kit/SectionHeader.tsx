"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle } from "@/components/ui/card";

interface SectionHeaderProps {
  title: string;
  onRegenerate: () => void;
  regenerating: boolean;
  error?: string;
}

export function SectionHeader({ title, onRegenerate, regenerating, error }: SectionHeaderProps) {
  return (
    <CardHeader className="flex flex-row items-center justify-between gap-2">
      <div className="flex flex-col gap-0.5">
        <CardTitle className="text-base">{title}</CardTitle>
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
      </div>
      <Button variant="outline" size="sm" onClick={onRegenerate} disabled={regenerating}>
        {regenerating ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        Regenerate
      </Button>
    </CardHeader>
  );
}
