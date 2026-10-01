"use client";

import { Suspense } from "react";
import { ResumesHome } from "@/components/resume/ResumesHome";

export default function ResumesPage() {
  return (
    <Suspense>
      <ResumesHome />
    </Suspense>
  );
}
