import type { Role } from "./types";

export type EscalationBand = "principal" | "hod" | "both";

/** Severity → approval band: P1 escalations are decided by the Principal, P2
 *  by the HOD. Unset/unknown priority keeps the legacy "either approver". */
export function escalationBand(priority: number | null | undefined): EscalationBand {
  if (priority === 1) return "principal";
  if (priority === 2) return "hod";
  return "both";
}

/** Roles allowed to approve/reject an ESCALATED issue at this severity.
 *  Case "both" (unset priority / legacy) keeps hod + principal. */
export function escalationApprovers(priority: number | null | undefined): Role[] {
  const band = escalationBand(priority);
  const leaders: Role[] =
    band === "principal" ? ["principal"] : band === "hod" ? ["hod"] : ["hod", "principal"];
  return [...leaders, "admin"];
}

/** True when the given role may approve/reject an ESCALATED issue at this
 *  severity. "admin" is always the override (portal + system paths). */
export function canApproveEscalation(
  role: Role | undefined,
  priority: number | null | undefined
): boolean {
  if (!role || role === "admin") return true;
  const band = escalationBand(priority);
  if (band === "principal") return role === "principal";
  if (band === "hod") return role === "hod";
  return role === "hod" || role === "principal";
}

/** Human label for the band's reviewer, e.g. for notification copy. */
export function escalationReviewerLabel(priority: number | null | undefined): string {
  const band = escalationBand(priority);
  return band === "principal" ? "Principal" : band === "hod" ? "HOD" : "HOD/Principal";
}