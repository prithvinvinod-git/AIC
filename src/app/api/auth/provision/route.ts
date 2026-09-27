import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { json, parseBody, handleError } from "@/lib/api";
import { requireUserManager, assertMayManageRole } from "@/lib/auth";
import { clientIp, isRateLimited } from "@/lib/rateLimit";
import { adminUserCreateSchema, adminUserSchema } from "@/lib/schemas";
import { CATEGORY_SCOPED_ROLES, DEPARTMENT_SCOPED_ROLES, isValidDepartment } from "@/lib/constants";
import { invalidateServerCache } from "@/lib/serverCache";
import { capitalizeName } from "@/lib/format";
import type { Role } from "@/lib/types";

const db = adminDb();

/** Resolve a category's display name (denormalized onto the user + claims so
 *  client UIs don't need a second lookup to label someone's assignment). */
async function categoryNameOf(categoryId: string): Promise<string> {
  const snap = await db.doc(`categories/${categoryId}`).get();
  return snap.exists ? String(snap.data()?.name ?? "") : "";
}

/**
 * POST /api/auth/provision — create a user with a role + custom claim.
 * ADMIN or PRINCIPAL. Used by the admin panel; signup for reporters and
 * social sign-ins use the caller-own POST /api/auth/self-provision instead.
 * A principal may not create admin accounts (see assertMayManageRole).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const actor = await requireUserManager(req);
    // POST requires a college (adminUserCreateSchema) — every managed account
    // belongs to exactly one college. PATCH stays on the base schema so a
    // role-only edit may omit it.
    const body = await parseBody(req, adminUserCreateSchema);
    // Blocked before any Firebase write so a principal cannot mint an admin.
    assertMayManageRole(actor, body.role);

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
    const department = role === "principal" ? "" : body.department;
    // Category-scoped roles (maintenance family) are assigned via category
    // instead of department.
    const categoryScoped = (CATEGORY_SCOPED_ROLES as Role[]).includes(role);
    const categoryId = body.categoryId || "";
    const categoryName = categoryId ? await categoryNameOf(categoryId) : "";

    // Department-scoped roles (validator, hod) are useless without a
    // department — their queues would be empty.
    if ((DEPARTMENT_SCOPED_ROLES as Role[]).includes(role) && !department) {
      return json({ error: "Department is required for this role." }, 400);
    }
    // Department must belong to the assigned college (single-campus
    // identity — a Dental dept can't be assigned to Engineering).
    if (department && !isValidDepartment(body.college, department)) {
      return json({ error: "That department doesn't exist in the selected college." }, 400);
    }
    // Category-scoped roles are useless without a category.
    if (categoryScoped && !categoryId) {
      return json({ error: "Category is required for this role." }, 400);
    }

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
      department,
      college: body.college,
      categoryId: categoryScoped ? categoryId : null,
      categoryName: categoryScoped ? categoryName : null,
      requiresEmailVerification: body.requiresEmailVerification || null,
      name,
    });

    await db.doc(`users/${userRecord.uid}`).set(
      {
        name,
        email: body.email,
        role,
        portal: body.portal || "",
        college: body.college,
        department,
        ...(categoryScoped ? { categoryId, categoryName } : {}),
        phone: body.phone || userRecord.phoneNumber || "",
        isActive: body.isActive,
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Maintenance family heads are scoped by the categories they own — wire the
    // selection so their dispatch boards actually fill.
    if ((role === "category_head" || role === "maintenance_head") && categoryId) {
      await db.doc(`categories/${categoryId}`).update({ headUid: userRecord.uid });
    }

    invalidateServerCache("api:admin:users");
    return json({ uid: userRecord.uid }, 201);
  } catch (e) {
    return handleError(e);
  }
}

/** PATCH /api/auth/provision — update role + claims for an existing user.
 *  ADMIN or PRINCIPAL — this can mint roles and reset any user's password.
 *  A principal may not touch an account whose effective role is `admin`. */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const actor = await requireUserManager(req);
    if (isRateLimited(`provision:patch:ip:${clientIp(req)}`, { limit: 60, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: "Too many requests from this device. Please try again later." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
    const body = await parseBody(req, adminUserSchema.partial());
    if (!body.uid) return json({ error: "uid is required." }, 400);

    // Reject an attempted promotion to admin before any user lookup or write.
    if (body.role) assertMayManageRole(actor, body.role);

    const existing = await adminAuth().getUser(body.uid);
    const existingClaims = (existing.customClaims ?? {}) as Record<string, unknown>;
    const effRole: Role = (body.role ?? (existingClaims.role as Role)) as Role;
    // Re-checked against the EFFECTIVE role so a principal is also blocked from
    // editing or demoting an account that already holds admin.
    assertMayManageRole(actor, effRole);
    const name = body.name ? capitalizeName(body.name) : undefined;

    const updates: Record<string, unknown> = {};
    if (name) updates.displayName = name;
    if (body.password) {
      await adminAuth().updateUser(body.uid, { password: body.password });
    }
    if (name) await adminAuth().updateUser(body.uid, updates as never);
    const requiresEmailVerification =
      body.requiresEmailVerification !== undefined
        ? body.requiresEmailVerification
        : Boolean(existingClaims.requiresEmailVerification);
    // Principals are college-scoped, never department-scoped — a role change
    // to principal clears any previously set department.
    const department =
      effRole === "principal"
        ? ""
        : body.department !== undefined
          ? body.department
          : (existingClaims.department as string) ?? "";
    if ((DEPARTMENT_SCOPED_ROLES as Role[]).includes(effRole) && !department) {
      return json({ error: "Department is required for this role." }, 400);
    }
    const categoryScoped = (CATEGORY_SCOPED_ROLES as Role[]).includes(effRole);
    const categoryId =
      body.categoryId !== undefined
        ? body.categoryId
        : (existingClaims.categoryId as string) || "";
    const categoryName = categoryId ? await categoryNameOf(categoryId) : "";
    const effCollege =
      body.college !== undefined ? body.college : (existingClaims.college as string) || "";
    // When the admin explicitly sets a department, it must belong to the
    // effective college. A role-only edit is never blocked by a legacy
    // mismatch, and the admin UI sends college+department together when it
    // re-homes a department-scoped user, so this can't dead-end.
    if (body.department !== undefined && effCollege && !isValidDepartment(effCollege, body.department)) {
      return json({ error: "That department doesn't exist in the selected college." }, 400);
    }

    // Claims must be rewritten when college/department change too — not just
    // on role/category edits — otherwise the token's scoping goes stale.
    const roleChanged = body.role !== undefined;
    const categoryChanged = body.categoryId !== undefined;
    const collegeChanged =
      body.college !== undefined && body.college !== ((existingClaims.college as string) || "");
    const departmentChanged = body.department !== undefined && body.department !== department;
    if (roleChanged || categoryChanged || collegeChanged || departmentChanged) {
      await adminAuth().setCustomUserClaims(body.uid, {
        role: effRole,
        portal: body.portal !== undefined ? body.portal : (existingClaims.portal as string) || null,
        department,
        college:
          body.college !== undefined
            ? body.college
            : (existingClaims.college as string) ?? null,
        categoryId: categoryScoped ? categoryId : null,
        categoryName: categoryScoped ? categoryName : null,
        requiresEmailVerification: requiresEmailVerification || null,
        name:
          name !== undefined
            ? name
            : ((existingClaims.name as string) || existing.displayName || ""),
      });

      // Keep categories/{id}.headUid in sync for the maintenance-family heads.
      if (effRole === "category_head" || effRole === "maintenance_head") {
        const prev = await db.collection("categories").where("headUid", "==", body.uid).get();
        for (const c of prev.docs) {
          if (c.id !== categoryId) await db.doc(`categories/${c.id}`).update({ headUid: "" });
        }
        if (categoryId) await db.doc(`categories/${categoryId}`).update({ headUid: body.uid });
      } else if (roleChanged) {
        // Moved away from a maintenance head role — stop heading any categories.
        const prev = await db.collection("categories").where("headUid", "==", body.uid).get();
        for (const c of prev.docs) {
          await db.doc(`categories/${c.id}`).update({ headUid: "" });
        }
      }
    }

    const userData: Record<string, unknown> = {};
    if (name !== undefined) userData.name = name;
    if (body.role !== undefined) userData.role = body.role;
    if (body.portal !== undefined) userData.portal = body.portal;
    if (body.college !== undefined) userData.college = body.college;
    if (body.department !== undefined) userData.department = body.department;
    if (effRole === "principal") userData.department = "";
    if (categoryScoped) {
      userData.categoryId = categoryId;
      userData.categoryName = categoryName;
    }
    if (body.phone !== undefined) userData.phone = body.phone;
    if (body.isActive !== undefined) userData.isActive = body.isActive;

    await db.doc(`users/${body.uid}`).set(userData, { merge: true });

    invalidateServerCache("api:admin:users");
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
