import type {
  Contact,
  Entry,
  GapQuestion,
  MarketTerms,
  ParseResult,
  Proposal,
  RecruiterTerm,
  Region,
  Requirement,
  RequirementVerdict,
  TailorTarget,
} from "@dossier/core/resume";
import type { Persona } from "./scenario";

export interface TailoringFixture {
  target: TailorTarget;
  requirements: Requirement[];
  terms: RecruiterTerm[];
  verdicts: RequirementVerdict[];
  proposals: Omit<Proposal, "status">[];
  questions: GapQuestion[];
  // Where a bullet built from a gap answer goes.
  gapEntryId: string;
}

export interface PersonaFixture {
  persona: Persona;
  contact: Contact;
  region: Region;
  describeText: string;
  importText: string;
  parse: ParseResult;
  // Turns an answer into an English fact (and sometimes a new entry). null = nothing to record.
  answerToFact: Record<string, (answer: string) => { text: string; entry?: Entry } | null>;
  sampleAnswers: Record<string, string>;
  sampleDuties: string[];
  // How the "AI" phrases known facts and ticked duties when composing.
  factBullets: Record<string, string>;
  dutyBullets: Record<string, string>;
  summary: { text: string; factIds: string[] };
  resumeTitle: string;
  tailoring: TailoringFixture;
  market: Extract<MarketTerms, { status: "ready" }>;
}
