"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/use-me";
import { AppShell } from "@/components/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: user, isLoading, isError } = useMe();

  useEffect(() => {
    if (isError) {
      router.replace("/?mode=login");
    }
  }, [isError, router]);

  if (isLoading || isError || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground" role="status">
          Loading…
        </p>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
