export type StepStatus = 'pending' | 'running' | 'ok' | 'skipped' | 'failed';

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

export type RunStatus = 'queued' | 'running' | 'succeeded' | 'partial' | 'failed';

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

export interface RunStore {
  create(record: RunRecord): Promise<void>;
  get(id: string): Promise<RunRecord | null>;
  // userId is nullable because the batch CLI runs auth-free (§9) and has no user to scope by.
  findByIdempotencyKey(userId: string | null, idempotencyKey: string): Promise<RunRecord | null>;
  update(id: string, patch: Partial<Omit<RunRecord, 'id'>>): Promise<void>;
}
