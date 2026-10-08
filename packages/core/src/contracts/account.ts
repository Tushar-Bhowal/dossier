import { z } from 'zod';

// research = kits and roadmaps built, llm = single AI requests (edits, answers), voice = mock interviews.
export const QuotaKind = z.enum(['research', 'llm', 'voice']);
export type QuotaKind = z.infer<typeof QuotaKind>;

export const UsageMeter = z.object({
  kind: QuotaKind,
  used: z.int().min(0),
  limit: z.int().positive(),
});
export type UsageMeter = z.infer<typeof UsageMeter>;

// Counters are per UTC day; resetsAt is the next UTC midnight.
export const UsageToday = z.object({
  day: z.iso.date(),
  resetsAt: z.iso.datetime(),
  ownKey: z.boolean(),
  meters: z.array(UsageMeter),
});
export type UsageToday = z.infer<typeof UsageToday>;

// The key itself never leaves the server after it is saved; only the last 4 characters do.
export const ApiKeyStatus = z.object({
  provider: z.literal('gemini'),
  last4: z.string().length(4),
  addedAt: z.iso.datetime(),
});
export type ApiKeyStatus = z.infer<typeof ApiKeyStatus>;

export const SaveApiKeyRequest = z.object({
  key: z.string().trim().min(30, 'That looks too short to be a Gemini key').max(200),
});
export type SaveApiKeyRequest = z.infer<typeof SaveApiKeyRequest>;

// What a full delete removes, shown in the confirm dialog.
export const AccountDataSummary = z.object({
  kits: z.int().min(0),
  applications: z.int().min(0),
  resumes: z.int().min(0),
  chatMessages: z.int().min(0),
  assistants: z.int().min(0),
});
export type AccountDataSummary = z.infer<typeof AccountDataSummary>;

// invalid_key: Google rejected it. key_quota: valid but out of its own free quota.
// key_check_unavailable: Google could not be reached to check it.
export const ACCOUNT_ERROR_CODES = ['invalid_key', 'key_quota', 'key_check_unavailable', 'quota_exceeded'] as const;
export type AccountErrorCode = (typeof ACCOUNT_ERROR_CODES)[number];
