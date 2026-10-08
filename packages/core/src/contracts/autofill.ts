import { z } from 'zod';

export const FieldType = z.enum(['text', 'email', 'tel', 'url', 'number', 'date', 'textarea', 'select', 'radio', 'checkbox', 'combobox', 'file']);
export type FieldType = z.infer<typeof FieldType>;

// Labels and options come from an untrusted page: capped, never treated as instructions.
export const FieldDescriptor = z.object({
  id: z.string().max(40),
  type: FieldType,
  label: z.string().max(300),
  section: z.string().max(120).optional(),
  options: z.array(z.string().max(200)).max(200).optional(),
  required: z.boolean(),
  maxLength: z.int().positive().optional(),
  multiple: z.boolean().optional(),
});
export type FieldDescriptor = z.infer<typeof FieldDescriptor>;

export const ProfileKey = z.enum([
  'firstName', 'lastName', 'fullName', 'email', 'phone', 'location', 'city', 'linkedin', 'github', 'portfolio', 'otherLink',
  'currentTitle', 'currentCompany', 'yearsExperience', 'school', 'degree', 'fieldOfStudy', 'graduationYear', 'grade', 'languages', 'skills',
]);
export type ProfileKey = z.infer<typeof ProfileKey>;

// Sensitive topics: answered only from saved answers, never by the AI.
export const FixedTopic = z.enum([
  'workAuthorization', 'sponsorship', 'salary', 'noticePeriod', 'relocation', 'eeoGender', 'eeoEthnicity', 'eeoVeteran', 'eeoDisability', 'other',
]);
export type FixedTopic = z.infer<typeof FixedTopic>;

export const AutofillRequest = z.object({
  fields: z.array(FieldDescriptor).min(1).max(60),
  jobDescription: z.string().max(20_000).optional(),
  // For logging and quota only; never the full URL.
  host: z.string().max(200),
});
export type AutofillRequest = z.infer<typeof AutofillRequest>;

export const BlankReason = z.enum(['no_facts', 'fixed_topic', 'grounding_failed', 'unsupported', 'ai_unavailable']);
export type BlankReason = z.infer<typeof BlankReason>;

export const FieldResult = z.discriminatedUnion('kind', [
  z.object({ id: z.string(), kind: z.literal('profile'), key: ProfileKey, text: z.string().max(4000) }),
  z.object({ id: z.string(), kind: z.literal('option'), indexes: z.array(z.int().min(0)).min(1) }),
  z.object({ id: z.string(), kind: z.literal('answer'), text: z.string().max(4000), factIds: z.array(z.string()).min(1) }),
  z.object({ id: z.string(), kind: z.literal('saved'), savedAnswerId: z.string(), text: z.string().max(4000) }),
  // The resume PDF the user picked once in the panel.
  z.object({ id: z.string(), kind: z.literal('file'), fileName: z.string().max(200) }),
  z.object({ id: z.string(), kind: z.literal('blank'), reason: BlankReason, topic: FixedTopic.optional() }),
]);
export type FieldResult = z.infer<typeof FieldResult>;

export const AutofillResponse = z.object({ results: z.array(FieldResult) });
export type AutofillResponse = z.infer<typeof AutofillResponse>;

export const SavedAnswer = z.object({
  id: z.string(),
  question: z.string().max(300),
  normalized: z.string().max(300),
  answer: z.string().max(4000),
  topic: FixedTopic.optional(),
  updatedAt: z.iso.datetime(),
});
export type SavedAnswer = z.infer<typeof SavedAnswer>;
