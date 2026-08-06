import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runTransition } from "@/lib/transition";

const schema = z.object({
  note: z.string().min(5, "A closure report is required."),
});

/** POST /api/issues/[id]/complete — staff completes the job. */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[id]/complete">
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return runTransition(req, id, schema, "COMPLETED");
}
