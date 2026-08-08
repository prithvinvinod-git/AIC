export type Role =
  | "reporter"
  | "validator"
  | "hod"
  | "principal"
  | "maintenance"
  | "admin";

export const ROLES: Role[] = [
  "reporter",
  "validator",
  "hod",
  "principal",
  "maintenance",
  "admin",
];

export type IssueStatus =
  | "NEW"
  | "VALIDATED"
  | "ESCALATED"
  | "APPROVED"
  | "ASSIGNED"
  | "ONGOING"
  | "PENDING"
  | "COMPLETED"
  | "VERIFIED"
  | "REJECTED"
  | "CLOSED";

export const STATUSES: IssueStatus[] = [
  "NEW",
  "VALIDATED",
  "ESCALATED",
  "APPROVED",
  "ASSIGNED",
  "ONGOING",
  "PENDING",
  "COMPLETED",
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
}

export interface Requirement {
  item: string;
  qty: number;
  needsApproval: boolean;
  resolved: boolean;
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
  };
  requirements: Requirement[];
  involveTeams: InvolvedTeam[];
  sla?: SlaState;
  rejection?: Rejection;
  completion?: Completion;
  verification?: Verification;
  feedback?: Feedback;
  reporter: { uid: string; name: string; department: string };
  aiSuggestion?: AISuggestion;
  counters?: { commentCount: number; timelineCount: number };
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
