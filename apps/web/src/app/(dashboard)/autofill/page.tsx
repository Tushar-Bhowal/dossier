import { AutofillPreview } from "@/components/autofill/AutofillPreview";
import { DemoControls } from "@/components/demo/DemoControls";
import { autofillScenario } from "@/lib/autofill/demo/scenario";

export default function AutofillPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.035em] text-white">Autofill job applications</h1>
          <span className="inline-flex h-7 items-center rounded-lg bg-white/[0.06] px-2.5 text-[13px] font-semibold text-white/70">Extension coming soon</span>
        </div>
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-white/60">
          A Chrome extension that fills application forms on any site from your Dossier profile, writes the long answers only from facts you
          confirmed, and leaves the rest for you. It never submits. Try it on the sample form below.
        </p>
      </div>
      <AutofillPreview />
      <DemoControls store={autofillScenario} queryKey={["autofill"]} />
    </div>
  );
}
