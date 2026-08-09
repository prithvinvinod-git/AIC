"use client";

import Link from "next/link";
import { CirclePlus, ListChecks } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ROLE_LABEL } from "@/lib/constants";
import { portalRoles } from "@/lib/nav";
import RecentIssuesPanel from "@/components/home/RecentIssuesPanel";

/** First viewport — personal welcome on the left, the reporter's latest issues on the right. */
export default function DashboardHero() {
  const { claims } = useAuth();

  const firstName = claims?.name.split(" ")[0] || "there";
  const detail = [claims?.college, claims?.department].filter(Boolean).join(" · ");
  const canReport = claims ? portalRoles(claims).includes("reporter") : false;

  return (
    <section className="flex min-h-[calc(100svh-70px)] items-center py-10 sm:py-14">
      <div className="grid w-full items-stretch gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="flex flex-col justify-center gap-1">
          <span className="tag self-start border border-action-blue !bg-transparent !text-action-blue">
            {ROLE_LABEL[claims?.role ?? "reporter"]}
          </span>
          <h1 className="mt-4 font-valve text-6xl leading-tight tracking-tight text-ink sm:text-7xl">
            Welcome back,
            <br />
            <span className="text-action-blue">{firstName}.</span>
          </h1>

          <div className="mt-6">
            {detail && <p className="text-lg font-medium text-graphite">{detail}.</p>}
            <p className="mt-1 max-w-lg text-slate">
              Here is what is happening on campus maintenance right now.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {canReport && (
              <Link href="/new" className="btn btn-primary">
                <CirclePlus className="h-3.5 w-3.5" aria-hidden /> Report new issue
              </Link>
            )}
            <Link href="/dashboard" className="btn btn-secondary">
              <ListChecks className="h-3.5 w-3.5" aria-hidden /> My issues
            </Link>
          </div>
        </div>

        <RecentIssuesPanel />
      </div>
    </section>
  );
}
