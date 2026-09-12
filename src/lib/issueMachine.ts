import "server-only";

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin";
import { DEFAULT_CONFIG } from "./constants";
import { canApproveEscalation, escalationBand } from "./escalationBand";
import { notify, notifyRole } from "./notifications";
import { serverCached } from "./serverCache";
import type {
  AppConfig,
  Issue,
  IssueStatus,
  Role,
  TimelineEntry,
} from "./types";

export class MachineError extends Error {
  statusCode: number;
  details?: unknown;
  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = "MachineError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export interface Actor {
  uid: string;
  name: string;
  role: Role;
}

export interface TransitionInput {
  to: IssueStatus;
  note?: string;
  priority?: number;
  rejectionReason?: string;
  teamId?: string;
  staff?: string[];
  categoryId?: string;
  categoryName?: string;
  categoryHeadUid?: string;
  maintenanceHeadUid?: string;
  verdict?: string;
  sendBackReason?: string;
  rating?: number;
  comment?: string;
  isAuto?: boolean;
  /** System-only: auto-escalate a NEW issue carrying an AI safety flag. */
  safetyEscalation?: boolean;
}

const nowIso = () => new Date().toISOString();

async function readConfig(db: Firestore): Promise<AppConfig> {
  try {
    const snap = await db.doc("config/general").get();
    if (!snap.exists) return DEFAULT_CONFIG;
    const data = snap.data() as Partial<AppConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...data,
      slaDefaults: {
        ...DEFAULT_CONFIG.slaDefaults,
        ...(data.slaDefaults || {}),
      },
      ai: { ...DEFAULT_CONFIG.ai, ...(data.ai || {}) },
      sequenceCounters: {
        ...DEFAULT_CONFIG.sequenceCounters,
        ...(data.sequenceCounters || {}),
      },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * Current app config. TTL-cached per instance (30s) because it's merged into
 * every transition; invalidated by POST /api/admin/config and
 * PATCH /api/config/purchase-limit. Issue-number allocation uses its own
 * separate document in a transaction, so this cache never affects numbering.
 */
async function loadConfig(db: Firestore): Promise<AppConfig> {
  return serverCached("api:load-config", 30_000, () => readConfig(db));
}

/** SLA hours per priority (config-aware). */
function slaHours(config: AppConfig, priority: number) {
  const d = config.slaDefaults ?? DEFAULT_CONFIG.slaDefaults;
  if (priority === 1) return d.p1;
  if (priority === 2) return d.p2;
  if (priority === 3) return d.p3;
  if (priority === 4) return d.p4;
  return d.p5;
}

function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3600 * 1000).toISOString();
}

/**
 * Fresh SLA block — clock starts at acceptance (VALIDATED for P3–5,
 * APPROVED for P1–2). Deadlines are stored on the doc for queue ordering.
 */
function initSla(priority: number, config: AppConfig) {
  const now = new Date().toISOString();
  const { responseHours, resolutionHours } = slaHours(config, priority);
  return {
    startedAt: now,
    responseDeadline: addHours(now, responseHours),
    resolutionDeadline: addHours(now, resolutionHours),
    pausedAt: null,
    totalPausedMs: 0,
    breachedFlags: { response: false, resolution: false },
  };
}

export interface TransitionRule {
  to: IssueStatus;
  roles: Role[];
  /** Returns an error string when the precondition fails, else null. */
  check: (
    issue: Issue,
    actor: Actor,
    input: TransitionInput,
    config: AppConfig
  ) => string | null;
}

const never = (): string | null => null;

/** Category head verifies work done for their own category (on-site check). */
const checkInspect = (issue: Issue, actor: Actor, input: TransitionInput): string | null => {
  if (
    actor.role === "category_head" &&
    issue.routing?.categoryHeadUid &&
    issue.routing.categoryHeadUid !== actor.uid
  )
    return "This issue belongs to another category head.";
  return input.verdict && input.verdict.trim().length >= 2
    ? null
    : "A short in-site verification note is required.";
};

const checkInspectSendBack = (issue: Issue, actor: Actor, input: TransitionInput): string | null => {
  if (
    actor.role === "category_head" &&
    issue.routing?.categoryHeadUid &&
    issue.routing.categoryHeadUid !== actor.uid
  )
    return "This issue belongs to another category head.";
  return input.sendBackReason && input.sendBackReason.trim().length >= 3
    ? null
    : "A send-back reason is required.";
};



/** Spec §3.1 — the one authoritative transition table. */
export const TRANSITION_RULES: Record<IssueStatus, TransitionRule[]> = {
  NEW: [
    {
      to: "VALIDATED",
      roles: ["validator", "admin"],
      check: (_i, _a, input) =>
        input.priority && input.priority >= 1 && input.priority <= 5
          ? null
          : "A priority between 1 and 5 is required to validate.",
    },
    {
      to: "REJECTED",
      roles: ["validator", "admin"],
      check: (_i, _a, input) =>
        input.rejectionReason && input.rejectionReason.trim().length >= 3
          ? null
          : "A rejection reason (min 3 chars) is required.",
    },
    {
      to: "ESCALATED",
      roles: ["admin"],
      check: (_i, _a, input) =>
        input.safetyEscalation === true
          ? null
          : "Safety escalation requires an AI-detected hazard.",
    },
  ],
  VALIDATED: [
    {
      to: "ESCALATED",
      roles: ["validator", "admin"],
      check: never,
    },
    {
      to: "ROUTED",
      roles: ["validator", "admin"],
      check: never,
    },
    {
      to: "ASSIGNED",
      roles: ["validator", "admin"],
      check: never,
    },
  ],
  ESCALATED: [
    {
      to: "APPROVED",
      roles: ["hod", "principal", "admin"],
      check: (issue, actor, input) => {
        if (!canApproveEscalation(actor.role, issue.priority))
          return escalationBand(issue.priority) === "principal"
            ? "Critical (P1) escalations are approved by the Principal."
            : "High (P2) escalations are approved by the HOD.";
        return !input.priority || (input.priority >= 1 && input.priority <= 5)
          ? null
          : "Severity revision must be between 1 and 5.";
      },
    },
    {
      to: "REJECTED",
      roles: ["hod", "principal", "admin"],
      check: (issue, actor, input) => {
        if (!canApproveEscalation(actor.role, issue.priority))
          return escalationBand(issue.priority) === "principal"
            ? "Critical (P1) escalations are rejected by the Principal."
            : "High (P2) escalations are rejected by the HOD.";
        return input.rejectionReason && input.rejectionReason.trim().length >= 3
          ? null
          : "A rejection reason (min 3 chars) is required.";
      },
    },
  ],
  APPROVED: [
    {
      to: "ROUTED",
      roles: ["validator", "admin"],
      check: never,
    },
    {
      to: "ASSIGNED",
      roles: ["validator", "admin"],
      check: never,
    },
  ],
  ROUTED: [
    {
      to: "PENDING_ASSIGN",
      roles: ["maintenance_head", "validator", "admin"],
      check: (_i, _a, input) =>
        input.categoryId || _i.routing?.categoryId
          ? null
          : "Choose a category to forward this issue.",
    },
    {
      to: "ASSIGNED",
      roles: ["admin"],
      check: never,
    },
  ],
  PENDING_ASSIGN: [
    {
      to: "ASSIGNED",
      roles: ["category_head", "maintenance_head", "admin"],
      check: (_i, _a, input) =>
        input.teamId || _i.routing?.teamId || _i.routing?.categoryId
          ? null
          : "Choose a team to assign workers.",
    },
  ],
  ASSIGNED: [
    {
      to: "ONGOING",
      roles: ["maintenance"],
      check: (issue, actor) =>
        issue.routing?.staff?.some((s) => s.uid === actor.uid) ||
        issue.routing?.teamId
          ? null
          : "You are not assigned to this job.",
    },
    {
      to: "PENDING_ASSIGN",
      roles: ["category_head", "maintenance_head", "validator", "admin"],
      check: never,
    },
    {
      to: "PENDING",
      roles: ["maintenance", "validator", "admin"],
      check: (_i, _a, input) =>
        input.note && input.note.trim().length >= 3
          ? null
          : "A blocker reason is required to set pending.",
    },
  ],
  ONGOING: [
    {
      to: "PENDING",
      roles: ["maintenance", "validator", "admin"],
      check: (_i, _a, input) =>
        input.note && input.note.trim().length >= 3
          ? null
          : "A blocker reason is required to set pending.",
    },
    {
      to: "COMPLETED",
      roles: ["maintenance", "validator", "admin"],
      check: (issue, actor, input) => {
        if (actor.role === "maintenance" && !issue.routing?.staff?.some((s) => s.uid === actor.uid))
          return "You are not assigned to this job.";
        if (!input.note || input.note.trim().length < 5)
          return "A closure report is required.";
        const unresolved = (Array.isArray(issue.requirements) ? issue.requirements : []).filter(
          (r) => r.needsApproval && !r.resolved
        );
        if (unresolved.length > 0)
          return `${unresolved.length} approval-flagged requirement(s) have not been approved by the purchase team yet. Approve or resubmit them before completing this job.`;
        return null;
      },
    },
  ],
  PENDING: [
    {
      to: "PENDING_ASSIGN",
      roles: ["category_head", "maintenance_head", "validator", "admin"],
      check: never,
    },
    {
      to: "ASSIGNED",
      roles: ["validator", "admin"],
      check: (_i, _a, input) =>
        input.teamId ? null : "Choose a team to reassign this issue.",
    },
  ],
  COMPLETED: [
    {
      to: "INSPECTED",
      roles: ["category_head", "admin"],
      check: checkInspect,
    },
    {
      to: "ONGOING",
      roles: ["category_head", "admin"],
      check: checkInspectSendBack,
    },
  ],
  INSPECTED: [],
  VERIFIED: [
    {
      to: "CLOSED",
      roles: ["reporter"],
      check: (_i, _a, input) => {
        if (input.isAuto) return null;
        return input.rating &&
          input.rating >= 0.5 &&
          input.rating <= 5 &&
          input.rating % 0.5 === 0
          ? null
          : "Please rate the resolution (0.5–5, in half steps) to close the issue.";
      },
    },
  ],
  REJECTED: [],
  CLOSED: [],
};

export function isTransitionAllowed(
  issue: Issue,
  to: IssueStatus,
  actor: Actor,
  input: Partial<TransitionInput> = {},
  config: AppConfig = DEFAULT_CONFIG
): string | null {
  const rules = TRANSITION_RULES[issue.status] || [];
  const rule = rules.find((r) => r.to === to);
  if (!rule) return `No transition from ${issue.status} to ${to}.`;
  if (!rule.roles.includes(actor.role))
    return `${actor.role} cannot move an issue from ${issue.status} to ${to}.`;
  return rule.check(issue, actor, input as TransitionInput, config);
}

/** All transitions the actor may legally trigger right now. */
export function allowedTransitions(
  issue: Issue,
  actor: Actor,
  config: AppConfig = DEFAULT_CONFIG
): IssueStatus[] {
  return (TRANSITION_RULES[issue.status] || [])
    .filter((r) => {
      if (!r.roles.includes(actor.role)) return false;
      return r.check(issue, actor, {} as TransitionInput, config) === null;
    })
    .map((r) => r.to);
}

function timelineEntry(
  from: IssueStatus | "",
  to: IssueStatus,
  actor: Actor,
  note: string | undefined,
  isAuto: boolean
): TimelineEntry {
  return {
    from,
    to,
    by: { uid: actor.uid, name: actor.name, role: actor.role },
    note: note || "",
    at: nowIso(),
    isAuto,
  };
}

/** Firestore rejects `undefined` values — drop them (recursively) from any
 *  document we write so optional denormalized fields (e.g. routing.headUid)
 *  can stay unset instead of failing the transaction. */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripUndefined) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

/**
 * Resolve the default team for a category (categories.defaultTeamId wins;
 * otherwise any active team matching the categoryId).
 */
export async function resolveTeamForCategory(
  db: Firestore,
  categoryId: string
): Promise<{ teamId: string; categoryName: string } | null> {
  const catSnap = await db.doc(`categories/${categoryId}`).get();
  if (!catSnap.exists) {
    return { teamId: "", categoryName: categoryId };
  }
  const cat = catSnap.data()!;
  if (cat.defaultTeamId) {
    return {
      teamId: cat.defaultTeamId,
      categoryName: cat.name || categoryId,
    };
  }
  const teams = await db
    .collection("teams")
    .where("categoryId", "==", categoryId)
    .where("isActive", "==", true)
    .limit(1)
    .get();
  if (!teams.empty) {
    return { teamId: teams.docs[0].id, categoryName: cat.name || categoryId };
  }
  return { teamId: "", categoryName: cat.name || categoryId };
}

/**
 * Resolve the maintenance head responsible for dispatching an issue.
 * Preference: an active head for the issue's department (per-department
 * model), then an active head for the issue's college, then any active head.
 * Returns null only when no maintenance head exists.
 */
export async function resolveMaintenanceHead(
  db: Firestore,
  issue: { department?: string; college?: string }
): Promise<string | null> {
  const base = () =>
    db
      .collection("users")
      .where("role", "==", "maintenance_head")
      .where("isActive", "==", true);
  const attempts: Array<[string, string]> = [];
  if (issue.department) attempts.push(["department", issue.department]);
  if (issue.college) attempts.push(["college", issue.college]);
  for (const [field, value] of attempts) {
    const snap = await base().where(field, "==", value).limit(1).get();
    if (!snap.empty) return snap.docs[0].id;
  }
  const any = await base().limit(1).get();
  return any.empty ? null : any.docs[0].id;
}

/**
 * THE state machine. Everything that mutates `status` flows through here.
 * Runs inside a single Firestore transaction: read → verify precondition →
 * write. Cascade auto-transitions (validate → escalate/route) are applied
 * within the same transaction so no intermediate state is ever observable.
 */
export async function applyTransition(
  issueId: string,
  actor: Actor,
  input: TransitionInput,
  opts: { db?: Firestore; config?: AppConfig } = {}
): Promise<Issue> {
  const db = opts.db || adminDb();
  const config = opts.config || (await loadConfig(db));

  return await db.runTransaction(async (tx) => {
    const ref = db.doc(`issues/${issueId}`);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new MachineError("Issue not found.", 404);
    const issue = { id: issueId, ...(snap.data() as Issue) };

    const error = isTransitionAllowed(issue, input.to, actor, input, config);
    if (error) throw new MachineError(error, 403);

    const to = input.to;
    const isAuto = input.isAuto === true;
    const note = input.note;
    const steps: TimelineEntry[] = [];
    let finalStatus: IssueStatus = to;
    const patches: Partial<Issue> = { updatedAt: nowIso() };
    let sla = issue.sla;

    switch (to) {
      case "VALIDATED": {
        const priority = input.priority!;
        patches.priority = priority;
        patches.prioritySetBy = { uid: actor.uid, name: actor.name };
        patches.prioritySetAt = nowIso();
        if (priority <= 2) {
          finalStatus = "ESCALATED";
          steps.push(timelineEntry(issue.status, "VALIDATED", actor, note, false));
          steps.push(
            timelineEntry("VALIDATED", "ESCALATED", actor, "Auto-escalated for P1–2 severity", true)
          );
          patches.escalation = {
            required: true,
            status: "pending",
          };
        } else {
          finalStatus = "ROUTED";
          steps.push(timelineEntry(issue.status, "VALIDATED", actor, note, false));
          steps.push(
            timelineEntry("VALIDATED", "ROUTED", actor, "Auto-routed to maintenance head", true)
          );
          const r = issue.routing || { categoryId: "", categoryName: "", teamId: "", staff: [] };
          patches.routing = {
            categoryId: r.categoryId || "",
            categoryName: r.categoryName || "",
            teamId: r.teamId || "",
            staff: r.staff || [],
            maintenanceHeadUid: input.maintenanceHeadUid || r.maintenanceHeadUid,
            note: r.note,
          };
        }
        break;
      }
      case "REJECTED": {
        patches.rejection = {
          reason: input.rejectionReason!,
          by: { uid: actor.uid, name: actor.name },
          at: nowIso(),
        };
        break;
      }
      case "ESCALATED": {
        patches.escalation = {
          required: true,
          status: "pending",
        };
        if (input.safetyEscalation) {
          steps.push(
            timelineEntry(
              issue.status,
              "ESCALATED",
              actor,
              "Auto-escalated: safety hazard detected",
              true
            )
          );
        }
        break;
      }
      case "APPROVED": {
        const finalPriority = input.priority ?? issue.priority;
        if (input.priority && input.priority !== issue.priority) {
          patches.priority = input.priority;
          patches.prioritySetBy = { uid: actor.uid, name: actor.name };
          patches.prioritySetAt = nowIso();
        }
        if (finalPriority <= 2) {
          sla = sla || initSla(finalPriority, config);
        }
        patches.escalation = {
          required: issue.escalation?.required !== false,
          status: "confirmed",
          reviewedBy: { uid: actor.uid, name: actor.name },
          reviewedAt: nowIso(),
          note: note || issue.escalation?.note,
        };
        break;
      }
      case "ASSIGNED": {
        if (sla?.pausedAt) {
          const paused = new Date().getTime() - new Date(sla.pausedAt).getTime();
          const totalPausedMs = (sla.totalPausedMs || 0) + paused;
          const extendMs = paused;
          const extend = (iso: string) =>
            new Date(new Date(iso).getTime() + extendMs).toISOString();
          sla = {
            ...sla,
            totalPausedMs,
            pausedAt: null,
            responseDeadline: sla.responseDeadline
              ? extend(sla.responseDeadline)
              : sla.responseDeadline,
            resolutionDeadline: sla.resolutionDeadline
              ? extend(sla.resolutionDeadline)
              : sla.resolutionDeadline,
          };
        }
        if (!sla) sla = initSla(issue.priority, config);
        const r = issue.routing || { categoryId: "", categoryName: "", teamId: "", staff: [] };
        if (input.teamId || input.staff?.length) {
          let staffObjs = r.staff || [];
          if (input.staff && input.staff.length) {
            staffObjs = await Promise.all(
              input.staff.map(async (uid) => {
                const u = await tx.get(db.doc(`users/${uid}`));
                return {
                  uid,
                  name: u.exists ? (u.data()?.name as string) || uid : uid,
                };
              })
            );
          }
          patches.routing = {
            categoryId: input.categoryId || r.categoryId || "",
            categoryName: input.categoryName || r.categoryName || "",
            teamId: input.teamId || r.teamId || "",
            staff: staffObjs,
            maintenanceHeadUid: r.maintenanceHeadUid,
            categoryHeadUid: input.categoryHeadUid || r.categoryHeadUid,
            note: input.note || r.note,
          };
        }
        break;
      }
      case "ROUTED": {
        const r = issue.routing || { categoryId: "", categoryName: "", teamId: "", staff: [] };
        if (input.categoryId) {
          patches.routing = {
            categoryId: input.categoryId,
            categoryName: input.categoryName || r.categoryName,
            teamId: r.teamId || "",
            staff: r.staff || [],
            maintenanceHeadUid: input.maintenanceHeadUid || r.maintenanceHeadUid,
            categoryHeadUid: r.categoryHeadUid,
            note: r.note,
          };
        } else if (input.maintenanceHeadUid) {
          patches.routing = {
            ...r,
            maintenanceHeadUid: input.maintenanceHeadUid || r.maintenanceHeadUid,
          };
        }
        break;
      }
      case "PENDING_ASSIGN": {
        const r = issue.routing || { categoryId: "", categoryName: "", teamId: "", staff: [] };
        patches.routing = {
          categoryId: input.categoryId || r.categoryId || "",
          categoryName: input.categoryName || r.categoryName || "",
          teamId: r.teamId || "",
          staff: r.staff || [],
          maintenanceHeadUid: input.maintenanceHeadUid || r.maintenanceHeadUid,
          categoryHeadUid: input.categoryHeadUid || r.categoryHeadUid,
          note: input.note || r.note,
        };
        break;
      }
      case "ONGOING": {
        break;
      }
      case "PENDING": {
        if (!sla) sla = initSla(issue.priority, config);
        sla = { ...sla, pausedAt: sla.pausedAt || nowIso() };
        break;
      }
      case "COMPLETED": {
        patches.completion = {
          report: note || "",
          completedAt: nowIso(),
        };
        if (sla?.pausedAt) {
          const paused = new Date().getTime() - new Date(sla.pausedAt).getTime();
          sla = {
            ...sla,
            totalPausedMs: (sla.totalPausedMs || 0) + paused,
            pausedAt: null,
          };
        }
        break;
      }
      case "INSPECTED": {
        patches.inspection = {
          inspectedBy: { uid: actor.uid, name: actor.name },
          inspectedAt: nowIso(),
          verdict: input.verdict || note || "Inspected",
          ...(input.note ? { note: input.note } : {}),
        };
        finalStatus = "VERIFIED";
        patches.verification = {
          verifiedBy: { uid: actor.uid, name: actor.name },
          verifiedAt: nowIso(),
          verdict: input.verdict || note || "Verified by category head inspection",
          ...(input.note ? { note: input.note } : {}),
        };
        steps.push(timelineEntry(issue.status, "INSPECTED", actor, input.verdict || note, false));
        steps.push(
          timelineEntry("INSPECTED", "VERIFIED", actor, "Auto-verified after category head inspection", true)
        );
        break;
      }
      case "VERIFIED": {
        patches.verification = {
          verifiedBy: { uid: actor.uid, name: actor.name },
          verifiedAt: nowIso(),
          verdict: input.verdict || note || "Verified",
          ...(input.note ? { note: input.note } : {}),
        };
        break;
      }
      case "CLOSED": {
        patches.feedback = {
          rating: input.rating || 0,
          ...(input.comment || input.note ? { comment: input.comment || input.note } : {}),
          givenAt: nowIso(),
          autoClosed: isAuto,
        };
        break;
      }
    }

    if (input.to === "ONGOING" && ["COMPLETED"].includes(issue.status)) {
      patches.verification = {
        verifiedBy: { uid: actor.uid, name: actor.name },
        verifiedAt: nowIso(),
        verdict: "send_back",
        sendBackReason: input.sendBackReason || input.note || "",
      };
    }

    if (sla) patches.sla = sla;
    if (finalStatus !== issue.status) {
      patches.status = finalStatus;
      const last = steps[steps.length - 1];
      if (!last || last.to !== finalStatus) {
        steps.push(timelineEntry(issue.status, finalStatus, actor, note, isAuto));
      }
    }

    const baseAt = nowIso();
    for (let i = 0; i < steps.length; i++) {
      tx.set(db.collection(`issues/${issueId}/timeline`).doc(), {
        ...steps[i],
        at: new Date(new Date(baseAt).getTime() + i).toISOString(),
      });
    }
    tx.update(ref, {
      ...stripUndefined(patches),
      "counters.timelineCount": FieldValue.increment(steps.length || 1),
    });

    return { ...issue, ...patches, status: finalStatus } as Issue;
  });
}

/**
 * Safety auto-escalation. When AI (or the deterministic fallback) detects a
 * safety hazard on a NEW issue we bypass the normal VALIDATED path and jump
 * straight to ESCALATED so HOD/Principal review it immediately — a water leak
 * near a panel must not wait for a validator to notice. Appends the
 * "Auto-escalated: safety hazard detected" timeline entry and notifies dept
 * HOD/principal + admin + reporter. No-op (returns null) when the issue is
 * no longer NEW or carries no safety flags, so re-runs are safe.
 */
export async function escalateForSafety(
  issueId: string,
  opts: { db?: Firestore; config?: AppConfig } = {}
): Promise<Issue | null> {
  const db = opts.db || adminDb();
  const snap = await db.doc(`issues/${issueId}`).get();
  if (!snap.exists) return null;
  const issue = { id: issueId, ...(snap.data() as Issue) };
  if (issue.status !== "NEW") return null;
  const flags = (issue.aiSuggestion?.safetyFlags || []).filter(Boolean);
  if (!flags.length) return null;

  const config = opts.config || (await loadConfig(db));
  const actor: Actor = { uid: "system", name: "AI Safety Monitor", role: "admin" };
  const updated = await applyTransition(
    issueId,
    actor,
    { to: "ESCALATED", safetyEscalation: true },
    { db, config }
  );

  const link = `/issues/${issueId}`;
  await notifyRole(
    ["hod", "principal", "admin"],
    {
      type: "escalation",
      title: "Safety alert — immediate review",
      body: `${updated.issueNo}: ${flags.slice(0, 3).join(", ")}. Auto-escalated — confirm severity and dispatch.`,
      link,
    },
    updated.college
  );
  if (updated.reporter?.uid) {
    await notify(updated.reporter.uid, {
      type: "escalation",
      title: "Issue escalated for safety",
      body: `${updated.issueNo} was auto-escalated because a safety hazard was detected. Leadership is reviewing it now.`,
      link,
    });
  }

  return updated;
}

/** Allocate the next human-readable issue number (ISS-2026-0001). */
export async function allocateIssueNo(db: Firestore): Promise<string> {
  const seqRef = db.doc("config/sequenceCounters");
  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(seqRef);
    const current = snap.exists
      ? ((snap.data()?.issues as number) || 0)
      : 0;
    const next = current + 1;
    tx.set(seqRef, { issues: next });
    const year = new Date().getFullYear();
    return `ISS-${year}-${String(next).padStart(4, "0")}`;
  });
}

export { loadConfig };
