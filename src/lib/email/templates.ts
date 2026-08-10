import "server-only";

import { PRIORITY_LABEL } from "../constants";
import type { Issue } from "../types";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

/* Warm "Claude" palette — mirrors src/app/globals.css */
const INK = "#1f1e1d";
const ACCENT = "#d97757";
const ACCENT_STRONG = "#ff6b4a";
const BG_OUTER = "#faf9f5";
const CARD = "#ffffff";
const PANEL = "#faf9f5";
const BORDER = "#e6e2d8";
const BORDER_SOFT = "#f0eee6";
const TEXT = "#403c37";
const MUTED = "#78716c";
const FAINT = "#a8a29e";
const DANGER = "#c1452e";
const DANGER_SOFT = "#f9eae4";
const WARN = "#b45309";
const WARN_SOFT = "#faefdd";
const OK = "#3e7d4b";

export function appUrl(): string {
  return (process.env.APP_URL || "https://servox-phi.vercel.app").replace(/\/+$/, "");
}

function issueUrl(id: string | undefined): string {
  return `${appUrl()}/issues/${id}`;
}

function trackingUrl(token: string): string {
  return `${appUrl()}/track/${token}`;
}

/** Prefer the public tracking link (no login needed); fall back to the app page for legacy docs. */
function issueLink(issue: Issue): string {
  return issue.trackingToken ? trackingUrl(issue.trackingToken) : issueUrl(issue.id);
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
  danger: DANGER,
  warn: WARN,
  ok: OK,
};

function severityBadge(priority: number): string {
  const urgent = priority > 0 && priority <= 2;
  const spec = urgent
    ? { text: DANGER, bg: DANGER_SOFT, border: "#eccfc6" }
    : priority === 3
      ? { text: WARN, bg: WARN_SOFT, border: "#ecd9bd" }
      : { text: FAINT, bg: BORDER_SOFT, border: BORDER };
  return `<span style="display:inline-block;padding:5px 14px;border-radius:9999px;font-size:12px;font-weight:700;letter-spacing:0.3px;color:${spec.text};background:${spec.bg};border:1px solid ${spec.border};">${urgent ? "CRITICAL · " : ""}P${priority || "–"} ${esc(PRIORITY_LABEL[priority] || "Unrated")}</span>`;
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 10px;font-family:${SERIF};font-size:22px;font-weight:700;color:${INK};line-height:1.25;letter-spacing:-0.3px;">${esc(text)}</h1>`;
}

function cta(href: string, label: string): string {
  return `<p style="margin:28px 0 8px;"><a href="${href}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 28px;border-radius:9999px;box-shadow:0 6px 18px rgba(217,119,87,0.28);">${esc(label)}</a></p>`;
}

function shell(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:${BG_OUTER};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG_OUTER};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${CARD};border-radius:18px;overflow:hidden;border:1px solid ${BORDER};box-shadow:0 12px 40px rgba(41,38,27,0.08);">
          <tr>
            <td style="height:4px;font-size:0;line-height:0;background:linear-gradient(90deg, ${ACCENT_STRONG}, ${ACCENT});"></td>
          </tr>
          <tr>
            <td style="padding:26px 32px;border-bottom:1px solid ${BORDER_SOFT};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align:middle;padding-right:10px;">
                          <span style="display:inline-block;width:34px;height:34px;border-radius:10px;background:${ACCENT};color:#ffffff;font-family:${FONT};font-size:16px;font-weight:700;text-align:center;line-height:34px;">SP</span>
                        </td>
                        <td style="vertical-align:middle;">
                          <span style="font-family:${SERIF};font-size:20px;font-weight:700;color:${INK};">servox-phi</span>
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
            <td style="padding:32px 32px;font-family:${FONT};color:${TEXT};font-size:15px;line-height:1.6;">${body}</td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:${BORDER_SOFT};border-top:1px solid ${BORDER};">
              <p style="margin:0;font-family:${FONT};font-size:12px;color:${FAINT};">This is an automated notification from servox-phi. Please do not reply to this email.</p>
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
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PANEL};border:1px solid ${BORDER};border-radius:12px;margin:18px 0;overflow:hidden;">
    ${[
      ["Issue", `${issue.issueNo}`],
      ["Department", issue.department],
      ["Category", issue.routing?.categoryName || "—"],
      ["Location", issue.location?.name ? `${issue.location.name}${issue.location.building ? ` (${issue.location.building})` : ""}` : "—"],
      ["Reported", fmt(issue.createdAt)],
    ]
      .map(
        ([k, v]) =>
          `<tr><td style="padding:10px 16px;border-bottom:1px solid ${BORDER_SOFT};font-size:11px;color:${FAINT};width:110px;vertical-align:top;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;">${k}</td><td style="padding:10px 16px;border-bottom:1px solid ${BORDER_SOFT};font-size:13px;color:${TEXT};">${esc(v)}</td></tr>`
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
    ${heading(headline)}
    <p style="margin:0 0 18px;color:${MUTED};">${esc(issue.title)}</p>
    ${severityBadge(priority)}
    <p style="margin:20px 0 4px;color:${TEXT};font-size:16px;"><strong>${esc(issue.title)}</strong></p>
    <p style="margin:0 0 18px;color:${MUTED};">${esc(issue.description)}</p>
    ${issueMeta(issue)}
    ${cta(issueLink(issue), "Track this issue")}
  `;
  const text = `${headline}\n\n${issue.title}\n\n${issue.issueNo}\nDepartment: ${issue.department}\nCategory: ${issue.routing?.categoryName || "—"}\nReported: ${fmt(issue.createdAt)}\n\nTrack: ${issueLink(issue)}`;
  return { html: shell(body), text };
}

export function approvedTemplate(issue: Issue): { html: string; text: string } {
  const body = `
    ${heading(`Issue approved — ${issue.issueNo}`)}
    <p style="margin:0 0 18px;color:${MUTED};">${esc(issue.title)} has been approved and is being routed to maintenance.</p>
    ${severityBadge(issue.priority)}
    ${issueMeta(issue)}
    <p style="margin:8px 0 0;font-size:13px;color:${MUTED};">Severity may have been revised by the approving authority (HOD / Principal).</p>
    ${cta(issueLink(issue), "Track this issue")}
  `;
  const text = `Issue approved — ${issue.issueNo}\n\n${issue.title}\n\n${issue.issueNo}\nDepartment: ${issue.department}\nCategory: ${issue.routing?.categoryName || "—"}\n\nTrack: ${issueLink(issue)}`;
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
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PANEL};border:1px solid ${BORDER};border-radius:12px;margin:18px 0;border-left:4px solid ${barColor};overflow:hidden;">
    <tr><td style="padding:18px;">
      <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.6px;">SLA · P${priority} (${esc(PRIORITY_LABEL[priority] || "Unrated")})</p>
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
    ${heading(headline)}
    <p style="margin:0 0 4px;color:${TEXT};font-size:16px;"><strong>${esc(issue.title)}</strong></p>
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
