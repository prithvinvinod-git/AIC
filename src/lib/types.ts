import type { LucideIcon } from "lucide-react";
import { Flag, Sparkles, Flower2, TreePine, Moon, Paintbrush, Egg, Leaf, Wrench, GraduationCap, Bot } from "lucide-react";

export type Role =
  | "reporter"
  | "validator"
  | "hod"
  | "principal"
  | "maintenance_head"
  | "category_head"
  | "maintenance"
  | "purchase"
  | "admin";

export const ROLES: Role[] = [
  "reporter",
  "validator",
  "hod",
  "principal",
  "maintenance_head",
  "category_head",
  "maintenance",
  "purchase",
  "admin",
];

export type IssueStatus =
  | "NEW"
  | "VALIDATED"
  | "ESCALATED"
  | "APPROVED"
  | "ROUTED"
  | "PENDING_ASSIGN"
  | "ASSIGNED"
  | "ONGOING"
  | "PENDING"
  | "COMPLETED"
  | "INSPECTED"
  | "VERIFIED"
  | "REJECTED"
  | "CLOSED";

export const STATUSES: IssueStatus[] = [
  "NEW",
  "VALIDATED",
  "ESCALATED",
  "APPROVED",
  "ROUTED",
  "PENDING_ASSIGN",
  "ASSIGNED",
  "ONGOING",
  "PENDING",
  "COMPLETED",
  "INSPECTED",
  "VERIFIED",
  "REJECTED",
  "CLOSED",
];

export interface Location {
  name: string;
  building: string;
  floor?: string;
}

export interface ImageRef {
  url: string;
  uploadedBy: string;
  at: string;
}

export interface TimelineEntry {
  from: IssueStatus | "";
  to: IssueStatus;
  by: { uid: string; name: string; role: Role };
  note?: string;
  at: string;
  isAuto: boolean;
}

export interface Comment {
  id?: string;
  author: { uid: string; name: string; role: Role };
  body: string;
  at: string;
  likes?: number;
  likedByUids?: string[];
}

export interface Requirement {
  id?: string;
  item: string;
  qty: number;
  needsApproval: boolean;
  resolved: boolean;
  /** Set only when `needsApproval` — the purchase team workflow state. */
  approvalStatus?: "pending" | "approved" | "rejected";
  /** Unit price entered by the purchase team when approving. */
  price?: number;
  approvalBy?: { uid: string; name: string };
  approvalAt?: string;
  rejectReason?: string;
  rejectedBy?: { uid: string; name: string };
  rejectedAt?: string;
  /** Set when the purchase team routes an over-limit price to a senior (HOD/Principal/Admin) for approval. */
  seniorApprovalRequired?: boolean;
  submittedBy?: { uid: string; name: string };
  submittedAt?: string;
  addedBy: { uid: string; name: string };
  at: string;
}

export interface InvolvedTeam {
  teamId: string;
  completed: boolean;
}

export interface SlaState {
  startedAt: string;
  responseDeadline: string;
  resolutionDeadline: string;
  pausedAt: string | null;
  totalPausedMs: number;
  breachedFlags: { response?: boolean; resolution?: boolean };
}

export interface Rejection {
  reason: string;
  by: { uid: string; name: string };
  at: string;
}

export interface Completion {
  report: string;
  completedAt: string;
}

export interface Verification {
  verifiedBy: { uid: string; name: string };
  verifiedAt: string;
  verdict: string;
  note?: string;
  sendBackReason?: string;
}

/** Category head's on-site inspection after the worker reports completion. */
export interface Inspection {
  inspectedBy: { uid: string; name: string };
  inspectedAt: string;
  verdict: string;
  note?: string;
}

export interface Feedback {
  rating: number;
  comment?: string;
  givenAt: string;
  autoClosed: boolean;
}

export interface AISuggestion {
  category?: string;
  suggestedPriority?: number;
  reasons?: string[];
  photoSummary?: string;
  safetyFlags?: string[];
  isSpam?: boolean;
  spamReasons?: string[];
  routing?: {
    teamId: string;
    staffIds: string[];
    reason: string;
  } | null;
  duplicateOf?: string | null;
  duplicateIssueNo?: string | null;
  matchScore?: number;
  similarIssues?: { id: string; issueNo: string; score: number }[];
  aiProcessed: boolean;
  aiModel?: string;
  processedAt?: string;
}

export interface Issue {
  id?: string;
  issueNo: string;
  trackingToken?: string;
  title: string;
  description: string;
  college?: string;
  department: string;
  location: Location;
  images: ImageRef[];
  status: IssueStatus;
  priority: number;
  prioritySetBy?: { uid: string; name: string };
  prioritySetAt?: string;
  escalation?: {
    required: boolean;
    status: "pending" | "confirmed";
    reviewedBy?: { uid: string; name: string };
    reviewedAt?: string;
    note?: string;
  };
  routing?: {
    categoryId: string;
    categoryName: string;
    teamId: string;
    staff: { uid: string; name: string }[];
    /** Department maintenance head the issue was routed to (denormalized). */
    maintenanceHeadUid?: string;
    /** Category head responsible for assigning workers (denormalized). */
    categoryHeadUid?: string;
    /** Handoff note from the maintenance head when routing to a category head. */
    note?: string;
  };
  requirements: Requirement[];
  involveTeams: InvolvedTeam[];
  /** Denormalized count of `needsApproval && approvalStatus === "pending"` requirements. */
  pendingPurchaseCount?: number;
  /** Denormalized count of requirements flagged for senior (over-limit) approval. */
  pendingSeniorApprovalCount?: number;
  sla?: SlaState;
  rejection?: Rejection;
  completion?: Completion;
  inspection?: Inspection;
  verification?: Verification;
  feedback?: Feedback;
  reporter: { uid: string; name: string; department: string };
  aiSuggestion?: AISuggestion;
  counters?: { commentCount: number; timelineCount: number };
  /** Set by admin/principal to exclude an issue from the cross-user board. */
  boardHidden?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType =
  | "issue"
  | "escalation"
  | "assignment"
  | "verification"
  | "pending"
  | "spam"
  | "announcement";

export interface Notification {
  id?: string;
  type: string;
  title: string;
  body: string;
  link: string;
  isRead: boolean;
  at: string;
}

export type EasterEggEvent =
  | "republic-day"
  | "independence-day"
  | "onam"
  | "christmas"
  | "eid"
  | "holi"
  | "easter"
  | "environment-day"
  | "engineers-day"
  | "freshers-day"
  | "tech-fest";

export const EASTER_EGG_META: Record<EasterEggEvent, { label: string; Icon: LucideIcon; description: string }> = {
  "republic-day":       { label: "Republic Day",       Icon: Flag,          description: "Celebrating the constitution and spirit of the nation" },
  "independence-day":   { label: "Independence Day",   Icon: Sparkles,      description: "Honoring the freedom and resilience of the country" },
  "onam":               { label: "Onam",               Icon: Flower2,       description: "The harvest festival of flowers, food and folklore" },
  "christmas":          { label: "Christmas",          Icon: TreePine,      description: "A season of joy, giving and togetherness" },
  "eid":                { label: "Eid",                Icon: Moon,          description: "Celebrating faith, community and gratitude" },
  "holi":               { label: "Holi",               Icon: Paintbrush,    description: "The festival of colors, love and new beginnings" },
  "easter":             { label: "Easter",             Icon: Egg,           description: "A celebration of renewal and hope" },
  "environment-day":    { label: "Environment Day",    Icon: Leaf,          description: "Reflecting on our planet and our duty to protect it" },
  "engineers-day":      { label: "Engineers Day",      Icon: Wrench,        description: "Celebrating the builders, innovators and problem-solvers" },
  "freshers-day":       { label: "Freshers Day",       Icon: GraduationCap, description: "Welcoming the newest members of our campus community" },
  "tech-fest":          { label: "Tech Fest",          Icon: Bot,           description: "Where code meets creativity and ideas take flight" },
};

export const EASTER_EGG_SLUGS = Object.keys(EASTER_EGG_META) as EasterEggEvent[];

/** Who an announcement is broadcast to: everyone, or only users with given roles. */
export type AnnouncementAudience =
  | { kind: "all" }
  | { kind: "roles"; roles: Role[] };

export interface Announcement {
  id?: string;
  title: string;
  body: string;
  /** `/api/images/{id}` URLs; up to 2, first is the card thumbnail. */
  images: string[];
  audience: AnnouncementAudience;
  author: { uid: string; name: string; role: Role };
  easterEgg?: EasterEggEvent | null;
  createdAt: string;
  updatedAt?: string;
}

export interface Team {
  id?: string;
  name: string;
  categoryId: string;
  members: string[];
  isActive: boolean;
  createdAt: string;
}

/** Team as returned by GET /api/teams (member uids resolved to names). */
export interface TeamWithMembers {
  id: string;
  name: string;
  categoryId: string;
  members: { uid: string; name: string }[];
  isActive: boolean;
}

export interface Category {
  id?: string;
  name: string;
  description?: string;
  /** UID of the category head (role `category_head`) who assigns workers. */
  headUid?: string;
  defaultTeamId?: string;
  slaResponseHours: number;
  slaResolutionHours: number;
  isActive: boolean;
}

export interface AppConfig {
  slaDefaults?: {
    p1: { responseHours: number; resolutionHours: number };
    p2: { responseHours: number; resolutionHours: number };
    p3: { responseHours: number; resolutionHours: number };
    p4: { responseHours: number; resolutionHours: number };
    p5: { responseHours: number; resolutionHours: number };
  };
  feedbackGraceHours: number;
  assignmentMode: "claim" | "assign";
  /** Purchases whose total (price × qty) exceeds this ₹ limit need senior (HOD/Principal/Admin) approval. */
  purchaseApprovalLimit: number;
  ai: { enabled: boolean; triageModel: string; routingModel: string; threshold: number };
  sequenceCounters: { issues: number };
}

export interface AppUser {
  uid?: string;
  name: string;
  email: string;
  role: Role;
  college?: string;
  department: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
}
