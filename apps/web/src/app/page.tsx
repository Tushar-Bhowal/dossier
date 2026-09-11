import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <h1 className="max-w-xl text-4xl font-semibold tracking-tight">Dossier</h1>
      <p className="max-w-md text-muted-foreground">
        Paste a job description and a company URL. Dossier researches the company and builds a
        structured, editable interview prep kit — questions, flashcards, and a day-by-day schedule.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/register">Get started</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}
