import { formatDistanceToNow, format } from "date-fns";
import type { SlaState } from "./types";

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

/** Uppercase the first letter of a string, leaving the rest as typed. */
export function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Title-case a person's name ("john  DOE" → "John Doe"). */
export function capitalizeName(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
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

/** One-liner for "why is this issue late?" — deterministic, client-safe.
 *  Cards show the persisted `sla.explanation` (F8 AI) when present, else this. */
export function slaBreachReason(issue: {
  status: string;
  sla?: SlaState | null;
  requirements?: { needsApproval?: boolean; resolved?: boolean }[];
}): string | null {
  if (!issue.sla?.breachedFlags?.resolution && !issue.sla?.breachedFlags?.response) return null;
  const awaiting = (issue.requirements || []).filter((r) => r.needsApproval && !r.resolved).length;
  if (awaiting > 0) {
    return `Waiting on purchase approval for ${awaiting} material requirement${awaiting === 1 ? "" : "s"}`;
  }
  switch (issue.status) {
    case "PENDING":
      return "Blocked — awaiting parts or permission";
    case "ASSIGNED":
      return "Assigned but the job hasn't started yet";
    case "ONGOING":
      return "Work in progress — past the resolution deadline";
    case "ESCALATED":
    case "APPROVED":
      return "Awaiting leadership approval";
    case "NEW":
    case "VALIDATED":
      return "Not yet processed by a validator";
    case "COMPLETED":
    case "INSPECTED":
    case "VERIFIED":
      return "Resolved — awaiting verification or closure";
    default:
      return "Overdue";
  }
}
