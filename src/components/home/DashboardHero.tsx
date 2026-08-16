"use client";

import Link from "next/link";
import { CirclePlus, ListChecks } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ROLE_LABEL } from "@/lib/constants";
import { portalRoles } from "@/lib/nav";
import { feedFor } from "@/lib/roleFeeds";
import RecentIssuesPanel from "@/components/home/RecentIssuesPanel";

/** First viewport — personal welcome on the left, the role-aware latest-issues feed on the right. */
export default function DashboardHero() {
  const { claims } = useAuth();

  const firstName = claims?.name.split(" ")[0] || "there";
  const detail = [claims?.college, claims?.department].filter(Boolean).join(" · ");
  const canReport = claims ? portalRoles(claims).includes("reporter") : false;
  const activeRole = claims ? portalRoles(claims)[0] : "reporter";
  const feed = feedFor(activeRole, claims?.department);

  return (
    <section className="flex min-h-[calc(100svh-48px)] items-center py-8 sm:py-14 lg:min-h-[calc(100svh-70px)]">
      <div className="grid w-full items-stretch gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10">
        <div className="flex flex-col justify-center gap-1">
          <span className="tag self-start border border-accent !bg-transparent text-accent!">
            {ROLE_LABEL[claims?.role ?? "reporter"]}
          </span>
          <h1 className="mt-4 font-valve text-5xl max-md:text-4xl leading-tight tracking-tight text-ink sm:text-6xl lg:text-7xl">
            Welcome back,
            <br />
            <span className="text-accent">{firstName}.</span>
          </h1>

          <div className="mt-6">
            {detail && <p className="text-lg font-medium text-graphite">{detail}.</p>}
            <p className="mt-1 max-w-lg text-slate">
              Here is what is happening on campus maintenance right now.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {canReport && (
              <Link href="/new" className="btn btn-primary flex-1 sm:flex-none">
                <CirclePlus className="h-3.5 w-3.5" aria-hidden /> Report new issue
              </Link>
            )}
            <Link href={feed.ctaHref} className="btn btn-secondary flex-1 sm:flex-none">
              <ListChecks className="h-3.5 w-3.5" aria-hidden /> {feed.ctaLabel}
            </Link>
          </div>
        </div>

        <RecentIssuesPanel />
      </div>
    </section>
  );
}
