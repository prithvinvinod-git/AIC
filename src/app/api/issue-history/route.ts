import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { STATUSES } from "@/lib/types";
import type { IssueStatus } from "@/lib/types";

const db = adminDb();

const HISTORY_ROLES = ["admin", "principal", "validator"];

/** Cap the read; anything older falls outside the scrollable history. */
const MAX = 2000;

/** Response row — a trimmed, normalized view of an issue document. */
interface HistoryIssue {
  id: string;
  issueNo: string;
  title: string;
  department: string;
  status: IssueStatus;
  priority: number;
  college?: string;
  boardHidden?: boolean;
  routing?: { categoryId: string; categoryName: string; teamId: string };
  reporter?: { uid: string; name: string; department: string };
  createdAt: string;
  updatedAt: string;
}

/** Firestore stores createdAt as an ISO string, but tolerate legacy
 *  Timestamps / epoch numbers from old seeds. */
function toMs(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? null : t;
  }
  const o = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
  if (typeof o.toDate === "function") return o.toDate().getTime();
  if (typeof o.seconds === "number") return o.seconds * 1000;
  if (typeof o._seconds === "number") return o._seconds * 1000;
  return null;
}

/** GET /api/issue-history — full issue history for admins and the principal.
 *  Query params (all optional): q (title substring), from/to (YYYY-MM-DD,
 *  inclusive on createdAt), department, category (routing.categoryName),
 *  statuses (comma-separated). Filters run in JS after a bounded ordered
 *  read to avoid needing composite indexes. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (!HISTORY_ROLES.includes(user.role)) {
      return json({ error: "Not allowed." }, 403);
    }

    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") || "").trim().toLowerCase();
    const from = sp.get("from");
    const to = sp.get("to");
    const department = sp.get("department") || "";
    const category = sp.get("category") || "";
    const statuses = (sp.get("statuses") || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is IssueStatus => (STATUSES as string[]).includes(s));

    const startMs = from ? new Date(`${from}T00:00:00.000Z`).getTime() : null;
    const endMs = to ? new Date(`${to}T23:59:59.999Z`).getTime() : null;

    const snap = await db.collection("issues").orderBy("createdAt", "desc").limit(MAX).get();
    const truncated = snap.size >= MAX;

    const issues = snap.docs
      .map(
        (d): HistoryIssue => {
          const data = d.data();
          const createdAtMs = toMs(data.createdAt);
          const updatedAtMs = toMs(data.updatedAt);
          return {
            id: d.id,
            issueNo: String(data.issueNo || ""),
            title: String(data.title || ""),
            department: String(data.department || ""),
            college: data.college ? String(data.college) : undefined,
            status: (STATUSES as string[]).includes(data.status)
              ? (data.status as IssueStatus)
              : "NEW",
            priority: typeof data.priority === "number" ? data.priority : 0,
            boardHidden: data.boardHidden === true,
            routing: data.routing
              ? {
                  categoryId: String(data.routing.categoryId || ""),
                  categoryName: String(data.routing.categoryName || ""),
                  teamId: String(data.routing.teamId || ""),
                }
              : undefined,
            reporter: data.reporter
              ? {
                  uid: String(data.reporter.uid || ""),
                  name: String(data.reporter.name || ""),
                  department: String(data.reporter.department || ""),
                }
              : undefined,
            createdAt: createdAtMs !== null ? new Date(createdAtMs).toISOString() : String(data.createdAt || ""),
            updatedAt: updatedAtMs !== null ? new Date(updatedAtMs).toISOString() : String(data.updatedAt || ""),
          };
        }
      )
      .filter((issue) => {
        if (user.role !== "admin" && issue.college !== user.college) return false;
        const createdAt = toMs(issue.createdAt);
        if (startMs !== null && (createdAt === null || createdAt < startMs)) return false;
        if (endMs !== null && (createdAt === null || createdAt > endMs)) return false;
        if (department && issue.department !== department) return false;
        if (category && issue.routing?.categoryName !== category) return false;
        if (statuses.length && !statuses.includes(issue.status)) return false;
        if (q && !issue.title.toLowerCase().includes(q)) return false;
        return true;
      });

    return json({ issues, total: issues.length, truncated });
  } catch (e) {
    return handleError(e);
  }
}
