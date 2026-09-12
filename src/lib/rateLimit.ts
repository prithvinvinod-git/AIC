import type { NextRequest } from "next/server";

/**
 * In-memory sliding-window rate limiter.
 *
 * Best-effort: state lives per warm server instance, so it is not shared
 * across Vercel lambda instances. That is acceptable as a first line of
 * defence for anonymous public endpoints (tracking links, image blobs) —
 * authenticated routes already enforce RBAC server-side.
 */
const buckets = new Map<string, number[]>();
let sweepAt = 0;

export interface RateLimitOptions {
  /** Max requests per window per key. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

/** Returns true when the caller has exceeded the limit and must be refused. */
export function isRateLimited(key: string, opts: RateLimitOptions): boolean {
  const now = Date.now();

  // Periodic best-effort sweep so abandoned keys don't leak memory forever.
  if (now >= sweepAt) {
    for (const [k, times] of buckets) {
      const cutoff = now - opts.windowMs;
      while (times.length && times[0] <= cutoff) times.shift();
      if (times.length === 0) buckets.delete(k);
    }
    sweepAt = now + 60_000;
  }

  let times = buckets.get(key);
  if (!times) {
    times = [];
    buckets.set(key, times);
  }
  const cutoff = now - opts.windowMs;
  while (times.length && times[0] <= cutoff) times.shift();
  if (times.length >= opts.limit) return true;
  times.push(now);
  return false;
}

/** Best available client IP. On Vercel the request passed through the
 *  platform proxy (`x-vercel-proxied: 1`), which *appends* to
 *  `x-forwarded-for` — so the last hop is the real client and any earlier
 *  entries are client-spoofable and ignored. Outside the proxy (local dev)
 *  the header is not trustworthy either way, so we keep the legacy first-hop
 *  behaviour only for local runs. */
export function clientIp(req: NextRequest): string {
  const viaProxy = req.headers.get("x-vercel-proxied") === "1";
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return viaProxy ? parts[parts.length - 1] : parts[0];
  }
  return req.headers.get("x-real-ip") || "unknown";
}