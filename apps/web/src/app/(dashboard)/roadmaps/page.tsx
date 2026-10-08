"use client";

import { Suspense } from "react";
import { RoadmapsHome } from "@/components/roadmap/RoadmapsHome";

export default function RoadmapsPage() {
  return (
    <Suspense>
      <RoadmapsHome />
    </Suspense>
  );
}
