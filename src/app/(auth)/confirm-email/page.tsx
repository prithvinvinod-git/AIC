"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { applyActionCode } from "firebase/auth";
import { MailCheck, Mail } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getClientAuth } from "@/lib/firebase";
import { homeFor } from "@/lib/nav";

/**
 * Completes an email address change.
 *
 * `verifyBeforeUpdateEmail` (Settings → Email address) mails a link to the NEW
 * inbox, which lands here as `?mode=verifyEmail&oobCode=…` because the caller
 * passes this route with `handleCodeInApp: true`. Applying the code is what
 * actually swaps the address on the account.
 *
 * After applying, a forced claim refresh is required: the cached ID token still
 * carries the OLD `email` claim, and requireAuth reads that claim when deciding
 * where to send notifications. Without the refresh the app would keep mailing
 * the previous address for up to the token lifetime.
 */
function ConfirmEmailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, reloadUser, refreshClaims } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const applied = useRef(false);

  // Derived, not stored: arriving here without a usable code means the page
  // was opened directly rather than from the new inbox.
  const hasCode =
    searchParams.get("mode") === "verifyEmail" && Boolean(searchParams.get("oobCode"));

  useEffect(() => {
    if (!ready || !hasCode || applied.current) return;
    const oobCode = searchParams.get("oobCode") as string;
    applied.current = true;
    applyActionCode(getClientAuth(), oobCode)
      .then(async () => {
        await reloadUser();
        const session = await refreshClaims(true);
        router.replace(homeFor(session));
      })
      .catch(() => {
        setError(
          "That confirmation link is invalid or has expired. Request a new email address change from Settings."
        );
        setBusy(false);
      });
  }, [ready, hasCode, searchParams, reloadUser, refreshClaims, router]);

  return (
    <div className="card w-full max-md:!p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <MailCheck className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h2 className="font-display text-xl max-md:text-base font-semibold text-ink">
            Confirm your new address
          </h2>
          <p className="mt-0.5 text-sm max-md:text-xs text-slate">
            One last step to finish changing your email.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-silver px-6 py-5 max-md:px-4 max-md:py-3">
        {error ? (
          <>
            <p className="text-sm leading-relaxed text-graphite max-md:text-[13px]">{error}</p>
            <Link href="/settings" className="btn btn-brand btn-lg mt-4 w-full">
              Back to settings
            </Link>
          </>
        ) : hasCode ? (
          <>
            <p className="text-sm leading-relaxed text-graphite max-md:text-[13px]">
              {busy
                ? "Applying your new address…"
                : "If you opened this link from the new inbox, your address is being updated now."}
            </p>
            <Link href="/settings" className="btn btn-ghost btn-lg mt-4 w-full text-slate">
              <Mail className="h-4 w-4" aria-hidden /> Back to settings
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-graphite max-md:text-[13px]">
              Open this page from the confirmation link in your NEW inbox. It only works after you
              request a change in Settings.
            </p>
            <Link href="/settings" className="btn btn-brand btn-lg mt-4 w-full">
              Go to settings
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmEmailInner />
    </Suspense>
  );
}
