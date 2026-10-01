"use client";

import * as React from "react";
import type { Kit } from "@dossier/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  FileText,
  GraduationCap,
  HelpCircle,
  Layers,
  ListChecks,
  MapPin,
  Trash2,
} from "lucide-react";
import { deleteKit } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { CompanyBriefCard } from "./CompanyBriefCard";
import { EditableField } from "./EditableField";
import { editRoleTitle } from "./kitMutations";
import { RequirementsSection } from "./RequirementsSection";
import { QuestionsBoard } from "./QuestionsBoard";
import { FlashcardsSection } from "./FlashcardsSection";
import { ScheduleView } from "./ScheduleView";
import { useKitEditor } from "./useKitEditor";

const TABS = ["overview", "questions", "flashcards", "schedule"] as const;
type TabValue = (typeof TABS)[number];

export function KitBuilder({ id, initial }: { id: string; initial: { kit: Kit; version: number } }) {
  const editor = useKitEditor(id, initial);
  const { kit } = editor;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const roleTitle = kit.role?.title || "Untitled role";
  const company = kit.source?.company || "Unknown company";

  const handleConfirmDelete = async () => {
    await deleteKit(id);
    await queryClient.invalidateQueries({ queryKey: ["kits"] });
    toast.success("Kit deleted", {
      description: `"${roleTitle}" at ${company} has been removed.`,
    });
    router.push("/kits");
  };

  const [tab, setTab] = React.useState<TabValue>(() => {
    const hash = typeof window === "undefined" ? "" : window.location.hash.slice(1);
    return (TABS as readonly string[]).includes(hash) ? (hash as TabValue) : "overview";
  });
  const handleTabChange = (value: string) => {
    setTab(value as TabValue);
    window.history.replaceState(null, "", `#${value}`);
  };

  const location =
    kit.source.location && !/^not specified$/i.test(kit.source.location) ? kit.source.location : null;
  const uncovered = kit.coverage.uncovered_requirement_ids.length;

  const stats = [
    { icon: ListChecks, label: "Requirements", value: kit.role.requirements.length },
    { icon: HelpCircle, label: "Questions", value: kit.questions.length },
    { icon: Layers, label: "Flashcards", value: kit.flashcards.length },
    { icon: Calendar, label: "Study days", value: kit.schedule.days_available },
  ];

  return (
    <div className="mx-auto flex w-full flex-col gap-6 pb-16">
      <section className="relative overflow-hidden rounded-lg border border-white/[0.08] bg-[#0f0f0f] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[900px] -translate-x-1/2 bg-[radial-gradient(ellipse_50%_60%_at_50%_50%,rgba(255,96,48,0.16),transparent_70%)]"
        />

        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/kits"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-white/60 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            All kits
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(true)}
              className="text-white/70 hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" />
              <span>Delete</span>
            </Button>
            <Button asChild variant="outline">
              <Link
                href={`/resumes?${new URLSearchParams({ tailorKit: id, role: roleTitle, company }).toString()}`}
              >
                <FileText className="size-4" />
                <span>Tailor my resume</span>
              </Link>
            </Button>
            <Button asChild size="lg">
              <Link href={`/kits/${id}/practice`}>
                <GraduationCap className="size-4" />
                <span>Practice flashcards</span>
              </Link>
            </Button>
          </div>
        </div>

        <div className="relative mt-6 flex items-center gap-3.5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-[#dc3019] text-lg font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_10px_30px_-10px_rgba(251,65,40,0.7)]">
            {company.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-base font-semibold text-white">
              <Building2 className="size-4 text-[#ff7a5c]" />
              {kit.source.company}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-white/55">
              {kit.role.seniority && <span>{kit.role.seniority}</span>}
              {kit.role.seniority && location && <span aria-hidden>·</span>}
              {location && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {location}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="relative mt-4">
          <EditableField
            value={kit.role.title}
            onChange={(value) => editor.editField("role.title", editRoleTitle(value))}
            status={editor.status["role.title"]}
            ariaLabel="Role title"
            placeholder="Untitled role"
            rows={1}
            className="text-[28px] font-semibold leading-tight tracking-[-0.035em] text-white md:text-[36px]"
          />
        </div>

        <dl className="relative mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.03] p-4"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-[#ff7a5c] ring-1 ring-primary/25">
                <Icon className="size-[18px]" aria-hidden />
              </span>
              <div>
                <dd className="text-xl font-semibold tabular-nums tracking-[-0.02em] text-white">{value}</dd>
                <dt className="text-[13px] font-medium text-white/55">{label}</dt>
              </div>
            </div>
          ))}
        </dl>
      </section>

      {uncovered > 0 && (
        <div
          className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-4"
          role="status"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
            <AlertTriangle className="size-4" />
          </span>
          <p className="text-[15px] leading-relaxed text-amber-100/90">
            <span className="font-semibold text-amber-200">
              {uncovered} requirement{uncovered === 1 ? " has" : "s have"} no matching question yet.
            </span>{" "}
            Regenerate a question track or add one by hand on the Questions tab.
          </p>
        </div>
      )}

      <Tabs value={tab} onValueChange={handleTabChange} className="gap-6">
        <div className="sticky top-(--app-header-height,4rem) z-10 -mx-4 bg-background/85 px-4 py-3 backdrop-blur-xl md:-mx-8 md:px-8">
          <TabsList className="grid w-full grid-cols-2 gap-1 group-data-horizontal/tabs:h-auto sm:inline-flex sm:w-fit sm:group-data-horizontal/tabs:h-11">
            {[
              { value: "overview", label: "Overview", icon: Building2, count: kit.role.requirements.length },
              { value: "questions", label: "Questions", icon: HelpCircle, count: kit.questions.length },
              { value: "flashcards", label: "Flashcards", icon: Layers, count: kit.flashcards.length },
              { value: "schedule", label: "Schedule", icon: Calendar, count: kit.schedule.days_available },
            ].map(({ value, label, icon: Icon, count }) => (
              <TabsTrigger key={value} value={value} className="h-9 gap-2 px-4 text-[15px]">
                <Icon className="size-4" />
                {label}
                <span className="rounded-lg bg-white/[0.07] px-1.5 text-xs tabular-nums text-white/65">
                  {count}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="flex flex-col gap-6">
          <div id="section-brief">
            <CompanyBriefCard editor={editor} />
          </div>
          <div id="section-requirements">
            <RequirementsSection editor={editor} />
          </div>
        </TabsContent>
        <TabsContent value="questions" id="section-questions">
          <QuestionsBoard editor={editor} />
        </TabsContent>
        <TabsContent value="flashcards" id="section-flashcards">
          <FlashcardsSection editor={editor} />
        </TabsContent>
        <TabsContent value="schedule" id="section-schedule">
          <ScheduleView kit={kit} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete "${roleTitle}"?`}
        description={`This will permanently delete the interview kit for ${roleTitle} at ${company}, including all questions, flashcards, and study progress. This action cannot be undone.`}
        confirmLabel="Delete kit"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
