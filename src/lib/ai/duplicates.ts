import "server-only";

import { adminDb } from "../firebaseAdmin";
import { aiEnabled, aiModelName } from "./genkit";

export interface DuplicateResult {
  duplicateOf: string | null;
  duplicateIssueNo: string | null;
  matchScore: number;
  similarIssues: { id: string; issueNo: string; score: number }[];
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "in", "on", "at", "to", "of", "is", "are",
  "was", "were", "be", "been", "it", "this", "that", "there", "please",
  "from", "for", "with", "as", "by", "my", "our", "i", "we", "you", "has",
  "have", "had", "not", "no", "but", "if", "very", "some", "any", "all",
  "one", "two", "issue", "problem", "also", "again", "still", "now",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export function overlapScore(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const min = Math.min(ta.size, tb.size);
  return inter / min;
}

const OPEN = ["NEW", "VALIDATED", "ESCALATED", "APPROVED", "ASSIGNED", "ONGOING", "PENDING"];

/**
 * F2 — Duplicate & similar-issue detection. Compares the description against
 * recent open issues at the same location using token overlap (a stand-in for
 * cosine similarity over embeddings, and fully offline-capable).
 */
export async function findDuplicatesFlow(input: {
  issueId: string;
  description: string;
  location: string;
  threshold?: number;
  college?: string;
}): Promise<DuplicateResult> {
  const threshold = input.threshold ?? 0.45;
  const similar: { id: string; issueNo: string; score: number }[] = [];

  try {
    const base = adminDb().collection("issues").where("status", "in", OPEN);
    const scoped = input.college
      ? base.where("college", "==", input.college)
      : base;
    // AI-9: filter by open status FIRST, then the location — so a busy
    // location with many closed/completed docs can't crowd out the open
    // duplicates this scan is meant to find.
    const snap = await scoped
      .where("location.name", "==", input.location)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    for (const doc of snap.docs) {
      const d = doc.data();
      if (doc.id === input.issueId) continue;
      const score = overlapScore(input.description, d.description || "");
      if (score > 0) {
        similar.push({ id: doc.id, issueNo: d.issueNo || doc.id, score });
      }
    }
  } catch (e) {
    console.error("findDuplicates query error:", e);
  }

  similar.sort((a, b) => b.score - a.score);
  const top = similar[0];
  const duplicateOf = top && top.score >= threshold ? top.id : null;

  return {
    duplicateOf,
    duplicateIssueNo: duplicateOf ? top.issueNo : null,
    matchScore: top ? top.score : 0,
    similarIssues: similar.slice(0, 5),
  };
}

/** Persist dup results — claims the slot in a transaction so a background
 *  create-hook and a manual re-run can't double-write. Return `false` when
 *  duplicates are already processed for this issue (AI-8). */
export async function writeDuplicates(
  issueId: string,
  result: DuplicateResult
): Promise<boolean> {
  const db = adminDb();
  const ref = db.doc(`issues/${issueId}`);
  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    if (snap.data()?.aiSuggestion?.duplicatesProcessed) return false;
    tx.update(ref, {
      "aiSuggestion.duplicateOf": result.duplicateOf,
      "aiSuggestion.duplicateIssueNo": result.duplicateIssueNo,
      "aiSuggestion.matchScore": result.matchScore,
      "aiSuggestion.similarIssues": result.similarIssues,
      "aiSuggestion.duplicatesProcessed": true,
      "aiSuggestion.aiModel": aiEnabled() ? `googleai/${aiModelName()}` : "fallback-classifier",
      "aiSuggestion.processedAt": new Date().toISOString(),
    });
    return true;
  });
}
