"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, SlidersHorizontal, UserPen } from "lucide-react";
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
    <div ref={ref} className="relative mr-[-100px] shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`group flex items-center rounded-full border bg-white pl-1 pr-3 py-1 transition-all ${
          open ? "border-stone shadow-sm" : "border-silver hover:border-stone hover:bg-paper"
        }`}
      >
        {user.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.photoURL}
            alt=""
            referrerPolicy="no-referrer"
            className="h-[38px] w-[38px] shrink-0 rounded-full object-cover ring-1 ring-black/5 sm:h-[38px] sm:w-[38px]"
          />
        ) : (
          <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white sm:h-[38px] sm:w-[38px] sm:text-base">
            {initials(claims.name)}
          </span>
        )}
        <span className="ml-2.5 flex min-w-0 flex-col items-start leading-tight sm:ml-3">
          <span className="max-w-[90px] truncate text-sm font-medium text-graphite sm:max-w-[120px]">
            {claims.name}
          </span>
          <span className="hidden text-xs text-slate sm:block">{ROLE_LABEL[claims.role]}</span>
        </span>
        <ChevronDown
          className={`ml-1.5 h-4 w-4 shrink-0 text-stone transition-transform duration-200 ${
            open ? "rotate-180" : "group-hover:-translate-y-px"
          }`}
          aria-hidden
        />
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
            <UserPen className="h-3.5 w-3.5 text-slate" aria-hidden />
            Profile edit
          </Link>
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-graphite transition-colors hover:bg-paper"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate" aria-hidden />
            Settings
          </Link>
          <div className="my-1.5 h-px bg-silver" />
          <button
            role="menuitem"
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#c0392b] transition-colors hover:bg-[#fdf0ef]"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
