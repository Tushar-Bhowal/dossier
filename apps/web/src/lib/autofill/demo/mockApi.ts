import type { FieldDescriptor, FieldResult, FixedTopic } from "@dossier/core/autofill";
import { sleep } from "@/lib/demo/scenario";
import { autofillScenario } from "./scenario";
import { formFor, type DemoForm } from "./forms";

export interface ScanResult {
  form: DemoForm;
  fields: FieldDescriptor[];
  jobDescriptionFound: boolean;
  unreadableParts: number;
}

export interface FillResult {
  results: FieldResult[];
  // AI fields left for the user because the AI was down or the daily limit was hit.
  aiProblem: "down" | "quota" | null;
}

const savedTopics = new Map<FixedTopic, string>();

export const mockApi = {
  signedInAs(): string | null {
    const { fail, persona } = autofillScenario.getScenario();
    if (fail === "signed_out") return null;
    return persona === "engineer" ? "rahul.verma@example.com" : "ananya.sen@example.com";
  },

  async scan(): Promise<ScanResult> {
    await sleep(900);
    const { persona, fail } = autofillScenario.getScenario();
    const form = formFor(persona);
    return {
      form,
      fields: form.fields.map((f) => ({
        id: f.id,
        type: f.type,
        label: f.label,
        section: f.section,
        options: f.options,
        required: f.required,
        maxLength: f.maxLength,
      })),
      jobDescriptionFound: fail !== "no_jd",
      unreadableParts: fail === "iframe" ? 1 : 0,
    };
  },

  // Profile and saved answers fill locally; only written questions go to the AI, and never sensitive ones.
  async fill(form: DemoForm, pastedJd: string | null): Promise<FillResult> {
    await sleep(autofillScenario.aiDelayMs());
    const { fail } = autofillScenario.getScenario();
    const aiProblem = fail === "ai_down" ? "down" : fail === "quota" ? "quota" : null;
    const noJd = fail === "no_jd" && !pastedJd;
    const results = form.fields.map((f): FieldResult => {
      const r = f.result;
      if (r.kind === "blank" && r.reason === "fixed_topic" && r.topic && savedTopics.has(r.topic)) {
        return { id: r.id, kind: "saved", savedAnswerId: `sa-${r.topic}`, text: savedTopics.get(r.topic)! };
      }
      if (r.kind === "answer" && (aiProblem || noJd)) return { id: r.id, kind: "blank", reason: aiProblem ? "ai_unavailable" : "no_facts" };
      return r;
    });
    return { results, aiProblem };
  },

  async saveFixedAnswer(topic: FixedTopic, answer: string): Promise<void> {
    await sleep(300);
    savedTopics.set(topic, answer);
  },

  async saveEdits(count: number): Promise<number> {
    await sleep(500);
    return count;
  },
};
