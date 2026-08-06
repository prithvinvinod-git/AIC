import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runTransition } from "@/lib/transition";

const schema = z.object({
  sendBackReason: z.string().min(3, "A send-back reason is required."),
});

/** POST /api/issues/[id]/sendback — Head sends verification back to staff. */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[id]/sendback">
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return runTransition(req, id, schema, "ONGOING");
}
