"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/clientApi";
import { DEPARTMENTS } from "@/lib/constants";

export default function SignupPage() {
  const { refreshClaims } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
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
        await updateProfile(cred.user, { displayName: name.trim() });
        await api("/api/auth/provision", {
          method: "POST",
          body: JSON.stringify({
            uid: cred.user.uid,
            name: name.trim(),
            email: email.trim(),
            role: "reporter",
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
    [name, email, password, department, router, refreshClaims]
  );

  return (
    <div className="card">
      <h1 className="font-display text-2xl font-semibold text-ink">Create an account</h1>
      <p className="mt-1 text-sm text-slate">Report issues and track their resolution.</p>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="name">
            Full name
          </label>
          <input
            id="name"
            required
            className="input"
            placeholder="Ravi Kumar"
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
          <label className="label" htmlFor="department">
            Department
          </label>
          <select
            id="department"
            className="input"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            {DEPARTMENTS.map((d) => (
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

        {error && (
          <p className="rounded-lg bg-[#fef2f2] px-3 py-2 text-sm text-[#c0392b]">{error}</p>
        )}

        <button type="submit" disabled={busy} className="btn btn-primary btn-lg">
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate">
        Already registered?{" "}
        <Link href="/login" className="link-blue font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}
