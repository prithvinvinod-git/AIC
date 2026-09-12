import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, parseBody, handleError } from "@/lib/api";
import { capitalizeName } from "@/lib/format";

const db = adminDb();

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().max(30).optional(),
  notifyEmail: z.boolean().optional(),
  college: z.string().trim().max(60).optional(),
  department: z.string().trim().max(80).optional(),
  profilePromptDismissed: z.boolean().optional(),
  hasPassword: z.boolean().optional(),
  fcmToken: z.string().trim().max(512).nullable().optional(),
  pushEnabled: z.boolean().optional(),
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

    // College + department are admin-managed for every role except reporter
    // (who self-onboards). Anything else would let a validator silently
    // re-scope their own queue.
    const wantOverride = body.college !== undefined || body.department !== undefined;
    if (wantOverride && user.role !== "reporter") {
      return json(
        { error: "College and department are managed by an administrator and can't be changed here." },
        403
      );
    }

    const userData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (name !== undefined) userData.name = name;
    if (body.email !== undefined) userData.email = body.email;
    if (body.phone !== undefined) userData.phone = body.phone;
    if (body.notifyEmail !== undefined) userData.notifyEmail = body.notifyEmail;
    if (body.college !== undefined) userData.college = body.college;
    if (body.department !== undefined) userData.department = body.department;
    if (body.profilePromptDismissed !== undefined)
      userData.profilePromptDismissed = body.profilePromptDismissed;
    if (body.hasPassword !== undefined) userData.hasPassword = body.hasPassword;
    if (body.fcmToken !== undefined) userData.fcmToken = body.fcmToken;
    if (body.pushEnabled !== undefined) userData.pushEnabled = body.pushEnabled;

    if (body.college !== undefined || body.department !== undefined || body.profilePromptDismissed !== undefined || body.hasPassword !== undefined || body.pushEnabled !== undefined) {
      const claims = { ...((await adminAuth().getUser(user.uid)).customClaims || {}) };
      if (body.college !== undefined) claims.college = body.college;
      if (body.department !== undefined) claims.department = body.department;
      if (body.profilePromptDismissed !== undefined)
        claims.profilePromptDismissed = body.profilePromptDismissed;
      if (body.hasPassword !== undefined) claims.hasPassword = body.hasPassword;
      if (body.pushEnabled !== undefined) claims.pushEnabled = body.pushEnabled;
      await adminAuth().setCustomUserClaims(user.uid, claims);
    }

    await db.doc(`users/${user.uid}`).set(userData, { merge: true });

    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
