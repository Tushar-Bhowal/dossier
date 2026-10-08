"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowUpRight, Check, ChevronDown, LoaderCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/use-me";
import { ApiError, createApplication, type SaveApplicationResult } from "@/lib/api";
import { readJobPage } from "@/lib/bookmark/api";
import type { FieldSource, ParsedJob } from "@/lib/bookmark/parse";
import { saveReturnTo } from "@/lib/returnTo";
import { cn } from "@/lib/utils";

function httpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="" width={26} height={26} className="size-[26px]" />
          <span className="text-base font-bold tracking-[-0.02em] text-white">Add to Dossier</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function Hint({ source }: { source: FieldSource }) {
  if (source === "found") return null;
  return (
    <p className="text-[13px] font-medium text-amber-200/80">
      {source === "guessed" ? "Guessed from the web address. Check it." : "We couldn't find this on the page. Please add it."}
    </p>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  source,
  required,
  invalid,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  source?: FieldSource;
  required?: boolean;
  invalid?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-sm font-semibold text-white/85">
        {label}
        {!required && <span className="font-medium text-white/45"> (optional)</span>}
      </Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid} className="h-11 text-[15px] md:text-[15px]" />
      {source && <Hint source={source} />}
      {invalid && (
        <p role="alert" className="text-[13px] font-medium text-[#ff8a70]">
          {label} is needed.
        </p>
      )}
    </div>
  );
}

function Form({ parsed, onSaved }: { parsed: ParsedJob; onSaved: (r: SaveApplicationResult) => void }) {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [company, setCompany] = React.useState(parsed.company);
  const [role, setRole] = React.useState(parsed.role);
  const [location, setLocation] = React.useState(parsed.location);
  const [applied, setApplied] = React.useState(false);
  const [showJd, setShowJd] = React.useState(false);
  const [tried, setTried] = React.useState(false);

  const save = useMutation({
    mutationFn: () =>
      createApplication({
        company: company.trim(),
        role: role.trim(),
        location: location.trim() || undefined,
        jobUrl: parsed.jobUrl || undefined,
        jdText: parsed.jdText || undefined,
        status: applied ? "applied" : "saved",
        appliedOn: applied ? today : undefined,
        source: "manual",
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      onSaved(result);
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!company.trim() || !role.trim()) return;
    save.mutate();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field id="add-role" label="Role" value={role} onChange={setRole} source={parsed.sources.role} required invalid={tried && !role.trim()} />
      <Field id="add-company" label="Company" value={company} onChange={setCompany} source={parsed.sources.company} required invalid={tried && !company.trim()} />
      <Field id="add-location" label="Location" value={location} onChange={setLocation} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-white/85">Where are you with it?</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              [false, "Saving for later"],
              [true, "Applied today"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={label}
              className={cn(
                "flex h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                applied === value ? "border-primary/50 bg-primary/10 text-white" : "border-white/10 text-white/70 hover:bg-white/[0.04]",
              )}
            >
              <input type="radio" name="stage" checked={applied === value} onChange={() => setApplied(value)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
        {parsed.jdText ? (
          <>
            <button type="button" onClick={() => setShowJd((v) => !v)} aria-expanded={showJd} className="flex w-full items-center justify-between gap-2 text-left">
              <span className="text-sm font-semibold text-white">Job description saved ({parsed.jdText.length.toLocaleString()} characters)</span>
              <ChevronDown className={cn("size-4 shrink-0 text-white/50 transition-transform motion-reduce:transition-none", showJd && "rotate-180")} aria-hidden />
            </button>
            {showJd && <p className="mt-3 max-h-48 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-white/65">{parsed.jdText}</p>}
            <p className="mt-1 text-[13px] font-medium text-white/50">Used later for interview kits and tailoring your resume.</p>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-white/60">
            <span className="font-semibold text-white/80">Tip:</span> select the job description on the page before clicking the bookmark, and
            it&apos;s saved too.
          </p>
        )}
      </div>

      {save.error && (
        <p role="alert" className="flex items-start gap-2 text-sm font-medium text-[#ff8a70]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Couldn&apos;t save. Check your connection and try again.
        </p>
      )}
      <Button type="submit" size="lg" className="h-12 text-base" disabled={save.isPending}>
        {save.isPending && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
        Save to my tracker
      </Button>
    </form>
  );
}

export function AddJob() {
  const params = useSearchParams();
  const router = useRouter();
  const me = useMe();
  const page = React.useMemo(
    () => ({ url: params?.get("url") ?? "", title: params?.get("title") ?? "", text: params?.get("text") ?? "" }),
    [params],
  );
  const parsed = useQuery({
    queryKey: ["bookmark", page.url, page.title],
    queryFn: () => readJobPage(page),
    enabled: Boolean(me.data),
    retry: false,
  });
  const [result, setResult] = React.useState<SaveApplicationResult | null>(null);

  const openInDossier = (id: string) => window.open(`/applications?open=${encodeURIComponent(id)}`, "_blank", "noopener");

  if (me.isPending) {
    return (
      <Shell>
        <Skeleton className="h-64 rounded-lg bg-white/[0.04]" />
      </Shell>
    );
  }

  if (me.isError) {
    const notSignedIn = me.error instanceof ApiError && me.error.status === 401;
    return (
      <Shell>
        <div className="flex flex-col gap-4 rounded-lg border border-white/[0.08] bg-[#111111] p-6">
          <p className="text-lg font-semibold text-white">{notSignedIn ? "Sign in to save this job" : "We couldn't reach Dossier"}</p>
          <p className="text-[15px] leading-relaxed text-white/65">
            {notSignedIn ? "You'll come straight back here after signing in." : "Check your connection, then try the bookmark again."}
          </p>
          {notSignedIn && (
            <Button
              size="lg"
              className="h-11 self-start"
              onClick={() => {
                saveReturnTo(`/add?${params?.toString() ?? ""}`);
                router.push("/login");
              }}
            >
              <LogIn className="size-4" aria-hidden />
              Sign in
            </Button>
          )}
        </div>
      </Shell>
    );
  }

  if (result) {
    const saved = result.ok;
    const record = result.record;
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 rounded-lg border border-white/[0.08] bg-[#111111] p-8 text-center">
          <span className={cn("flex size-12 items-center justify-center rounded-lg", saved ? "bg-emerald-500/15 text-emerald-300" : "bg-sky-500/15 text-sky-300")}>
            <Check className="size-6" aria-hidden />
          </span>
          <div>
            <p className="text-xl font-semibold text-white">{saved ? "Saved to your tracker" : "Already in your tracker"}</p>
            {record && (
              <p className="mt-1 text-[15px] text-white/65">
                {record.application.role} at {record.application.company}
              </p>
            )}
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            {record && (
              <Button variant="outline" className="h-11" onClick={() => openInDossier(record.id)}>
                Open in Dossier
                <ArrowUpRight className="size-4" aria-hidden />
              </Button>
            )}
            <Button className="h-11" onClick={() => window.close()}>
              Close this window
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {!page.url && !page.title ? (
        <p role="note" className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 text-sm text-white/65">
          This page opens from the &ldquo;Add to Dossier&rdquo; bookmark on a job page. You can still fill it in by hand.
        </p>
      ) : (
        <p className="truncate text-sm font-medium text-white/50" title={page.url}>
          From {httpUrl(page.url)?.hostname.replace(/^www\./, "") ?? "this page"}
        </p>
      )}
      {parsed.isPending ? (
        <div className="flex flex-col gap-4" role="status" aria-label="Reading the job page">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-white/80">
            <LoaderCircle className="size-4 animate-spin text-[#ff7a5c] motion-reduce:animate-none" aria-hidden />
            Reading the job page…
          </p>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg bg-white/[0.04]" />
          ))}
        </div>
      ) : (
        <>
          {parsed.isError && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm font-medium text-amber-100">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              We couldn&apos;t read this page. Fill in the role and company and it still saves.
            </p>
          )}
          <Form
            parsed={
              parsed.data ?? {
                company: "",
                role: "",
                location: "",
                jobUrl: httpUrl(page.url)?.toString() ?? "",
                jdText: "",
                sources: { company: "missing", role: "missing", location: "missing" },
              }
            }
            onSaved={setResult}
          />
        </>
      )}
    </Shell>
  );
}
