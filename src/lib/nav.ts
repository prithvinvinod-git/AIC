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

/** Nav roles an account can access. A `portal` claim can surface another
 *  role's dashboards on top of the account's own role (e.g. admin who logs
 *  into the Principal portal). */
export function portalRoles(claims: { role: Role; portal?: Role }): Role[] {
  if (!claims.portal) return [claims.role];
  if (claims.role === "admin" && claims.portal === "principal") {
    return ["principal", "hod", "admin"];
  }
  if (claims.role === "maintenance" && claims.portal === "head") {
    return ["head", "maintenance"];
  }
  return [claims.portal, claims.role];
}

/** Landing page after login — prefers the `portal` claim, else the role. */
export function homeFor(claims: { role: Role; portal?: Role }): string {
  return ROLE_HOME[claims.portal || claims.role];
}
