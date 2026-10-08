"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DropdownMenu } from "radix-ui";
import {
  CONNECTION_NOTE_LIMIT,
  PITCH_LIMIT,
  REFERRAL_MESSAGE_LIMIT,
  type ContactStatus,
  type DraftKind,
  type ReferralContact,
  type ReferralSuggestion,
  type SuggestResult,
} from "@dossier/core/applications";
import { ArrowRight, Check, Copy, ExternalLink, LoaderCircle, MoreHorizontal, PenLine, RefreshCcw, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { AiErrorNotice } from "@/components/resume/AiStatus";
import {
  REFERRAL_SAMPLE,
  draftMessage,
  getPitch,
  keepContact,
  listContacts,
  referralKeys,
  removeContact,
  savePitch,
  suggestPeople,
  updateContact,
  type JobContext,
} from "@/lib/referral/api";
import { cn } from "@/lib/utils";

const sectionTitle = "text-[13px] font-semibold uppercase tracking-[0.08em] text-white/45";

const STATUS: Record<ContactStatus, { label: string; next?: ContactStatus; nextLabel?: string; className: string }> = {
  to_contact: { label: "To contact", next: "requested", nextLabel: "I sent a request", className: "bg-white/[0.06] text-white/75" },
  requested: { label: "Request sent", next: "accepted", nextLabel: "They accepted", className: "bg-sky-500/10 text-sky-300" },
  accepted: { label: "Connected", next: "asked", nextLabel: "I asked for a referral", className: "bg-violet-500/10 text-violet-300" },
  asked: { label: "Asked for referral", next: "referred", nextLabel: "They referred me", className: "bg-amber-500/10 text-amber-300" },
  referred: { label: "Referred", className: "bg-emerald-500/10 text-emerald-300" },
  no_response: { label: "No reply", className: "bg-white/[0.04] text-white/50" },
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.07] text-[13px] font-bold text-white/80" aria-hidden>
      {initials(name)}
    </span>
  );
}

function ProfileLink({ url }: { url: string }) {
  if (REFERRAL_SAMPLE) {
    return (
      <span className="inline-flex h-10 items-center gap-1.5 text-sm font-semibold text-white/35" title="Sample person, not a real profile">
        <ExternalLink className="size-4" aria-hidden />
        Sample profile
      </span>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-1.5 text-sm font-semibold text-white/75 hover:text-white">
      <ExternalLink className="size-4" aria-hidden />
      Open profile
      <span className="sr-only">(opens LinkedIn in a new tab)</span>
    </a>
  );
}

function PitchDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved?: () => void }) {
  const queryClient = useQueryClient();
  const pitch = useQuery({ queryKey: referralKeys.pitch, queryFn: getPitch, enabled: open });
  const [text, setText] = React.useState<string | null>(null);
  const value = text ?? pitch.data?.text ?? "";
  const save = useMutation({
    mutationFn: () => savePitch({ text: value }),
    onSuccess: (saved) => {
      queryClient.setQueryData(referralKeys.pitch, saved);
      onOpenChange(false);
      setText(null);
      toast.success("Saved. Every message now starts from this.");
      onSaved?.();
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] gap-0 sm:max-w-lg">
        <DialogTitle className="text-lg font-semibold text-white">A few lines about you</DialogTitle>
        <DialogDescription className="mt-1 text-sm leading-relaxed text-white/60">
          Every message is written from this and nothing else, so only put what&apos;s true. Two or three sentences is plenty.
        </DialogDescription>
        <Label htmlFor="pitch" className="sr-only">
          About you
        </Label>
        <Textarea
          id="pitch"
          rows={5}
          value={value}
          maxLength={PITCH_LIMIT}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Staff nurse with 4 years in a 300-bed hospital's ICU. Trained new nurses on ventilator care."
          className="mt-4 text-[15px] md:text-[15px]"
        />
        <p className="mt-2 text-right text-[13px] font-medium tabular-nums text-white/50">
          {value.length} / {PITCH_LIMIT}
        </p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" className="h-11" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="h-11" onClick={() => save.mutate()} disabled={save.isPending || !value.trim()}>
            {save.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Composer({
  applicationId,
  contact,
  job,
  onClose,
  onSaved,
}: {
  applicationId: string;
  contact: ReferralContact;
  job: JobContext;
  onClose: () => void;
  onSaved: (c: ReferralContact) => void;
}) {
  const kind: DraftKind = contact.status === "to_contact" || contact.status === "requested" ? "connection" : "referral";
  const limit = kind === "connection" ? CONNECTION_NOTE_LIMIT : REFERRAL_MESSAGE_LIMIT;
  const saved = kind === "connection" ? contact.connectionNote : contact.referralMessage;
  const [text, setText] = React.useState(saved ?? "");
  const draft = useMutation({
    mutationFn: () => draftMessage(applicationId, contact.id, kind, job),
    onSuccess: (result) => setText(result.text),
  });
  const { mutate } = draft;
  // No saved message yet: start a draft as soon as the composer opens.
  React.useEffect(() => {
    if (!saved) mutate();
  }, [mutate, saved]);
  const over = text.length > limit;
  const near = !over && text.length >= limit * 0.9;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      toast.error("Couldn't copy", { description: "Select the text and copy it yourself." });
      return;
    }
    const withText = { ...contact, [kind === "connection" ? "connectionNote" : "referralMessage"]: text };
    onSaved(withText);
    const next: ContactStatus = kind === "connection" ? "requested" : "asked";
    toast.success("Copied. Paste it on LinkedIn.", {
      duration: 8000,
      action:
        contact.status !== next
          ? { label: kind === "connection" ? "Mark request sent" : "Mark asked", onClick: () => onSaved({ ...withText, status: next }) }
          : undefined,
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-primary/30 bg-[#0f0f0f] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">
          {kind === "connection" ? "Connection note" : "Referral request"} to {contact.name.split(" ")[0]}
        </p>
        <Button variant="ghost" size="icon" className="size-11 text-white/60 sm:size-9" aria-label="Close" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>
      {draft.isPending ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Writing a draft">
          <Skeleton className="h-4 w-full rounded-lg bg-white/[0.06]" />
          <Skeleton className="h-4 w-5/6 rounded-lg bg-white/[0.06]" />
          <Skeleton className="h-4 w-2/3 rounded-lg bg-white/[0.06]" />
          <p className="text-sm font-medium text-white/55">Writing from your pitch…</p>
        </div>
      ) : draft.error && !text ? (
        <AiErrorNotice error={draft.error} onRetry={() => draft.mutate()} />
      ) : (
        <>
          <Label htmlFor={`msg-${contact.id}`} className="sr-only">
            Message
          </Label>
          <Textarea
            id={`msg-${contact.id}`}
            rows={kind === "connection" ? 4 : 9}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-invalid={over}
            aria-describedby={`count-${contact.id}`}
            className="text-[15px] leading-relaxed md:text-[15px]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p id={`count-${contact.id}`} className={cn("text-[13px] font-semibold tabular-nums", over ? "text-[#ff8a70]" : near ? "text-amber-300" : "text-white/50")}>
              {text.length} / {limit}
              {over ? " · LinkedIn will cut this off" : kind === "connection" ? " · LinkedIn's limit for notes" : ""}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" className="h-11 sm:h-9" onClick={() => draft.mutate()} disabled={draft.isPending}>
                <RefreshCcw className="size-4" aria-hidden />
                Rewrite
              </Button>
              <Button className="h-11 sm:h-9" onClick={() => void copy()} disabled={!text.trim() || over}>
                <Copy className="size-4" aria-hidden />
                Copy
              </Button>
            </div>
          </div>
          <p className="text-[13px] font-medium text-white/45">Written only from your pitch and this role. Check it before you send.</p>
        </>
      )}
    </div>
  );
}

function ContactRow({
  applicationId,
  contact,
  job,
  onChange,
  onRemove,
}: {
  applicationId: string;
  contact: ReferralContact;
  job: JobContext;
  onChange: (c: ReferralContact) => void;
  onRemove: () => void;
}) {
  const [writing, setWriting] = React.useState(false);
  const meta = STATUS[contact.status];
  const writeLabel = contact.status === "to_contact" || contact.status === "requested" ? "Write note" : "Write referral ask";
  const done = contact.status === "referred" || contact.status === "no_response";

  return (
    <li className="rounded-lg border border-white/[0.08] bg-[#121212] p-4">
      <div className="flex items-start gap-3">
        <Avatar name={contact.name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-semibold text-white">{contact.name}</p>
            <span className={cn("inline-flex h-6 items-center rounded-lg px-2 text-xs font-semibold", meta.className)}>{meta.label}</span>
          </div>
          <p className="mt-0.5 text-sm text-white/55">{contact.headline}</p>
        </div>
        <DropdownMenu.Root modal={false}>
          <DropdownMenu.Trigger asChild>
            <Button variant="ghost" size="icon" className="size-11 shrink-0 text-white/60 sm:size-9" aria-label={`More for ${contact.name}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={6} className="z-[60] w-56 rounded-lg border border-white/10 bg-[#141414] p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]">
              {(Object.keys(STATUS) as ContactStatus[])
                .filter((s) => s !== contact.status)
                .map((s) => (
                  <DropdownMenu.Item
                    key={s}
                    onSelect={() => onChange({ ...contact, status: s })}
                    className="flex h-10 cursor-pointer items-center rounded-md px-3 text-sm font-medium text-white/85 outline-none data-[highlighted]:bg-white/[0.07]"
                  >
                    Set to: {STATUS[s].label}
                  </DropdownMenu.Item>
                ))}
              <DropdownMenu.Separator className="my-1.5 h-px bg-white/[0.08]" />
              <DropdownMenu.Item
                onSelect={onRemove}
                className="flex h-10 cursor-pointer items-center rounded-md px-3 text-sm font-medium text-[#ff8a70] outline-none data-[highlighted]:bg-destructive/10"
              >
                Remove {contact.name.split(" ")[0]}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      {!done && (
        <div className="mt-3 flex flex-wrap items-center gap-2 pl-[52px]">
          {meta.next && (
            <Button variant="outline" className="h-11 sm:h-9" onClick={() => onChange({ ...contact, status: meta.next! })}>
              <Check className="size-4" aria-hidden />
              {meta.nextLabel}
            </Button>
          )}
          <Button variant="ghost" className="h-11 sm:h-9" onClick={() => setWriting((v) => !v)} aria-expanded={writing}>
            <PenLine className="size-4" aria-hidden />
            {writeLabel}
          </Button>
          <ProfileLink url={contact.profileUrl} />
        </div>
      )}
      {writing && (
        <Composer
          key={contact.status === "to_contact" || contact.status === "requested" ? "c" : "r"}
          applicationId={applicationId}
          contact={contact}
          job={job}
          onClose={() => setWriting(false)}
          onSaved={onChange}
        />
      )}
    </li>
  );
}

function Suggestions({
  result,
  onKeep,
  onDismiss,
  keeping,
}: {
  result: SuggestResult;
  onKeep: (s: ReferralSuggestion) => void;
  onDismiss: () => void;
  keeping: string | null;
}) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-white">
            {result.suggestions.length ? `${result.suggestions.length} people who might help` : "We couldn't find anyone in public search results"}
          </p>
          <p className="mt-0.5 text-sm text-white/55">
            {result.suggestions.length ? "From public search results. Check they still work there." : "LinkedIn's own search usually finds more."}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="size-11 shrink-0 text-white/60 sm:size-9" aria-label="Close suggestions" onClick={onDismiss}>
          <X className="size-4" />
        </Button>
      </div>
      {result.suggestions.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {result.suggestions.map((s) => (
            <li key={s.profileUrl} className="flex items-start gap-3 rounded-lg bg-[#121212] p-3.5">
              <Avatar name={s.name} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[15px] font-semibold text-white">{s.name}</p>
                  <span className="inline-flex h-6 items-center rounded-lg bg-white/[0.06] px-2 text-xs font-semibold text-white/70">
                    {s.kind === "recruiter" ? "Recruiter" : "Same team"}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-white/60">{s.headline}</p>
                <p className="mt-1 text-[13px] font-medium text-white/45">{s.reason}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <Button size="sm" className="h-11 sm:h-8" onClick={() => onKeep(s)} disabled={keeping !== null}>
                    {keeping === s.profileUrl ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
                    Keep
                  </Button>
                  <ProfileLink url={s.profileUrl} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <a
        href={result.linkedinSearchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex h-11 items-center gap-1.5 text-sm font-semibold text-[#ff7a5c] hover:text-[#ff9478]"
      >
        Search LinkedIn yourself
        <ArrowRight className="size-4" aria-hidden />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </div>
  );
}

export function ReferralsSection({ applicationId, job }: { applicationId: string; job: JobContext }) {
  const queryClient = useQueryClient();
  const key = referralKeys.contacts(applicationId);
  const contacts = useQuery({ queryKey: key, queryFn: () => listContacts(applicationId) });
  const pitch = useQuery({ queryKey: referralKeys.pitch, queryFn: getPitch });
  const [pitchOpen, setPitchOpen] = React.useState(false);
  const [result, setResult] = React.useState<SuggestResult | null>(null);
  const [keeping, setKeeping] = React.useState<string | null>(null);

  const suggest = useMutation({ mutationFn: () => suggestPeople(applicationId, job), onSuccess: setResult });

  async function keep(s: ReferralSuggestion) {
    setKeeping(s.profileUrl);
    try {
      const contact = await keepContact(applicationId, s);
      queryClient.setQueryData<ReferralContact[]>(key, (list = []) => [...list, contact]);
      setResult((r) => (r ? { ...r, suggestions: r.suggestions.filter((x) => x.profileUrl !== s.profileUrl) } : r));
    } finally {
      setKeeping(null);
    }
  }

  function change(next: ReferralContact) {
    queryClient.setQueryData<ReferralContact[]>(key, (list = []) => list.map((c) => (c.id === next.id ? next : c)));
    void updateContact(applicationId, next);
  }

  function remove(contact: ReferralContact) {
    queryClient.setQueryData<ReferralContact[]>(key, (list = []) => list.filter((c) => c.id !== contact.id));
    void removeContact(applicationId, contact.id);
    toast.success(`Removed ${contact.name.split(" ")[0]}`);
  }

  const list = contacts.data ?? [];
  const hasPitch = Boolean(pitch.data?.text.trim());

  return (
    <section className="mt-7 flex flex-col gap-3" aria-labelledby="referrals-heading">
      <div className="flex items-center justify-between gap-3">
        <h3 id="referrals-heading" className={sectionTitle}>
          Referrals
        </h3>
        {pitch.data && (
          <button type="button" onClick={() => setPitchOpen(true)} className="h-9 text-[13px] font-semibold text-white/55 hover:text-white">
            {hasPitch ? "Edit about me" : "Add about me"}
          </button>
        )}
      </div>

      {REFERRAL_SAMPLE && (
        <p className="text-[13px] font-medium text-white/45">Sample people and drafts for now. Nothing here is saved.</p>
      )}

      {contacts.isPending ? (
        <Skeleton className="h-20 rounded-lg bg-white/[0.04]" />
      ) : (
        <>
          {list.length > 0 && (
            <ul className="flex flex-col gap-2">
              {list.map((c) => (
                <ContactRow key={c.id} applicationId={applicationId} contact={c} job={job} onChange={change} onRemove={() => remove(c)} />
              ))}
            </ul>
          )}

          {result ? (
            <Suggestions result={result} onKeep={(s) => void keep(s)} onDismiss={() => setResult(null)} keeping={keeping} />
          ) : (
            <div className={cn("flex flex-col gap-3 rounded-lg border border-white/[0.08] p-4", list.length ? "bg-transparent" : "bg-white/[0.02]")}>
              {!list.length && (
                <div className="flex items-start gap-3">
                  <Users className="mt-0.5 size-5 shrink-0 text-[#ff7a5c]" aria-hidden />
                  <div>
                    <p className="text-[15px] font-semibold text-white">A referral can move you to the top of the pile</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-white/60">
                      Find a recruiter and people in this role at {job.company}. We search public results; Dossier never signs in to LinkedIn, and
                      you send every message yourself.
                    </p>
                  </div>
                </div>
              )}
              <Button
                variant={list.length ? "ghost" : "outline"}
                className="h-11 self-start"
                onClick={() => (hasPitch ? suggest.mutate() : setPitchOpen(true))}
                disabled={suggest.isPending}
              >
                {suggest.isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
                {suggest.isPending ? "Searching…" : list.length ? "Find more people" : `Find people at ${job.company}`}
              </Button>
              {!hasPitch && pitch.data && <p className="text-[13px] font-medium text-white/50">First, a few lines about you. Every message is written from them.</p>}
            </div>
          )}
          {suggest.error && <AiErrorNotice error={suggest.error} onRetry={() => suggest.mutate()} />}
        </>
      )}

      <PitchDialog open={pitchOpen} onOpenChange={setPitchOpen} onSaved={() => !list.length && suggest.mutate()} />
    </section>
  );
}
