import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileQuestion, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found — Dossier",
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center p-6">
      <div className="flex w-full max-w-lg flex-col items-center rounded-lg border border-dashed border-border/70 bg-card/40 p-8 sm:p-12 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground/60 ring-1 ring-border/50">
          <FileQuestion className="size-7" aria-hidden />
        </div>

        <p className="mb-1.5 font-mono text-xs font-medium tracking-widest text-muted-foreground/70">
          404
        </p>
        <h1 className="mb-1.5 text-xl font-semibold tracking-tight text-foreground">
          This page doesn&apos;t exist
        </h1>
        <p className="mb-6 max-w-md text-sm leading-relaxed text-muted-foreground">
          The link may be out of date, or the kit or run it pointed to may have been deleted. Your
          existing kits are all still in your workspace.
        </p>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Button
            asChild
            className="gap-2 rounded-lg bg-[#FB4128] font-medium text-white hover:bg-[#FB4128]/90"
          >
            <Link href="/kits">
              <ArrowLeft className="size-4" />
              Back to kits
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="gap-2 rounded-lg border-border/80 text-foreground hover:bg-muted"
          >
            <Link href="/">
              <Home className="size-4" />
              Go home
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
