"use client";

import { Mail } from "lucide-react";

export function GoogleIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.87c2.27-2.09 3.57-5.17 3.57-8.86Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.29a12 12 0 0 0 0 10.74l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.96 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.63l3.98 3.09C6.22 6.87 8.87 4.76 12 4.76Z"
      />
    </svg>
  );
}

/** Provider chooser (Google · Email) shared by the login and signup cards. */
export function ProviderChooser({
  busy,
  onGoogle,
  onEmail,
}: {
  busy: boolean;
  onGoogle: () => void;
  onEmail: () => void;
}) {
  return (
    <div className="mt-6 flex flex-col gap-3">
      <button type="button" onClick={onGoogle} disabled={busy} className="btn btn-secondary btn-lg">
        <GoogleIcon />
        Continue with Google
      </button>
      <button type="button" onClick={onEmail} disabled={busy} className="btn btn-secondary btn-lg">
        <Mail className="h-3.5 w-3.5 shrink-0 text-slate" aria-hidden />
        Continue with email
      </button>
    </div>
  );
}
