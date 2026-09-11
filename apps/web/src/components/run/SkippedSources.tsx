import type { SourceSkipped } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function SkippedSources({ sources }: { sources: SourceSkipped[] }) {
  if (sources.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sources skipped</CardTitle>
        <CardDescription>
          These didn&apos;t come through — normal, and doesn&apos;t stop the kit.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {sources.map((s, i) => (
            <li key={`${s.url}-${i}`} className="text-sm">
              <span className="break-all text-muted-foreground">{s.url}</span>
              <span className="text-muted-foreground"> — {s.reason}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
