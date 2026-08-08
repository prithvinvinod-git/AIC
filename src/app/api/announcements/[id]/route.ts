import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { handleError, json, parseBody } from "@/lib/api";
import { ANNOUNCER_ROLES, deleteAnnouncement, updateAnnouncement } from "@/lib/announcements";
import { ROLES } from "@/lib/types";

const audienceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all") }),
  z.object({ kind: z.literal("roles"), roles: z.array(z.enum([...ROLES] as const)) }),
]);

const patchSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(120).optional(),
  body: z.string().trim().min(1, "Message can't be empty.").max(2000).optional(),
  images: z
    .array(z.string().regex(/^\/api\/images\/[a-f0-9-]+$/))
    .max(2, "You can attach at most 2 images.")
    .optional(),
  audience: audienceSchema.optional(),
});

async function gate(req: NextRequest) {
  const user = await requireAuth(req);
  if (!ANNOUNCER_ROLES.includes(user.role)) {
    const err = new Error(
      "Only admin, principal and HOD can manage announcements."
    ) as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }
  return user;
}

/**
 * PATCH /api/announcements/[id] — edit an announcement. Role-gated; on
 * audience changes, only newly added recipients are notified.
 */
export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/announcements/[id]">
): Promise<NextResponse> {
  try {
    await gate(req);
    const { id } = await ctx.params;
    const patch = await parseBody(req, patchSchema);
    const announcement = await updateAnnouncement(id, patch);
    return json({ ok: true, announcement });
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/announcements/[id] — remove an announcement and its images. */
export async function DELETE(
  req: NextRequest,
  ctx: RouteContext<"/api/announcements/[id]">
): Promise<NextResponse> {
  try {
    await gate(req);
    const { id } = await ctx.params;
    await deleteAnnouncement(id);
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
