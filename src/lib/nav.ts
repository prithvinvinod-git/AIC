import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CheckCheck,
  CirclePlus,
  History,
  LayoutDashboard,
  Megaphone,
  ShieldCheck,
  ShoppingCart,
  TriangleAlert,
  UserCog,
  Wrench,
} from "lucide-react";
import type { Role } from "./types";

export const ROLE_HOME: Record<Role, string> = {
  reporter: "/",
  validator: "/",
  hod: "/",
  principal: "/",
  maintenance_head: "/",
  category_head: "/",
  maintenance: "/",
  purchase: "/",
  admin: "/",
};

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  role?: Role | "all";
  roles?: Role[];
}

export const ANALYTICS_ROLES: Role[] = ["hod", "principal", "validator", "admin"];

export const HEAD_ROLES: Role[] = ["maintenance_head", "category_head"];

export const NAV_ITEMS: NavItem[] = [
  { role: "all", label: "Dashboard", href: "/", icon: LayoutDashboard },
  { role: "reporter", label: "My issues", href: "/dashboard", icon: LayoutDashboard },
  { role: "reporter", label: "Submit issue", href: "/new", icon: CirclePlus },
  { role: "validator", label: "Board", href: "/board", icon: ShieldCheck },
  { role: "hod", label: "Escalations", href: "/escalations", icon: TriangleAlert },
  { role: "principal", label: "Approvals", href: "/approvals", icon: CheckCheck },
  { role: "maintenance", label: "Jobs", href: "/jobs", icon: Wrench },
  { roles: HEAD_ROLES, label: "Dispatch", href: "/dispatch", icon: Wrench },
  { role: "purchase", label: "Purchases", href: "/purchase", icon: ShoppingCart },
  { role: "admin", label: "Admin", href: "/admin", icon: UserCog },
  { roles: ANALYTICS_ROLES, label: "Analytics", href: "/analytics", icon: BarChart3 },
  { roles: ["admin", "principal", "validator"], label: "Issues", href: "/issue-history", icon: History },
  { roles: ["admin", "principal", "hod"], label: "Announcements", href: "/announcements", icon: Megaphone },
];

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

/** Nav items an account can see, filtered by role + portal claims. Shared by
 *  the inline navbar (AppHeader) and the floating mobile menu (MobileNav). */
export function filterNavItems(claims: { role: Role; portal?: Role }): NavItem[] {
  const accessRoles = portalRoles(claims);
  return NAV_ITEMS.filter((i) => {
    if (i.roles) return i.roles.some((r) => accessRoles.includes(r));
    return i.role === "all" || (i.role ? accessRoles.includes(i.role) : false);
  });
}

/** Landing page after login — prefers the `portal` claim, else the role.
 *  Falls back defensively for stale claims (e.g. removed roles). */
export function homeFor(claims: { role: Role; portal?: Role }): string {
  return (
    ROLE_HOME[claims.portal || claims.role] ||
    ROLE_HOME[claims.role] ||
    "/"
  );
}
