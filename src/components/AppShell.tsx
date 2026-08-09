"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import ProfileOnboarding from "@/components/auth/ProfileOnboarding";
import AppHeader from "@/components/AppHeader";
import { Loading } from "@/components/ui/States";

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, claims, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!user || !claims) {
      router.replace("/login");
    }
  }, [ready, user, claims, router]);

  if (!ready) return <Loading label="Checking session…" />;
  if (!user || !claims) return null;

  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      <ProfileOnboarding />
    </div>
  );
}
