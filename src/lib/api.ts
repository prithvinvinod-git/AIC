import "server-only";

import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { MachineError } from "./issueMachine";
import { logError, type ErrorContext } from "./errorLog";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function err(message: string, status = 400, details?: unknown): NextResponse {
  return NextResponse.json({ error: message, details }, { status });
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new MachineError("Invalid JSON body.", 400);
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    throw new MachineError("Validation failed.", 400, details);
  }
  return result.data;
}

export function handleError(e: unknown, ctx: ErrorContext = {}): NextResponse {
  // Known, intentional 4xx outcomes (validation / preconditions) are not
  // monitoring targets — only unexpected errors get logged.
  if (e instanceof MachineError) {
    return err(e.message, e.statusCode, e.details);
  }
  if (e instanceof ZodError) {
    return err("Validation failed.", 400, e.issues);
  }
  if (e instanceof Error) {
    const code = (e as Error & { statusCode?: number }).statusCode;
    if (typeof code === "number" && code >= 400 && code < 600) {
      if (code >= 500) void logError(e, ctx);
      return err(e.message, code);
    }
  }
  console.error("API error:", e);
  void logError(e, ctx);
  return err("Internal server error.", 500);
}
