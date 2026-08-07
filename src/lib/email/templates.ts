import "server-only";

import { PRIORITY_LABEL } from "../constants";
import type { Issue } from "../types";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const ACCENT = "#10a37f";
const BG_OUTER = "#1e1e21";
const BG_CARD = "#2f2f37";
const BG_PANEL = "#26262e";
const BORDER = "#44444f";
const TEXT = "#e6e6ec";
const MUTED = "#9a9aa8";

export function appUrl(): string {
  return (process.env.APP_URL || "https://servox-phi.vercel.app").replace(/\/+$/, "");
}

function issueUrl(id: string | undefined): string {
  return `${appUrl()}/issues/${id}`;
}

function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[c];
  });
}

function fmt(iso: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso)
    );
  } catch {
    return iso;
  }
}

/** Human "time remaining" label computed at send time. */
function remaining(deadlineIso: string): { text: string; tone: "danger" | "warn" | "ok" } {
  const ms = new Date(deadlineIso).getTime() - Date.now();
  const mins = Math.round(ms / 60000);
  const abs = Math.abs(mins);
  const units = abs < 60 ? `${abs}m` : abs < 60 * 24 ? `${Math.round(abs / 60)}h` : `${Math.round(abs / (60 * 24))}d`;
  if (ms < 0) return { text: `${units} overdue`, tone: "danger" };
  if (mins < 60 * 4) return { text: `due in ${units}`, tone: "danger" };
  if (mins < 60 * 24) return { text: `due in ${units}`, tone: "warn" };
  return { text: `due in ${units}`, tone: "ok" };
}

const TONE_COLOR: Record<"danger" | "warn" | "ok", string> = {
  danger: "#f87171",
  warn: "#fbbf24",
  ok: "#34d399",
};

function severityBadge(priority: number): string {
  const urgent = priority > 0 && priority <= 2;
  const spec = urgent
    ? { text: "#f87171", bg: "rgba(248,113,113,0.16)", border: "rgba(248,113,113,0.5)" }
    : priority === 3
      ? { text: "#93c5fd", bg: "rgba(96,165,250,0.16)", border: "rgba(96,165,250,0.5)" }
      : { text: "#b6b6c4", bg: "rgba(156,163,175,0.14)", border: "rgba(156,163,175,0.4)" };
  return `<span style="display:inline-block;padding:5px 14px;border-radius:9999px;font-size:12px;font-weight:700;letter-spacing:0.3px;color:${spec.text};background:${spec.bg};border:1px solid ${spec.border};">${urgent ? "CRITICAL · " : ""}P${priority || "–"} ${esc(PRIORITY_LABEL[priority] || "Unrated")}</span>`;
}

function cta(href: string, label: string): string {
  return `<p style="margin:28px 0 8px;"><a href="${href}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 28px;border-radius:9999px;box-shadow:0 6px 18px rgba(16,163,127,0.35);">${esc(label)}</a></p>`;
}

function shell(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:${BG_OUTER};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG_OUTER};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${BG_CARD};border-radius:20px;overflow:hidden;border:1px solid ${BORDER};box-shadow:0 12px 40px rgba(0,0,0,0.5);">
          <tr>
            <td style="padding:26px 32px;border-bottom:1px solid ${BORDER};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align:middle;padding-right:10px;">
                          <span style="display:inline-block;width:34px;height:34px;border-radius:10px;background:${ACCENT};color:#ffffff;font-family:${FONT};font-size:16px;font-weight:700;text-align:center;line-height:34px;">CC</span>
                        </td>
                        <td style="vertical-align:middle;">
                          <span style="font-family:${FONT};font-size:20px;font-weight:800;color:#ffffff;">CampusCare</span>
                          <span style="font-family:${FONT};font-size:12px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:1.5px;margin-left:10px;">Maintenance</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:34px 32px;font-family:${FONT};color:${TEXT};font-size:14px;line-height:1.65;">${body}</td>
          </tr>
          <tr>
            <td style="padding:22px 32px;background:${BG_PANEL};border-top:1px solid ${BORDER};">
              <p style="margin:0;font-family:${FONT};font-size:12px;color:${MUTED};">This is an automated notification from CampusCare. Please do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function issueMeta(issue: Issue): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG_PANEL};border:1px solid ${BORDER};border-radius:14px;margin:18px 0;">
    ${[
      ["Issue", `${issue.issueNo}`],
      ["Department", issue.department],
      ["Category", issue.routing?.categoryName || "—"],
      ["Location", issue.location?.name ? `${issue.location.name}${issue.location.building ? ` (${issue.location.building})` : ""}` : "—"],
      ["Reported", fmt(issue.createdAt)],
    ]
      .map(
        ([k, v]) =>
          `<tr><td style="padding:11px 16px;border-bottom:1px solid ${BORDER};font-size:12px;color:${MUTED};width:110px;vertical-align:top;font-weight:600;">${k}</td><td style="padding:11px 16px;border-bottom:1px solid ${BORDER};font-size:13px;color:${TEXT};">${esc(v)}</td></tr>`
      )
      .join("")}
  </table>`;
}

export function reportedTemplate(issue: Issue, priority: number): { html: string; text: string } {
  const urgent = priority > 0 && priority <= 2;
  const headline = urgent
    ? `Critical issue reported — ${issue.issueNo}`
    : `New issue reported — ${issue.issueNo}`;
  const body = `
    <h1 style="margin:0 0 10px;font-size:20px;color:#ffffff;line-height:1.3;">${headline}</h1>
    <p style="margin:0 0 18px;color:${MUTED};">${esc(issue.title)}</p>
    ${severityBadge(priority)}
    <p style="margin:20px 0 4px;color:${TEXT};font-size:15px;"><strong>${esc(issue.title)}</strong></p>
    <p style="margin:0 0 18px;color:${MUTED};">${esc(issue.description)}</p>
    ${issueMeta(issue)}
    ${cta(issueUrl(issue.id), "View issue")}
  `;
  const text = `${headline}\n\n${issue.title}\n\n${issue.issueNo}\nDepartment: ${issue.department}\nCategory: ${issue.routing?.categoryName || "—"}\nReported: ${fmt(issue.createdAt)}\n\nView: ${issueUrl(issue.id)}`;
  return { html: shell(body), text };
}

export function approvedTemplate(issue: Issue): { html: string; text: string } {
  const body = `
    <h1 style="margin:0 0 10px;font-size:20px;color:#ffffff;line-height:1.3;">Issue approved — ${esc(issue.issueNo)}</h1>
    <p style="margin:0 0 18px;color:${MUTED};">${esc(issue.title)} has been approved and is being routed to maintenance.</p>
    ${severityBadge(issue.priority)}
    ${issueMeta(issue)}
    <p style="margin:8px 0 0;font-size:13px;color:${MUTED};">Severity may have been revised by the approving authority (HOD / Principal).</p>
    ${cta(issueUrl(issue.id), "View issue")}
  `;
  const text = `Issue approved — ${issue.issueNo}\n\n${issue.title}\n\n${issue.issueNo}\nDepartment: ${issue.department}\nCategory: ${issue.routing?.categoryName || "—"}\n\nView: ${issueUrl(issue.id)}`;
  return { html: shell(body), text };
}

function slaCard(issue: Issue): string {
  const sla = issue.sla;
  const priority = issue.priority || 3;
  if (!sla?.responseDeadline && !sla?.resolutionDeadline) return "";

  const response = sla.responseDeadline ? remaining(sla.responseDeadline) : null;
  const resolution = sla.resolutionDeadline ? remaining(sla.resolutionDeadline) : null;
  const barColor = TONE_COLOR[resolution?.tone || "ok"];
  const calHref = calendarLink(issue, sla.resolutionDeadline);

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG_PANEL};border:1px solid ${BORDER};border-radius:14px;margin:18px 0;border-left:4px solid ${barColor};">
    <tr><td style="padding:18px;">
      <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;">SLA · P${priority} (${esc(PRIORITY_LABEL[priority] || "Unrated")})</p>
      ${sla.responseDeadline ? `<p style="margin:0 0 4px;font-size:13px;color:${TEXT};"><strong>Respond by</strong> ${fmt(sla.responseDeadline)} — <span style="color:${TONE_COLOR[response?.tone || "ok"]};font-weight:700;">${response?.text}</span></p>` : ""}
      ${sla.resolutionDeadline ? `<p style="margin:0;font-size:13px;color:${TEXT};"><strong>Resolve by</strong> ${fmt(sla.resolutionDeadline)} — <span style="color:${TONE_COLOR[resolution?.tone || "ok"]};font-weight:700;">${resolution?.text}</span></p>` : ""}
      <p style="margin:14px 0 0;"><a href="${calHref}" style="font-size:12px;font-weight:700;color:${ACCENT};text-decoration:underline;">Add to calendar</a></p>
    </td></tr>
  </table>`;
}

export function jobAssignmentTemplate(issue: Issue): { html: string; text: string } {
  const urgent = issue.priority > 0 && issue.priority <= 2;
  const headline = urgent ? `URGENT job assigned — ${issue.issueNo}` : `New job assigned — ${issue.issueNo}`;
  const body = `
    <h1 style="margin:0 0 10px;font-size:20px;color:#ffffff;line-height:1.3;">${headline}</h1>
    <p style="margin:0 0 4px;color:${TEXT};font-size:15px;"><strong>${esc(issue.title)}</strong></p>
    <p style="margin:0 0 18px;color:${MUTED};">A maintenance job has been routed to your team.</p>
    ${severityBadge(issue.priority)}
    ${issueMeta(issue)}
    ${slaCard(issue)}
    ${cta(issueUrl(issue.id), "Open job")}
  `;
  const text = `${headline}\n\n${issue.title}\n\n${issue.issueNo}\nDepartment: ${issue.department}\nCategory: ${issue.routing?.categoryName || "—"}\nLocation: ${issue.location?.name || "—"}\n\nView: ${issueUrl(issue.id)}`;
  return { html: shell(body), text };
}

function calendarLink(issue: Issue, deadlineIso: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = (dt: Date) =>
    `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00Z`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${issue.issueNo}: ${issue.title}`,
    dates: `${ts(new Date())}/${ts(new Date(deadlineIso))}`,
    details: `SLA resolution deadline for ${issue.issueNo}. Category: ${issue.routing?.categoryName || "—"}\n\n${issueUrl(issue.id)}`,
    location: `${issue.location?.name || ""}, ${issue.department}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
