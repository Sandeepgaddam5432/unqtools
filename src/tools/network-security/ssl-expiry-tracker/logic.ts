/**
 * SSL Expiry Countdown Tracker — pure logic.
 *
 * Parses certificate dates, computes days remaining, applies warning
 * thresholds (30 / 60 / 90 days), and supports multi-domain batch tracking,
 * sorting, grouping, stats, and CSV export.
 *
 * Pure only — no DOM, no network. The actual cert fetching is performed by
 * the UI layer (or skipped entirely for an offline reference tool).
 */

export type CertStatus = "valid" | "expiring" | "expired" | "unknown";

export interface Thresholds {
  /** Warning when within N days. */
  warn: number;
  /** Critical when within N days. */
  critical: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = { warn: 30, critical: 7 };

export interface CertRecord {
  /** Domain name. */
  domain: string;
  /** ISO 8601 issue date. */
  issuedOn: string;
  /** ISO 8601 expiry date. */
  expiresOn: string;
  /** Certificate issuer (e.g. "Let's Encrypt R3"). */
  issuer?: string;
  /** Optional notes. */
  notes?: string;
}

export interface CertReport {
  record: CertRecord;
  daysRemaining: number;
  status: CertStatus;
  warnings: string[];
  notes: string[];
}

/** Parse an ISO date string into a Date, returning null on failure. Pure. */
export function parseCertDate(input: string): Date | null {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Compute whole days between two dates (b - a), rounded. Pure. */
export function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/** Determine status from days remaining and thresholds. */
export function computeStatus(daysRemaining: number, thresholds: Thresholds): CertStatus {
  if (daysRemaining < 0) return "expired";
  if (daysRemaining <= thresholds.critical) return "expiring";
  if (daysRemaining <= thresholds.warn) return "expiring";
  return "valid";
}

/** Validate a certificate record. */
export function validateRecord(rec: CertRecord): string[] {
  const errs: string[] = [];
  if (!rec.domain || !rec.domain.trim()) errs.push("Missing domain.");
  if (!parseCertDate(rec.issuedOn)) errs.push("Invalid or missing issuedOn date.");
  if (!parseCertDate(rec.expiresOn)) errs.push("Invalid or missing expiresOn date.");
  const issued = parseCertDate(rec.issuedOn);
  const expires = parseCertDate(rec.expiresOn);
  if (issued && expires && expires.getTime() <= issued.getTime()) {
    errs.push("Expiry date must be after issue date.");
  }
  return errs;
}

/** Build a full report for a single certificate. Pure. */
export function buildReport(rec: CertRecord, thresholds: Thresholds = DEFAULT_THRESHOLDS, now: Date = new Date()): CertReport {
  const warnings: string[] = [];
  const notes: string[] = [];
  const errs = validateRecord(rec);
  if (errs.length) {
    return { record: rec, daysRemaining: NaN, status: "unknown", warnings: errs, notes };
  }
  const expires = parseCertDate(rec.expiresOn)!;
  const issued = parseCertDate(rec.issuedOn)!;
  const daysRemaining = daysBetween(now, expires);
  const status = computeStatus(daysRemaining, thresholds);

  if (status === "expired") warnings.push(`Expired ${Math.abs(daysRemaining)} day(s) ago.`);
  else if (status === "expiring" && daysRemaining <= thresholds.critical) {
    warnings.push(`Expires in ${daysRemaining} day(s) — critical.`);
  } else if (status === "expiring") {
    warnings.push(`Expires in ${daysRemaining} day(s) — renew soon.`);
  }

  const totalDays = daysBetween(issued, expires);
  notes.push(`Certificate lifetime: ${totalDays} day(s).`);
  if (rec.issuer) notes.push(`Issued by: ${rec.issuer}.`);

  return { record: rec, daysRemaining, status, warnings, notes };
}

/** Build reports for multiple certificates. */
export function buildBatch(records: CertRecord[], thresholds: Thresholds = DEFAULT_THRESHOLDS, now: Date = new Date()): CertReport[] {
  return records.map((r) => buildReport(r, thresholds, now));
}

export type SortKey = "domain" | "daysRemaining" | "expiresOn" | "status";

/** Sort reports by a key. Pure — returns a new array. */
export function sortReports(reports: CertReport[], key: SortKey, asc = true): CertReport[] {
  const out = [...reports];
  out.sort((a, b) => {
    let cmp = 0;
    if (key === "domain") cmp = a.record.domain.localeCompare(b.record.domain);
    else if (key === "daysRemaining") cmp = (a.daysRemaining || 0) - (b.daysRemaining || 0);
    else if (key === "expiresOn") cmp = (parseCertDate(a.record.expiresOn)?.getTime() ?? 0) - (parseCertDate(b.record.expiresOn)?.getTime() ?? 0);
    else if (key === "status") {
      const order: Record<CertStatus, number> = { expired: 0, expiring: 1, valid: 2, unknown: 3 };
      cmp = order[a.status] - order[b.status];
    }
    return asc ? cmp : -cmp;
  });
  return out;
}

/** Group reports by status. */
export function groupByStatus(reports: CertReport[]): Record<CertStatus, CertReport[]> {
  const groups: Record<CertStatus, CertReport[]> = { valid: [], expiring: [], expired: [], unknown: [] };
  for (const r of reports) groups[r.status].push(r);
  return groups;
}

export interface BatchStats {
  total: number;
  valid: number;
  expiring: number;
  expired: number;
  unknown: number;
  earliestExpiry: string;
  latestExpiry: string;
  avgDaysRemaining: number;
}

/** Summarise a batch of reports. */
export function computeBatchStats(reports: CertReport[]): BatchStats {
  if (reports.length === 0) {
    return { total: 0, valid: 0, expiring: 0, expired: 0, unknown: 0, earliestExpiry: "", latestExpiry: "", avgDaysRemaining: 0 };
  }
  const valid = reports.filter((r) => r.status === "valid").length;
  const expiring = reports.filter((r) => r.status === "expiring").length;
  const expired = reports.filter((r) => r.status === "expired").length;
  const unknown = reports.filter((r) => r.status === "unknown").length;
  const validDates = reports
    .map((r) => parseCertDate(r.record.expiresOn))
    .filter((d): d is Date => d !== null)
    .map((d) => d.getTime());
  const earliest = validDates.length ? new Date(Math.min(...validDates)).toISOString() : "";
  const latest = validDates.length ? new Date(Math.max(...validDates)).toISOString() : "";
  const validDays = reports.filter((r) => !Number.isNaN(r.daysRemaining));
  const avg = validDays.length ? Math.round(validDays.reduce((s, r) => s + r.daysRemaining, 0) / validDays.length) : 0;
  return { total: reports.length, valid, expiring, expired, unknown, earliestExpiry: earliest, latestExpiry: latest, avgDaysRemaining: avg };
}

/** Render a CSV export of all certificates. */
export function renderBatchCsv(reports: CertReport[]): string {
  const lines = ["domain,issued_on,expires_on,issuer,days_remaining,status"];
  for (const r of reports) {
    lines.push([
      r.record.domain, r.record.issuedOn, r.record.expiresOn, r.record.issuer ?? "",
      Number.isNaN(r.daysRemaining) ? "" : String(r.daysRemaining), r.status,
    ].join(","));
  }
  return lines.join("\n");
}

/** Render a plain-text report for a single certificate. */
export function renderReport(r: CertReport): string {
  const lines: string[] = [];
  lines.push("SSL Certificate Expiry Report");
  lines.push("=".repeat(40));
  lines.push(`Domain:        ${r.record.domain}`);
  lines.push(`Issued on:     ${r.record.issuedOn}`);
  lines.push(`Expires on:    ${r.record.expiresOn}`);
  if (r.record.issuer) lines.push(`Issuer:        ${r.record.issuer}`);
  if (Number.isNaN(r.daysRemaining)) {
    lines.push("Days remaining: (unknown)");
  } else {
    lines.push(`Days remaining: ${r.daysRemaining}`);
  }
  lines.push(`Status:        ${r.status}`);
  if (r.warnings.length) { lines.push(""); lines.push("Warnings:"); r.warnings.forEach((w) => lines.push(`  ! ${w}`)); }
  if (r.notes.length) { lines.push(""); lines.push("Notes:"); r.notes.forEach((n) => lines.push(`  • ${n}`)); }
  return lines.join("\n");
}

/** Render a summary dashboard for a batch. */
export function renderBatchSummary(stats: BatchStats): string {
  const lines: string[] = [];
  lines.push("SSL Expiry Batch Summary");
  lines.push("=".repeat(40));
  lines.push(`Total certificates: ${stats.total}`);
  lines.push(`  Valid:    ${stats.valid}`);
  lines.push(`  Expiring: ${stats.expiring}`);
  lines.push(`  Expired:  ${stats.expired}`);
  lines.push(`  Unknown:  ${stats.unknown}`);
  if (stats.earliestExpiry) lines.push(`Earliest expiry: ${stats.earliestExpiry}`);
  if (stats.latestExpiry) lines.push(`Latest expiry:   ${stats.latestExpiry}`);
  lines.push(`Average days remaining: ${stats.avgDaysRemaining}`);
  return lines.join("\n");
}

export const STATUS_COLOR: Record<CertStatus, string> = {
  valid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  expiring: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  expired: "bg-red-500/15 text-red-700 dark:text-red-300",
  unknown: "bg-muted text-muted-foreground",
};

/** Sample records for UI demo / tests. */
export const SAMPLE_RECORDS: CertRecord[] = [
  { domain: "example.com", issuedOn: "2024-01-01", expiresOn: "2025-01-01", issuer: "Let's Encrypt R3" },
  { domain: "api.example.com", issuedOn: "2024-06-01", expiresOn: "2024-12-15", issuer: "DigiCert" },
  { domain: "stale.example.com", issuedOn: "2022-01-01", expiresOn: "2023-01-01", issuer: "Let's Encrypt R3" },
];

export function getSampleRecords() { return [...SAMPLE_RECORDS]; }
