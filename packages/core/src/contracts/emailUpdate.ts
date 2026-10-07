import { z } from 'zod';
import type { ApplicationStatus, Interview } from './application.js';
import { isTimeZone } from './notifications.js';

// What the AI fills in. Times come back as the wall-clock time written in the email; the server turns
// them into UTC using the user's time zone. Links come back as placeholders like "[LINK_2]".
export const EmailUpdateLlm = z.object({
  isJobEmail: z.boolean(),
  company: z.string().max(120),
  role: z.string().max(160).optional(),
  status: z.enum(['applied', 'online_test', 'interviewing', 'offer', 'rejected']).optional(),
  round: z.int().min(1).max(20).optional(),
  interview: z
    .object({
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
      durationMin: z.int().min(15).max(480).optional(),
      link: z.string().max(20).optional(),
    })
    .optional(),
  summary: z.string().max(200),
});
export type EmailUpdateLlm = z.infer<typeof EmailUpdateLlm>;

export const ParseEmailRequest = z.object({
  text: z.string().trim().min(20).max(20_000),
  timezone: z.string().max(64).refine(isTimeZone, 'unknown time zone'),
});

export interface UpdateProposal {
  // Set when the email matched an application already in the tracker; otherwise applying adds one.
  applicationId?: string;
  company: string;
  role?: string;
  status?: ApplicationStatus;
  round?: number;
  interview?: Interview;
  summary: string;
  // Who suggested it when it wasn't a pasted email, e.g. "Claude" (the AI assistant's app name).
  from?: string;
}

export interface EmailUpdateRecord {
  id: string;
  createdAt: string;
  proposal: UpdateProposal;
}
