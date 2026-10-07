"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/use-me";
import { AppShell } from "@/components/app-shell";
import { takeReturnTo } from "@/lib/returnTo";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: user, isLoading, isError } = useMe();

  useEffect(() => {
    if (isError) {
      router.replace("/login");
    }
  }, [isError, router]);

  // Back to the AI-assistant consent screen that sent the user to sign in.
  useEffect(() => {
    if (!user) return;
    const returnTo = takeReturnTo();
    if (returnTo) router.replace(returnTo);
  }, [user, router]);

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
