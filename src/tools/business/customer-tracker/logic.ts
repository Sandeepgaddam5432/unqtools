/**
 * Customer Tracker — pure logic.
 *
 * Track customers and follow-ups: parse customer rows, validate email + phone,
 * compute days since last contact, filter by status or overdue follow-ups,
 * total/average value, status breakdown, follow-up priority list.
 * Pure functions only — no DOM, no network.
 */

export type Status =
  | "active"
  | "inactive"
  | "lead"
  | "churned"
  | "prospect";

export type StatusFilter = "all" | Status;

export type Urgency = "urgent" | "normal" | "recent" | "none";

export interface StatusPreset {
  status: Status;
  label: string;
  color: string; // tailwind text color token used by UI
  description: string;
}

export const STATUS_PRESETS: StatusPreset[] = [
  { status: "active",   label: "Active",   color: "text-emerald-600 dark:text-emerald-400", description: "Currently engaged customer" },
  { status: "inactive", label: "Inactive", color: "text-slate-500 dark:text-slate-400",     description: "Customer who has gone quiet" },
  { status: "lead",     label: "Lead",     color: "text-blue-600 dark:text-blue-400",       description: "Prospective customer in pipeline" },
  { status: "churned",  label: "Churned",  color: "text-red-600 dark:text-red-400",         description: "Customer who has stopped doing business" },
  { status: "prospect", label: "Prospect", color: "text-violet-600 dark:text-violet-400",   description: "Early-stage contact not yet a lead" },
];

export const STATUS_LABELS: Record<Status, string> = {
  active: "Active",
  inactive: "Inactive",
  lead: "Lead",
  churned: "Churned",
  prospect: "Prospect",
};

export const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all",      label: "All statuses" },
  { value: "active",   label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "lead",     label: "Lead" },
  { value: "churned",  label: "Churned" },
  { value: "prospect", label: "Prospect" },
];

export interface CurrencyOption {
  code: string;
  symbol: string;
  label: string;
}

export const CURRENCY_PRESETS: CurrencyOption[] = [
  { code: "USD", symbol: "$",  label: "US Dollar ($)" },
  { code: "EUR", symbol: "€",  label: "Euro (€)" },
  { code: "GBP", symbol: "£",  label: "British Pound (£)" },
  { code: "INR", symbol: "₹",  label: "Indian Rupee (₹)" },
  { code: "JPY", symbol: "¥",  label: "Japanese Yen (¥)" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar (A$)" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar (C$)" },
];

export interface Customer {
  name: string;
  email: string;
  phone: string;       // normalized/formatted phone (display as-is if unparseable)
  phoneRaw: string;    // original input phone
  company: string;
  lastContactDate: string; // YYYY-MM-DD or ""
  status: Status;
  value: number;
  lineIndex: number; // 1-based
}

export interface ParsedCustomers {
  customers: Customer[];
  errors: string[];
}

export interface CustomerInput {
  customersText: string;
  statusFilter: StatusFilter;
  daysSinceContact: string; // numeric string, "" = no filter
  currencySymbol: string;
  today: string; // YYYY-MM-DD used for days-since calculation
}

export const DEFAULT_INPUT: CustomerInput = {
  customersText: "",
  statusFilter: "all",
  daysSinceContact: "",
  currencySymbol: "$",
  today: "",
};

export interface StatusBreakdownRow {
  status: Status;
  label: string;
  count: number;
  totalValue: number;
  avgValue: number;
}

export interface CustomerStats {
  totalCustomers: number;
  totalValue: number;
  averageValue: number;
  statusCounts: Record<Status, number>;
  statusValues: Record<Status, number>;
  overdueCount: number;     // customers whose days since last contact >= daysSinceContact threshold
  urgentCount: number;      // > 30 days
  normalCount: number;      // 14-30 days
  recentCount: number;      // < 14 days
  noContactCount: number;   // no last-contact date
  topCustomer: Customer | null;
}

// ---------- Normalization ----------

const STATUS_ALIASES: Record<string, Status> = {
  active: "active",
  "act": "active",
  inactive: "inactive",
  "inact": "inactive",
  lead: "lead",
  "leads": "lead",
  churned: "churned",
  "churn": "churned",
  prospect: "prospect",
  "prospects": "prospect",
  "prospective": "prospect",
};

/** Normalize a status string to a Status enum or null if unknown. */
export function normalizeStatus(s: string): Status | null {
  const lower = (s || "").toLowerCase().trim().replace(/\s+/g, "-");
  if (!lower) return null;
  if (lower in STATUS_ALIASES) return STATUS_ALIASES[lower];
  return null;
}

/** Trim and collapse internal whitespace. */
export function normalizeString(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

// ---------- Email validation ----------

// Basic but practical email regex — local@domain.tld with sane char classes.
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/** Validate an email address (basic regex). */
export function isValidEmail(s: string): boolean {
  if (!s) return false;
  return EMAIL_RE.test(s.trim());
}

// ---------- Phone formatting ----------

/** Extract exactly 10 digits from a string (US-style). */
function extractDigits(s: string): string {
  return (s || "").replace(/\D+/g, "");
}

/**
 * Normalize a phone number to +1-XXX-XXX-XXXX format if it has 10 digits
 * (or 11 digits starting with 1). Otherwise return the original string.
 */
export function formatPhone(s: string): string {
  const raw = (s || "").trim();
  if (!raw) return "";
  const digits = extractDigits(raw);
  if (digits.length === 10) {
    return `+1-${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    const ten = digits.slice(1);
    return `+1-${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6, 10)}`;
  }
  return raw;
}

// ---------- Date validation ----------

/** Validate a date string in YYYY-MM-DD format (strict). */
export function isValidDate(s: string): boolean {
  if (!s) return false;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (mo < 1 || mo > 12) return false;
  if (d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d
  );
}

// ---------- CSV row splitter ----------

/** Split a CSV row, supporting quoted fields with embedded commas. */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(current); current = "";
    } else { current += ch; }
  }
  out.push(current);
  return out;
}

// ---------- Parsing ----------

/**
 * Parse the customers textarea. Collects errors instead of throwing.
 * Format: name,email,phone,company,last_contact_date,status,value
 */
export function parseCustomers(text: string): ParsedCustomers {
  const customers: Customer[] = [];
  const errors: string[] = [];
  if (!text || !text.trim()) return { customers, errors };
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith("#")) continue; // comment
    const lineIndex = i + 1;
    const fields = splitCsvRow(line);
    if (fields.length < 4) {
      errors.push(
        `Line ${lineIndex}: expected at least 4 fields (name,email,phone,company[,last_contact_date,status,value]), got ${fields.length}`,
      );
      continue;
    }
    const name = normalizeString(fields[0]);
    const emailRaw = normalizeString(fields[1]);
    const phoneRaw = normalizeString(fields[2]);
    const company = normalizeString(fields[3]);
    const lastContactDate = (fields[4] ?? "").trim();
    const statusRaw = (fields[5] ?? "").trim();
    const valueStr = (fields[6] ?? "").trim();

    if (!name) {
      errors.push(`Line ${lineIndex}: empty customer name`);
      continue;
    }
    if (!emailRaw) {
      errors.push(`Line ${lineIndex}: empty email for "${name}"`);
      continue;
    }
    if (!isValidEmail(emailRaw)) {
      errors.push(`Line ${lineIndex}: invalid email "${emailRaw}" for "${name}"`);
      // continue — still store the row with the raw email so the user can fix it
    }
    if (!phoneRaw) {
      errors.push(`Line ${lineIndex}: empty phone for "${name}"`);
      continue;
    }

    // Status: default to "lead" if omitted
    let status: Status;
    if (!statusRaw) {
      status = "lead";
    } else {
      const parsed = normalizeStatus(statusRaw);
      if (!parsed) {
        errors.push(
          `Line ${lineIndex}: unknown status "${statusRaw}" for "${name}" (use: active, inactive, lead, churned, prospect)`,
        );
        continue;
      }
      status = parsed;
    }

    // Last contact date: optional, but validate if provided
    if (lastContactDate && !isValidDate(lastContactDate)) {
      errors.push(`Line ${lineIndex}: invalid last-contact date "${lastContactDate}" for "${name}" (use YYYY-MM-DD)`);
      continue;
    }

    // Value: optional, default 0
    let value = 0;
    if (valueStr) {
      const n = Number(valueStr);
      if (!Number.isFinite(n) || n < 0) {
        errors.push(`Line ${lineIndex}: invalid value "${valueStr}" for "${name}"`);
        continue;
      }
      value = n;
    }

    customers.push({
      name,
      email: emailRaw,
      phone: formatPhone(phoneRaw),
      phoneRaw,
      company,
      lastContactDate,
      status,
      value,
      lineIndex,
    });
  }
  return { customers, errors };
}

// ---------- Days since last contact + urgency ----------

/**
 * Days between today and lastContactDate (UTC, integer, floored).
 * Returns null if lastContactDate is empty or invalid.
 * Returns a negative number if lastContactDate is in the future.
 */
export function computeDaysSinceLastContact(today: string, lastContactDate: string): number | null {
  if (!today || !lastContactDate) return null;
  if (!isValidDate(today) || !isValidDate(lastContactDate)) return null;
  const tMs = Date.UTC(
    parseInt(today.slice(0, 4), 10),
    parseInt(today.slice(5, 7), 10) - 1,
    parseInt(today.slice(8, 10), 10),
  );
  const lMs = Date.UTC(
    parseInt(lastContactDate.slice(0, 4), 10),
    parseInt(lastContactDate.slice(5, 7), 10) - 1,
    parseInt(lastContactDate.slice(8, 10), 10),
  );
  return Math.floor((tMs - lMs) / (24 * 60 * 60 * 1000));
}

/**
 * Classify follow-up urgency from days since last contact.
 * - urgent: > 30 days
 * - normal: 14-30 days
 * - recent: < 14 days
 * - none:   no date / future date
 */
export function computeUrgency(days: number | null): Urgency {
  if (days === null || days < 0) return "none";
  if (days > 30) return "urgent";
  if (days >= 14) return "normal";
  return "recent";
}

// ---------- Filtering ----------

/** Filter customers by status. "all" returns the full list. */
export function filterByStatus(customers: Customer[], filter: StatusFilter): Customer[] {
  if (filter === "all") return customers;
  return customers.filter((c) => c.status === filter);
}

/**
 * Filter customers whose days-since-last-contact >= `minDays`.
 * Customers with no last-contact date are always included (they need a contact!).
 */
export function filterByDaysSinceContact(
  customers: Customer[],
  minDays: number,
  today: string,
): Customer[] {
  if (!Number.isFinite(minDays) || minDays <= 0) return customers;
  return customers.filter((c) => {
    if (!c.lastContactDate) return true; // never contacted → overdue
    const days = computeDaysSinceLastContact(today, c.lastContactDate);
    if (days === null) return true;
    return days >= minDays;
  });
}

/** Apply status + days-since filters in one call. */
export function applyFilters(
  customers: Customer[],
  statusFilter: StatusFilter,
  daysSinceContact: string,
  today: string,
): Customer[] {
  const byStatus = filterByStatus(customers, statusFilter);
  const n = Number(daysSinceContact);
  if (daysSinceContact && Number.isFinite(n) && n > 0) {
    return filterByDaysSinceContact(byStatus, n, today);
  }
  return byStatus;
}

// ---------- Calculations ----------

/** Sum of all customer values. */
export function computeTotalValue(customers: Customer[]): number {
  return customers.reduce((s, c) => s + c.value, 0);
}

/** Average customer value across all customers. Returns 0 if list is empty. */
export function computeAverageValue(customers: Customer[]): number {
  if (customers.length === 0) return 0;
  return computeTotalValue(customers) / customers.length;
}

/** Per-status breakdown: count, total value, average value. Returns rows in status order. */
export function computeStatusBreakdown(customers: Customer[]): StatusBreakdownRow[] {
  const rows: StatusBreakdownRow[] = STATUS_PRESETS.map((p) => ({
    status: p.status,
    label: p.label,
    count: 0,
    totalValue: 0,
    avgValue: 0,
  }));
  const byStatus = new Map<Status, StatusBreakdownRow>();
  for (const row of rows) byStatus.set(row.status, row);
  for (const c of customers) {
    const row = byStatus.get(c.status);
    if (!row) continue;
    row.count += 1;
    row.totalValue += c.value;
  }
  for (const row of rows) row.avgValue = row.count > 0 ? row.totalValue / row.count : 0;
  return rows;
}

/**
 * Follow-up priority list — sorted by days since last contact descending
 * (oldest contact first / most overdue first). Customers with no last-contact
 * date come first (most urgent).
 */
export function computeFollowupPriority(
  customers: Customer[],
  today: string,
): { customer: Customer; days: number | null; urgency: Urgency }[] {
  const enriched = customers.map((c) => {
    const days = computeDaysSinceLastContact(today, c.lastContactDate);
    return { customer: c, days, urgency: computeUrgency(days) };
  });
  // Sort: null days (no date) first, then by days descending (most overdue first).
  // Stable sort preserves input order within ties.
  return enriched.sort((a, b) => {
    if (a.days === null && b.days === null) return 0;
    if (a.days === null) return -1;
    if (b.days === null) return 1;
    return b.days - a.days;
  });
}

/** Find customers whose days-since-last-contact >= `minDays` (or no date). */
export function findOverdueCustomers(
  customers: Customer[],
  minDays: number,
  today: string,
): Customer[] {
  return filterByDaysSinceContact(customers, minDays, today);
}

/** Count customers in each urgency tier (based on `today`). */
export function countByUrgency(
  customers: Customer[],
  today: string,
): Record<Urgency, number> {
  const out: Record<Urgency, number> = { urgent: 0, normal: 0, recent: 0, none: 0 };
  for (const c of customers) {
    const days = computeDaysSinceLastContact(today, c.lastContactDate);
    out[computeUrgency(days)] += 1;
  }
  return out;
}

/** Compute all summary stats in one pass. */
export function summaryStats(
  customers: Customer[],
  daysSinceContact: string = "",
  today: string = "",
): CustomerStats {
  const statusCounts: Record<Status, number> = {
    active: 0, inactive: 0, lead: 0, churned: 0, prospect: 0,
  };
  const statusValues: Record<Status, number> = {
    active: 0, inactive: 0, lead: 0, churned: 0, prospect: 0,
  };
  let totalValue = 0;
  const urgency = countByUrgency(customers, today);
  for (const c of customers) {
    statusCounts[c.status] += 1;
    statusValues[c.status] += c.value;
    totalValue += c.value;
  }
  // Overdue count uses the same logic as the filter
  let overdueCount = 0;
  const n = Number(daysSinceContact);
  if (daysSinceContact && Number.isFinite(n) && n > 0) {
    overdueCount = findOverdueCustomers(customers, n, today).length;
  }
  const topCustomer = customers.length > 0
    ? [...customers].sort((a, b) => b.value - a.value)[0] ?? null
    : null;
  return {
    totalCustomers: customers.length,
    totalValue,
    averageValue: customers.length > 0 ? totalValue / customers.length : 0,
    statusCounts,
    statusValues,
    overdueCount,
    urgentCount: urgency.urgent,
    normalCount: urgency.normal,
    recentCount: urgency.recent,
    noContactCount: urgency.none,
    topCustomer,
  };
}

// ---------- Formatting ----------

/** Format a money value with 2 decimals + currency symbol. */
export function formatMoney(amount: number, symbol: string = "$"): string {
  if (!Number.isFinite(amount)) return `${symbol}0.00`;
  return `${symbol}${amount.toFixed(2)}`;
}

/** Format an integer day count with "day" / "days" suffix. */
export function formatDays(days: number | null): string {
  if (days === null) return "—";
  if (days === 1) return "1 day";
  if (days < 0) return `in ${Math.abs(days)} day(s)`;
  return `${days} days`;
}

// ---------- Rendering ----------

/**
 * Render as a plain text customer report grouped by status:
 * summary header, per-status sections (with each customer's details),
 * and a follow-up priority list at the end.
 */
export function renderText(input: CustomerInput, customers: Customer[]): string {
  if (customers.length === 0) return "No customers to report.";
  const symbol = input.currencySymbol || "$";
  const stats = summaryStats(customers, input.daysSinceContact, input.today);
  const breakdown = computeStatusBreakdown(customers);
  const priority = computeFollowupPriority(customers, input.today);
  const lines: string[] = [];

  lines.push("=== Customer Tracker Report ===");
  if (input.statusFilter !== "all") {
    lines.push(`Status filter: ${STATUS_LABELS[input.statusFilter]}`);
  }
  if (input.daysSinceContact) {
    lines.push(`Days-since-contact filter: >= ${input.daysSinceContact} days`);
  }
  lines.push(`Currency: ${symbol}`);
  if (input.today) lines.push(`Today: ${input.today}`);
  lines.push("");

  lines.push("--- Summary ---");
  lines.push(`Total customers:   ${stats.totalCustomers}`);
  lines.push(`Total value:       ${formatMoney(stats.totalValue, symbol)}`);
  lines.push(`Average value:     ${formatMoney(stats.averageValue, symbol)}`);
  if (input.daysSinceContact) {
    lines.push(`Overdue (>= ${input.daysSinceContact}d): ${stats.overdueCount}`);
  }
  lines.push(`Urgent (>30d):     ${stats.urgentCount}`);
  lines.push(`Normal (14-30d):   ${stats.normalCount}`);
  lines.push(`Recent (<14d):     ${stats.recentCount}`);
  lines.push(`No contact date:   ${stats.noContactCount}`);
  if (stats.topCustomer) {
    lines.push(
      `Top customer:      ${stats.topCustomer.name} — ${formatMoney(stats.topCustomer.value, symbol)} [${STATUS_LABELS[stats.topCustomer.status]}]`,
    );
  }
  lines.push("");

  lines.push("--- Status Breakdown ---");
  for (const row of breakdown) {
    lines.push(
      `${row.label.padEnd(10)} ${String(row.count).padStart(3)} customers  total ${formatMoney(row.totalValue, symbol).padStart(12)}  avg ${formatMoney(row.avgValue, symbol).padStart(12)}`,
    );
  }

  lines.push("");
  lines.push("--- Customers by Status ---");
  for (const row of breakdown) {
    if (row.count === 0) continue;
    lines.push("");
    lines.push(`[${row.label}] — ${row.count} customer(s), total ${formatMoney(row.totalValue, symbol)}`);
    for (const c of customers.filter((c) => c.status === row.status)) {
      const days = computeDaysSinceLastContact(input.today, c.lastContactDate);
      const daysStr = input.today ? ` · last ${c.lastContactDate || "—"} · ${formatDays(days)} · ${computeUrgency(days)}` : ` · last ${c.lastContactDate || "—"}`;
      lines.push(
        `  - ${c.name} <${c.email}> · ${c.phone}${c.company ? ` · ${c.company}` : ""} · ${formatMoney(c.value, symbol)}${daysStr}`,
      );
    }
  }

  if (input.today && priority.length > 0) {
    lines.push("");
    lines.push("--- Follow-up Priority (oldest contact first) ---");
    for (const p of priority) {
      const c = p.customer;
      lines.push(
        `  ${formatDays(p.days).padStart(10)}  [${p.urgency.padEnd(7)}]  ${c.name} <${c.email}> · ${STATUS_LABELS[c.status]} · ${formatMoney(c.value, symbol)}`,
      );
    }
  }

  return lines.join("\n");
}

/** Render as CSV (name,email,phone,company,last_contact,status,value,days_since). */
export function renderCsv(customers: Customer[], today: string = ""): string {
  const lines = ["name,email,phone,company,last_contact,status,value,days_since"];
  for (const c of customers) {
    const days = computeDaysSinceLastContact(today, c.lastContactDate);
    const daysStr = days === null ? "" : String(days);
    lines.push([
      escapeCsv(c.name),
      escapeCsv(c.email),
      escapeCsv(c.phone),
      escapeCsv(c.company),
      c.lastContactDate,
      c.status,
      c.value.toFixed(2),
      daysStr,
    ].join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Re-exported for tests
export { escapeCsv as _escapeCsv };

// ---------- History (localStorage) ----------

const HISTORY_KEY = "unqtools:customer-tracker:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  customersText: string;
  customerCount: number;
  totalValue: number;
  averageValue: number;
  overdueCount: number;
  currencySymbol: string;
}

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

// ---------- Shareable URL ----------

const VALID_STATUSES: Status[] = STATUS_PRESETS.map((p) => p.status);
const VALID_FILTERS: StatusFilter[] = ["all", ...VALID_STATUSES];

export function buildShareUrl(input: CustomerInput): string {
  const params = new URLSearchParams();
  if (input.customersText) params.set("customers", input.customersText);
  if (input.statusFilter && input.statusFilter !== "all") params.set("status", input.statusFilter);
  if (input.daysSinceContact) params.set("days", input.daysSinceContact);
  if (input.currencySymbol) params.set("cur", input.currencySymbol);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): CustomerInput {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { ...DEFAULT_INPUT };
  const params = new URLSearchParams(clean);
  const statusRaw = params.get("status");
  const statusFilter: StatusFilter =
    statusRaw && (VALID_FILTERS as string[]).includes(statusRaw)
      ? (statusRaw as StatusFilter)
      : "all";
  const cur = params.get("cur");
  const currencySymbol =
    cur && CURRENCY_PRESETS.some((c) => c.symbol === cur)
      ? cur
      : DEFAULT_INPUT.currencySymbol;
  const days = params.get("days") ?? "";
  return {
    customersText: params.get("customers") ?? "",
    statusFilter,
    daysSinceContact: /^\d+$/.test(days) ? days : "",
    currencySymbol,
    today: "",
  };
}
