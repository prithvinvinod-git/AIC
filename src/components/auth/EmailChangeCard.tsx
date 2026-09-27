"use client";

import { useCallback, useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import { EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail } from "firebase/auth";
import { useAuth } from "@/components/auth/AuthProvider";

/**
 * Settings → Account: changes the address Firebase Auth signs in with.
 *
 * Two things make this non-obvious:
 *
 * 1. Firebase requires a *recent* authentication before it will touch the
 *    address, so the current password is re-authenticated first — same reason
 *    PasswordChangeCard does. Google-only accounts have no password to
 *    re-authenticate with, so they get a pointer to set one instead.
 * 2. `verifyBeforeUpdateEmail` does not apply the change immediately. It mails
 *    a link to the NEW address and only completes once that link is applied on
 *    /confirm-email. That is deliberate: it stops anyone hijacking an account
 *    by pointing it at an inbox they control.
 */
export default function EmailChangeCard() {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const hasPassword =
    Boolean(user?.providerData.some((p) => p.providerId === "password")) && user?.email;

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      setSentTo(null);

      const trimmed = next.trim().toLowerCase();
      if (!trimmed) {
        setError("Enter a valid email address.");
        return;
      }
      if (trimmed === user?.email?.toLowerCase()) {
        setError("That is already your email address.");
        return;
      }
      if (!user?.email || !current) {
        setError("Enter your current password to confirm the change.");
        return;
      }

      setBusy(true);
      try {
        // 1. Re-authenticate so Firebase accepts the address change.
        const cred = EmailAuthProvider.credential(user.email, current);
        await reauthenticateWithCredential(user, cred);
        // 2. Mail a verification link to the NEW address. The account is
        //    untouched until that link is opened on /confirm-email.
        await verifyBeforeUpdateEmail(user, trimmed, {
          url: `${window.location.origin}/confirm-email`,
          handleCodeInApp: true,
        });
        setCurrent("");
        setNext("");
        setSentTo(trimmed);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("wrong-password") || msg.includes("invalid-credential")) {
          setError("That current password is incorrect.");
        } else if (msg.includes("requires-recent-login")) {
          setError("For your security, sign out and back in, then try again.");
        } else if (msg.includes("email-already-in-use")) {
          setError("That email address is already linked to another account.");
        } else if (msg.includes("invalid-email")) {
          setError("Enter a valid email address.");
        } else if (msg.includes("too-many-requests")) {
          setError("Too many attempts. Please wait a few minutes and try again.");
        } else {
          setError("Could not start the email change. Please try again.");
        }
      } finally {
        setBusy(false);
      }
    },
    [user, current, next]
  );

  return (
    <div className="card">
      <h2 className="font-display text-base font-semibold text-ink">Email address</h2>
      <p className="mt-1 text-sm text-slate">
        {user?.email ? (
          <>
            You sign in as <span className="font-medium text-ink">{user.email}</span>
          </>
        ) : (
          "Set the address you sign in with."
        )}
      </p>

      {!hasPassword ? (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            This account signs in with Google, so there is no password to confirm the change
            with. Set a password in Security first, then you can change your address here.
          </span>
        </p>
      ) : sentTo ? (
        <div className="mt-4 flex flex-col gap-2">
          <p className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
            Verification link sent to <span className="font-medium">{sentTo}</span>. Your
            address changes as soon as you open it.
          </p>
          <p className="text-xs text-slate">
            Nothing has changed yet. If it expires, come back here and try again.
          </p>
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="btn btn-secondary btn-sm self-start"
          >
            Use a different address
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="mt-4 flex flex-col gap-3">
          <div>
            <label className="label" htmlFor="em-current">
              Current password
            </label>
            <input
              id="em-current"
              type="password"
              required
              autoComplete="current-password"
              className="input"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="em-new">
              New email address
            </label>
            <input
              id="em-new"
              type="email"
              required
              autoComplete="email"
              className="input"
              placeholder="you@campus.edu"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>

          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

          <button type="submit" disabled={busy} className="btn btn-brand self-start">
            {busy ? "Sending…" : "Change email"}
          </button>
        </form>
      )}
    </div>
  );
}
