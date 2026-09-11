import { LlmCallError, type LlmCallParams, type LlmPort } from '@dossier/core';

export class FakeLlmPort implements LlmPort {
  private queue: unknown[] = [];
  readonly calls: LlmCallParams<unknown>[] = [];

  enqueue(response: unknown): void {
    this.queue.push(response);
  }

  async generate<T>(params: LlmCallParams<T>): Promise<T> {
    this.calls.push(params as LlmCallParams<unknown>);
    if (this.queue.length === 0) {
      throw new LlmCallError(`FakeLlmPort: no queued response left for a call using model "${params.model}"`);
    }
    const next = this.queue.shift();
    return params.schema.parse(next);
  }
}
