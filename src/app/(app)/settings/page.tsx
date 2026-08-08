"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/clientApi";
import { ROLE_LABEL } from "@/lib/constants";
import { Loading } from "@/components/ui/States";

interface SettingsData {
  name?: string;
  email?: string;
  role?: string;
  department?: string;
  college?: string;
  notifyEmail?: boolean;
}

export default function SettingsPage() {
  const { user, claims, ready } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    api<SettingsData>("/api/profile")
      .then((s) => {
        if (!cancelled) setSettings(s);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load settings.");
      });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const toggleNotifications = useCallback(
    async (next: boolean) => {
      setError(null);
      setNotice(null);
      setBusy(true);
      try {
        await api("/api/profile", {
          method: "PATCH",
          body: JSON.stringify({ notifyEmail: next }),
        });
        setSettings((s) => ({ ...(s || {}), notifyEmail: next }));
        setNotice(next ? "Email notifications turned on." : "Email notifications turned off.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't update the preference.");
      } finally {
        setBusy(false);
      }
    },
    []
  );

  if (!ready) return <Loading label="Loading settings…" />;
  if (!user || !claims) return null;

  const rows: [string, string][] = [
    ["Name", settings?.name || claims.name],
    ["Email", user.email || "—"],
    ["Role", (settings?.role || claims.role) ? ROLE_LABEL[(settings?.role || claims.role) as keyof typeof ROLE_LABEL] : "—"],
    ["Department", settings?.department || claims.department || "—"],
    ["College", settings?.college || claims.college || "—"],
  ];

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <button className="btn btn-secondary btn-sm self-start rounded-full" onClick={() => router.back()}>
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back
      </button>
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Settings</h1>
        <p className="mt-1 text-sm text-slate">Manage your account and notification preferences.</p>
      </div>

      <div className="card">
        <h2 className="font-display text-base font-semibold text-ink">Account</h2>
        <p className="mt-1 text-xs text-slate">
          Role, department and college are managed by your administrator and can&apos;t be changed here.
        </p>
        <dl className="mt-4 divide-y divide-silver">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 py-3">
              <dt className="text-sm text-slate">{k}</dt>
              <dd className="truncate text-sm font-medium text-graphite">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="card">
        <h2 className="font-display text-base font-semibold text-ink">Notifications</h2>
        <p className="mt-1 text-sm text-slate">Receive an email when one of your issues changes status.</p>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-graphite">Email notifications</p>
            <p className="text-xs text-slate">Sent to {user.email}</p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void toggleNotifications(!(settings?.notifyEmail ?? true))}
            role="switch"
            aria-checked={Boolean(settings?.notifyEmail ?? true)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              settings?.notifyEmail ?? true ? "bg-ink" : "bg-stone"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                settings?.notifyEmail ?? true ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>

        {error && <p className="mt-4 rounded-lg bg-[#fef2f2] px-3 py-2 text-sm text-[#c0392b]">{error}</p>}
        {notice && <p className="mt-4 rounded-lg bg-[#ecfdf5] px-3 py-2 text-sm text-[#047857]">{notice}</p>}
      </div>
    </div>
  );
}
