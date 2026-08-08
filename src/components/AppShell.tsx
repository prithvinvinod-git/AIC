"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import ProfileMenu from "@/components/auth/ProfileMenu";
import NotificationBell from "@/components/notifications/NotificationBell";
import { NAV_ITEMS, homeFor, portalRoles } from "@/lib/nav";
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

  const accessRoles = portalRoles(claims);
  const items = NAV_ITEMS.filter((i) => {
    if (i.roles) return i.roles.some((r) => accessRoles.includes(r));
    return i.role === "all" || (i.role ? accessRoles.includes(i.role) : false);
  });

  const navLinks = () => (
    <>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-colors lg:px-7 lg:text-[15px] ${
              active ? "bg-ink text-white" : "text-slate hover:bg-paper hover:text-graphite"
            }`}
          >
            <item.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b border-silver bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-[48px] w-full max-w-[1200px] items-center gap-2 pl-0 pr-2 sm:h-[70px] sm:gap-5 sm:pl-0 sm:pr-3">
          <Link
            href={homeFor(claims)}
            className="flex min-w-0 shrink-0 items-center gap-2 font-brand text-lg leading-none text-ink sm:text-xl lg:-ml-[150px]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/servoxlogo.png" alt="Servox" className="h-[32px] w-auto shrink-0 sm:h-[36px]" />
          </Link>

          <nav className="hidden items-center gap-1.5 lg:ml-[150px] md:flex">{navLinks()}</nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button
              className="btn btn-ghost btn-sm md:hidden!"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-3.5 w-3.5" aria-hidden /> : <Menu className="h-3.5 w-3.5" aria-hidden />}
            </button>
            <NotificationBell />
            <ProfileMenu />
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-silver bg-white md:hidden">
            <div className="mx-auto flex max-w-[1200px] flex-col gap-1 px-4 py-3 sm:px-6">
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
                    <span className="flex items-center gap-2.5">
                      <item.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {item.label}
                    </span>
                  </Link>
                );
              })}
              <div className="mt-1 border-t border-silver pt-2 md:hidden">
                <button
                  onClick={() => void logout()}
                  className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-left text-[15px] font-medium text-graphite hover:bg-paper"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden />
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
