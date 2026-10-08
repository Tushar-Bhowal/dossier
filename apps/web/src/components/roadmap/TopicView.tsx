"use client";

import * as React from "react";
import Link from "next/link";
import type { InterviewRound, RoadmapFlashcard, RoadmapQuestion, RoadmapTopic } from "@dossier/core/roadmap";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  FileText,
  Layers,
  Pencil,
  Pin,
  Plus,
  PlayCircle,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { SampleBanner } from "@/components/demo/SampleBanner";
import { ROADMAP_SAMPLE } from "@/lib/roadmap/api";
import { cn } from "@/lib/utils";
import { OriginTag, stageMeta } from "./parts";
import { BackLink, SaveState } from "./RoadmapView";
import { nextItemId, useRoadmap } from "./useRoadmap";

const DIFFICULTY = { 1: "Easy", 2: "Medium", 3: "Hard" } as const;
const iconButton = "size-11 text-white/60 hover:text-white sm:size-9";

function edited<T extends { origin: RoadmapQuestion["origin"] }>(item: T): T["origin"] {
  return item.origin === "manual" ? "manual" : "edited";
}

function ItemActions({
  label,
  pinned,
  onEdit,
  onTogglePin,
  onDelete,
}: {
  label: string;
  pinned: boolean;
  onEdit: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Button variant="ghost" size="icon" className={iconButton} aria-label={`Edit ${label}`} onClick={onEdit}>
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn(iconButton, pinned && "text-[#ff7a5c] hover:text-[#ff7a5c]")}
        aria-label={pinned ? `Unpin ${label}` : `Pin ${label} so a refresh never changes it`}
        aria-pressed={pinned}
        onClick={onTogglePin}
      >
        <Pin className={cn("size-4", pinned && "fill-current")} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn(iconButton, "hover:bg-destructive/10 hover:text-[#ff8a70]")}
        aria-label={`Delete ${label}`}
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 className="size-4" />
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete this ${label}?`}
        description="It's removed from this roadmap. If it was written by AI, refreshing the roadmap may add a similar one back."
        confirmLabel="Delete"
        onConfirm={onDelete}
      />
    </div>
  );
}

function TwoFieldEditor({
  firstLabel,
  secondLabel,
  first,
  second,
  submitLabel,
  onSave,
  onCancel,
}: {
  firstLabel: string;
  secondLabel: string;
  first: string;
  second: string;
  submitLabel: string;
  onSave: (first: string, second: string) => void;
  onCancel: () => void;
}) {
  const [a, setA] = React.useState(first);
  const [b, setB] = React.useState(second);
  const [error, setError] = React.useState(false);
  const id = React.useId();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!a.trim()) {
          setError(true);
          return;
        }
        onSave(a.trim(), b.trim());
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-a`} className="text-sm font-semibold text-white/80">
          {firstLabel}
        </Label>
        <Textarea
          id={`${id}-a`}
          autoFocus
          rows={2}
          value={a}
          onChange={(e) => {
            setA(e.target.value);
            setError(false);
          }}
          aria-invalid={error}
          className="text-[15px] md:text-[15px]"
        />
        {error && (
          <p role="alert" className="text-sm font-medium text-[#ff8a70]">
            This can&apos;t be empty.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-b`} className="text-sm font-semibold text-white/80">
          {secondLabel}
        </Label>
        <Textarea id={`${id}-b`} rows={3} value={b} onChange={(e) => setB(e.target.value)} className="text-[15px] md:text-[15px]" />
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="h-11 sm:h-9">
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" className="h-11 sm:h-9" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function QuestionItem({
  question,
  round,
  onChange,
  onDelete,
}: {
  question: RoadmapQuestion;
  round: InterviewRound | undefined;
  onChange: (q: RoadmapQuestion) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const outlineId = React.useId();

  if (editing) {
    return (
      <li className="rounded-lg border border-primary/30 bg-[#121212] p-5">
        <TwoFieldEditor
          firstLabel="Question"
          secondLabel="What a good answer covers"
          first={question.prompt}
          second={question.answer_outline}
          submitLabel="Save"
          onCancel={() => setEditing(false)}
          onSave={(prompt, outline) => {
            onChange({ ...question, prompt, answer_outline: outline, origin: edited(question) });
            setEditing(false);
          }}
        />
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-white/[0.08] bg-[#121212] p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-snug text-white">{question.prompt}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {round && (
              <span className="inline-flex h-6 items-center rounded-lg bg-white/[0.06] px-2 text-xs font-semibold text-white/70">{round.name}</span>
            )}
            <span className="inline-flex h-6 items-center rounded-lg bg-white/[0.06] px-2 text-xs font-semibold text-white/70">
              {DIFFICULTY[question.difficulty as 1 | 2 | 3]}
            </span>
            <OriginTag origin={question.origin} pinned={question.pinned} />
          </div>
        </div>
        <ItemActions
          label="question"
          pinned={question.pinned}
          onEdit={() => setEditing(true)}
          onTogglePin={() => onChange({ ...question, pinned: !question.pinned })}
          onDelete={onDelete}
        />
      </div>
      {question.answer_outline && (
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={outlineId}
            onClick={() => setOpen((v) => !v)}
            className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-lg text-sm font-semibold text-[#ff7a5c] hover:text-[#ff9478]"
          >
            <ChevronDown className={cn("size-4 transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
            {open ? "Hide what a good answer covers" : "Show what a good answer covers"}
          </button>
          <div id={outlineId} hidden={!open} className="mt-1 rounded-lg bg-white/[0.03] p-4 text-[15px] leading-relaxed text-white/75">
            {question.answer_outline}
          </div>
        </>
      )}
    </li>
  );
}

function FlashcardItem({
  card,
  onChange,
  onDelete,
}: {
  card: RoadmapFlashcard;
  onChange: (c: RoadmapFlashcard) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  if (editing) {
    return (
      <li className="rounded-lg border border-primary/30 bg-[#121212] p-5 sm:col-span-2">
        <TwoFieldEditor
          firstLabel="Front"
          secondLabel="Back"
          first={card.front}
          second={card.back}
          submitLabel="Save"
          onCancel={() => setEditing(false)}
          onSave={(front, back) => {
            onChange({ ...card, front, back, origin: edited(card) });
            setEditing(false);
          }}
        />
      </li>
    );
  }
  return (
    <li className="flex flex-col rounded-lg border border-white/[0.08] bg-[#121212] p-5">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-white">{card.front}</p>
        <ItemActions
          label="flashcard"
          pinned={card.pinned}
          onEdit={() => setEditing(true)}
          onTogglePin={() => onChange({ ...card, pinned: !card.pinned })}
          onDelete={onDelete}
        />
      </div>
      <p className="mt-3 border-t border-white/[0.06] pt-3 text-[15px] leading-relaxed text-white/70">{card.back}</p>
      <span className="mt-3 empty:hidden">
        <OriginTag origin={card.origin} pinned={card.pinned} />
      </span>
    </li>
  );
}

function SectionTitle({ id, children, count }: { id: string; children: React.ReactNode; count?: number }) {
  return (
    <h2 id={id} className="flex items-baseline gap-2 text-lg font-semibold tracking-[-0.02em] text-white">
      {children}
      {count !== undefined && <span className="text-sm font-semibold text-white/45">{count}</span>}
    </h2>
  );
}

export function TopicView({ roadmapId, topicId }: { roadmapId: string; topicId: string }) {
  const { query, status, updateTopic, toggleDone, retrySave } = useRoadmap(roadmapId);
  const [adding, setAdding] = React.useState<"question" | "card" | null>(null);

  if (query.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5" role="status" aria-label="Loading topic">
        <Skeleton className="h-6 w-40 rounded-lg bg-white/[0.05]" />
        <Skeleton className="h-10 w-96 max-w-full rounded-lg bg-white/[0.06]" />
        <Skeleton className="h-32 w-full rounded-lg bg-white/[0.04]" />
        <Skeleton className="h-48 w-full rounded-lg bg-white/[0.03]" />
      </div>
    );
  }

  const record = query.data;
  const roadmap = record?.roadmap;
  const topics = roadmap ? [...roadmap.topics].sort((a, b) => a.order - b.order) : [];
  const index = topics.findIndex((t) => t.id === topicId);
  const topic = topics[index];

  if (!record || !roadmap || !topic) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <BackLink href={`/roadmaps/${roadmapId}`}>Back to the roadmap</BackLink>
        <div role="alert" className="rounded-lg border border-white/[0.08] bg-[#111111] p-6">
          <p className="text-lg font-semibold text-white">We couldn&apos;t find this topic</p>
          <p className="mt-1 text-[15px] text-white/65">It may have been removed, or the roadmap is still being built.</p>
        </div>
      </div>
    );
  }

  const stage = stageMeta(topic.stage);
  const StageIcon = stage.icon;
  const done = record.doneTopicIds.includes(topic.id);
  const prev = topics[index - 1];
  const next = topics[index + 1];
  const roundsById = new Map(roadmap.rounds.map((r) => [r.id, r]));

  const setTopic = (fn: (t: RoadmapTopic) => RoadmapTopic) => updateTopic(topic.id, fn);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <BackLink href={`/roadmaps/${roadmapId}`}>{roadmap.subject}</BackLink>
        <p className="flex items-center gap-2 text-sm font-semibold text-white/60">
          <StageIcon className="size-4 text-[#ff7a5c]" aria-hidden />
          {stage.label}
        </p>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-white sm:text-[32px]">{topic.title}</h1>
            <div className="mt-2 empty:hidden">
              <OriginTag origin={topic.origin} />
            </div>
          </div>
          <Button
            size="lg"
            variant={done ? "outline" : "default"}
            className={cn("h-11 shrink-0", done && "border-emerald-500/30 text-emerald-300")}
            aria-pressed={done}
            onClick={() => {
              toggleDone(topic.id);
              if (!done) toast.success("Topic done", { description: next ? `Next up: ${next.title}` : "That's the last topic. Well done." });
            }}
          >
            <Check className="size-4" aria-hidden />
            {done ? "Done" : "Mark as done"}
          </Button>
        </div>
        <SaveState status={status} onRetry={retrySave} />
      </div>

      {ROADMAP_SAMPLE && <SampleBanner>Roadmaps aren&apos;t connected yet, so your edits here aren&apos;t saved.</SampleBanner>}

      <section aria-labelledby="explain" className="flex flex-col gap-3">
        <SectionTitle id="explain">In short</SectionTitle>
        <Textarea
          aria-labelledby="explain"
          value={topic.explanation}
          rows={5}
          onChange={(e) => setTopic((t) => ({ ...t, explanation: e.target.value, origin: edited(t) }))}
          className="min-h-32 resize-y border-white/[0.08] bg-[#111111] p-4 text-base leading-relaxed text-white/85 md:text-base"
        />
        <p className="text-sm font-medium text-white/50">
          Written by AI from the roadmap&apos;s sources. Change anything; your edits are kept when the roadmap is refreshed.
        </p>
      </section>

      <section aria-labelledby="questions" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <SectionTitle id="questions" count={topic.questions.length}>
            Questions to practise
          </SectionTitle>
          <Button variant="outline" className="h-11 sm:h-9" onClick={() => setAdding("question")}>
            <Plus className="size-4" aria-hidden />
            Add
          </Button>
        </div>
        {adding === "question" && (
          <div className="rounded-lg border border-primary/30 bg-[#121212] p-5">
            <TwoFieldEditor
              firstLabel="Your question"
              secondLabel="What a good answer covers (optional)"
              first=""
              second=""
              submitLabel="Add question"
              onCancel={() => setAdding(null)}
              onSave={(prompt, outline) => {
                const id = nextItemId(record, "q");
                setTopic((t) => ({
                  ...t,
                  questions: [
                    ...t.questions,
                    { id, prompt, answer_outline: outline, round_id: null, difficulty: 2, origin: "manual", pinned: false, order: t.questions.length + 1 },
                  ],
                }));
                setAdding(null);
              }}
            />
          </div>
        )}
        {topic.questions.length === 0 && adding !== "question" ? (
          <p className="rounded-lg border border-dashed border-white/10 p-5 text-[15px] text-white/60">
            No questions here yet. Add one you expect to be asked.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {topic.questions.map((q) => (
              <QuestionItem
                key={q.id}
                question={q}
                round={q.round_id ? roundsById.get(q.round_id) : undefined}
                onChange={(nextQ) => setTopic((t) => ({ ...t, questions: t.questions.map((x) => (x.id === q.id ? nextQ : x)) }))}
                onDelete={() => {
                  setTopic((t) => ({ ...t, questions: t.questions.filter((x) => x.id !== q.id) }));
                  toast.success("Question deleted");
                }}
              />
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="cards" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle id="cards" count={topic.flashcards.length}>
            Flashcards
          </SectionTitle>
          <div className="flex gap-2">
            {topic.flashcards.length > 0 && (
              <Button asChild variant="ghost" className="h-11 sm:h-9">
                <Link href={`/roadmaps/${roadmapId}/practice`}>
                  <Layers className="size-4" aria-hidden />
                  Practise
                </Link>
              </Button>
            )}
            <Button variant="outline" className="h-11 sm:h-9" onClick={() => setAdding("card")}>
              <Plus className="size-4" aria-hidden />
              Add
            </Button>
          </div>
        </div>
        {adding === "card" && (
          <div className="rounded-lg border border-primary/30 bg-[#121212] p-5">
            <TwoFieldEditor
              firstLabel="Front (the question)"
              secondLabel="Back (the answer)"
              first=""
              second=""
              submitLabel="Add flashcard"
              onCancel={() => setAdding(null)}
              onSave={(front, back) => {
                const id = nextItemId(record, "f");
                setTopic((t) => ({
                  ...t,
                  flashcards: [...t.flashcards, { id, front, back: back || "—", origin: "manual", pinned: false, order: t.flashcards.length + 1 }],
                }));
                setAdding(null);
              }}
            />
          </div>
        )}
        {topic.flashcards.length === 0 && adding !== "card" ? (
          <p className="rounded-lg border border-dashed border-white/10 p-5 text-[15px] text-white/60">
            No flashcards for this topic. Add one for anything you keep forgetting.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {topic.flashcards.map((card) => (
              <FlashcardItem
                key={card.id}
                card={card}
                onChange={(nextCard) => setTopic((t) => ({ ...t, flashcards: t.flashcards.map((x) => (x.id === card.id ? nextCard : x)) }))}
                onDelete={() => {
                  setTopic((t) => ({ ...t, flashcards: t.flashcards.filter((x) => x.id !== card.id) }));
                  toast.success("Flashcard deleted");
                }}
              />
            ))}
          </ul>
        )}
      </section>

      {topic.resources.length > 0 && (
        <section aria-labelledby="learn" className="flex flex-col gap-3">
          <SectionTitle id="learn">Learn more</SectionTitle>
          <ul className="flex flex-col gap-2">
            {topic.resources.map((r) => {
              const Icon = r.kind === "video" ? PlayCircle : FileText;
              return (
                <li key={r.id}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-4 rounded-lg border border-white/[0.08] bg-[#121212] p-4 transition-colors hover:border-white/20"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-[#ff7a5c]">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-white group-hover:text-[#ff7a5c]">{r.title}</span>
                      <span className="text-sm font-medium text-white/55">
                        {r.kind === "video" ? "Video" : "Article"} · {r.publisher}
                        {r.minutes ? ` · ${r.minutes} min` : ""}
                      </span>
                    </span>
                    <ExternalLink className="size-4 shrink-0 text-white/40" aria-hidden />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </li>
              );
            })}
          </ul>
          <p className="text-sm font-medium text-white/50">Links come from real search results, never made up by AI.</p>
        </section>
      )}

      <nav aria-label="Topics" className="grid gap-3 border-t border-white/[0.06] pt-6 sm:grid-cols-2">
        {prev ? (
          <Link
            href={`/roadmaps/${roadmapId}/topics/${prev.id}`}
            className="flex min-h-11 flex-col rounded-lg border border-white/[0.08] p-4 transition-colors hover:border-white/20"
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold text-white/55">
              <ArrowLeft className="size-4" aria-hidden />
              Previous
            </span>
            <span className="mt-1 text-[15px] font-semibold text-white">{prev.title}</span>
          </Link>
        ) : (
          <span className="hidden sm:block" />
        )}
        {next && (
          <Link
            href={`/roadmaps/${roadmapId}/topics/${next.id}`}
            className="flex min-h-11 flex-col rounded-lg border border-white/[0.08] p-4 text-right transition-colors hover:border-white/20"
          >
            <span className="flex items-center justify-end gap-1.5 text-sm font-semibold text-white/55">
              Next
              <ArrowRight className="size-4" aria-hidden />
            </span>
            <span className="mt-1 text-[15px] font-semibold text-white">{next.title}</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
