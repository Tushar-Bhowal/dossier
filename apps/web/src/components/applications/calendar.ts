import { interviewEnds, type Application, type Interview } from "@dossier/core/applications";

// 20261008T093000Z — the UTC form both Google Calendar links and .ics files use.
function utcStamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function title(app: Pick<Application, "company" | "role">, interview: Interview): string {
  return `Interview: ${app.company} · ${app.role}${interview.round ? ` (round ${interview.round})` : ""}`;
}

function details(interview: Interview): string {
  return [interview.meetingUrl && `Join: ${interview.meetingUrl}`, interview.notes].filter(Boolean).join("\n\n");
}

// Opens Google Calendar with the event filled in; the user presses Save. No Google permission needed.
export function googleCalendarUrl(app: Pick<Application, "company" | "role">, interview: Interview): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title(app, interview),
    dates: `${utcStamp(Date.parse(interview.startsAt))}/${utcStamp(interviewEnds(interview))}`,
    details: details(interview),
  });
  if (interview.meetingUrl) params.set("location", interview.meetingUrl);
  return `https://calendar.google.com/calendar/render?${params}`;
}

function icsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// A one-event calendar file for Apple Calendar, Outlook and anything else that opens .ics.
export function downloadIcs(app: Pick<Application, "company" | "role">, interview: Interview): void {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dossier//Interviews//EN",
    "BEGIN:VEVENT",
    `UID:${interview.id}@dossier`,
    `DTSTAMP:${utcStamp(Date.now())}`,
    `DTSTART:${utcStamp(Date.parse(interview.startsAt))}`,
    `DTEND:${utcStamp(interviewEnds(interview))}`,
    `SUMMARY:${icsText(title(app, interview))}`,
    details(interview) && `DESCRIPTION:${icsText(details(interview))}`,
    interview.meetingUrl && `URL:${interview.meetingUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `${app.company} interview.ics` });
  a.click();
  URL.revokeObjectURL(url);
}

// "Today 3:00 pm", "Tomorrow 11:30 am", "Thu 8 Oct, 3:00 pm"
export function interviewWhen(startsAt: string, now: Date): string {
  const start = new Date(startsAt);
  const time = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const dayDiff = Math.round(
    (new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000,
  );
  if (dayDiff === 0) return `Today ${time}`;
  if (dayDiff === 1) return `Tomorrow ${time}`;
  return `${start.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}, ${time}`;
}
