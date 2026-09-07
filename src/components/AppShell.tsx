"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import ProfileOnboarding from "@/components/auth/ProfileOnboarding";
import PasswordSetupModal from "@/components/auth/PasswordSetupModal";
import { useNativePushPrompt } from "@/components/auth/PushNotificationPrompt";
import AppHeader from "@/components/AppHeader";
import MobileNav from "@/components/MobileNav";
import { Loading } from "@/components/ui/States";
import { usePrefetch } from "@/hooks/usePrefetch";
import type { Role } from "@/lib/types";

/** Per-role "common feeds" — eager-prefetched (only when stale) so the offline
 *  cache holds the queues each role most likely wants to open next. */
const ROLE_FEEDS: Record<Role, string[]> = {
  reporter: ["/api/issues?mine=true"],
  validator: ["/api/issues"],
  hod: ["/api/issues?status=ESCALATED"],
  principal: ["/api/issues?status=ESCALATED"],
  maintenance: ["/api/issues"],
  purchase: ["/api/issues"],
  admin: ["/api/issues"],
  maintenance_head: ["/api/issues"],
  category_head: ["/api/issues"],
};

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, claims, ready, needsPasswordSetup, needsEmailVerification, clearNeedsPasswordSetup } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useNativePushPrompt();

  const feeds = useMemo(() => (claims?.role ? ROLE_FEEDS[claims.role] ?? [] : []), [claims]);
  usePrefetch(feeds);

  useEffect(() => {
    if (!ready) return;
    if (!user || !claims) {
      const next = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${next}`);
      return;
    }
    if (needsEmailVerification) {
      router.replace("/verify-email");
    }
  }, [ready, user, claims, needsEmailVerification, router, pathname]);

  if (!ready) return <Loading label="Checking session…" />;
  if (!user || !claims) return null;

  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto w-full max-w-page px-[20px] py-6 max-lg:pb-[88px] sm:px-6 sm:py-10">{children}</main>
      <ProfileOnboarding />
      <MobileNav />
      <PasswordSetupModal open={needsPasswordSetup} onComplete={clearNeedsPasswordSetup} />
    </div>
  );
}
