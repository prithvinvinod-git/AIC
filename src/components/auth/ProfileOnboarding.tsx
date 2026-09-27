"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { api, ApiError } from "@/lib/clientApi";
import { COLLEGES, DEPARTMENTS_BY_COLLEGE, type College } from "@/lib/constants";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface Props {
  /** Render as an inline card instead of a modal overlay. */
  inline?: boolean;
  /** Called after the profile is saved. */
  onDone?: () => void;
}

/**
 * Mandatory post-login onboarding: a reporter MUST pick a college + department
 * before using the app. There is no Skip / close / Escape — the dialog
 * re-appears until the profile is complete. Both fields start as an empty
 * placeholder so a college can't be silently defaulted (a Dental student
 * shouldn't end up tagged Engineering).
 *
 * Staff roles never see this — their college/department/category are assigned
 * by an administrator, so there is nothing for them to self-select. Incomplete
 * staff accounts get a slim banner instead (see StaffDataNotice).
 */
export default function ProfileOnboarding({ inline, onDone }: Props = {}) {
  const { claims, refreshClaims } = useAuth();
  const pathname = usePathname();

  const [college, setCollege] = useState<College | "">(
    claims?.college && COLLEGES.includes(claims.college as College)
      ? (claims.college as College)
      : ""
  );
  const [department, setDepartment] = useState(
    claims?.college && claims?.department
      ? claims.department
      : ""
  );
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Only reporters self-onboard, and only while college OR department is
  // missing — an incomplete reporter can never dismiss this. Inline mode
  // (the /new page renders its own card) shows anywhere; the modal shows on
  // every other app page.
  const needsCompletion =
    !!claims &&
    claims.role === "reporter" &&
    (!claims.college || !claims.department) &&
    !dismissed;
  const showInline = inline && needsCompletion;
  const showModal = !inline && needsCompletion && pathname !== "/new";
  const showDialog = showInline || showModal;

  useEffect(() => {
    if (!showDialog || inline) return;
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") e.preventDefault();
    });
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showDialog, inline]);

  useFocusTrap(dialogRef, !inline && !!showDialog);

  const canConfirm = !!college && !!department;

  const confirm = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          college,
          department,
        }),
      });
      // Force an ID-token refresh so the freshly-written college/department
      // claims are visible immediately — this is what makes the dialog close.
      await refreshClaims(true);
      setDismissed(true);
      onDone?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save your details.");
    } finally {
      setBusy(false);
    }
  }, [college, department, refreshClaims, onDone]);

  if (!showDialog) return null;

  const panel = (
    <div className="card relative w-full max-w-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Complete your profile</h2>
          <p className="mt-1 text-sm text-slate">
            {claims?.name ? `Welcome, ${claims.name} — ` : ""}which college and department
            are you in? This can&apos;t be skipped.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="onboarding-college">
            College
          </label>
          <select
            id="onboarding-college"
            className="input"
            value={college}
            disabled={busy}
            onChange={(e) => {
              const c = e.target.value as College;
              setCollege(c);
              setDepartment("");
            }}
          >
            <option value="">Select your college…</option>
            {COLLEGES.map((c) => (
              <option key={c} value={c}>
                {c} College
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="onboarding-department">
            Department
          </label>
          <select
            id="onboarding-department"
            className="input"
            value={department}
            disabled={busy || !college}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">Select your department…</option>
            {college &&
              DEPARTMENTS_BY_COLLEGE[college].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
          </select>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void confirm()}
          disabled={busy || !canConfirm}
        >
          {busy ? "Saving…" : "Confirm"}
        </button>
      </div>
    </div>
  );

  if (inline) {
    return <div className="mx-auto w-full max-w-md">{panel}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" ref={dialogRef}>
      <div className="animate-overlay-in absolute inset-0 bg-black/40 backdrop-blur-sm dark:bg-black/60" aria-hidden />
      <div className="animate-panel-in relative">{panel}</div>
    </div>
  );
}