import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "./firebaseAdmin";
import type { Role } from "./types";

export interface AuthUser {
  uid: string;
  email: string;
  /** From the token's `email_verified` claim, not the users/ mirror. */
  emailVerified: boolean;
  name: string;
  role: Role;
  department: string;
  college?: string;
}

/**
 * Verify the Firebase ID token from the Authorization header using the Admin
 * SDK. Role comes from custom claims (mirrored onto the users/ document by
 * the seed/provisioning flow). This is the single door for every authenticated
 * API route; it also enforces email verification for self-service accounts.
 */
export async function requireAuth(req: NextRequest): Promise<AuthUser> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    const err = new Error("Unauthorized") as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }
  const token = header.slice("Bearer ".length);
  let decoded;
  try {
    // checkRevoked=true so token revocation (account disable/delete) takes
    // effect immediately instead of lingering for the ~1 h token lifetime.
    // Note this also makes the Admin SDK call getUser(), i.e. it needs working
    // service-account credentials — not just the public keys.
    decoded = await adminAuth().verifyIdToken(token, true);
  } catch (e) {
    const message = String((e as Error)?.message || e);
    // A bad user token and a broken service account are opposite problems, but
    // both land here. Swallowing them into the same "Unauthorized" hid a dead
    // FIREBASE_PRIVATE_KEY as a fleet-wide sign-in failure that hit every route
    // and every role, with nothing in the logs to distinguish it. Surface it.
    const credProblem =
      /credential|invalid_grant|unauthenticated|invalid jwt signature|certificate|access token|service.?account/i.test(
        message
      );
    if (credProblem) {
      console.error(
        `[auth] Admin SDK credential failure while verifying a token — check FIREBASE_PRIVATE_KEY / FIREBASE_CLIENT_EMAIL / FIREBASE_PROJECT_ID match a live key: ${message}`
      );
      const err = new Error(
        "Server authentication is misconfigured. Please contact an administrator."
      ) as Error & { statusCode: number };
      err.statusCode = 503;
      throw err;
    }
    const err = new Error("Unauthorized") as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }
  // Self-service accounts created via /signup must verify their email before
  // using any data API. Admin-provisioned, Google-linked and pre-existing
  // accounts have no marker and are unaffected.
  if (decoded.requiresEmailVerification && !decoded.email_verified) {
    const err = new Error("Please verify your email before using this app.") as Error & {
      statusCode: number;
    };
    err.statusCode = 403;
    throw err;
  }

  // Defense-in-depth: cross-check the mirrored users/{uid} doc. The doc is
  // written by provisioning after the claims, so a missing doc just falls
  // back to claims; an explicitly deactivated account is rejected up front.
  const userSnap = await adminDb().doc(`users/${decoded.uid}`).get();
  if (userSnap.exists) {
    const userData = userSnap.data() ?? {};
    if (userData.isActive === false) {
      const err = new Error("This account has been deactivated.") as Error & {
        statusCode: number;
      };
      err.statusCode = 403;
      throw err;
    }
    if (userData.role && userData.role !== (decoded.role as string)) {
      // Doc and claims drifted — trust the mirrored doc (single source the
      // admin UI writes first) to avoid stale-claim escalation.
      decoded.role = userData.role as string;
    }
  }

  const role: Role = (decoded.role as Role) || "reporter";
  const name = (decoded.name as string) || decoded.email?.split("@")[0] || "User";
  return {
    uid: decoded.uid,
    email: decoded.email || "",
    emailVerified: decoded.email_verified === true,
    name,
    role,
    department: (decoded.department as string) || "",
    college: (decoded.college as string) || undefined,
  };
}

export async function requireAdmin(req: NextRequest): Promise<AuthUser> {
  const user = await requireAuth(req);
  if (user.role !== "admin") {
    const err = new Error("Admin access required.") as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }
  return user;
}

/**
 * Gate for the people + org-structure surface: users, teams and categories.
 * The Principal can run this alongside a full admin, which is what powers the
 * Principal's own panel. System config (SLA defaults, AI settings, purchase
 * limits) deliberately stays on `requireAdmin` and is NOT covered here.
 */
export async function requireUserManager(req: NextRequest): Promise<AuthUser> {
  const user = await requireAuth(req);
  if (user.role !== "admin" && user.role !== "principal") {
    const err = new Error("Admin access required.") as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }
  return user;
}

/**
 * Only a full admin may create, promote, demote or otherwise touch an account
 * that holds the `admin` role. Without this a Principal could mint an admin —
 * and then escalate past their own panel. Checked inside the provision route
 * against the *effective* role, so it also blocks edits to an existing admin
 * rather than only explicit promotions.
 */
export function assertMayManageRole(actor: AuthUser, effectiveRole: Role): void {
  if (actor.role === "admin") return;
  if (effectiveRole === "admin") {
    const err = new Error(
      "Only an admin can manage accounts with the admin role."
    ) as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }
}
