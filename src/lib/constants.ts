import type { IssueStatus, Role } from "./types";

export const STATUS_LABEL: Record<IssueStatus, string> = {
  NEW: "New",
  VALIDATED: "Validated",
  ESCALATED: "Escalated",
  APPROVED: "Approved",
  ASSIGNED: "Assigned",
  ONGOING: "In progress",
  PENDING: "Pending",
  COMPLETED: "Completed",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  CLOSED: "Closed",
};

export const STATUS_STEP_ORDER: IssueStatus[] = [
  "NEW",
  "VALIDATED",
  "ESCALATED",
  "APPROVED",
  "ASSIGNED",
  "ONGOING",
  "COMPLETED",
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
  1: "#c0392b",
  2: "#d97706",
  3: "#2563eb",
  4: "#6b7280",
  5: "#a3a3a3",
};

export const ROLE_LABEL: Record<Role, string> = {
  reporter: "Reporter",
  validator: "Dept Validator",
  hod: "HOD",
  principal: "Principal",
  maintenance: "Maintenance",
  admin: "Admin",
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

export const DEPARTMENTS_BY_COLLEGE: Record<College, string[]> = {
  Engineering: [
    "Computer Science",
    "Information Technology",
    "Electronics & Communication",
    "Electrical",
    "Mechanical",
    "Civil",
    "Automobile",
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
