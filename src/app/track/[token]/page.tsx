"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Clock3, HardHat, MapPin, Star } from "lucide-react";
import { STATUS_LABEL, STATUS_STEP_ORDER } from "@/lib/constants";
import { deadlineLabel, formatDateTime, timeAgo } from "@/lib/format";
import type { Issue, TimelineEntry } from "@/lib/types";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { EmptyState, Loading } from "@/components/ui/States";
import { IssuePhotos } from "@/components/ui/IssuePhotos";

interface TrackData {
  issue: Issue;
  timeline: TimelineEntry[];
}

export default function TrackPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [data, setData] = useState<TrackData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/track/${token}`, {
          headers: { Accept: "application/json" },
        });
        const body = (await res.json()) as TrackData & { error?: string };
        if (cancelled) return;
        if (!res.ok || body.error) setError(body.error || "Issue not found.");
        else setData(body);
      } catch {
        if (!cancelled) setError("Could not load this issue. Please try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-[1100px] items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink text-white">
            <HardHat className="h-4 w-4" aria-hidden />
          </span>
          CampusCare
        </Link>
        <Link
          href="/"
          className="link-blue flex items-center gap-1.5 rounded-full border border-silver bg-white px-3 py-1.5 text-sm font-medium"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to home
        </Link>
      </header>

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-16">
        {error ? (
          <EmptyState title="Issue not found" body={error} />
        ) : !data ? (
          <Loading label="Loading issue…" />
        ) : (
          <TrackContent data={data} />
        )}
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-slate">
        CampusCare — campus maintenance, made simple.
      </footer>
    </div>
  );
}

function TrackContent({ data }: { data: TrackData }) {
  const { issue, timeline } = data;
  const priority = issue.priority || 3;
  const currentIdx = STATUS_STEP_ORDER.indexOf(issue.status);
  const sla = issue.sla;

  return (
    <div className="space-y-4">
      {issue.status === "REJECTED" && (
        <div className="card border-l-4 !border-l-[#c0392b]">
          <p className="text-sm font-medium text-[#c0392b]">
            This issue was not accepted for maintenance.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-b border-line pb-4">
        <h1 className="text-xl font-bold text-ink">{issue.issueNo}</h1>
        <StatusBadge status={issue.status} />
        <PriorityBadge priority={priority} />
      </div>

      <div className="card">
        <h2 className="sr-only">Progress</h2>
        <ol className="flex">
          {STATUS_STEP_ORDER.map((s, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            return (
              <li key={s} className="relative flex flex-1 flex-col items-center gap-1.5">
                {i > 0 && (
                  <span
                    className={`absolute left-[-50%] right-1/2 top-[9px] h-0.5 ${
                      done ? "bg-[#2e7d32]" : "bg-silver"
                    }`}
                    aria-hidden
                  />
                )}
                <span
                  className={`relative z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-bold ${
                    active
                      ? "bg-action-orange text-white ring-2 ring-[#fed7aa]"
                      : done
                        ? "bg-[#2e7d32] text-white"
                        : "bg-silver text-slate"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span className={`text-center text-[10px] leading-tight ${active ? "font-semibold text-ink" : "text-slate"}`}>
                  {STATUS_LABEL[s]}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="card">
            <h2 className="font-display text-lg font-semibold text-ink">{issue.title}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate">
              {issue.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" aria-hidden />
                {issue.location.building}
                {issue.location.floor && ` · Floor ${issue.location.floor}`}
                {issue.location.name && ` · ${issue.location.name}`}
              </span>
              <span className="mx-1 text-silver">|</span>
              <span>Reported by {issue.reporter?.name}</span>
              <span className="mx-1 text-silver">|</span>
              <span>{timeAgo(issue.createdAt)}</span>
            </div>
            {issue.images.length > 0 && (
              <div className="mt-4">
                <IssuePhotos images={issue.images} size={148} />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {(sla?.responseDeadline || sla?.resolutionDeadline) && (
            <div className="card">
              <h2 className="font-display text-lg font-semibold text-ink">
                Service-level agreement
              </h2>
              <div className="mt-3 flex flex-col gap-3">
                {sla.responseDeadline && <SlaStat label="Response deadline" iso={sla.responseDeadline} />}
                {sla.resolutionDeadline && <SlaStat label="Resolution deadline" iso={sla.resolutionDeadline} />}
              </div>
            </div>
          )}

          <div className="card">
            <h2 className="font-display text-lg font-semibold text-ink">Timeline</h2>
            <ol className="mt-4 flex flex-col gap-0">
              {timeline.map((t, i) => (
                <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < timeline.length - 1 && (
                    <span className="absolute left-[5px] top-3 h-full w-px bg-silver" aria-hidden />
                  )}
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                      t.isAuto ? "bg-action-blue" : "bg-ink"
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="font-medium text-graphite">
                        {t.from ? STATUS_LABEL[t.from] : "Reported"} → {STATUS_LABEL[t.to]}
                      </span>
                      {t.isAuto && <span className="ml-1 text-xs text-action-blue">auto</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-slate">
                      {t.by?.name} · {formatDateTime(t.at)}
                    </p>
                    {t.note && <p className="mt-1 text-sm text-slate">{t.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {issue.feedback && (
            <div className="card">
              <h2 className="font-display text-lg font-semibold text-ink">Feedback</h2>
              <div className="mt-2 flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((r) => (
                  <Star
                    key={r}
                    className={`h-5 w-5 ${
                      r <= issue.feedback!.rating ? "fill-[#f59e0b] text-[#f59e0b]" : "text-silver"
                    }`}
                    aria-hidden
                  />
                ))}
              </div>
              {issue.feedback.comment && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate">{issue.feedback.comment}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SlaStat({ label, iso }: { label: string; iso: string }) {
  const d = deadlineLabel(iso);
  const toneClass =
    d.tone === "over" ? "text-[#c0392b]" : d.tone === "warn" ? "text-[#d97706]" : "text-[#2e7d32]";
  return (
    <div className="rounded-xl bg-paper p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate">
        <Clock3 className="h-3.5 w-3.5" aria-hidden /> {label}
      </p>
      <p className={`mt-1.5 font-display text-lg font-semibold ${toneClass}`}>{d.text}</p>
      <p className="mt-0.5 text-xs text-slate">{formatDateTime(iso)}</p>
    </div>
  );
}
