import { z } from 'zod';
import { CONNECTION_NOTE_LIMIT, PITCH_LIMIT, REFERRAL_MESSAGE_LIMIT, isLinkedinProfileUrl } from '../domain/referrals.js';

export const ContactStatus = z.enum(['to_contact', 'requested', 'accepted', 'asked', 'referred', 'no_response']);
export type ContactStatus = z.infer<typeof ContactStatus>;

export const ContactKind = z.enum(['recruiter', 'peer']);
export type ContactKind = z.infer<typeof ContactKind>;

export const ReferralContact = z.object({
  id: z.string(),
  name: z.string().min(1).max(120),
  headline: z.string().max(220),
  profileUrl: z.url().refine(isLinkedinProfileUrl, 'Not a LinkedIn profile link'),
  kind: ContactKind,
  status: ContactStatus,
  connectionNote: z.string().max(CONNECTION_NOTE_LIMIT).optional(),
  referralMessage: z.string().max(REFERRAL_MESSAGE_LIMIT).optional(),
  updatedAt: z.iso.datetime(),
});
export type ReferralContact = z.infer<typeof ReferralContact>;

// Found through search engines; nothing is stored until the user keeps one.
export const ReferralSuggestion = z.object({
  name: z.string(),
  headline: z.string(),
  profileUrl: z.url().refine(isLinkedinProfileUrl),
  kind: ContactKind,
  reason: z.string().max(120),
});
export type ReferralSuggestion = z.infer<typeof ReferralSuggestion>;

export const SuggestResult = z.object({
  suggestions: z.array(ReferralSuggestion).max(5),
  linkedinSearchUrl: z.url(),
});
export type SuggestResult = z.infer<typeof SuggestResult>;

export const DraftKind = z.enum(['connection', 'referral']);
export type DraftKind = z.infer<typeof DraftKind>;

export const DraftResult = z.object({ kind: DraftKind, text: z.string() });
export type DraftResult = z.infer<typeof DraftResult>;

export const Pitch = z.object({ text: z.string().trim().max(PITCH_LIMIT) });
export type Pitch = z.infer<typeof Pitch>;
