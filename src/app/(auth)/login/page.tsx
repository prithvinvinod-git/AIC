"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ProviderChooser } from "@/components/auth/ProviderButtons";
import { ensureReporterProvisioned } from "@/components/auth/provisionReporter";
import { homeFor } from "@/lib/nav";
import type { SessionClaims } from "@/components/auth/AuthProvider";

export default function LoginPage() {
  const { login, loginWithGoogle, refreshClaims } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<"pick" | "email">("pick");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ensureProvisioned = useCallback(async () => {
    await ensureReporterProvisioned();
  }, []);

  const goHome = useCallback(
    async (session: SessionClaims) => {
      router.replace(homeFor(session));
    },
    [router]
  );

  const submitEmail = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setBusy(true);
      try {
        const session = await login(email.trim(), password);
        await goHome(session);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sign in failed.");
      } finally {
        setBusy(false);
      }
    },
    [login, email, password, goHome]
  );

  const submitGoogle = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await loginWithGoogle();
      await ensureProvisioned();
      await goHome(await refreshClaims());
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
  }, [loginWithGoogle, ensureProvisioned, refreshClaims, goHome]);

  if (mode === "pick") {
    return (
      <div className="card">
        <h1 className="font-display text-2xl font-semibold text-ink">Welcome to CampusCare</h1>
        <p className="mt-1 text-sm text-slate">Choose how you want to continue.</p>

        <div className="mt-6 flex flex-col gap-3">
          <ProviderChooser busy={busy} onGoogle={submitGoogle} onEmail={() => setMode("email")} />
        </div>

        {error && <p className="mt-4 rounded-lg bg-[#fef2f2] px-3 py-2 text-sm text-[#c0392b]">{error}</p>}

        <p className="mt-6 text-center text-sm text-slate">
          New reporter?{" "}
          <Link href="/signup" className="link-blue font-medium">
            Create an account with email
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <button
        type="button"
        onClick={() => {
          setMode("pick");
          setError(null);
        }}
        className="link-blue flex items-center gap-1 text-sm font-medium"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> All options
      </button>

      <h1 className="mt-3 font-display text-2xl font-semibold text-ink">Welcome back</h1>
      <p className="mt-1 text-sm text-slate">Sign in to manage campus maintenance issues.</p>

      <form onSubmit={submitEmail} className="mt-6 flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
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
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            className="input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-[#fef2f2] px-3 py-2 text-sm text-[#c0392b]">{error}</p>
        )}

        <button type="submit" disabled={busy} className="btn btn-primary btn-lg">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate">
        New reporter?{" "}
        <Link href="/signup" className="link-blue font-medium">
          Create an account
        </Link>
      </p>
    </div>
  );
}
