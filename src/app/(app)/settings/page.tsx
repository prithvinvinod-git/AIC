"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, Moon, Sun } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useTheme } from "@/components/ThemeProvider";
import { api } from "@/lib/clientApi";
import { ROLE_LABEL, CATEGORY_SCOPED_ROLES } from "@/lib/constants";
import type { Role } from "@/lib/types";
import { soundEnabled, setSoundEnabled } from "@/lib/soundPref";
import { isPushSupported, requestFcmToken, deleteFcmToken } from "@/lib/fcm";
import { Loading } from "@/components/ui/States";

interface SettingsData {
  name?: string;
  email?: string;
  role?: string;
  department?: string;
  categoryName?: string;
  college?: string;
  notifyEmail?: boolean;
  pushEnabled?: boolean;
}

function Toggle({
  checked,
  onToggle,
  disabled,
  label,
}: {
  checked: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onToggle(!checked)}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="group relative inline-flex shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        aria-hidden
        className={`h-[1.5em] w-[calc(2.75em+2px)] rounded-full transition-all duration-300 ease-in-out ${
          checked ? "bg-accent" : "bg-[#cccccc] dark:bg-[#3a3834]"
        }`}
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute left-[0.125em] top-[0.125em] h-[1.25em] w-[1.25em] rounded-full bg-white dark:bg-[#fff] transition-all duration-300 ease-in-out group-active:w-[2.25em] ${
          checked
            ? "translate-x-[calc(1.375em+2px)] shadow-[-10px_0_40px_rgba(0,0,0,0.1)] group-active:translate-x-[0.375em]"
            : "translate-x-0 shadow-[10px_0_40px_rgba(0,0,0,0.1)]"
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { user, claims, ready } = useAuth();
  const router = useRouter();
  const { dark: darkMode, toggle: toggleDarkMode } = useTheme();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState(soundEnabled);
  const [push, setPush] = useState(false);
  const pushSupported = isPushSupported();

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    api<SettingsData>("/api/profile")
      .then((s) => {
        if (!cancelled) {
          setSettings(s);
          setPush(Boolean(s.pushEnabled));
        }
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
      setBusy(true);
      try {
        await api("/api/profile", {
          method: "PATCH",
          body: JSON.stringify({ notifyEmail: next }),
        });
        setSettings((s) => ({ ...(s || {}), notifyEmail: next }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't update the preference.");
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const toggleSound = useCallback((next: boolean) => {
    setSoundEnabled(next);
    setSound(next);
  }, []);

  const togglePush = useCallback(
    async (next: boolean) => {
      setError(null);
      setBusy(true);
      try {
        if (next) {
          const { token, error } = await requestFcmToken();
          if (!token) {
            setError(error || "Could not enable push notifications.");
            setBusy(false);
            return;
          }
          await api("/api/profile", {
            method: "PATCH",
            body: JSON.stringify({ fcmToken: token, pushEnabled: true }),
          });
          setPush(true);
        } else {
          await deleteFcmToken().catch(() => {});
          await api("/api/profile", {
            method: "PATCH",
            body: JSON.stringify({ fcmToken: null, pushEnabled: false }),
          });
          setPush(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't update push preference.");
      } finally {
        setBusy(false);
      }
    },
    []
  );

  if (!ready) return <Loading label="Loading settings…" />;
  if (!user || !claims) return null;

  const isCategoryRole = (CATEGORY_SCOPED_ROLES as Role[]).includes(claims.role as Role);
  const rows: [string, string][] = [
    ["Name", settings?.name || claims.name],
    ["Email", user.email || "—"],
    ["Role", (settings?.role || claims.role) ? ROLE_LABEL[(settings?.role || claims.role) as keyof typeof ROLE_LABEL] : "—"],
    [isCategoryRole ? "Category" : "Department",
      isCategoryRole
        ? settings?.categoryName || claims.categoryName || "—"
        : settings?.department || claims.department || "—"],
    ["College", settings?.college || claims.college || "—"],
  ];

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <button className="btn btn-secondary btn-sm self-start rounded-full" onClick={() => router.back()}>
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back
      </button>
      <div>
        <h1 className="font-display text-2xl max-md:text-xl font-semibold text-ink">Settings</h1>
        <p className="mt-1 text-sm text-slate">Manage your account and notification preferences.</p>
      </div>

      <div className="card">
        <h2 className="font-display text-base font-semibold text-ink">Account</h2>
        <p className="mt-1 text-xs text-slate">
          Role, department/category and college are managed by your administrator and can&apos;t be changed here.
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
        <p className="mt-1 text-sm text-slate">Choose how you want to be notified.</p>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-graphite">Email notifications</p>
            <p className="text-xs text-slate">Sent to {user.email}</p>
          </div>
          <Toggle
            checked={Boolean(settings?.notifyEmail ?? true)}
            onToggle={(next) => void toggleNotifications(next)}
            disabled={busy}
            label="Email notifications"
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 border-t border-silver pt-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-graphite">Notification sound</p>
            <p className="text-xs text-slate">Play a short beep when a new notification arrives.</p>
          </div>
          <Toggle checked={sound} onToggle={toggleSound} label="Notification sound" />
        </div>

        {pushSupported && (
          <div className="mt-4 flex items-center justify-between gap-4 border-t border-silver pt-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-graphite flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-accent" aria-hidden />
                Push notifications
              </p>
              <p className="text-xs text-slate">
                {push
                  ? "Device notifications are on."
                  : "Get notified even when the app is closed."}
              </p>
            </div>
            <Toggle checked={push} onToggle={(next) => void togglePush(next)} disabled={busy} label="Push notifications" />
          </div>
        )}

        {error && <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      </div>

      <div className="card">
        <h2 className="font-display text-base font-semibold text-ink">Appearance</h2>
        <p className="mt-1 text-sm text-slate">Choose how the app looks on this device.</p>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper text-slate">
              {darkMode ? (
                <Moon className="h-5 w-5 text-accent" aria-hidden />
              ) : (
                <Sun className="h-5 w-5" aria-hidden />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-graphite">Dark mode</p>
              <p className="text-xs text-slate">Follows your system preference until you switch here.</p>
            </div>
          </div>
          <Toggle checked={darkMode} onToggle={toggleDarkMode} label="Dark mode" />
        </div>
      </div>
    </div>
  );
}
