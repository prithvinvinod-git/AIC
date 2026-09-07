"use client";

import { notFound } from "next/navigation";
import type { Role } from "@/lib/types";
import { portalRoles } from "@/lib/nav";

/** Client-side page gate: throws a real 404 for accounts whose role + portal
 *  claims have no overlap with `allowed`. No-ops while claims are null —
 *  AppShell blocks rendering of (app) routes until claims exist. */
export function assertRouteAccess(
  claims: { role: Role; portal?: Role } | null | undefined,
  allowed: Role[]
): void {
  if (!claims) return;
  const access = portalRoles(claims);
  if (!allowed.some((r) => access.includes(r))) notFound();
}