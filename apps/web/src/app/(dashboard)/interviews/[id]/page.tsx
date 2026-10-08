"use client";

import { use } from "react";
import { InterviewView } from "@/components/interview/InterviewView";

export default function InterviewPage({ params }: PageProps<"/interviews/[id]">) {
  const { id } = use(params);
  return <InterviewView id={id} />;
}
