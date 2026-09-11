import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RateLimiter } from '@dossier/core';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('admits calls immediately while under both the RPM and TPM budget', async () => {
    const limiter = new RateLimiter({ rpm: 5, tpm: 10_000 });
    await limiter.acquire(100);
    await limiter.acquire(100);
    await limiter.acquire(100);
    // No assertion needed beyond "resolved without advancing time" — a timeout would fail the test.
  });

  it('delays a caller once the RPM budget for the current window is exhausted', async () => {
    const limiter = new RateLimiter({ rpm: 2, tpm: 100_000 });
    await limiter.acquire(10);
    await limiter.acquire(10);

    let resolved = false;
    const third = limiter.acquire(10).then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(100);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(60_000);
    await third;
    expect(resolved).toBe(true);
  });

  it('delays a caller once the TPM budget for the current window is exhausted', async () => {
    const limiter = new RateLimiter({ rpm: 100, tpm: 1_000 });
    await limiter.acquire(900);

    let resolved = false;
    const second = limiter.acquire(200).then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(100);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(60_000);
    await second;
    expect(resolved).toBe(true);
  });

  it('serialises concurrent callers: reservations are granted strictly in arrival order', async () => {
    const limiter = new RateLimiter({ rpm: 1, tpm: 100_000 });
    const order: number[] = [];

    const calls = [1, 2, 3].map((id) => limiter.acquire(1).then(() => order.push(id)));

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(60_000);
    await Promise.all(calls);

    expect(order).toEqual([1, 2, 3]);
  });

  it('never deadlocks on a single call whose estimate exceeds the entire TPM budget', async () => {
    const limiter = new RateLimiter({ rpm: 10, tpm: 100 });
    await limiter.acquire(5_000);
  });
});
