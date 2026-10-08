"use client";

import { Suspense } from "react";
import { NewInterview } from "@/components/interview/NewInterview";

export default function NewInterviewPage() {
  return (
    <Suspense>
      <NewInterview />
    </Suspense>
  );
}
