"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { useNotifications, type NotificationItem } from "@/hooks/useNotifications";
import { NOTIFICATION_FALLBACK_META, NOTIFICATION_META } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { Loading } from "@/components/ui/States";

function metaFor(type: string) {
  return NOTIFICATION_META[type] || NOTIFICATION_FALLBACK_META;
}

/**
 * Navbar notification bell with a live unread badge and a dropdown preview of
 * the latest notifications. Clicking an item opens its target and marks it
 * read; the footer exposes "Mark all read" and the full page.
 */
export default function NotificationBell() {
  const { items, unread, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openItem = (n: NotificationItem) => {
    setOpen(false);
    void markRead(n.id);
    if (n.link) void router.push(n.link);
  };

  const preview = (items || []).slice(0, 8);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-silver bg-white text-graphite transition-colors hover:border-stone hover:bg-paper sm:h-11 sm:w-11"
      >
        <Bell className="h-[21px] w-[21px]" aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center whitespace-nowrap rounded-full bg-[#c0392b] px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-silver bg-white px-2.5 shadow-lg"
        >
          <div className="flex items-center justify-between gap-2 border-b border-silver px-4 py-3">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#2563eb] transition-colors hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden />
              Mark all read
            </button>
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {items === null ? (
              <Loading label="Loading…" />
            ) : preview.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate">You&apos;re all caught up.</p>
            ) : (
              preview.map((n) => {
                const meta = metaFor(n.type);
                const Icon = meta.icon;
                return (
                  <button
                    key={n.id}
                    role="menuitem"
                    type="button"
                    onClick={() => openItem(n)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-paper"
                  >
                    <span className={`mt-0.5 shrink-0 ${meta.iconClass}`}>
                      <Icon className="h-[15px] w-[15px]" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-graphite">{n.title}</span>
                      <span className="block truncate text-xs text-slate">{n.body}</span>
                      <span className="mt-0.5 block text-[11px] text-slate/70">{timeAgo(n.at)}</span>
                    </span>
                    {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#2563eb]" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-silver p-1.5">
            <Link
              href="/notifications"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2.5 text-center text-sm font-medium text-[#2563eb] transition-colors hover:bg-paper"
            >
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
