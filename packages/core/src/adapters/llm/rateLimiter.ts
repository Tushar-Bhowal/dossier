import type { Clock } from '../../ports/clock.js';

const systemClock: Clock = { now: () => new Date() };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RateLimiterOptions {
  rpm: number;
  tpm: number;
  clock?: Clock;
}

interface TokenEntry {
  time: number;
  tokens: number;
}

// One shared instance sits in front of every Gemini call (§ Rate limiting), including concurrent
// batch cases, so five cases can never stampede the free-tier RPM/TPM ceiling together. Reservation
// requests are chained through `queue`, so concurrent callers are admitted one at a time in arrival
// order rather than racing each other to read the same window state.
export class RateLimiter {
  private readonly rpm: number;
  private readonly tpm: number;
  private readonly clock: Clock;
  private requestTimes: number[] = [];
  private tokenEntries: TokenEntry[] = [];
  private tokenSum = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(options: RateLimiterOptions) {
    this.rpm = options.rpm;
    this.tpm = options.tpm;
    this.clock = options.clock ?? systemClock;
  }

  async acquire(estimatedTokens: number): Promise<void> {
    const reservation = this.queue.then(() => this.reserve(estimatedTokens));
    // Keep the chain alive even if this reservation's caller later throws downstream.
    this.queue = reservation.then(
      () => undefined,
      () => undefined,
    );
    return reservation;
  }

  private async reserve(estimatedTokens: number): Promise<void> {
    for (;;) {
      const now = this.clock.now().getTime();
      this.prune(now);
      // A single call estimated above the whole TPM budget can never "fit" — admit it once the
      // window is otherwise empty rather than waiting forever for capacity that will never free up.
      const windowEmpty = this.requestTimes.length === 0 && this.tokenEntries.length === 0;
      if (this.requestTimes.length < this.rpm && (this.tokenSum + estimatedTokens <= this.tpm || windowEmpty)) {
        this.requestTimes.push(now);
        this.tokenEntries.push({ time: now, tokens: estimatedTokens });
        this.tokenSum += estimatedTokens;
        return;
      }
      await sleep(this.msUntilNextSlot(now, estimatedTokens));
    }
  }

  private prune(now: number): void {
    const windowStart = now - 60_000;
    while (this.requestTimes.length > 0 && this.requestTimes[0]! <= windowStart) {
      this.requestTimes.shift();
    }
    while (this.tokenEntries.length > 0 && this.tokenEntries[0]!.time <= windowStart) {
      this.tokenSum -= this.tokenEntries.shift()!.tokens;
    }
  }

  private msUntilNextSlot(now: number, estimatedTokens: number): number {
    const waits: number[] = [];
    if (this.requestTimes.length >= this.rpm) {
      waits.push(this.requestTimes[0]! + 60_000 - now);
    }
    if (this.tokenSum + estimatedTokens > this.tpm) {
      waits.push((this.tokenEntries[0]?.time ?? now) + 60_000 - now);
    }
    return Math.max(10, ...waits);
  }
}
