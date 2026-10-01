"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import { TailorFlow } from "@/components/resume/tailor/TailorFlow";

function Tailor({ id }: { id: string }) {
  const params = useSearchParams();
  const kitId = params?.get("kitId");
  const kit = kitId ? { id: kitId, role: params?.get("role") ?? "", company: params?.get("company") ?? "" } : null;
  return <TailorFlow key={id} resumeId={id} kit={kit} />;
}

export default function TailorPage({ params }: PageProps<"/resumes/[id]/tailor">) {
  const { id } = use(params);
  return (
    <Suspense>
      <Tailor id={id} />
    </Suspense>
  );
}
