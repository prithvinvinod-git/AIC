"use client";

import { useEffect, useState } from "react";
import { getLastAuthMethod, type AuthMethod } from "@/lib/lastAuthMethod";

/** Small "Last used" badge shown at the top-right of an auth-method button.
 *  Place inside a `relative` wrapper around the button. */
export function LastUsedBadge({ method }: { method: AuthMethod }) {
  const [last, setLast] = useState<AuthMethod | null>(() => getLastAuthMethod());

  useEffect(() => {
    const onStorage = () => setLast(getLastAuthMethod());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (last !== method) return null;

  return (
    <span className="absolute -top-2.5 right-2 z-10 rounded-md border border-silver bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent shadow-sm">
      Last used
    </span>
  );
}
