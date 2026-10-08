import { z } from 'zod';
import { ResourceLink } from './roadmap.js';

export const InterviewSourceType = z.enum(['roadmap', 'kit', 'resume']);
export type InterviewSourceType = z.infer<typeof InterviewSourceType>;

export const InterviewSource = z.object({
  type: InterviewSourceType,
  id: z.string(),
  label: z.string(),
});
export type InterviewSource = z.infer<typeof InterviewSource>;

export const InterviewMode = z.enum(['voice', 'text']);
export type InterviewMode = z.infer<typeof InterviewMode>;

export const InterviewQuestion = z.object({
  id: z.string(),
  prompt: z.string().min(1),
  round: z.string().nullable(),
  // A resume drill points at the bullet the question came from.
  from: z.string().nullable(),
});
export type InterviewQuestion = z.infer<typeof InterviewQuestion>;

// Client-sent and untrusted: length-capped, and only ever read as data by the grader.
export const InterviewTurn = z.object({
  role: z.enum(['interviewer', 'candidate']),
  questionId: z.string().nullable(),
  text: z.string().max(6000),
  startMs: z.int().nonnegative(),
  endMs: z.int().nonnegative(),
});
export type InterviewTurn = z.infer<typeof InterviewTurn>;

export const RubricCriterion = z.enum(['structure', 'depth', 'evidence', 'communication']);
export type RubricCriterion = z.infer<typeof RubricCriterion>;

// Every score must quote the candidate's own words; that is what stops vague "great answer" feedback.
export const CriterionScore = z.object({
  criterion: RubricCriterion,
  score: z.int().min(1).max(5),
  evidence: z.string().min(1),
  note: z.string(),
});
export type CriterionScore = z.infer<typeof CriterionScore>;

export const QuestionScore = z.object({
  questionId: z.string(),
  prompt: z.string(),
  answered: z.boolean(),
  scores: z.array(CriterionScore),
  strength: z.string(),
  improve: z.string(),
});
export type QuestionScore = z.infer<typeof QuestionScore>;

// Worked out from the timed transcript in code, not by the AI. Null for typed interviews.
export const DeliveryMetrics = z.object({
  wordsPerMinute: z.int().nonnegative(),
  fillerCount: z.int().nonnegative(),
  fillersPerMinute: z.number().nonnegative(),
  topFillers: z.array(z.object({ word: z.string(), count: z.int().positive() })),
  longestAnswerSec: z.int().nonnegative(),
});
export type DeliveryMetrics = z.infer<typeof DeliveryMetrics>;

export const Weakness = z.object({
  id: z.string(),
  title: z.string(),
  why: z.string(),
  resource: ResourceLink.nullable(),
  // Set once it has been added to a roadmap as a topic.
  roadmapTopic: z.object({ roadmapId: z.string(), topicId: z.string() }).nullable(),
});
export type Weakness = z.infer<typeof Weakness>;

export const InterviewReport = z.object({
  overall: z.number().min(1).max(5),
  headline: z.string(),
  questions: z.array(QuestionScore),
  delivery: DeliveryMetrics.nullable(),
  weaknesses: z.array(Weakness),
});
export type InterviewReport = z.infer<typeof InterviewReport>;

export const InterviewStatus = z.enum(['live', 'grading', 'graded', 'failed', 'abandoned']);
export type InterviewStatus = z.infer<typeof InterviewStatus>;

export const InterviewRecord = z.object({
  id: z.string(),
  source: InterviewSource,
  mode: InterviewMode,
  status: InterviewStatus,
  questions: z.array(InterviewQuestion),
  turns: z.array(InterviewTurn),
  report: InterviewReport.nullable(),
  // Hard cap on a session; the interview ends itself when it runs out.
  maxMinutes: z.int().positive(),
  createdAt: z.iso.datetime(),
  durationSec: z.int().nonnegative(),
});
export type InterviewRecord = z.infer<typeof InterviewRecord>;

export const InterviewListItem = z.object({
  id: z.string(),
  source: InterviewSource,
  mode: InterviewMode,
  status: InterviewStatus,
  overall: z.number().nullable(),
  questionCount: z.int().nonnegative(),
  createdAt: z.iso.datetime(),
  durationSec: z.int().nonnegative(),
});
export type InterviewListItem = z.infer<typeof InterviewListItem>;

export const CreateInterviewRequest = z.object({
  source: z.object({ type: InterviewSourceType, id: z.string().min(1) }),
  mode: InterviewMode,
  questionCount: z.union([z.literal(3), z.literal(5)]),
});
export type CreateInterviewRequest = z.infer<typeof CreateInterviewRequest>;

// What can be practised: roadmaps, kits and resumes the user has.
export const InterviewSourceOption = InterviewSource.extend({
  detail: z.string(),
  questionCount: z.int().nonnegative(),
});
export type InterviewSourceOption = z.infer<typeof InterviewSourceOption>;

export const FinishInterviewRequest = z.object({
  turns: z.array(InterviewTurn).max(200),
  durationSec: z.int().nonnegative(),
  // Voice dropped mid-way and the rest was typed.
  switchedToText: z.boolean(),
});
export type FinishInterviewRequest = z.infer<typeof FinishInterviewRequest>;
