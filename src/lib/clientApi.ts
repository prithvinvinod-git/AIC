"use client";

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

async function request<T>(path: string, init: RequestInit, retried: boolean): Promise<T> {
  const headers = new Headers(init.headers);
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, { ...init, headers });
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
 * Authenticated fetch wrapper used by every client-side call. Attaches the
 * current Firebase ID token (set by the auth provider) as a Bearer header.
 */
export async function api<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  return request<T>(path, init, false);
}
