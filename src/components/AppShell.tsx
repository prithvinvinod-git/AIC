"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { NAV_ITEMS, homeFor, portalRoles } from "@/lib/nav";
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
  const accessRoles = portalRoles(claims);
  const items = NAV_ITEMS.filter((i) => i.role === "all" || accessRoles.includes(i.role));

  const navLinks = () => (
    <>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-6 py-3 text-sm font-medium transition-colors lg:px-7 lg:text-[15px] ${
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
        <div className="mx-auto flex h-[54px] w-full max-w-[1200px] items-center gap-2 pl-0 pr-4 sm:h-[86px] sm:gap-5 sm:pl-0 sm:pr-6">
          <Link
            href={homeFor(claims)}
            className="flex min-w-0 shrink-0 items-center font-display text-lg font-semibold text-ink sm:text-xl lg:-ml-[150px]"
          >
            <span className="truncate">CampusCare</span>
          </Link>

          <nav className="hidden items-center gap-1.5 lg:ml-[150px] lg:flex">{navLinks()}</nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2.5 lg:flex">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-sm font-semibold text-graphite sm:h-11 sm:w-11 sm:text-base">
                {initials(claims.name)}
              </span>
              <div className="leading-tight">
                <p className="max-w-[180px] truncate text-sm font-medium text-graphite sm:text-[15px]">{claims.name}</p>
                <p className="text-xs text-slate">{ROLE_LABEL[role]}</p>
              </div>
            </div>
            <button
              onClick={() => void logout()}
              className="btn btn-ghost hidden px-3 py-2 text-sm lg:inline-flex sm:px-4"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              <span>Sign out</span>
            </button>
            <button
              className="btn btn-ghost btn-sm lg:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-silver bg-white lg:hidden">
            <div className="mx-auto flex max-w-[1200px] flex-col gap-1 px-4 py-3 sm:px-6">
              <div className="mb-1 flex items-center gap-2.5 border-b border-silver pb-3 sm:hidden">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper text-sm font-semibold text-graphite">
                  {initials(claims.name)}
                </span>
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-[15px] font-medium text-graphite">{claims.name}</p>
                  <p className="text-xs text-slate">{ROLE_LABEL[role]}</p>
                </div>
              </div>
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center justify-between rounded-lg px-4 py-3 text-[15px] font-medium transition-colors ${
                      active ? "bg-ink text-white" : "text-graphite hover:bg-paper"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <div className="mt-1 border-t border-silver pt-2 sm:hidden">
                <button
                  onClick={() => void logout()}
                  className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-left text-[15px] font-medium text-graphite hover:bg-paper"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  Sign out
                </button>
              </div>
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
