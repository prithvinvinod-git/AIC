import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { handleError, json, parseBody } from "@/lib/api";
import { adminDb } from "@/lib/firebaseAdmin";
import { ANNOUNCER_ROLES, publishAnnouncement } from "@/lib/announcements";
import { ROLES, EASTER_EGG_SLUGS, type Announcement } from "@/lib/types";

const audienceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all") }),
  z.object({ kind: z.literal("roles"), roles: z.array(z.enum([...ROLES] as const)) }),
]);

const bodySchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(120),
  body: z.string().trim().min(1, "Message can't be empty.").max(2000),
  images: z
    .array(z.string().regex(/^\/api\/images\/[a-f0-9-]+$/))
    .max(2, "You can attach at most 2 images.")
    .default([]),
  audience: audienceSchema,
  easterEgg: z.enum([...EASTER_EGG_SLUGS] as const).nullable().optional(),
});

/**
 * POST /api/announcements — publish a broadcast. Author must be an admin,
 * principal or HOD; on success the announcement is fanned out as
 * `announcement`-type notifications to the audience's feeds.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (!ANNOUNCER_ROLES.includes(user.role)) {
      const err = new Error(
        "Only admin, principal and HOD can publish announcements."
      ) as Error & { statusCode: number };
      err.statusCode = 403;
      throw err;
    }
    const input = await parseBody(req, bodySchema);
    const announcement = await publishAnnouncement(input, {
      uid: user.uid,
      name: user.name,
      role: user.role,
    });
    return json({ ok: true, announcement }, 201);
  } catch (e) {
    return handleError(e);
  }
}

/** GET /api/announcements — recent announcements, newest first (for authoring UI). */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAuth(req);
    const snap = await adminDb()
      .collection("announcements")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    const announcements: Announcement[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Announcement, "id">),
    }));
    return json({ announcements });
  } catch (e) {
    return handleError(e);
  }
}
