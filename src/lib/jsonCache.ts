"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  cacheGet,
  cacheSet,
  invalidatePaths,
  removeCachedPrefix,
  cloneValue,
} from "./offlineStore";

/**
 * Read-through, stale-while-revalidate JSON cache used by `api()`.
 *
 * Behaviour (per GET path):
 *   - fresh (within TTL)      → resolve cached immediately; background revalidate
 *   - stale (past TTL)        → resolve cached immediately; background revalidate
 *   - missing + online        → fetch from network, populate cache, resolve
 *   - missing + offline       → caller throws a typed `OfflineError`
 *
 * In-flight promises are deduped so concurrent calls for the same path share a
 * single network request. Writes (`api()` non-GET) call `onWrite(path)` which
 * strips the affected prefixes based on a path→prefix table.
 */

export class OfflineError extends Error {
  path: string;
  constructor(path: string) {
    super("You're offline and this data hasn't been cached yet.");
    this.name = "OfflineError";
    this.path = path;
  }
}

/* Per-prefix TTLs (ms). Longest-lived wins when multiple prefixes match. */
const TTLS: { prefix: string; ttl: number }[] = [
  { prefix: "/api/issues", ttl: 15_000 }, // lists (board, jobs, approvals…) — keep near-live
  { prefix: "/api/issue-history", ttl: 60_000 },
  { prefix: "/api/analytics", ttl: 60_000 },
  { prefix: "/api/ai/weekly-insights", ttl: 300_000 },
  { prefix: "/api/ai/at-risk", ttl: 300_000 },
  { prefix: "/api/announcements", ttl: 30_000 },
  { prefix: "/api/admin/users", ttl: 30_000 },
  { prefix: "/api/admin/teams", ttl: 60_000 },
  { prefix: "/api/admin/categories", ttl: 60_000 },
  { prefix: "/api/admin/config", ttl: 30_000 },
  { prefix: "/api/config", ttl: 30_000 },
  { prefix: "/api/categories", ttl: 60_000 },
  { prefix: "/api/teams", ttl: 60_000 },
  { prefix: "/api/notifications", ttl: 15_000 },
  { prefix: "/api/profile", ttl: 15_000 },
  { prefix: "/api/purchases", ttl: 30_000 },
  { prefix: "/api/track", ttl: 60_000 },
  // Default for anything /api that isn't listed above (e.g. issue detail).
  { prefix: "/api", ttl: 20_000 },
];

export function ttlFor(path: string): number {
  let ttl = 20_000;
  for (const rule of TTLS) {
    if (path.startsWith(rule.prefix)) {
      ttl = Math.max(ttl, rule.ttl);
    }
  }
  return ttl;
}

const inFlight = new Map<string, Promise<any>>();
const revalidating = new Set<string>();

async function networkGet<T>(path: string, fetchImpl: () => Promise<T>): Promise<T> {
  if (inFlight.has(path)) return inFlight.get(path)!;
  const p = fetchImpl().finally(() => {
    inFlight.delete(path);
  });
  inFlight.set(path, p);
  return p;
}

/**
 * Primary read. `fetchImpl` performs the actual authenticated network GET.
 * `preferCache` forces a fully-offline read (used by hooks while offline).
 */
export async function cachedGet<T>(
  path: string,
  fetchImpl: () => Promise<T>,
  opts: { force?: boolean; preferCache?: boolean } = {}
): Promise<T> {
  const ttl = ttlFor(path);
  const entry = await cacheGet<T>(path);

  // If we're told to prefer cache (offline mode) and have something, serve it.
  if (entry && (opts.preferCache || opts.force)) {
    return cloneValue(entry.value);
  }

  if (!navigator.onLine && !opts.force) {
    if (entry) return cloneValue(entry.value);
    throw new OfflineError(path);
  }

  const fresh = entry ? Date.now() - entry.fetchedAt < ttl : false;

  // Fresh cache: serve it. (No background revalidate here — otherwise the
  // cache-change listener in hooks would reload → revalidate → loop.)
  if (entry && fresh) {
    return cloneValue(entry.value);
  }

  // Stale cache: serve it, then revalidate unless we're already doing so.
  if (entry) {
    if (!revalidating.has(path)) {
      void revalidate(path, fetchImpl, ttl);
    }
    return cloneValue(entry.value);
  }

  // Nothing cached — must hit the network.
  const res = await networkGet(path, fetchImpl);
  await cacheSet(path, res, ttl);
  return res;
}

async function revalidate<T>(path: string, fetchImpl: () => Promise<T>, ttl: number) {
  if (revalidating.has(path)) return;
  revalidating.add(path);
  try {
    const res = await networkGet(path, fetchImpl);
    await cacheSet(path, res, ttl);
  } catch {
    // Silent — keep the stale entry.
  } finally {
    revalidating.delete(path);
  }
}

/** Bypass the cache entirely for a live network read, then update the cache. */
export async function forceRefresh<T>(path: string, fetchImpl: () => Promise<T>): Promise<T> {
  const res = await networkGet(path, fetchImpl);
  await cacheSet(path, res, ttlFor(path));
  return res;
}

/**
 * After any successful non-GET mutation, strip the cache entries that the
 * write may have invalidated. Rule table maps write-path → read-path prefixes.
 */
export function onWrite(path: string) {
  const p = path;
  const toStrip: string[] = [];

  // Any issue mutation invalidates all issue lists + the detail for the id.
  if (p.startsWith("/api/issues")) {
    toStrip.push("/api/issues"); // lists + board scope
    if (p.startsWith("/api/issues/")) {
      const id = p.split("/")[2];
      if (id && !id.startsWith("?")) toStrip.push(`/api/issues/${id}`);
    }
  }
  if (p.startsWith("/api/announcements")) toStrip.push("/api/announcements");
  if (p.startsWith("/api/admin/users")) toStrip.push("/api/admin/users");
  if (p.startsWith("/api/auth/provision")) toStrip.push("/api/admin/users", "/api/profile");
  if (p.startsWith("/api/admin/teams")) toStrip.push("/api/admin/teams", "/api/teams");
  if (p.startsWith("/api/admin/categories")) toStrip.push("/api/admin/categories", "/api/categories");
  if (p.startsWith("/api/admin/config")) {
    toStrip.push("/api/admin/config", "/api/config", "/api/analytics", "/api/issue-history");
  }
  if (p.startsWith("/api/config")) toStrip.push("/api/config");
  if (p.startsWith("/api/profile")) toStrip.push("/api/profile");
  if (p.startsWith("/api/notifications")) toStrip.push("/api/notifications");

  if (toStrip.length) invalidatePaths(toStrip);
}

/** Delete a single path (used after a direct state rewrite, e.g. POST with no cache write). */
export function bustPath(path: string) {
  void removeCachedPrefix(path);
}