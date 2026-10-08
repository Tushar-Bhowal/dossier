import {
  CreateRoadmapRequest,
  mergeRegeneration,
  nextBox,
  nextReviewInDays,
  type Confidence,
  type LeitnerBox,
  type RegenerateResult,
  type Roadmap,
  type RoadmapListItem,
  type RoadmapRecord,
  type SaveRoadmapRequest,
} from "@dossier/core/roadmap";
import { ApiError, type PracticeCard, type PracticeSession } from "@/lib/api";
import { READ_DELAY_MS, sleep } from "@/lib/demo/scenario";
import { genericRoadmap, seedFor } from "./data";
import { roadmapScenario } from "./scenario";

interface CardState {
  box: LeitnerBox;
  dueAt: string;
  lastConfidence: Confidence | null;
  reviewedAt: string | null;
}

interface Entry {
  record: RoadmapRecord;
  // What a regeneration produces; edits on top of it survive.
  template: Roadmap | null;
  readyAt: number;
  practice: Map<string, CardState>;
}

interface Store {
  key: string;
  entries: Map<string, Entry>;
}

let store: Store | null = null;
let counter = 0;

const today = () => new Date().toISOString().slice(0, 10);
const clone = <T,>(value: T): T => structuredClone(value);

function getStore(): Store {
  const { persona, empty } = roadmapScenario.getScenario();
  const key = `${persona}:${empty}`;
  if (store?.key === key) return store;
  const entries = new Map<string, Entry>();
  if (!empty) {
    for (const seed of seedFor(persona)) {
      const at = new Date(Date.now() - seed.ageDays * 864e5).toISOString();
      entries.set(seed.id, {
        record: {
          id: seed.id,
          status: "ready",
          request: seed.request,
          roadmap: clone(seed.roadmap),
          doneTopicIds: seed.doneTopicIds,
          version: 1,
          createdAt: at,
          updatedAt: at,
        },
        template: seed.roadmap,
        readyAt: 0,
        practice: new Map(),
      });
    }
  }
  store = { key, entries };
  return store;
}

function failIfDown() {
  if (roadmapScenario.getScenario().fail === "load_error") {
    throw new ApiError(503, "unavailable", "Roadmaps couldn't be loaded.");
  }
}

function aiFailures() {
  const { fail } = roadmapScenario.getScenario();
  if (fail === "ai_down") throw new ApiError(503, "llm_unavailable", "Our AI service isn't responding right now.");
  if (fail === "quota") throw new ApiError(429, "quota_exceeded", "You've used today's free AI requests.");
}

function requireEntry(id: string): Entry {
  const entry = getStore().entries.get(id);
  if (!entry) throw new ApiError(404, "not_found", "roadmap not found");
  return entry;
}

// A generating roadmap finishes once its time is up, the next time anyone looks at it.
function settle(entry: Entry): RoadmapRecord {
  const { record } = entry;
  if (record.status === "generating" && Date.now() >= entry.readyAt) {
    const { fail } = roadmapScenario.getScenario();
    if (fail === "generation_fails") {
      record.status = "failed";
    } else {
      const roadmap = genericRoadmap(record.request, fail === "low_confidence" ? "low" : record.request.company ? "medium" : "high");
      record.status = "ready";
      record.roadmap = roadmap;
      entry.template = roadmap;
    }
    record.updatedAt = new Date().toISOString();
  }
  const out = clone(record);
  if (out.roadmap && roadmapScenario.getScenario().fail === "low_confidence") out.roadmap.confidence = "low";
  return out;
}

function listItem(record: RoadmapRecord): RoadmapListItem {
  const topics = record.roadmap?.topics ?? [];
  return {
    id: record.id,
    status: record.status,
    kind: record.request.kind,
    subject: record.request.subject,
    company: record.request.company,
    interviewDate: record.request.interviewDate,
    confidence: record.roadmap?.confidence ?? null,
    topicsDone: topics.filter((t) => record.doneTopicIds.includes(t.id)).length,
    topicsTotal: topics.length,
    updatedAt: record.updatedAt,
  };
}

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`)) / 864e5);
}

function session(entry: Entry): PracticeSession & { hasDeadline: boolean } {
  const days = daysUntil(entry.record.request.interviewDate);
  const cards: PracticeCard[] = (entry.record.roadmap?.topics ?? []).flatMap((topic) =>
    topic.flashcards.map((card) => {
      const state = entry.practice.get(card.id) ?? { box: 1 as LeitnerBox, dueAt: today(), lastConfidence: null, reviewedAt: null };
      return {
        id: card.id,
        front: card.front,
        back: card.back,
        requirement_ids: [],
        box: state.box,
        dueAt: state.dueAt,
        due: state.dueAt <= today(),
        covered: state.reviewedAt !== null,
        lastConfidence: state.lastConfidence,
        reviewedAt: state.reviewedAt,
      };
    }),
  );
  return { daysRemaining: days ?? 0, hasDeadline: days !== null, cards };
}

function nextIds(roadmap: Roadmap, prefix: "q" | "f"): () => string {
  const used = roadmap.topics.flatMap((t) => (prefix === "q" ? t.questions : t.flashcards).map((i) => Number(i.id.slice(1))));
  let n = Math.max(0, ...used);
  return () => `${prefix}${(n += 1)}`;
}

export const mockApi = {
  async listRoadmaps(): Promise<RoadmapListItem[]> {
    await sleep(roadmapScenario.getScenario().latency === "slow" ? 4000 : READ_DELAY_MS);
    failIfDown();
    return [...getStore().entries.values()]
      .map((entry) => listItem(settle(entry)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async getRoadmap(id: string): Promise<RoadmapRecord> {
    await sleep(READ_DELAY_MS);
    failIfDown();
    return settle(requireEntry(id));
  },

  async createRoadmap(req: CreateRoadmapRequest): Promise<RoadmapRecord> {
    const parsed = CreateRoadmapRequest.safeParse(req);
    if (!parsed.success) throw new ApiError(400, "validation_error", parsed.error.issues[0]?.message ?? "Check the form");
    await sleep(700);
    aiFailures();
    const now = new Date().toISOString();
    counter += 1;
    const id = `rm-new-${counter}`;
    const entry: Entry = {
      record: { id, status: "generating", request: parsed.data, roadmap: null, doneTopicIds: [], version: 0, createdAt: now, updatedAt: now },
      template: null,
      readyAt: Date.now() + (roadmapScenario.getScenario().latency === "slow" ? 20_000 : 7_000),
      practice: new Map(),
    };
    getStore().entries.set(id, entry);
    return clone(entry.record);
  },

  async saveRoadmap(id: string, req: SaveRoadmapRequest): Promise<RoadmapRecord> {
    await sleep(READ_DELAY_MS);
    const entry = requireEntry(id);
    if (req.version !== entry.record.version) throw new ApiError(409, "version_conflict", "Edited somewhere else.");
    entry.record = {
      ...entry.record,
      roadmap: clone(req.roadmap),
      doneTopicIds: req.doneTopicIds,
      version: entry.record.version + 1,
      updatedAt: new Date().toISOString(),
    };
    return clone(entry.record);
  },

  // Generated questions and cards are replaced; anything edited, added or pinned stays.
  async regenerateRoadmap(id: string): Promise<RegenerateResult> {
    await sleep(roadmapScenario.aiDelayMs() + 1500);
    aiFailures();
    const entry = requireEntry(id);
    const current = entry.record.roadmap;
    const fresh = entry.template ?? (current && genericRoadmap(entry.record.request, current.confidence));
    if (!current || !fresh) throw new ApiError(409, "not_ready", "This roadmap isn't ready yet.");
    const nextQ = nextIds(current, "q");
    const nextF = nextIds(current, "f");
    let kept = 0;
    const topics = current.topics.map((topic) => {
      const source = fresh.topics.find((t) => t.id === topic.id);
      const keep = (o: { origin: string; pinned: boolean }) => o.origin === "edited" || o.origin === "manual" || o.pinned;
      kept += topic.questions.filter(keep).length + topic.flashcards.filter(keep).length + (topic.origin === "edited" ? 1 : 0);
      if (!source) return topic;
      return {
        ...topic,
        explanation: topic.origin === "edited" ? topic.explanation : source.explanation,
        questions: mergeRegeneration(topic.questions, source.questions.map((q) => ({ ...q, id: nextQ() }))),
        flashcards: mergeRegeneration(topic.flashcards, source.flashcards.map((f) => ({ ...f, id: nextF() }))),
      };
    });
    entry.record = {
      ...entry.record,
      roadmap: { ...current, topics },
      version: entry.record.version + 1,
      updatedAt: new Date().toISOString(),
    };
    return { record: clone(entry.record), kept };
  },

  async retryRoadmap(id: string): Promise<RoadmapRecord> {
    await sleep(700);
    aiFailures();
    const entry = requireEntry(id);
    entry.record = { ...entry.record, status: "generating", updatedAt: new Date().toISOString() };
    entry.readyAt = Date.now() + 7_000;
    return clone(entry.record);
  },

  async deleteRoadmap(id: string): Promise<void> {
    await sleep(READ_DELAY_MS);
    getStore().entries.delete(id);
  },

  async getPractice(id: string): Promise<PracticeSession & { hasDeadline: boolean }> {
    await sleep(READ_DELAY_MS);
    return session(requireEntry(id));
  },

  async reviewCard(id: string, cardId: string, confidence: Confidence): Promise<PracticeSession & { hasDeadline: boolean }> {
    await sleep(READ_DELAY_MS);
    const entry = requireEntry(id);
    const current = entry.practice.get(cardId)?.box ?? 1;
    const box = nextBox(current, confidence);
    const days = daysUntil(entry.record.request.interviewDate);
    const offset = nextReviewInDays(box, days ?? 30);
    entry.practice.set(cardId, {
      box,
      dueAt: new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10),
      lastConfidence: confidence,
      reviewedAt: new Date().toISOString(),
    });
    return session(entry);
  },
};
