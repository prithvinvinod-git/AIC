import type { Issue, Role } from "@/lib/types";

export const MAX_RECENT = 3;
export const OPEN_JOB_STATUSES = ["ASSIGNED", "ONGOING", "PENDING"];

export interface RoleFeed {
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  params?: { status?: string; mine?: boolean };
  pick?: (issues: Issue[]) => Issue[];
  emptyTitle: string;
  emptyBody: string;
}

/** What the dashboard's "latest issues" card shows for each active role. */
export function feedFor(role: Role, department?: string): RoleFeed {
  switch (role) {
    case "reporter":
      return {
        title: "Your recent issues",
        subtitle: `The latest ${MAX_RECENT} you have reported.`,
        ctaLabel: "My issues",
        ctaHref: "/dashboard",
        params: { mine: true },
        emptyTitle: "Nothing reported by you yet",
        emptyBody: "Report your first maintenance issue and follow it to closure.",
      };
    case "validator":
      return {
        title: "Needs your review",
        subtitle: `Latest reports from ${department || "your department"} awaiting validation.`,
        ctaLabel: "Validate board",
        ctaHref: "/board",
        params: { status: "NEW" },
        emptyTitle: "Nothing to review",
        emptyBody: "New issues from your department will appear here for validation.",
      };
    case "hod":
      return {
        title: "Escalations to approve",
        subtitle: "Critical issues awaiting your approval.",
        ctaLabel: "Open escalations",
        ctaHref: "/escalations",
        params: { status: "ESCALATED" },
        emptyTitle: "No escalations pending",
        emptyBody: "Approved critical issues will flow here from department validation.",
      };
    case "principal":
      return {
        title: "Awaiting your approval",
        subtitle: "Critical issues escalated for your sign-off.",
        ctaLabel: "Approvals",
        ctaHref: "/approvals",
        params: { status: "ESCALATED" },
        emptyTitle: "Approval queue is clear",
        emptyBody: "Critical issues will appear here once escalated by department validators.",
      };
    case "maintenance":
      return {
        title: "Your team's jobs",
        subtitle: "Latest open jobs assigned to your team.",
        ctaLabel: "Jobs",
        ctaHref: "/jobs",
        emptyTitle: "No open jobs",
        emptyBody: "Jobs assigned to your team will appear here as they come in.",
        pick: (issues) => issues.filter((i) => OPEN_JOB_STATUSES.includes(i.status)),
      };
    default:
      return {
        title: "Latest campus issues",
        subtitle: "Most recent reports across all departments.",
        ctaLabel: "Issue history",
        ctaHref: "/issue-history",
        emptyTitle: "No issues yet",
        emptyBody: "New reports across campus will appear here.",
      };
  }
}
