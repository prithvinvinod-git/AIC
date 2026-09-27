"use client";

import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { KeyRound } from "lucide-react";
import { getClientAuth } from "@/lib/firebase";

/**
 * Completes a Firebase password reset.
 *
 * The reset link arrives here as `?mode=resetPassword&oobCode=…`, because
 * `sendPasswordResetEmail` in HeroAuthCard passes `handleCodeInApp: true` plus
 * this route as the action URL. Without those settings Firebase would send the
 * user to its own generic hosted handler instead.
 *
 * `verifyPasswordResetCode` validates the code and returns the account email;
 * `confirmPasswordReset` consumes the same code and sets the new password. The
 * oobCode is single-use, so the verification runs exactly once (guarded by a
 * ref) and is never re-checked after the reset succeeds.
 */
function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode");
  const mode = searchParams.get("mode");

  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [badCode, setBadCode] = useState<string | null>(null);
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const checked = useRef(false);

  // A valid link always carries mode=resetPassword plus an oobCode. The
  // "no link" case is derived during render instead of being pushed into state
  // from the effect, so the effect body only starts async work.
  const hasCode = mode === "resetPassword" && Boolean(oobCode);

  useEffect(() => {
    if (!hasCode || checked.current) return;
    checked.current = true;
    verifyPasswordResetCode(getClientAuth(), oobCode as string)
      .then((addr) => {
        setEmail(addr);
        setChecking(false);
      })
      .catch((err: unknown) => {
        const m = err instanceof Error ? err.message : "";
        setChecking(false);
        setBadCode(
          m.includes("expired-oob-code")
            ? "That reset link has expired. Request a new one — links last about an hour."
            : "That reset link is invalid or has already been used. Request a new one."
        );
      });
  }, [hasCode, oobCode]);

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      if (next.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (next !== confirm) {
        setError("Passwords do not match.");
        return;
      }
      if (!oobCode) return;

      setBusy(true);
      try {
        await confirmPasswordReset(getClientAuth(), oobCode, next);
        setDone(true);
      } catch (err) {
        const m = err instanceof Error ? err.message : "";
        if (m.includes("expired-oob-code") || m.includes("invalid-oob-code")) {
          setBadCode("That reset link is no longer valid. Request a new one.");
        } else if (m.includes("weak-password")) {
          setError("That password is too weak. Use at least 6 characters.");
        } else {
          setError("Could not reset your password. Please try again.");
        }
      } finally {
        setBusy(false);
      }
    },
    [next, confirm, oobCode]
  );

  return (
    <div className="card w-full max-md:!p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <KeyRound className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h2 className="font-display text-xl max-md:text-base font-semibold text-ink">
            Choose a new password
          </h2>
          {email && (
            <p className="mt-0.5 text-sm max-md:text-xs text-slate">
              For <span className="font-medium text-ink">{email}</span>
            </p>
          )}
        </div>
      </div>

      {!hasCode ? (
        <div className="mt-5 rounded-2xl border border-silver px-6 py-5 max-md:px-4 max-md:py-3">
          <p className="text-sm leading-relaxed text-graphite max-md:text-[13px]">
            This page needs a reset link. Open the most recent &quot;reset your password&quot;
            email, or request a new one.
          </p>
          <Link href="/" className="btn btn-brand btn-lg mt-4 w-full">
            Request a new link
          </Link>
        </div>
      ) : checking ? (
        <p className="mt-5 text-sm text-slate max-md:text-[13px]">Checking your reset link…</p>
      ) : badCode ? (
        <div className="mt-5 rounded-2xl border border-silver px-6 py-5 max-md:px-4 max-md:py-3">
          <p className="text-sm leading-relaxed text-graphite max-md:text-[13px]">{badCode}</p>
          <Link href="/" className="btn btn-brand btn-lg mt-4 w-full">
            Request a new link
          </Link>
        </div>
      ) : done ? (
        <div className="mt-5 rounded-2xl border border-silver px-6 py-5 max-md:px-4 max-md:py-3">
          <p className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
            Password updated. You can sign in with it now.
          </p>
          <Link href="/login" className="btn btn-brand btn-lg mt-4 w-full">
            Go to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 flex flex-col gap-3 rounded-2xl border border-silver px-6 py-5 max-md:px-4 max-md:py-3">
          <div>
            <label className="label" htmlFor="rp-new">
              New password
            </label>
            <input
              id="rp-new"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="input"
              placeholder="At least 6 characters"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="rp-confirm">
              Confirm new password
            </label>
            <input
              id="rp-confirm"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

          <button type="submit" disabled={busy} className="btn btn-brand btn-lg w-full">
            {busy ? "Saving…" : "Set new password"}
          </button>
          <p className="text-center text-xs text-stone">
            <Link href="/login" className="link-blue">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
