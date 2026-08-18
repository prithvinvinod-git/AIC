"use client";

import { useCallback, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/clientApi";

interface PasswordSetupModalProps {
  open: boolean;
  onComplete: () => void;
}

export default function PasswordSetupModal({ open, onComplete }: PasswordSetupModalProps) {
  const { user, refreshClaims } = useAuth();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusTrap(dialogRef, open);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
      if (!user) {
        setError("Session expired. Please sign in again.");
        return;
      }

      setBusy(true);
      try {
        await user.updatePassword(password);
        await api("/api/profile", {
          method: "PATCH",
          body: JSON.stringify({ hasPassword: true }),
        });
        await refreshClaims();
        onComplete();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("requires-recent-login")) {
          setError("Session expired — please sign in again.");
          await user.getIdToken(true);
        } else {
          setError("Could not set password. Please try again.");
        }
      } finally {
        setBusy(false);
      }
    },
    [password, confirm, user, refreshClaims, onComplete]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Set your password"
      ref={dialogRef}
    >
      <div className="animate-overlay-in absolute inset-0 bg-black/50 backdrop-blur-sm dark:bg-black/70" aria-hidden />
      <div className="animate-panel-in card relative w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft">
            <ShieldCheck className="h-7 w-7 text-accent" />
          </div>
          <h2 className="mt-4 font-display text-lg font-semibold text-ink">Set your password</h2>
          <p className="mt-1 text-sm text-slate">
            Your account needs a password so you can also sign in with email.
            This is a one-time step.
          </p>
        </div>

        <form onSubmit={(e) => void submit(e)} className="mt-5 flex flex-col gap-3">
          <div>
            <label className="label" htmlFor="psw-setup">
              Password
            </label>
            <input
              id="psw-setup"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="input"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="psw-confirm">
              Confirm password
            </label>
            <input
              id="psw-confirm"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="input"
              placeholder="Re-enter password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

          <button type="submit" disabled={busy} className="btn btn-brand btn-lg w-full text-white! font-bold!">
            {busy ? "Saving…" : "Set password"}
          </button>
        </form>
      </div>
    </div>
  );
}
