import {
  CreateInterviewRequest,
  FinishInterviewRequest,
  type InterviewListItem,
  type InterviewQuestion,
  type InterviewRecord,
  type InterviewSourceOption,
  type InterviewTurn,
} from "@dossier/core/interview";
import { ApiError } from "@/lib/api";
import { READ_DELAY_MS, sleep, type Persona } from "@/lib/demo/scenario";
import { findSource, sampleAnswer, sourcesFor } from "./data";
import { gradeInterview } from "./grader";
import { interviewScenario } from "./scenario";
import { interviewerLines } from "../script";
import { addTopicFromInterview } from "@/lib/roadmap/demo/mockApi";

interface Entry {
  record: InterviewRecord;
  readyAt: number;
}

let store: { key: string; entries: Map<string, Entry> } | null = null;
let counter = 0;
const clone = <T,>(value: T): T => structuredClone(value);
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

// Timed turns for a finished demo interview: about 150 words a minute, with short pauses.
function scriptedTurns(questions: InterviewQuestion[], answers: string[], subject: string): InterviewTurn[] {
  const lines = interviewerLines(subject, questions);
  const turns: InterviewTurn[] = [];
  let t = 0;
  const push = (role: InterviewTurn["role"], questionId: string | null, text: string, wps: number) => {
    const startMs = t;
    t += Math.round((words(text) / wps) * 1000);
    turns.push({ role, questionId, text, startMs, endMs: t });
    t += 1500;
  };
  push("interviewer", null, lines.intro, 2.6);
  questions.forEach((q, i) => {
    push("interviewer", q.id, lines.ask(i), 2.6);
    if (answers[i]) push("candidate", q.id, answers[i], i === 1 ? 3.1 : 2.4);
  });
  if (answers.length) push("interviewer", null, lines.outro, 2.6);
  return turns;
}

function seeds(persona: Persona): Entry[] {
  const sources = sourcesFor(persona, false);
  const roadmap = sources[0];
  const kit = sources.find((s) => s.option.type === "kit")!;
  const resume = sources.find((s) => s.option.type === "resume") ?? kit;
  const at = (days: number) => new Date(Date.now() - days * 864e5).toISOString();

  const voiceQs = roadmap.questions.slice(0, 3);
  const voiceTurns = scriptedTurns(voiceQs, voiceQs.map((q, i) => sampleAnswer(persona, q.prompt, i)), roadmap.option.label);
  const textQs = kit.questions.slice(0, 3);
  const textTurns = scriptedTurns(textQs, textQs.map((q, i) => sampleAnswer(persona, q.prompt, i)), kit.option.label);
  const resumeQs = resume.questions.slice(0, 3);

  const make = (
    id: string,
    source: typeof roadmap,
    mode: InterviewRecord["mode"],
    questions: InterviewQuestion[],
    turns: InterviewTurn[],
    status: InterviewRecord["status"],
    days: number,
  ): Entry => ({
    readyAt: 0,
    record: {
      id,
      source: { type: source.option.type, id: source.option.id, label: source.option.label },
      mode,
      status,
      questions,
      turns,
      report: status === "graded" ? gradeInterview(questions, turns, mode === "voice") : null,
      maxMinutes: 15,
      createdAt: at(days),
      durationSec: Math.round((turns.at(-1)?.endMs ?? 0) / 1000),
    },
  });

  return [
    make("iv-voice", roadmap, "voice", voiceQs, voiceTurns, "graded", 1),
    make("iv-text", kit, "text", textQs, textTurns, "graded", 4),
    make("iv-left", resume, "voice", resumeQs, scriptedTurns(resumeQs, [], resume.option.label).slice(0, 2), "abandoned", 6),
  ];
}

function getStore() {
  const { persona, empty } = interviewScenario.getScenario();
  const key = `${persona}:${empty}`;
  if (store?.key === key) return store;
  store = { key, entries: new Map(empty ? [] : seeds(persona).map((e) => [e.record.id, e])) };
  return store;
}

function failIfDown() {
  if (interviewScenario.getScenario().fail === "load_error") throw new ApiError(503, "unavailable", "Interviews couldn't be loaded.");
}

function requireEntry(id: string): Entry {
  const entry = getStore().entries.get(id);
  if (!entry) throw new ApiError(404, "not_found", "interview not found");
  return entry;
}

function settle(entry: Entry): InterviewRecord {
  const { record } = entry;
  if (record.status === "grading" && Date.now() >= entry.readyAt) {
    if (interviewScenario.getScenario().fail === "grading_fails") {
      record.status = "failed";
    } else {
      record.status = "graded";
      record.report = gradeInterview(record.questions, record.turns, record.mode === "voice");
    }
  }
  return clone(record);
}

export const mockApi = {
  async listInterviews(): Promise<InterviewListItem[]> {
    await sleep(interviewScenario.getScenario().latency === "slow" ? 4000 : READ_DELAY_MS);
    failIfDown();
    return [...getStore().entries.values()]
      .map(settle)
      .map((r) => ({
        id: r.id,
        source: r.source,
        mode: r.mode,
        status: r.status,
        overall: r.report?.overall ?? null,
        questionCount: r.questions.length,
        createdAt: r.createdAt,
        durationSec: r.durationSec,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async listSources(): Promise<InterviewSourceOption[]> {
    await sleep(READ_DELAY_MS);
    failIfDown();
    const { persona, empty } = interviewScenario.getScenario();
    return sourcesFor(persona, empty).map((s) => s.option);
  },

  async getInterview(id: string): Promise<InterviewRecord> {
    await sleep(READ_DELAY_MS);
    failIfDown();
    return settle(requireEntry(id));
  },

  async createInterview(req: CreateInterviewRequest): Promise<InterviewRecord> {
    const parsed = CreateInterviewRequest.safeParse(req);
    if (!parsed.success) throw new ApiError(400, "validation_error", "Pick what to practise first");
    await sleep(900);
    if (interviewScenario.getScenario().fail === "quota") throw new ApiError(429, "quota_exceeded", "You've used today's mock interviews.");
    const source = findSource(interviewScenario.getScenario().persona, parsed.data.source.type, parsed.data.source.id);
    if (!source) throw new ApiError(404, "not_found", "That roadmap, kit or resume wasn't found.");
    counter += 1;
    const record: InterviewRecord = {
      id: `iv-new-${counter}`,
      source: { type: source.option.type, id: source.option.id, label: source.option.label },
      mode: parsed.data.mode,
      status: "live",
      questions: source.questions.slice(0, parsed.data.questionCount),
      turns: [],
      report: null,
      maxMinutes: parsed.data.questionCount === 3 ? 15 : 25,
      createdAt: new Date().toISOString(),
      durationSec: 0,
    };
    getStore().entries.set(record.id, { record, readyAt: 0 });
    return clone(record);
  },

  async finishInterview(id: string, req: FinishInterviewRequest): Promise<InterviewRecord> {
    const parsed = FinishInterviewRequest.parse(req);
    await sleep(READ_DELAY_MS);
    const entry = requireEntry(id);
    const answered = parsed.turns.some((t) => t.role === "candidate" && t.text.trim());
    entry.record = {
      ...entry.record,
      turns: parsed.turns,
      durationSec: parsed.durationSec,
      mode: parsed.switchedToText ? "text" : entry.record.mode,
      status: answered ? "grading" : "abandoned",
    };
    entry.readyAt = Date.now() + (interviewScenario.getScenario().latency === "slow" ? 15_000 : 5_000);
    return clone(entry.record);
  },

  async retryGrading(id: string): Promise<InterviewRecord> {
    await sleep(READ_DELAY_MS);
    const entry = requireEntry(id);
    entry.record = { ...entry.record, status: "grading" };
    entry.readyAt = Date.now() + 5_000;
    return clone(entry.record);
  },

  async addWeaknessToRoadmap(id: string, weaknessId: string, roadmapId: string): Promise<InterviewRecord> {
    await sleep(600);
    const entry = requireEntry(id);
    const report = entry.record.report;
    const weakness = report?.weaknesses.find((w) => w.id === weaknessId);
    if (!report || !weakness) throw new ApiError(404, "not_found", "weak spot not found");
    const weakest = [...report.questions]
      .filter((q) => q.answered)
      .sort((a, b) => a.scores.reduce((n, s) => n + s.score, 0) - b.scores.reduce((n, s) => n + s.score, 0))[0];
    const topicId = addTopicFromInterview(roadmapId, {
      interviewId: id,
      label: entry.record.source.label,
      title: weakness.title,
      why: weakness.why,
      practice: weakest ? `Answer this again, out loud, fixing what the report pointed out: ${weakest.prompt}` : "Answer one question from your mock interview again, out loud.",
      resource: weakness.resource,
    });
    weakness.roadmapTopic = { roadmapId, topicId };
    return clone(entry.record);
  },

  async deleteInterview(id: string): Promise<void> {
    await sleep(READ_DELAY_MS);
    getStore().entries.delete(id);
  },
};
