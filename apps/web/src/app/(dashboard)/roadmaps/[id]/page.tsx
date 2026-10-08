"use client";

import { use } from "react";
import { RoadmapView } from "@/components/roadmap/RoadmapView";

export default function RoadmapPage({ params }: PageProps<"/roadmaps/[id]">) {
  const { id } = use(params);
  return <RoadmapView id={id} />;
}
