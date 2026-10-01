import type {
  AnswersRequest,
  AnswersResult,
  CareerProfile,
  ComposeRequest,
  ComposeResult,
  ImportRequest,
  NoteRequest,
  MarketAnswersRequest,
  MarketAnswersResult,
  MarketTerms,
  ParseRequest,
  ParseResult,
  Region,
  Resume,
  ResumeListItem,
  ResumeSnapshot,
  StartTailoringRequest,
  TailoringDecision,
  TailoringState,
} from "@dossier/core/resume";
import { mockApi } from "./demo/mockApi";

// Phase U: every call resolves from the static demo data — no network, no storage. Phase B adds the
// real request for each function behind NEXT_PUBLIC_RESUME_MOCK, keeping these signatures.

export const getProfile = (): Promise<CareerProfile | null> => mockApi.getProfile();
export const saveProfile = (profile: CareerProfile): Promise<CareerProfile> => mockApi.saveProfile(profile);

export const parseDescription = (req: ParseRequest): Promise<ParseResult> => mockApi.parseDescription(req);
export const importResume = (req: ImportRequest): Promise<ParseResult> => mockApi.importResume(req);
export const submitAnswers = (req: AnswersRequest): Promise<AnswersResult> => mockApi.submitAnswers(req);
export const addNote = (req: NoteRequest): Promise<AnswersResult> => mockApi.addNote(req);
export const composeResume = (req: ComposeRequest): Promise<ComposeResult> => mockApi.composeResume(req);

export const listResumes = (): Promise<ResumeListItem[]> => mockApi.listResumes();
export const getResume = (id: string): Promise<Resume> => mockApi.getResume(id);
export const saveResume = (resume: Resume): Promise<Resume> => mockApi.saveResume(resume);
export const deleteResume = (id: string): Promise<void> => mockApi.deleteResume(id);
export const getResumeHistory = (id: string): Promise<ResumeSnapshot[]> => mockApi.getResumeHistory(id);

export const startTailoring = (req: StartTailoringRequest): Promise<TailoringState> => mockApi.startTailoring(req);
export const continueTailoring = (sessionId: string, decision: TailoringDecision): Promise<TailoringState> =>
  mockApi.continueTailoring(sessionId, decision);
export const getTailoring = (sessionId: string): Promise<TailoringState> => mockApi.getTailoring(sessionId);

export const getMarketTerms = (role: string, region: Region): Promise<MarketTerms> => mockApi.getMarketTerms(role, region);
export const answerMarketTerms = (req: MarketAnswersRequest): Promise<MarketAnswersResult> => mockApi.answerMarketTerms(req);

export const resumeKeys = {
  all: ["resume-studio"] as const,
  profile: ["resume-studio", "profile"] as const,
  list: ["resume-studio", "resumes"] as const,
  resume: (id: string) => ["resume-studio", "resume", id] as const,
  history: (id: string) => ["resume-studio", "history", id] as const,
  tailoring: (id: string) => ["resume-studio", "tailoring", id] as const,
  market: (role: string, region: Region) => ["resume-studio", "market", role, region] as const,
};
