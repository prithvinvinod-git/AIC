"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/clientApi";
import type { Notification } from "@/lib/types";

export interface NotificationItem extends Notification {
  id: string;
}

/**
 * Live, real-time view of the current user's notifications via a Firestore
 * `onSnapshot` listener on `notifications/{uid}/items` (owner-only reads are
 * permitted by the security rules). Marking reads still goes through the
 * `POST /api/notifications` route, which stays the source of truth for writes.
 */
export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) {
      setItems(null);
      setUnread(0);
      return;
    }

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
