import type { Kit } from "@dossier/core";
import type {
  ApplicationCreate,
  ApplicationInput,
  ApplicationPreview,
  ApplicationRecord,
  ChatActionState,
  ChatMessageView,
  ChatRequest,
  ChatStreamEvent,
  EmailUpdateRecord,
  NotificationPrefs,
  NotificationSettingsView,
  PushSubscriptionInput,
  TestResult,
} from "@dossier/core/applications";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    credentials: "same-origin",
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const code = typeof body?.code === "string" ? body.code : "unknown_error";
    const message = typeof body?.message === "string" ? body.message : `request failed with status ${res.status}`;
    throw new ApiError(res.status, code, message);
  }

  return body as T;
}

export interface User {
  id: string;
  email: string;
}

export function register(email: string, password: string): Promise<User> {
  return request<User>("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function login(email: string, password: string): Promise<User> {
  return request<User>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function logout(): Promise<void> {
  return request<void>("/auth/logout", { method: "POST" });
}

export function me(): Promise<User> {
  return request<User>("/auth/me");
}

export type StepStatus = "pending" | "running" | "ok" | "skipped" | "failed";

export interface RunStep {
  name: string;
  status: StepStatus;
  startedAt: string | null;
  endedAt: string | null;
  attempts: number;
  output?: unknown;
  error?: string;
  note?: string;
}

export type RunStatus = "queued" | "running" | "succeeded" | "partial" | "failed";

export interface SourceSkipped {
  url: string;
  reason: string;
}

export interface RunRecord {
  id: string;
  userId: string | null;
  kitId: string | null;
  idempotencyKey: string;
  status: RunStatus;
  steps: RunStep[];
  sourcesSkipped: SourceSkipped[];
  createdAt: string;
  updatedAt: string;
  heartbeatAt: string;
}

export interface RunCreateInput {
  jd: string;
  company_url: string;
  days: number;
}

export function createRun(input: RunCreateInput): Promise<RunRecord> {
  return request<RunRecord>("/runs", { method: "POST", body: JSON.stringify(input) });
}

export function getRun(id: string): Promise<RunRecord> {
  return request<RunRecord>(`/runs/${id}`);
}

export function resumeRun(id: string): Promise<RunRecord> {
  return request<RunRecord>(`/runs/${id}/resume`, { method: "POST" });
}

export interface KitSummary {
  id: string;
  version: number;
  kit: Kit;
  createdAt: string;
  updatedAt: string;
}

export function listKits(): Promise<KitSummary[]> {
  return request<KitSummary[]>("/kits");
}

export function getKit(id: string): Promise<KitSummary> {
  return request<KitSummary>(`/kits/${id}`);
}

export function deleteKit(id: string): Promise<void> {
  return request<void>(`/kits/${id}`, { method: "DELETE" });
}

export type PatchKitResult = { ok: true; data: KitSummary } | { ok: false; conflict: KitSummary };

// Doesn't go through `request()`: a 409 here is an expected, handleable outcome (the caller
// rebases onto `conflict.kit`), not an exception.
//
// The version travels in the body, deliberately not in an `If-Match` header. `If-Match` is a
// conditional-request header whose value must be an ETag, and it is evaluated by any spec-compliant
// cache or CDN in front of the origin — Vercel's edge compares it against the response's real ETag,
// fails the precondition, and returns 412 before the request ever reaches the function. Carrying an
// application-level version integer there only appears to work when nothing is proxying the request.
export async function patchKit(id: string, version: number, kit: Kit): Promise<PatchKitResult> {
  const res = await fetch(`/api/v1/kits/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ version, kit }),
  });
  const body = await res.json().catch(() => null);

  if (res.status === 409) {
    return { ok: false, conflict: body.current as KitSummary };
  }
  if (!res.ok) {
    const code = typeof body?.code === "string" ? body.code : "unknown_error";
    const message = typeof body?.message === "string" ? body.message : `request failed with status ${res.status}`;
    throw new ApiError(res.status, code, message);
  }
  return { ok: true, data: body as KitSummary };
}

export type RegenerateSection = "company_brief" | "requirements" | "flashcards" | `questions:${string}`;

export function regenerateSection(id: string, section: RegenerateSection): Promise<KitSummary> {
  return request<KitSummary>(`/kits/${id}/sections/${encodeURIComponent(section)}/regenerate`, { method: "POST" });
}

export type Confidence = "low" | "medium" | "high";

export interface PracticeCard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  box: 1 | 2 | 3 | 4 | 5;
  dueAt: string;
  due: boolean;
  covered: boolean;
  lastConfidence: Confidence | null;
  reviewedAt: string | null;
}

export interface PracticeSession {
  daysRemaining: number;
  cards: PracticeCard[];
}

export function getPracticeSession(kitId: string): Promise<PracticeSession> {
  return request<PracticeSession>(`/kits/${kitId}/practice`);
}

export function recordPracticeReview(kitId: string, flashcardId: string, confidence: Confidence): Promise<PracticeSession> {
  return request<PracticeSession>(`/kits/${kitId}/practice`, {
    method: "POST",
    body: JSON.stringify({ flashcardId, confidence }),
  });
}

export function listApplications(): Promise<ApplicationRecord[]> {
  return request<ApplicationRecord[]>("/applications");
}

export function previewJobLink(url: string): Promise<ApplicationPreview> {
  return request<ApplicationPreview>("/applications/preview", { method: "POST", body: JSON.stringify({ url }) });
}

export function deleteApplication(id: string): Promise<void> {
  return request<void>(`/applications/${id}`, { method: "DELETE" });
}

export type SaveApplicationResult =
  | { ok: true; record: ApplicationRecord }
  | { ok: false; reason: "duplicate" | "conflict"; record?: ApplicationRecord };

// Like patchKit: a 409 (duplicate job link, or edited elsewhere) is an expected outcome the caller
// handles, not an exception.
async function sendApplication(path: string, method: "POST" | "PATCH", body: unknown): Promise<SaveApplicationResult> {
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (res.status === 409) {
    return json?.code === "duplicate"
      ? { ok: false, reason: "duplicate", record: json.existing }
      : { ok: false, reason: "conflict", record: json?.current };
  }
  if (!res.ok) {
    const code = typeof json?.code === "string" ? json.code : "unknown_error";
    const message = typeof json?.message === "string" ? json.message : `request failed with status ${res.status}`;
    throw new ApiError(res.status, code, message);
  }
  return { ok: true, record: json as ApplicationRecord };
}

export function createApplication(input: ApplicationCreate): Promise<SaveApplicationResult> {
  return sendApplication("/applications", "POST", input);
}

export function updateApplication(id: string, version: number, application: ApplicationInput): Promise<SaveApplicationResult> {
  return sendApplication(`/applications/${id}`, "PATCH", { version, application });
}

export function getNotificationSettings(): Promise<NotificationSettingsView> {
  return request<NotificationSettingsView>("/notifications/settings");
}

export function saveNotificationPrefs(prefs: NotificationPrefs): Promise<NotificationSettingsView> {
  return request<NotificationSettingsView>("/notifications/settings", { method: "PUT", body: JSON.stringify(prefs) });
}

export function sendTestNotification(): Promise<TestResult[]> {
  return request<TestResult[]>("/notifications/test", { method: "POST" });
}

export function createTelegramLink(): Promise<{ url: string }> {
  return request<{ url: string }>("/notifications/telegram/link", { method: "POST" });
}

export function disconnectTelegram(): Promise<NotificationSettingsView> {
  return request<NotificationSettingsView>("/notifications/telegram", { method: "DELETE" });
}

export function savePushSubscription(subscription: PushSubscriptionInput): Promise<NotificationSettingsView> {
  return request<NotificationSettingsView>("/notifications/webpush", { method: "POST", body: JSON.stringify(subscription) });
}

export function getOAuthClient(clientId: string): Promise<{ name: string; redirectHost: string }> {
  return request<{ name: string; redirectHost: string }>(`/oauth/clients/${encodeURIComponent(clientId)}`);
}

export interface ConnectedAssistant {
  clientId: string;
  clientName: string;
  connectedAt: string;
}

export function listAssistants(): Promise<ConnectedAssistant[]> {
  return request<ConnectedAssistant[]>("/assistants");
}

export function disconnectAssistant(clientId: string): Promise<void> {
  return request<void>(`/assistants/${encodeURIComponent(clientId)}`, { method: "DELETE" });
}

export function listEmailUpdates(): Promise<EmailUpdateRecord[]> {
  return request<EmailUpdateRecord[]>("/applications/updates");
}

export function applyEmailUpdate(id: string): Promise<ApplicationRecord> {
  return request<ApplicationRecord>(`/applications/updates/${id}/apply`, { method: "POST" });
}

export function dismissEmailUpdate(id: string): Promise<void> {
  return request<void>(`/applications/updates/${id}/dismiss`, { method: "POST" });
}

export function removePushSubscription(endpoint: string): Promise<NotificationSettingsView> {
  return request<NotificationSettingsView>("/notifications/webpush/remove", { method: "POST", body: JSON.stringify({ endpoint }) });
}

export function getChatHistory(): Promise<ChatMessageView[]> {
  return request<ChatMessageView[]>("/chat");
}

export function clearChat(): Promise<void> {
  return request<void>("/chat", { method: "DELETE" });
}

export function chatAction(
  id: string,
  verb: "undo" | "confirm" | "cancel",
): Promise<{ state: ChatActionState; changed: { applications: boolean; settings: boolean } }> {
  return request(`/chat/actions/${encodeURIComponent(id)}/${verb}`, { method: "POST" });
}

// The reply streams back as one JSON object per line: progress steps, then the stored reply.
export async function sendChat(body: ChatRequest, onEvent: (event: ChatStreamEvent) => void): Promise<void> {
  const res = await fetch("/api/v1/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => null);
    throw new ApiError(res.status, typeof err?.code === "string" ? err.code : "unknown_error", typeof err?.message === "string" ? err.message : "request failed");
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line) as ChatStreamEvent);
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as ChatStreamEvent);
}
