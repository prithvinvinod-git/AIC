"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/clientApi";
import { soundEnabled } from "@/lib/soundPref";
import type { Notification } from "@/lib/types";

export interface NotificationItem extends Notification {
  id: string;
}

let audioCtx: AudioContext | null = null;

/** Short, quiet two-tone beep via Web Audio — best-effort, never throws. */
function playBeep() {
  try {
    const Ctor =
      typeof AudioContext !== "undefined"
        ? AudioContext
        : (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = audioCtx ?? new Ctor();
    audioCtx = ctx;
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(660, t + 0.08);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  } catch {
    // Beep is best-effort; stay silent if audio is unavailable.
  }
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
  const seenIds = useRef<Set<string> | null>(null);

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
          if (fresh.length > 0 && !document.hidden && soundEnabled()) playBeep();
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
