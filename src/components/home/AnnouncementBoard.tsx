"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Megaphone, RefreshCw } from "lucide-react";
import { api, ApiError } from "@/lib/clientApi";
import { useAuth } from "@/components/auth/AuthProvider";
import { portalRoles } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/constants";
import { EASTER_EGG_META } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { EmptyState, Loading } from "@/components/ui/States";
import { AnnouncementModal } from "@/components/announcements/AnnouncementModal";
import type { Announcement, Role } from "@/lib/types";

const MAX_BOARD = 5;

const ANNOUNCER_ROLES: Role[] = ["admin", "principal", "hod"];

/** Announcement board — recent broadcasts scoped to the viewer's roles. */
export default function AnnouncementBoard() {
  const { claims } = useAuth();
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<Announcement | null>(null);

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
    <div className="card flex h-[600px] flex-col overflow-hidden p-6 sm:p-8 max-md:h-[545px]">
      <header className="flex items-center justify-between border-b border-silver pb-6">
        <div>
          <h2 className="font-display text-2xl font-normal leading-none tracking-tight text-ink">
            Announcements
          </h2>
          <p className="mt-2 text-xs tracking-wide text-slate">Latest broadcasts for your team.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reload}
            aria-label="Refresh announcements"
            title="Refresh announcements"
            className="rounded-lg p-2.5 text-slate transition-colors hover:text-ink sm:hidden"
          >
            <RefreshCw className="h-5 w-5" aria-hidden />
          </button>
          {announcer && (
            <Link href="/announcements" className="btn btn-ghost btn-sm">
              View all
            </Link>
          )}
        </div>
      </header>

      <div className="custom-scroll min-h-0 -mr-6 flex-1 divide-y divide-silver overflow-y-auto pr-6 sm:-mr-8 sm:pr-8">
        {error ? (
          <div className="px-1 py-10 text-center text-sm text-slate">{error}</div>
        ) : !visible ? (
          <Loading label="Loading announcements…" />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="h-8 w-8" aria-hidden />}
            title="Nothing broadcast yet"
            body="Announcements from admin, the Principal and HODs will show up here."
          />
        ) : (
          visible.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelected(a)}
              className="block w-full px-1 py-4 text-left transition-colors hover:bg-paper sm:py-6"
            >
              <div className="flex items-start justify-between gap-4 sm:gap-6">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <h3 className="truncate text-sm font-medium tracking-tight text-ink transition-colors group-hover:text-accent">
                      {a.title}
                    </h3>
                    {a.easterEgg && EASTER_EGG_META[a.easterEgg] && (
                      <Link
                        href={`/${a.easterEgg}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent transition-transform hover:scale-110"
                        title={EASTER_EGG_META[a.easterEgg].label}
                      >
                        {(() => { const Icon = EASTER_EGG_META[a.easterEgg!].Icon; return <Icon className="h-3.5 w-3.5" aria-hidden />; })()}
                      </Link>
                    )}
                  </div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-slate sm:text-sm">{a.body}</p>
                  <p className="text-xs text-stone">
                    {a.author.name} · {ROLE_LABEL[a.author.role] ?? a.author.role}
                  </p>
                </div>
                <span className="shrink-0 pt-1 font-mono text-xs text-slate">{timeAgo(a.createdAt)}</span>
              </div>
            </button>
          ))
        )}
      </div>

      <footer className="mt-4 flex shrink-0 items-center justify-between border-t border-silver pt-4">
        <p className="font-mono text-xs text-slate">
          {visible ? `${visible.length} announcement${visible.length === 1 ? "" : "s"}` : " "}
        </p>
      </footer>

      {selected && <AnnouncementModal announcement={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
