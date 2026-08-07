"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUser, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ROLE_LABEL } from "@/lib/constants";
import { initials } from "@/lib/format";

/**
 * Navbar profile pill (avatar + name + settings icon). Toggling it opens a
 * rounded dropdown with Profile edit / Settings / Sign out.
 */
export default function ProfileMenu() {
  const { user, claims, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

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

  if (!user || !claims) return null;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex max-w-[230px] items-center gap-2 rounded-full border border-silver bg-white py-1 pl-1 pr-2 transition-colors hover:border-stone hover:bg-paper sm:gap-2.5 sm:py-1.5 sm:pr-3"
      >
        {user.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.photoURL}
            alt=""
            referrerPolicy="no-referrer"
            className="h-8 w-8 shrink-0 rounded-full object-cover sm:h-10 sm:w-10"
          />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white sm:h-10 sm:w-10 sm:text-sm">
            {initials(claims.name)}
          </span>
        )}
        <span className="flex min-w-0 flex-col items-start leading-tight">
          <span className="max-w-[90px] truncate text-sm font-medium text-graphite sm:max-w-[110px]">
            {claims.name}
          </span>
          <span className="hidden text-xs text-slate sm:block">{ROLE_LABEL[claims.role]}</span>
        </span>
        <Settings className="h-4 w-4 shrink-0 text-slate" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-silver bg-white p-1.5 shadow-lg"
        >
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-graphite transition-colors hover:bg-paper"
          >
            <CircleUser className="h-4 w-4 text-slate" aria-hidden />
            Profile edit
          </Link>
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-graphite transition-colors hover:bg-paper"
          >
            <Settings className="h-4 w-4 text-slate" aria-hidden />
            Settings
          </Link>
          <div className="my-1.5 h-px bg-silver" />
          <button
            role="menuitem"
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#c0392b] transition-colors hover:bg-[#fdf0ef]"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
