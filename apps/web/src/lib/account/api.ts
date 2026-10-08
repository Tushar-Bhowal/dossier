import type { AccountDataSummary, ApiKeyStatus, SaveApiKeyRequest, UsageToday } from "@dossier/core/account";
import { mockApi } from "./demo/mockApi";

// Usage, the user's own key and account deletion run on demo data until Stage 2 (S2) adds the real
// routes behind these same signatures. While true, screens say so and nothing is saved.
export const ACCOUNT_SAMPLE = true;

export const getUsage = (): Promise<UsageToday> => mockApi.getUsage();
export const getApiKey = (): Promise<ApiKeyStatus | null> => mockApi.getApiKey();
export const saveApiKey = (req: SaveApiKeyRequest): Promise<ApiKeyStatus> => mockApi.saveApiKey(req);
export const removeApiKey = (): Promise<void> => mockApi.removeApiKey();
export const getDataSummary = (): Promise<AccountDataSummary> => mockApi.getDataSummary();
export const deleteAccount = (): Promise<void> => mockApi.deleteAccount();

export const accountKeys = {
  all: ["account"] as const,
  usage: ["account", "usage"] as const,
  apiKey: ["account", "api-key"] as const,
  summary: ["account", "summary"] as const,
};
