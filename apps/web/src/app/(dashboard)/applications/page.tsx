import { Suspense } from "react";
import { ApplicationsHome } from "@/components/applications/ApplicationsHome";
import { DemoControls } from "@/components/demo/DemoControls";
import { referralKeys } from "@/lib/referral/api";
import { referralScenario } from "@/lib/referral/demo/scenario";

export default function ApplicationsPage() {
  return (
    <Suspense>
      <ApplicationsHome />
      <DemoControls store={referralScenario} queryKey={referralKeys.all} />
    </Suspense>
  );
}
