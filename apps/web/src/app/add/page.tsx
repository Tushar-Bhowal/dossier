import type { Metadata } from "next";
import { Suspense } from "react";
import { AddJob } from "@/components/bookmark/AddJob";
import { DemoControls } from "@/components/demo/DemoControls";
import { bookmarkScenario } from "@/lib/bookmark/scenario";

export const metadata: Metadata = { title: "Add to Dossier" };

export default function AddPage() {
  return (
    <Suspense>
      <AddJob />
      <DemoControls store={bookmarkScenario} queryKey={["bookmark"]} />
    </Suspense>
  );
}
