import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runTransition } from "@/lib/transition";

const schema = z.object({
  verdict: z.string().min(2, "Add a short verification note.").optional(),
  note: z.string().optional(),
});

/** POST /api/issues/[id]/verify — Head verifies completed work. */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[id]/verify">
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return runTransition(req, id, schema, "VERIFIED");
}
