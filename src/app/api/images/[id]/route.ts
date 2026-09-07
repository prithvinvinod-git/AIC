import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { adminDb } from "@/lib/firebaseAdmin";
import { clientIp, isRateLimited } from "@/lib/rateLimit";

/**
 * GET /api/images/[id] — serves an image blob from Firestore.
 *
 * Intentionally public (no auth header): unguessable UUIDs gate access, and a
 * plain <img src> cannot attach an Authorization header. Server-side writes
 * stay fully authenticated; this is read-only exposure of issue photos.
 */
export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/images/[id]">
): Promise<Response> {
  try {
    const { id } = await ctx.params;

    if (isRateLimited(`img:${clientIp(req)}:${id}`, { limit: 120, windowMs: 60_000 })) {
      return new Response("Too many requests", { status: 429, headers: { "Retry-After": "60" } });
    }

    const snap = await adminDb().collection("imageBlobs").doc(id).get();
    if (!snap.exists) return new Response("Not found", { status: 404 });

    const data = snap.data()!;
    const buffer = Buffer.from(data.data as string, "base64");

    // Integrity gate: blobs written after the digest feature carry sha256.
    // Re-hashing on serve keeps the gate at rest without a scanning job.
    if (data.sha256 && createHash("sha256").update(buffer).digest("hex") !== data.sha256) {
      return new Response("Image failed integrity check", { status: 410 });
    }

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": (data.contentType as string) || "image/jpeg",
        // Blobs are unguessable + never rewritten → safe to cache as immutable.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Server error", { status: 500 });
  }
}
