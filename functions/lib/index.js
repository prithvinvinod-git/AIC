"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWeeklyDigest = exports.sendDeadlineReminders = exports.checkSlaBreaches = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firebase_functions_1 = require("firebase-functions");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
/**
 * Scheduled maintenance for servox-phi.
 *
 * Runs as scheduled Cloud Functions in the real Firebase project. Real emails
 * are out of scope — "email" digests are written into the same notifications
 * collection the app reads, so they surface in the UI without SMTP credentials.
 */
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const OPEN_STATUSES = ["ASSIGNED", "ONGOING", "PENDING"];
const DIGEST_ROLES = ["admin", "hod", "principal"];
const SYSTEM_ACTOR = { uid: "system", name: "SLA Monitor", role: "admin" };
async function sendPushNotification(uid, title, body, link, type) {
    try {
        const userDoc = await db.doc(`users/${uid}`).get();
        const data = userDoc.data();
        if (!data?.fcmToken || data?.pushEnabled === false)
            return;
        await (0, messaging_1.getMessaging)().send({
            token: data.fcmToken,
            notification: { title, body },
            data: { link, type },
            webpush: {
                notification: {
                    icon: "/servoxlogo.png",
                    badge: "/servoxlogo.png",
                    tag: `servox-${type}`,
                    renotify: true,
                },
                fcmOptions: { link },
            },
        });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg.includes("registration-token-not-registered") || msg.includes("Invalid registration token")) {
            await db.doc(`users/${uid}`).set({ fcmToken: null }, { merge: true }).catch(() => { });
        }
    }
}
async function notifyUser(uid, type, title, body, link) {
    try {
        await db.collection(`notifications/${uid}/items`).add({
            type,
            title,
            body,
            link,
            isRead: false,
            at: new Date().toISOString(),
        });
    }
    catch (e) {
        firebase_functions_1.logger.warn("notify failed", uid, e);
    }
    void sendPushNotification(uid, title, body, link, type);
}
async function notifyRoles(roles, type, title, body, link) {
    try {
        const snap = await db.collection("users").where("isActive", "==", true).get();
        const uids = snap.docs
            .filter((d) => roles.includes(d.data().role))
            .map((d) => d.id);
        await Promise.allSettled(uids.map((uid) => notifyUser(uid, type, title, body, link)));
    }
    catch (e) {
        firebase_functions_1.logger.warn("notifyRoles failed", e);
    }
}
async function pushTimeline(issueId, from, to, note, by) {
    const ref = db.doc(`issues/${issueId}`);
    const snap = await ref.get();
    const counters = snap.get("counters") || {};
    await ref.update({
        updatedAt: new Date().toISOString(),
        counters: { ...counters, timelineCount: (counters.timelineCount || 0) + 1 },
    });
    await db.collection(`issues/${issueId}/timeline`).add({
        from,
        to,
        by,
        note,
        at: new Date().toISOString(),
        isAuto: true,
    });
}
/** Flag resolution-SLA breaches for open issues and alert the chain. */
exports.checkSlaBreaches = (0, scheduler_1.onSchedule)({ schedule: "every 10 minutes", timeZone: "Asia/Kolkata" }, async () => {
    firebase_functions_1.logger.info("checkSlaBreaches: running");
    const nowIso = new Date().toISOString();
    const snap = await db
        .collection("issues")
        .where("status", "in", OPEN_STATUSES)
        .where("sla.resolutionDeadline", "<=", nowIso)
        .limit(200)
        .get();
    let breached = 0;
    await Promise.allSettled(snap.docs.map(async (doc) => {
        const data = doc.data();
        const flags = data.sla?.breachedFlags || {};
        if (flags.resolution)
            return;
        const issueId = doc.id;
        const issueNo = data.issueNo || issueId;
        await doc.ref.update({
            "sla.breachedFlags.resolution": true,
            updatedAt: new Date().toISOString(),
        });
        await pushTimeline(issueId, data.status, data.status, `Resolution SLA breached for ${issueNo}.`, SYSTEM_ACTOR);
        const link = `/issues/${issueId}`;
        await notifyRoles(["validator", "admin"], "sla", "SLA breach", `${issueNo} missed its resolution deadline — investigate now.`, link);
        await notifyUser(data.reporter?.uid, "sla", "SLA breach", `Your issue ${issueNo} crossed its resolution deadline.`, link);
        breached += 1;
    }));
    firebase_functions_1.logger.info(`checkSlaBreaches: flagged ${breached} issue(s)`);
});
/** Hourly reminder for jobs near their resolution deadline. */
exports.sendDeadlineReminders = (0, scheduler_1.onSchedule)({ schedule: "every 60 minutes" }, async () => {
    firebase_functions_1.logger.info("sendDeadlineReminders: running");
    const nowIso = new Date().toISOString();
    const upperIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const snap = await db
        .collection("issues")
        .where("status", "in", OPEN_STATUSES)
        .where("sla.resolutionDeadline", ">=", nowIso)
        .where("sla.resolutionDeadline", "<=", upperIso)
        .limit(200)
        .get();
    let reminded = 0;
    await Promise.allSettled(snap.docs.map(async (doc) => {
        const data = doc.data();
        const last = data.sla?.lastReminderAt;
        if (last && Date.now() - new Date(last).getTime() < 6 * 60 * 60 * 1000)
            return;
        const issueId = doc.id;
        const issueNo = data.issueNo || issueId;
        const deadline = data.sla?.resolutionDeadline;
        const due = deadline
            ? Math.max(0, Math.round((new Date(deadline).getTime() - Date.now()) / 3600000))
            : "?";
        await doc.ref.update({ "sla.lastReminderAt": new Date().toISOString() });
        const link = `/issues/${issueId}`;
        const staff = (data.routing?.staff || []).map((s) => s.uid);
        await Promise.allSettled([...new Set(staff)].map((uid) => notifyUser(uid, "reminder", "Deadline approaching", `${issueNo} is due in ~${due}h.`, link)));
        const reporterUid = data.reporter?.uid;
        if (reporterUid) {
            await notifyUser(reporterUid, "reminder", "Deadline approaching", `${issueNo} is due in ~${due}h.`, link);
        }
        reminded += 1;
    }));
    firebase_functions_1.logger.info(`sendDeadlineReminders: reminded ${reminded} job(s)`);
});
/** Weekly digest of the last 7 days for admins/HODs/Principal. */
exports.sendWeeklyDigest = (0, scheduler_1.onSchedule)({ schedule: "every monday 08:00", timeZone: "Asia/Kolkata" }, async () => {
    firebase_functions_1.logger.info("sendWeeklyDigest: running");
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const snap = await db.collection("issues").where("createdAt", ">=", since).limit(1000).get();
    const byStatus = {};
    const byCategory = {};
    let closed = 0;
    let slaBreached = 0;
    for (const doc of snap.docs) {
        const d = doc.data();
        byStatus[d.status] = (byStatus[d.status] || 0) + 1;
        const cat = d.routing?.categoryName || "Uncategorised";
        byCategory[cat] = (byCategory[cat] || 0) + 1;
        if (d.status === "CLOSED" || d.status === "VERIFIED")
            closed += 1;
        if (d.sla?.breachedFlags?.resolution)
            slaBreached += 1;
    }
    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    const title = "Weekly maintenance digest";
    const body = `${snap.size} issues in the last 7 days · ` +
        `${closed} resolved · ${slaBreached} SLA breaches · ` +
        `top area: ${topCategory ? `${topCategory[0]} (${topCategory[1]})` : "—"}.`;
    await notifyRoles(DIGEST_ROLES, "digest", title, body, "/analytics");
    firebase_functions_1.logger.info(`sendWeeklyDigest: sent to ${DIGEST_ROLES.join(",")}`);
});
//# sourceMappingURL=index.js.map