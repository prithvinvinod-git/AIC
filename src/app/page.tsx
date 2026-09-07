"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import ProfileOnboarding from "@/components/auth/ProfileOnboarding";
import PasswordSetupModal from "@/components/auth/PasswordSetupModal";
import { useNativePushPrompt } from "@/components/auth/PushNotificationPrompt";
import { Loading } from "@/components/ui/States";
import AppHeader from "@/components/AppHeader";
import MobileNav from "@/components/MobileNav";
import PublicNav from "@/components/home/PublicNav";
import PublicHero from "@/components/home/PublicHero";
import FeatureSection from "@/components/home/FeatureSection";
import AiSection from "@/components/home/AiSection";
import SiteFooter from "@/components/home/SiteFooter";
import FaqSection from "@/components/home/FaqSection";
import AdUnit from "@/components/ads/AdUnit";
import DashboardHero from "@/components/home/DashboardHero";
import IssueBoard from "@/components/home/IssueBoard";
import AnnouncementBoard from "@/components/home/AnnouncementBoard";

export default function Home() {
  const { user, claims, ready, needsPasswordSetup, needsEmailVerification, clearNeedsPasswordSetup } = useAuth();
  const router = useRouter();
  useNativePushPrompt();

  useEffect(() => {
    if (ready && needsEmailVerification) router.replace("/verify-email");
  }, [ready, needsEmailVerification, router]);

  if (!ready) {
    return (
      <div className="flex min-h-full flex-col">
        <main className="flex flex-1 items-center justify-center">
          <Loading label="Checking session…" />
        </main>
      </div>
    );
  }

  if (needsEmailVerification) {
    return (
      <div className="flex min-h-full flex-col">
        <main className="flex flex-1 items-center justify-center">
          <Loading label="Redirecting to email verification…" />
        </main>
      </div>
    );
  }

  if (!user || !claims) {
    return (
      <div className="flex min-h-full flex-col overflow-x-hidden">
        <PublicNav />
        <main className="flex-1">
          <PublicHero />
          <FeatureSection />
          <div className="mx-auto w-full max-w-page px-[20px] sm:px-6">
            <AdUnit slot="7383985747" variant="dark" />
          </div>
          <AiSection />
          <FaqSection />
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col overflow-x-hidden">
      <AppHeader />
      <main className="mx-auto w-full max-w-page flex-1 px-4 max-lg:pb-[88px] sm:px-6">
        <DashboardHero />

        <section className="flex min-h-[100svh] flex-col gap-6 py-10 sm:py-14">
          <p className="-mt-[10px] text-xs font-semibold uppercase tracking-widest text-accent">
            Notice board
          </p>
          <div className="grid flex-1 grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
            <IssueBoard />
            <AnnouncementBoard />
          </div>
        </section>
      </main>
      <ProfileOnboarding />
      <MobileNav />
      <PasswordSetupModal open={needsPasswordSetup} onComplete={clearNeedsPasswordSetup} />
    </div>
  );
}
