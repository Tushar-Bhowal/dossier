"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import { logout } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user, isLoading, isError } = useMe();

  useEffect(() => {
    if (isError) {
      router.replace("/login");
    }
  }, [isError, router]);

  async function onSignOut() {
    await logout();
    queryClient.setQueryData(["me"], undefined);
    router.push("/login");
  }

  if (isLoading || isError || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground" role="status">
          Loading…
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/kits" className="font-semibold tracking-tight">
            Dossier
          </Link>
          <nav className="flex items-center gap-3">
            <Link href="/kits" className="text-sm text-muted-foreground hover:text-foreground">
              Kits
            </Link>
            <Link href="/kits/new" className="text-sm text-muted-foreground hover:text-foreground">
              New kit
            </Link>
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            <Button variant="outline" size="sm" onClick={onSignOut}>
              Sign out
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
