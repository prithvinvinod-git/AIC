import type { IssueStatus } from "@/lib/types";
import { PRIORITY_COLOR, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/constants";

const STATUS_TONE: Record<IssueStatus, string> = {
  NEW: "bg-accent-soft text-accent",
  VALIDATED: "bg-accent-soft text-accent",
  ESCALATED: "bg-warning-soft text-warning",
  APPROVED: "bg-accent-soft text-accent",
  ROUTED: "bg-warning-soft text-warning",
  PENDING_ASSIGN: "bg-warning-soft text-warning",
  ASSIGNED: "bg-accent-soft text-accent",
  ONGOING: "bg-accent-soft text-accent",
  PENDING: "bg-warning-soft text-warning",
  COMPLETED: "bg-success-soft text-success",
  VERIFIED: "bg-success-soft text-success",
  REJECTED: "bg-danger-soft text-danger",
  CLOSED: "bg-success-soft text-success",
};

export function StatusBadge({ status }: { status: IssueStatus }) {
  return (
    <span className={`tag ${STATUS_TONE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: number }) {
  return (
    <span
      className="tag tag-outline"
      style={{ color: PRIORITY_COLOR[priority], borderColor: PRIORITY_COLOR[priority] }}
    >
      {PRIORITY_LABEL[priority] || `P${priority}`}
    </span>
  );
}
