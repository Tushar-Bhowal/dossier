import type { RunRecord, RunStore } from '../../ports/runStore.js';

// Used by the batch CLI (§9, Task 19) and by every pipeline/runner test — the same implementation,
// not a parallel one, so a test proving "the runner resumes correctly" is proving it against the
// real thing the CLI runs on.
export class InMemoryRunStore implements RunStore {
  private records = new Map<string, RunRecord>();

  async create(record: RunRecord): Promise<void> {
    if (this.records.has(record.id)) {
      throw new Error(`InMemoryRunStore: run "${record.id}" already exists`);
    }
    // Mirrors the { userId, idempotencyKey } unique index the real Mongo store enforces (§13),
    // so a resubmitted job is caught here the same way it would be in production.
    const duplicate = [...this.records.values()].find(
      (r) => r.userId === record.userId && r.idempotencyKey === record.idempotencyKey,
    );
    if (duplicate) {
      throw new Error(
        `InMemoryRunStore: a run with idempotencyKey "${record.idempotencyKey}" already exists for this user`,
      );
    }
    this.records.set(record.id, structuredClone(record));
  }

  async get(id: string): Promise<RunRecord | null> {
    const found = this.records.get(id);
    return found ? structuredClone(found) : null;
  }

  async findByIdempotencyKey(userId: string | null, idempotencyKey: string): Promise<RunRecord | null> {
    const found = [...this.records.values()].find(
      (r) => r.userId === userId && r.idempotencyKey === idempotencyKey,
    );
    return found ? structuredClone(found) : null;
  }

  async update(id: string, patch: Partial<Omit<RunRecord, 'id'>>): Promise<void> {
    const existing = this.records.get(id);
    if (!existing) {
      throw new Error(`InMemoryRunStore: run "${id}" not found`);
    }
    // A real clone, not a shallow spread — a caller mutating the record it got back (the runner
    // does, in place) must not silently mutate the store's own copy underneath it.
    this.records.set(id, structuredClone({ ...existing, ...patch }));
  }
}
