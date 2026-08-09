"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { api, ApiError } from "@/lib/clientApi";
import { COLLEGES, DEPARTMENTS_BY_COLLEGE, type College } from "@/lib/constants";

interface Props {
  /** Hide Skip / "Don't ask again" and force completion (used by /new). */
  required?: boolean;
  /** Render as an inline card instead of a modal overlay. */
  inline?: boolean;
  /** Called after the profile is saved. */
  onDone?: () => void;
}

/**
 * Post-Google-login onboarding: asks reporters for college + department
 * (name/email already come from Google). Auto-shows until the profile is
 * complete, unless the user checked "Don't ask again".
 */
export default function ProfileOnboarding({ required, inline, onDone }: Props = {}) {
  const { claims, refreshClaims } = useAuth();
  const pathname = usePathname();

  const [college, setCollege] = useState<College>(
    claims?.college && COLLEGES.includes(claims.college as College)
      ? (claims.college as College)
      : COLLEGES[0]
  );
  const [department, setDepartment] = useState(
    claims?.department && DEPARTMENTS_BY_COLLEGE[college].includes(claims.department)
      ? claims.department
      : DEPARTMENTS_BY_COLLEGE[college][0]
  );
  const [dontAsk, setDontAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsCompletion =
    !!claims && claims.role === "reporter" && !claims.college;
  const autoShow =
    needsCompletion &&
    !required &&
    !claims!.profilePromptDismissed &&
    pathname !== "/new";

  const close = useCallback(() => {
    if (busy || required) return;
    if (dontAsk) {
      setBusy(true);
      setError(null);
      api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ profilePromptDismissed: true }),
      })
        .then(() => refreshClaims())
        .catch((e) => setError(e instanceof Error ? e.message : "Couldn't save your preference."))
        .finally(() => setBusy(false));
    }
  }, [busy, required, dontAsk, refreshClaims]);

  useEffect(() => {
    if (!autoShow) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [autoShow, close]);

  const confirm = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          college,
          department,
          profilePromptDismissed: true,
        }),
      });
      await refreshClaims();
      onDone?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save your details.");
    } finally {
      setBusy(false);
    }
  }, [college, department, refreshClaims, onDone]);

  if (!autoShow && !(required && needsCompletion)) return null;

  const panel = (
    <div className="card relative w-full max-w-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">
            {required ? "Add your details" : "Complete your profile"}
          </h2>
          <p className="mt-1 text-sm text-slate">
            {required
              ? "You need a college and department to report an issue."
              : `Welcome, ${claims?.name || "there"} — tell us where you belong.`}
          </p>
        </div>
        {!required && (
          <button
            type="button"
            onClick={() => close()}
            disabled={busy}
            className="btn btn-ghost btn-sm"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
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
              setDepartment(DEPARTMENTS_BY_COLLEGE[c][0]);
            }}
          >
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
            disabled={busy}
            onChange={(e) => setDepartment(e.target.value)}
          >
            {DEPARTMENTS_BY_COLLEGE[college].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-[#c0392b]">{error}</p>}

      <div className="mt-5 flex items-center justify-between gap-3">
        {!required && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => close()}
            disabled={busy}
          >
            Skip
          </button>
        )}
        <div className="ml-auto flex items-center gap-3">
          {!required && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-silver accent-ink"
                checked={dontAsk}
                onChange={(e) => setDontAsk(e.target.checked)}
              />
              Don&apos;t ask again
            </label>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void confirm()}
            disabled={busy}
          >
            {busy ? "Saving…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );

  if (inline) {
    return <div className="mx-auto w-full max-w-md">{panel}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="animate-overlay-in absolute inset-0 bg-ink/40 backdrop-blur-sm" aria-hidden />
      <div className="animate-panel-in relative">{panel}</div>
    </div>
  );
}
