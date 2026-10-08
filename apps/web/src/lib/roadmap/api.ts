import type {
  Confidence,
  CreateRoadmapRequest,
  RegenerateResult,
  RoadmapListItem,
  RoadmapRecord,
  SaveRoadmapRequest,
} from "@dossier/core/roadmap";
import type { PracticeSession } from "@/lib/api";
import { mockApi } from "./demo/mockApi";

// Stage 1: every call resolves from demo data. S4 swaps in the real routes behind these signatures.
export const ROADMAP_SAMPLE = true;

export type RoadmapPractice = PracticeSession & { hasDeadline: boolean };

export const listRoadmaps = (): Promise<RoadmapListItem[]> => mockApi.listRoadmaps();
export const getRoadmap = (id: string): Promise<RoadmapRecord> => mockApi.getRoadmap(id);
export const createRoadmap = (req: CreateRoadmapRequest): Promise<RoadmapRecord> => mockApi.createRoadmap(req);
export const saveRoadmap = (id: string, req: SaveRoadmapRequest): Promise<RoadmapRecord> => mockApi.saveRoadmap(id, req);
export const regenerateRoadmap = (id: string): Promise<RegenerateResult> => mockApi.regenerateRoadmap(id);
export const retryRoadmap = (id: string): Promise<RoadmapRecord> => mockApi.retryRoadmap(id);
export const deleteRoadmap = (id: string): Promise<void> => mockApi.deleteRoadmap(id);
export const getRoadmapPractice = (id: string): Promise<RoadmapPractice> => mockApi.getPractice(id);
export const reviewRoadmapCard = (id: string, cardId: string, confidence: Confidence): Promise<RoadmapPractice> =>
  mockApi.reviewCard(id, cardId, confidence);

export const roadmapKeys = {
  all: ["roadmaps"] as const,
  list: ["roadmaps", "list"] as const,
  one: (id: string) => ["roadmaps", "one", id] as const,
  practice: (id: string) => ["roadmaps", "practice", id] as const,
};
