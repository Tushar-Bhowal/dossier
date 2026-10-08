import { z } from 'zod';
import { Flashcard, Origin, Question } from './kit.js';

export const RoadmapKind = z.enum(['skill', 'role']);
export type RoadmapKind = z.infer<typeof RoadmapKind>;

export const RoadmapStage = z.enum(['concepts', 'practice', 'scenario', 'mock']);
export type RoadmapStage = z.infer<typeof RoadmapStage>;

// How well-sourced the interview rounds are, not how good the content is.
export const SourceConfidence = z.enum(['high', 'medium', 'low']);
export type SourceConfidence = z.infer<typeof SourceConfidence>;

// candidate = someone describing their own interview; labelled as such, never presented as official.
export const RoadmapSource = z.object({
  id: z.string().regex(/^s\d+$/),
  title: z.string().min(1),
  url: z.url(),
  kind: z.enum(['official', 'candidate', 'guide']),
});
export type RoadmapSource = z.infer<typeof RoadmapSource>;

export const InterviewRound = z.object({
  id: z.string().regex(/^rd\d+$/),
  name: z.string().min(1),
  what_it_tests: z.string(),
  source_ids: z.array(z.string()),
});
export type InterviewRound = z.infer<typeof InterviewRound>;

export const RoadmapQuestion = Question.omit({ category: true, requirement_ids: true }).extend({
  round_id: z.string().nullable(),
});
export type RoadmapQuestion = z.infer<typeof RoadmapQuestion>;

export const RoadmapFlashcard = Flashcard.omit({ requirement_ids: true });
export type RoadmapFlashcard = z.infer<typeof RoadmapFlashcard>;

// Every URL must come from a search result (checked in code), so links are never invented.
export const ResourceLink = z.object({
  id: z.string().regex(/^x\d+$/),
  kind: z.enum(['video', 'article']),
  title: z.string().min(1),
  url: z.url(),
  publisher: z.string(),
  minutes: z.int().positive().nullable(),
});
export type ResourceLink = z.infer<typeof ResourceLink>;

export const RoadmapTopic = z.object({
  id: z.string().regex(/^t\d+$/),
  title: z.string().min(1),
  stage: RoadmapStage,
  prerequisite_ids: z.array(z.string()),
  explanation: z.string(),
  questions: z.array(RoadmapQuestion),
  flashcards: z.array(RoadmapFlashcard),
  resources: z.array(ResourceLink),
  // origin covers the title and explanation; questions and cards carry their own.
  origin: Origin,
  pinned: z.boolean(),
  order: z.int(),
});
export type RoadmapTopic = z.infer<typeof RoadmapTopic>;

export const Roadmap = z.object({
  kind: RoadmapKind,
  subject: z.string().min(1),
  company: z.string().nullable(),
  domain: z.string(),
  rounds: z.array(InterviewRound),
  topics: z.array(RoadmapTopic),
  sources: z.array(RoadmapSource),
  confidence: SourceConfidence,
});
export type Roadmap = z.infer<typeof Roadmap>;

export const CreateRoadmapRequest = z.object({
  kind: RoadmapKind,
  subject: z.string().trim().min(2, 'Tell us the role or skill').max(120),
  company: z.string().trim().max(120).nullable(),
  interviewDate: z.iso.date().nullable(),
});
export type CreateRoadmapRequest = z.infer<typeof CreateRoadmapRequest>;

export const RoadmapStatus = z.enum(['generating', 'ready', 'failed']);
export type RoadmapStatus = z.infer<typeof RoadmapStatus>;

export const RoadmapRecord = z.object({
  id: z.string(),
  status: RoadmapStatus,
  request: CreateRoadmapRequest,
  roadmap: Roadmap.nullable(),
  doneTopicIds: z.array(z.string()),
  version: z.int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type RoadmapRecord = z.infer<typeof RoadmapRecord>;

export const RoadmapListItem = z.object({
  id: z.string(),
  status: RoadmapStatus,
  kind: RoadmapKind,
  subject: z.string(),
  company: z.string().nullable(),
  interviewDate: z.iso.date().nullable(),
  confidence: SourceConfidence.nullable(),
  topicsDone: z.int().nonnegative(),
  topicsTotal: z.int().nonnegative(),
  updatedAt: z.iso.datetime(),
});
export type RoadmapListItem = z.infer<typeof RoadmapListItem>;

// Whole-document save with the version in the body, like kits.
export const SaveRoadmapRequest = z.object({
  version: z.int().nonnegative(),
  roadmap: Roadmap,
  doneTopicIds: z.array(z.string()),
});
export type SaveRoadmapRequest = z.infer<typeof SaveRoadmapRequest>;

export const RegenerateResult = z.object({
  record: RoadmapRecord,
  kept: z.int().nonnegative(),
});
export type RegenerateResult = z.infer<typeof RegenerateResult>;
