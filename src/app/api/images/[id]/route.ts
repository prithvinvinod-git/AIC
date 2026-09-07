import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

/**
 * GET /api/images/[id] — serves an image blob from Firestore.
 *
 * Intentionally public (no auth header): unguessable UUIDs gate access, and a
 * plain <img src> cannot attach an Authorization header. Server-side writes
 * stay fully authenticated; this is read-only exposure of issue photos.
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/images/[id]">
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const snap = await adminDb().collection("imageBlobs").doc(id).get();
    if (!snap.exists) return new Response("Not found", { status: 404 });

    const data = snap.data()!;
    const buffer = Buffer.from(data.data as string, "base64");
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
