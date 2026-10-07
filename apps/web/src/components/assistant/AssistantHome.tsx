"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BellRing,
  Briefcase,
  CalendarClock,
  Clock,
  FolderKanban,
  Hourglass,
  Inbox,
  Languages,
  ListChecks,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { followUpDue, isClosed, isStale, nextInterview, toLocalDate, type ApplicationRecord } from "@dossier/core/applications";
import { listApplications, listEmailUpdates } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { applicationHref } from "./cards";
import { Composer, type ComposerHandle } from "./Composer";
import { Thread } from "./Thread";
import { useAssistant } from "./useAssistant";

const panel = "rounded-lg border border-white/[0.08] bg-[#111111] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]";

// What a first-time user can expect, each with a sentence they can send as-is. `fill: ""` means "paste".
const CAPABILITIES = [
  {
    icon: Briefcase,
    title: "Track applications",
    body: "Add jobs, move them through stages and plan follow-ups. Paste a job link and I read the page for you.",
    fill: "Applied to Stripe today for Frontend Engineer",
  },
  {
    icon: CalendarClock,
    title: "Interviews",
    body: "Add, move or cancel interviews. They show on your board and go to your calendar in one tap.",
    fill: "Razorpay round 2 is on Tuesday at 3 pm",
  },
  {
    icon: Inbox,
    title: "Recruiter emails",
    body: "Paste an email and I suggest the update. Nothing changes until you tap Apply.",
    fill: "",
  },
  {
    icon: BellRing,
    title: "Reminders",
    body: "Pick when you're reminded before interviews, and where: Telegram or browser notifications.",
    fill: "Remind me 1 day and 1 hour before every interview",
  },
  {
    icon: ListChecks,
    title: "What's next",
    body: "Ask what's due today, what's coming up or who hasn't replied. Answers come from your tracker.",
    fill: "What do I need to do today?",
  },
  {
    icon: FolderKanban,
    title: "Interview prep",
    body: "Turn an application into an interview kit: company research, likely questions and flashcards.",
    fill: "Make a prep kit for my Stripe interview",
  },
] as const;

const PROMISES = [
  { icon: RotateCcw, title: "Undo on every change", body: "Changes happen straight away; one tap puts them back." },
  { icon: ShieldCheck, title: "Pasted text only suggests", body: "Emails you paste become suggestions you approve." },
  { icon: Trash2, title: "Deleting asks first", body: "Nothing is removed without your yes." },
  { icon: Languages, title: "Any language", body: "English, हिन्दी, Hinglish and more. Type or speak." },
];

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function useToday() {
  const { data: records = [], isLoading } = useQuery({ queryKey: ["applications"], queryFn: listApplications });
  const { data: updates = [] } = useQuery({ queryKey: ["email-updates"], queryFn: listEmailUpdates });
  const now = new Date();
  const today = toLocalDate(now);
  const open = records.filter((r) => !isClosed(r.application.status));
  const interviews = open
    .map((r) => ({ r, i: nextInterview(r.application, now) }))
    .filter((x): x is { r: ApplicationRecord; i: NonNullable<typeof x.i> } => Boolean(x.i && toLocalDate(new Date(x.i.startsAt)) === today))
    .sort((a, b) => a.i.startsAt.localeCompare(b.i.startsAt));
  const due = open.filter((r) => followUpDue(r.application, now));
  const quiet = open.filter((r) => !followUpDue(r.application, now) && isStale(r.application, now));
  const stats = [
    { label: "Active", value: open.filter((r) => r.application.status !== "saved").length },
    { label: "Interviewing", value: open.filter((r) => r.application.status === "interviewing").length },
    { label: "Offers", value: open.filter((r) => r.application.status === "offer").length },
  ];
  return { isLoading, total: records.length, interviews, due, quiet, updates: updates.length, stats };
}

function TodayRow({
  href,
  icon,
  title,
  detail,
  tone = "primary",
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
  tone?: "primary" | "amber" | "sky";
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span
          aria-hidden
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            tone === "amber" && "bg-amber-400/10 text-amber-300",
            tone === "sky" && "bg-sky-400/10 text-sky-300",
            tone === "primary" && "bg-primary/15 text-[#ff7a5c]",
          )}
        >
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-white">{title}</span>
          <span className="block truncate text-sm font-medium text-white/55">{detail}</span>
        </span>
      </Link>
    </li>
  );
}

function TodayPanel() {
  const t = useToday();
  const date = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const empty = !t.interviews.length && !t.due.length && !t.updates && !t.quiet.length;

  return (
    <section aria-labelledby="today-heading" className={cn(panel, "p-5")}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="today-heading" className="text-[17px] font-semibold text-white">
          Today
        </h2>
        <span className="text-sm font-medium text-white/50">{date}</span>
      </div>

      {t.isLoading ? (
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      ) : empty ? (
        <p className="mt-3 text-[15px] font-medium leading-relaxed text-white/60">
          {t.total
            ? "Nothing is due today. A good day to apply somewhere new."
            : "Nothing here yet. Tell me about a job you've applied to, and your interviews and follow-ups will show up here."}
        </p>
      ) : (
        <ul className="-mx-2 mt-3 flex flex-col">
          {t.interviews.map(({ r, i }) => (
            <TodayRow
              key={`i-${r.id}`}
              href={applicationHref(r.id)}
              tone="amber"
              icon={<CalendarClock className="size-4" />}
              title={`${r.application.company} interview at ${time(i.startsAt)}`}
              detail={`${r.application.role}${i.round ? ` · Round ${i.round}` : ""}`}
            />
          ))}
          {t.due.map((r) => (
            <TodayRow
              key={`f-${r.id}`}
              href={applicationHref(r.id)}
              icon={<BellRing className="size-4" />}
              title={`Follow up with ${r.application.company}`}
              detail={r.application.role}
            />
          ))}
          {t.updates > 0 && (
            <TodayRow
              href="/applications"
              tone="sky"
              icon={<Inbox className="size-4" />}
              title={`${t.updates} ${t.updates === 1 ? "update" : "updates"} to review`}
              detail="Suggested from emails or your AI assistant"
            />
          )}
          {t.quiet.slice(0, 3).map((r) => (
            <TodayRow
              key={`q-${r.id}`}
              href={applicationHref(r.id)}
              icon={<Hourglass className="size-4" />}
              title={`No reply from ${r.application.company}`}
              detail="3 weeks quiet · worth a follow-up"
            />
          ))}
        </ul>
      )}

      {t.total > 0 && (
        <>
          <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-4">
            {t.stats.map((s) => (
              <div key={s.label} className="flex flex-col-reverse">
                <dt className="text-sm font-medium text-white/55">{s.label}</dt>
                <dd className="text-xl font-semibold tabular-nums tracking-[-0.02em] text-white">{s.value}</dd>
              </div>
            ))}
          </dl>
          <Link href="/applications" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#ff7a5c] hover:text-white">
            Open your board <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </>
      )}
    </section>
  );
}

function TrySaying({ onPick }: { onPick: (fill: string) => void }) {
  return (
    <section aria-labelledby="try-heading" className={cn(panel, "p-5")}>
      <h2 id="try-heading" className="text-[17px] font-semibold text-white">
        Try saying
      </h2>
      <ul className="-mx-2 mt-2 flex flex-col">
        {CAPABILITIES.map((c) => (
          <li key={c.title}>
            <button
              type="button"
              onClick={() => onPick(c.fill)}
              className="flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-ring"
            >
              <c.icon className="mt-0.5 size-4 shrink-0 text-[#ff7a5c]" aria-hidden />
              <span className="text-[15px] font-medium text-white/80">{c.fill ? `“${c.fill}”` : "Paste a recruiter email"}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Capabilities({ onPick }: { onPick: (fill: string) => void }) {
  return (
    <section aria-labelledby="can-do-heading" className="flex flex-col gap-4">
      <h2 id="can-do-heading" className="text-[17px] font-semibold text-white">
        What I can do for you
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {CAPABILITIES.map((c) => (
          <li key={c.title}>
            <button
              type="button"
              onClick={() => onPick(c.fill)}
              className={cn(
                panel,
                "group flex h-full w-full flex-col gap-3 p-5 text-left transition-[border-color,box-shadow] hover:border-primary/35 hover:shadow-[0_16px_40px_-22px_rgba(251,65,40,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              )}
            >
              <span className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-[#ff7a5c] ring-1 ring-primary/25" aria-hidden>
                  <c.icon className="size-5" />
                </span>
                <span className="text-base font-semibold text-white">{c.title}</span>
              </span>
              <span className="text-[15px] font-medium leading-relaxed text-white/65">{c.body}</span>
              <span className="mt-auto flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white/80 transition-colors group-hover:bg-white/[0.07] group-hover:text-white">
                <span className="min-w-0 flex-1">{c.fill ? `“${c.fill}”` : "Paste the email into the box"}</span>
                <ArrowRight className="size-3.5 shrink-0 text-[#ff7a5c]" aria-hidden />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HowIWork() {
  return (
    <section aria-labelledby="how-heading" className={cn(panel, "p-5")}>
      <h2 id="how-heading" className="text-[17px] font-semibold text-white">
        How I work
      </h2>
      <ul className="mt-4 flex flex-col gap-4">
        {PROMISES.map((p) => (
          <li key={p.title} className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-white/75" aria-hidden>
              <p.icon className="size-4" />
            </span>
            <span>
              <span className="block text-[15px] font-semibold text-white">{p.title}</span>
              <span className="block text-sm font-medium leading-relaxed text-white/60">{p.body}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-5 flex items-start gap-2 border-t border-white/[0.06] pt-4 text-sm font-medium leading-relaxed text-white/55">
        <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
        Coming soon: resume help in chat, and reminders by email, WhatsApp or SMS.
      </p>
    </section>
  );
}

export function AssistantHome() {
  const assistant = useAssistant();
  const composer = React.useRef<ComposerHandle>(null);
  const [pasteHint, setPasteHint] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);
  const conversation = assistant.messages.length > 0 || assistant.busy;

  const pick = (fill: string) => {
    setPasteHint(!fill);
    composer.current?.fill(fill);
  };
  const send = (text: string, attachment?: string) => {
    setPasteHint(false);
    void assistant.send(text, attachment);
  };

  const composerBox = (
    <div className="flex flex-col gap-2">
      <Composer
        ref={composer}
        id="assistant-home-composer"
        large={!conversation}
        busy={assistant.busy}
        onSend={send}
        placeholder={pasteHint ? "Paste the email here" : "Tell me what happened, or ask what's next…"}
      />
      {pasteHint && (
        <p className="text-sm font-medium text-white/60">Paste the whole email. I&apos;ll suggest the updates; nothing changes until you tap Apply.</p>
      )}
    </div>
  );

  return (
    <div className="flex w-full flex-1 flex-col gap-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.035em] text-white">{greeting(new Date())}</h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-white/60">
            I&apos;m your job-search assistant. Tell me what happened — in your own words, any language — and I&apos;ll keep your
            applications, interviews and reminders up to date.
          </p>
        </div>
        {assistant.messages.length > 0 && (
          <Button variant="outline" size="sm" className="self-start sm:self-auto" onClick={() => setClearing(true)}>
            <Trash2 className="size-3.5" aria-hidden /> Clear conversation
          </Button>
        )}
      </header>

      <div className="grid flex-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-8">
          {assistant.loading ? (
            <Skeleton className="h-36 rounded-lg" />
          ) : conversation ? (
            <div className="mx-auto flex w-full max-w-[820px] flex-1 flex-col">
              <Thread assistant={assistant} />
              <div className="sticky bottom-0 -mx-1 mt-6 bg-gradient-to-t from-background from-70% to-transparent px-1 pt-4 pb-4 md:pb-6">
                {composerBox}
              </div>
            </div>
          ) : (
            <>
              {composerBox}
              <div className="lg:hidden">
                <TodayPanel />
              </div>
              <Capabilities onPick={pick} />
              <div className="lg:hidden">
                <HowIWork />
              </div>
            </>
          )}
        </div>

        <aside className={cn("flex-col gap-4 lg:sticky lg:top-[calc(var(--app-header-height,4rem)+1.5rem)]", conversation ? "flex" : "hidden lg:flex")}>
          <TodayPanel />
          {conversation ? (
            <div className="hidden lg:block">
              <TrySaying onPick={pick} />
            </div>
          ) : (
            <HowIWork />
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={clearing}
        onOpenChange={setClearing}
        title="Clear the conversation?"
        description="Your applications, interviews and settings stay exactly as they are. Only this chat is deleted."
        confirmLabel="Clear"
        onConfirm={assistant.clear}
      />
    </div>
  );
}
