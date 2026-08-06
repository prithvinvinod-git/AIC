import type { Role } from "./types";

export const ROLE_HOME: Record<Role, string> = {
  reporter: "/dashboard",
  validator: "/validate",
  hod: "/hod",
  principal: "/principal",
  maintenance: "/jobs",
  head: "/head",
  admin: "/admin",
};

export const NAV_ITEMS: { role: Role | "all"; label: string; href: string }[] = [
  { role: "reporter", label: "My issues", href: "/dashboard" },
  { role: "reporter", label: "Submit issue", href: "/new" },
  { role: "validator", label: "Validate", href: "/validate" },
  { role: "hod", label: "Escalations", href: "/hod" },
  { role: "principal", label: "Approvals", href: "/principal" },
  { role: "maintenance", label: "Jobs", href: "/jobs" },
  { role: "head", label: "Job board", href: "/head" },
  { role: "admin", label: "Admin", href: "/admin" },
  { role: "all", label: "Analytics", href: "/analytics" },
];

export const ANALYTICS_ROLES: Role[] = ["hod", "principal", "head", "admin"];
