"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listKits } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function KitsPage() {
  const { data: kits, isLoading, isError } = useQuery({
    queryKey: ["kits"],
    queryFn: listKits,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your kits</h1>
          <p className="text-sm text-muted-foreground">Everything you&apos;ve generated so far.</p>
        </div>
        <Button asChild>
          <Link href="/kits/new">New kit</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load your kits. Try refreshing.</p>
      ) : kits && kits.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {kits.map((k) => (
            <Link key={k.id} href={`/kits/${k.id}`}>
              <Card className="h-full transition-colors hover:border-ring">
                <CardHeader>
                  <CardTitle className="line-clamp-1">{k.kit.role.title || "Untitled role"}</CardTitle>
                  <CardDescription className="line-clamp-1">
                    {k.kit.source.company || "Unknown company"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {k.kit.questions.length} questions · {k.kit.flashcards.length} flashcards
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No kits yet</CardTitle>
            <CardDescription>
              Paste a job description and a company URL to generate your first interview prep kit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/kits/new">Create your first kit</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
