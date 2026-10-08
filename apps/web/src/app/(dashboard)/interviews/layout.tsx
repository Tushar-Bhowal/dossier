import { DemoControls } from "@/components/demo/DemoControls";
import { interviewKeys } from "@/lib/interview/api";
import { interviewScenario } from "@/lib/interview/demo/scenario";

export default function InterviewsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <DemoControls store={interviewScenario} queryKey={interviewKeys.all} />
    </>
  );
}
