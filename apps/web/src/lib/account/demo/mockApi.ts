import {
  SaveApiKeyRequest,
  type AccountDataSummary,
  type ApiKeyStatus,
  type QuotaKind,
  type UsageToday,
} from "@dossier/core/account";
import { ApiError } from "@/lib/api";
import { READ_DELAY_MS, sleep, type Persona } from "@/lib/demo/scenario";
import { nextUtcMidnight } from "../usage";
import { accountScenario } from "./scenario";

const LIMITS: Record<QuotaKind, number> = { research: 3, llm: 50, voice: 2 };

const USED: Record<Persona, Record<QuotaKind, number>> = {
  engineer: { research: 1, llm: 12, voice: 0 },
  teacher: { research: 2, llm: 23, voice: 1 },
};

const DATA: Record<Persona, AccountDataSummary> = {
  engineer: { kits: 6, applications: 18, resumes: 3, chatMessages: 42, assistants: 1 },
  teacher: { kits: 2, applications: 5, resumes: 1, chatMessages: 9, assistants: 0 },
};

let savedKey: ApiKeyStatus | null = null;
let keySeeded = false;

function currentKey(): ApiKeyStatus | null {
  if (!keySeeded) {
    keySeeded = true;
    if (accountScenario.getScenario().fail === "own_key") {
      savedKey = { provider: "gemini", last4: "Qx7f", addedAt: new Date(Date.now() - 6 * 864e5).toISOString() };
    }
  }
  return savedKey;
}

function usedFor(kind: QuotaKind): number {
  const { persona, fail, empty } = accountScenario.getScenario();
  if (fail === "at_cap") return kind === "voice" ? USED[persona].voice : LIMITS[kind];
  if (fail === "near_cap") return kind === "research" ? LIMITS.research - 1 : kind === "llm" ? LIMITS.llm - 6 : USED[persona].voice;
  return empty ? 0 : USED[persona][kind];
}

export const mockApi = {
  async getUsage(): Promise<UsageToday> {
    await sleep(accountScenario.getScenario().latency === "slow" ? 6_000 : READ_DELAY_MS);
    if (accountScenario.getScenario().fail === "usage_error") {
      throw new ApiError(503, "usage_unavailable", "Usage couldn't be loaded.");
    }
    const resetsAt = nextUtcMidnight();
    return {
      day: new Date(resetsAt.getTime() - 864e5).toISOString().slice(0, 10),
      resetsAt: resetsAt.toISOString(),
      ownKey: Boolean(currentKey()),
      meters: (["research", "llm", "voice"] as const).map((kind) => ({ kind, used: usedFor(kind), limit: LIMITS[kind] })),
    };
  },

  async getApiKey(): Promise<ApiKeyStatus | null> {
    await sleep(READ_DELAY_MS);
    return currentKey();
  },

  async saveApiKey(req: SaveApiKeyRequest): Promise<ApiKeyStatus> {
    const parsed = SaveApiKeyRequest.safeParse(req);
    if (!parsed.success) throw new ApiError(400, "validation_error", parsed.error.issues[0]?.message ?? "Check the key");
    await sleep(accountScenario.aiDelayMs());
    const { fail } = accountScenario.getScenario();
    if (fail === "invalid_key") throw new ApiError(400, "invalid_key", "Google rejected this key.");
    if (fail === "key_quota") throw new ApiError(400, "key_quota", "This key has used up its own free quota.");
    if (fail === "key_check_down") throw new ApiError(503, "key_check_unavailable", "Google couldn't be reached.");
    currentKey();
    savedKey = { provider: "gemini", last4: parsed.data.key.slice(-4), addedAt: new Date().toISOString() };
    return savedKey;
  },

  async removeApiKey(): Promise<void> {
    await sleep(READ_DELAY_MS);
    currentKey();
    savedKey = null;
  },

  async getDataSummary(): Promise<AccountDataSummary> {
    await sleep(READ_DELAY_MS);
    const { persona, empty } = accountScenario.getScenario();
    return empty ? { kits: 0, applications: 0, resumes: 0, chatMessages: 0, assistants: 0 } : DATA[persona];
  },

  async deleteAccount(): Promise<void> {
    await sleep(accountScenario.aiDelayMs());
    if (accountScenario.getScenario().fail === "delete_fails") {
      throw new ApiError(503, "delete_failed", "Nothing was removed.");
    }
  },
};
