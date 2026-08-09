"use client";

export type AuthMethod = "email" | "google";

export const LAST_AUTH_METHOD_KEY = "servox_last_auth_method";

/** The last auth method the user signed in with, if we have recorded one. */
export function getLastAuthMethod(): AuthMethod | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(LAST_AUTH_METHOD_KEY);
  return value === "email" || value === "google" ? value : null;
}

export function setLastAuthMethod(method: AuthMethod): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_AUTH_METHOD_KEY, method);
}
