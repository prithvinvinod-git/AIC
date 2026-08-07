import "server-only";

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin";
import { DEFAULT_CONFIG } from "./constants";
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
  verdict?: string;
  sendBackReason?: string;
  rating?: number;
  comment?: string;
  isAuto?: boolean;
}

const nowIso = () => new Date().toISOString();

async function loadConfig(db: Firestore): Promise<AppConfig> {
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
  ],
  VALIDATED: [
    {
      to: "ESCALATED",
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
      check: (_i, _a, input) =>
        !input.priority ||
        (input.priority >= 1 && input.priority <= 5)
          ? null
          : "Severity revision must be between 1 and 5.",
    },
  ],
  APPROVED: [
    {
      to: "ASSIGNED",
      roles: ["validator", "admin"],
      check: never,
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
          (r) => !r.resolved && r.needsApproval
        );
        if (unresolved.length > 0 && !input.verdict)
          return `${unresolved.length} approval-flagged requirement(s) are still unresolved. Resolve or waive them first.`;
        return null;
      },
    },
  ],
  PENDING: [
    {
      to: "ASSIGNED",
      roles: ["validator", "admin"],
      check: (_i, _a, input) =>
        input.teamId ? null : "Choose a team to reassign this issue.",
    },
  ],
  COMPLETED: [
    {
      to: "VERIFIED",
      roles: ["validator", "admin"],
      check: (_i, _a, input) =>
        input.verdict && input.verdict.trim().length >= 2
          ? null
          : "A short verification note is required.",
    },
    {
      to: "ONGOING",
      roles: ["validator", "admin"],
      check: (_i, _a, input) =>
        input.sendBackReason && input.sendBackReason.trim().length >= 3
          ? null
          : "A send-back reason is required.",
    },
  ],
  VERIFIED: [
    {
      to: "CLOSED",
      roles: ["reporter"],
      check: (_i, _a, input) => {
        if (input.isAuto) return null;
        return input.rating && input.rating >= 1 && input.rating <= 5
          ? null
          : "Please rate the resolution (1–5) to close the issue.";
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
          finalStatus = "ASSIGNED";
          sla = sla || initSla(priority, config);
          steps.push(timelineEntry(issue.status, "VALIDATED", actor, note, false));
          steps.push(
            timelineEntry("VALIDATED", "ASSIGNED", actor, "Auto-routed to maintenance", true)
          );
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

    if (input.to === "ONGOING" && issue.status === "COMPLETED") {
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
      ...patches,
      "counters.timelineCount": FieldValue.increment(steps.length || 1),
    });

    return { ...issue, ...patches, status: finalStatus } as Issue;
  });
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
