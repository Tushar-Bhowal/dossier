"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CreateRoadmapRequest, type RoadmapKind } from "@dossier/core/roadmap";
import { AlertCircle, Briefcase, GraduationCap, LoaderCircle } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AiErrorNotice } from "@/components/resume/AiStatus";
import { createRoadmap, roadmapKeys } from "@/lib/roadmap/api";
import { cn } from "@/lib/utils";

export interface RoadmapDraft {
  kind: RoadmapKind;
  subject: string;
  company?: string;
}

const EXAMPLES: Record<RoadmapKind, string[]> = {
  role: ["Staff nurse", "Primary school teacher", "Frontend engineer", "Audit associate"],
  skill: ["Excel", "Public speaking", "JavaScript", "Spoken English"],
};

const KINDS: { value: RoadmapKind; label: string; hint: string; icon: typeof Briefcase }[] = [
  { value: "role", label: "A job role", hint: "Rounds, questions and practice for one job", icon: Briefcase },
  { value: "skill", label: "A skill", hint: "Learn a skill step by step", icon: GraduationCap },
];

export function CreateRoadmapSheet({
  open,
  onOpenChange,
  draft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft?: RoadmapDraft | null;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {open && <CreateForm key={draft ? `${draft.kind}:${draft.subject}` : "blank"} draft={draft} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function CreateForm({ draft, onDone }: { draft?: RoadmapDraft | null; onDone: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [kind, setKind] = React.useState<RoadmapKind>(draft?.kind ?? "role");
  const [subject, setSubject] = React.useState(draft?.subject ?? "");
  const [company, setCompany] = React.useState(draft?.company ?? "");
  const [date, setDate] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const subjectRef = React.useRef<HTMLInputElement>(null);
  const errorRef = React.useRef<HTMLDivElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  const create = useMutation({
    mutationFn: createRoadmap,
    onSuccess: (record) => {
      void queryClient.invalidateQueries({ queryKey: roadmapKeys.list });
      queryClient.setQueryData(roadmapKeys.one(record.id), record);
      onDone();
      router.push(`/roadmaps/${record.id}`);
    },
    // The sheet scrolls, so bring the reason into view instead of leaving it below the buttons.
    onError: () => requestAnimationFrame(() => errorRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = CreateRoadmapRequest.safeParse({
      kind,
      subject,
      company: kind === "role" && company.trim() ? company : null,
      interviewDate: date || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form");
      subjectRef.current?.focus();
      return;
    }
    if (date && date < today) {
      setError("Pick a date from today onwards, or leave it empty.");
      return;
    }
    setError(null);
    create.mutate(parsed.data);
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-full flex-col">
      <div className="border-b border-white/[0.08] px-6 pb-5 pt-6 sm:px-8">
        <SheetTitle className="text-xl font-semibold tracking-[-0.02em] text-white">New roadmap</SheetTitle>
        <SheetDescription className="mt-1 text-[15px] leading-relaxed text-white/60">
          We research how interviews for it usually go, then plan what to learn and practise, step by step.
        </SheetDescription>
      </div>

      <div className="flex flex-1 flex-col gap-7 px-6 py-6 sm:px-8">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-[15px] font-semibold text-white">What are you preparing for?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {KINDS.map(({ value, label, hint, icon: Icon }) => (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                  kind === value ? "border-primary/50 bg-primary/10" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]",
                )}
              >
                <input
                  type="radio"
                  name="kind"
                  value={value}
                  checked={kind === value}
                  onChange={() => setKind(value)}
                  className="sr-only"
                />
                <Icon className={cn("mt-0.5 size-5 shrink-0", kind === value ? "text-[#ff7a5c]" : "text-white/55")} aria-hidden />
                <span>
                  <span className="block text-[15px] font-semibold text-white">{label}</span>
                  <span className="mt-0.5 block text-sm font-medium text-white/55">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor="roadmap-subject" className="text-[15px] font-semibold text-white">
            {kind === "role" ? "Which job?" : "Which skill?"}
          </Label>
          <Input
            ref={subjectRef}
            id="roadmap-subject"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              if (error) setError(null);
            }}
            placeholder={kind === "role" ? "e.g. Staff nurse, Frontend engineer" : "e.g. Excel, public speaking"}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "roadmap-error" : undefined}
            maxLength={120}
            className="h-11 text-[15px] md:text-[15px]"
          />
          <div className="flex flex-wrap gap-2 pt-1" aria-label="Examples">
            {EXAMPLES[kind].map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setSubject(example);
                  setError(null);
                }}
                className="h-9 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-semibold text-white/75 transition-colors hover:bg-white/[0.07] hover:text-white"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {kind === "role" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="roadmap-company" className="text-[15px] font-semibold text-white">
              Company <span className="font-medium text-white/50">(optional)</span>
            </Label>
            <Input
              id="roadmap-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Apollo Hospitals"
              maxLength={120}
              className="h-11 text-[15px] md:text-[15px]"
            />
            <p className="text-sm font-medium text-white/55">We look up how they interview. Without one, you get the usual rounds for the job.</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="roadmap-date" className="text-[15px] font-semibold text-white">
            Interview date <span className="font-medium text-white/50">(optional)</span>
          </Label>
          <Input
            id="roadmap-date"
            type="date"
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 text-[15px] [color-scheme:dark] md:text-[15px] sm:max-w-[220px]"
          />
          <p className="text-sm font-medium text-white/55">Flashcards are paced so you finish before it.</p>
        </div>

        {error && (
          <p id="roadmap-error" role="alert" className="flex items-start gap-2 text-sm font-medium text-[#ff8a70]">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
        <div ref={errorRef} className="scroll-mb-28 empty:hidden">
          {create.error && <AiErrorNotice error={create.error} onRetry={() => create.mutate(create.variables!)} />}
        </div>
      </div>

      <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-white/[0.08] bg-[#0f0f0f]/95 px-6 py-4 backdrop-blur sm:flex-row sm:justify-end sm:px-8">
        <Button type="button" variant="ghost" size="lg" className="h-11" onClick={onDone} disabled={create.isPending}>
          Cancel
        </Button>
        <Button type="submit" size="lg" className="h-11 px-5" disabled={create.isPending}>
          {create.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {create.isPending ? "Starting…" : "Build my roadmap"}
        </Button>
      </div>
    </form>
  );
}
