import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { json, parseBody, handleError } from "@/lib/api";
import { clientIp, isRateLimited } from "@/lib/rateLimit";
import { adminUserSchema } from "@/lib/schemas";
import { invalidateServerCache } from "@/lib/serverCache";
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

    // Server-side rate limiting — this is the only Next-route auth door
    // (login/signup talk to Firebase directly via the client SDK, which
    // already enforces its own too-many-requests throttling).
    const ip = clientIp(req);
    if (isRateLimited(`provision:ip:${ip}`, { limit: 30, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: "Too many account requests from this device. Please try again later." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
    if (body.email && isRateLimited(`provision:email:${body.email.toLowerCase()}`, { limit: 10, windowMs: 60 * 60 * 1000 })) {
      return NextResponse.json(
        { error: "Too many attempts for this email. Please try again later." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }

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

    invalidateServerCache("api:admin:users");
    return json({ uid: userRecord.uid }, 201);
  } catch (e) {
    return handleError(e);
  }
}

/** PATCH /api/auth/provision — update role + claims for an existing user. */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    if (isRateLimited(`provision:patch:ip:${clientIp(req)}`, { limit: 60, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: "Too many requests from this device. Please try again later." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
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
      const existingClaims = (existing.customClaims ?? {}) as Record<string, unknown>;
      const requiresEmailVerification =
        body.requiresEmailVerification !== undefined
          ? body.requiresEmailVerification
          : Boolean(existingClaims.requiresEmailVerification);
      await adminAuth().setCustomUserClaims(body.uid, {
        role: body.role,
        portal: body.portal !== undefined ? body.portal : (existingClaims.portal as string) || null,
        department:
          body.department !== undefined
            ? body.department
            : (existingClaims.department as string) ?? "",
        college:
          body.college !== undefined
            ? body.college
            : (existingClaims.college as string) ?? null,
        requiresEmailVerification: requiresEmailVerification || null,
        name:
          name !== undefined
            ? name
            : ((existingClaims.name as string) || existing.displayName || ""),
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

    invalidateServerCache("api:admin:users");
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
