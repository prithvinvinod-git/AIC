"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Persistent per-user offline cache + pending-write queue, backed by IndexedDB.
 *
 * Two object stores in one tiny DB (`servox-offline`):
 *   - `kv`:  JSON responses keyed by `{uid}:{path}` with { value, fetchedAt, ttlMs, path }
 *   - `writes`: pending non-GET mutations { id, url, init, method, enqueuedAt }
 *
 * The store is the single source of truth for the offline UI. `api()` fills it
 * on every successful GET and reads it when offline; the sync queue drains it
 * when connectivity returns. Everything is namespaced per user so account
 * switches never leak data (cleared on sign-out / user change).
 *
 * Also keeps a small in-memory hot map + event emitter so hooked feeds can
 * re-render the moment a relevant cache entry is invalidated.
 */

export interface CacheEntry<T = unknown> {
  value: T;
  fetchedAt: number;
  ttlMs: number;
  path: string;
}

/** Serializable subset of RequestInit suitable for IndexedDB. */
export interface SerializableInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface PendingWrite {
  id: string;
  url: string;
  init: SerializableInit;
  method: string;
  enqueuedAt: number;
}

type Listener = (path?: string) => void;

const DB_NAME = "servox-offline";
const KV = "kv";
const WRITES = "writes";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;
let uid: string | null = null;
let enabled = true;

const hot = new Map<string, CacheEntry<any>>();
const listeners = new Set<Listener>();

/** Set the active user namespace. Call on auth change / sign-out. */
export function setOfflineUser(next: string | null) {
  if (uid && next !== uid) {
    // Switching accounts — purge the previous user's entries from the hot map.
    const prefix = `${uid}:`;
    for (const k of Array.from(hot.keys())) if (k.startsWith(prefix)) hot.delete(k);
  }
  uid = next;
}

export function getOfflineUser(): string | null {
  return uid;
}

/** Disable IndexedDB writes (e.g. private mode blocked). Memory-only cache remains. */
export function setOfflineStoreEnabled(v: boolean) {
  enabled = v;
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
      if (!db.objectStoreNames.contains(WRITES)) db.createObjectStore(WRITES);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function objStore(store: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDb().then((db) => db.transaction(store, mode).objectStore(store));
}

function reqAsPromise<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function durableKey(path: string): string {
  return `${uid ?? "anon"}:${path}`;
}

/* ---------------- listeners ---------------- */

export function onCacheChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(path?: string) {
  listeners.forEach((fn) => fn(path));
}

/* ---------------- kv: read / write / invalidate ---------------- */

export async function cacheGet<T>(path: string): Promise<CacheEntry<T> | null> {
  const k = durableKey(path);
  if (hot.has(k)) return hot.get(k) as CacheEntry<T>;
  let entry: CacheEntry<T> | null = null;
  if (typeof indexedDB !== "undefined" && enabled) {
    try {
      const store = await objStore(KV, "readonly");
      entry = await reqAsPromise<CacheEntry<T> | null>(store.get(k));
      if (entry) hot.set(k, entry);
    } catch {
      // IndexedDB unavailable — fall back to memory only.
    }
  }
  return entry;
}

export async function cacheSet<T>(path: string, value: T, ttlMs: number): Promise<void> {
  const entry: CacheEntry<T> = { value, fetchedAt: Date.now(), ttlMs, path };
  const k = durableKey(path);
  hot.set(k, entry);
  emit(path);
  if (typeof indexedDB !== "undefined" && enabled) {
    try {
      const store = await objStore(KV, "readwrite");
      await reqAsPromise(store.put(entry, k));
    } catch {
      // memory-only
    }
  }
}

/** Age in ms of a cache entry, or Infinity if absent. */
export async function cacheAge(path: string): Promise<number> {
  const entry = await cacheGet(path);
  return entry ? Date.now() - entry.fetchedAt : Infinity;
}

/** True if the entry is present and newer than its TTL (ttl 0 = treat as fresh). */
export async function isCacheFresh(path: string): Promise<boolean> {
  const entry = await cacheGet(path);
  if (!entry) return false;
  if (entry.ttlMs <= 0) return true;
  return Date.now() - entry.fetchedAt < entry.ttlMs;
}

export async function removeCached(path: string): Promise<void> {
  const k = durableKey(path);
  hot.delete(k);
  emit(path);
  if (typeof indexedDB !== "undefined" && enabled) {
    try {
      const store = await objStore(KV, "readwrite");
      await reqAsPromise(store.delete(k));
    } catch {
      // best-effort
    }
  }
}

/** Delete every cache entry whose durable key starts with the given prefix. */
export async function removeCachedPrefix(prefix: string): Promise<void> {
  const seed = durableKey(prefix);
  for (const k of Array.from(hot.keys())) if (k.startsWith(seed)) hot.delete(k);
  if (typeof indexedDB !== "undefined" && enabled) {
    try {
      const store = await objStore(KV, "readwrite");
      const cursorReq = store.openCursor();
      await new Promise<void>((resolve, reject) => {
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor) {
            if (typeof cursor.key === "string" && cursor.key.startsWith(seed)) cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });
    } catch {
      // best-effort
    }
  }
  emit(prefix);
}

/** Invalidates several path prefixes at once (e.g. after a write). */
export function invalidatePaths(paths: string[]) {
  for (const p of paths) void removeCachedPrefix(p);
}

/* ---------------- pending writes queue ---------------- */

/**
 * Queue a non-GET mutation for offline-safety. `init` may be a full
 * `RequestInit`; only the serializable parts are persisted.
 */
export async function enqueueWrite(record: {
  url: string;
  init: RequestInit | SerializableInit;
  method: string;
  enqueuedAt: number;
}): Promise<PendingWrite> {
  const item: PendingWrite = {
    id: (crypto as any)?.randomUUID?.() ?? String(Date.now() + Math.random()),
    url: record.url,
    init: normalizeInit(record.init),
    method: record.method,
    enqueuedAt: record.enqueuedAt,
  };
  if (typeof indexedDB !== "undefined" && enabled) {
    try {
      const store = await objStore(WRITES, "readwrite");
      await reqAsPromise(store.put(item, item.id));
    } catch {
      // queue lost — will retry via urgent path
    }
  }
  emit("@writes");
  return item;
}

/** Collapse any Headers/array-header forms into a plain record for storage. */
function normalizeInit(init: SerializableInit | RequestInit): SerializableInit {
  const headers: Record<string, string> = {};
  if (init.headers instanceof Headers) {
    init.headers.forEach((v, k) => {
      headers[k] = v;
    });
  } else if (Array.isArray(init.headers)) {
    for (const [k, v] of init.headers) headers[k] = String(v);
  } else if (init.headers) {
    Object.assign(headers, init.headers as Record<string, string>);
  }
  return {
    method: init.method,
    headers,
    body: typeof init.body === "string" ? init.body : undefined,
  };
}

export async function listWrites(): Promise<PendingWrite[]> {
  if (typeof indexedDB !== "undefined" && enabled) {
    try {
      const store = await objStore(WRITES, "readonly");
      return reqAsPromise<PendingWrite[]>(store.getAll());
    } catch {}
  }
  return [];
}

export async function dropWrite(id: string): Promise<void> {
  if (typeof indexedDB !== "undefined" && enabled) {
    try {
      const store = await objStore(WRITES, "readwrite");
      await reqAsPromise(store.delete(id));
    } catch {}
  }
  emit("@writes");
}

export async function clearWrites(): Promise<void> {
  if (typeof indexedDB !== "undefined" && enabled) {
    try {
      const store = await objStore(WRITES, "readwrite");
      await reqAsPromise(store.clear());
    } catch {}
  }
  emit("@writes");
}

export async function pendingWriteCount(): Promise<number> {
  return (await listWrites()).length;
}

/* ---------------- scope teardown ---------------- */

/** Wipe all cached JSON for the current user (hot + persisted). Queue preserved. */
export async function clearCachedData(): Promise<void> {
  const seed = `${uid ?? "anon"}:`;
  if (typeof indexedDB !== "undefined" && enabled) {
    try {
      const store = await objStore(KV, "readwrite");
      const cursorReq = store.openCursor();
      await new Promise<void>((resolve, reject) => {
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor) {
            if (typeof cursor.key === "string" && cursor.key.startsWith(seed)) cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });
    } catch {
      // best-effort
    }
  }
  for (const k of Array.from(hot.keys())) if (k.startsWith(seed)) hot.delete(k);
  emit();
}

/** Purge the entire DB (sign-out). Best-effort. */
export async function nuke(): Promise<void> {
  if (typeof indexedDB !== "undefined" && enabled) {
    try {
      const s = await objStore(KV, "readwrite");
      await reqAsPromise(s.clear());
    } catch {}
    try {
      const s2 = await objStore(WRITES, "readwrite");
      await reqAsPromise(s2.clear());
    } catch {}
  }
  hot.clear();
  emit("@writes");
}

/** Deep-clone a cached value so callers can't mutate the shared entry. */
export function cloneValue<T>(v: T): T {
  return v == null ? v : (JSON.parse(JSON.stringify(v)) as T);
}