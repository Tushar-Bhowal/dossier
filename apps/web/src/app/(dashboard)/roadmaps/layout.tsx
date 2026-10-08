import { DemoControls } from "@/components/demo/DemoControls";
import { roadmapKeys } from "@/lib/roadmap/api";
import { roadmapScenario } from "@/lib/roadmap/demo/scenario";

export default function RoadmapsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <DemoControls store={roadmapScenario} queryKey={roadmapKeys.all} />
    </>
  );
}
