import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";

const db = adminDb();

/**
 * POST /api/profile/sync-auth — re-mirror the caller's `users/` document from
 * their own verified ID token.
 *
 * The email address is owned by Firebase Auth, not by this app: changing it runs
 * through `verifyBeforeUpdateEmail` and only takes effect once the NEW inbox
 * opens the link. The denormalised copy in `users/` has to be pushed forward
 * afterwards, otherwise the admin user list keeps showing the previous address.
 *
 * The request body is deliberately ignored. Every value written here comes from
 * the ID token, which Firebase signed, so a client cannot assert an address it
 * does not own. That also means a token minted *before* the change writes the
 * old address back — harmless, since it can only ever restore a value that was
 * already true. Callers must run this after `refreshClaims(true)`.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    await db
      .doc(`users/${user.uid}`)
      .set(
        {
          email: user.email,
          emailVerified: user.emailVerified,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    return json({ ok: true, email: user.email, emailVerified: user.emailVerified });
  } catch (e) {
    return handleError(e);
  }
}
