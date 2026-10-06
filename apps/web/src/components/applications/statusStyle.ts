import { CLOSED_STATUSES, type Application, type ApplicationStatus } from "@dossier/core/applications";

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  online_test: "Online test",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  no_reply: "No reply",
};

// Text colour + a 10% tint of it, like the page-count chips. Status is always also written out.
export const STATUS_TONE: Record<ApplicationStatus, { text: string; tint: string; dot: string }> = {
  saved: { text: "text-white/70", tint: "bg-white/[0.06]", dot: "bg-white/50" },
  applied: { text: "text-sky-300", tint: "bg-sky-400/10", dot: "bg-sky-400" },
  online_test: { text: "text-violet-300", tint: "bg-violet-400/10", dot: "bg-violet-400" },
  interviewing: { text: "text-amber-300", tint: "bg-amber-400/10", dot: "bg-amber-400" },
  offer: { text: "text-emerald-400", tint: "bg-emerald-400/10", dot: "bg-emerald-400" },
  rejected: { text: "text-white/55", tint: "bg-white/[0.05]", dot: "bg-white/35" },
  withdrawn: { text: "text-white/55", tint: "bg-white/[0.05]", dot: "bg-white/35" },
  no_reply: { text: "text-white/55", tint: "bg-white/[0.05]", dot: "bg-white/35" },
};

export type BoardColumnId = "saved" | "applied" | "online_test" | "interviewing" | "offer" | "closed";

export const BOARD_COLUMNS: { id: BoardColumnId; label: string; empty: string }[] = [
  { id: "saved", label: "Saved", empty: "Jobs you plan to apply to" },
  { id: "applied", label: "Applied", empty: "Waiting to hear back" },
  { id: "online_test", label: "Online test", empty: "Assessments and take-homes" },
  { id: "interviewing", label: "Interviewing", empty: "Rounds in progress" },
  { id: "offer", label: "Offer", empty: "The good news goes here" },
  { id: "closed", label: "Closed", empty: "Rejected, withdrawn or no reply" },
];

export function columnOf(status: ApplicationStatus): BoardColumnId {
  return (CLOSED_STATUSES as readonly ApplicationStatus[]).includes(status) ? "closed" : (status as BoardColumnId);
}

export function statusText(app: Pick<Application, "status" | "round">): string {
  return app.status === "interviewing" && app.round ? `Interviewing · round ${app.round}` : STATUS_LABEL[app.status];
}

export function relativeDays(localDate: string, today: string): string {
  const days = Math.round((Date.parse(today) - Date.parse(localDate)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(localDate).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
