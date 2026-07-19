/**
 * SOP Generator — pure logic.
 *
 * Parse roles, process steps, tools, troubleshooting, references;
 * calculate next review date and total process duration; validate
 * required fields; suggest SOP IDs; render as text / HTML / Markdown
 * plus a one-page quick reference card. Pure functions only — no DOM,
 * no network.
 */

// ---- Types ----

export interface SopRole {
  role: string;
  responsibility: string;
}

export interface SopProcessStep {
  stepNumber: number;
  action: string;
  durationMinutes: number;
}

export interface SopTroubleshooting {
  issue: string;
  solution: string;
}

export interface SopInput {
  sopTitle: string;
  sopId: string; // e.g. "SOP-2026-001"
  version: string; // e.g. "1.0"
  department: string; // e.g. "Engineering"
  lastReviewedDate: string; // YYYY-MM-DD
  nextReviewDate: string; // YYYY-MM-DD (auto-calc +1 year)
  purpose: string;
  scope: string;
  roles: string; // textarea, `role,responsibility` per line
  process: string; // textarea, `step_number,action,duration_minutes` per line
  tools: string; // textarea, one per line
  troubleshooting: string; // textarea, `issue,solution` per line
  references: string; // textarea, one per line
}

export interface SopStats {
  stepCount: number;
  totalDurationMinutes: number;
  roleCount: number;
  toolCount: number;
  troubleshootingCount: number;
  referenceCount: number;
}

export interface DepartmentPreset {
  label: string;
  value: string;
  code: string;
  sampleSopTitle: string;
  sampleRoles: string;
  sampleProcess: string;
  sampleTools: string;
}

export interface HistoryEntry {
  ts: number;
  sopTitle: string;
  sopId: string;
  department: string;
  version: string;
  lastReviewedDate: string;
  stepCount: number;
  totalDurationMinutes: number;
}

// ---- Constants / Presets ----

export const DEPARTMENT_PRESETS: DepartmentPreset[] = [
  {
    label: "Engineering",
    value: "engineering",
    code: "ENG",
    sampleSopTitle: "Code Review Process",
    sampleRoles: "Author,Submits pull request for review\nReviewer,Reviews code and approves\nLead,Merges after approval",
    sampleProcess: "1,Author opens pull request,5\n2,Reviewer inspects changes,30\n3,Reviewer leaves comments,10\n4,Author addresses feedback,20\n5,Lead merges PR,5",
    sampleTools: "GitHub\nJira\nSlack",
  },
  {
    label: "HR",
    value: "hr",
    code: "HR",
    sampleSopTitle: "New Hire Onboarding",
    sampleRoles: "HR Specialist,Creates employee record\nIT,Provisions accounts and hardware\nManager,Welcomes and assigns buddy",
    sampleProcess: "1,Send offer letter,15\n2,Collect signed documents,30\n3,Provision laptop and accounts,60\n4,Day-1 orientation,120\n5,Assign onboarding buddy,10",
    sampleTools: "BambooHR\nGoogle Workspace\nLaptop inventory",
  },
  {
    label: "Finance",
    value: "finance",
    code: "FIN",
    sampleSopTitle: "Vendor Invoice Approval",
    sampleRoles: "Requestor,Submits invoice for payment\nManager,Approves expense\nAP Clerk,Issues payment and records entry",
    sampleProcess: "1,Requestor uploads invoice,5\n2,Manager reviews and approves,15\n3,AP Clerk enters into ERP,10\n4,AP Clerk schedules payment,5\n5,Payment issued and filed,10",
    sampleTools: "NetSuite\nConcur\nDocuSign",
  },
  {
    label: "Operations",
    value: "operations",
    code: "OPS",
    sampleSopTitle: "Daily Store Opening",
    sampleRoles: "Shift Lead,Unlocks and arms alarm\nAssociate,Counts register drawer\nManager,Reviews previous day's sales",
    sampleProcess: "1,Disarm alarm,2\n2,Inspect premises,10\n3,Count starting drawer,5\n4,Power on POS terminals,3\n5,Unlock front doors,1",
    sampleTools: "POS Terminal\nSafe\nAlarm keypad",
  },
  {
    label: "Sales",
    value: "sales",
    code: "SAL",
    sampleSopTitle: "Qualified Lead Handoff",
    sampleRoles: "SDR,Qualifies inbound lead\nAE,Runs discovery and demos\nSales Ops,Logs opportunity in CRM",
    sampleProcess: "1,SDR qualifies lead via BANT,10\n2,SDR books discovery call,5\n3,AE runs discovery,30\n4,AE sends recap and proposal,15\n5,Sales Ops creates opportunity,5",
    sampleTools: "Salesforce\nOutreach\nZoom",
  },
  {
    label: "Marketing",
    value: "marketing",
    code: "MKT",
    sampleSopTitle: "Blog Post Publication",
    sampleRoles: "Writer,Drafts the post\nEditor,Reviews and edits\nSEO Lead,Publishes and submits to Search Console",
    sampleProcess: "1,Writer briefs topic,15\n2,Writer drafts post,120\n3,Editor reviews and returns,30\n4,Writer applies edits,45\n5,SEO Lead publishes live,15",
    sampleTools: "WordPress\nGoogle Docs\nAhrefs",
  },
  {
    label: "IT",
    value: "it",
    code: "IT",
    sampleSopTitle: "Employee Offboarding",
    sampleRoles: "Manager,Submits offboarding request\nIT Admin,Revokes access and reclaims hardware\nHR,Conducts exit interview",
    sampleProcess: "1,Manager submits ticket,5\n2,IT disables SSO accounts,10\n3,IT reclaims laptop,15\n4,HR schedules exit interview,10\n5,HR collects final paperwork,20",
    sampleTools: "Okta\nServiceNow\nAsset database",
  },
  {
    label: "Legal",
    value: "legal",
    code: "LGL",
    sampleSopTitle: "Contract Review & Approval",
    sampleRoles: "Requestor,Submits draft contract\nLegal Counsel,Reviews terms\nSignatory,Executes final contract",
    sampleProcess: "1,Requestor uploads contract,5\n2,Legal Counsel reviews for risk,60\n3,Legal redlines and returns,30\n4,Requestor negotiates with counterparty,45\n5,Signatory executes,10",
    sampleTools: "DocuSign\nIronclad\nSharePoint",
  },
];

// ---- Normalization / Parsing ----

/** Normalize a free-text string. */
export function normalizeText(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Split CSV row honoring quoted values (basic). */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

/** Parse roles — `role,responsibility` per line. */
export function parseRoles(text: string): { items: SopRole[]; errors: string[] } {
  const items: SopRole[] = [];
  const errors: string[] = [];
  if (!text || !text.trim()) return { items, errors };

  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;
    const parts = splitCsvRow(line).map((s) => s.trim());
    if (parts.length < 2) {
      errors.push(`Line ${idx + 1}: needs role,responsibility`);
      return;
    }
    const [role, responsibility = ""] = parts;
    if (!role) {
      errors.push(`Line ${idx + 1}: role is required`);
      return;
    }
    items.push({ role, responsibility: normalizeText(responsibility) });
  });
  return { items, errors };
}

/** Parse process steps — `step_number,action,duration_minutes` per line. */
export function parseProcessSteps(text: string): { items: SopProcessStep[]; errors: string[] } {
  const items: SopProcessStep[] = [];
  const errors: string[] = [];
  if (!text || !text.trim()) return { items, errors };

  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;
    const parts = splitCsvRow(line).map((s) => s.trim());
    if (parts.length < 2) {
      errors.push(`Line ${idx + 1}: needs step_number,action[,duration_minutes]`);
      return;
    }
    const [stepStr, action, durationStr = "0"] = parts;
    if (!action) {
      errors.push(`Line ${idx + 1}: action is required`);
      return;
    }
    let stepNumber = Number(stepStr);
    if (!Number.isFinite(stepNumber) || stepNumber < 0) stepNumber = idx + 1;
    const durationMinutes = Number(durationStr);
    if (!Number.isFinite(durationMinutes) || durationMinutes < 0) {
      errors.push(`Line ${idx + 1}: invalid duration "${durationStr}"`);
      return;
    }
    items.push({
      stepNumber: Math.floor(stepNumber) || idx + 1,
      action: normalizeText(action),
      durationMinutes,
    });
  });
  return { items, errors };
}

/** Parse tools — one per line. */
export function parseTools(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((s) => normalizeText(s))
    .filter(Boolean);
}

/** Parse references — one per line. */
export function parseReferences(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((s) => normalizeText(s))
    .filter(Boolean);
}

/** Parse troubleshooting — `issue,solution` per line. */
export function parseTroubleshooting(text: string): { items: SopTroubleshooting[]; errors: string[] } {
  const items: SopTroubleshooting[] = [];
  const errors: string[] = [];
  if (!text || !text.trim()) return { items, errors };

  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;
    const parts = splitCsvRow(line).map((s) => s.trim());
    if (parts.length < 2) {
      errors.push(`Line ${idx + 1}: needs issue,solution`);
      return;
    }
    const [issue, solution = ""] = parts;
    if (!issue) {
      errors.push(`Line ${idx + 1}: issue is required`);
      return;
    }
    items.push({ issue, solution: normalizeText(solution) });
  });
  return { items, errors };
}

// ---- Date helpers ----

/** Parse YYYY-MM-DD into a UTC Date. Returns null on invalid input. */
export function parseDateYMD(s: string): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  // Reject rolled-over dates (e.g. 2026-02-30 → March 2)
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
}

/** Format a Date as YYYY-MM-DD using UTC. */
export function formatDateYMD(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Calculate next review date = last reviewed + 1 year (YYYY-MM-DD). "" if invalid. */
export function calculateNextReviewDate(lastReviewedDate: string): string {
  const d = parseDateYMD(lastReviewedDate);
  if (!d) return "";
  const next = new Date(d.getTime());
  next.setUTCFullYear(next.getUTCFullYear() + 1);
  // Feb 29 → Feb 28 in non-leap years is acceptable for SOP review cadence.
  return formatDateYMD(next);
}

// ---- Duration helpers ----

/** Sum durations of process steps. */
export function calculateTotalProcessDuration(steps: SopProcessStep[]): number {
  return steps.reduce((s, st) => s + st.durationMinutes, 0);
}

/** Format minutes as "1h 30m", "45m", or "2h". */
export function formatDuration(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return "0m";
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ---- SOP ID suggestion ----

/** Look up the 3-letter department code for a department name. */
export function departmentCode(department: string): string {
  const n = normalizeText(department).toLowerCase();
  const preset = DEPARTMENT_PRESETS.find(
    (p) => p.label.toLowerCase() === n || p.value.toLowerCase() === n,
  );
  if (preset) return preset.code;
  // Fallback: first 3 uppercase letters of the department name
  const letters = (department || "GEN").replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase();
  return letters.padEnd(3, "X");
}

/** Suggest an SOP ID like "SOP-2026-ENG-001". */
export function suggestSopId(department: string, sequence: number): string {
  const code = departmentCode(department);
  const year = new Date().getUTCFullYear();
  const seq = Math.max(1, Math.floor(sequence || 1));
  return `SOP-${year}-${code}-${String(seq).padStart(3, "0")}`;
}

// ---- Validation ----

/** Validate required fields. Returns a list of human-readable errors. */
export function validateSop(input: SopInput, steps: SopProcessStep[]): string[] {
  const errors: string[] = [];
  if (!normalizeText(input.sopTitle)) errors.push("SOP title is required");
  if (!normalizeText(input.purpose)) errors.push("Purpose is required");
  if (steps.length === 0) errors.push("At least one process step is required");
  if (input.lastReviewedDate && !parseDateYMD(input.lastReviewedDate)) {
    errors.push("Last reviewed date is not a valid YYYY-MM-DD date");
  }
  if (input.nextReviewDate && !parseDateYMD(input.nextReviewDate)) {
    errors.push("Next review date is not a valid YYYY-MM-DD date");
  }
  return errors;
}

// ---- Summary stats ----

/** Compute summary stats. */
export function summaryStats(
  steps: SopProcessStep[],
  roles: SopRole[],
  tools: string[],
  troubleshooting: SopTroubleshooting[],
  references: string[],
): SopStats {
  return {
    stepCount: steps.length,
    totalDurationMinutes: calculateTotalProcessDuration(steps),
    roleCount: roles.length,
    toolCount: tools.length,
    troubleshootingCount: troubleshooting.length,
    referenceCount: references.length,
  };
}

// ---- Renderers ----

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const HR = "=".repeat(60);
const SUB = "-".repeat(60);

/** Render the SOP as plain text. */
export function renderText(
  input: SopInput,
  steps: SopProcessStep[],
  roles: SopRole[],
  tools: string[],
  troubleshooting: SopTroubleshooting[],
  references: string[],
  stats: SopStats,
): string {
  const L: string[] = [];
  L.push(HR);
  L.push("STANDARD OPERATING PROCEDURE");
  L.push(HR);
  L.push("");
  L.push(`Title:       ${input.sopTitle || "(untitled)"}`);
  if (input.sopId) L.push(`SOP ID:      ${input.sopId}`);
  if (input.version) L.push(`Version:     ${input.version}`);
  if (input.department) L.push(`Department:  ${input.department}`);
  if (input.lastReviewedDate) L.push(`Last Reviewed: ${input.lastReviewedDate}`);
  if (input.nextReviewDate) L.push(`Next Review:   ${input.nextReviewDate}`);
  L.push("");
  L.push(SUB);
  L.push("1. PURPOSE");
  L.push(SUB);
  L.push(input.purpose || "(not specified)");
  L.push("");
  if (input.scope) {
    L.push(SUB);
    L.push("2. SCOPE");
    L.push(SUB);
    L.push(input.scope);
    L.push("");
  }
  if (roles.length > 0) {
    L.push(SUB);
    L.push("3. ROLES & RESPONSIBILITIES");
    L.push(SUB);
    roles.forEach((r, i) => {
      L.push(`${i + 1}. ${r.role}`);
      L.push(`   ${r.responsibility || "—"}`);
    });
    L.push("");
  }
  L.push(SUB);
  L.push("4. PROCESS");
  L.push(SUB);
  if (steps.length === 0) {
    L.push("  (no process steps)");
  } else {
    steps.forEach((s) => {
      L.push(`Step ${s.stepNumber}: ${s.action}  [${formatDuration(s.durationMinutes)}]`);
    });
  }
  L.push("");
  L.push(`Total process duration: ${formatDuration(stats.totalDurationMinutes)} (${stats.totalDurationMinutes} min)`);
  L.push("");
  if (tools.length > 0) {
    L.push(SUB);
    L.push("5. TOOLS & RESOURCES");
    L.push(SUB);
    tools.forEach((t, i) => L.push(`${i + 1}. ${t}`));
    L.push("");
  }
  if (troubleshooting.length > 0) {
    L.push(SUB);
    L.push("6. TROUBLESHOOTING");
    L.push(SUB);
    troubleshooting.forEach((t, i) => {
      L.push(`${i + 1}. Issue: ${t.issue}`);
      L.push(`   Solution: ${t.solution || "—"}`);
    });
    L.push("");
  }
  if (references.length > 0) {
    L.push(SUB);
    L.push("7. REFERENCES");
    L.push(SUB);
    references.forEach((r, i) => L.push(`${i + 1}. ${r}`));
    L.push("");
  }
  L.push(HR);
  L.push(`Summary — ${stats.stepCount} step(s) · ${stats.totalDurationMinutes} min total · ${stats.roleCount} role(s) · ${stats.toolCount} tool(s)`);
  L.push(HR);
  return L.join("\n");
}

/** Render the SOP as Markdown. */
export function renderMarkdown(
  input: SopInput,
  steps: SopProcessStep[],
  roles: SopRole[],
  tools: string[],
  troubleshooting: SopTroubleshooting[],
  references: string[],
  stats: SopStats,
): string {
  const L: string[] = [];
  L.push(`# ${input.sopTitle || "Standard Operating Procedure"}`);
  L.push("");
  if (input.sopId) L.push(`- **SOP ID:** ${input.sopId}`);
  if (input.version) L.push(`- **Version:** ${input.version}`);
  if (input.department) L.push(`- **Department:** ${input.department}`);
  if (input.lastReviewedDate) L.push(`- **Last Reviewed:** ${input.lastReviewedDate}`);
  if (input.nextReviewDate) L.push(`- **Next Review:** ${input.nextReviewDate}`);
  L.push("");
  L.push("## 1. Purpose");
  L.push("");
  L.push(input.purpose || "_(not specified)_");
  L.push("");
  if (input.scope) {
    L.push("## 2. Scope");
    L.push("");
    L.push(input.scope);
    L.push("");
  }
  if (roles.length > 0) {
    L.push("## 3. Roles & Responsibilities");
    L.push("");
    L.push("| # | Role | Responsibility |");
    L.push("|---|------|----------------|");
    roles.forEach((r, i) => {
      L.push(`| ${i + 1} | ${r.role} | ${r.responsibility} |`);
    });
    L.push("");
  }
  L.push("## 4. Process");
  L.push("");
  if (steps.length === 0) {
    L.push("_(no process steps)_");
  } else {
    L.push("| Step | Action | Duration |");
    L.push("|------|--------|----------|");
    steps.forEach((s) => {
      L.push(`| ${s.stepNumber} | ${s.action} | ${formatDuration(s.durationMinutes)} |`);
    });
  }
  L.push("");
  L.push(`> **Total process duration:** ${formatDuration(stats.totalDurationMinutes)} (${stats.totalDurationMinutes} min)`);
  L.push("");
  if (tools.length > 0) {
    L.push("## 5. Tools & Resources");
    L.push("");
    tools.forEach((t) => L.push(`- ${t}`));
    L.push("");
  }
  if (troubleshooting.length > 0) {
    L.push("## 6. Troubleshooting");
    L.push("");
    L.push("| # | Issue | Solution |");
    L.push("|---|-------|----------|");
    troubleshooting.forEach((t, i) => {
      L.push(`| ${i + 1} | ${t.issue} | ${t.solution} |`);
    });
    L.push("");
  }
  if (references.length > 0) {
    L.push("## 7. References");
    L.push("");
    references.forEach((r) => L.push(`- ${r}`));
    L.push("");
  }
  L.push("---");
  L.push(`*Summary: ${stats.stepCount} step(s) · ${stats.totalDurationMinutes} min total · ${stats.roleCount} role(s) · ${stats.toolCount} tool(s)*`);
  return L.join("\n");
}

/** Render the SOP as printable HTML with inline CSS. */
export function renderHtml(
  input: SopInput,
  steps: SopProcessStep[],
  roles: SopRole[],
  tools: string[],
  troubleshooting: SopTroubleshooting[],
  references: string[],
  stats: SopStats,
): string {
  const esc = escapeHtml;
  const stepRows = steps
    .map(
      (s) =>
        `<tr><td style="text-align:center">${s.stepNumber}</td><td>${esc(s.action)}</td><td style="text-align:right">${formatDuration(s.durationMinutes)}</td></tr>`,
    )
    .join("");
  const roleRows = roles
    .map(
      (r, i) =>
        `<tr><td style="text-align:center">${i + 1}</td><td><strong>${esc(r.role)}</strong></td><td>${esc(r.responsibility)}</td></tr>`,
    )
    .join("");
  const toolList = tools.map((t) => `<li>${esc(t)}</li>`).join("");
  const refList = references.map((r) => `<li>${esc(r)}</li>`).join("");
  const troubleRows = troubleshooting
    .map(
      (t, i) =>
        `<tr><td style="text-align:center">${i + 1}</td><td><strong>${esc(t.issue)}</strong></td><td>${esc(t.solution)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(input.sopTitle || "Standard Operating Procedure")}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;margin:40px;max-width:860px}
  h1{font-size:24px;margin:0 0 4px;color:#111}
  h2{font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:#555;margin:20px 0 8px;border-bottom:1px solid #eee;padding-bottom:4px}
  .muted{color:#666;font-size:13px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin:16px 0;font-size:14px}
  .meta div{padding:2px 0}
  .meta strong{display:inline-block;min-width:120px;color:#555}
  ul{margin:0;padding-left:20px;font-size:13px}
  table{width:100%;border-collapse:collapse;margin:8px 0}
  th,td{padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;text-align:left}
  th{background:#f5f5f5;text-transform:uppercase;font-size:11px;letter-spacing:.03em;color:#666}
  .summary{margin-top:20px;padding:10px 14px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;font-size:13px;color:#075985}
  .purpose{font-size:14px;line-height:1.55;margin:6px 0}
  @media print{body{margin:12mm}}
</style></head><body>
<h1>${esc(input.sopTitle || "Standard Operating Procedure")}</h1>
<div class="muted">Standard Operating Procedure</div>
<div class="meta">
  ${input.sopId ? `<div><strong>SOP ID:</strong> ${esc(input.sopId)}</div>` : ""}
  ${input.version ? `<div><strong>Version:</strong> ${esc(input.version)}</div>` : ""}
  ${input.department ? `<div><strong>Department:</strong> ${esc(input.department)}</div>` : ""}
  ${input.lastReviewedDate ? `<div><strong>Last Reviewed:</strong> ${esc(input.lastReviewedDate)}</div>` : ""}
  ${input.nextReviewDate ? `<div><strong>Next Review:</strong> ${esc(input.nextReviewDate)}</div>` : ""}
</div>
<h2>1. Purpose</h2>
<p class="purpose">${esc(input.purpose || "(not specified)")}</p>
${input.scope ? `<h2>2. Scope</h2><p class="purpose">${esc(input.scope)}</p>` : ""}
${roles.length > 0 ? `<h2>3. Roles &amp; Responsibilities</h2><table><thead><tr><th>#</th><th>Role</th><th>Responsibility</th></tr></thead><tbody>${roleRows}</tbody></table>` : ""}
<h2>${roles.length > 0 ? "4" : input.scope ? "3" : "2"}. Process</h2>
<table>
  <thead><tr><th style="text-align:center">Step</th><th>Action</th><th style="text-align:right">Duration</th></tr></thead>
  <tbody>${stepRows || `<tr><td colspan="3" style="text-align:center;color:#999">No process steps</td></tr>`}</tbody>
</table>
<div class="muted">Total process duration: ${formatDuration(stats.totalDurationMinutes)} (${stats.totalDurationMinutes} min)</div>
${tools.length > 0 ? `<h2>5. Tools &amp; Resources</h2><ul>${toolList}</ul>` : ""}
${troubleshooting.length > 0 ? `<h2>6. Troubleshooting</h2><table><thead><tr><th>#</th><th>Issue</th><th>Solution</th></tr></thead><tbody>${troubleRows}</tbody></table>` : ""}
${references.length > 0 ? `<h2>7. References</h2><ul>${refList}</ul>` : ""}
<div class="summary"><strong>Summary:</strong> ${stats.stepCount} step(s) · ${formatDuration(stats.totalDurationMinutes)} total · ${stats.roleCount} role(s) · ${stats.toolCount} tool(s)</div>
</body></html>`;
}

/** Render a one-page quick reference card (text) — process steps only. */
export function renderQuickReferenceCard(
  input: SopInput,
  steps: SopProcessStep[],
  stats: SopStats,
): string {
  const L: string[] = [];
  L.push(HR);
  L.push("SOP QUICK REFERENCE CARD");
  L.push(HR);
  L.push("");
  L.push(`Title: ${input.sopTitle || "(untitled)"}`);
  if (input.sopId) L.push(`ID:    ${input.sopId}`);
  if (input.department) L.push(`Dept:  ${input.department}`);
  L.push("");
  L.push(SUB);
  L.push("PROCESS AT A GLANCE");
  L.push(SUB);
  if (steps.length === 0) {
    L.push("  (no process steps)");
  } else {
    steps.forEach((s) => {
      L.push(`  ${s.stepNumber}. ${s.action}  [${formatDuration(s.durationMinutes)}]`);
    });
  }
  L.push(SUB);
  L.push(`Total: ${formatDuration(stats.totalDurationMinutes)}  ·  ${stats.stepCount} step(s)`);
  L.push(HR);
  return L.join("\n");
}

/** Render a one-page quick reference card as printable HTML. */
export function renderQuickReferenceCardHtml(
  input: SopInput,
  steps: SopProcessStep[],
  stats: SopStats,
): string {
  const esc = escapeHtml;
  const stepItems = steps
    .map(
      (s) =>
        `<li><span class="num">${s.stepNumber}</span><span class="act">${esc(s.action)}</span><span class="dur">${formatDuration(s.durationMinutes)}</span></li>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Quick Reference — ${esc(input.sopTitle || "SOP")}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;margin:32px;max-width:760px}
  h1{font-size:20px;margin:0 0 4px;color:#111}
  .muted{color:#666;font-size:12px}
  .meta{margin:8px 0 14px;font-size:13px}
  .meta strong{display:inline-block;min-width:60px;color:#555}
  ol{list-style:none;padding:0;margin:0;counter-reset:none}
  li{display:flex;align-items:baseline;gap:10px;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px}
  .num{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#1e3a8a;color:#fff;font-size:11px;font-weight:700;flex-shrink:0}
  .act{flex:1}
  .dur{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#666;font-size:12px}
  .total{margin-top:12px;padding:8px 12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;font-size:13px;color:#075985}
  @media print{body{margin:10mm}}
</style></head><body>
<h1>SOP Quick Reference</h1>
<div class="muted">${esc(input.sopTitle || "(untitled)")}</div>
<div class="meta">
  ${input.sopId ? `<div><strong>ID:</strong> ${esc(input.sopId)}</div>` : ""}
  ${input.department ? `<div><strong>Dept:</strong> ${esc(input.department)}</div>` : ""}
  ${input.version ? `<div><strong>Ver:</strong> ${esc(input.version)}</div>` : ""}
</div>
<ol>${stepItems || `<li style="border:none;color:#999">No process steps</li>`}</ol>
<div class="total"><strong>Total:</strong> ${formatDuration(stats.totalDurationMinutes)} · ${stats.stepCount} step(s)</div>
</body></html>`;
}

/** Render the SOP as CSV: step_number,action,duration_minutes. */
export function renderCsv(steps: SopProcessStep[]): string {
  const lines = ["step_number,action,duration_minutes"];
  for (const s of steps) {
    lines.push(
      [
        String(s.stepNumber),
        escapeCsv(s.action),
        String(s.durationMinutes),
      ].join(","),
    );
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:sop-generator:history";
const HISTORY_MAX = 20;

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---- Shareable URL ----

export function buildShareUrl(input: Partial<SopInput>): string {
  const params = new URLSearchParams();
  if (input.sopTitle) params.set("title", input.sopTitle);
  if (input.sopId) params.set("id", input.sopId);
  if (input.version) params.set("ver", input.version);
  if (input.department) params.set("dept", input.department);
  if (input.lastReviewedDate) params.set("last", input.lastReviewedDate);
  if (input.nextReviewDate) params.set("next", input.nextReviewDate);
  if (input.purpose) params.set("purpose", input.purpose);
  if (input.scope) params.set("scope", input.scope);
  if (input.roles) params.set("roles", input.roles);
  if (input.process) params.set("process", input.process);
  if (input.tools) params.set("tools", input.tools);
  if (input.troubleshooting) params.set("trouble", input.troubleshooting);
  if (input.references) params.set("refs", input.references);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<SopInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<SopInput> = {};
  if (params.get("title")) out.sopTitle = params.get("title")!;
  if (params.get("id")) out.sopId = params.get("id")!;
  if (params.get("ver")) out.version = params.get("ver")!;
  if (params.get("dept")) out.department = params.get("dept")!;
  if (params.get("last")) out.lastReviewedDate = params.get("last")!;
  if (params.get("next")) out.nextReviewDate = params.get("next")!;
  if (params.get("purpose")) out.purpose = params.get("purpose")!;
  if (params.get("scope")) out.scope = params.get("scope")!;
  if (params.get("roles")) out.roles = params.get("roles")!;
  if (params.get("process")) out.process = params.get("process")!;
  if (params.get("tools")) out.tools = params.get("tools")!;
  if (params.get("trouble")) out.troubleshooting = params.get("trouble")!;
  if (params.get("refs")) out.references = params.get("refs")!;
  return out;
}
