import type { FieldDescriptor, FieldResult } from "@dossier/core/autofill";
import type { Persona } from "@/lib/demo/scenario";

export interface DemoForm {
  host: string;
  company: string;
  title: string;
  intro: string;
  resumeFile: string;
  fields: (FieldDescriptor & { result: FieldResult; placeholder?: string })[];
}

const ENGINEER: DemoForm = {
  host: "boards.greenhouse.io",
  company: "Razorpay",
  title: "Backend Engineer, Payments",
  intro: "Bengaluru · Full time",
  resumeFile: "Rahul_Verma_Resume.pdf",
  fields: [
    { id: "f1", type: "text", label: "First name", required: true, section: "Your details", result: { id: "f1", kind: "profile", key: "firstName", text: "Rahul" } },
    { id: "f2", type: "text", label: "Last name", required: true, section: "Your details", result: { id: "f2", kind: "profile", key: "lastName", text: "Verma" } },
    { id: "f3", type: "email", label: "Email", required: true, section: "Your details", result: { id: "f3", kind: "profile", key: "email", text: "rahul.verma@example.com" } },
    { id: "f4", type: "tel", label: "Phone", required: true, section: "Your details", result: { id: "f4", kind: "profile", key: "phone", text: "+91 98450 67890" } },
    { id: "f5", type: "file", label: "Resume/CV", required: true, section: "Your details", result: { id: "f5", kind: "file", fileName: "Rahul_Verma_Resume.pdf" } },
    {
      id: "f6",
      type: "textarea",
      label: "Why do you want to work at Razorpay?",
      required: true,
      section: "Questions",
      maxLength: 1500,
      result: {
        id: "f6",
        kind: "answer",
        factIds: ["fe-apis", "fe-latency"],
        text: "I've spent two years building Python APIs for a lending company's loan-processing service, so I've seen first-hand how much a slow or unreliable payment step costs users. Razorpay sits at the centre of that for millions of businesses. I'd like to work on payment APIs where the latency and reliability work I've done, such as taking our loan-status API from 900 ms to 350 ms at p95, matters at a much larger scale.",
      },
    },
    {
      id: "f7",
      type: "textarea",
      label: "Tell us about a time you made a system significantly faster.",
      required: true,
      section: "Questions",
      maxLength: 1500,
      result: {
        id: "f7",
        kind: "answer",
        factIds: ["fe-latency"],
        text: "Our loan-status API was slow: p95 latency was around 900 ms and the app felt sluggish. I added Redis caching for the lookups that repeated on almost every request, and brought p95 down to 350 ms.",
      },
    },
    {
      id: "f8",
      type: "radio",
      label: "Are you legally authorised to work in India?",
      required: true,
      section: "Questions",
      options: ["Yes", "No"],
      result: { id: "f8", kind: "saved", savedAnswerId: "sa-auth", text: "Yes" },
    },
    {
      id: "f9",
      type: "radio",
      label: "Have you worked with Kafka in production?",
      required: false,
      section: "Questions",
      options: ["Yes", "No"],
      result: { id: "f9", kind: "blank", reason: "no_facts" },
    },
    {
      id: "f10",
      type: "select",
      label: "Notice period",
      required: true,
      section: "Questions",
      options: ["Immediate", "15 days", "30 days", "60 days", "90 days"],
      result: { id: "f10", kind: "blank", reason: "fixed_topic", topic: "noticePeriod" },
    },
    {
      id: "f11",
      type: "text",
      label: "Expected annual salary (INR)",
      required: true,
      section: "Questions",
      result: { id: "f11", kind: "blank", reason: "fixed_topic", topic: "salary" },
    },
    {
      id: "f12",
      type: "select",
      label: "Gender (optional)",
      required: false,
      section: "Voluntary self-identification",
      options: ["Woman", "Man", "Non-binary", "Prefer not to say"],
      result: { id: "f12", kind: "blank", reason: "fixed_topic", topic: "eeoGender" },
    },
  ],
};

const TEACHER: DemoForm = {
  host: "careers.dps-school.example",
  company: "Delhi Public School",
  title: "Mathematics Teacher (TGT)",
  intro: "New Delhi · Full time",
  resumeFile: "Ananya_Sen_Resume.pdf",
  fields: [
    { id: "f1", type: "text", label: "Full name", required: true, section: "Personal details", result: { id: "f1", kind: "profile", key: "fullName", text: "Ananya Sen" } },
    { id: "f2", type: "email", label: "Email address", required: true, section: "Personal details", result: { id: "f2", kind: "profile", key: "email", text: "ananya.sen@example.com" } },
    { id: "f3", type: "tel", label: "Mobile number", required: true, section: "Personal details", result: { id: "f3", kind: "profile", key: "phone", text: "+91 98300 12345" } },
    { id: "f4", type: "text", label: "Highest qualification", required: true, section: "Qualifications", result: { id: "f4", kind: "profile", key: "degree", text: "B.Ed, University of Calcutta (2022)" } },
    { id: "f5", type: "file", label: "Upload CV", required: true, section: "Qualifications", result: { id: "f5", kind: "file", fileName: "Ananya_Sen_Resume.pdf" } },
    {
      id: "f6",
      type: "radio",
      label: "Have you qualified CTET?",
      required: true,
      section: "Qualifications",
      options: ["Yes", "No", "Appearing"],
      result: { id: "f6", kind: "blank", reason: "no_facts" },
    },
    {
      id: "f7",
      type: "textarea",
      label: "Describe your approach to teaching Mathematics to middle-school students.",
      required: true,
      section: "About your teaching",
      maxLength: 1200,
      result: {
        id: "f7",
        kind: "answer",
        factIds: ["ft-teach"],
        text: "I teach Mathematics and Science to classes 6 to 8, and I start every topic from something the children already know before moving to the method. I use Google Classroom for practice and assignments so students can work at their own pace and I can see who needs help.",
      },
    },
    {
      id: "f8",
      type: "textarea",
      label: "Why do you want to join Delhi Public School?",
      required: true,
      section: "About your teaching",
      maxLength: 1200,
      result: { id: "f8", kind: "blank", reason: "grounding_failed" },
    },
    {
      id: "f9",
      type: "select",
      label: "Notice period at current school",
      required: true,
      section: "Other details",
      options: ["Immediate", "1 month", "2 months", "3 months"],
      result: { id: "f9", kind: "saved", savedAnswerId: "sa-notice", text: "1 month" },
    },
    {
      id: "f10",
      type: "text",
      label: "Expected monthly salary",
      required: true,
      section: "Other details",
      result: { id: "f10", kind: "blank", reason: "fixed_topic", topic: "salary" },
    },
    {
      id: "f11",
      type: "radio",
      label: "Are you willing to relocate to Delhi?",
      required: true,
      section: "Other details",
      options: ["Yes", "No"],
      result: { id: "f11", kind: "blank", reason: "fixed_topic", topic: "relocation" },
    },
  ],
};

export function formFor(persona: Persona): DemoForm {
  return persona === "engineer" ? ENGINEER : TEACHER;
}
