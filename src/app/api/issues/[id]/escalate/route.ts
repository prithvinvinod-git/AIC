import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runTransition } from "@/lib/transition";

const schema = z.object({
  note: z.string().optional(),
});

/** POST /api/issues/[id]/escalate — manual escalation by Validator/Admin. */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[id]/escalate">
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return runTransition(req, id, schema, "ESCALATED");
}
