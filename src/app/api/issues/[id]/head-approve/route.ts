import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runTransition } from "@/lib/transition";

const schema = z.object({
  note: z.string().optional(),
});

/** POST /api/issues/[id]/head-approve — Maintenance head approves inspected work. */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[id]/head-approve">
): Promise<NextResponse> {
  const { id } = await ctx.params;
  return runTransition(req, id, schema, "HEAD_APPROVED");
}
