"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { ROLE_HOME } from "@/lib/nav";

const DEMO_ACCOUNTS = [
  { role: "Reporter", email: "ravi@campus.edu" },
  { role: "Validator", email: "priya.validator@campus.edu" },
  { role: "HOD", email: "dr.mehta@campus.edu" },
  { role: "Principal", email: "principal@campus.edu" },
  { role: "Maintenance", email: "rahul.maint@campus.edu" },
  { role: "Head", email: "head.maint@campus.edu" },
  { role: "Admin", email: "admin@campus.edu" },
];

export default function LoginPage() {
  const { login, claims } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setBusy(true);
      try {
        await login(email.trim(), password);
        const home = ROLE_HOME[claims?.role || "reporter"];
        router.replace(home);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sign in failed.");
      } finally {
        setBusy(false);
      }
    },
    [login, claims, email, password, router]
  );

  return (
    <div className="card">
      <h1 className="font-display text-2xl font-semibold text-ink">Welcome back</h1>
      <p className="mt-1 text-sm text-slate">Sign in to manage campus maintenance issues.</p>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
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

      <div className="mt-6 border-t border-silver pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate">
          Demo accounts (password: demo1234)
        </p>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.email}
              type="button"
              className="rounded-lg bg-paper px-2 py-1.5 text-left text-xs text-graphite transition-colors hover:bg-silver"
              onClick={() => {
                setEmail(a.email);
                setPassword("demo1234");
              }}
            >
              <span className="block font-medium">{a.role}</span>
              <span className="truncate text-slate">{a.email}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-slate">
        New reporter?{" "}
        <Link href="/signup" className="link-blue font-medium">
          Create an account
        </Link>
      </p>
    </div>
  );
}
