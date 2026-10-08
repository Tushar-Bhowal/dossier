import * as React from "react";
import { FlaskConical } from "lucide-react";
import { ACCOUNT_SAMPLE } from "@/lib/account/api";
import { cn } from "@/lib/utils";

export function SettingsSection({
  id,
  title,
  description,
  sample = false,
  children,
}: {
  id: string;
  title: string;
  description: React.ReactNode;
  sample?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-6">
      <div>
        <h2 id={`${id}-heading`} className="text-xl font-semibold tracking-[-0.02em] text-white">
          {title}
        </h2>
        <p className="mt-1.5 max-w-[60ch] text-[15px] leading-relaxed text-white/60">{description}</p>
      </div>
      {sample && ACCOUNT_SAMPLE && (
        <p className="flex items-start gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-medium leading-relaxed text-white/70">
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-white/60" aria-hidden />
          <span>
            <span className="font-semibold text-white">Sample data.</span> This part isn&apos;t connected yet, so nothing
            you enter here is saved or sent anywhere.
          </span>
        </p>
      )}
      {children}
    </section>
  );
}

export function Panel({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-lg border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6", className)} {...props} />;
}
