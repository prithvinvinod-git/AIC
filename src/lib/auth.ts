import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "./firebaseAdmin";
import type { Role } from "./types";

export interface AuthUser {
  uid: string;
  email: string;
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
    decoded = await adminAuth().verifyIdToken(token, true);
  } catch {
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
