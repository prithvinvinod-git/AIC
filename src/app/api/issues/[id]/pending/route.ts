import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runTransition } from "@/lib/transition";

const schema = z.object({
  note: z.string().min(3, "A blocker reason is required."),
});

/** POST /api/issues/[id]/pending — staff/head puts a job on hold. */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[id]/pending">
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return runTransition(req, id, schema, "PENDING");
}
