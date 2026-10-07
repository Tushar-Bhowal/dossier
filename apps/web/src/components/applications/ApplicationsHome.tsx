"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  BellRing,
  Briefcase,
  Hourglass,
  LayoutList,
  Plus,
  RefreshCcw,
  Search,
  SquareKanban,
  Trophy,
  Users,
  Activity,
  ArrowUpRight,
  Bell,
  CalendarClock,
  MessageSquareText,
} from "lucide-react";
import {
  OPEN_STAGES,
  addDays,
  followUpDue,
  isClosed,
  isStale,
  nextInterview,
  toLocalDate,
  type ApplicationRecord,
  type ApplicationStatus,
} from "@dossier/core/applications";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LightRays } from "@/components/ui/light-rays";
import { cn } from "@/lib/utils";
import { AddApplicationDialog } from "./AddApplicationDialog";
import { ApplicationList } from "./ApplicationList";
import { ApplicationSheet } from "./ApplicationSheet";
import { Board } from "./Board";
import { STATUS_LABEL } from "./statusStyle";
import { useApplications } from "./useApplications";
import { NotificationsSheet } from "./NotificationsSheet";
import { UpdatesToReview } from "./EmailUpdates";
import { useAssistantPanel } from "@/components/assistant/AssistantPanel";
import { setOpenApplication } from "@/components/assistant/useAssistant";

type View = "board" | "list";
const VIEW_KEY = "dossier.applications.view";

const viewListeners = new Set<() => void>();

function readView(): View | null {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === "board" || v === "list" ? v : null;
  } catch {
    return null;
  }
}

function subscribeView(listener: () => void) {
  viewListeners.add(listener);
  return () => viewListeners.delete(listener);
}

function saveView(view: View) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // private mode: the choice just isn't remembered
  }
  viewListeners.forEach((l) => l());
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

function Stats({ records }: { records: ApplicationRecord[] }) {
  const apps = records.map((r) => r.application);
  const sent = apps.filter((a) => a.status !== "saved");
  const heardBack = sent.filter((a) =>
    a.statusHistory.some((e) => e.status === "online_test" || e.status === "interviewing" || e.status === "offer"),
  );
  const tiles = [
    { icon: Briefcase, label: "Active", value: String(apps.filter((a) => !isClosed(a.status) && a.status !== "saved").length) },
    { icon: Users, label: "Interviewing", value: String(apps.filter((a) => a.status === "interviewing").length) },
    { icon: Trophy, label: "Offers", value: String(apps.filter((a) => a.status === "offer").length) },
    {
      icon: Activity,
      label: "Response rate",
      value: sent.length ? `${Math.round((heardBack.length / sent.length) * 100)}%` : "–",
    },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map(({ icon: Icon, label, value }) => (
        <div
          key={label}
          className="flex items-center gap-4 rounded-lg border border-white/[0.08] bg-[#111111] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-[#ff7a5c] ring-1 ring-primary/25">
            <Icon className="size-5" aria-hidden />
          </span>
          <div>
            <dd className="text-2xl font-semibold tabular-nums tracking-[-0.02em] text-white">{value}</dd>
            <dt className="text-sm font-medium text-white/55">{label}</dt>
          </div>
        </div>
      ))}
    </dl>
  );
}

function NeedsYou({
  records,
  now,
  onOpen,
  update,
}: {
  records: ApplicationRecord[];
  now: Date;
  onOpen: (id: string) => void;
  update: ReturnType<typeof useApplications>["update"];
}) {
  const today = toLocalDate(now);
  const interviewsToday = records
    .filter((r) => !isClosed(r.application.status))
    .map((record) => ({ record, interview: nextInterview(record.application, now) }))
    .filter((x): x is { record: ApplicationRecord; interview: NonNullable<typeof x.interview> } =>
      Boolean(x.interview && toLocalDate(new Date(x.interview.startsAt)) === today),
    )
    .sort((a, b) => a.interview.startsAt.localeCompare(b.interview.startsAt));
  const due = records.filter((r) => followUpDue(r.application, now));
  const stale = records.filter((r) => !followUpDue(r.application, now) && isStale(r.application, now));
  if (interviewsToday.length === 0 && due.length === 0 && stale.length === 0) return null;

  const item = (record: ApplicationRecord, kind: "due" | "stale") => {
    const app = record.application;
    return (
      <li
        key={`${kind}-${record.id}`}
        className="flex flex-col gap-3 rounded-lg border border-white/[0.08] bg-[#141414] p-4 sm:flex-row sm:items-center"
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            kind === "due" ? "bg-primary/15 text-[#ff7a5c]" : "bg-amber-400/10 text-amber-300",
          )}
          aria-hidden
        >
          {kind === "due" ? <BellRing className="size-4" /> : <Hourglass className="size-4" />}
        </span>
        <button type="button" onClick={() => onOpen(record.id)} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-[15px] font-semibold text-white">
            {kind === "due" ? `Follow up with ${app.company}` : `No update from ${app.company} in 3 weeks`}
          </span>
          <span className="block truncate text-sm font-medium text-white/55">
            {app.role} · {STATUS_LABEL[app.status]}
          </span>
        </button>
        <div className="flex gap-2">
          {kind === "due" ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => update(record.id, (input) => ({ ...input, followUpOn: addDays(today, 3) }))}
              >
                In 3 days
              </Button>
              <Button
                size="sm"
                onClick={() => update(record.id, (input) => ({ ...input, followUpOn: undefined }), "Follow-up done")}
              >
                Done
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => update(record.id, (input) => ({ ...input, followUpOn: addDays(today, 7) }), "Snoozed for a week")}
              >
                Snooze 7 days
              </Button>
              <Button
                size="sm"
                onClick={() => update(record.id, (input) => ({ ...input, status: "no_reply" }), `Marked No reply`)}
              >
                Mark No reply
              </Button>
            </>
          )}
        </div>
      </li>
    );
  };

  return (
    <section aria-labelledby="needs-you" className="flex flex-col gap-3">
      <h2 id="needs-you" className="flex items-center gap-2 text-[15px] font-semibold text-white">
        Needs you today
        <span className="rounded-lg bg-primary/15 px-1.5 text-[13px] font-semibold tabular-nums text-[#ff7a5c]">
          {interviewsToday.length + due.length + stale.length}
        </span>
      </h2>
      <ul className="flex flex-col gap-2">
        {interviewsToday.map(({ record, interview }) => (
          <li
            key={`interview-${record.id}`}
            className="flex flex-col gap-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] p-4 sm:flex-row sm:items-center"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300" aria-hidden>
              <CalendarClock className="size-4" />
            </span>
            <button type="button" onClick={() => onOpen(record.id)} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[15px] font-semibold text-white">
                Interview with {record.application.company} at{" "}
                {new Date(interview.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              </span>
              <span className="block truncate text-sm font-medium text-white/55">
                {record.application.role}
                {interview.round ? ` · Round ${interview.round}` : ""}
              </span>
            </button>
            {interview.meetingUrl ? (
              <Button asChild size="sm">
                <a href={interview.meetingUrl} target="_blank" rel="noopener noreferrer">
                  Join <ArrowUpRight className="size-3.5" aria-hidden />
                </a>
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => onOpen(record.id)}>
                Open
              </Button>
            )}
          </li>
        ))}
        {due.map((r) => item(r, "due"))}
        {stale.map((r) => item(r, "stale"))}
      </ul>
    </section>
  );
}

const FILTERS: { id: "all" | "active" | ApplicationStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  ...OPEN_STAGES.filter((s) => s !== "saved").map((s) => ({ id: s, label: STATUS_LABEL[s] })),
];

export function ApplicationsHome() {
  const api = useApplications();
  const { records, isLoading, isError, refetch, update } = api;
  const isMobile = useIsMobile();
  // null on the server, so the first render matches and the saved choice applies right after.
  const storedView = React.useSyncExternalStore(subscribeView, readView, () => null);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]["id"]>("all");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [notifying, setNotifying] = React.useState(false);
  const [kitFor, setKitFor] = React.useState<string | null>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const assistantPanel = useAssistantPanel();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Links from the assistant: ?open=<id> (&section=kit), ?new=1, ?reminders=1. Read during render, like
  // ?new on the kits page, so the sheet doesn't paint closed for a frame first.
  const params = searchParams?.toString() ?? "";
  const [lastParams, setLastParams] = React.useState<string | null>(null);
  if (params !== lastParams) {
    setLastParams(params);
    const open = searchParams?.get("open");
    if (open) setOpenId(open);
    if (open && searchParams?.get("section") === "kit") setKitFor(open);
    if (searchParams?.get("new") === "1") setAdding(true);
    if (searchParams?.get("reminders") === "1") setNotifying(true);
  }
  React.useEffect(() => {
    if (params) router.replace("/applications", { scroll: false });
  }, [params, router]);

  // The assistant knows which application is open, so "move this one to round 2" just works.
  React.useEffect(() => {
    setOpenApplication(openId);
    return () => setOpenApplication(null);
  }, [openId]);
  const now = React.useMemo(() => new Date(), []);
  const today = toLocalDate(now);

  const view: View = isMobile ? "list" : (storedView ?? "board");

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || document.querySelector('[role="dialog"]')) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setAdding(true);
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      const app = r.application;
      if (q && !`${app.company} ${app.role} ${app.location ?? ""}`.toLowerCase().includes(q)) return false;
      if (filter === "all") return true;
      if (filter === "active") return !isClosed(app.status) && app.status !== "saved";
      return app.status === filter;
    });
  }, [records, query, filter]);

  const move = (id: string, status: ApplicationStatus) => update(id, (input) => ({ ...input, status }), `Moved to ${STATUS_LABEL[status]}`);
  const openRecord = records.find((r) => r.id === openId);
  const hasRecords = records.length > 0;

  React.useEffect(() => {
    if (!kitFor || openRecord?.id !== kitFor) return;
    // After the sheet has slid in.
    const timer = setTimeout(() => {
      document.querySelector('[aria-label="Interview kit"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
      setKitFor(null);
    }, 350);
    return () => clearTimeout(timer);
  }, [kitFor, openRecord?.id]);

  return (
    <div className="mx-auto flex w-full flex-col gap-7">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.035em] text-white">Applications</h1>
          <p className="mt-2 text-base text-white/60">Every job you apply to, where it stands, and what to do next.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="lg" variant="outline" onClick={() => setNotifying(true)}>
            <Bell className="size-4" aria-hidden />
            Reminders
          </Button>
          <Button size="lg" variant="outline" onClick={() => assistantPanel.setOpen(true)}>
            <MessageSquareText className="size-4" aria-hidden />
            Ask Dossier
          </Button>
          <Button size="lg" onClick={() => setAdding(true)} className="flex-1 sm:flex-none">
            <Plus className="size-4" aria-hidden />
            Add application
            <kbd className="ml-1 hidden rounded border border-white/25 px-1.5 text-[12px] font-semibold text-white/80 sm:inline">N</kbd>
          </Button>
        </div>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Couldn&apos;t load your applications</AlertTitle>
          <AlertDescription className="mt-1 flex items-center justify-between gap-3">
            <span>Check your connection and try again.</span>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              <RefreshCcw className="size-3.5" aria-hidden /> Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="flex flex-col gap-4" role="status" aria-label="Loading applications">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[86px] rounded-lg" />
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-lg" />
            ))}
          </div>
        </div>
      )}

      {!isLoading && !isError && !hasRecords && (
        <div className="relative flex flex-col items-center overflow-hidden rounded-lg border border-white/[0.08] bg-[#0f0f0f] px-6 py-20 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 bg-[radial-gradient(ellipse_50%_60%_at_50%_0%,rgba(255,96,48,0.2),transparent_75%)]" />
            <LightRays color="rgba(255, 96, 48, 0.18)" count={5} blur={40} speed={16} length="90%" />
          </div>
          <div className="relative flex size-14 items-center justify-center rounded-lg bg-[#dc3019] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_14px_40px_-12px_rgba(251,65,40,0.8)]">
            <SquareKanban className="size-7" aria-hidden />
          </div>
          <h2 className="relative mt-6 text-2xl font-semibold tracking-[-0.03em] text-white">Track every application in one place</h2>
          <p className="relative mt-2 max-w-md text-base leading-relaxed text-white/60">
            Paste a job link and Dossier fills in the company and role. Move it along as you hear back, and get a nudge when
            it&apos;s time to follow up.
          </p>
          <Button size="lg" className="relative mt-7" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden /> Add your first application
          </Button>
        </div>
      )}

      {hasRecords && (
        <>
          <Stats records={records} />
          <UpdatesToReview />
          <NeedsYou records={records} now={now} onOpen={setOpenId} update={update} />

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative w-full lg:max-w-xs">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/40" aria-hidden />
              <Input
                ref={searchRef}
                type="search"
                aria-label="Search applications"
                placeholder="Search company or role"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-10 pl-10 pr-9"
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-white/15 px-1.5 text-[12px] font-semibold text-white/45 sm:block">
                /
              </kbd>
            </div>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]" role="group" aria-label="Filter by stage">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "h-9 shrink-0 rounded-lg px-3 text-sm font-semibold transition-colors",
                    filter === f.id ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {!isMobile && (
              <div className="ml-auto flex rounded-lg border border-white/10 bg-white/[0.03] p-1" role="group" aria-label="View">
                {(
                  [
                    { id: "board", label: "Board", icon: SquareKanban },
                    { id: "list", label: "List", icon: LayoutList },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={view === id}
                    onClick={() => saveView(id)}
                    className={cn(
                      "flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors",
                      view === id ? "bg-white/10 text-white" : "text-white/55 hover:text-white",
                    )}
                  >
                    <Icon className="size-4" aria-hidden /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {visible.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/10 p-8 text-center text-[15px] font-medium text-white/55">
              Nothing matches. Try another search or filter.
            </p>
          ) : view === "board" ? (
            <Board records={visible} today={today} onOpen={setOpenId} onMove={move} />
          ) : (
            <ApplicationList records={visible} today={today} onOpen={setOpenId} onMove={move} />
          )}
        </>
      )}

      <AddApplicationDialog
        open={adding}
        onOpenChange={setAdding}
        create={api.create}
        onOpenExisting={(record) => setOpenId(record.id)}
      />
      <ApplicationSheet record={openRecord} api={api} onOpenChange={(open) => !open && setOpenId(null)} />
      <NotificationsSheet open={notifying} onOpenChange={setNotifying} />
    </div>
  );
}
