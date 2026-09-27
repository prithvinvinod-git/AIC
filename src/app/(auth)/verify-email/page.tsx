"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { applyActionCode } from "firebase/auth";
import { Mail, RefreshCw, LogOut } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getClientAuth } from "@/lib/firebase";
import { homeFor } from "@/lib/nav";

function VerifyEmailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, ready, reloadUser, sendVerificationEmail, refreshClaims, logout } = useAuth();
  const [notice, setNotice] = useState<string | null>(
    "We sent a verification link to your inbox."
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const processedCode = useRef(false);

  const goHome = useCallback(async () => {
    const session = await refreshClaims(true);
    router.replace(homeFor(session));
  }, [refreshClaims, router]);

  // Firebase verification links (`?mode=verifyEmail&oobCode=…`) land here with
  // handleCodeInApp. Apply the code, then reload to pick up the verified flag.
  useEffect(() => {
    if (!ready || !user) return;
    const mode = searchParams.get("mode");
    const oobCode = searchParams.get("oobCode");
    if (mode === "verifyEmail" && oobCode && !processedCode.current) {
      processedCode.current = true;
      setBusy(true);
      applyActionCode(getClientAuth(), oobCode)
        .then(async () => {
          await reloadUser();
          await goHome();
        })
        .catch(() => {
          setError("That verification link is invalid or has expired. Resend a fresh one below.");
          setBusy(false);
        });
    }
  }, [ready, user, searchParams, reloadUser, goHome]);

  // Light poll: if the user verifies in another tab, complete automatically.
  useEffect(() => {
    if (!ready || !user || user.emailVerified) return;
    const id = window.setInterval(() => {
      void reloadUser();
    }, 4000);
    return () => window.clearInterval(id);
  }, [ready, user, reloadUser]);

  // Once the context user is verified, navigate in.
  useEffect(() => {
    if (ready && user?.emailVerified) {
      void goHome();
    }
  }, [ready, user, goHome]);

  const handleContinue = useCallback(async () => {
    setBusy(true);
    setError(null);
    await reloadUser();
    const current = getClientAuth().currentUser;
    if (current?.emailVerified) {
      await goHome();
    } else {
      setError("Not verified yet — check your inbox (and spam folder), or resend the link.");
      setBusy(false);
    }
  }, [reloadUser, goHome]);

  const handleResend = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await sendVerificationEmail();
      setNotice("Verification email resent. Check your inbox.");
    } catch {
      setError("Could not send the email. Try again in a moment.");
    }
    setBusy(false);
  }, [sendVerificationEmail]);

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace("/login");
  }, [logout, router]);

  return (
    <div className="card w-full max-md:!p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Mail className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h2 className="font-display text-xl max-md:text-base font-semibold text-ink">Verify your email</h2>
          <p className="mt-0.5 text-sm max-md:text-xs text-slate">
            {user?.email ? (
              <>
                Sent to <span className="font-medium text-ink">{user.email}</span>
              </>
            ) : (
              "Confirm your inbox to finish creating your account."
            )}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-silver px-6 py-5 max-md:px-4 max-md:py-3">
        <p className="text-sm leading-relaxed text-graphite max-md:text-[13px]">
          {notice}
          {!user?.emailVerified &&
            " Open the link in the email to confirm this address. Your account stays inactive until you do — this keeps Servox free of fake accounts."}
        </p>

        {error && <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void handleContinue()}
            disabled={busy}
            className="btn btn-brand btn-lg w-full"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            {busy ? "Checking…" : "I've verified — continue"}
          </button>
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={busy}
            className="btn btn-ghost btn-lg w-full"
          >
            Resend verification email
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={busy}
            className="btn btn-ghost btn-lg w-full text-slate"
          >
            <LogOut className="h-4 w-4" aria-hidden /> Sign out
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-stone">
          Wrong address?{" "}
          <Link href="/login" className="link-blue">
            Sign in with the correct account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}