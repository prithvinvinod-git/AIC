import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runTransition } from "@/lib/transition";

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

/** POST /api/issues/[id]/feedback — reporter rates → CLOSED. */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[id]/feedback">
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return runTransition(req, id, schema, "CLOSED");
}
