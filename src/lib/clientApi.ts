"use client";

import { cachedGet, forceRefresh, onWrite } from "@/lib/jsonCache";
import {
  enqueueWrite,
  listWrites,
  dropWrite,
} from "@/lib/offlineStore";

let authToken: string | null = null;
let refreshTokenHandler: (() => Promise<string | null>) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

/** Called by AuthProvider so `api()` can refresh an expired ID token on 401. */
export function setTokenRefreshHandler(handler: (() => Promise<string | null>) | null) {
  refreshTokenHandler = handler;
}

export interface ApiOptions {
  /** Bypass the read-through cache and hit the network, then refresh cache. */
  force?: boolean;
  /** Skip write-queue buffering for a non-GET (used by the sync flush itself). */
  fromQueue?: boolean;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

/** Thrown by `api()` when a mutation was buffered but the network is down. */
export class QueuedOfflineError extends Error {
  constructor() {
    super("You're offline — your change was saved and will sync when you reconnect.");
    this.name = "QueuedOfflineError";
  }
}

/**
 * Thrown when the fetch itself never produced a response (offline, DNS, CORS,
 * server unreachable, or an aborted background request). Reads surface this so
 * callers get one typed, human-readable error instead of a bare
 * `TypeError: Failed to fetch`; mutations convert it into
 * `QueuedOfflineError` so the write can be queued.
 */
export class NetworkError extends Error {
  path: string;
  constructor(path: string) {
    super("You're offline — check your connection and try again.");
    this.name = "NetworkError";
    this.path = path;
  }
}

/** True when a fetch failure is a network transport error (not an HTTP status). */
export function isNetworkError(e: unknown): boolean {
  return (
    e instanceof NetworkError ||
    e instanceof TypeError ||
    (e instanceof Error && /failed to fetch|network/i.test(e.message))
  );
}

/** Build headers for a request, attaching the current auth token. */
function prepareHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers);
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

async function request<T>(path: string, init: RequestInit, retried: boolean): Promise<T> {
  const headers = prepareHeaders(init);
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch {
    // Transport failure — no response was ever received. Normalize it so a
    // bare `TypeError: Failed to fetch` never escapes to callers or the
    // console; `isNetworkError` still recognises it for the write-queue path.
    throw new NetworkError(path);
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;

  // The ID token may have expired mid-session. Refresh once and retry before
  // giving up, so long sessions don't die silently.
  if (res.status === 401 && !retried && refreshTokenHandler) {
    try {
      const newToken = await refreshTokenHandler();
      if (newToken) {
        return request<T>(path, init, true);
      }
    } catch {
      // Refresh failed — fall through and surface the original 401.
    }
  }

  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : null) || `Request failed (${res.status})`;
    throw new ApiError(message, res.status, body || undefined);
  }
  return body as T;
}

/**
 * Authenticated fetch wrapper used by every client-side call.
 *
 * GETs go through a read-through, stale-while-revalidate cache (IndexedDB via
 * `offlineStore`) keyed per user — see `src/lib/jsonCache.ts`. Non-GETs are
 * buffered into the pending-write queue so offline actions survive a dropped
 * connection and replay in order on reconnect (server remains authoritative).
 */
export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
  opts: ApiOptions = {}
): Promise<T> {
  const method = (init.method || "GET").toUpperCase();

  // ---- mutations ----
  if (method !== "GET") {
    if (!opts.fromQueue) {
      await enqueueWrite({
        url: path,
        init,
        method,
        enqueuedAt: Date.now(),
      });
    }
    try {
      const res = await request<T>(path, init, false);
      if (!opts.fromQueue) await dropQueuedForWrite(path, init);
      return res;
    } catch (e) {
      if (isNetworkError(e) || navigator.onLine === false) {
        // Server unreachable — stays queued for later sync.
        throw new QueuedOfflineError();
      }
      if (!opts.fromQueue) {
        // Server answered (validation / permission) — terminal, drop the copy.
        await dropWriteForMatch(path, init);
      }
      throw e;
    }
  }

  // ---- reads ----
  const fetchImpl = () => request<T>(path, init, false);
  if (opts.force) return forceRefresh<T>(path, fetchImpl);
  return cachedGet<T>(path, fetchImpl);
}

/**
 * Drop a buffered write after the server accepted it. Matches the enqueued
 * copy by path + body to avoid deleting an unrelated queued write.
 */
async function dropQueuedForWrite(path: string, init: RequestInit): Promise<void> {
  await dropWriteForMatch(path, init);
}

async function dropWriteForMatch(path: string, init: RequestInit): Promise<void> {
  const pending = await listWrites();
  const body = typeof init.body === "string" ? init.body : undefined;
  const match = pending.find(
    (w) =>
      w.url === path &&
      (w.method || "POST").toUpperCase() === (init.method || "POST").toUpperCase() &&
      (body === undefined || w.init.body === body)
  );
  if (match) await dropWrite(match.id);
  onWrite(path);
}

/** Replay the queued writes in order. Resolves once the queue is empty. */
export async function flushPendingWrites(): Promise<{ sent: number; failed: number; dropped: number }> {
  let sent = 0;
  let failed = 0;
  let dropped = 0;
  const pending = await listWrites();
  for (const w of pending) {
    try {
      const init: RequestInit = {
        method: w.method,
        headers: w.init.headers,
        body: w.init.body,
      };
      await request(w.url, init, false);
      await dropWrite(w.id);
      onWrite(w.url);
      sent++;
    } catch (e) {
      if (isNetworkError(e) || navigator.onLine === false) {
        failed++;
        break; // still offline — stop; remaining queue replays on next flush.
      }
      // Server rejected — terminal; drop so we don't retry forever.
      await dropWrite(w.id);
      dropped++;
    }
  }
  return { sent, failed, dropped };
}