"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase";
import { useAuth } from "@/components/auth/AuthProvider";
import { GoogleIcon } from "@/components/auth/ProviderButtons";
import { ensureReporterProvisioned } from "@/components/auth/provisionReporter";
import { api } from "@/lib/clientApi";
import { capitalizeName } from "@/lib/format";
import { COLLEGES, DEPARTMENTS_BY_COLLEGE, type College } from "@/lib/constants";

export default function SignupPage() {
  const { loginWithGoogle, refreshClaims } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [college, setCollege] = useState<College>(COLLEGES[0]);
  const [department, setDepartment] = useState(DEPARTMENTS_BY_COLLEGE[COLLEGES[0]][0]);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setBusy(true);
      try {
        const auth = getClientAuth();
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const fullName = name.trim();
        await updateProfile(cred.user, { displayName: capitalizeName(fullName) });
        await api("/api/auth/provision", {
          method: "POST",
          body: JSON.stringify({
            uid: cred.user.uid,
            name: fullName,
            email: email.trim(),
            role: "reporter",
            college,
            department,
          }),
        });
        await refreshClaims();
        router.replace("/dashboard");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sign up failed.");
      } finally {
        setBusy(false);
      }
    },
    [name, email, password, college, department, router, refreshClaims]
  );

  const submitGoogle = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await loginWithGoogle();
      await ensureReporterProvisioned();
      await refreshClaims();
      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.includes("operation-not-allowed") ||
            err.message.includes("popup-blocked") ||
            err.message.includes("unauthorized-domain")
            ? "Google sign-in isn't ready yet — enable the Google provider in Firebase Console → Authentication → Sign-in method."
            : err.message
          : "Google sign-up failed."
      );
      setBusy(false);
    }
  }, [loginWithGoogle, refreshClaims, router]);

  return (
    <div className="card w-full">
      <h2 className="font-display text-xl font-semibold text-ink">Create your account</h2>
      <p className="mt-1 text-sm text-slate">Report issues and track their resolution.</p>

      <div className="mt-5 rounded-2xl border border-silver px-10 py-8">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <label className="label" htmlFor="name">
              Full name
            </label>
            <input
              id="name"
              required
              className="input"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              className="input"
              placeholder="you@campus.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="college">
              College
            </label>
            <select
              id="college"
              className="input"
              value={college}
              onChange={(e) => {
                const c = e.target.value as College;
                setCollege(c);
                setDepartment(DEPARTMENTS_BY_COLLEGE[c][0]);
              }}
            >
              {COLLEGES.map((c) => (
                <option key={c} value={c}>
                  {c} College
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="department">
              Department
            </label>
            <select
              id="department"
              className="input"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              {DEPARTMENTS_BY_COLLEGE[college].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              className="input"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="rounded-lg bg-[#fef2f2] px-3 py-2 text-sm text-[#c0392b]">{error}</p>}

          <button type="submit" disabled={busy} className="btn btn-brand btn-lg w-full">
            {busy ? "Creating account…" : "Create account"}
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

      <Link href="/login" className="btn btn-ghost btn-lg mt-3 w-full">
        Already registered? Sign in
      </Link>
    </div>
  );
}
