"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BellRing, CheckCheck } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { NOTIFICATION_FALLBACK_META, NOTIFICATION_META } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { EmptyState, Loading } from "@/components/ui/States";

const FILTERS = ["All", "Unread", "Announcements"] as const;
type Filter = (typeof FILTERS)[number];

function metaFor(type: string) {
  return NOTIFICATION_META[type] || NOTIFICATION_FALLBACK_META;
}

export default function NotificationsPage() {
  const { items, unread, markRead, markAllRead } = useNotifications();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("All");

  const filtered = useMemo(() => {
    if (!items) return null;
    switch (filter) {
      case "Unread":
        return items.filter((n) => !n.isRead);
      case "Announcements":
        return items.filter((n) => n.type === "announcement");
      default:
        return items;
    }
  }, [items, filter]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <button className="btn btn-secondary btn-sm self-start rounded-full" onClick={() => router.back()}>
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back
      </button>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Notifications</h1>
          <p className="mt-1 text-sm text-slate">
            {unread > 0 ? `${unread} unread` : "You&apos;re all caught up."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void markAllRead()}
          disabled={unread === 0}
          className="btn btn-secondary btn-sm inline-flex items-center gap-2 rounded-full disabled:opacity-50"
        >
          <CheckCheck className="h-3.5 w-3.5" aria-hidden />
          Mark all read
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {items === null ? (
        <Loading label="Loading notifications…" />
      ) : !filtered || filtered.length === 0 ? (
        <EmptyState
          icon={<BellRing className="h-8 w-8" aria-hidden />}
          title="No notifications here"
          body="Status changes, escalations and announcements will show up in this feed."
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <ul className="divide-y divide-silver">
            {filtered.map((n) => {
              const meta = metaFor(n.type);
              const Icon = meta.icon;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      void markRead(n.id);
                      if (n.link) router.push(n.link);
                    }}
                    className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-paper ${
                      !n.isRead ? "bg-paper" : ""
                    }`}
                  >
                    <span className={`mt-0.5 shrink-0 ${meta.iconClass}`}>
                      <Icon className="h-[18px] w-[18px]" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-graphite">{n.title}</span>
                        {!n.isRead && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />
                        )}
                      </span>
                      <span className="mt-0.5 block text-sm text-slate">{n.body}</span>
                      <span className="mt-0.5 block text-xs text-slate/70">
                        {meta.label} · {formatDateTime(n.at)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
