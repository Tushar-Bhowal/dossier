export function nextUtcMidnight(from = new Date()): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + 1));
}

// "5:30 AM" in the viewer's own time zone; daily limits reset at midnight UTC.
export function formatResetTime(resetsAt: Date | string = nextUtcMidnight()): string {
  return new Date(resetsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
