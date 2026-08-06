"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HardHat, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { NAV_ITEMS, ROLE_HOME } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/constants";
import { initials } from "@/lib/format";
import { Loading } from "@/components/ui/States";

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, claims, ready, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user || !claims) {
      router.replace("/login");
    }
  }, [ready, user, claims, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuOpen(false);
  }, [pathname]);

  if (!ready) return <Loading label="Checking session…" />;
  if (!user || !claims) return null;

  const role = claims.role;
  const items = NAV_ITEMS.filter((i) => i.role === role || i.role === "all");

  const navLinks = () => (
    <>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-ink text-white" : "text-slate hover:bg-paper hover:text-graphite"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b border-silver bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-4 px-4 sm:px-6">
          <Link href={ROLE_HOME[role]} className="flex shrink-0 items-center gap-2 font-display text-lg font-semibold text-ink">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink text-white">
              <HardHat className="h-4 w-4" aria-hidden />
            </span>
            CampusCare
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">{navLinks()}</nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-paper text-xs font-semibold text-graphite">
                {initials(claims.name)}
              </span>
              <div className="leading-tight">
                <p className="text-sm font-medium text-graphite">{claims.name}</p>
                <p className="text-xs text-slate">{ROLE_LABEL[role]}</p>
              </div>
            </div>
            <button
              onClick={() => void logout()}
              className="btn btn-ghost btn-sm"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
            </button>
            <button
              className="btn btn-ghost btn-sm lg:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-silver bg-white px-4 py-3 lg:hidden">
            <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-1">
              {navLinks()}
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
