"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/clientApi";
import { ROLE_LABEL } from "@/lib/constants";
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
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
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
          body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
        });
        await refreshClaims();
        setNotice("Profile updated.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save changes.");
      } finally {
        setBusy(false);
      }
    },
    [name, phone, refreshClaims]
  );

  if (!ready) return <Loading label="Loading profile…" />;
  if (!user || !claims) return null;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Profile</h1>
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
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ink text-xl font-semibold text-white">
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
              <label className="label">Department</label>
              <p className="text-sm text-graphite">{claims.department || "—"}</p>
            </div>
          </div>

          {error && <p className="rounded-lg bg-[#fef2f2] px-3 py-2 text-sm text-[#c0392b]">{error}</p>}
          {notice && <p className="rounded-lg bg-[#ecfdf5] px-3 py-2 text-sm text-[#047857]">{notice}</p>}

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
