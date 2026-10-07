import { z } from 'zod';
import { ApplicationStatus } from './application.js';
import type { EmailUpdateRecord } from './emailUpdate.js';

// What the AI may return. Applications are named by the alias from the prompt (A1, A2 …), never by a
// database id; times are the wall clock in the user's time zone; links are placeholders like [LINK_1].
// Simple regexes rather than z.iso.date(): Gemini gets the schema, and a short pattern is all it needs.
// No minItems/maxItems on any array: Gemini rejects them inside a union (400 INVALID_ARGUMENT, found
// in the C0 spike), so list lengths are capped in code instead.
export const ChatRef = z.string().regex(/^A\d{1,3}$/);
const LocalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const LocalDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
const LinkToken = z.string().max(20);
const Round = z.int().min(1).max(20);
const Duration = z.int().min(15).max(480);
const Offsets = z.array(z.int().min(10).max(1440));

export const CHAT_WIDGETS = ['connect_telegram', 'enable_push', 'calendar', 'make_kit', 'open_application', 'resume_studio'] as const;
export const CHAT_ANSWERS = ['today', 'upcoming', 'follow_ups', 'quiet', 'status', 'list'] as const;
export const CHAT_CHANNELS = ['telegram', 'webpush', 'email', 'whatsapp', 'sms'] as const;

export const ChatAction = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create_application'),
    company: z.string().max(120),
    role: z.string().max(160).optional(),
    link: LinkToken.optional(),
    status: ApplicationStatus.optional(),
    round: Round.optional(),
    appliedOn: LocalDate.optional(),
    followUpOn: LocalDate.optional(),
    location: z.string().max(120).optional(),
    note: z.string().max(1000).optional(),
  }),
  z.object({
    type: z.literal('update_application'),
    ref: ChatRef,
    status: ApplicationStatus.optional(),
    round: Round.optional(),
    appliedOn: LocalDate.optional(),
    followUpOn: LocalDate.optional(),
    clearFollowUp: z.boolean().optional(),
    company: z.string().max(120).optional(),
    role: z.string().max(160).optional(),
    location: z.string().max(120).optional(),
    link: LinkToken.optional(),
  }),
  z.object({ type: z.literal('add_note'), ref: ChatRef, text: z.string().max(1000) }),
  z.object({ type: z.literal('delete_application'), ref: ChatRef }),
  z.object({
    type: z.literal('add_interview'),
    ref: ChatRef,
    start: LocalDateTime,
    durationMin: Duration.optional(),
    round: Round.optional(),
    link: LinkToken.optional(),
    reminderOffsetsMin: Offsets.optional(),
  }),
  z.object({
    type: z.literal('update_interview'),
    ref: ChatRef,
    interview: z.int().min(1).max(20),
    start: LocalDateTime.optional(),
    durationMin: Duration.optional(),
    round: Round.optional(),
    link: LinkToken.optional(),
    reminderOffsetsMin: Offsets.optional(),
  }),
  z.object({ type: z.literal('remove_interview'), ref: ChatRef, interview: z.int().min(1).max(20) }),
  z.object({
    type: z.literal('set_reminders'),
    offsetsMin: Offsets.optional(),
    digest: z.boolean().optional(),
    digestHour: z.int().min(0).max(23).optional(),
    timezone: z.string().max(64).optional(),
  }),
  z.object({ type: z.literal('set_channel'), channel: z.enum(CHAT_CHANNELS), on: z.boolean() }),
  z.object({
    type: z.literal('show'),
    widget: z.enum(CHAT_WIDGETS),
    ref: ChatRef.optional(),
    interview: z.int().min(1).max(20).optional(),
  }),
  z.object({
    type: z.literal('answer'),
    about: z.enum(CHAT_ANSWERS),
    ref: ChatRef.optional(),
    stage: ApplicationStatus.optional(),
  }),
]);
export type ChatAction = z.infer<typeof ChatAction>;
export type ChatActionType = ChatAction['type'];

export const ChatPlan = z.object({
  reply: z.string().max(800),
  actions: z.array(ChatAction),
  question: z.object({ text: z.string().max(200), options: z.array(z.string().max(60)) }).optional(),
});
export type ChatPlan = z.infer<typeof ChatPlan>;

export const CHAT_PAGES = ['home', 'applications', 'kits', 'resumes', 'assistants', 'other'] as const;
export type ChatPageName = (typeof CHAT_PAGES)[number];

export const ChatRequest = z.object({
  text: z.string().trim().max(4000),
  attachments: z.array(z.object({ kind: z.literal('paste'), text: z.string().trim().min(1).max(20_000) })).max(1).default([]),
  page: z
    .object({ name: z.enum(CHAT_PAGES), applicationId: z.string().max(64).optional() })
    .default({ name: 'home' }),
  timezone: z.string().max(64).optional(),
});
export type ChatRequest = z.input<typeof ChatRequest>;

// A form to open when the assistant couldn't do something itself.
export type ChatFallback =
  | { form: 'add_application' }
  | { form: 'edit_application'; applicationId: string }
  | { form: 'reminders' };

export interface ChatListItem {
  applicationId?: string;
  title: string;
  detail?: string;
}

export type ChatActionState = 'done' | 'undone' | 'awaiting_confirm' | 'cancelled';

// The cards a reply can carry. The assistant only chooses among these; it never writes markup or links.
export type ChatPart =
  | { kind: 'done'; actionId?: string; text: string; applicationId?: string; state: ChatActionState }
  | { kind: 'confirm_delete'; actionId: string; applicationId: string; label: string; state: ChatActionState }
  // `state` is filled in when the conversation is loaded; a fresh proposal is pending.
  | { kind: 'proposal'; update: EmailUpdateRecord; state?: 'pending' | 'applied' | 'dismissed' }
  | { kind: 'connect_telegram' }
  | { kind: 'enable_push' }
  | { kind: 'calendar'; applicationId: string; interviewId: string; label: string }
  // An interview kit to start with one tap. No applicationId = a job only pasted so far, added on Start.
  // `jd` is the pasted job description, kept only when the user asked for a kit from it.
  | { kind: 'make_kit'; applicationId?: string; label: string; company?: string; role?: string; jd?: string }
  | { kind: 'open_application'; applicationId: string; label: string }
  | { kind: 'choices'; text: string; options: string[] }
  | { kind: 'list'; title: string; items: ChatListItem[]; empty: string }
  | { kind: 'coming_soon'; text: string; path?: string }
  | { kind: 'note'; text: string }
  | { kind: 'error'; text: string; fallback?: ChatFallback };

export interface ChatMessageView {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  parts: ChatPart[];
  // Shown instead of a pasted attachment, which is never stored: "Pasted text · 1,240 characters".
  attachmentLabel?: string;
  createdAt: string;
}

// The stream from POST /chat: progress lines while it works, then the stored reply.
export type ChatStreamEvent =
  | { type: 'step'; text: string }
  | { type: 'user'; message: ChatMessageView }
  | { type: 'done'; message: ChatMessageView; changed: { applications: boolean; settings: boolean } }
  | { type: 'error'; code: string; message: string };
