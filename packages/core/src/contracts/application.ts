import { z } from 'zod';

export const ApplicationStatus = z.enum([
  'saved',
  'applied',
  'online_test',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
  'no_reply',
]);
export type ApplicationStatus = z.infer<typeof ApplicationStatus>;

export const OPEN_STAGES = ['saved', 'applied', 'online_test', 'interviewing', 'offer'] as const satisfies readonly ApplicationStatus[];
export const CLOSED_STATUSES = ['rejected', 'withdrawn', 'no_reply'] as const satisfies readonly ApplicationStatus[];

// http(s) only: these are rendered as links, and z.url() alone would accept javascript: URLs.
const HttpUrl = z.url({ protocol: /^https?$/ }).max(2000);
const LocalDate = z.iso.date();

export const StatusEvent = z.object({
  status: ApplicationStatus,
  round: z.int().min(1).max(20).optional(),
  at: z.iso.datetime(),
});
export type StatusEvent = z.infer<typeof StatusEvent>;

// Everything the user can set. The server owns statusHistory and source.
export const ApplicationInput = z.object({
  company: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(160),
  jobUrl: HttpUrl.optional(),
  companyUrl: HttpUrl.optional(),
  location: z.string().trim().max(120).optional(),
  // Empty while the application is only saved; filled in once it moves past Saved.
  appliedOn: LocalDate.optional(),
  status: ApplicationStatus,
  round: z.int().min(1).max(20).optional(),
  jdText: z.string().max(20_000).optional(),
  notes: z.string().max(4000).optional(),
  followUpOn: LocalDate.optional(),
  kitRunId: z.string().max(100).optional(),
});
export type ApplicationInput = z.infer<typeof ApplicationInput>;

export const ApplicationSource = z.enum(['manual', 'extension']);

export const Application = ApplicationInput.extend({
  statusHistory: z.array(StatusEvent).max(200),
  source: ApplicationSource,
});
export type Application = z.infer<typeof Application>;

export const ApplicationCreate = ApplicationInput.extend({ source: ApplicationSource.default('manual') });
export type ApplicationCreate = z.input<typeof ApplicationCreate>;

export const ApplicationPatch = z.object({
  version: z.int().positive(),
  application: ApplicationInput,
});

export const ApplicationPreviewRequest = z.object({ url: HttpUrl });

export interface ApplicationPreview {
  company?: string;
  role?: string;
  companyUrl?: string;
  jdText?: string;
}

export interface ApplicationRecord {
  id: string;
  version: number;
  application: Application;
  createdAt: string;
  updatedAt: string;
}
