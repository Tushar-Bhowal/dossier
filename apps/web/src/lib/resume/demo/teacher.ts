import type { PersonaFixture } from "./types";

const JOB = "e-t-job";
const BED = "e-t-bed";
const BSC = "e-t-bsc";

const DUTIES = [
  "Lesson planning",
  "Preparing and checking exam papers",
  "Maintaining report cards and records",
  "Parent–teacher meetings",
  "Class teacher responsibilities",
  "Organising school events",
  "Smart class / digital teaching",
  "Remedial classes for weaker students",
  "Exam invigilation duty",
  "Mentoring new teachers",
];

export const teacher: PersonaFixture = {
  persona: "teacher",
  region: "IN",
  contact: {
    name: "Ananya Sen",
    email: "ananya.sen@example.com",
    phone: "+91 98300 12345",
    location: "Kolkata, West Bengal",
    links: [],
  },
  describeText:
    "আমি St. Mary's School, Kolkata-তে June 2023 থেকে Maths আর Science পড়াই, class 6 থেকে 8। B.Ed করেছি University of Calcutta থেকে 2022-এ, আর B.Sc Mathematics 2020-এ। Computer-এ MS Word, Excel, PowerPoint আর Google Classroom জানি। বাংলা, English আর Hindi বলতে পারি।",
  importText: [
    "ANANYA SEN",
    "ananya.sen@example.com | +91 98300 12345 | Kolkata",
    "EXPERIENCE",
    "Mathematics & Science Teacher, St. Mary's School, Kolkata   June 2023 – Present",
    "Teaching Maths and Science to classes 6 to 8.",
    "EDUCATION",
    "B.Ed, University of Calcutta, 2022",
    "B.Sc. Mathematics, University of Calcutta, 2020",
    "SKILLS",
    "MS Word, MS Excel, MS PowerPoint, Google Classroom",
  ].join("\n"),
  parse: {
    detectedLanguage: "Bengali + English",
    canonicalRole: "School Teacher",
    entries: [
      {
        id: JOB,
        kind: "job",
        title: "Mathematics & Science Teacher",
        org: "St. Mary's School",
        place: "Kolkata",
        start: "2023-06",
        current: true,
      },
      { id: BED, kind: "education", title: "B.Ed", org: "University of Calcutta", end: "2022", current: false },
      {
        id: BSC,
        kind: "education",
        title: "B.Sc. in Mathematics",
        org: "University of Calcutta",
        end: "2020",
        current: false,
      },
    ],
    facts: [
      {
        id: "ft-teach",
        entryId: JOB,
        text: "Teaches Mathematics and Science to classes 6 to 8",
        originalText: "Maths আর Science পড়াই, class 6 থেকে 8",
        source: "describe",
      },
      {
        id: "ft-bed",
        entryId: BED,
        text: "Completed a B.Ed at the University of Calcutta in 2022",
        originalText: "B.Ed করেছি University of Calcutta থেকে 2022-এ",
        source: "describe",
      },
      {
        id: "ft-bsc",
        entryId: BSC,
        text: "Completed a B.Sc. in Mathematics in 2020",
        originalText: "B.Sc Mathematics 2020-এ",
        source: "describe",
      },
      {
        id: "ft-computer",
        entryId: null,
        text: "Uses MS Word, Excel, PowerPoint and Google Classroom",
        originalText: "Computer-এ MS Word, Excel, PowerPoint আর Google Classroom জানি",
        source: "describe",
      },
    ],
    skills: [
      { name: "MS Word", source: "fact" },
      { name: "MS Excel", source: "fact" },
      { name: "MS PowerPoint", source: "fact" },
      { name: "Google Classroom", source: "fact" },
    ],
    languages: ["Bengali", "English", "Hindi"],
    rolePack: {
      role: "School Teacher",
      region: "IN",
      duties: DUTIES,
      skills: ["Classroom management", "Lesson planning", "MS Office", "Google Classroom", "Smart board"],
      certifications: ["CTET", "WB-TET", "B.Ed"],
      questions: [
        { id: "q-board", text: "Which board does your school follow?", examples: ["CBSE", "ICSE", "State board"] },
        { id: "q-students", text: "About how many students do you teach in total?", examples: ["Under 50", "50–100", "100–200", "200+"] },
        { id: "q-results", text: "Did your students' results improve? Any number you remember?", examples: ["Pass rate went up", "Class toppers", "Not sure"] },
        { id: "q-tet", text: "Have you cleared a teacher eligibility test?", examples: ["CTET", "WB-TET", "Not yet"] },
        { id: "q-beyond", text: "Anything you did beyond teaching?", examples: ["Science fair", "Annual function", "Sports day"] },
      ],
      photoCommon: true,
      photoNote: "Schools in India often ask for a photo on the resume.",
    },
    questions: [
      { id: "q-board", text: "Which board does your school follow?", examples: ["CBSE", "ICSE", "State board"], entryId: JOB },
      { id: "q-students", text: "About how many students do you teach in total?", examples: ["Under 50", "50–100", "100–200", "200+"], entryId: JOB },
      { id: "q-results", text: "Did your students' results improve? Any number you remember?", examples: ["Pass rate went up", "Class toppers", "Not sure"], entryId: JOB },
      { id: "q-tet", text: "Have you cleared a teacher eligibility test?", examples: ["CTET", "WB-TET", "Not yet"], entryId: null },
      { id: "q-beyond", text: "Anything you did beyond teaching?", examples: ["Science fair", "Annual function", "Sports day"], entryId: JOB },
    ],
    suggestedDuties: DUTIES.slice(0, 8).map((text) => ({ text, entryId: JOB })),
  },
  answerToFact: {
    "q-board": (a) => ({ text: `Teaches under the ${a} curriculum` }),
    "q-students": (a) =>
      /^under\s*(\d+)/i.test(a)
        ? { text: `Teaches fewer than ${a.replace(/\D+/g, "")} students across classes 6 to 8` }
        : { text: `Teaches about ${a.replace(/\+$/, " or more")} students across classes 6 to 8` },
    "q-results": (a) =>
      /not sure/i.test(a)
        ? null
        : { text: a === "Pass rate went up" ? "Students' pass rate went up" : a === "Class toppers" ? "Taught students who topped their class" : a },
    "q-tet": (a) =>
      /not yet|no\b/i.test(a)
        ? null
        : {
            text: `Qualified ${a}`,
            entry: { id: `e-t-cert-${a.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, kind: "certification", title: a, current: false },
          },
    "q-beyond": (a) => ({ text: `Helped organise the school ${a}` }),
  },
  sampleAnswers: {
    "q-board": "CBSE",
    "q-students": "120",
    "q-results": "Class 8 maths pass rate went from 78% to 92% in one year",
    "q-tet": "CTET",
    "q-beyond": "Science fair",
  },
  sampleDuties: [
    "Lesson planning",
    "Preparing and checking exam papers",
    "Maintaining report cards and records",
    "Parent–teacher meetings",
    "Smart class / digital teaching",
  ],
  factBullets: {
    "ft-teach": "Teach Mathematics and Science to classes 6–8",
  },
  dutyBullets: {
    "Lesson planning": "Plan lessons for each assigned class",
    "Preparing and checking exam papers": "Prepare and evaluate exam papers",
    "Maintaining report cards and records": "Maintain report cards and student records",
    "Parent–teacher meetings": "Conduct parent–teacher meetings",
    "Class teacher responsibilities": "Serve as class teacher",
    "Organising school events": "Help organise school events",
    "Smart class / digital teaching": "Use smart-class tools for digital teaching",
    "Remedial classes for weaker students": "Run remedial classes for students who need extra support",
    "Exam invigilation duty": "Handle exam invigilation duty",
    "Mentoring new teachers": "Mentor newly joined teachers",
  },
  summary: {
    text: "Mathematics and Science teacher at St. Mary's School, Kolkata, teaching classes 6 to 8. B.Ed from the University of Calcutta. Comfortable with MS Office and Google Classroom.",
    factIds: ["ft-teach", "ft-bed", "ft-computer"],
  },
  resumeTitle: "Teaching resume",
  tailoring: {
    target: {
      company: "Delhi Public School, Kolkata",
      role: "TGT Mathematics",
      jdText:
        "Delhi Public School, Kolkata is hiring a Trained Graduate Teacher (TGT) in Mathematics for classes 6 to 10. Requirements: B.Ed is mandatory. Graduation in Mathematics. CTET qualified candidates preferred. At least 2 years of teaching experience in a CBSE school. Comfortable using smart boards and Google Classroom. Good communication with students and parents. Experience preparing students for board exams is a plus.",
    },
    requirements: [
      { id: "r1", text: "B.Ed degree", kind: "domain", priority: "must", origin: "generated", pinned: false, order: 0 },
      { id: "r2", text: "Graduation in Mathematics", kind: "domain", priority: "must", origin: "generated", pinned: false, order: 1 },
      { id: "r3", text: "2+ years teaching in a CBSE school", kind: "domain", priority: "must", origin: "generated", pinned: false, order: 2 },
      { id: "r4", text: "CTET qualified", kind: "domain", priority: "nice", origin: "generated", pinned: false, order: 3 },
      { id: "r5", text: "Smart boards and Google Classroom", kind: "technical", priority: "must", origin: "generated", pinned: false, order: 4 },
      { id: "r6", text: "Communication with students and parents", kind: "behavioural", priority: "must", origin: "generated", pinned: false, order: 5 },
      { id: "r7", text: "Preparing students for board exams", kind: "domain", priority: "nice", origin: "generated", pinned: false, order: 6 },
    ],
    terms: [
      { term: "B.Ed", requirementId: "r1", priority: "must" },
      { term: "Mathematics", requirementId: "r2", priority: "must" },
      { term: "CBSE", requirementId: "r3", priority: "must" },
      { term: "CTET", requirementId: "r4", priority: "nice" },
      { term: "Smart board", requirementId: "r5", priority: "must" },
      { term: "Google Classroom", requirementId: "r5", priority: "must" },
      { term: "Parent", requirementId: "r6", priority: "must" },
      { term: "Board exams", requirementId: "r7", priority: "nice" },
    ],
    verdicts: [
      { requirementId: "r1", verdict: "covered", evidence: [{ quote: "B.Ed, University of Calcutta", factId: "ft-bed" }] },
      { requirementId: "r2", verdict: "covered", evidence: [{ quote: "B.Sc. in Mathematics", factId: "ft-bsc" }] },
      {
        requirementId: "r3",
        verdict: "partial",
        evidence: [{ quote: "Teach Mathematics and Science to classes 6–8", bulletId: "b-ft-teach" }],
        note: "Your resume shows teaching since June 2023 but doesn't name the board.",
      },
      { requirementId: "r4", verdict: "missing", evidence: [] },
      {
        requirementId: "r5",
        verdict: "partial",
        evidence: [{ quote: "Uses MS Word, Excel, PowerPoint and Google Classroom", factId: "ft-computer" }],
        note: "Google Classroom is in your facts but not in a resume line; smart boards aren't mentioned.",
      },
      { requirementId: "r6", verdict: "missing", evidence: [] },
      { requirementId: "r7", verdict: "missing", evidence: [] },
    ],
    proposals: [
      {
        id: "tp-1",
        requirementIds: ["r2", "r5"],
        change: {
          op: "replace",
          bulletId: "b-ft-teach",
          text: "Teach Mathematics and Science to classes 6–8, using Google Classroom for assignments",
          factIds: ["ft-teach", "ft-computer"],
        },
        before: "Teach Mathematics and Science to classes 6–8",
      },
    ],
    questions: [
      { id: "tg-board", requirementId: "r3", text: "The job asks for CBSE experience. Which board does your school follow?", examples: ["CBSE", "ICSE", "State board"] },
      { id: "tg-ctet", requirementId: "r4", text: "Have you cleared CTET?", examples: ["Yes, CTET 2023", "Not yet"] },
      { id: "tg-parents", requirementId: "r6", text: "Do you speak with parents as part of your work? How?", examples: ["Parent–teacher meetings", "Weekly updates on WhatsApp", "Not really"] },
    ],
    gapEntryId: JOB,
  },
  market: {
    status: "ready",
    role: "School Teacher",
    region: "IN",
    postingCount: 20,
    fetchedAt: "2026-09-28T09:00:00.000Z",
    terms: [
      { term: "B.Ed", count: 19, kind: "domain", sampleUrls: ["https://example.com/jobs/teacher-1"] },
      { term: "Lesson planning", count: 13, kind: "domain", sampleUrls: ["https://example.com/jobs/teacher-2"] },
      { term: "CTET", count: 14, kind: "domain", sampleUrls: ["https://example.com/jobs/teacher-3"] },
      { term: "CBSE", count: 12, kind: "domain", sampleUrls: ["https://example.com/jobs/teacher-4"] },
      { term: "Classroom management", count: 11, kind: "behavioural", sampleUrls: ["https://example.com/jobs/teacher-5"] },
      { term: "MS Office", count: 10, kind: "technical", sampleUrls: ["https://example.com/jobs/teacher-6"] },
      { term: "Smart board", count: 9, kind: "technical", sampleUrls: ["https://example.com/jobs/teacher-7"] },
      { term: "Google Classroom", count: 7, kind: "technical", sampleUrls: ["https://example.com/jobs/teacher-8"] },
    ],
  },
};
