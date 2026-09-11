import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { RunRecord } from "@/lib/api";

export function FailureState({
  run,
  onResume,
  resuming,
}: {
  run: RunRecord;
  onResume: () => void;
  resuming: boolean;
}) {
  const failedStep = run.steps.find((s) => s.status === "failed");

  return (
    <Alert variant="destructive">
      <AlertTitle>Generation failed</AlertTitle>
      <AlertDescription>
        <p>
          {failedStep
            ? `"${failedStep.name}" failed${failedStep.error ? `: ${failedStep.error}` : "."}`
            : "The run didn't complete."}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={onResume}
          disabled={resuming}
        >
          {resuming ? "Resuming…" : "Resume run"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
