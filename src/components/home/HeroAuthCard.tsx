"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useAuth, type SessionClaims } from "@/components/auth/AuthProvider";
import { ensureReporterProvisioned } from "@/components/auth/provisionReporter";
import { GoogleIcon } from "@/components/auth/ProviderButtons";

type HeroAuthCardProps = {
  /** Optional callback invoked with the session after a successful sign-in. */
  onSuccess?: (session: SessionClaims) => void | Promise<void>;
};

/** Hero sign-up/sign-in card: login form on top, Google below it, create-account link last. */
export default function HeroAuthCard({ onSuccess }: HeroAuthCardProps = {}) {
  const { login, loginWithGoogle, refreshClaims } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submitEmail = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setBusy(true);
      try {
        const session = await login(email.trim(), password);
        await onSuccess?.(session);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sign in failed.");
      } finally {
        setBusy(false);
      }
    },
    [login, email, password, onSuccess]
  );

  const submitGoogle = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await loginWithGoogle();
      await ensureReporterProvisioned();
      const session = await refreshClaims();
      await onSuccess?.(session);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.includes("operation-not-allowed") ||
            err.message.includes("popup-blocked") ||
            err.message.includes("unauthorized-domain")
            ? "Google sign-in isn't ready yet — enable the Google provider in Firebase Console → Authentication → Sign-in method."
            : err.message
          : "Google sign-in failed."
      );
    } finally {
      setBusy(false);
    }
  }, [loginWithGoogle, refreshClaims, onSuccess]);

  return (
    <div className="card w-full">
      <h2 className="font-display text-xl font-semibold text-ink">Sign in to Servox</h2>
      <p className="mt-1 text-sm text-slate">Track and manage campus maintenance issues.</p>

      <div className="mt-5 rounded-2xl border border-silver px-10 py-8">
        <form onSubmit={submitEmail} className="flex flex-col gap-3">
          <div>
            <label className="label" htmlFor="hero-email">
              Email
            </label>
            <input
              id="hero-email"
              type="email"
              required
              autoComplete="email"
              className="input"
              placeholder="you@campus.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="hero-password">
              Password
            </label>
            <input
              id="hero-password"
              type="password"
              required
              autoComplete="current-password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="rounded-lg bg-[#fef2f2] px-3 py-2 text-sm text-[#c0392b]">{error}</p>}

          <button type="submit" disabled={busy} className="btn btn-brand btn-lg w-full">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      <div className="mt-4 flex items-center gap-3 text-xs text-stone">
        <span className="h-px flex-1 bg-silver" aria-hidden />
        or
        <span className="h-px flex-1 bg-silver" aria-hidden />
      </div>

      <button type="button" onClick={() => void submitGoogle()} disabled={busy} className="btn btn-secondary btn-lg mt-4 w-full">
        <GoogleIcon />
        Continue with Google
      </button>

      <Link href="/signup" className="btn btn-ghost btn-lg mt-3 w-full">
        Create account
      </Link>
    </div>
  );
}
