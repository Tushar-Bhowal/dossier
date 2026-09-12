"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getKit } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { KitBuilder } from "@/components/kit/KitBuilder";

export default function KitPage({ params }: PageProps<"/kits/[id]">) {
  const { id } = use(params);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["kit", id],
    queryFn: () => getKit(id),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded-lg" />
          <Skeleton className="h-4 w-44 rounded-lg" />
        </div>
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Couldn&apos;t load this kit</CardTitle>
          <CardDescription>It may not exist, or it isn&apos;t yours.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="rounded-lg gap-2">
            <Link href="/kits">
              <ArrowLeft className="size-4" />
              <span>Back to kits</span>
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Keyed by id so navigating between kits mounts a fresh editor rather than reusing state from
  // the previous one; from here on the editor owns its own local kit/version state.
  return <KitBuilder key={id} id={id} initial={{ kit: data.kit, version: data.version }} />;
}
