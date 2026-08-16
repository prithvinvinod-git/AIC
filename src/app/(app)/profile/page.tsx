"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/clientApi";
import { ROLE_LABEL, COLLEGES, DEPARTMENTS_BY_COLLEGE, type College } from "@/lib/constants";
import { initials } from "@/lib/format";
import { Loading } from "@/components/ui/States";

interface ProfileData {
  name?: string;
  email?: string;
  role?: string;
  department?: string;
  college?: string;
  phone?: string;
}

export default function ProfilePage() {
  const { user, claims, ready, refreshClaims } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [college, setCollege] = useState<College>(
    claims?.college && COLLEGES.includes(claims.college as College)
      ? (claims.college as College)
      : COLLEGES[0]
  );
  const [department, setDepartment] = useState(
    claims?.department && DEPARTMENTS_BY_COLLEGE[college].includes(claims.department)
      ? claims.department
      : DEPARTMENTS_BY_COLLEGE[college][0]
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    api<ProfileData>("/api/profile")
      .then((p) => {
        if (cancelled) return;
        setName(p.name || claims?.name || "");
        setPhone(p.phone || "");
        const pc = p.college as College | undefined;
        if (pc && COLLEGES.includes(pc)) {
          setCollege(pc);
          if (p.department && DEPARTMENTS_BY_COLLEGE[pc].includes(p.department)) {
            setDepartment(p.department);
          }
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load profile.");
      });
    return () => {
      cancelled = true;
    };
  }, [ready, claims]);

  const save = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setNotice(null);
      setBusy(true);
      try {
        await api("/api/profile", {
          method: "PATCH",
          body: JSON.stringify({ name: name.trim(), phone: phone.trim(), college, department }),
        });
        await refreshClaims();
        setNotice("Profile updated.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save changes.");
      } finally {
        setBusy(false);
      }
    },
    [name, phone, college, department, refreshClaims]
  );

  if (!ready) return <Loading label="Loading profile…" />;
  if (!user || !claims) return null;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <button className="btn btn-secondary btn-sm self-start rounded-full" onClick={() => router.back()}>
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back
      </button>
      <div>
        <h1 className="font-display text-2xl max-md:text-xl font-semibold text-ink">Profile</h1>
        <p className="mt-1 text-sm text-slate">Edit your details. Changes apply to all portals instantly.</p>
      </div>

      <div className="card">
        <div className="flex items-center gap-4 border-b border-silver pb-5">
          {user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photoURL}
              alt=""
              referrerPolicy="no-referrer"
              className="h-16 w-16 max-md:h-12 max-md:w-12 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-16 w-16 max-md:h-12 max-md:w-12 items-center justify-center rounded-full bg-ink text-xl font-semibold text-white">
              {initials(claims.name)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-ink">{claims.name}</p>
            <p className="text-sm text-slate">{ROLE_LABEL[claims.role]}</p>
          </div>
        </div>

        <form onSubmit={save} className="mt-5 flex flex-col gap-4">
          <div>
            <label className="label" htmlFor="name">
              Full name
            </label>
            <input
              id="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="label" htmlFor="phone">
              Phone (optional)
            </label>
            <input
              id="phone"
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 …"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Email</label>
              <p className="text-sm text-graphite">{user.email || "—"}</p>
            </div>
            <div>
              <label className="label">Role</label>
              <p className="text-sm text-graphite">{ROLE_LABEL[claims.role]}</p>
            </div>
            <div>
              <label className="label" htmlFor="college">
                College
              </label>
              <select
                id="college"
                className="input"
                value={college}
                disabled={busy}
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
                disabled={busy}
                onChange={(e) => setDepartment(e.target.value)}
              >
                {DEPARTMENTS_BY_COLLEGE[college].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="rounded-lg bg-paper px-3 py-2 text-xs text-slate">
            Role and email are managed by your administrator and can&apos;t be changed here.
          </p>

          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          {notice && <p className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">{notice}</p>}

          <div className="flex justify-end">
            <button type="submit" disabled={busy} className="btn btn-primary">
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
