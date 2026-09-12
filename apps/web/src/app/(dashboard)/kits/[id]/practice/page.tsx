"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlashcardDeck } from "@/components/kit/FlashcardDeck";

export default function PracticePage({ params }: PageProps<"/kits/[id]/practice">) {
  const { id } = use(params);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Practice</h1>
        <Button asChild variant="outline" size="sm" className="rounded-lg gap-1.5 h-9 px-3.5 text-muted-foreground hover:text-foreground">
          <Link href={`/kits/${id}`}>
            <ArrowLeft className="size-4" />
            <span>Back to kit</span>
          </Link>
        </Button>
      </div>
      <FlashcardDeck kitId={id} />
    </div>
  );
}
