"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import ProfileMenu from "@/components/auth/ProfileMenu";
import NotificationBell from "@/components/notifications/NotificationBell";
import { filterNavItems, homeFor } from "@/lib/nav";

/** App navbar shared by the `(app)` shell and the home Dashboard. On mobile
 *  the nav links are hidden and the floating MobileNav button (AppShell)
 *  provides access instead. */
export default function AppHeader() {
  const { claims } = useAuth();
  const pathname = usePathname();

  if (!claims) return null;

  const items = filterNavItems(claims);

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
      <div className="mx-auto flex h-[48px] w-full max-w-page items-center gap-2 pl-3 pr-2 sm:h-[70px] sm:gap-5 sm:pl-4 sm:pr-3 lg:max-w-none lg:pl-6 lg:pr-4">
        <Link
          href={homeFor(claims)}
          className="flex min-w-0 shrink-0 items-center gap-2 font-brand text-lg leading-none text-ink sm:text-xl"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/servoxlogo.png" alt="Servox" className="h-[32px] w-auto shrink-0 sm:h-[36px]" />
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-1.5 lg:flex">{navLinks()}</nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <NotificationBell />
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}
