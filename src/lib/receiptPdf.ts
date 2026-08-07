import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { PRIORITY_LABEL, STATUS_LABEL } from "./constants";
import type { Issue, TimelineEntry } from "./types";

const ACCENT = "#D97757";
const ACCENT_DARK = "#B4552F";
const INK = "#3D382E";
const MUTED = "#8A8478";
const CREAM = "#FAF7F2";
const PEACH = "#FCEFE7";
const LINE = "#E8E0D5";

function fmt(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso)
    );
  } catch {
    return iso;
  }
}

function dur(fromIso?: string, toIso?: string): string {
  if (!fromIso || !toIso) return "—";
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const h = Math.round(ms / 3600000);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

function sectionTitle(text: string): Content {
  return {
    text,
    fontSize: 10,
    bold: true,
    color: ACCENT_DARK,
    characterSpacing: 0.5,
    margin: [0, 14, 0, 6] as [number, number, number, number],
  };
}

function kv(rows: [string, string][]): Content {
  return {
    table: {
      widths: [120, "*"],
      body: rows.map(([k, v]) => [
        { text: k.toUpperCase(), color: MUTED, fontSize: 7.5, bold: true, characterSpacing: 0.5 },
        { text: v, color: INK, fontSize: 9 },
      ]),
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
  };
}

function buildDefinition(issue: Issue, timeline: TimelineEntry[]): TDocumentDefinitions {
  const location = [
    issue.location?.name || "—",
    issue.location?.building,
    issue.location?.floor ? `Floor ${issue.location.floor}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  const rows: [string, string][] = [
    ["Issue number", issue.issueNo || "—"],
    ["Category", issue.routing?.categoryName || "—"],
    ["Department", issue.department || "—"],
    ["Location", location],
    ["Reported by", `${issue.reporter?.name || "—"} (${issue.reporter?.department || "—"})`],
    ["Reported on", fmt(issue.createdAt)],
    ["Closed on", fmt(issue.feedback?.givenAt || issue.updatedAt)],
    ["Resolution time", dur(issue.createdAt, issue.feedback?.givenAt)],
  ];

  const slaRows: [string, string][] = [["Priority", `P${issue.priority || "—"} ${PRIORITY_LABEL[issue.priority] || ""}`.trim()]];
  if (issue.sla?.responseDeadline) slaRows.push(["SLA — respond by", fmt(issue.sla.responseDeadline)]);
  if (issue.sla?.resolutionDeadline) slaRows.push(["SLA — resolve by", fmt(issue.sla.resolutionDeadline)]);
  const slaBreached = [
    issue.sla?.breachedFlags?.response ? "response" : null,
    issue.sla?.breachedFlags?.resolution ? "resolution" : null,
  ].filter(Boolean);
  if (slaBreached.length) slaRows.push(["SLA breaches", slaBreached.join(", ")]);

  const headerCell = {
    text: "" as string,
    color: ACCENT_DARK,
    bold: true,
    fontSize: 7.5,
    characterSpacing: 0.5,
  };

  const timelineBody = timeline.map((t) => [
    {
      text: `${t.from ? STATUS_LABEL[t.from] : "Reported"} → ${STATUS_LABEL[t.to]}${t.isAuto ? " (auto)" : ""}`,
      bold: true,
      fontSize: 8.5,
    },
    { text: fmt(t.at), fontSize: 8, color: MUTED },
    {
      text: `${t.by?.name || "—"}${t.note ? `\n${t.note}` : ""}`,
      fontSize: 8,
      color: MUTED,
    },
  ]);

  const requirements = Array.isArray(issue.requirements) ? issue.requirements : [];
  const content: Content[] = [
    {
      columns: [
        {
          width: "*",
          stack: [
            { text: "CampusCare", fontSize: 20, bold: true, color: ACCENT_DARK },
            {
              text: "Campus Maintenance Management",
              fontSize: 8,
              color: MUTED,
              characterSpacing: 1,
              margin: [0, 2, 0, 0],
            },
          ],
        },
        {
          width: "auto",
          alignment: "right",
          stack: [
            {
              text: "MAINTENANCE RECEIPT",
              fontSize: 11,
              bold: true,
              color: ACCENT_DARK,
              characterSpacing: 1.5,
            },
            { text: issue.issueNo || "Receipt", fontSize: 9, color: MUTED, alignment: "right", margin: [0, 2, 0, 0] },
          ],
        },
      ],
    },
    {
      canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: ACCENT }],
      margin: [0, 10, 0, 14] as [number, number, number, number],
    },
    {
      table: {
        widths: ["auto"],
        body: [[{ text: "STATUS: CLOSED", fillColor: ACCENT, color: "white", bold: true, fontSize: 8, characterSpacing: 1.5, alignment: "center" }]],
      },
      layout: "noBorders",
      margin: [0, 0, 0, 8] as [number, number, number, number],
    },
    sectionTitle("ISSUE DETAILS"),
    kv(rows),
    sectionTitle("DESCRIPTION"),
    {
      text: issue.description || "—",
      fontSize: 9,
      color: INK,
      margin: [0, 0, 0, 4] as [number, number, number, number],
    },
    { text: issue.title, fontSize: 12, bold: true, color: INK, margin: [0, 0, 0, 2] },
    sectionTitle("PRIORITY & SLA"),
    kv(slaRows),
  ];

  if (requirements.length > 0) {
    content.push(sectionTitle("REQUIREMENTS"));
    content.push({
      table: {
        headerRows: 1,
        widths: ["*", 60, 90],
        body: [
          [
            { ...headerCell, text: "ITEM" },
            { ...headerCell, text: "QTY" },
            { ...headerCell, text: "STATUS" },
          ],
          ...requirements.map((r) => [
            { text: r.item, fontSize: 8.5 },
            { text: String(r.qty), fontSize: 8.5, alignment: "center" },
            { text: r.resolved ? "Resolved" : r.needsApproval ? "Needs approval" : "Pending", fontSize: 8.5, color: MUTED },
          ]),
        ],
      },
      layout: {
        hLineWidth: (i: number) => (i === 0 ? 0 : 0.5),
        vLineWidth: () => 0,
        hLineColor: () => LINE,
        fillColor: (i: number) => (i === 0 ? PEACH : null),
        paddingTop: () => 5,
        paddingBottom: () => 5,
        paddingLeft: () => 6,
        paddingRight: () => 6,
      },
    } as Content);
  }

  content.push(sectionTitle("TIMELINE"));
  content.push({
    table: {
      headerRows: 1,
      widths: [150, "*", "*"],
      body: [
        [
          { ...headerCell, text: "STATUS CHANGE" },
          { ...headerCell, text: "WHEN" },
          { ...headerCell, text: "BY / NOTE" },
        ],
        ...timelineBody,
      ],
    },
    layout: {
      hLineWidth: (i: number) => (i === 0 ? 0 : 0.5),
      vLineWidth: () => 0,
      hLineColor: () => LINE,
      fillColor: (i: number) => (i === 0 ? PEACH : null),
      paddingTop: () => 5,
      paddingBottom: () => 5,
      paddingLeft: () => 6,
      paddingRight: () => 6,
    },
  } as Content);

  if (issue.completion) {
    content.push(sectionTitle("COMPLETION REPORT"));
    content.push({
      table: {
        widths: [120, "*"],
        body: [
          [
            { text: "REPORT", color: MUTED, fontSize: 7.5, bold: true },
            { text: issue.completion.report, fontSize: 9 },
          ],
          [
            { text: "COMPLETED ON", color: MUTED, fontSize: 7.5, bold: true },
            { text: fmt(issue.completion.completedAt), fontSize: 9 },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 3,
        paddingBottom: () => 3,
      },
    });
  }

  if (issue.verification) {
    content.push(sectionTitle("VERIFICATION"));
    content.push(
      kv([
        ["Verified by", issue.verification.verifiedBy?.name || "—"],
        ["Verified on", fmt(issue.verification.verifiedAt)],
        ["Verdict", issue.verification.verdict || "—"],
      ])
    );
  }

  if (issue.feedback) {
    content.push(sectionTitle("REPORTER FEEDBACK"));
    content.push(
      kv([
        ["Rating", `${issue.feedback.rating} / 5`],
        ["Comment", issue.feedback.comment || "—"],
        ["Given on", fmt(issue.feedback.givenAt)],
      ])
    );
  }

  content.push({
    text: "This is a computer-generated receipt from CampusCare. Please do not reply to this document.",
    fontSize: 7.5,
    color: MUTED,
    margin: [0, 20, 0, 0] as [number, number, number, number],
  });

  return {
    pageMargins: [40, 32, 40, 48],
    background: () => ({
      canvas: [{ type: "rect", x: 0, y: 0, w: 595.28, h: 841.89, color: CREAM }],
    }),
    info: { title: `Maintenance receipt — ${issue.issueNo || ""}`, author: "CampusCare" },
    defaultStyle: { font: "Roboto", fontSize: 9, color: INK, lineHeight: 1.35 },
    content,
    footer: (currentPage: number, pageCount: number) => ({
      margin: [40, 0, 40, 24],
      columns: [
        {
          text: `Generated ${fmt(new Date().toISOString())} · CampusCare (servox-phi.vercel.app)`,
          fontSize: 7.5,
          color: MUTED,
        },
        { text: `Page ${currentPage} of ${pageCount}`, alignment: "right", fontSize: 7.5, color: MUTED },
      ],
    }),
  };
}

export async function downloadIssueReceipt(issue: Issue, timeline: TimelineEntry[]): Promise<void> {
  const [{ default: pdfMake }, { default: pdfFonts }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const pm = pdfMake as unknown as { addVirtualFileSystem: (vfs: Record<string, string>) => void };
  // pdfmake 0.3.x `vfs_fonts.js` exports the raw virtual file system map
  // (`module.exports = vfs`); it must be registered via addVirtualFileSystem
  // so the browser virtual file system can resolve the Roboto font files.
  pm.addVirtualFileSystem(pdfFonts as unknown as Record<string, string>);
  const safeNo = (issue.issueNo || "issue").replace(/[^A-Za-z0-9-]/g, "");
  pdfMake.createPdf(buildDefinition(issue, timeline)).download(`receipt-${safeNo}.pdf`);
}
