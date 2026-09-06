"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { filterNavItems } from "@/lib/nav";

/**
 * Floating mobile navigation. A round button pinned to the bottom-right of the
 * viewport (15px inset) opens a popup menu in the same style as the profile
 * pill dropdown. Shown only below the `lg` breakpoint, where the inline navbar
 * is hidden.
 */
export default function MobileNav() {
  const { claims } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!claims) return null;

  const items = filterNavItems(claims);
  const active = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

  return (
    <div
      ref={ref}
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+16px)] right-[calc(env(safe-area-inset-right)+16px)] z-40 lg:hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu"
        className={`flex h-14 w-14 items-center justify-center rounded-full border border-silver bg-white shadow-card transition-colors will-change-transform ${
          open ? "border-stone" : "hover:border-stone hover:bg-paper"
        }`}
      >
        <Menu className="h-5 w-5 text-ink" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full right-0 z-50 mb-2 w-60 rounded-2xl border border-silver bg-white p-1.5 shadow-lg"
        >
          <div className="max-h-[60vh] overflow-y-auto">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active(item.href) ? "bg-accent-soft text-accent" : "text-graphite hover:bg-paper"
                }`}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0 text-slate" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {active(item.href) && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
