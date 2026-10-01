"use client";

import { use } from "react";
import { ResumeWorkspace } from "@/components/resume/ResumeWorkspace";

export default function ResumePage({ params }: PageProps<"/resumes/[id]">) {
  const { id } = use(params);
  return <ResumeWorkspace id={id} />;
}
