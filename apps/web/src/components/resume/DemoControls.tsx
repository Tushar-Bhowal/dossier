"use client";

import { DemoControls as Controls } from "@/components/demo/DemoControls";
import { resumeKeys } from "@/lib/resume/api";
import { resumeScenario } from "@/lib/resume/demo/scenario";

export function DemoControls() {
  return <Controls store={resumeScenario} queryKey={resumeKeys.all} />;
}
