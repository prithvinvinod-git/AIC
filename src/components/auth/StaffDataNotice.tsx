"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/clientApi";
import { CATEGORY_SCOPED_ROLES } from "@/lib/constants";
import type { Role } from "@/lib/types";

/**
 * Slim, dismissible strip for staff accounts whose admin-assigned data is
 * incomplete (e.g. a category head provisioned before the category picker
 * existed). Staff can't self-select college/department/category — the admin
 * owns that — so instead of the reporter onboarding modal we just surface
 * the gap and point at the admin.
 */
export default function StaffDataNotice() {
  const { claims, refreshClaims } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (!claims || dismissed || claims.assignmentNoticeDismissed) return null;

  const role = claims.role as Role;
  // Category heads are intentionally exempt — they don't self-manage their
  // college/category assignment, and this banner was pure noise for them.
  if (role === "category_head") return null;
  const isStaff = role !== "reporter" && role !== "admin";
  if (!isStaff) return null;

  const isCategoryScoped = (CATEGORY_SCOPED_ROLES as Role[]).includes(role);
  const missingCollege = !claims.college;
  const missingCategory = isCategoryScoped && !claims.categoryId;
  if (!missingCollege && !missingCategory) return null;

  const detail = isCategoryScoped
    ? "Your college and maintenance category"
    : "Your college (and for your role, department)";
  const staffLabel = claims.name || "you";

  const dismiss = () => {
    setDismissed(true);
    api("/api/profile", {
      method: "PATCH",
      body: JSON.stringify({ assignmentNoticeDismissed: true }),
    })
      .then(() => refreshClaims())
      .catch(() => undefined);
  };

  return (
    <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-2.5 text-sm text-ink">
      <div className="flex items-center gap-2.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
        <p>
          <span className="font-medium">{staffLabel},</span> {detail} are managed by an
          administrator and can&apos;t be changed here. If something looks missing, ask your
          administrator to update it.
        </p>
      </div>
      <button
        type="button"
        onClick={() => dismiss()}
        className="shrink-0 rounded p-0.5 text-slate hover:text-ink"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}