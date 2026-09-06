import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { json, parseBody, handleError } from "@/lib/api";
import { adminUserSchema } from "@/lib/schemas";
import { capitalizeName } from "@/lib/format";
import type { Role } from "@/lib/types";

const db = adminDb();

/**
 * POST /api/auth/provision — create a user with a role + custom claim.
 * Used by the admin panel; signup for reporters and social/phone sign-ins
 * also route through here with role=reporter. When `uid` is supplied the
 * Auth account already exists (created client-side) and is only claimed.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await parseBody(req, adminUserSchema);
    const role: Role = body.role;
    const name = capitalizeName(body.name || "");

    let userRecord;
    if (body.uid) {
      userRecord = await adminAuth().getUser(body.uid);
    } else {
      try {
        userRecord = await adminAuth().createUser({
          email: body.email,
          password: body.password || "demo1234",
          displayName: name,
        });
      } catch (e) {
        const err = e as { code?: string };
        if (err.code === "auth/email-already-in-use") {
          userRecord = await adminAuth().getUserByEmail(body.email);
        } else {
          throw e;
        }
      }
    }

    await adminAuth().setCustomUserClaims(userRecord.uid, {
      role,
      portal: body.portal || null,
      department: body.department,
      college: body.college || null,
      requiresEmailVerification: body.requiresEmailVerification || null,
      name,
    });

    await db.doc(`users/${userRecord.uid}`).set(
      {
        name,
        email: body.email,
        role,
        portal: body.portal || "",
        college: body.college || "",
        department: body.department,
        phone: body.phone || userRecord.phoneNumber || "",
        isActive: body.isActive,
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return json({ uid: userRecord.uid }, 201);
  } catch (e) {
    return handleError(e);
  }
}

/** PATCH /api/auth/provision — update role + claims for an existing user. */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await parseBody(req, adminUserSchema.partial());
    if (!body.uid) return json({ error: "uid is required." }, 400);

    const updates: Record<string, unknown> = {};
    const name = body.name ? capitalizeName(body.name) : undefined;
    if (name) updates.displayName = name;
    if (body.password) {
      await adminAuth().updateUser(body.uid, { password: body.password });
    }
    if (name) await adminAuth().updateUser(body.uid, updates as never);
    if (body.role) {
      const existing = await adminAuth().getUser(body.uid);
      const requiresEmailVerification =
        body.requiresEmailVerification !== undefined
          ? body.requiresEmailVerification
          : Boolean(existing.customClaims?.requiresEmailVerification);
      await adminAuth().setCustomUserClaims(body.uid, {
        role: body.role,
        portal: body.portal || null,
        department: body.department || "",
        college: body.college || null,
        requiresEmailVerification: requiresEmailVerification || null,
        name: name || "",
      });
    }

    const userData: Record<string, unknown> = {};
    if (name !== undefined) userData.name = name;
    if (body.role !== undefined) userData.role = body.role;
    if (body.portal !== undefined) userData.portal = body.portal;
    if (body.college !== undefined) userData.college = body.college;
    if (body.department !== undefined) userData.department = body.department;
    if (body.phone !== undefined) userData.phone = body.phone;
    if (body.isActive !== undefined) userData.isActive = body.isActive;

    await db.doc(`users/${body.uid}`).set(userData, { merge: true });

    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
