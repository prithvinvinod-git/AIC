import type { IssueStatus } from "@/lib/types";
import { PRIORITY_COLOR, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/constants";

const STATUS_TONE: Record<IssueStatus, string> = {
  NEW: "bg-[#eff6fe] text-[#2563eb]",
  VALIDATED: "bg-[#eff6fe] text-[#2563eb]",
  ESCALATED: "bg-[#fffbeb] text-[#d97706]",
  APPROVED: "bg-[#eff6fe] text-[#2563eb]",
  ASSIGNED: "bg-[#eff6fe] text-[#2563eb]",
  ONGOING: "bg-[#eff6fe] text-[#2563eb]",
  PENDING: "bg-[#fffbeb] text-[#d97706]",
  COMPLETED: "bg-[#ecfdf5] text-[#2e7d32]",
  VERIFIED: "bg-[#ecfdf5] text-[#2e7d32]",
  REJECTED: "bg-[#fef2f2] text-[#c0392b]",
  CLOSED: "bg-[#ecfdf5] text-[#2e7d32]",
};

export function StatusBadge({ status }: { status: IssueStatus }) {
  return (
    <span className={`tag ${STATUS_TONE[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
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
