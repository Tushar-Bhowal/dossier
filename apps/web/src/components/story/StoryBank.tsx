"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StoryInput, type ExtractStoriesResult, type Story } from "@dossier/core/resume";
import { AlertCircle, BookOpenText, FileText, LoaderCircle, Mic, Pencil, Plus, RefreshCcw, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { SampleBanner } from "@/components/demo/SampleBanner";
import { AiErrorNotice } from "@/components/resume/AiStatus";
import { BackLink } from "@/components/roadmap/RoadmapView";
import { OriginTag } from "@/components/roadmap/parts";
import { ApiError } from "@/lib/api";
import { createStory, deleteStory, extractStories, listStories, restoreStory, saveStory, STORY_SAMPLE, storyKeys } from "@/lib/story/api";
import { cn } from "@/lib/utils";

const PARTS = [
  { key: "situation", label: "Situation", hint: "What was going on?" },
  { key: "task", label: "Task", hint: "What were you asked or trying to do?" },
  { key: "action", label: "What you did", hint: "The steps you took yourself" },
  { key: "result", label: "Result", hint: "What changed, ideally with a number" },
] as const;

function filled(story: Pick<Story, "situation" | "task" | "action" | "result">) {
  return PARTS.filter((p) => story[p.key].trim()).length;
}

function StoryForm({
  initial,
  submitLabel,
  onSave,
  onCancel,
}: {
  initial: StoryInput;
  submitLabel: string;
  onSave: (input: StoryInput) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = React.useState(initial);
  const [skills, setSkills] = React.useState(initial.skills.join(", "));
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const id = React.useId();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = StoryInput.safeParse({
      ...draft,
      skills: skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the story");
      return;
    }
    setSaving(true);
    try {
      await onSave(parsed.data);
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-title`} className="text-sm font-semibold text-white/80">
          Title
        </Label>
        <Input
          id={`${id}-title`}
          autoFocus
          value={draft.title}
          maxLength={120}
          onChange={(e) => {
            setDraft({ ...draft, title: e.target.value });
            setError(null);
          }}
          aria-invalid={Boolean(error)}
          className="h-11 text-[15px] md:text-[15px]"
        />
      </div>
      {PARTS.map((part) => (
        <div key={part.key} className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-${part.key}`} className="text-sm font-semibold text-white/80">
            {part.label} <span className="font-medium text-white/45">· {part.hint}</span>
          </Label>
          <Textarea
            id={`${id}-${part.key}`}
            rows={part.key === "action" ? 3 : 2}
            value={draft[part.key]}
            onChange={(e) => setDraft({ ...draft, [part.key]: e.target.value })}
            className="text-[15px] md:text-[15px]"
          />
        </div>
      ))}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-skills`} className="text-sm font-semibold text-white/80">
          Skills it shows <span className="font-medium text-white/45">· separate with commas</span>
        </Label>
        <Input id={`${id}-skills`} value={skills} onChange={(e) => setSkills(e.target.value)} className="h-11 text-[15px] md:text-[15px]" />
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm font-medium text-[#ff8a70]">
          <AlertCircle className="size-4" aria-hidden />
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" className="h-11" disabled={saving}>
          {saving && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" className="h-11" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function StoryCard({ story, onDeleted }: { story: Story; onDeleted: (s: Story) => void }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = React.useState(false);
  const count = filled(story);

  if (editing) {
    return (
      <li className="rounded-lg border border-primary/30 bg-[#121212] p-5 sm:p-6">
        <StoryForm
          initial={story}
          submitLabel="Save story"
          onCancel={() => setEditing(false)}
          onSave={async (input) => {
            const saved = await saveStory(story.id, input);
            queryClient.setQueryData<Story[]>(storyKeys.list, (list = []) => list.map((s) => (s.id === saved.id ? saved : s)));
            setEditing(false);
            toast.success("Story saved");
          }}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-4 rounded-lg border border-white/[0.08] bg-[#111111] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-semibold leading-snug text-white">{story.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex h-6 items-center rounded-lg px-2 text-xs font-semibold",
                count === 4 ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300",
              )}
            >
              {count === 4 ? "Ready to tell" : `${count} of 4 parts filled`}
            </span>
            <OriginTag origin={story.origin} />
            {story.skills.map((skill) => (
              <span key={skill} className="inline-flex h-6 items-center rounded-lg bg-white/[0.06] px-2 text-xs font-semibold text-white/70">
                {skill}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <Button variant="ghost" size="icon" className="size-11 text-white/60 sm:size-9" aria-label={`Edit "${story.title}"`} onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-11 text-white/60 hover:bg-destructive/10 hover:text-[#ff8a70] sm:size-9"
            aria-label={`Delete "${story.title}"`}
            onClick={() => onDeleted(story)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      {story.fromBullet && (
        <p className="flex items-start gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-sm font-medium text-white/60">
          <FileText className="mt-0.5 size-4 shrink-0 text-white/40" aria-hidden />
          <span>
            From your resume: <span className="text-white/80">{story.fromBullet}</span>
          </span>
        </p>
      )}
      <dl className="grid gap-x-6 gap-y-4 md:grid-cols-2">
        {PARTS.map((part) => (
          <div key={part.key}>
            <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-white/45">{part.label}</dt>
            <dd className={cn("mt-1 text-[15px] leading-relaxed", story[part.key] ? "text-white/80" : "text-white/40")}>
              {story[part.key] || (
                <button type="button" onClick={() => setEditing(true)} className="text-left font-medium text-[#ff7a5c] underline-offset-4 hover:underline">
                  Add this. Only you know it.
                </button>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

export function StoryBank() {
  const queryClient = useQueryClient();
  const stories = useQuery({ queryKey: storyKeys.list, queryFn: listStories });
  const [writing, setWriting] = React.useState(false);
  const [skipped, setSkipped] = React.useState<string[]>([]);

  const extract = useMutation({
    mutationFn: extractStories,
    onSuccess: (result: ExtractStoriesResult) => {
      queryClient.setQueryData<Story[]>(storyKeys.list, (list = []) => [...result.added, ...list]);
      setSkipped(result.skipped);
      toast.success(
        result.added.length ? `Found ${result.added.length} new stor${result.added.length === 1 ? "y" : "ies"}` : "No new stories found",
        { description: result.added.length ? "Fill in the parts only you know." : "Every line with enough detail already has a story." },
      );
    },
  });

  function remove(story: Story) {
    queryClient.setQueryData<Story[]>(storyKeys.list, (list = []) => list.filter((s) => s.id !== story.id));
    void deleteStory(story.id);
    toast.success("Story deleted", {
      duration: 6000,
      action: {
        label: "Undo",
        onClick: () => {
          void restoreStory(story).then(() => queryClient.invalidateQueries({ queryKey: storyKeys.list }));
        },
      },
    });
  }

  const noResume = extract.error instanceof ApiError && extract.error.code === "no_resume";
  const list = stories.data ?? [];
  const ready = list.filter((s) => filled(s) === 4).length;

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button size="lg" className="h-11" onClick={() => extract.mutate()} disabled={extract.isPending}>
        {extract.isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
        {extract.isPending ? "Reading your resume…" : "Find stories in my resume"}
      </Button>
      <Button size="lg" variant="outline" className="h-11" onClick={() => setWriting(true)}>
        <Plus className="size-4" aria-hidden />
        Write one yourself
      </Button>
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <div className="flex flex-col gap-3">
        <BackLink href="/resumes">Resume Studio</BackLink>
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.035em] text-white">Your stories</h1>
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-white/60">
              Short, true stories from your work, ready for &ldquo;Tell me about a time…&rdquo; questions. We start them from your resume;
              you fill in what only you know.
            </p>
          </div>
          {list.length > 0 && (
            <Button asChild variant="outline" size="lg" className="h-11 self-start md:self-auto">
              <Link href="/interviews/new?resume=first">
                <Mic className="size-4" aria-hidden />
                Practise telling them
              </Link>
            </Button>
          )}
        </div>
      </div>

      {STORY_SAMPLE && <SampleBanner>Stories aren&apos;t connected yet, so nothing here is saved.</SampleBanner>}

      {stories.isPending ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Loading stories">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-56 rounded-lg bg-white/[0.04]" />
          ))}
        </div>
      ) : stories.isError ? (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-destructive/35 bg-destructive/10 p-5">
          <p className="text-[15px] font-medium text-white">We couldn&apos;t load your stories.</p>
          <Button variant="outline" className="h-11" onClick={() => void stories.refetch()}>
            <RefreshCcw className="size-4" aria-hidden />
            Try again
          </Button>
        </div>
      ) : (
        <>
          {list.length > 0 && (
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <p className="text-[15px] font-semibold text-white/75">
                {list.length} {list.length === 1 ? "story" : "stories"} · {ready} ready to tell
              </p>
              {actions}
            </div>
          )}

          {noResume ? (
            <div role="alert" className="flex flex-col gap-3 rounded-lg border border-white/[0.08] bg-[#111111] p-5">
              <p className="text-[15px] font-semibold text-white">There&apos;s no resume to read yet</p>
              <p className="text-sm text-white/65">Make one in Resume Studio first; then we can find stories in it. Or write a story yourself.</p>
              <Button asChild className="h-11 self-start">
                <Link href="/resumes/new">Make a resume</Link>
              </Button>
            </div>
          ) : (
            extract.error && <AiErrorNotice error={extract.error} onRetry={() => extract.mutate()} />
          )}

          {skipped.length > 0 && (
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[15px] font-semibold text-white">Not enough detail to make a story from</p>
                <Button variant="ghost" size="icon" className="size-11 shrink-0 text-white/60 sm:size-9" aria-label="Dismiss" onClick={() => setSkipped([])}>
                  <X className="size-4" />
                </Button>
              </div>
              <p className="mt-1 text-sm text-white/60">We don&apos;t pad stories with made-up detail. Write these yourself if there&apos;s a story behind them.</p>
              <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-sm font-medium text-white/70 marker:text-white/30">
                {skipped.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {writing && (
            <div className="rounded-lg border border-primary/30 bg-[#121212] p-5 sm:p-6">
              <p className="mb-4 text-[15px] font-semibold text-white">A new story</p>
              <StoryForm
                initial={{ title: "", situation: "", task: "", action: "", result: "", skills: [] }}
                submitLabel="Add story"
                onCancel={() => setWriting(false)}
                onSave={async (input) => {
                  const story = await createStory(input);
                  queryClient.setQueryData<Story[]>(storyKeys.list, (l = []) => [story, ...l]);
                  setWriting(false);
                  toast.success("Story added");
                }}
              />
            </div>
          )}

          {list.length === 0 && !writing ? (
            <section className="flex flex-col items-center rounded-lg border border-white/[0.08] bg-[#111111] bg-[radial-gradient(80%_60%_at_50%_0%,rgba(251,65,40,0.10),transparent_60%)] px-6 py-14 text-center">
              <span className="flex size-12 items-center justify-center rounded-lg bg-[#dc3019] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
                <BookOpenText className="size-6" aria-hidden />
              </span>
              <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-white">Three good stories go a long way</h2>
              <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-white/65">
                Most behavioural questions can be answered with a handful of real stories. We&apos;ll pull the starting points from
                your resume.
              </p>
              <div className="mt-6">{actions}</div>
            </section>
          ) : (
            <ul className="flex flex-col gap-4">
              {list.map((story) => (
                <StoryCard key={story.id} story={story} onDeleted={remove} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
