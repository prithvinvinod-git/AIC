import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runTransition } from "@/lib/transition";

const schema = z.object({
  priority: z.number().int().min(1).max(5).optional(),
  note: z.string().optional(),
});

/** POST /api/issues/[id]/approve — HOD/Principal confirm or revise severity. */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[id]/approve">
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return runTransition(req, id, schema, "APPROVED");
}
