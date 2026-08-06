import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { json, parseBody, handleError } from "@/lib/api";
import { adminUserSchema } from "@/lib/schemas";
import type { Role } from "@/lib/types";

const db = adminDb();

/**
 * POST /api/auth/provision — create a user with a role + custom claim.
 * Used by the admin panel; signup for reporters also routes through here
 * with role=reporter.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await parseBody(req, adminUserSchema);
    const role: Role = body.role;

    let userRecord;
    try {
      userRecord = await adminAuth().createUser({
        email: body.email,
        password: body.password || "demo1234",
        displayName: body.name,
      });
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === "auth/email-already-in-use") {
        userRecord = await adminAuth().getUserByEmail(body.email);
      } else {
        throw e;
      }
    }

    await adminAuth().setCustomUserClaims(userRecord.uid, {
      role,
      department: body.department,
      name: body.name,
    });

    await db.doc(`users/${userRecord.uid}`).set(
      {
        name: body.name,
        email: body.email,
        role,
        department: body.department,
        phone: body.phone || "",
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
    if (body.name) updates.displayName = body.name;
    if (body.password) {
      await adminAuth().updateUser(body.uid, { password: body.password });
    }
    if (body.name) await adminAuth().updateUser(body.uid, updates as never);
    if (body.role) {
      await adminAuth().setCustomUserClaims(body.uid, {
        role: body.role,
        department: body.department || "",
        name: body.name || "",
      });
    }

    const userData: Record<string, unknown> = {};
    if (body.name !== undefined) userData.name = body.name;
    if (body.role !== undefined) userData.role = body.role;
    if (body.department !== undefined) userData.department = body.department;
    if (body.phone !== undefined) userData.phone = body.phone;
    if (body.isActive !== undefined) userData.isActive = body.isActive;

    await db.doc(`users/${body.uid}`).set(userData, { merge: true });

    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
