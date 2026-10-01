"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, GraduationCap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getKit } from "@/lib/api";
import { FlashcardDeck } from "@/components/kit/FlashcardDeck";

export default function PracticePage({ params }: PageProps<"/kits/[id]/practice">) {
  const { id } = use(params);

  const { data: kitSummary } = useQuery({
    queryKey: ["kit", id],
    queryFn: () => getKit(id),
  });

  const kit = kitSummary?.kit;
  const roleTitle = kit?.role.title || "Interview Kit";
  const company = kit?.source.company;

  return (
    <div className="mx-auto flex w-full flex-col gap-6 pb-12">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <Link
            href={`/kits/${id}`}
            className="-ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-white/60 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Back to kit
          </Link>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-white sm:text-[32px]">
            Practice
          </h1>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[15px] text-white/60">
            {company && (
              <>
                <Building2 className="size-4 shrink-0 text-[#ff7a5c]" />
                <span className="shrink-0 font-semibold text-white/85">{company}</span>
                <span aria-hidden>·</span>
              </>
            )}
            <span className="truncate">{roleTitle}</span>
          </p>
        </div>
        <span className="inline-flex h-8 items-center gap-2 self-start rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[13px] font-semibold text-white/75 sm:self-auto">
          <GraduationCap className="size-4 text-[#ff7a5c]" />
          Spaced repetition
        </span>
      </div>

      <FlashcardDeck kitId={id} />
    </div>
  );
}
