"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { Loading } from "@/components/ui/States";
import AppHeader from "@/components/AppHeader";
import PublicNav from "@/components/home/PublicNav";
import PublicHero from "@/components/home/PublicHero";
import FeatureSection from "@/components/home/FeatureSection";
import AiSection from "@/components/home/AiSection";
import SiteFooter from "@/components/home/SiteFooter";
import DashboardHero from "@/components/home/DashboardHero";
import IssueBoard from "@/components/home/IssueBoard";
import AnnouncementBoard from "@/components/home/AnnouncementBoard";

export default function Home() {
  const { user, claims, ready } = useAuth();

  if (!ready) {
    return (
      <div className="flex min-h-full flex-col">
        <PublicNav />
        <main className="flex flex-1 items-center justify-center">
          <Loading label="Checking session…" />
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!user || !claims) {
    return (
      <div className="flex min-h-full flex-col">
        <PublicNav />
        <main className="flex-1">
          <PublicHero />
          <FeatureSection />
          <AiSection />
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-6">
          <DashboardHero />
          <section className="grid items-start gap-6 lg:grid-cols-2">
            <IssueBoard />
            <AnnouncementBoard />
          </section>
        </div>
      </main>
    </div>
  );
}
