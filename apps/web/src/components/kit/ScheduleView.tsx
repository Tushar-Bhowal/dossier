import type { Kit, Question } from "@dossier/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ScheduleView({ kit }: { kit: Kit }) {
  const questionsById = new Map(kit.questions.map((q) => [q.id, q]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Schedule ({kit.schedule.days_available} day{kit.schedule.days_available === 1 ? "" : "s"})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {kit.schedule.days.length === 0 ? (
          <p className="text-sm text-muted-foreground">No schedule generated yet.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {kit.schedule.days.map((d) => {
              const resolved = d.question_ids
                .map((qid) => questionsById.get(qid))
                .filter((q): q is Question => q !== undefined);
              return (
                <li key={d.day} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">Day {d.day}</span>
                    <span className="text-xs text-muted-foreground">{d.minutes} min</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{d.focus}</p>
                  {resolved.length > 0 ? (
                    <ul className="mt-2 flex flex-col gap-1">
                      {resolved.map((question) => (
                        <li key={question.id} className="flex items-start gap-2 text-sm">
                          <Badge variant="outline" className="mt-0.5 shrink-0 text-[0.65rem]">
                            {question.category}
                          </Badge>
                          <span className="min-w-0 flex-1 truncate">{question.prompt}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Nothing scheduled today.</p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
