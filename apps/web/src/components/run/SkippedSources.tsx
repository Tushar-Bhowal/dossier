import type { SourceSkipped } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// The port's reasons are machine codes; printing them raw told users things like "blocked-host"
// about their own company URL, which reads as a security block rather than a dead domain.
const REASON_LABELS: Record<string, string> = {
  "unresolvable-host": "this domain could not be found",
  "blocked-host": "blocked — resolves to a private or internal address",
  "disallowed-scheme": "unsupported link type (only http and https are fetched)",
  "robots-disallowed": "the site's robots.txt asks crawlers not to fetch this",
  "unsupported-content-type": "not a readable web page",
  "too-large": "the page was too large to read",
  timeout: "the site took too long to respond",
  "http-error": "the site returned an error",
  "network-error": "could not connect to the site",
  "invalid-url": "not a valid URL",
};

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
              <span className="text-muted-foreground"> — {REASON_LABELS[s.reason] ?? s.reason}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
