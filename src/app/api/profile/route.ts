import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, parseBody, handleError } from "@/lib/api";

const db = adminDb();

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80).optional(),
  phone: z.string().trim().max(30).optional(),
  notifyEmail: z.boolean().optional(),
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

    if (body.name) {
      await adminAuth().updateUser(user.uid, { displayName: body.name });
      const claims = { ...((await adminAuth().getUser(user.uid)).customClaims || {}) };
      claims.name = body.name;
      await adminAuth().setCustomUserClaims(user.uid, claims);
    }

    const userData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (body.name !== undefined) userData.name = body.name;
    if (body.phone !== undefined) userData.phone = body.phone;
    if (body.notifyEmail !== undefined) userData.notifyEmail = body.notifyEmail;

    await db.doc(`users/${user.uid}`).set(userData, { merge: true });

    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
