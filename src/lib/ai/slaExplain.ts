import "server-only";

import { adminDb } from "../firebaseAdmin";
import { aiEnabled, aiModelName, getGenkit } from "./genkit";
import type { Issue } from "../types";

export interface SlaExplanationResult {
  explanation: string;
  source: "ai" | "rules";
}

interface RuleInput {
  status: string;
  requirements?: { needsApproval?: boolean; resolved?: boolean }[];
}

/**
 * Deterministic fallback (and no-key default) for F8. Mirrors the rules an
 * HOD would apply by hand: unresolved purchase approvals block completion,
 * PENDING means a staff blocker, ASSIGNED means work hasn't started.
 */
export function ruleBasedSlaExplanation(input: RuleInput): string {
  const awaiting = (input.requirements || []).filter((r) => r.needsApproval && !r.resolved).length;
  if (awaiting > 0) {
    return `Waiting on purchase approval for ${awaiting} material requirement${awaiting === 1 ? "" : "s"}.`;
  }
  switch (input.status) {
    case "PENDING":
      return "Blocked by a staff report — awaiting parts or permission.";
    case "ASSIGNED":
      return "Not yet started by the assigned technician.";
    case "ONGOING":
      return "Work is in progress but has passed the resolution deadline.";
    case "ESCALATED":
    case "APPROVED":
      return "Awaiting approval from leadership.";
    case "NEW":
    case "VALIDATED":
      return "Not yet processed by a validator.";
    case "COMPLETED":
    case "INSPECTED":
    case "VERIFIED":
      return "Resolved — awaiting verification or closure.";
    default:
      return "Past the resolution deadline.";
  }
}

async function buildContext(issueId: string): Promise<{ issue: Issue; events: unknown[] } | null> {
  try {
    const db = adminDb();
    const snap = await db.doc(`issues/${issueId}`).get();
    if (!snap.exists) return null;
    const issue = { id: issueId, ...(snap.data() as Issue) };
    const timeline = await db
      .collection(`issues/${issueId}/timeline`)
      .orderBy("at", "asc")
      .limit(40)
      .get();
    return { issue, events: timeline.docs.map((d) => d.data()) };
  } catch (e) {
    console.error("slaExplain buildContext failed:", e);
    return null;
  }
}

/**
 * F8 — SLA breach explanation. Given an issue's status, SLA deadlines, open
 * requirements and recent timeline events, produces a 1–2 sentence answer to
 * "why is this issue late?". Uses Gemini when available, otherwise the
 * deterministic rules above. Persisted to `issue.sla.explanation`.
 */
export async function slaExplainFlow(issueId: string): Promise<SlaExplanationResult | null> {
  const ctx = await buildContext(issueId);
  if (!ctx) return null;
  const { issue, events } = ctx;

  const requirements = Array.isArray(issue.requirements) ? issue.requirements : [];
  const awaiting = requirements.filter((r) => r.needsApproval && !r.resolved).length;
  const exportedRules = ruleBasedSlaExplanation({ status: issue.status, requirements });

  const facts = {
    issueNo: issue.issueNo || issueId,
    title: issue.title,
    status: issue.status,
    priority: issue.priority,
    college: issue.college || "",
    department: issue.department || "",
    team: issue.routing?.teamId || "",
    startedAt: issue.sla?.startedAt || "",
    resolutionDeadline: issue.sla?.resolutionDeadline || "",
    totalPausedMs: issue.sla?.totalPausedMs || 0,
    breached: [
      issue.sla?.breachedFlags?.response ? "response" : null,
      issue.sla?.breachedFlags?.resolution ? "resolution" : null,
    ].filter(Boolean),
    awaitingApproval: awaiting,
    totalRequirements: requirements.length,
    lastEvents: events
      .slice(-5)
      .map(
        (e) =>
          `${(e as { from?: string }).from || ""}→${(e as { to?: string }).to || ""}` +
          `${(e as { by?: { name?: string } }).by?.name ? ` by ${(e as { by: { name?: string } }).by.name}` : ""}` +
          `${(e as { isAuto?: boolean }).isAuto ? " (auto)" : ""}` +
          `${(e as { note?: string }).note ? ` — ${(e as { note: string }).note}` : ""}`
      ),
  };

  if (!aiEnabled()) {
    return { explanation: exportedRules, source: "rules" };
  }

  try {
    const ai = await getGenkit();
    const { z } = await import("genkit");

    const res = await ai.generate({
      model: `googleai/${aiModelName()}`,
      system:
        "You are a maintenance supervisor explaining why a campus work order is late. " +
        "Use ONLY the facts given — never invent reasons. Answer in 1–2 short sentences, " +
        "plain and specific (e.g. 'Waiting on purchase approval for 2 materials since Tuesday', " +
        "'Assigned to Plumbing team but not started yet'). Do not mention deadlines or pressure, " +
        "just state the reason. Return ONLY structured JSON.",
      prompt: JSON.stringify(facts).slice(0, 6000),
      output: {
        schema: z.object({
          explanation: z.string().min(1).max(240),
        }),
        format: "json",
      },
      config: { temperature: 0.2, maxOutputTokens: 384 },
    });

    const out = res.output as { explanation?: string } | null;
    if (out?.explanation && out.explanation.trim()) {
      return { explanation: out.explanation.trim(), source: "ai" };
    }
  } catch (e) {
    console.error("slaExplainFlow error, falling back to rules:", e);
  }
  return { explanation: exportedRules, source: "rules" };
}

/** Persist the F8 explanation so cards can render it without a model call. */
export async function writeSlaExplanation(
  issueId: string,
  result: SlaExplanationResult
): Promise<void> {
  await adminDb().doc(`issues/${issueId}`).update({
    "sla.explanation": result.explanation,
    "sla.explanationSource": result.source,
    "sla.explanationAt": new Date().toISOString(),
  });
}