"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { fetchSignInMethodsForEmail } from "firebase/auth";
import { useAuth, type SessionClaims } from "@/components/auth/AuthProvider";
import { ensureReporterProvisioned } from "@/components/auth/provisionReporter";
import { GoogleIcon } from "@/components/auth/ProviderButtons";
import { LastUsedBadge } from "@/components/auth/LastUsedBadge";
import { setLastAuthMethod } from "@/lib/lastAuthMethod";
import { getClientAuth } from "@/lib/firebase";
import PasswordSetupModal from "@/components/auth/PasswordSetupModal";

function friendlyAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (msg.includes("invalid-credential") || msg.includes("wrong-password"))
    return "Invalid email or password. Please try again.";
  if (msg.includes("user-not-found") || msg.includes("user-disabled"))
    return "No account found with this email.";
  if (msg.includes("too-many-requests"))
    return "Too many attempts. Please try again later.";
  if (msg.includes("operation-not-allowed") || msg.includes("popup-blocked") || msg.includes("unauthorized-domain"))
    return "Google sign-in isn't ready yet — enable the Google provider in Firebase Console → Authentication → Sign-in method.";
  return "Sign in failed. Please try again.";
}

type HeroAuthCardProps = {
  onSuccess?: (session: SessionClaims) => void | Promise<void>;
};

export default function HeroAuthCard({ onSuccess }: HeroAuthCardProps = {}) {
  const { login, loginWithGoogle, refreshClaims } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showGoogleGlow, setShowGoogleGlow] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);

  const submitEmail = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setShowGoogleGlow(false);
      setBusy(true);
      try {
        const session = await login(email.trim(), password);
        setLastAuthMethod("email");
        await onSuccess?.(session);
      } catch (err) {
        const emailAddr = email.trim().toLowerCase();
        if (emailAddr) {
          try {
            const methods = await fetchSignInMethodsForEmail(getClientAuth(), emailAddr);
            if (methods.length > 0 && !methods.includes("password")) {
              setError("This account uses Google Sign-In. Please sign in with Google.");
              setShowGoogleGlow(true);
              setBusy(false);
              return;
            }
          } catch {
            // fetchSignInMethodsForEmail can throw for non-existent emails — fall through to generic error
          }
        }
        setError(friendlyAuthError(err));
      } finally {
        setBusy(false);
      }
    },
    [login, email, password, onSuccess]
  );

  const submitGoogle = useCallback(async () => {
    setError(null);
    setShowGoogleGlow(false);
    setBusy(true);
    try {
      const result = await loginWithGoogle();
      await ensureReporterProvisioned();
      setLastAuthMethod("google");

      const user = getClientAuth().currentUser;
      if (user) {
        const hasPwProvider = user.providerData.some((p) => p.providerId === "password");
        if (!hasPwProvider && !result.hasPassword) {
          setBusy(false);
          setNeedsPassword(true);
          return;
        }
      }

      const session = await refreshClaims();
      await onSuccess?.(session);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }, [loginWithGoogle, refreshClaims, onSuccess]);

  const handlePasswordSetupComplete = useCallback(async () => {
    setNeedsPassword(false);
    setBusy(false);
    const session = await refreshClaims();
    await onSuccess?.(session);
  }, [refreshClaims, onSuccess]);

  return (
    <>
      <div className="card w-full max-md:!p-3">
        <h2 className="font-display text-xl max-md:text-base font-semibold text-ink">Sign in to Servox</h2>
        <p className="mt-1 text-sm max-md:text-xs text-slate">Track and manage campus maintenance issues.</p>

        <div className="mt-5 max-md:mt-2 rounded-2xl border border-silver px-10 py-8 max-md:px-4 max-md:py-3">
          <form onSubmit={submitEmail} className="flex flex-col gap-3 max-md:gap-2">
            <div>
              <label className="label" htmlFor="hero-email">
                Email
              </label>
              <input
                id="hero-email"
                type="email"
                required
                autoComplete="email"
                className="input max-md:!py-1.5 max-md:!text-xs"
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
                className="input max-md:!py-1.5 max-md:!text-xs"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

            <div className="relative">
              <button type="submit" disabled={busy} className="btn btn-brand btn-lg w-full text-white! font-bold! max-md:!text-xs max-md:!px-3 max-md:!py-1.5">
                {busy ? "Signing in…" : "Sign in"}
              </button>
              <LastUsedBadge method="email" />
            </div>
          </form>
        </div>

        <div className="mt-4 max-md:mt-2 flex items-center gap-3 text-xs text-stone">
          <span className="h-px flex-1 bg-silver" aria-hidden />
          or
          <span className="h-px flex-1 bg-silver" aria-hidden />
        </div>

        <div className="relative mt-4 max-md:mt-2">
          <button
            type="button"
            onClick={() => void submitGoogle()}
            disabled={busy}
            className={`btn btn-secondary btn-lg w-full max-md:!text-xs max-md:!px-3 max-md:!py-1.5 max-md:whitespace-normal ${showGoogleGlow ? "animate-google-glow" : ""}`}
          >
            <GoogleIcon />
            Continue with Google
          </button>
          <LastUsedBadge method="google" />
        </div>

        <Link href="/signup" className="btn btn-ghost btn-lg mt-3 max-md:mt-2 w-full max-md:!text-xs max-md:!px-3 max-md:!py-1.5">
          Create account
        </Link>
      </div>

      <PasswordSetupModal open={needsPassword} onComplete={() => void handlePasswordSetupComplete()} />
    </>
  );
}
