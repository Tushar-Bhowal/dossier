import type { Kit } from "@dossier/core";

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
export async function patchKit(id: string, version: number, kit: Kit): Promise<PatchKitResult> {
  const res = await fetch(`/api/v1/kits/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "If-Match": String(version) },
    credentials: "same-origin",
    body: JSON.stringify({ kit }),
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
