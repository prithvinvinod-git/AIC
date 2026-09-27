"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ActionCodeOperation,
  applyActionCode,
  checkActionCode,
  type ActionCodeInfo,
} from "firebase/auth";
import { MailCheck, Mail } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getClientAuth } from "@/lib/firebase";
import { homeFor } from "@/lib/nav";

/** Modes that mean "confirm an email address change". */
const CHANGE_MODES = new Set(["verifyAndChangeEmail", "verifyEmail"]);

/**
 * Completes an email address change.
 *
 * `verifyBeforeUpdateEmail` (Settings → Email address) mails a link to the NEW
 * inbox, which lands here as `?mode=verifyAndChangeEmail&oobCode=…` because the
 * caller passes this route with `handleCodeInApp: true`.
 *
 * The operation is read with `checkActionCode` rather than trusted from the
 * `mode` string. That matters: a change is VERIFY_AND_CHANGE_EMAIL while a
 * plain address verification is VERIFY_EMAIL, and matching on the mode alone
 * silently does nothing when the two differ. Reading the operation also gives
 * us previousEmail/email, so the user sees which address is moving to which
 * before it happens.
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
  const [info, setInfo] = useState<ActionCodeInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const checked = useRef(false);

  const oobCode = searchParams.get("oobCode");
  const mode = searchParams.get("mode");
  const hasCode = Boolean(oobCode) && CHANGE_MODES.has(mode ?? "");

  useEffect(() => {
    if (!ready || !hasCode || checked.current) return;
    checked.current = true;
    checkActionCode(getClientAuth(), oobCode as string)
      .then((result) => {
        // Guard the operation, not just the URL: a password-reset or
        // email-revocation code pasted onto this route must never be applied
        // here. The `mode` string is only a hint, this is the authority.
        if (
          result.operation !== ActionCodeOperation.VERIFY_AND_CHANGE_EMAIL &&
          result.operation !== ActionCodeOperation.VERIFY_EMAIL
        ) {
          throw new Error("wrong-operation");
        }
        setInfo(result);
      })
      .catch(() => {
        setError(
          "That confirmation link is invalid or has expired. Request a new email address change from Settings."
        );
        setBusy(false);
      });
  }, [ready, hasCode, oobCode]);

  // Apply only once the code has been proven valid, so the change is never
  // committed on a link the user did not open.
  useEffect(() => {
    if (!info) return;
    applyActionCode(getClientAuth(), oobCode as string)
      .then(async () => {
        await reloadUser();
        const session = await refreshClaims(true);
        router.replace(homeFor(session));
      })
      .catch(() => {
        setError("That link could not be applied. Request a new email address change from Settings.");
        setBusy(false);
      });
  }, [info, oobCode, reloadUser, refreshClaims, router]);

  const prev = info?.data.previousEmail;
  const next = info?.data.email;

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
        ) : !hasCode ? (
          <>
            <p className="text-sm leading-relaxed text-graphite max-md:text-[13px]">
              Open this page from the confirmation link in your NEW inbox. It only works after you
              request a change in Settings.
            </p>
            <Link href="/settings" className="btn btn-brand btn-lg mt-4 w-full">
              Go to settings
            </Link>
          </>
        ) : info ? (
          <p className="text-sm leading-relaxed text-graphite max-md:text-[13px]">
            {prev ? (
              <>
                Your sign-in address is changing from{" "}
                <span className="font-medium text-ink">{prev}</span> to{" "}
                <span className="font-medium text-ink">{next}</span>. Applying now…
              </>
            ) : (
              "Confirming your email address…"
            )}
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-graphite max-md:text-[13px]">
            {busy ? "Checking your confirmation link…" : "Working…"}
          </p>
        )}

        {hasCode && !error && (
          <Link href="/settings" className="btn btn-ghost btn-lg mt-4 w-full text-slate">
            <Mail className="h-4 w-4" aria-hidden /> Back to settings
          </Link>
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
