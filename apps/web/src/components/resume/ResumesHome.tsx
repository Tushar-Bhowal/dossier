"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Crosshair, FileText, GraduationCap, Plus, Trash2 } from "lucide-react";
import type { ResumeListItem } from "@dossier/core/resume";
import { deleteResume, getProfile, listResumes, resumeKeys } from "@/lib/resume/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { AiErrorNotice } from "./AiStatus";
import { ResumeChat } from "./ResumeChat";

function relative(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function ResumeCard({ item, tailorHref }: { item: ResumeListItem; tailorHref: string | null }) {
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = React.useState(false);
  const href = tailorHref ?? `/resumes/${item.id}`;

  return (
    <>
      <Link
        href={href}
        className={cn(
          "group relative flex h-full min-h-[11rem] flex-col rounded-lg border border-white/[0.08] bg-[#111111] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-[transform,border-color] duration-200",
          "bg-[radial-gradient(120%_70%_at_100%_0%,rgba(251,65,40,0.08),transparent_55%)] hover:-translate-y-0.5 hover:border-primary/40",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {!tailorHref && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setConfirm(true);
            }}
            aria-label={`Delete ${item.title}`}
            className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg border border-white/10 bg-[#161616] text-white/55 opacity-0 transition-opacity group-hover:opacity-100 hover:border-destructive/30 hover:text-destructive focus-visible:opacity-100"
          >
            <Trash2 className="size-4" />
          </button>
        )}
        <span className="flex size-10 items-center justify-center rounded-lg bg-[#dc3019] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
          <FileText className="size-5" aria-hidden />
        </span>
        <h3 className="mt-4 line-clamp-2 pr-8 text-[19px] font-semibold leading-snug tracking-[-0.02em] text-white group-hover:text-[#ff7a5c]">
          {item.title}
        </h3>
        {item.targetRole || item.targetCompany ? (
          <Badge className="mt-2">
            Tailored{item.targetRole ? ` for ${item.targetRole}` : ""}
            {item.targetCompany ? ` at ${item.targetCompany}` : ""}
          </Badge>
        ) : (
          <span className="mt-2 text-sm font-medium text-white/50">Main resume</span>
        )}
        <div className="mt-auto flex items-center justify-between pt-5 text-sm font-medium text-white/50">
          <span>Edited {relative(item.updatedAt)}</span>
          <span className="flex items-center gap-1 font-semibold text-white/70 group-hover:text-white">
            {tailorHref ? "Tailor this one" : "Open"}
            <ArrowUpRight className="size-4" />
          </span>
        </div>
      </Link>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete "${item.title}"?`}
        description="This removes this resume. Your profile and other resumes stay."
        onConfirm={async () => {
          await deleteResume(item.id);
          await queryClient.invalidateQueries({ queryKey: resumeKeys.list });
          toast.success("Resume deleted");
        }}
      />
    </>
  );
}

export function ResumesHome() {
  const params = useSearchParams();
  const tailorKit = params?.get("tailorKit");
  const kitRole = params?.get("role") ?? "";
  const kitCompany = params?.get("company") ?? "";

  const list = useQuery({ queryKey: resumeKeys.list, queryFn: listResumes });
  const profile = useQuery({ queryKey: resumeKeys.profile, queryFn: getProfile });

  const tailorHref = (id: string) =>
    tailorKit
      ? `/resumes/${id}/tailor?${new URLSearchParams({ kitId: tailorKit, role: kitRole, company: kitCompany }).toString()}`
      : null;

  const isEmpty = list.data && list.data.length === 0;
  const jobLabel = [kitRole, kitCompany].filter(Boolean).join(" at ") || "this job";

  // Someone with no resumes yet lands straight in the composer — there's nothing to list.
  if (isEmpty) {
    return (
      <div className="flex flex-col gap-4">
        {tailorKit && (
          <div role="status" className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 p-5">
            <Crosshair className="mt-0.5 size-5 shrink-0 text-[#ff7a5c]" aria-hidden />
            <p className="text-[15px] font-medium leading-relaxed text-white">
              Build a resume first, then tailor it for {jobLabel}.
            </p>
          </div>
        )}
        <ResumeChat />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.035em] text-white">Your resumes</h1>
          <p className="mt-2 max-w-2xl text-base text-white/60">
            Built only from what you tell us — nothing made up. Download as PDF or Word, free.
          </p>
        </div>
        <Button asChild size="lg" className="self-start sm:self-auto">
          <Link href="/resumes/new">
            <Plus className="size-4" />
            New resume
          </Link>
        </Button>
      </div>

      {tailorKit && (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 p-5">
          <Crosshair className="mt-0.5 size-5 shrink-0 text-[#ff7a5c]" aria-hidden />
          <p className="text-[15px] font-medium leading-relaxed text-white">Pick the resume to tailor for {jobLabel}.</p>
        </div>
      )}

      {list.error && <AiErrorNotice error={list.error} onRetry={() => void list.refetch()} />}

      {list.isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading resumes">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-lg" />
          ))}
        </div>
      )}

      {list.data && list.data.length > 0 && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.data.map((item) => (
            <li key={item.id}>
              <ResumeCard item={item} tailorHref={tailorHref(item.id)} />
            </li>
          ))}
        </ul>
      )}

      {profile.data && profile.data.skillsToLearn.length > 0 && (
        <section className="rounded-lg border border-white/[0.08] bg-[#111111] p-5">
          <div className="flex flex-wrap items-center gap-2">
            <GraduationCap className="size-[18px] text-[#ff7a5c]" aria-hidden />
            <h2 className="text-base font-semibold text-white">Skills to learn</h2>
            <Badge variant="outline">Roadmaps — Coming soon</Badge>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {profile.data.skillsToLearn.map((s) => (
              <li key={s} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-white/85">
                {s}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
