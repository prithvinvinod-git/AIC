import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, parseBody, handleError } from "@/lib/api";
import { capitalizeName } from "@/lib/format";

const db = adminDb();

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80).optional(),
  phone: z.string().trim().max(30).optional(),
  notifyEmail: z.boolean().optional(),
  college: z.string().trim().max(60).optional(),
  department: z.string().trim().max(80).optional(),
  profilePromptDismissed: z.boolean().optional(),
});

/**
 * GET /api/profile — the caller's own users/ document (for profile + settings).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    const snap = await db.doc(`users/${user.uid}`).get();
    if (!snap.exists) {
      return json({
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      });
    }
    return json({ ...snap.data() });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * PATCH /api/profile — self-service profile update. Mirrors the change to the
 * Auth display name, custom claims (name) and the users/ document.
 */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    const body = await parseBody(req, profileSchema);
    const name = body.name ? capitalizeName(body.name) : undefined;

    if (name) {
      await adminAuth().updateUser(user.uid, { displayName: name });
      const claims = { ...((await adminAuth().getUser(user.uid)).customClaims || {}) };
      claims.name = name;
      await adminAuth().setCustomUserClaims(user.uid, claims);
    }

    const userData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (name !== undefined) userData.name = name;
    if (body.phone !== undefined) userData.phone = body.phone;
    if (body.notifyEmail !== undefined) userData.notifyEmail = body.notifyEmail;
    if (body.college !== undefined) userData.college = body.college;
    if (body.department !== undefined) userData.department = body.department;
    if (body.profilePromptDismissed !== undefined)
      userData.profilePromptDismissed = body.profilePromptDismissed;

    if (body.college !== undefined || body.department !== undefined || body.profilePromptDismissed !== undefined) {
      const claims = { ...((await adminAuth().getUser(user.uid)).customClaims || {}) };
      if (body.college !== undefined) claims.college = body.college;
      if (body.department !== undefined) claims.department = body.department;
      if (body.profilePromptDismissed !== undefined)
        claims.profilePromptDismissed = body.profilePromptDismissed;
      await adminAuth().setCustomUserClaims(user.uid, claims);
    }

    await db.doc(`users/${user.uid}`).set(userData, { merge: true });

    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
