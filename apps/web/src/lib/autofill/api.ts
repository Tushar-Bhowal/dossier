import { mockApi } from "./demo/mockApi";

// Stage 1: the panel runs against a sample form in the app. S9 builds the real extension around the
// same panel, with the page script and POST /autofill/answer.
export const AUTOFILL_SAMPLE = true;

export const autofill = mockApi;
export type { FillResult, ScanResult } from "./demo/mockApi";
