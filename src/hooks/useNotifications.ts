"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/clientApi";
import { playBeep, soundEnabled } from "@/lib/soundPref";
import type { Notification } from "@/lib/types";

export interface NotificationItem extends Notification {
  id: string;
}

/**
 * Live, real-time view of the current user's notifications via a Firestore
 * `onSnapshot` listener on `notifications/{uid}/items` (owner-only reads are
 * permitted by the security rules). Marking reads still goes through the
 * `POST /api/notifications` route, which stays the source of truth for writes.
 *
 * `onNew` fires with the genuinely-new notifications whenever they arrive while
 * the tab is visible — the same detection that drives the beep.
 */
export function useNotifications(onNew?: (items: NotificationItem[]) => void) {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [unread, setUnread] = useState(0);
  const seenIds = useRef<Set<string> | null>(null);
  const onNewRef = useRef(onNew);

  useEffect(() => {
    onNewRef.current = onNew;
  });

  useEffect(() => {
    if (!user) {
      setItems(null);
      setUnread(0);
      seenIds.current = null;
      return;
    }

    seenIds.current = null;

    const db = getClientDb();
    const q = query(
      collection(db, "notifications", user.uid, "items"),
      orderBy("at", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: NotificationItem[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Notification, "id">),
        }));
        const ids = new Set(list.map((n) => n.id));
        const initialized = seenIds.current !== null;
        if (initialized) {
          const fresh = list.filter((n) => !seenIds.current!.has(n.id));
          if (fresh.length > 0 && !document.hidden) {
            if (soundEnabled()) playBeep();
            onNewRef.current?.(fresh);
          }
        }
        seenIds.current = ids;
        setItems(list);
        setUnread(list.filter((n) => !n.isRead).length);
      },
      // If the live listener fails (rules/permissions hiccup), fall back to
      // the REST API so the bell still works.
      () => {
        api<{ notifications: Notification[]; unread: number }>("/api/notifications")
          .then((res) => {
            const list = res.notifications.map((n) => ({
              id: n.id || "",
              ...n,
            }));
            setItems(list);
            setUnread(res.unread);
          })
          .catch(() => {
            setItems([]);
            setUnread(0);
          });
      }
    );

    return unsub;
  }, [user]);

  const markRead = async (id: string) => {
    setItems((prev) => prev?.map((n) => (n.id === id ? { ...n, isRead: true } : n)) ?? prev);
    setUnread((u) => Math.max(0, u - 1));
    try {
      await api("/api/notifications", { method: "POST", body: JSON.stringify({ id }) });
    } catch {
      // Optimistic update stands; the server write is idempotent.
    }
  };

  const markAllRead = async () => {
    setItems((prev) => prev?.map((n) => ({ ...n, isRead: true })) ?? prev);
    setUnread(0);
    try {
      await api("/api/notifications", { method: "POST", body: JSON.stringify({}) });
    } catch {
      // Optimistic update stands.
    }
  };

  return { items, unread, markRead, markAllRead };
}
