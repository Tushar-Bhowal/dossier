"use client";

import { use } from "react";
import { TopicView } from "@/components/roadmap/TopicView";

export default function TopicPage({ params }: PageProps<"/roadmaps/[id]/topics/[topicId]">) {
  const { id, topicId } = use(params);
  return <TopicView roadmapId={id} topicId={topicId} />;
}
