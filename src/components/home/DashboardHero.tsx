"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { ROLE_LABEL } from "@/lib/constants";
import RecentIssuesPanel from "@/components/home/RecentIssuesPanel";

/** Dashboard hero — personal welcome on the left, recent issues panel on the right. */
export default function DashboardHero() {
  const { claims } = useAuth();

  const firstName = claims?.name.split(" ")[0] || "there";
  const detail = [claims?.college, claims?.department].filter(Boolean).join(" · ");

  return (
    <section className="grid items-stretch gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="card flex flex-col justify-center gap-1 p-6 sm:p-8">
        <span className="tag self-start bg-ink text-white">{ROLE_LABEL[claims?.role ?? "reporter"]}</span>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Welcome back, {firstName}.
        </h1>
        <p className="mt-1 max-w-lg text-slate">
          {detail ? (
            <>
              {detail}.
              <br />
            </>
          ) : null}
          Here is what is happening on campus maintenance right now.
        </p>
      </div>

      <RecentIssuesPanel />
    </section>
  );
}
