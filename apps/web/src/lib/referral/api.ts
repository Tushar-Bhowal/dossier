import type { DraftKind, DraftResult, Pitch, ReferralContact, ReferralSuggestion, SuggestResult } from "@dossier/core/applications";
import { mockApi } from "./demo/mockApi";

// Stage 1: sample people and drafts. S7 adds search-engine lookup and real drafts behind these.
export const REFERRAL_SAMPLE = true;

export interface JobContext {
  company: string;
  role: string;
  jobUrl?: string;
}

export const getPitch = (): Promise<Pitch> => mockApi.getPitch();
export const savePitch = (pitch: Pitch): Promise<Pitch> => mockApi.savePitch(pitch);
export const listContacts = (applicationId: string): Promise<ReferralContact[]> => mockApi.listContacts(applicationId);
export const suggestPeople = (applicationId: string, job: JobContext): Promise<SuggestResult> => mockApi.suggest(applicationId, job);
export const keepContact = (applicationId: string, s: ReferralSuggestion): Promise<ReferralContact> => mockApi.keep(applicationId, s);
export const updateContact = (applicationId: string, c: ReferralContact): Promise<ReferralContact> => mockApi.updateContact(applicationId, c);
export const removeContact = (applicationId: string, contactId: string): Promise<void> => mockApi.removeContact(applicationId, contactId);
export const draftMessage = (applicationId: string, contactId: string, kind: DraftKind, job: JobContext): Promise<DraftResult> =>
  mockApi.draft(applicationId, contactId, kind, job);

export const referralKeys = {
  all: ["referrals"] as const,
  pitch: ["referrals", "pitch"] as const,
  contacts: (applicationId: string) => ["referrals", "contacts", applicationId] as const,
};
