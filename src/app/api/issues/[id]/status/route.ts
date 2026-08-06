import { NextRequest, NextResponse } from "next/server";
import { runTransition } from "@/lib/transition";
import { statusTransitionSchema } from "@/lib/schemas";

/** POST /api/issues/[id]/status — the ONE door for every status change. */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[id]/status">
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return runTransition(req, id, statusTransitionSchema);
}
