"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import ProfileMenu from "@/components/auth/ProfileMenu";
import NotificationBell from "@/components/notifications/NotificationBell";
import { NAV_ITEMS, homeFor, portalRoles } from "@/lib/nav";

/** App navbar shared by the `(app)` shell and the home Dashboard. */
export default function AppHeader() {
  const { claims, logout } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuOpen(false);
  }, [pathname]);

  if (!claims) return null;

  const accessRoles = portalRoles(claims);
  const items = NAV_ITEMS.filter((i) => {
    if (i.roles) return i.roles.some((r) => accessRoles.includes(r));
    return i.role === "all" || (i.role ? accessRoles.includes(i.role) : false);
  });

  const active = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

  const navLinks = () => (
    <>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-colors lg:px-7 lg:text-[15px] ${
            active(item.href) ? "bg-accent-soft text-accent" : "text-slate hover:bg-smoke hover:text-graphite"
          }`}
        >
          <item.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {item.label}
        </Link>
      ))}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-silver bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-[48px] w-full max-w-page items-center gap-2 pl-3 pr-2 sm:h-[70px] sm:gap-5 sm:pl-4 sm:pr-3">
        <Link
          href={homeFor(claims)}
          className="flex min-w-0 shrink-0 items-center gap-2 font-brand text-lg leading-none text-ink sm:text-xl"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/servoxlogo.png" alt="Servox" className="h-[32px] w-auto shrink-0 sm:h-[36px]" />
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-1.5 lg:flex">{navLinks()}</nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <button
            className="btn btn-ghost btn-sm lg:hidden!"
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
        <nav className="border-t border-silver bg-white lg:hidden">
          <div className="mx-auto flex max-w-page flex-col gap-1 px-4 py-3 sm:px-6">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center justify-between rounded-lg px-4 py-3 text-[15px] font-medium transition-colors ${
                  active(item.href) ? "bg-accent-soft text-accent" : "text-graphite hover:bg-paper"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <item.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {item.label}
                </span>
              </Link>
            ))}
            <div className="mt-1 border-t border-silver pt-2 lg:hidden">
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
  );
}
