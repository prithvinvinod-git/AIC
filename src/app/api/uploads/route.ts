import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";

// Base64 payload cap — keeps each blob comfortably under the 1MB Firestore
// document limit. Client compresses to ~150-300KB before sending.
const MAX_BASE64 = 900 * 1024;

/**
 * POST /api/uploads — stores the image as a base64 blob in Firestore and
 * returns a route URL that the client renders with a plain <img> tag.
 *
 * Works without Cloud Storage (free Spark plan). Blob IDs are unguessable
 * UUIDs; images are served publicly via GET /api/images/[id].
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    const body = (await req.json().catch(() => ({}))) as {
      mime?: string;
      base64?: string;
    };

    if (!body.base64) return json({ error: "base64 data is required." }, 400);
    if (body.base64.length > MAX_BASE64) {
      return json({ error: "Image too large. Please re-submit after compression." }, 413);
    }

    const buffer = Buffer.from(body.base64, "base64");
    if (buffer.length > 700 * 1024) {
      return json({ error: "Image too large. Please re-submit after compression." }, 413);
    }

    const id = randomUUID();
    await adminDb().collection("imageBlobs").doc(id).set({
      data: body.base64,
      contentType: body.mime || "image/jpeg",
      uploadedBy: user.uid,
      at: new Date().toISOString(),
    });

    return json({ url: `/api/images/${id}`, name: "image.jpg", size: buffer.length }, 201);
  } catch (e) {
    return handleError(e);
  }
}
