"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, GraduationCap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getKit } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    <div className="flex flex-col gap-6 w-full mx-auto pb-12">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="rounded gap-1.5 h-8 px-3 text-muted-foreground hover:text-foreground border-border/80 hover:bg-accent transition-colors"
          >
            <Link href={`/kits/${id}`}>
              <ArrowLeft className="size-3.5" />
              <span>Back to kit</span>
            </Link>
          </Button>

          <div className="h-4 w-[1px] bg-border/60 hidden sm:block" />

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {company && (
              <span className="flex items-center gap-1 font-medium text-foreground/80">
                <Building2 className="size-3 text-[#FB4128]" />
                {company}
              </span>
            )}
            {company && <span>·</span>}
            <span className="truncate max-w-[200px] sm:max-w-[300px]">{roleTitle}</span>
          </div>
        </div>

        <Badge variant="outline" className="text-xs font-normal rounded gap-1.5 self-start sm:self-auto border-border/60">
          <span className="size-1.5 rounded-full bg-[#FB4128]" />
          Leitner Spaced Repetition
        </Badge>
      </div>

      {/* Main Flashcard Practice Surface */}
      <FlashcardDeck kitId={id} />
    </div>
  );
}
