import "server-only";

import { createHash } from "crypto";
import { ALLOWED_ISSUE_IMAGE_MIME } from "@/lib/constants";

/**
 * Server-side gate for uploaded images.
 *
 * The client already constrains MIME + size, but the declared MIME is untrusted,
 * so we re-detect the REAL format from magic bytes, scan the decoded bytes for
 * embedded HTML/script payload patterns (polyglot images), and record a sha256
 * digest so the serving route can verify on-disk integrity.
 */

export type ImageKind = "jpeg" | "png" | "webp" | "heic";

const KIND_MIME: Record<ImageKind, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
};

/** Detect the real file type from magic bytes — never trust the client's MIME. */
export function detectImageKind(buf: Buffer): ImageKind | null {
  const head = buf.subarray(0, 12);
  if (buf.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpeg";
  if (buf.length >= 8 && head.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return "png";
  if (buf.length >= 12 && head.subarray(0, 4).toString("latin1") === "RIFF" && head.subarray(8, 12).toString("latin1") === "WEBP") {
    return "webp";
  }
  if (buf.length >= 12 && head.subarray(4, 8).toString("latin1") === "ftyp") {
    const brand = head.subarray(8, 12).toString("latin1");
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) return "heic";
  }
  return null;
}

/**
 * Text markers that indicate the payload is — or smuggles — an executable
 * document. Real JPEG/PNG/WebP pixel data is entropy/binary-compressed, so
 * these ASCII sequences only appear if the file (or a trailing payload) is
 * HTML/script content.
 */
const FLAGGED_MARKERS = [
  "<script",
  "</script",
  "<?php",
  "javascript:",
  "vbscript:",
  "data:text/html",
  "onerror=",
  "onload=",
  "onclick=",
  "onmouseover=",
  "<iframe",
  "<object",
  "<embed",
  "<svg",
  "<html",
  "<body",
  "<!doctype",
  "document.cookie",
];

export function findSuspiciousMarker(buf: Buffer): string | null {
  const haystack = buf.toString("latin1").toLowerCase();
  for (const marker of FLAGGED_MARKERS) {
    if (haystack.includes(marker)) return marker;
  }
  return null;
}

export type ImageGateResult =
  | { ok: true; contentType: string; sha256: string; bytes: number }
  | { ok: false; error: string };

/** Validate base64 image payload → canonical MIME + integrity digest. */
export function validateImageUpload(base64: string): ImageGateResult {
  const buffer = Buffer.from(base64, "base64");
  const kind = detectImageKind(buffer);
  if (!kind || !ALLOWED_ISSUE_IMAGE_MIME.includes(KIND_MIME[kind])) {
    return { ok: false, error: "Unsupported file type — only JPEG, PNG, WebP, and HEIC images are accepted." };
  }
  const marker = findSuspiciousMarker(buffer);
  if (marker) {
    return { ok: false, error: "Upload rejected: the file contains embedded scripts or HTML." };
  }
  return {
    ok: true,
    contentType: KIND_MIME[kind],
    sha256: createHash("sha256").update(buffer).digest("hex"),
    bytes: buffer.length,
  };
}