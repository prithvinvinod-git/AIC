import { formatDistanceToNow, format } from "date-fns";

export function timeAgo(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

export function formatDate(iso: string): string {
  return format(new Date(iso), "MMM d, yyyy");
}

export function formatDateTime(iso: string): string {
  return format(new Date(iso), "MMM d, h:mm a");
}

export function formatDeadline(iso: string): string {
  return format(new Date(iso), "MMM d, h:mm a");
}

/** Colour-coded deadline label ("in 3h", "3h overdue"). */
export function deadlineLabel(deadlineIso: string): { text: string; tone: "ok" | "warn" | "over" } {
  const ms = new Date(deadlineIso).getTime() - Date.now();
  const mins = Math.round(ms / 60000);
  const abs = Math.abs(mins);
  const units =
    abs < 60
      ? `${abs}m`
      : abs < 60 * 24
        ? `${Math.round(abs / 60)}h`
        : `${Math.round(abs / (60 * 24))}d`;

  if (ms < 0) return { text: `${units} overdue`, tone: "over" };
  if (mins < 60 * 4) return { text: `due in ${units}`, tone: "warn" };
  return { text: `due in ${units}`, tone: "ok" };
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
