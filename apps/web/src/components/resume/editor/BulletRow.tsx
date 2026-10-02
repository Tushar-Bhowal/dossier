"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, Lightbulb, LoaderCircle, Trash2 } from "lucide-react";
import { redact, type Bullet, type LintHint } from "@dossier/core/resume";
import { improveLine } from "@/lib/resume/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AiErrorNotice } from "../AiStatus";

export function Hints({ hints }: { hints: LintHint[] | undefined }) {
  if (!hints?.length) return null;
  return (
    <ul className="mt-1.5 flex flex-col gap-1">
      {hints.map((h) => (
        <li key={h.rule} className="flex items-start gap-1.5 text-[13px] font-medium leading-snug text-amber-200/90">
          <Lightbulb className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {h.message}
        </li>
      ))}
    </ul>
  );
}

export function BulletRow({
  bullet,
  index,
  count,
  hints,
  facts,
  role,
  onChange,
  onMove,
  onDelete,
  onEmpty,
}: {
  bullet: Bullet;
  index: number;
  count: number;
  hints: LintHint[] | undefined;
  // Texts of the confirmed facts this line cites — all a rewrite may draw on.
  facts: string[];
  role?: string;
  onChange: (text: string) => void;
  onMove: (delta: number) => void;
  onDelete: () => void;
  onEmpty: () => void;
}) {
  const [suggestion, setSuggestion] = React.useState<{ text: string; unchanged: boolean } | null>(null);
  const improve = useMutation({
    mutationFn: () =>
      improveLine({
        text: redact(bullet.text.trim()).text,
        facts: facts.map((f) => redact(f).text),
        ...(role ? { role } : {}),
      }),
    onSuccess: (result) => setSuggestion(result),
  });

  return (
    <li id={`bullet-${bullet.id}`} className="group/bullet scroll-mt-24">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <span className="mt-3 size-1.5 shrink-0 rounded-full bg-white/40" aria-hidden />
          <Textarea
            value={bullet.text}
            onChange={(e) => {
              onChange(e.target.value);
              setSuggestion(null);
            }}
            onBlur={() => {
              if (!bullet.text.trim()) onEmpty();
            }}
            aria-label={`Line ${index + 1}`}
            autoFocus={bullet.origin === "user" && bullet.text === ""}
            maxLength={300}
            rows={1}
            className="min-h-10 resize-none py-2 text-[15px] leading-relaxed md:text-[15px]"
          />
        </div>
        <div className="flex shrink-0 items-center justify-end gap-0.5 pl-3.5 sm:pl-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => improve.mutate()}
            disabled={!bullet.text.trim() || improve.isPending}
            className="text-white/70"
          >
            {improve.isPending && <LoaderCircle className="size-3.5 animate-spin" />}
            Improve
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move line up">
            <ArrowUp className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onMove(1)} disabled={index === count - 1} aria-label="Move line down">
            <ArrowDown className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Delete line">
            <Trash2 className="size-4 text-white/60" />
          </Button>
        </div>
      </div>
      <div className="pl-3.5">
        {bullet.origin === "fallback" && (
          <Badge variant="outline" className="mt-1.5 border-sky-500/30 bg-sky-500/10 text-sky-200">
            Kept in your words
          </Badge>
        )}
        <Hints hints={hints} />
        {improve.error && <AiErrorNotice className="mt-2" error={improve.error} onRetry={() => improve.mutate()} />}
        {suggestion &&
          (suggestion.unchanged ? (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-emerald-300" role="status">
              <Check className="size-4" aria-hidden />
              This line already reads well.
            </p>
          ) : (
            <div className="mt-2 rounded-lg border border-primary/30 bg-primary/[0.07] p-3.5" role="status">
              <p className="text-[13px] font-semibold text-[#ff7a5c]">Suggested</p>
              <p className="mt-1 text-[15px] font-medium leading-relaxed text-white">{suggestion.text}</p>
              <p className="mt-1.5 text-[13px] font-medium text-white/60">
                Uses only this line{facts.length ? " and the facts behind it" : ""} — nothing new is added.
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    onChange(suggestion.text);
                    setSuggestion(null);
                  }}
                >
                  Use this
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSuggestion(null)}>
                  Keep mine
                </Button>
              </div>
            </div>
          ))}
      </div>
    </li>
  );
}
