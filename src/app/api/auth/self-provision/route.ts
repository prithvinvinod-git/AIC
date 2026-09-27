import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { json, parseBody, handleError } from "@/lib/api";
import { clientIp, isRateLimited } from "@/lib/rateLimit";
import { capitalizeName } from "@/lib/format";
import { isValidCollege, isValidDepartment } from "@/lib/constants";

const db = adminDb();

const selfProvisionSchema = z.object({
  email: z.string().trim().email().optional(),
  name: z.string().trim().min(1, "Name is required").max(80).optional(),
  college: z
    .string()
    .trim()
    .max(60)
    .refine((c) => c === "" || isValidCollege(c), "That college isn't one of the configured campus colleges.")
    .optional(),
  department: z.string().trim().max(80).optional(),
});

/**
 * POST /api/auth/self-provision — claim the *caller's own* freshly-created Auth
 * account (+ Google/social sign-in) as a reporter. This is the only
 * role-minting endpoint a non-admin may use, and it can only ever produce
 * `reporter` on the token's own uid — it can never escalate, and it refuses
 * (idempotently) once a role already exists.
 *
 * Admin user management (any role, password reset, re-scoping) stays on
 * POST/PATCH /api/auth/provision, which now requires an admin token.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const header = req.headers.get("authorization");
    if (!header?.startsWith("Bearer ")) {
      const err = new Error("Unauthorized") as Error & { statusCode: number };
      err.statusCode = 401;
      throw err;
    }
    let decoded;
    try {
      decoded = await adminAuth().verifyIdToken(header.slice("Bearer ".length), true);
    } catch {
      const err = new Error("Unauthorized") as Error & { statusCode: number };
      err.statusCode = 401;
      throw err;
    }

    const ip = clientIp(req);
    if (isRateLimited(`self-provision:ip:${ip}`, { limit: 30, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: "Too many account requests from this device. Please try again later." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const body = await parseBody(req, selfProvisionSchema);

    // Already provisioned with a role — nothing to do. Idempotent so signup
    // retries don't clobber an admin-assigned role.
    if (decoded.role) return json({ ok: true });

    const email = decoded.email || body.email || "";
    if (email && isRateLimited(`self-provision:email:${email.toLowerCase()}`, { limit: 10, windowMs: 60 * 60 * 1000 })) {
      return NextResponse.json(
        { error: "Too many attempts for this email. Please try again later." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }

    const name = capitalizeName(
      body.name || (decoded.name as string) || email.split("@")[0] || "User"
    ).slice(0, 80);
    const college = body.college || "";
    const department = body.department || "";
    // Signup passes both together; if only one arrives, the other must be
    // cleared so the mandatory onboarding modal can collect it properly.
    if (college && department && !isValidDepartment(college, department)) {
      return json({ error: "That department doesn't exist in the selected college." }, 400);
    }

    await adminAuth().setCustomUserClaims(decoded.uid, {
      role: "reporter",
      portal: null,
      department,
      college: college || null,
      categoryId: null,
      categoryName: null,
      requiresEmailVerification: decoded.email_verified ? null : true,
      name,
    });

    await db.doc(`users/${decoded.uid}`).set(
      {
        name,
        email,
        role: "reporter",
        portal: "",
        college,
        department,
        phone: (decoded.phone_number as string) || "",
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return json({ uid: decoded.uid }, 201);
  } catch (e) {
    return handleError(e);
  }
}