import { DemoControls } from "@/components/resume/DemoControls";

export default function ResumesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <DemoControls />
    </>
  );
}
