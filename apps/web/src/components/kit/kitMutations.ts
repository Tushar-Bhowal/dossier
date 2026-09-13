import type { Flashcard, Kit, Question, Requirement } from "@dossier/core";

function markEdited(origin: Requirement["origin"]): Requirement["origin"] {
  return origin === "manual" ? "manual" : "edited";
}

// `@dossier/core`'s barrel re-exports its server-only adapters (Node `dns`/`net` etc.) alongside
// the contract types, so importing its runtime `createIdMinter`/`highestIdNumber` here would drag
// that whole module graph into the client bundle. These few lines mirror
// `packages/core/src/contracts/ids.ts` exactly, kept client-safe by not importing it.
function createIdMinter(prefix: string, startAt = 0) {
  let counter = startAt;
  return () => `${prefix}${++counter}`;
}

function highestIdNumber(ids: string[], prefix: string): number {
  return ids.reduce((max, id) => {
    if (!id.startsWith(prefix)) return max;
    const n = Number(id.slice(prefix.length));
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
}

export function editCompanyBriefField(field: "summary" | "what_they_do", value: string) {
  return (kit: Kit): Kit => ({
    ...kit,
    company_brief: { ...kit.company_brief, [field]: value, origin: markEdited(kit.company_brief.origin) },
  });
}

export function editRoleTitle(value: string) {
  return (kit: Kit): Kit => ({
    ...kit,
    role: { ...kit.role, title: value },
    // source.role carries the same title in Appendix A, so leaving it behind would make the kit
    // disagree with itself about what the role is called.
    source: { ...kit.source, role: value },
  });
}

export function editRequirementText(id: string, value: string) {
  return (kit: Kit): Kit => ({
    ...kit,
    role: {
      ...kit.role,
      requirements: kit.role.requirements.map((r) => (r.id === id ? { ...r, text: value, origin: markEdited(r.origin) } : r)),
    },
  });
}

export function toggleRequirementPin(id: string) {
  return (kit: Kit): Kit => ({
    ...kit,
    role: {
      ...kit.role,
      requirements: kit.role.requirements.map((r) => (r.id === id ? { ...r, pinned: !r.pinned } : r)),
    },
  });
}

export function toggleRequirementPriority(id: string) {
  return (kit: Kit): Kit => ({
    ...kit,
    role: {
      ...kit.role,
      requirements: kit.role.requirements.map((r) =>
        r.id === id
          ? { ...r, priority: r.priority === "must" ? "nice" : "must", origin: markEdited(r.origin) }
          : r
      ),
    },
  });
}

export function deleteRequirement(id: string) {
  return (kit: Kit): Kit => ({
    ...kit,
    role: { ...kit.role, requirements: kit.role.requirements.filter((r) => r.id !== id) },
    questions: kit.questions.map((q) => ({ ...q, requirement_ids: q.requirement_ids.filter((rid) => rid !== id) })),
    flashcards: kit.flashcards.map((f) => ({ ...f, requirement_ids: f.requirement_ids.filter((rid) => rid !== id) })),
  });
}

export function addRequirement() {
  return (kit: Kit): Kit => {
    const mintId = createIdMinter("r", highestIdNumber(kit.role.requirements.map((r) => r.id), "r"));
    const maxOrder = kit.role.requirements.reduce((max, r) => Math.max(max, r.order), -1);
    const requirement: Requirement = {
      id: mintId(),
      text: "",
      kind: "technical",
      priority: "nice",
      origin: "manual",
      pinned: false,
      order: maxOrder + 1,
    };
    return { ...kit, role: { ...kit.role, requirements: [...kit.role.requirements, requirement] } };
  };
}

export function editQuestionField(id: string, field: "prompt" | "answer_outline", value: string) {
  return (kit: Kit): Kit => ({
    ...kit,
    questions: kit.questions.map((q) => (q.id === id ? { ...q, [field]: value, origin: markEdited(q.origin) } : q)),
  });
}

export function toggleQuestionPin(id: string) {
  return (kit: Kit): Kit => ({
    ...kit,
    questions: kit.questions.map((q) => (q.id === id ? { ...q, pinned: !q.pinned } : q)),
  });
}

export function deleteQuestion(id: string) {
  return (kit: Kit): Kit => ({
    ...kit,
    questions: kit.questions.filter((q) => q.id !== id),
    schedule: {
      ...kit.schedule,
      days: kit.schedule.days.map((d) => ({ ...d, question_ids: d.question_ids.filter((qid) => qid !== id) })),
    },
  });
}

export function addQuestion(category: Question["category"]) {
  return (kit: Kit): Kit => {
    const mintId = createIdMinter("q", highestIdNumber(kit.questions.map((q) => q.id), "q"));
    const maxOrder = kit.questions.filter((q) => q.category === category).reduce((max, q) => Math.max(max, q.order), -1);
    const question: Question = {
      id: mintId(),
      requirement_ids: [],
      category,
      prompt: "",
      answer_outline: "",
      difficulty: 1,
      origin: "manual",
      pinned: false,
      order: maxOrder + 1,
    };
    return { ...kit, questions: [...kit.questions, question] };
  };
}

export function editFlashcardField(id: string, field: "front" | "back", value: string) {
  return (kit: Kit): Kit => ({
    ...kit,
    flashcards: kit.flashcards.map((f) => (f.id === id ? { ...f, [field]: value, origin: markEdited(f.origin) } : f)),
  });
}

export function toggleFlashcardPin(id: string) {
  return (kit: Kit): Kit => ({
    ...kit,
    flashcards: kit.flashcards.map((f) => (f.id === id ? { ...f, pinned: !f.pinned } : f)),
  });
}

export function deleteFlashcard(id: string) {
  return (kit: Kit): Kit => ({ ...kit, flashcards: kit.flashcards.filter((f) => f.id !== id) });
}

export function addFlashcard() {
  return (kit: Kit): Kit => {
    const mintId = createIdMinter("f", highestIdNumber(kit.flashcards.map((f) => f.id), "f"));
    const maxOrder = kit.flashcards.reduce((max, f) => Math.max(max, f.order), -1);
    const flashcard: Flashcard = { id: mintId(), front: "", back: "", requirement_ids: [], origin: "manual", pinned: false, order: maxOrder + 1 };
    return { ...kit, flashcards: [...kit.flashcards, flashcard] };
  };
}

export function reorderQuestions(updates: { id: string; category: Question["category"]; order: number }[]) {
  return (kit: Kit): Kit => {
    const byId = new Map(updates.map((u) => [u.id, u]));
    return {
      ...kit,
      questions: kit.questions.map((q) => {
        const update = byId.get(q.id);
        return update ? { ...q, category: update.category, order: update.order } : q;
      }),
    };
  };
}
