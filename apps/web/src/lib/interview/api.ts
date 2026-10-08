import type {
  CreateInterviewRequest,
  FinishInterviewRequest,
  InterviewListItem,
  InterviewRecord,
  InterviewSourceOption,
} from "@dossier/core/interview";
import { mockApi } from "./demo/mockApi";

// Stage 1: scripted interviewer and a simple stand-in grader. S5 swaps in Gemini Live and real grading.
export const INTERVIEW_SAMPLE = true;

export const listInterviews = (): Promise<InterviewListItem[]> => mockApi.listInterviews();
export const listInterviewSources = (): Promise<InterviewSourceOption[]> => mockApi.listSources();
export const getInterview = (id: string): Promise<InterviewRecord> => mockApi.getInterview(id);
export const createInterview = (req: CreateInterviewRequest): Promise<InterviewRecord> => mockApi.createInterview(req);
export const finishInterview = (id: string, req: FinishInterviewRequest): Promise<InterviewRecord> => mockApi.finishInterview(id, req);
export const retryGrading = (id: string): Promise<InterviewRecord> => mockApi.retryGrading(id);
export const addWeaknessToRoadmap = (id: string, weaknessId: string, roadmapId: string): Promise<InterviewRecord> =>
  mockApi.addWeaknessToRoadmap(id, weaknessId, roadmapId);
export const deleteInterview = (id: string): Promise<void> => mockApi.deleteInterview(id);

export const interviewKeys = {
  all: ["interviews"] as const,
  list: ["interviews", "list"] as const,
  sources: ["interviews", "sources"] as const,
  one: (id: string) => ["interviews", "one", id] as const,
};
