"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import ProfileOnboarding from "@/components/auth/ProfileOnboarding";
import AppHeader from "@/components/AppHeader";
import { Loading } from "@/components/ui/States";

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, claims, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!ready) return;
    if (!user || !claims) {
      const next = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${next}`);
    }
  }, [ready, user, claims, router, pathname]);

  if (!ready) return <Loading label="Checking session…" />;
  if (!user || !claims) return null;

  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto w-full max-w-page px-[20px] py-6 sm:px-6 sm:py-10">{children}</main>
      <ProfileOnboarding />
    </div>
  );
}
