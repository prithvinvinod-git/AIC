import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CheckCheck,
  CirclePlus,
  History,
  LayoutDashboard,
  Megaphone,
  ShieldCheck,
  TriangleAlert,
  UserCog,
  Wrench,
} from "lucide-react";
import type { Role } from "./types";

export const ROLE_HOME: Record<Role, string> = {
  reporter: "/dashboard",
  validator: "/validate",
  hod: "/hod",
  principal: "/principal",
  maintenance: "/jobs",
  admin: "/admin",
};

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  role?: Role | "all";
  roles?: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { role: "reporter", label: "My issues", href: "/dashboard", icon: LayoutDashboard },
  { role: "reporter", label: "Submit issue", href: "/new", icon: CirclePlus },
  { role: "validator", label: "Board", href: "/validate", icon: ShieldCheck },
  { role: "hod", label: "Escalations", href: "/hod", icon: TriangleAlert },
  { role: "principal", label: "Approvals", href: "/principal", icon: CheckCheck },
  { role: "maintenance", label: "Jobs", href: "/jobs", icon: Wrench },
  { role: "admin", label: "Admin", href: "/admin", icon: UserCog },
  { role: "all", label: "Analytics", href: "/analytics", icon: BarChart3 },
  { roles: ["admin", "principal"], label: "Issue history", href: "/issue-history", icon: History },
  { roles: ["admin", "principal", "hod"], label: "Announcements", href: "/announcements", icon: Megaphone },
];

export const ANALYTICS_ROLES: Role[] = ["hod", "principal", "validator", "admin"];

/** Nav roles an account can access. A `portal` claim can surface another
 *  role's dashboards on top of the account's own role (e.g. admin who logs
 *  into the Principal portal). */
export function portalRoles(claims: { role: Role; portal?: Role }): Role[] {
  if (!claims.portal) return [claims.role];
  if (claims.role === "admin" && claims.portal === "principal") {
    return ["principal", "hod", "admin"];
  }
  return [claims.portal, claims.role];
}

/** Landing page after login — prefers the `portal` claim, else the role.
 *  Falls back defensively for stale claims (e.g. removed roles). */
export function homeFor(claims: { role: Role; portal?: Role }): string {
  return (
    ROLE_HOME[claims.portal || claims.role] ||
    ROLE_HOME[claims.role] ||
    "/dashboard"
  );
}
