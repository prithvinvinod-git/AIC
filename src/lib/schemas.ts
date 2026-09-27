import { z } from "zod";
import { STATUSES } from "./types";
import { isValidCollege } from "./constants";

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
  description: z.string().min(10, "Describe the issue in at least 10 characters").max(2000),
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
  rating: z
    .number()
    .min(0.5)
    .max(5)
    .refine((r) => r % 0.5 === 0, "Rating must be in half steps (0.5–5)")
    .optional(),
  verdict: z.string().optional(),
});

export const requirementSchema = z.object({
  item: z.string().min(2, "Requirement item is required"),
  qty: z.number().int().min(1).default(1),
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
  college: z
    .string()
    .trim()
    .min(1, "College is required")
    .refine((c) => isValidCollege(c), "That college isn't one of the configured campus colleges.")
    .optional(),
  department: z.string().optional(),
  categoryId: z.string().optional(),
  phone: z.string().optional(),
  requiresEmailVerification: z.boolean().optional(),
  isActive: z.boolean().default(true),
});

/** POST variant of `adminUserSchema`: every managed account gets exactly one
 *  college, so it is required here. The base schema keeps college optional
 *  because PATCH legitimately omits it when an admin only edits role/name/etc.
 *  (see the "clear college" removal — the value can no longer be blanked). */
export const adminUserCreateSchema = adminUserSchema.extend({
  college: z
    // `error` also covers the missing-field case — without it Zod reports
    // "expected string, received undefined" instead of the admin-facing message.
    .string({ error: "College is required" })
    .trim()
    .min(1, "College is required")
    .refine((c) => isValidCollege(c), "That college isn't one of the configured campus colleges."),
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
  purchaseApprovalLimit: z.number().min(0).optional(),
  ai: z
    .object({
      enabled: z.boolean().optional(),
      triageModel: z.string().optional(),
      routingModel: z.string().optional(),
      threshold: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

/** Updating the purchase approval limit (₹) — admin/principal. */
export const purchaseLimitSchema = z.object({
  purchaseApprovalLimit: z.number().min(0, "The limit cannot be negative"),
});

/** Senior (HOD/Principal/Admin) rejecting an over-limit purchase submission. */
export const seniorRejectRequirementSchema = z.object({
  reason: z.string().min(3, "A rejection reason at least 3 characters is required"),
});
