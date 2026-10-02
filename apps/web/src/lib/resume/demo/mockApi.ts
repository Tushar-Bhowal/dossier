import {
  applyBulletChange,
  type AnswersRequest,
  type AnswersResult,
  type CareerProfile,
  type ComposeRequest,
  type ImproveLineRequest,
  type ImproveLineResult,
  type ComposeResult,
  type Fact,
  type FollowUpQuestion,
  type ImportRequest,
  type MarketAnswersRequest,
  type MarketAnswersResult,
  type MarketTerms,
  type NoteRequest,
  type ParseRequest,
  type ParseResult,
  type Proposal,
  type Region,
  type Resume,
  type ResumeListItem,
  type ResumeSnapshot,
  type Skill,
  type StartTailoringRequest,
  type TailoringDecision,
  type TailoringState,
} from "@dossier/core/resume";
import { ApiError } from "@/lib/api";
import { mergeIntoProfile } from "../profile";
import { composeFromProfile } from "./compose";
import { READ_DELAY_MS, aiDelayMs, getScenario, sleep } from "./scenario";
import { answerFacts, dutyFacts, fixtureFor, getStore, slug } from "./store";

const GENERIC_QUESTIONS: Omit<FollowUpQuestion, "entryId">[] = [
  { id: "g-main", text: "What was your main responsibility in this job?", examples: [] },
  { id: "g-count", text: "About how many people, customers or students did you work with?", examples: ["Under 20", "20–100", "100+"] },
  { id: "g-proud", text: "Anything from this job you're proud of?", examples: [] },
];

const HISTORY_LIMIT = 20;
const SNAPSHOT_EVERY_MS = 5 * 60 * 1000;
const NEGATIVE = /^(not yet|no|nope|never|not really)\b/i;

function now() {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

async function read<T>(fn: () => T): Promise<T> {
  await sleep(READ_DELAY_MS);
  return clone(fn());
}

// Every AI-backed call goes through here, so the scenario switches apply to all of them alike.
async function ai<T>(fn: () => T): Promise<T> {
  await sleep(aiDelayMs());
  const { fail } = getScenario();
  if (fail === "ai_down") throw new ApiError(503, "llm_unavailable", "Our AI service isn't responding right now.");
  if (fail === "quota") throw new ApiError(429, "quota_exceeded", "You've used today's free AI requests.");
  return clone(fn());
}

function requireResume(id: string): Resume {
  const resume = getStore().resumes.get(id);
  if (!resume) throw new ApiError(404, "not_found", "resume not found");
  return resume;
}

function storeResume(next: Resume, note: string) {
  const store = getStore();
  const previous = store.resumes.get(next.id);
  if (previous) {
    const history = store.history.get(next.id) ?? [];
    const last = history[0];
    if (!last || Date.now() - Date.parse(last.at) > SNAPSHOT_EVERY_MS || note !== "Edited") {
      store.history.set(next.id, [{ at: previous.updatedAt, note, sections: previous.sections }, ...history].slice(0, HISTORY_LIMIT));
    }
  }
  store.resumes.set(next.id, next);
}

const WEAK_OPENINGS: [RegExp, string][] = [
  [/^(i was |was )?responsible for (the )?/i, "Handled "],
  [/^(i )?worked on /i, "Built "],
  [/^(i )?was involved in /i, "Contributed to "],
  [/^(i )?helped (to |with )?/i, "Helped "],
  [/^(i )?did /i, "Completed "],
  [/^(i )?(have |had )?done /i, "Completed "],
  [/^i /i, ""],
];

function improveOpening(text: string): string {
  let out = text.trim().replace(/\.$/, "");
  for (const [pattern, replacement] of WEAK_OPENINGS) {
    if (pattern.test(out)) {
      out = out.replace(pattern, replacement);
      break;
    }
  }
  return out.charAt(0).toUpperCase() + out.slice(1);
}

function updateProfile(fn: (p: CareerProfile) => CareerProfile) {
  const store = getStore();
  if (!store.profile) return;
  const next = fn(store.profile);
  store.profile = { ...next, version: store.profile.version + 1, updatedAt: now() };
}

function mustCounts(state: Pick<TailoringState, "requirements" | "verdicts">) {
  const musts = state.requirements.filter((r) => r.priority === "must");
  const covered = musts.filter((r) => state.verdicts.find((v) => v.requirementId === r.id)?.verdict === "covered");
  return { mustCovered: covered.length, mustTotal: musts.length };
}

export const mockApi = {
  getProfile: () => read(() => getStore().profile),

  saveProfile: (profile: CareerProfile) =>
    read(() => {
      const store = getStore();
      if (store.profile && store.profile.version !== profile.version) {
        throw new ApiError(409, "version_conflict", "profile changed since it was read");
      }
      store.profile = { ...profile, version: (store.profile?.version ?? 0) + 1, updatedAt: now() };
      return store.profile;
    }),

  parseDescription: (req: ParseRequest) =>
    ai((): ParseResult => {
      if (req.text.trim().length < 10) throw new ApiError(400, "validation_error", "Tell us a little more about yourself.");
      const fx = fixtureFor(getScenario().persona);
      const location = fx.contact.location ? { location: fx.contact.location } : {};
      if (getScenario().fail !== "no_role_pack") return { ...fx.parse, ...location };
      const firstJob = fx.parse.entries.find((e) => e.kind === "job");
      return {
        ...fx.parse,
        ...location,
        rolePack: null,
        questions: GENERIC_QUESTIONS.map((q) => ({ ...q, entryId: firstJob?.id ?? null })),
        suggestedDuties: [],
      };
    }),

  importResume: (req: ImportRequest) =>
    ai((): ParseResult => {
      if (req.redactedText.trim().length < 50) throw new ApiError(400, "validation_error", "There isn't enough text to read.");
      const fx = fixtureFor(getScenario().persona);
      // A whole resume already answers most questions; the real prompt asks only about gaps.
      return {
        ...fx.parse,
        ...(fx.contact.location ? { location: fx.contact.location } : {}),
        detectedLanguage: "English",
        facts: fx.parse.facts.map((f) => ({ ...f, source: "upload" as const })),
        questions: fx.parse.questions.slice(0, 2),
      };
    }),

  submitAnswers: (req: AnswersRequest) =>
    ai((): AnswersResult => {
      const fx = fixtureFor(getScenario().persona);
      const { facts, entries } = answerFacts(fx, req.answers);
      return { facts: [...facts, ...dutyFacts(req.tickedDuties)], entries, skills: [] };
    }),

  // The mock can't translate or interpret, so a note becomes one fact in the user's own words.
  addNote: (req: NoteRequest) =>
    ai((): AnswersResult => {
      const text = req.text.trim();
      if (text.length < 2) throw new ApiError(400, "validation_error", "Write a little more.");
      return {
        facts: [{ id: `fn-${crypto.randomUUID().slice(0, 8)}`, entryId: null, text, originalText: text, source: "describe" }],
        entries: [],
        skills: [],
      };
    }),

  composeResume: (req: ComposeRequest) =>
    ai((): ComposeResult => {
      const store = getStore();
      if (!store.profile) throw new ApiError(404, "not_found", "profile not found");
      const fx = fixtureFor(store.persona);
      const result = composeFromProfile(store.profile, fx, {
        id: `res-${crypto.randomUUID().slice(0, 8)}`,
        title: req.title?.trim() || fx.resumeTitle,
        fallback: getScenario().fail === "fallback_bullets",
      });
      store.resumes.set(result.resume.id, result.resume);
      store.history.set(result.resume.id, []);
      return result;
    }),

  listResumes: () =>
    read((): ResumeListItem[] =>
      [...getStore().resumes.values()]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((r) => ({
          id: r.id,
          title: r.title,
          updatedAt: r.updatedAt,
          ...(r.baseResumeId ? { baseResumeId: r.baseResumeId } : {}),
          ...(r.target?.role ? { targetRole: r.target.role } : {}),
          ...(r.target?.company ? { targetCompany: r.target.company } : {}),
        })),
    ),

  getResume: (id: string) => read(() => requireResume(id)),

  saveResume: (resume: Resume) =>
    read(() => {
      const store = getStore();
      const current = requireResume(resume.id);

      // Simulates another tab saving first: the stored copy moves on once, so this save is stale.
      if (getScenario().fail === "conflict" && !store.conflicted.has(resume.id)) {
        store.conflicted.add(resume.id);
        storeResume({ ...current, version: current.version + 1, updatedAt: now() }, "Edited in another tab");
        throw new ApiError(409, "version_conflict", "This resume was changed somewhere else.");
      }
      if (current.version !== resume.version) {
        throw new ApiError(409, "version_conflict", "This resume was changed somewhere else.");
      }
      const next = { ...resume, version: current.version + 1, updatedAt: now() };
      storeResume(next, "Edited");
      return next;
    }),

  copyResume: (id: string) =>
    read((): Resume => {
      const store = getStore();
      const base = requireResume(id);
      const copy: Resume = {
        ...base,
        id: `res-${crypto.randomUUID().slice(0, 8)}`,
        title: `${base.title} (copy)`.slice(0, 80),
        version: 1,
        updatedAt: now(),
      };
      store.resumes.set(copy.id, copy);
      store.history.set(copy.id, [{ at: now(), note: `Copied from "${base.title}"`, sections: base.sections }]);
      return copy;
    }),

  // The mock can't rewrite, so it only fixes weak openings — the real call rewrites within the facts.
  improveLine: (req: ImproveLineRequest) =>
    ai((): ImproveLineResult => {
      const text = improveOpening(req.text);
      return { text, unchanged: text === req.text.trim() };
    }),

  deleteResume: (id: string) =>
    read(() => {
      requireResume(id);
      getStore().resumes.delete(id);
      getStore().history.delete(id);
    }),

  getResumeHistory: (id: string) =>
    read((): ResumeSnapshot[] => {
      requireResume(id);
      return getStore().history.get(id) ?? [];
    }),

  startTailoring: (req: StartTailoringRequest) =>
    ai((): TailoringState => {
      const store = getStore();
      const base = requireResume(req.resumeId);
      const fx = fixtureFor(store.persona).tailoring;
      const sessionId = `tl-${crypto.randomUUID().slice(0, 8)}`;
      const tailoredId = `res-${crypto.randomUUID().slice(0, 8)}`;
      const role = req.target.role || fx.target.role;
      const company = req.target.company || fx.target.company;

      const tailored: Resume = {
        ...base,
        id: tailoredId,
        title: [role, company].filter(Boolean).join(" at ") || `${base.title} (tailored)`,
        baseResumeId: base.id,
        target: { ...req.target, ...(role ? { role } : {}), ...(company ? { company } : {}) },
        version: 1,
        updatedAt: now(),
      };
      store.resumes.set(tailoredId, tailored);
      store.history.set(tailoredId, [{ at: now(), note: `Copied from "${base.title}"`, sections: base.sections }]);

      if (getScenario().fail === "tailoring") {
        const failed: TailoringState = {
          sessionId,
          baseResumeId: base.id,
          tailoredResumeId: tailoredId,
          round: 1,
          status: "failed",
          requirements: [],
          terms: [],
          verdicts: [],
          proposals: [],
          questions: [],
          mustCovered: 0,
          mustTotal: 0,
        };
        store.sessions.set(sessionId, failed);
        return failed;
      }

      // Only propose changes whose target still exists in this copy.
      const proposals: Proposal[] = fx.proposals
        .filter((p) => applyBulletChange(tailored, p.change) !== null)
        .map((p) => ({ ...p, status: "pending" }));

      const state: TailoringState = {
        sessionId,
        baseResumeId: base.id,
        tailoredResumeId: tailoredId,
        round: 1,
        status: "awaiting_review",
        requirements: fx.requirements,
        terms: fx.terms,
        verdicts: fx.verdicts,
        proposals,
        questions: fx.questions,
        ...mustCounts({ requirements: fx.requirements, verdicts: fx.verdicts }),
      };
      store.sessions.set(sessionId, state);
      return state;
    }),

  continueTailoring: (sessionId: string, decision: TailoringDecision) =>
    ai((): TailoringState => {
      const store = getStore();
      const state = store.sessions.get(sessionId);
      if (!state) throw new ApiError(404, "not_found", "tailoring session not found");
      const fx = fixtureFor(store.persona).tailoring;

      let resume = requireResume(state.tailoredResumeId);
      const proposals = state.proposals.map((p): Proposal => {
        if (p.status !== "pending") return p;
        if (decision.accepted.includes(p.id)) {
          const next = applyBulletChange(resume, p.change);
          if (next) resume = next;
          return { ...p, status: "accepted" };
        }
        if (decision.rejected.includes(p.id) || decision.finish) return { ...p, status: "rejected" };
        return p;
      });
      if (decision.accepted.length) {
        storeResume({ ...resume, version: resume.version + 1, updatedAt: now() }, "Accepted tailoring changes");
      }

      const verdicts = [...state.verdicts];
      const newFacts: Fact[] = [];
      const answeredIds = new Set(decision.answers.map((a) => a.questionId));

      for (const answer of decision.answers) {
        const question = state.questions.find((q) => q.id === answer.questionId);
        if (!question || NEGATIVE.test(answer.text.trim())) continue;
        const fact: Fact = {
          id: `fa-gap-${question.id}`,
          entryId: fx.gapEntryId,
          text: answer.text.trim(),
          originalText: answer.text,
          source: "answer",
        };
        newFacts.push(fact);
        const tailored = store.resumes.get(state.tailoredResumeId)!;
        const change = { op: "add" as const, entryId: fx.gapEntryId, afterBulletId: null, text: fact.text.charAt(0).toUpperCase() + fact.text.slice(1), factIds: [fact.id] };
        if (applyBulletChange(tailored, change)) {
          proposals.push({ id: `ap-${question.id}`, requirementIds: [question.requirementId], change, before: null, status: "pending" });
        }
        const i = verdicts.findIndex((v) => v.requirementId === question.requirementId);
        const covered = { requirementId: question.requirementId, verdict: "covered" as const, evidence: [{ quote: fact.text, factId: fact.id }] };
        if (i === -1) verdicts.push(covered);
        else verdicts[i] = covered;
      }
      if (newFacts.length) updateProfile((p) => mergeIntoProfile(p, { facts: newFacts }));

      const next: TailoringState = {
        ...state,
        round: state.round + 1,
        status: decision.finish ? "done" : "awaiting_review",
        proposals,
        verdicts,
        questions: decision.finish ? [] : state.questions.filter((q) => !answeredIds.has(q.id)),
        ...mustCounts({ requirements: state.requirements, verdicts }),
      };
      store.sessions.set(sessionId, next);
      return next;
    }),

  getTailoring: (sessionId: string) =>
    read(() => {
      const state = getStore().sessions.get(sessionId);
      if (!state) throw new ApiError(404, "not_found", "tailoring session not found");
      return state;
    }),

  getMarketTerms: (role: string, region: Region) =>
    read((): MarketTerms => {
      const fx = fixtureFor(getStore().persona);
      if (getScenario().fail === "market_thin") return { status: "not_enough_data", role, region, postingCount: 4 };
      return fx.market;
    }),

  answerMarketTerms: (req: MarketAnswersRequest) =>
    ai((): MarketAnswersResult => {
      const store = getStore();
      const resume = requireResume(req.resumeId);
      const firstJob = store.profile?.entries.find((e) => e.kind === "job");
      const facts: Fact[] = [];
      const skills: Skill[] = [];
      const proposals: Proposal[] = [];
      const skillsToLearn: string[] = [];

      for (const choice of req.choices) {
        const id = `fm-${slug(choice.term)}`;
        if (choice.choice === "used") {
          const fact: Fact = { id, entryId: firstJob?.id ?? null, text: choice.where.trim(), source: "answer" };
          facts.push(fact);
          skills.push({ name: choice.term, source: "fact" });
          const mentions = choice.where.toLowerCase().includes(choice.term.toLowerCase());
          const text = mentions ? choice.where.trim() : `${choice.where.trim()} (${choice.term})`;
          const change = {
            op: "add" as const,
            entryId: firstJob?.id ?? "",
            afterBulletId: null,
            text: text.charAt(0).toUpperCase() + text.slice(1),
            factIds: [id],
          };
          if (firstJob && applyBulletChange(resume, change)) {
            proposals.push({ id: `mp-${slug(choice.term)}`, requirementIds: [`market:${choice.term}`], change, before: null, status: "pending" });
          }
        } else if (choice.choice === "practised") {
          facts.push({ id, entryId: null, text: `Practised ${choice.term}: ${choice.where.trim()}`, source: "answer" });
          skills.push({ name: choice.term, source: "fact" });
        } else if (choice.choice === "learn") {
          skillsToLearn.push(choice.term);
        } else {
          skills.push({ name: choice.term, source: "self-declared" });
        }
      }

      updateProfile((p) => ({
        ...mergeIntoProfile(p, { facts, skills }),
        skillsToLearn: [...new Set([...p.skillsToLearn, ...skillsToLearn])],
      }));
      return { facts, skills, proposals, skillsToLearn };
    }),
};
