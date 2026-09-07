/**
 * Tiny module-scope TTL cache for expensive server reads.
 *
 * Route handlers call `serverCached(key, ttlMs, () => loader())`; the loader
 * runs once per instance and subsequent calls within the TTL reuse the value.
 * `invalidate(keyPrefix)` clears entries so admin edits take effect promptly.
 *
 * NB: on Vercel a module cache is per warm instance, so TTL is a *floor* and
 * invalidation is best-effort across instances. Good enough for the cheap,
 * near-static read endpoints this backs.
 */

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export async function serverCached<V>(
  key: string,
  ttlMs: number,
  loader: () => Promise<V>
): Promise<V> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value as V;
  const value = await loader();
  cache.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export function invalidateServerCache(keyPrefix: string): void {
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(keyPrefix)) cache.delete(key);
  }
}

/** Intended for tests/admin debugging. */
export function clearServerCache(): void {
  cache.clear();
}