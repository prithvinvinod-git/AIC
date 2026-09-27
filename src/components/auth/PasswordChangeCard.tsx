"use client";

import { useCallback, useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { useAuth } from "@/components/auth/AuthProvider";
import PasswordSetupModal from "@/components/auth/PasswordSetupModal";
import { api } from "@/lib/clientApi";

/**
 * Settings → Security. Reports that use a Google-only account get a
 * "Set a password" entry point; everyone else changes their existing
 * password here.
 *
 * Firebase requires a *recent* authentication before `updatePassword`, so the
 * flow is: re-authenticate with the current password, then update. Without
 * the re-auth step the call fails with `auth/requires-recent-login`.
 */
export default function PasswordChangeCard() {
  const { user, claims, refreshClaims } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);

  const hasPassword =
    Boolean(claims?.hasPassword) ||
    Boolean(user?.providerData.some((p) => p.providerId === "password"));

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      setDone(false);

      if (next.length < 6) {
        setError("New password must be at least 6 characters.");
        return;
      }
      if (next !== confirm) {
        setError("New passwords do not match.");
        return;
      }
      if (!user?.email) {
        setError("Your account has no email address to re-authenticate with.");
        return;
      }

      setBusy(true);
      try {
        // 1. Re-authenticate with the current password.
        const cred = EmailAuthProvider.credential(user.email, current);
        await reauthenticateWithCredential(user, cred);
        // 2. Set the new one.
        await updatePassword(user, next);
        // 3. Tell the server so the `hasPassword` claim follows.
        await api("/api/profile", {
          method: "PATCH",
          body: JSON.stringify({ hasPassword: true }),
        });
        await refreshClaims(true);
        setCurrent("");
        setNext("");
        setConfirm("");
        setDone(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (
          msg.includes("wrong-password") ||
          msg.includes("invalid-credential") ||
          msg.includes("invalid-login-credentials")
        ) {
          setError("That current password is incorrect.");
        } else if (msg.includes("requires-recent-login")) {
          setError("For your security, sign in again before changing your password.");
        } else if (msg.includes("weak-password")) {
          setError("New password is too weak. Use at least 6 characters.");
        } else {
          setError("Could not update your password. Please try again.");
        }
      } finally {
        setBusy(false);
      }
    },
    [user, current, next, confirm, refreshClaims]
  );

  return (
    <div className="card">
      <h2 className="font-display text-base font-semibold text-ink">Security</h2>
      <p className="mt-1 text-sm text-slate">
        {hasPassword
          ? "Change the password you use to sign in."
          : "Your account signs in with Google. Add a password so you can also sign in with your email."}
      </p>

      {hasPassword ? (
        <form onSubmit={(e) => void submit(e)} className="mt-4 flex flex-col gap-3">
          <div>
            <label className="label" htmlFor="pw-current">
              Current password
            </label>
            <input
              id="pw-current"
              type="password"
              required
              autoComplete="current-password"
              className="input"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="pw-new">
              New password
            </label>
            <input
              id="pw-new"
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
            <label className="label" htmlFor="pw-confirm">
              Confirm new password
            </label>
            <input
              id="pw-confirm"
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
          {done && !error && (
            <p className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">Password updated.</p>
          )}

          <button type="submit" disabled={busy} className="btn btn-brand self-start">
            {busy ? "Updating…" : "Change password"}
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setSetupOpen(true)}
          className="btn btn-secondary btn-sm mt-4"
        >
          <KeyRound className="h-3.5 w-3.5" aria-hidden />
          Set a password
        </button>
      )}

      <PasswordSetupModal
        open={setupOpen}
        onComplete={() => {
          setSetupOpen(false);
          void refreshClaims(true);
        }}
      />
    </div>
  );
}
