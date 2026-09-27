"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchSignInMethodsForEmail, sendPasswordResetEmail } from "firebase/auth";
import { useAuth, type SessionClaims } from "@/components/auth/AuthProvider";
import { ensureReporterProvisioned } from "@/components/auth/provisionReporter";
import { GoogleIcon } from "@/components/auth/ProviderButtons";
import { LastUsedBadge } from "@/components/auth/LastUsedBadge";
import { setLastAuthMethod } from "@/lib/lastAuthMethod";
import { getClientAuth } from "@/lib/firebase";
import PasswordSetupModal from "@/components/auth/PasswordSetupModal";

/** Grace period before another reset email can be requested from the UI. */
const RESET_COOLDOWN_MS = 45_000;

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

  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showGoogleGlow, setShowGoogleGlow] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);

  const [resetEmail, setResetEmail] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Drives the resend countdown. `now` only changes on a timer tick, and the
  // remaining seconds are derived during render rather than stored, so no
  // setState happens directly in the effect body.
  useEffect(() => {
    if (cooldownUntil === 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const cooldownLeft =
    cooldownUntil === 0 ? 0 : Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  const backToLogin = useCallback(() => {
    setMode("login");
    setResetSent(false);
    setResetError(null);
    setResetBusy(false);
  }, []);

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

  const submitReset = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setResetError(null);
      setResetBusy(true);
      try {
        // Explicit actionCodeSettings are required: without them Firebase uses
        // the console's default action link, which is the generic hosted
        // handler rather than the app. handleCodeInApp + a same-origin URL is
        // what routes the link to /reset-password.
        await sendPasswordResetEmail(getClientAuth(), resetEmail.trim(), {
          url: `${window.location.origin}/reset-password`,
          handleCodeInApp: true,
        });
        setResetSent(true);
        // Firebase's password-reset quota is shared per project and is low
        // without a billing instrument, so a short client-side cooldown stops
        // accidental double-clicks from burning the allowance.
        const nowTs = Date.now();
        setNow(nowTs);
        setCooldownUntil(nowTs + RESET_COOLDOWN_MS);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("user-not-found")) {
          // Never reveal whether an account exists — the outcome is identical.
          setResetSent(true);
        } else if (msg.includes("too-many-requests")) {
          setResetError("Too many attempts. Please wait a few minutes and try again.");
        } else if (msg.includes("invalid-email")) {
          setResetError("Please enter a valid email address.");
        } else {
          setResetError("Couldn't send the reset link. Please try again.");
        }
      } finally {
        setResetBusy(false);
      }
    },
    [resetEmail]
  );

  return (
    <>
      <div className="card w-full max-md:!p-3">
        <h2 className="font-display text-xl max-md:text-base font-semibold text-ink">
          {mode === "forgot" ? "Reset your password" : "Sign in to Servox"}
        </h2>
        <p className="mt-1 text-sm max-md:text-xs text-slate">Track and manage campus maintenance issues.</p>

        {mode === "login" ? (
          <>
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
                <div className="flex items-center justify-start">
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email.trim());
                      setMode("forgot");
                    }}
                    className="text-xs font-medium text-accent hover:text-accent-strong hover:underline"
                  >
                    Forgot password?
                  </button>
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
          </>
        ) : (
          <div className="mt-5 max-md:mt-2 rounded-2xl border border-silver px-10 py-8 max-md:px-4 max-md:py-3">
            {resetSent ? (
              <div className="flex flex-col gap-3 max-md:gap-2">
                <p className="text-sm font-medium text-ink">Check your inbox for a reset link.</p>
                <p className="text-sm text-slate">
                  If an account exists for <span className="font-medium text-ink">{resetEmail || "this email"}</span>, we&apos;ve
                  sent a password reset link. It expires after about an hour.
                </p>
                <button
                  type="button"
                  onClick={backToLogin}
                  className="btn btn-ghost btn-lg mt-1 w-full max-md:!text-xs max-md:!px-3 max-md:!py-1.5"
                >
                  Back to sign in
                </button>
                <button
                  type="button"
                  onClick={() => setResetSent(false)}
                  disabled={cooldownLeft > 0}
                  className="text-xs font-medium text-accent hover:text-accent-strong hover:underline disabled:cursor-not-allowed disabled:text-stone disabled:no-underline"
                >
                  {cooldownLeft > 0
                    ? `Resend available in ${cooldownLeft}s`
                    : "Didn't get it? Send again"}
                </button>
              </div>
            ) : (
              <form onSubmit={submitReset} className="flex flex-col gap-3 max-md:gap-2">
                <div>
                  <label className="label" htmlFor="reset-email">
                    Email
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    required
                    autoComplete="email"
                    className="input max-md:!py-1.5 max-md:!text-xs"
                    placeholder="you@campus.edu"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                  />
                </div>

                {resetError && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{resetError}</p>}

                <button type="submit" disabled={resetBusy} className="btn btn-brand btn-lg w-full text-white! font-bold! max-md:!text-xs max-md:!px-3 max-md:!py-1.5">
                  {resetBusy ? "Sending…" : "Send reset link"}
                </button>
                <button
                  type="button"
                  onClick={backToLogin}
                  className="btn btn-ghost btn-lg w-full max-md:!text-xs max-md:!px-3 max-md:!py-1.5"
                >
                  Back to sign in
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      <PasswordSetupModal open={needsPassword} onComplete={() => void handlePasswordSetupComplete()} />
    </>
  );
}