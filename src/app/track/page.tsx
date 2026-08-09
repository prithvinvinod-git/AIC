"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Search } from "lucide-react";

export default function TrackEntryPage() {
  const router = useRouter();
  const [token, setToken] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = token.trim();
    if (!t) return;
    router.push(`/track/${encodeURIComponent(t)}`);
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-[1100px] items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2 font-brand text-lg leading-none text-ink sm:text-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="tracking-wide">Servox</span>
          <img src="/servoxlogo.png" alt="Servox" className="h-[20px] w-auto sm:h-[24px]" />
        </Link>
        <Link
          href="/"
          className="link-blue flex items-center gap-1.5 rounded-full border border-silver bg-white px-3 py-1.5 text-sm font-medium"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to home
        </Link>
      </header>

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-16">
        <div className="mx-auto max-w-md pt-12">
          <div className="card">
            <h1 className="font-display text-xl font-semibold text-ink">Track an issue</h1>
            <p className="mt-2 text-sm text-slate">
              Enter the tracking token from your confirmation email or receipt to check status.
            </p>
            <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
              <label className="label" htmlFor="token">
                Tracking token
              </label>
              <input
                id="token"
                className="input"
                placeholder="Paste your tracking token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
                autoFocus
              />
              <button type="submit" className="btn btn-primary" disabled={!token.trim()}>
                <Search className="mr-1.5 inline-block h-4 w-4" aria-hidden />
                Track status
              </button>
            </form>
          </div>
        </div>
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-slate">
        servox-phi — campus maintenance, made simple.
      </footer>
    </div>
  );
}
