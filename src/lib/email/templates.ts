import "server-only";

import { PRIORITY_LABEL } from "../constants";
import type { Issue } from "../types";

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
  danger: "#c0392b",
  warn: "#d97706",
  ok: "#2e7d32",
};

function severityBadge(priority: number): string {
  const urgent = priority > 0 && priority <= 2;
  const color = urgent ? "#c0392b" : priority === 3 ? "#2563eb" : "#6b7280";
  return `<span style="display:inline-block;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:600;color:${color};background:${urgent ? "#fef2f2" : "#f4f4f4"};border:1px solid ${color};">${
    urgent ? "CRITICAL" : ""
  }P${priority || "–"} · ${esc(PRIORITY_LABEL[priority] || "Unrated")}</span>`;
}

function cta(href: string, label: string): string {
  return `<p style="margin:24px 0 8px;"><a href="${href}" style="display:inline-block;background:#101010;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:9999px;">${esc(label)}</a></p>`;
}

function shell(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f4f4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:24px 32px;border-bottom:1px solid #e5e7eb;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-family:Arial,sans-serif;font-size:20px;font-weight:700;color:#101010;">CampusCare</span>
                    <span style="font-family:Arial,sans-serif;font-size:12px;font-weight:600;color:#0099ff;text-transform:uppercase;letter-spacing:1px;margin-left:8px;">Maintenance</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:#242424;font-size:14px;line-height:1.6;">${body}</td>
          </tr>
          <tr>
            <td style="padding:24px 32px;background:#fafafa;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#6b7280;">This is an automated notification from CampusCare. Please do not reply to this email.</p>
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
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #e5e7eb;border-radius:12px;margin:16px 0;">
    ${[
      ["Issue", `${issue.issueNo}`],
      ["Department", issue.department],
      ["Category", issue.routing?.categoryName || "—"],
      ["Location", issue.location?.name ? `${issue.location.name}${issue.location.building ? ` (${issue.location.building})` : ""}` : "—"],
      ["Reported", fmt(issue.createdAt)],
    ]
      .map(
        ([k, v]) =>
          `<tr><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;width:100px;vertical-align:top;">${k}</td><td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#242424;">${esc(v)}</td></tr>`
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
    <h1 style="margin:0 0 8px;font-size:18px;color:#101010;">${headline}</h1>
    <p style="margin:0 0 16px;color:#6b7280;">${esc(issue.title)}</p>
    <p style="margin:0 0 16px;">${severityBadge(priority)}</p>
    <p style="margin:0 0 4px;color:#242424;"><strong>${esc(issue.title)}</strong></p>
    <p style="margin:0 0 16px;color:#6b7280;">${esc(issue.description)}</p>
    ${issueMeta(issue)}
    ${cta(issueUrl(issue.id), "View issue")}
  `;
  const text = `${headline}\n\n${issue.title}\n\n${issue.issueNo}\nDepartment: ${issue.department}\nCategory: ${issue.routing?.categoryName || "—"}\nReported: ${fmt(issue.createdAt)}\n\nView: ${issueUrl(issue.id)}`;
  return { html: shell(body), text };
}

export function approvedTemplate(issue: Issue): { html: string; text: string } {
  const body = `
    <h1 style="margin:0 0 8px;font-size:18px;color:#101010;">Issue approved — ${esc(issue.issueNo)}</h1>
    <p style="margin:0 0 16px;color:#6b7280;">${esc(issue.title)} has been approved and is being routed to maintenance.</p>
    ${severityBadge(issue.priority)}
    ${issueMeta(issue)}
    <p style="margin:8px 0 0;font-size:13px;color:#6b7280;">Severity may have been revised by the approving authority (HOD / Principal).</p>
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
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #e5e7eb;border-radius:12px;margin:16px 0;border-left:4px solid ${barColor};">
    <tr><td style="padding:16px;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">SLA · P${priority} (${esc(PRIORITY_LABEL[priority] || "Unrated")})</p>
      ${sla.responseDeadline ? `<p style="margin:0 0 4px;font-size:13px;color:#242424;"><strong>Respond by</strong> ${fmt(sla.responseDeadline)} — <span style="color:${TONE_COLOR[response?.tone || "ok"]};font-weight:600;">${response?.text}</span></p>` : ""}
      ${sla.resolutionDeadline ? `<p style="margin:0;font-size:13px;color:#242424;"><strong>Resolve by</strong> ${fmt(sla.resolutionDeadline)} — <span style="color:${TONE_COLOR[resolution?.tone || "ok"]};font-weight:600;">${resolution?.text}</span></p>` : ""}
      <p style="margin:12px 0 0;"><a href="${calHref}" style="font-size:12px;font-weight:600;color:#0099ff;text-decoration:underline;">Add to calendar</a></p>
    </td></tr>
  </table>`;
}

export function jobAssignmentTemplate(issue: Issue): { html: string; text: string } {
  const urgent = issue.priority > 0 && issue.priority <= 2;
  const headline = urgent ? `URGENT job assigned — ${issue.issueNo}` : `New job assigned — ${issue.issueNo}`;
  const body = `
    <h1 style="margin:0 0 8px;font-size:18px;color:#101010;">${headline}</h1>
    <p style="margin:0 0 4px;color:#242424;"><strong>${esc(issue.title)}</strong></p>
    <p style="margin:0 0 16px;color:#6b7280;">A maintenance job has been routed to your team.</p>
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
