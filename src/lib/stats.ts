import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin";

function dayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export interface DailyStatPatch {
  totalCreated?: number;
  totalClosed?: number;
  slaBreached?: number;
  avgResolutionMs?: number;
  sumResolutionMs?: number;
  issuesClosed?: number;
  byCategory?: Record<string, number>;
  byStatus?: Record<string, number>;
}

export async function bumpDailyStat(patch: DailyStatPatch, date: Date = new Date()): Promise<void> {
  const ref = adminDb().doc(`stats/${dayKey(date)}`);
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (typeof v === "number") data[k] = FieldValue.increment(v);
    else if (v && typeof v === "object") {
      data[k] = FieldValue.increment(0);
    }
  }
  try {
    await ref.set(data, { merge: true });
  } catch (e) {
    console.error("bumpDailyStat failed:", e);
  }
}

export async function incrementCategoryCount(categoryName: string, amount = 1, date: Date = new Date()): Promise<void> {
  await adminDb()
    .doc(`stats/${dayKey(date)}`)
    .set(
      { byCategory: { [categoryName]: FieldValue.increment(amount) } },
      { merge: true }
    );
}

export async function incrementStatusCount(status: string, amount = 1, date: Date = new Date()): Promise<void> {
  await adminDb()
    .doc(`stats/${dayKey(date)}`)
    .set(
      { byStatus: { [status]: FieldValue.increment(amount) } },
      { merge: true }
    );
}

export function toDayKey(d: Date = new Date()): string {
  return dayKey(d);
}
