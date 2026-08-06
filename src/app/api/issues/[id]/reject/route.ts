import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runTransition } from "@/lib/transition";

const schema = z.object({
  rejectionReason: z.string().min(3, "A rejection reason is required."),
});

/** POST /api/issues/[id]/reject — Validator rejects with mandatory reason. */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[id]/reject">
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return runTransition(req, id, schema, "REJECTED");
}
