import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runTransition } from "@/lib/transition";

const schema = z.object({
  priority: z.number().int().min(1).max(5),
  note: z.string().optional(),
});

/** POST /api/issues/[id]/validate — Validator marks valid + sets priority. */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[id]/validate">
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return runTransition(req, id, schema, "VALIDATED");
}
