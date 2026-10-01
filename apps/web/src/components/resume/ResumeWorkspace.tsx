"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Crosshair, FileText, Trash2 } from "lucide-react";
import { lintResume, renderDataText, toRenderData, type CareerProfile, type LintHint, type Resume } from "@dossier/core/resume";
import { ApiError } from "@/lib/api";
import { deleteResume, getProfile, getResume, resumeKeys, saveProfile, saveResume } from "@/lib/resume/api";
import type { SaveStatus } from "@/lib/optimistic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { SaveStatusIndicator } from "@/components/kit/SaveStatusIndicator";
import { AiErrorNotice } from "./AiStatus";
import { ResumePreview } from "./ResumePreview";
import { ResumeEditor } from "./editor/ResumeEditor";
import { CheckPanel } from "./editor/CheckPanel";
import { HistoryPanel } from "./editor/HistoryPanel";
import { MarketTerms } from "./editor/MarketTerms";

const AUTOSAVE_MS = 800;
const RETRY_MS = 3000;

type Tab = "edit" | "check" | "terms" | "history" | "preview";

// Empty lines are allowed while typing but never saved — the contract requires text on every bullet.
function withoutEmptyBullets(resume: Resume): Resume {
  return {
    ...resume,
    sections: resume.sections.map((s) =>
      "items" in s ? { ...s, items: s.items.map((i) => ({ ...i, bullets: i.bullets.filter((b) => b.text.trim()) })) } : s,
    ),
  };
}

function Workspace({ initial, profile: initialProfile }: { initial: Resume; profile: CareerProfile }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draft, setDraft] = React.useState(initial);
  const [profile, setProfile] = React.useState(initialProfile);
  const [tab, setTab] = React.useState<Tab>("edit");
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus | undefined>();
  const [conflict, setConflict] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [edits, setEdits] = React.useState(0);

  const draftRef = React.useRef(draft);
  const versionRef = React.useRef(initial.version);
  const inFlight = React.useRef(false);
  const again = React.useRef(false);
  const conflictResolved = React.useRef(false);
  const flushRef = React.useRef<() => Promise<void>>(async () => {});

  React.useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const flush = React.useCallback(async () => {
    if (inFlight.current) {
      again.current = true;
      return;
    }
    inFlight.current = true;
    setSaveStatus("saving");
    try {
      const saved = await saveResume(withoutEmptyBullets({ ...draftRef.current, version: versionRef.current }));
      versionRef.current = saved.version;
      setSaveStatus("saved");
      void queryClient.invalidateQueries({ queryKey: resumeKeys.list });
      void queryClient.invalidateQueries({ queryKey: resumeKeys.history(saved.id) });
    } catch (err) {
      if (err instanceof ApiError && err.code === "version_conflict") {
        conflictResolved.current = false;
        setConflict(true);
        setSaveStatus(undefined);
      } else {
        setSaveStatus("retry");
        window.setTimeout(() => void flushRef.current(), RETRY_MS);
      }
    } finally {
      inFlight.current = false;
      if (again.current) {
        again.current = false;
        void flushRef.current();
      }
    }
  }, [queryClient]);

  React.useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  React.useEffect(() => {
    if (edits === 0) return;
    const timer = window.setTimeout(() => void flush(), AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [edits, flush]);

  const edit = React.useCallback((fn: (r: Resume) => Resume) => {
    setDraft((d) => fn(d));
    setEdits((n) => n + 1);
  }, []);

  const saveProfileNow = async (next: CareerProfile) => {
    try {
      const saved = await saveProfile(next);
      setProfile(saved);
      queryClient.setQueryData(resumeKeys.profile, saved);
    } catch (err) {
      if (err instanceof ApiError && err.code === "version_conflict") {
        const latest = await getProfile();
        if (latest) setProfile(latest);
        toast.error("Your details changed somewhere else", { description: "We loaded the latest. Please make your change again." });
      } else {
        toast.error("Couldn't save your details", { description: "Please try again." });
      }
      throw err;
    }
  };

  const refreshProfile = async () => {
    const latest = await getProfile();
    if (latest) {
      setProfile(latest);
      queryClient.setQueryData(resumeKeys.profile, latest);
    }
  };

  const loadLatest = async () => {
    const latest = await getResume(draft.id);
    versionRef.current = latest.version;
    setDraft(latest);
    toast.info("Loaded the newer version");
  };

  const keepMine = async () => {
    const latest = await getResume(draft.id);
    versionRef.current = latest.version;
    await flush();
  };

  const jumpTo = (targetId: string) => {
    setTab("edit");
    window.setTimeout(() => {
      const el = document.getElementById(`bullet-${targetId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.querySelector("textarea")?.focus();
    }, 50);
  };

  const renderData = React.useMemo(() => toRenderData(profile, draft), [profile, draft]);
  const resumeText = React.useMemo(() => renderDataText(renderData), [renderData]);
  const hintList = React.useMemo(() => lintResume(draft), [draft]);
  const hints = React.useMemo(() => {
    const map = new Map<string, LintHint[]>();
    for (const h of hintList) map.set(h.targetId, [...(map.get(h.targetId) ?? []), h]);
    return map;
  }, [hintList]);

  const tabs: { value: Tab; label: string; mobileOnly?: boolean }[] = [
    { value: "edit", label: "Edit" },
    { value: "preview", label: "Preview", mobileOnly: true },
    { value: "check", label: hintList.length ? `Check (${hintList.length})` : "Check" },
    { value: "terms", label: "Recruiter terms" },
    { value: "history", label: "History" },
  ];

  return (
    <div className="flex flex-col gap-6 pb-16">
      <section className="flex flex-col gap-4 rounded-lg border border-white/[0.08] bg-[#0f0f0f] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/resumes"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-white/60 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            All resumes
          </Link>
          <div className="flex items-center gap-2">
            <SaveStatusIndicator status={saveStatus} />
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(true)}
              className="text-white/70 hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" />
              <span className="hidden sm:inline">Delete</span>
            </Button>
            <Button asChild size="lg">
              <Link href={`/resumes/${draft.id}/tailor`}>
                <Crosshair className="size-4" />
                Tailor for a job
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="resume-title" className="sr-only">
            Resume name
          </label>
          <Input
            id="resume-title"
            value={draft.title}
            onChange={(e) => edit((r) => ({ ...r, title: e.target.value }))}
            onBlur={() => {
              if (!draft.title.trim()) edit((r) => ({ ...r, title: "My resume" }));
            }}
            maxLength={80}
            className="h-12 border-transparent bg-transparent px-2 text-[26px] font-semibold tracking-[-0.03em] text-white hover:border-white/10 md:text-[26px]"
          />
          {draft.target && (
            <div className="flex flex-wrap items-center gap-2 px-2">
              <Badge>Tailored{draft.target.role ? ` for ${draft.target.role}` : ""}{draft.target.company ? ` at ${draft.target.company}` : ""}</Badge>
              {draft.baseResumeId && (
                <Link href={`/resumes/${draft.baseResumeId}`} className="text-sm font-semibold text-white/60 hover:text-white">
                  Open the original
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="min-w-0">
          <TabsList className="h-auto w-full flex-wrap justify-start">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className={t.mobileOnly ? "lg:hidden" : undefined}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="edit" className="mt-4">
            <ResumeEditor resume={draft} profile={profile} edit={edit} onProfileSave={saveProfileNow} hints={hints} />
          </TabsContent>
          <TabsContent value="preview" className="mt-4 lg:hidden">
            {tab === "preview" && <ResumePreview data={renderData} />}
          </TabsContent>
          <TabsContent value="check" className="mt-4">
            {tab === "check" && <CheckPanel data={renderData} hints={hintList} onJump={jumpTo} />}
          </TabsContent>
          <TabsContent value="terms" className="mt-4">
            <MarketTerms resume={draft} profile={profile} resumeText={resumeText} edit={edit} onProfileChanged={() => void refreshProfile()} />
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <HistoryPanel
              resumeId={draft.id}
              onRestore={(snapshot) => {
                edit((r) => ({ ...r, sections: snapshot.sections }));
                setTab("edit");
                toast.success("Version restored");
              }}
            />
          </TabsContent>
        </Tabs>

        <aside className="hidden min-w-0 lg:block">
          <div className="sticky top-24">
            <ResumePreview data={renderData} />
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={conflict}
        onOpenChange={(open) => {
          if (!open) {
            setConflict(false);
            if (!conflictResolved.current) void loadLatest();
          }
        }}
        title="This resume changed somewhere else"
        description="Another tab or device saved a newer version. Keep your edits to save them over it, or load the newer version."
        confirmLabel="Keep my edits"
        confirmingLabel="Saving…"
        cancelLabel="Load the newer version"
        variant="default"
        onConfirm={async () => {
          conflictResolved.current = true;
          await keepMine();
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${draft.title}"?`}
        description="This removes this resume. Your profile and other resumes stay."
        onConfirm={async () => {
          await deleteResume(draft.id);
          queryClient.removeQueries({ queryKey: resumeKeys.resume(draft.id) });
          await queryClient.invalidateQueries({ queryKey: resumeKeys.list });
          toast.success("Resume deleted");
          router.push("/resumes");
        }}
      />
    </div>
  );
}

export function ResumeWorkspace({ id }: { id: string }) {
  const resumeQuery = useQuery({ queryKey: resumeKeys.resume(id), queryFn: () => getResume(id) });
  const profileQuery = useQuery({ queryKey: resumeKeys.profile, queryFn: getProfile });

  if (resumeQuery.isLoading || profileQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-36 w-full rounded-lg" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[520px] w-full rounded-lg" />
          <Skeleton className="hidden h-[520px] w-full rounded-lg lg:block" />
        </div>
      </div>
    );
  }

  const error = resumeQuery.error ?? profileQuery.error;
  if (error || !resumeQuery.data || !profileQuery.data) {
    return (
      <div className="flex flex-col gap-4">
        <AiErrorNotice
          error={error ?? new ApiError(404, "not_found", "resume not found")}
          onRetry={() => {
            void resumeQuery.refetch();
            void profileQuery.refetch();
          }}
        />
        <Button asChild variant="outline" className="self-start">
          <Link href="/resumes">
            <FileText className="size-4" />
            Back to your resumes
          </Link>
        </Button>
      </div>
    );
  }

  return <Workspace key={id} initial={resumeQuery.data} profile={profileQuery.data} />;
}
