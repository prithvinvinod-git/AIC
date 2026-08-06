import { NextRequest } from "next/server";
import { adminAuth } from "./firebaseAdmin";
import type { Role } from "./types";

export interface AuthUser {
  uid: string;
  email: string;
  name: string;
  role: Role;
  department: string;
}

/**
 * Verify the Firebase ID token from the Authorization header using the Admin
 * SDK. Role comes from custom claims (mirrored onto the users/ document by
 * the seed/provisioning flow).
 */
export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length);
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    const role: Role =
      (decoded.role as Role) || "reporter";
    const name =
      (decoded.name as string) || decoded.email?.split("@")[0] || "User";
    const department = (decoded.department as string) || "";
    return {
      uid: decoded.uid,
      email: decoded.email || "",
      name,
      role,
      department,
    };
  } catch {
    return null;
  }
}

export async function requireAuth(req: NextRequest): Promise<AuthUser> {
  const user = await getAuthUser(req);
  if (!user) {
    const err = new Error("Unauthorized") as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }
  return user;
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
