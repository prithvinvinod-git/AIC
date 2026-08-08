"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Megaphone, RefreshCw } from "lucide-react";
import { api, ApiError } from "@/lib/clientApi";
import { useAuth } from "@/components/auth/AuthProvider";
import { portalRoles } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { EmptyState, Loading } from "@/components/ui/States";
import type { Announcement, Role } from "@/lib/types";

const MAX_BOARD = 5;

const ANNOUNCER_ROLES: Role[] = ["admin", "principal", "hod"];

/** Announcement board — recent broadcasts scoped to the viewer's roles. */
export default function AnnouncementBoard() {
  const { claims } = useAuth();
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<{ announcements: Announcement[] }>("/api/announcements")
      .then((res) => {
        if (!cancelled) {
          setItems(res.announcements);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Failed to load announcements.");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const visible = useMemo(() => {
    if (!items) return null;
    const accessRoles = claims ? portalRoles(claims) : [];
    return items
      .filter((a) => a.audience.kind === "all" || a.audience.roles.some((r) => accessRoles.includes(r)))
      .slice(0, MAX_BOARD);
  }, [items, claims]);

  const announcer = claims
    ? portalRoles(claims).some((r) => ANNOUNCER_ROLES.includes(r))
    : false;

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-paper text-graphite">
            <Megaphone className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-ink">Announcements</h2>
            <p className="mt-0.5 text-xs text-slate">Latest broadcasts for your team.</p>
          </div>
        </div>
        {announcer && (
          <Link href="/announcements" className="btn btn-ghost btn-sm">
            View all
          </Link>
        )}
      </div>

      {error ? (
        <div className="px-5 py-10 text-center text-sm text-slate">{error}</div>
      ) : !visible ? (
        <Loading label="Loading announcements…" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-8 w-8" aria-hidden />}
          title="Nothing broadcast yet"
          body="Announcements from admin, the Principal and HODs will show up here."
        />
      ) : (
        <div className="flex-1">
          {visible.map((a) => (
            <div key={a.id} className="border-b border-silver px-5 py-4 last:border-0">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-ink">{a.title}</p>
                <span className="shrink-0 text-xs text-slate">{timeAgo(a.createdAt)}</span>
              </div>
              <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-slate">{a.body}</p>
              <p className="mt-2 text-xs text-stone">
                {a.author.name} · {ROLE_LABEL[a.author.role] ?? a.author.role}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-silver px-5 py-3">
        <button type="button" onClick={reload} className="btn btn-ghost btn-sm" aria-label="Refresh announcements">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Refresh
        </button>
      </div>
    </div>
  );
}
