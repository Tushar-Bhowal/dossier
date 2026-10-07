import { Suspense } from "react";
import { ApplicationsHome } from "@/components/applications/ApplicationsHome";

export default function ApplicationsPage() {
  return (
    <Suspense>
      <ApplicationsHome />
    </Suspense>
  );
}
