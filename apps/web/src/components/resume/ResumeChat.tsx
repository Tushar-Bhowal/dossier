"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { Code, FileUp, GraduationCap, LoaderCircle, ShieldCheck, Sprout, type LucideIcon } from "lucide-react";
import {
  entriesForPrompt,
  redact,
  type AnswersResult,
  type CareerProfile,
  type Contact,
  type ParseResult,
  type Region,
} from "@dossier/core/resume";
import {
  addNote,
  composeResume,
  getProfile,
  importResume,
  parseDescription,
  resumeKeys,
  saveProfile,
  submitAnswers,
} from "@/lib/resume/api";
import { contactFromText, looksLikeResume, withLink } from "@/lib/resume/contact";
import { mergeIntoProfile, profileFromParse } from "@/lib/resume/profile";
import { extractPdfText } from "@/lib/resume/pdfText";
import { extractDocxText } from "@/lib/resume/docxText";
import { DEMO_UI, setScenario, useScenario, type Persona } from "@/lib/resume/demo/scenario";
import { fixtureFor } from "@/lib/resume/demo/store";
import { Accent } from "@/components/landing/SectionHeading";
import { AiErrorNotice, AiProgress } from "./AiStatus";
import { Composer, type Attachment, type ImportedText } from "./chat/Composer";
import { AssistantMessage, AssistantText, UserMessage } from "./chat/Thread";
import { ContactCard } from "./chat/ContactCard";
import { QuestionsCard } from "./chat/QuestionsCard";
import { DutiesCard } from "./chat/DutiesCard";
import { ConfirmCard } from "./chat/ConfirmCard";
import { DoneCard } from "./chat/DoneCard";
import { Steps } from "./chat/Steps";

type StageKey = "opening" | "intro" | "contact" | "questions" | "duties" | "confirm" | "done";
type ThreadKey = StageKey | `note:${string}`;

interface Note {
  text: string;
  status: "pending" | "added" | "error";
  result?: AnswersResult;
  // Contact fields the note changed; they were kept out of the AI call.
  contactUpdated?: string[];
  error?: unknown;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MIN_FILE_TEXT = 50;
const MIN_DESCRIBE = 10;
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const TOKEN = /\[(?:EMAIL|PHONE|LINK)_\d+\]/g;
// A job that already has this many lines doesn't need the duty checklist.
const COVERED_FACTS = 3;

const STARTERS: { label: string; icon: LucideIcon; starter?: string; persona?: Persona; attach?: true }[] = [
  {
    label: "I'm a teacher",
    icon: GraduationCap,
    starter: "I'm a teacher. I teach … to class … at … since …. I studied …. On the computer I know ….",
    persona: "teacher",
  },
  {
    label: "I'm a software engineer",
    icon: Code,
    starter: "I'm a software engineer at … since …. I work on …. Before that I ….",
    persona: "engineer",
  },
  { label: "I'm a fresher", icon: Sprout, starter: "I just finished … from … in …. I know …. In college I …." },
  { label: "Improve my resume", icon: FileUp, attach: true },
];

const PROGRESS = {
  parse: ["Reading what you wrote", "Understanding your language", "Picking questions for your role"],
  import: ["Reading your resume", "Finding your jobs and studies", "Picking out the facts"],
  answers: ["Turning your answers into facts", "Adding what you ticked"],
  compose: ["Saving your details", "Writing each line from your facts", "Checking nothing was added", "Laying out your resume"],
};

function defaultRegion(): Region {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return zone === "Asia/Kolkata" || zone === "Asia/Calcutta" ? "IN" : "abroad";
}

function defaultLang(): string {
  const l = navigator.language.toLowerCase();
  if (l.startsWith("hi")) return "hi-IN";
  if (l.startsWith("bn")) return "bn-IN";
  return "en-IN";
}

export function ResumeChat() {
  const queryClient = useQueryClient();
  const scenario = useScenario();
  const reduceMotion = useReducedMotion();
  const fixture = fixtureFor(scenario.persona);
  const { data: existing } = useQuery({ queryKey: resumeKeys.profile, queryFn: getProfile });

  // Dashboard pages render only in the browser (the layout waits for the session), so reading the
  // browser's time zone and language here can't cause a hydration mismatch.
  const [region, setRegion] = React.useState<Region>(() => (typeof window === "undefined" ? "IN" : defaultRegion()));
  const [lang, setLang] = React.useState(() => (typeof window === "undefined" ? "en-IN" : defaultLang()));

  const [draftText, setDraftText] = React.useState("");
  const [attachment, setAttachment] = React.useState<Attachment | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const dragDepth = React.useRef(0);
  const filePicker = React.useRef<HTMLInputElement>(null);

  const [opening, setOpening] = React.useState<{
    text: string;
    fileName?: string;
    hidden?: number;
    asResume?: boolean;
  } | null>(null);
  const [thread, setThread] = React.useState<ThreadKey[]>([]);
  const [parse, setParse] = React.useState<ParseResult | null>(null);
  const [contact, setContact] = React.useState<Contact>({ name: "", links: [] });
  const [link, setLink] = React.useState("");
  const [contactDone, setContactDone] = React.useState(false);
  const [contactFound, setContactFound] = React.useState<"text" | "profile" | null>(null);
  const [showAllDuties, setShowAllDuties] = React.useState(false);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [questionsDone, setQuestionsDone] = React.useState(false);
  const [ticked, setTicked] = React.useState<Set<string>>(new Set());
  const [dutiesDone, setDutiesDone] = React.useState(false);
  const [draft, setDraft] = React.useState<CareerProfile | null>(null);
  const [notes, setNotes] = React.useState<Record<string, Note>>({});
  const [composed, setComposed] = React.useState<{ resumeId: string; profile: CareerProfile; fallbacks: number } | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);

  const push = (...keys: ThreadKey[]) => setThread((t) => [...t, ...keys.filter((k) => !t.includes(k))]);

  // Whatever the user already gave us is filled in, so they confirm it instead of typing it again.
  // What they just sent is newer than their saved profile, so it wins field by field.
  const prefillContact = (imported: ImportedText, result: ParseResult) => {
    const found = contactFromText(imported.original, imported.redaction);
    const fromText: Partial<Contact> = {
      ...(found.contact.name ? { name: found.contact.name } : {}),
      ...(found.contact.email ? { email: found.contact.email } : {}),
      ...(found.contact.phone ? { phone: found.contact.phone } : {}),
      ...(result.location ? { location: result.location } : {}),
    };
    const inText = Boolean(found.contact.name && (found.contact.email || found.contact.phone));
    setContact({ ...(existing?.contact ?? { name: "", links: [] }), ...fromText });
    setLink(found.link || existing?.contact.links[0]?.url || "");
    setContactFound(inText ? "text" : existing ? "profile" : null);
  };

  const afterParse = (result: ParseResult, imported: ImportedText) => {
    setParse(result);
    prefillContact(imported, result);
    push("intro", "contact");
  };

  // Typed text is redacted exactly like an uploaded file: phone, email and links never reach the AI.
  const parseMutation = useMutation({
    mutationFn: (imported: ImportedText) => parseDescription({ text: imported.redaction.text, region }),
    onSuccess: (result, imported) => afterParse(result, imported),
  });

  const importMutation = useMutation({
    mutationFn: (imported: ImportedText) => importResume({ redactedText: imported.redaction.text, region }),
    onSuccess: (result, imported) => afterParse(result, imported),
  });

  const addedNoteResults = () =>
    Object.values(notes)
      .filter((n) => n.status === "added" && n.result)
      .map((n) => n.result!);

  const createDraft = (result: AnswersResult | null) => {
    if (!parse) return;
    let profile = profileFromParse(parse, withLink(contact, link), region, existing ?? null);
    if (result) profile = mergeIntoProfile(profile, result);
    for (const r of addedNoteResults()) profile = mergeIntoProfile(profile, r);
    setDraft(profile);
    push("confirm");
  };

  const answersMutation = useMutation({
    mutationFn: () =>
      submitAnswers({
        answers: Object.entries(answers)
          .filter(([, v]) => v.trim())
          .map(([questionId, v]) => ({ questionId, text: redact(v.trim()).text })),
        tickedDuties: (parse?.suggestedDuties ?? []).filter((d) => ticked.has(d.text)),
      }),
    onSuccess: (result) => createDraft(result),
  });

  // Duties ticked after the draft exists (the checklist was skipped, then reopened) merge into it.
  const extraDutiesMutation = useMutation({
    mutationFn: (tickedDuties: { text: string; entryId: string }[]) => submitAnswers({ answers: [], tickedDuties }),
    onSuccess: (result) => setDraft((d) => (d ? mergeIntoProfile(d, result) : d)),
  });

  const composeMutation = useMutation({
    mutationFn: async (profile: CareerProfile) => {
      const saved = await saveProfile(profile);
      const result = await composeResume({});
      return { saved, result };
    },
    onSuccess: ({ saved, result }) => {
      setComposed({ resumeId: result.resume.id, profile: saved, fallbacks: result.fallbackBulletIds.length });
      push("done");
      void queryClient.invalidateQueries({ queryKey: resumeKeys.all });
    },
  });

  const runAnswers = () => {
    const anything = Object.values(answers).some((v) => v.trim()) || ticked.size > 0;
    if (anything) answersMutation.mutate();
    else createDraft(null);
  };

  const coveredEntries = new Set(
    (parse?.entries ?? [])
      .filter((e) => (parse?.facts ?? []).filter((f) => f.entryId === e.id).length >= COVERED_FACTS)
      .map((e) => e.id),
  );
  const dutiesToAsk = (parse?.suggestedDuties ?? []).filter((d) => showAllDuties || !coveredEntries.has(d.entryId));
  const dutiesSkipped = Boolean(parse?.suggestedDuties.length) && dutiesToAsk.length === 0;

  const toDuties = () => {
    if (!parse?.suggestedDuties.length) return runAnswers();
    push("duties");
    if (dutiesSkipped) {
      setDutiesDone(true);
      runAnswers();
    }
  };

  const attach = async (file: File) => {
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const isDocx = file.type === DOCX_TYPE || /\.docx$/i.test(file.name);
    if (!isPdf && !isDocx) {
      setAttachment({
        status: "unreadable",
        name: file.name,
        reason: /\.doc$/i.test(file.name)
          ? "Old .doc files can't be read here. Open it in Word, save it as .docx or PDF, and try again."
          : "That isn't a PDF or Word file. Save your resume as one of those and try again.",
      });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setAttachment({ status: "unreadable", name: file.name, reason: "That file is over 5 MB — a resume is usually much smaller." });
      return;
    }
    setAttachment({ status: "reading", name: file.name });
    try {
      const bytes = await file.arrayBuffer();
      const text = isPdf ? await extractPdfText(new Uint8Array(bytes)) : await extractDocxText(bytes);
      if (scenario.fail === "scanned_pdf" || text.trim().length < MIN_FILE_TEXT) {
        setAttachment({
          status: "unreadable",
          name: file.name,
          reason: isPdf
            ? "No text in this PDF — it's probably a scan or a photo. Tell me about yourself instead."
            : "There's almost no text in this Word file. Tell me about yourself instead.",
        });
        return;
      }
      setAttachment({ status: "ready", name: file.name, imported: { original: text, redaction: redact(text) } });
    } catch {
      setAttachment({
        status: "unreadable",
        name: file.name,
        reason: `This ${isPdf ? "PDF" : "Word file"} couldn't be opened. It may be damaged or password-protected.`,
      });
    }
  };

  const ready = attachment?.status === "ready" ? attachment : null;
  const canStart = Boolean(ready) || (draftText.trim().length >= MIN_DESCRIBE && attachment?.status !== "reading");

  const start = () => {
    const text = draftText.trim();
    if (ready) {
      // The typed note travels with the resume text and is redacted along with it.
      const original = text ? `${ready.imported.original}\n\n${text}` : ready.imported.original;
      const imported = { original, redaction: redact(original) };
      setOpening({ text, fileName: ready.name, hidden: imported.redaction.items.length });
      importMutation.mutate(imported);
    } else {
      const imported = { original: text, redaction: redact(text) };
      const hidden = imported.redaction.items.length;
      if (looksLikeResume(text)) {
        setOpening({ text, hidden, asResume: true });
        importMutation.mutate(imported);
      } else {
        setOpening({ text, hidden });
        parseMutation.mutate(imported);
      }
    }
    push("opening");
    setDraftText("");
    setAttachment(null);
  };

  // Contact details in a note update the contact card and stay out of the AI call; a note that is
  // only contact details doesn't call the AI at all.
  const runNote = async (id: string, text: string) => {
    setNotes((n) => ({ ...n, [id]: { text, status: "pending" } }));
    const redaction = redact(text);
    const found = contactFromText("", redaction);
    const patch = {
      ...(found.contact.email ? { email: found.contact.email } : {}),
      ...(found.contact.phone ? { phone: found.contact.phone } : {}),
    };
    const contactUpdated = [...Object.keys(patch), ...(found.link ? ["link"] : [])];
    if (contactUpdated.length) {
      setContact((c) => ({ ...c, ...patch }));
      if (found.link) setLink(found.link);
      setDraft((d) =>
        d ? { ...d, contact: { ...d.contact, ...patch, ...(found.link ? { links: withLink(d.contact, found.link).links } : {}) } } : d,
      );
    }
    const rest = redaction.text.replace(TOKEN, "").trim();
    if (contactUpdated.length && rest.split(/\s+/).filter(Boolean).length < 5) {
      setNotes((n) => ({ ...n, [id]: { text, status: "added", contactUpdated } }));
      return;
    }
    try {
      const result = await addNote({
        text: redaction.text,
        entries: entriesForPrompt(draft?.entries ?? parse?.entries ?? []),
      });
      setNotes((n) => ({ ...n, [id]: { text, status: "added", result, contactUpdated } }));
      setDraft((d) => (d ? mergeIntoProfile(d, result) : d));
    } catch (error) {
      setNotes((n) => ({ ...n, [id]: { text, status: "error", error } }));
    }
  };

  const sendNote = (text: string) => {
    const id = crypto.randomUUID().slice(0, 8);
    push(`note:${id}`);
    void runNote(id, text);
  };

  const retryNote = (id: string) => {
    const note = notes[id];
    if (note) void runNote(id, note.text);
  };

  const applyStarter = (s: (typeof STARTERS)[number]) => {
    if (s.attach) {
      filePicker.current?.click();
      return;
    }
    if (DEMO_UI && s.persona) {
      setScenario({ persona: s.persona });
      queryClient.removeQueries({ queryKey: resumeKeys.all });
      setDraftText(fixtureFor(s.persona).describeText);
      return;
    }
    setDraftText(s.starter ?? "");
  };

  const pending =
    parseMutation.isPending ||
    importMutation.isPending ||
    answersMutation.isPending ||
    extraDutiesMutation.isPending ||
    composeMutation.isPending;

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread.length, pending, notes]);

  const entryLabel = (entryId: string) => {
    const entry = parse?.entries.find((e) => e.id === entryId);
    return entry ? [entry.title, entry.org].filter(Boolean).join(", ") : "this job";
  };

  const dropHandlers = {
    onDragEnter: (e: React.DragEvent) => {
      if (opening || !e.dataTransfer.types.includes("Files")) return;
      dragDepth.current += 1;
      setDragging(true);
    },
    onDragOver: (e: React.DragEvent) => {
      if (opening || !e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
    },
    onDragLeave: () => {
      if (opening) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    },
    onDrop: (e: React.DragEvent) => {
      if (opening) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void attach(file);
    },
  };

  const hiddenPicker = (
    <input
      ref={filePicker}
      type="file"
      accept={`application/pdf,.pdf,${DOCX_TYPE},.docx`}
      className="sr-only"
      tabIndex={-1}
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) void attach(file);
        e.target.value = "";
      }}
    />
  );

  if (!opening) {
    return (
      <div {...dropHandlers} className="relative flex min-h-[calc(100dvh-11rem)] flex-col items-center justify-center py-10">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[8%] h-[300px] w-[min(820px,90%)] -translate-x-1/2 rounded-full bg-[#ff5a2a]/[0.13] blur-[110px]"
        />
        <h1 className="relative max-w-3xl text-balance text-center text-[36px] font-semibold leading-[1.08] tracking-[-0.04em] text-white sm:text-[52px]">
          Your resume, from a few <Accent>sentences</Accent>
        </h1>
        <p className="relative mt-4 max-w-xl text-center text-base leading-relaxed text-white/65 sm:text-[17px]">
          Tell me about your work and studies in any language — or paste or drop your old resume. I&apos;ll ask a few quick
          questions and build a clean resume in English that any company can read.
        </p>

        <div className="relative mt-9 w-full max-w-[720px]">
          <Composer
            variant="hero"
            value={draftText}
            onChange={setDraftText}
            onSubmit={start}
            canSubmit={canStart}
            placeholder="Tell me about your work, studies and skills — in any language…"
            lang={lang}
            onLangChange={setLang}
            region={region}
            onRegionChange={setRegion}
            attachment={attachment}
            onPickFile={(f) => void attach(f)}
            onRemoveAttachment={() => setAttachment(null)}
          />
          <p className="mt-3 flex items-center justify-center gap-1.5 px-1 text-center text-[13px] font-medium text-white/55">
            <ShieldCheck className="size-4 shrink-0 text-emerald-400/80" aria-hidden />
            Your phone and email never go to the AI. Files are read in your browser, never uploaded.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center">
            {STARTERS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => applyStarter(s)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-center text-sm font-semibold leading-snug text-white/75 transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-white sm:px-4"
              >
                <s.icon className="size-4 shrink-0 text-[#ff7a5c]" aria-hidden />
                <span>{s.label}</span>
              </button>
            ))}
          </div>
          {hiddenPicker}
        </div>

        {dragging && (
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-[#ff7a5c]/70 bg-[#141414] px-12 py-10 text-center">
              <FileUp className="size-8 text-[#ff7a5c]" aria-hidden />
              <p className="text-lg font-semibold text-white">Drop your resume (PDF or Word)</p>
              <p className="text-sm font-medium text-white/60">It&apos;s read in your browser, never uploaded.</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  const intro = (() => {
    if (!parse) return null;
    const role = parse.canonicalRole ? ` You're a ${parse.canonicalRole.toLowerCase()} — ` : " ";
    const hidden = opening.hidden ?? 0;
    const hiddenNote = hidden ? ` I hid ${hidden} contact detail${hidden === 1 ? "" : "s"} before anything went to the AI.` : "";
    const read = opening.fileName
      ? `I read ${opening.fileName} in your browser and hid ${hidden} contact detail${hidden === 1 ? "" : "s"} before anything went to the AI.`
      : opening.asResume
        ? `This looks like your resume, so I read it as one.${hiddenNote}`
        : `Thanks — I understood your ${parse.detectedLanguage} message.${hiddenNote}`;
    return `${read}${role}let's get a few things right. You can also type anything I miss in the box below, any time.`;
  })();

  const mainError =
    parseMutation.error ?? importMutation.error ?? answersMutation.error ?? extraDutiesMutation.error ?? composeMutation.error;
  const retryMain = parseMutation.error && parseMutation.variables
    ? () => parseMutation.mutate(parseMutation.variables!)
    : extraDutiesMutation.error && extraDutiesMutation.variables
      ? () => extraDutiesMutation.mutate(extraDutiesMutation.variables!)
      : importMutation.error && importMutation.variables
      ? () => importMutation.mutate(importMutation.variables!)
      : answersMutation.error
        ? () => answersMutation.mutate()
        : composeMutation.error && draft
          ? () => composeMutation.mutate(draft)
          : undefined;

  const progressSteps = parseMutation.isPending
    ? PROGRESS.parse
    : importMutation.isPending
      ? PROGRESS.import
      : answersMutation.isPending || extraDutiesMutation.isPending
        ? PROGRESS.answers
        : PROGRESS.compose;

  // Only the first assistant turn after the user's message shows the logo.
  const renderKey = (key: ThreadKey, index: number) => {
    const avatar = thread[index - 1] === "opening";
    if (key === "opening") return <UserMessage key={key} text={opening.text} fileName={opening.fileName} />;
    if (key.startsWith("note:")) {
      const id = key.slice(5);
      const note = notes[id];
      if (!note) return null;
      const added = note.result?.facts.map((f) => f.text) ?? [];
      const updated = note.contactUpdated?.length
        ? `Updated your ${note.contactUpdated.join(" and ")} in your details — that never goes to the AI. `
        : "";
      return (
        <React.Fragment key={key}>
          <UserMessage text={note.text} />
          <AssistantMessage>
            {note.status === "pending" && (
              <p role="status" className="flex items-center gap-2 pt-0.5 text-[15px] text-white/70">
                <LoaderCircle className="size-4 animate-spin text-[#ff7a5c]" aria-hidden />
                Adding that…
              </p>
            )}
            {note.status === "added" && (
              <AssistantText>
                {updated +
                  (added.length
                    ? `Added: “${added.join("”, “")}”. ${draft ? "It's in the list above — check it before building." : "You'll see it in the summary before I build anything."}`
                    : updated
                      ? ""
                      : "I couldn't find anything new to add from that.")}
              </AssistantText>
            )}
            {note.status === "error" && <AiErrorNotice error={note.error} onRetry={() => retryNote(id)} />}
          </AssistantMessage>
        </React.Fragment>
      );
    }
    if (!parse) return null;
    switch (key) {
      case "intro":
        return (
          <AssistantMessage key={key} avatar={avatar}>
            <AssistantText>{intro}</AssistantText>
          </AssistantMessage>
        );
      case "contact":
        return (
          <AssistantMessage key={key} avatar={avatar}>
            <ContactCard
              contact={contact}
              onChange={setContact}
              link={link}
              onLinkChange={setLink}
              done={contactDone}
              example={DEMO_UI ? fixture.contact : undefined}
              found={contactFound}
              onEdit={() => setContactDone(false)}
              onSubmit={() => {
                setContactDone(true);
                if (draft) {
                  setDraft({ ...draft, contact: withLink(contact, link) });
                  return;
                }
                if (thread.includes("questions") || thread.includes("duties")) return;
                if (parse.questions.length) push("questions");
                else toDuties();
              }}
            />
          </AssistantMessage>
        );
      case "questions":
        return (
          <AssistantMessage key={key} avatar={avatar}>
            <QuestionsCard
              questions={parse.questions}
              answers={answers}
              onAnswer={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))}
              generic={parse.rolePack === null}
              lang={lang}
              done={questionsDone}
              onSubmit={() => {
                setQuestionsDone(true);
                toDuties();
              }}
            />
          </AssistantMessage>
        );
      case "duties":
        return (
          <AssistantMessage key={key} avatar={avatar}>
            <DutiesCard
              duties={dutiesToAsk}
              skipped={dutiesSkipped}
              onReopen={() => {
                if (pending) return;
                setShowAllDuties(true);
                setDutiesDone(false);
              }}
              entryLabel={entryLabel}
              ticked={ticked}
              onToggle={(t) =>
                setTicked((s) => {
                  const next = new Set(s);
                  if (next.has(t)) next.delete(t);
                  else next.add(t);
                  return next;
                })
              }
              done={dutiesDone}
              onSubmit={() => {
                setDutiesDone(true);
                if (!draft) return runAnswers();
                const extra = parse.suggestedDuties.filter((d) => ticked.has(d.text));
                if (extra.length) extraDutiesMutation.mutate(extra);
              }}
            />
          </AssistantMessage>
        );
      case "confirm":
        return draft ? (
          <AssistantMessage key={key} avatar={avatar}>
            <ConfirmCard profile={draft} onChange={setDraft} done={Boolean(composed)} onBuild={() => composeMutation.mutate(draft)} />
          </AssistantMessage>
        ) : null;
      case "done":
        return composed ? (
          <AssistantMessage key={key} avatar={avatar}>
            {composed.fallbacks > 0 && (
              <AssistantText>
                I kept {composed.fallbacks} line{composed.fallbacks === 1 ? "" : "s"} in your own words — my rewrite added
                something you didn&apos;t say, so I used your wording instead.
              </AssistantText>
            )}
            <DoneCard
              resumeId={composed.resumeId}
              profile={composed.profile}
              photoNote={parse.rolePack?.photoCommon ? (parse.rolePack.photoNote ?? "Employers here often ask for a photo.") : null}
            />
          </AssistantMessage>
        ) : null;
      default:
        return null;
    }
  };

  const steps = parse
    ? [
        { label: "Your details", done: contactDone },
        ...(parse.questions.length ? [{ label: "Questions", done: questionsDone }] : []),
        ...(parse.suggestedDuties.length ? [{ label: "Duties", done: dutiesDone }] : []),
        { label: "Check", done: Boolean(composed) },
        { label: "Resume", done: Boolean(composed) },
      ]
    : null;

  return (
    <div className="flex w-full flex-col">
      {steps && <Steps steps={steps} />}
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-6 pt-4">
        {thread.map((key, i) => (
          <motion.div
            key={key}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-6"
          >
            {renderKey(key, i)}
          </motion.div>
        ))}
        {pending && (
          <AssistantMessage avatar={thread[thread.length - 1] === "opening"}>
            <AiProgress steps={progressSteps} className="p-5" />
          </AssistantMessage>
        )}
        {!pending && mainError && (
          <AssistantMessage avatar={thread[thread.length - 1] === "opening"}>
            <AiErrorNotice error={mainError} onRetry={retryMain} />
          </AssistantMessage>
        )}
        <div ref={endRef} />
      </div>

      {!composed && (
        <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-background via-background to-transparent px-4 pb-4 pt-6 md:-mx-8 md:px-8">
          <div className="mx-auto max-w-3xl">
            <Composer
              variant="docked"
              value={draftText}
              onChange={setDraftText}
              onSubmit={() => {
                const text = draftText.trim();
                setDraftText("");
                void sendNote(text);
              }}
              canSubmit={Boolean(parse) && draftText.trim().length >= 2 && !composeMutation.isPending}
              busy={composeMutation.isPending}
              placeholder={
                parse ? "Add anything I missed, in any language…" : "Reading what you sent…"
              }
              lang={lang}
              onLangChange={setLang}
            />
          </div>
        </div>
      )}
    </div>
  );
}
