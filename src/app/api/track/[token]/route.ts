import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { json, handleError } from "@/lib/api";
import { serverCached } from "@/lib/serverCache";
import { clientIp, isRateLimited } from "@/lib/rateLimit";
import type { Issue, TimelineEntry } from "@/lib/types";

const db = adminDb();

const TRACK_WINDOW_MS = 60_000;
const TRACK_LIMIT = 30;
/** Auto-revoke tracking links 30 days after an issue is closed. */
const AUTO_REVOKE_MS = 30 * 24 * 60 * 60 * 1000;

/** A leaked/old token stops working once the issue is revoked manually
 *  (`trackingRevoked`) or auto-expires `AUTO_REVOKE_MS` after closure. */
function isRevoked(issue: Issue): boolean {
  if (issue.trackingRevoked === true) return true;
  if (issue.status !== "CLOSED") return false;
  const closedAtRaw = issue.feedback?.givenAt || issue.verification?.verifiedAt;
  if (!closedAtRaw) return false;
  const closedAt = new Date(closedAtRaw).getTime();
  if (Number.isNaN(closedAt)) return false;
  return Date.now() - closedAt > AUTO_REVOKE_MS;
}

/**
 * GET /api/track/[token] — public lookup by the unguessable `trackingToken`
 * (same pattern as /api/images/[id]). Intentionally auth-free so email
 * recipients without a session aren't stuck at the login wall. Exposes only
 * what the tracking page needs; PII (trackingToken, reporter uid/department,
 * routing, requirements/prices, AI suggestion, counters) is stripped server-side.
 * Cached per token — tracking status is low-churn.
 */

/** A-9: only these fields may leave the server for a public tracking view. */
function publicIssue(issue: Issue): unknown {
  return {
    id: issue.id,
    issueNo: issue.issueNo,
    title: issue.title,
    description: issue.description,
    status: issue.status,
    priority: issue.priority,
    college: issue.college,
    department: issue.department,
    location: {
      building: issue.location?.building,
      floor: issue.location?.floor,
      name: issue.location?.name,
    },
    reporter: issue.reporter ? { name: issue.reporter.name } : undefined,
    createdAt: issue.createdAt,
    images: (issue.images || []).map((img) => ({
      url: img.url,
      at: img.at,
    })),
    escalation: issue.escalation
      ? { required: Boolean(issue.escalation.required) }
      : undefined,
    sla: issue.sla
      ? {
          responseDeadline: issue.sla.responseDeadline,
          resolutionDeadline: issue.sla.resolutionDeadline,
        }
      : undefined,
    completion: issue.completion
      ? { report: issue.completion.report, completedAt: issue.completion.completedAt }
      : undefined,
    feedback: issue.feedback
      ? { rating: issue.feedback.rating, comment: issue.feedback.comment }
      : undefined,
  };
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  try {
    const { token } = await ctx.params;

    if (isRateLimited(`track:${clientIp(req)}:${token}`, { limit: TRACK_LIMIT, windowMs: TRACK_WINDOW_MS })) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a minute." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const payload = await serverCached(`api:track:${token}`, 60_000, async () => {
      const snap = await db
        .collection("issues")
        .where("trackingToken", "==", token)
        .limit(1)
        .get();
      if (snap.empty) return null;
      const doc = snap.docs[0];
      const timelineSnap = await doc.ref.collection("timeline").orderBy("at", "asc").get();
      const issue = { id: doc.id, ...doc.data() } as Issue;
      const timeline = timelineSnap.docs.map((d) => {
        const t = d.data() as TimelineEntry;
        return {
          id: d.id,
          from: t.from,
          to: t.to,
          note: t.note,
          at: t.at,
          isAuto: t.isAuto,
          by: t.by ? { name: t.by.name } : undefined,
        };
      });
      return { raw: issue, issue: publicIssue(issue), timeline };
    });
    if (!payload) return json({ error: "Issue not found." }, 404);
    // Decided live (outside the cache) so revocation takes effect immediately.
    if (isRevoked(payload.raw)) return json({ error: "This tracking link has been revoked." }, 410);
    return json({ issue: payload.issue, timeline: payload.timeline });
  } catch (e) {
    return handleError(e);
  }
}