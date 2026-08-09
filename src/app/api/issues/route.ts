import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { randomUUID } from "crypto";
import type { Query } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, parseBody, handleError } from "@/lib/api";
import { createIssueSchema } from "@/lib/schemas";
import { allocateIssueNo } from "@/lib/issueMachine";
import { notifyRole } from "@/lib/notifications";
import { incrementCategoryCount, incrementStatusCount } from "@/lib/stats";
import { capitalizeFirst } from "@/lib/format";
import type { Issue } from "@/lib/types";

const db = adminDb();

/** Board shows the important half of the queue — P1–P3 — across all users. */
const BOARD_MAX_PRIORITY = 3;
const BOARD_LIMIT = 10;

/** POST /api/issues — reporter creates a NEW issue. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (user.role !== "reporter") {
      return json({ error: "Only reporters can submit issues." }, 403);
    }

    const body = await parseBody(req, createIssueSchema);

    const catSnap = await db.doc(`categories/${body.categoryId}`).get();
    if (!catSnap.exists) return json({ error: "Category not found." }, 404);
    const cat = catSnap.data()!;
    if (!cat.isActive) return json({ error: "Category is inactive." }, 400);

    const issueNo = await allocateIssueNo(db);
    const trackingToken = randomUUID();
    const ref = db.collection("issues").doc();
    const now = new Date().toISOString();
    const priority = body.priority && body.priority >= 1 && body.priority <= 5 ? body.priority : 0;
    const title = capitalizeFirst(body.title.trim());
    const description = capitalizeFirst(body.description.trim());

    const issueData = {
      issueNo,
      trackingToken,
      title,
      description,
      college: body.college || "",
      department: body.department,
      location: body.location,
      images: body.images,
      status: "NEW",
      priority,
      prioritySetBy: priority ? { uid: user.uid, name: user.name } : null,
      prioritySetAt: priority ? now : null,
      requirements: [],
      involveTeams: [],
      routing: {
        categoryId: body.categoryId,
        categoryName: cat.name,
        teamId: "",
      },
      reporter: {
        uid: user.uid,
        name: user.name,
        department: body.department,
      },
      counters: { commentCount: 0, timelineCount: 0 },
      createdAt: now,
      updatedAt: now,
    };

    await db.runTransaction(async (tx) => {
      tx.set(ref, issueData);
      tx.set(ref.collection("timeline").doc(), {
        from: "",
        to: "NEW",
        by: { uid: user.uid, name: user.name, role: user.role },
        note: "Issue reported.",
        at: now,
        isAuto: false,
      });
    });

    // Post-response work (AI triage + duplicates, notifications, stats) is
    // scheduled with `after()` so the runtime keeps it alive instead of
    // killing fire-and-forget promises once the response is sent.
    after(async () => {
      await Promise.all([
        import("@/lib/ai").then((ai) => ai.runAiOnCreate(ref.id)),
        notifyRole(["validator"], {
          type: "issue",
          title: "New issue to review",
          body: `${issueNo}: ${title}`,
          link: `/issues/${ref.id}`,
        }),
        incrementStatusCount("NEW"),
        incrementCategoryCount(cat.name),
      ]);

      // Reported email — the AI-set severity wins (reporter picked default P3),
      // else the reporter's explicit choice, else the AI suggestion, else P3.
      const snap = await db.doc(`issues/${ref.id}`).get();
      if (snap.exists) {
        const issue = { id: ref.id, ...snap.data() } as Issue;
        const suggested = issue.aiSuggestion?.suggestedPriority;
        const aiSet = issue.prioritySetBy?.uid === "ai-triage";
        const effective =
          aiSet && issue.priority >= 1 && issue.priority <= 5
            ? issue.priority
            : priority >= 1 && priority <= 5
              ? priority
              : suggested && suggested >= 1 && suggested <= 5
                ? suggested
                : 3;
        await import("@/lib/email").then((m) => m.sendIssueReportedEmail(issue, effective));
      }
    });

    return json({ issue: { id: ref.id, ...issueData } }, 201);
  } catch (e) {
    return handleError(e);
  }
}

/** GET /api/issues — role-scoped lists, or `scope=board` for the shared
 *  cross-user board (P1–P3 across all departments, minus hidden issues). */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    const params = req.nextUrl.searchParams;
    const status = params.get("status");
    const mine = params.get("mine") === "true";
    const board = params.get("scope") === "board";

    let query: Query = db.collection("issues");

    if (board) {
      const snap = await query.orderBy("createdAt", "desc").limit(200).get();
      const issues: Issue[] = snap.docs
        .map((d) => {
          const data = d.data();
          if (!Array.isArray(data.requirements)) data.requirements = [];
          return { id: d.id, ...data } as Issue;
        })
        .filter(
          (i) =>
            typeof i.priority === "number" &&
            i.priority >= 1 &&
            i.priority <= BOARD_MAX_PRIORITY &&
            i.boardHidden !== true
        )
        .slice(0, BOARD_LIMIT);
      return json({ issues });
    }

    if (user.role === "reporter" || mine) {
      query = query.where("reporter.uid", "==", user.uid);
    } else if (user.role === "validator") {
      query = query.where("department", "==", user.department);
    } else if (user.role === "maintenance") {
      const teamSnap = await db
        .collection("teams")
        .where("members", "array-contains", user.uid)
        .get();
      const teamIds = teamSnap.docs.map((d) => d.id);
      if (teamIds.length) query = query.where("routing.teamId", "in", teamIds);
      else return json({ issues: [] });
    }

    if (status && status !== "all") query = query.where("status", "==", status);

    const snap = await query.orderBy("createdAt", "desc").limit(100).get();
    const issues = snap.docs.map((d) => {
      const data = d.data();
      if (!Array.isArray(data.requirements)) data.requirements = [];
      return { id: d.id, ...data };
    });

    return json({ issues });
  } catch (e) {
    return handleError(e);
  }
}
