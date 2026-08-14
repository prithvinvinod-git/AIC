import { z } from "zod";
import { STATUSES } from "./types";

export const locationSchema = z.object({
  name: z.string().min(1, "Location name is required"),
  building: z.string().min(1, "Building is required"),
  floor: z.string().optional(),
});

export const imageSchema = z.object({
  url: z
    .string()
    .min(1, "Image URL is required")
    .refine((u) => u.startsWith("/api/images/") || /^https?:\/\//.test(u), {
      message: "Image URL must point to an uploaded image",
    }),
  uploadedBy: z.string(),
  at: z.string(),
});

export const createIssueSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(140),
  description: z.string().min(10, "Describe the issue in at least 10 characters"),
  college: z.string().optional(),
  department: z.string().min(1, "Department is required"),
  location: locationSchema,
  categoryId: z.string().min(1, "Category is required"),
  priority: z.number().int().min(1).max(5).optional(),
  images: z.array(imageSchema).max(6).default([]),
});

export const statusToSchema = z.enum(STATUSES as unknown as [string, ...string[]]);

export const statusTransitionSchema = z.object({
  to: statusToSchema,
  note: z.string().optional(),
  priority: z.number().int().min(1).max(5).optional(),
  teamId: z.string().optional(),
  staff: z.array(z.string()).optional(),
  categoryId: z.string().optional(),
  categoryName: z.string().optional(),
  categoryHeadUid: z.string().optional(),
  maintenanceHeadUid: z.string().optional(),
  rejectionReason: z.string().optional(),
  sendBackReason: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  verdict: z.string().optional(),
});

export const requirementSchema = z.object({
  item: z.string().min(2, "Requirement item is required"),
  qty: z.number().int().min(0).default(1),
  needsApproval: z.boolean().default(false),
  resolved: z.boolean().default(false),
});

export const resolveRequirementSchema = z.object({
  resolved: z.boolean(),
});

/** Edit a requirement (item/qty) — used to resubmit a rejected approval request. */
export const editRequirementSchema = z.object({
  item: z.string().min(2).optional(),
  qty: z.number().int().min(0).optional(),
});

/** Purchase team approving a needsApproval requirement with a unit price. */
export const approveRequirementSchema = z.object({
  price: z.number().min(0, "Price cannot be negative"),
});

/** Purchase team rejecting a needsApproval requirement with a reason. */
export const rejectRequirementSchema = z.object({
  reason: z.string().min(3, "A rejection reason is required"),
});

export const commentSchema = z.object({
  body: z.string().min(1, "Comment cannot be empty").max(1000),
});

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export const adminUserSchema = z.object({
  uid: z.string().optional(),
  name: z.string().min(1),
  email: z.string().email().or(z.literal("")).default(""),
  password: z.string().min(6).optional(),
  role: z.enum(["reporter", "validator", "hod", "principal", "maintenance_head", "category_head", "maintenance", "purchase", "admin"]),
  portal: z.enum(["reporter", "validator", "hod", "principal", "maintenance_head", "category_head", "maintenance", "purchase", "admin"]).optional(),
  college: z.string().optional(),
  department: z.string(),
  phone: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const teamSchema = z.object({
  name: z.string().min(1),
  categoryId: z.string().min(1),
  members: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export const categorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  headUid: z.string().optional(),
  defaultTeamId: z.string().optional(),
  slaResponseHours: z.number().min(0),
  slaResolutionHours: z.number().min(0),
  isActive: z.boolean().default(true),
});

export const configSchema = z.object({
  feedbackGraceHours: z.number().min(1).max(24 * 14).optional(),
  assignmentMode: z.enum(["claim", "assign"]).optional(),
  ai: z
    .object({
      enabled: z.boolean().optional(),
      triageModel: z.string().optional(),
      routingModel: z.string().optional(),
      threshold: z.number().min(0).max(1).optional(),
    })
    .optional(),
});
