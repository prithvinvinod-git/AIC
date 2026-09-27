import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { randomUUID } from "crypto";
import type { Query } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, parseBody, handleError } from "@/lib/api";
import { isRateLimited } from "@/lib/rateLimit";
import { createIssueSchema } from "@/lib/schemas";
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
    if (isRateLimited(`issues:create:${user.uid}`, { limit: 10, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: "Too many issue submissions. Please slow down and try again." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const body = await parseBody(req, createIssueSchema);

    const catSnap = await db.doc(`categories/${body.categoryId}`).get();
    if (!catSnap.exists) return json({ error: "Category not found." }, 404);
    const cat = catSnap.data()!;
    if (!cat.isActive) return json({ error: "Category is inactive." }, 400);

    const trackingToken = randomUUID();
    const ref = db.collection("issues").doc();
    const now = new Date().toISOString();
    const priority = body.priority && body.priority >= 1 && body.priority <= 5 ? body.priority : 0;
    const title = capitalizeFirst(body.title.trim());
    const description = capitalizeFirst(body.description.trim());

    const issueData = {
      issueNo: "",
      trackingToken,
      title,
      description,
      // College comes from the ID token, not the request body — a reporter
      // must not be able to file an issue into another college's board.
      college: user.college || body.college || "",
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
      counters: { commentCount: 0, timelineCount: 1 },
      createdAt: now,
      updatedAt: now,
    };

    // W-16: the issue number is allocated inside the SAME transaction that
    // writes the issue, so a failed create can no longer burn a sequence.
    const seqRef = db.doc("config/sequenceCounters");
    let issueNo = "";
    await db.runTransaction(async (tx) => {
      const seqSnap = await tx.get(seqRef);
      const current = seqSnap.exists ? ((seqSnap.data()?.issues as number) || 0) : 0;
      const next = current + 1;
      tx.set(seqRef, { issues: next }, { merge: true });
      issueNo = `ISS-${new Date().getFullYear()}-${String(next).padStart(4, "0")}`;
      issueData.issueNo = issueNo;

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
    // killing fire-and-forget promises once the response is sent. Failures
    // here are logged (best-effort) so they aren't swallowed silently.
    after(async () => {
      try {
        await Promise.all([
          import("@/lib/ai").then((ai) => ai.runAiOnCreate(ref.id)),
          notifyRole(
            ["validator"],
            {
              type: "issue",
              title: "New issue to review",
              body: `${issueNo}: ${title}`,
              link: `/issues/${ref.id}`,
            },
            issueData.college || undefined
          ),
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
      } catch (e) {
        const { logError } = await import("@/lib/errorLog");
        await logError(e, { source: "after-create", route: "/api/issues", issueId: ref.id });
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
    const pendingSenior = params.get("pendingSenior") === "true";

    let query: Query = db.collection("issues");

    if (pendingSenior) {
      // Over-limit purchases awaiting a senior (HOD/Principal/Admin) decision.
      if (!["hod", "principal", "admin"].includes(user.role)) {
        return json({ error: "Not allowed." }, 403);
      }
      if (user.college) query = query.where("college", "==", user.college);
      const snap = await query.orderBy("createdAt", "desc").limit(100).get();
      const issues: Issue[] = snap.docs
        .map((d) => {
          const data = d.data();
          if (!Array.isArray(data.requirements)) data.requirements = [];
          return { id: d.id, ...data } as Issue;
        })
        .filter((i) => (i.pendingSeniorApprovalCount ?? 0) > 0);
      return json({ issues });
    }

    if (board) {
      if (user.role !== "admin" && user.college) {
        query = query.where("college", "==", user.college);
      }
      // D-3/D-15: fetch a generous window of the newest issues (the
      // [college+priority+createdAt] composite isn't deployed on prod yet), then
      // filter in JS. Priority 0 / missing = "not yet triaged" → treated as P3.
      const snap = await query.orderBy("createdAt", "desc").limit(400).get();
      const issues: Issue[] = snap.docs
        .map((d) => {
          const data = d.data();
          if (!Array.isArray(data.requirements)) data.requirements = [];
          return { id: d.id, ...data } as Issue;
        })
        .filter(
          (i) =>
            (typeof i.priority !== "number" || i.priority <= BOARD_MAX_PRIORITY) &&
            i.boardHidden !== true
        )
        .slice(0, BOARD_LIMIT);
      return json({ issues });
    }

    if (user.role === "purchase") {
      query = query.where("college", "==", user.college || "");
      const snap = await query.orderBy("createdAt", "desc").limit(500).get();
      const issues: Issue[] = snap.docs
        .map((d) => {
          const data = d.data();
          if (!Array.isArray(data.requirements)) data.requirements = [];
          return { id: d.id, ...data } as Issue;
        })
        .filter((i) => (i.pendingPurchaseCount ?? 0) > 0)
        .slice(0, 100);
      return json({ issues });
    }

    if (user.role === "reporter" || mine) {
      query = query.where("reporter.uid", "==", user.uid);
      if (user.college) query = query.where("college", "==", user.college);
    } else if (user.role === "validator") {
      query = query.where("college", "==", user.college || "");
      query = query.where("department", "==", user.department);
    } else if (user.role === "maintenance_head") {
      query = query.where("routing.maintenanceHeadUid", "==", user.uid);
      if (user.college) query = query.where("college", "==", user.college);
    } else if (user.role === "category_head") {
      const catSnap = await db.collection("categories").where("headUid", "==", user.uid).get();
      const categoryIds = catSnap.docs.map((d) => d.id);
      if (!categoryIds.length) return json({ issues: [] });
      query = query.where("routing.categoryId", "in", categoryIds.slice(0, 10));
      if (user.college) query = query.where("college", "==", user.college);
    } else if (user.role === "maintenance") {
      const teamSnap = await db
        .collection("teams")
        .where("members", "array-contains", user.uid)
        .get();
      const teamIds = teamSnap.docs.map((d) => d.id).slice(0, 10);
      if (teamIds.length) query = query.where("routing.teamId", "in", teamIds);
      else return json({ issues: [] });
      if (user.college) query = query.where("college", "==", user.college);
    } else if (user.role === "hod") {
      if (user.college) query = query.where("college", "==", user.college);
      if (user.department) query = query.where("department", "==", user.department);
    } else if (user.role === "principal") {
      if (user.college) query = query.where("college", "==", user.college);
    }

    if (status && status !== "all") query = query.where("status", "==", status);

    const snap = await query.orderBy("createdAt", "desc").limit(100).get();
const issues = snap.docs.map((d) => {
      const data = d.data();
      if (!Array.isArray(data.requirements)) data.requirements = [];
      delete data.trackingToken;
      return { id: d.id, ...data };
    });

    return json({ issues });
  } catch (e) {
    return handleError(e);
  }
}
