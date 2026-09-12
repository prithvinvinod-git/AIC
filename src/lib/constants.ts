import {
  BellRing,
  CheckCheck,
  ClipboardList,
  Clock,
  Megaphone,
  ShieldAlert,
  ShoppingCart,
  TriangleAlert,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { IssueStatus, Role } from "./types";

export const STATUS_LABEL: Record<IssueStatus, string> = {
  NEW: "New",
  VALIDATED: "Validated",
  ESCALATED: "Escalated",
  APPROVED: "Approved",
  ROUTED: "With head",
  PENDING_ASSIGN: "To assign",
  ASSIGNED: "Assigned",
  ONGOING: "In progress",
  PENDING: "Pending",
  COMPLETED: "Completed",
  INSPECTED: "Inspected",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  CLOSED: "Closed",
};

export const STATUS_STEP_ORDER: IssueStatus[] = [
  "NEW",
  "VALIDATED",
  "ESCALATED",
  "APPROVED",
  "ROUTED",
  "PENDING_ASSIGN",
  "ASSIGNED",
  "ONGOING",
  "COMPLETED",
  "INSPECTED",
  "VERIFIED",
  "CLOSED",
];

export const PRIORITY_LABEL: Record<number, string> = {
  1: "Critical",
  2: "High",
  3: "Medium",
  4: "Low",
  5: "Minor",
};

export const PRIORITY_COLOR: Record<number, string> = {
  1: "#c1452e",
  2: "#b45309",
  3: "#d97757",
  4: "#78716c",
  5: "#a8a29e",
};

export const ROLE_LABEL: Record<Role, string> = {
  reporter: "Reporter",
  validator: "Dept Validator",
  hod: "HOD",
  principal: "Principal",
  maintenance_head: "Maintenance Head",
  category_head: "Category Head",
  maintenance: "Maintenance",
  purchase: "Purchase Team",
  admin: "Admin",
};

/** Icon + color per notification type, used by the bell, feed and page. */
export const NOTIFICATION_META: Record<
  string,
  { label: string; icon: LucideIcon; iconClass: string }
> = {
  issue: { label: "Issue update", icon: ClipboardList, iconClass: "text-accent" },
  escalation: { label: "Escalation", icon: TriangleAlert, iconClass: "text-warning" },
  assignment: { label: "Assignment", icon: Wrench, iconClass: "text-success" },
  verification: { label: "Verification", icon: CheckCheck, iconClass: "text-success" },
  pending: { label: "Pending", icon: Clock, iconClass: "text-warning" },
  spam: { label: "Flagged", icon: ShieldAlert, iconClass: "text-danger" },
  purchase: { label: "Purchase", icon: ShoppingCart, iconClass: "text-accent" },
  announcement: { label: "Announcement", icon: Megaphone, iconClass: "text-violet" },
};

export const NOTIFICATION_FALLBACK_META = {
  label: "Notification",
  icon: BellRing,
  iconClass: "text-slate",
};

export const DEPARTMENTS = [
  "Computer Science",
  "Electrical",
  "Mechanical",
  "Civil",
  "Administration",
  "Hostel",
  "Library",
];

export const COLLEGES = [
  "Engineering",
  "Dental",
  "Pharmaceutical",
  "Medical",
  "Nursing",
] as const;

export type College = (typeof COLLEGES)[number];

/** Roles whose queue is scoped to a single department — a department is
 *  required, and it is always managed by an admin, never self-service. */
export const DEPARTMENT_SCOPED_ROLES: Role[] = ["validator", "hod"];

/** Roles whose assignment anywhere in the app is a category, not a
 *  department — admin add/edit forms, profile/settings display, feed and
 *  page headers. category_head and maintenance_head are additionally wired
 *  as categories/{id}.headUid (their queues are scoped by which category
 *  they head); maintenance/purchase just store the selection. */
export const CATEGORY_SCOPED_ROLES: Role[] = [
  "maintenance_head",
  "category_head",
  "maintenance",
  "purchase",
];

/** Roles that are neither department- nor category-scoped (no picker). */
export const NO_ASSIGNMENT_ROLES: Role[] = ["principal", "admin"];

export const DEPARTMENTS_BY_COLLEGE: Record<College, string[]> = {
  Engineering: [
    "Computer Science",
    "Electronics & Communication",
    "Electrical",
    "Mechanical",
    "Civil",
  ],
  Dental: [
    "Oral Medicine",
    "Oral & Maxillofacial Surgery",
    "Conservative Dentistry",
    "Prosthodontics",
    "Periodontics",
    "Endodontics",
    "Orthodontics",
    "Pedodontics",
    "Public Health Dentistry",
  ],
  Pharmaceutical: [
    "Pharmaceutics",
    "Pharmaceutical Chemistry",
    "Pharmacology",
    "Pharmacognosy",
    "Pharmacy Practice",
    "Clinical Pharmacy",
  ],
  Medical: [
    "Anatomy",
    "Physiology",
    "Biochemistry",
    "Pathology",
    "Microbiology",
    "Pharmacology",
    "Community Medicine",
    "General Medicine",
    "General Surgery",
    "Pediatrics",
    "Obstetrics & Gynecology",
    "Orthopedics",
    "Radiology",
    "Anesthesia",
    "Dermatology",
    "Psychiatry",
  ],
  Nursing: [
    "Medical-Surgical Nursing",
    "Pediatric Nursing",
    "Community Health Nursing",
    "Obstetrics & Gynecological Nursing",
    "Psychiatric Nursing",
    "Fundamentals of Nursing",
  ],
};

export const BUILDINGS = [
  "Block A",
  "Block B",
  "Block C",
  "Block D",
  "Main Building",
  "Hostel 1",
  "Hostel 2",
  "Library",
  "Admin Block",
  "Sports Complex",
];

export const DEFAULT_FLOORS = ["Ground", "1", "2", "3", "4", "Roof"];

/** Per-college building lists shown in the report form. */
export const BUILDINGS_BY_COLLEGE: Record<College, string[]> = {
  Engineering: [
    "Office",
    "Seminar Hall",
    "Auditorium",
    "Library",
    "Canteen",
    "Lab",
    "Workshop",
    "Main building",
    "Toilet",
    "Classroom",
    "Department",
  ],
  Dental: BUILDINGS,
  Pharmaceutical: BUILDINGS,
  Medical: BUILDINGS,
  Nursing: BUILDINGS,
};

/** Per-college floor lists shown in the report form. */
export const FLOORS_BY_COLLEGE: Record<College, string[]> = {
  Engineering: ["Underground", "Ground", "1", "2", "3", "Roof"],
  Dental: DEFAULT_FLOORS,
  Pharmaceutical: DEFAULT_FLOORS,
  Medical: DEFAULT_FLOORS,
  Nursing: DEFAULT_FLOORS,
};

export const SAMPLE_CATEGORIES = [
  "Electrical",
  "Plumbing",
  "HouseKeeping",
  "General",
  "IT",
];

/** Spec §7 — priority → SLA hours. Clock starts at acceptance. */
export const SLA_DEFAULTS = {
  p1: { responseHours: 1, resolutionHours: 24 },
  p2: { responseHours: 4, resolutionHours: 48 },
  p3: { responseHours: 12, resolutionHours: 72 },
  p4: { responseHours: 24, resolutionHours: 168 },
  p5: { responseHours: 48, resolutionHours: 336 },
};

export const DEFAULT_CONFIG = {
  feedbackGraceHours: 24,
  assignmentMode: "claim" as "claim" | "assign",
  purchaseApprovalLimit: 5000,
  ai: {
    enabled: true,
    triageModel: "gemini-2.0-flash",
    routingModel: "gemini-2.0-flash",
    threshold: 0.82,
  },
  sequenceCounters: { issues: 0 },
  slaDefaults: SLA_DEFAULTS,
};

export const ALLOWED_ISSUE_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic"];
export const MAX_ISSUE_IMAGE_BYTES = 5 * 1024 * 1024;
