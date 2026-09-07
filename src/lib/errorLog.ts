import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin";

/**
 * Best-effort structured error log.
 *
 * Writes an incrementing daily counter to `logs/daily/{date}` and — capped at a
 * few hundred per day — full error docs to `logs/errors/` (message, stack,
 * route, actor, issue). Errors are the one place we accept Firestore writes
 * outside route handlers: they must never break the primary flow, so every
 * call is swallowed with `.catch()`.
 */

export interface ErrorContext {
  route?: string;
  method?: string;
  source?: string;
  actorUid?: string;
  issueId?: string;
}

const MAX_DETAILED_PER_DAY = 200;
let dailyKey = "";
let detailedToday = 0;

export async function logError(e: unknown, ctx: ErrorContext = {}): Promise<void> {
  const now = new Date();
  const message = e instanceof Error ? e.message : String(e);
  const stack = e instanceof Error ? e.stack ?? "" : "";

  const day = now.toISOString().slice(0, 10);
  await adminDb()
    .doc(`logs/daily/${day}`)
    .set(
      { count: FieldValue.increment(1), lastAt: now.toISOString() },
      { merge: true }
    )
    .catch(() => {});

  // Cap detailed docs so a storm can't bloat Firestore unbounded.
  if (day !== dailyKey) {
    dailyKey = day;
    detailedToday = 0;
  }
  if (detailedToday++ >= MAX_DETAILED_PER_DAY) return;

  await adminDb()
    .collection("logs/errors")
    .add({
      message: message.slice(0, 500),
      name: e instanceof Error ? e.name : "Unknown",
      stack: stack.slice(0, 4000),
      route: ctx.route,
      method: ctx.method,
      source: ctx.source ?? "http",
      actorUid: ctx.actorUid,
      issueId: ctx.issueId,
      at: now.toISOString(),
    })
    .catch(() => {});
}