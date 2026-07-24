/**
 * Bulk File Timestamp Changer — pure logic.
 * Note: Browser File System Access API is needed for in-place writes.
 * This module handles the timestamp computation + script generation.
 * UI handles the actual file I/O.
 */

export type TimestampField = "mtime" | "atime" | "ctime" | "all";

export type Mode =
  | { kind: "absolute"; date: string } // YYYY-MM-DDTHH:mm
  | { kind: "relative"; days: number; hours: number; minutes: number }
  | { kind: "touch" } // set to now
  | { kind: "sequence"; startISO: string; incrementMinutes: number }
  | { kind: "random"; fromISO: string; toISO: string }
  | { kind: "filenameRegex"; pattern: string; dateFormat: "YYYY-MM-DD" | "YYYYMMDD" | "DD-MM-YYYY" | "MM-DD-YYYY" };

export interface FileTimestampEntry {
  fileName: string;
  originalMtime: number; // epoch ms
  originalSize: number;
  newMtime?: number;
  warnings: string[];
}

export interface ApplyResult {
  entries: FileTimestampEntry[];
  summary: { total: number; changed: number; unchanged: number; failed: number };
  warnings: string[];
}

const MS_PER_MIN = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MIN;
const MS_PER_DAY = 24 * MS_PER_HOUR;

function parseISOLocal(s: string): number {
  // Accept YYYY-MM-DD or YYYY-MM-DDTHH:mm
  if (!s) return Number.NaN;
  return new Date(s).getTime();
}

export function applyTimestampMode(entries: FileTimestampEntry[], mode: Mode): ApplyResult {
  const result: FileTimestampEntry[] = [];
  let changed = 0;
  let unchanged = 0;
  let failed = 0;
  const warnings: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = { ...entries[i], warnings: [...entries[i].warnings] };
    let newTime: number | undefined;

    switch (mode.kind) {
      case "absolute": {
        newTime = parseISOLocal(mode.date);
        if (Number.isNaN(newTime)) {
          entry.warnings.push("Invalid absolute date");
          failed++;
          result.push(entry);
          continue;
        }
        break;
      }
      case "relative": {
        newTime = entry.originalMtime + mode.days * MS_PER_DAY + mode.hours * MS_PER_HOUR + mode.minutes * MS_PER_MIN;
        break;
      }
      case "touch": {
        newTime = Date.now();
        break;
      }
      case "sequence": {
        const start = parseISOLocal(mode.startISO);
        if (Number.isNaN(start)) {
          entry.warnings.push("Invalid sequence start date");
          failed++;
          result.push(entry);
          continue;
        }
        newTime = start + i * mode.incrementMinutes * MS_PER_MIN;
        break;
      }
      case "random": {
        const from = parseISOLocal(mode.fromISO);
        const to = parseISOLocal(mode.toISO);
        if (Number.isNaN(from) || Number.isNaN(to)) {
          entry.warnings.push("Invalid random range");
          failed++;
          result.push(entry);
          continue;
        }
        newTime = from + Math.random() * (to - from);
        break;
      }
      case "filenameRegex": {
        try {
          const regex = new RegExp(mode.pattern);
          const m = regex.exec(entry.fileName);
          if (!m || !m[1]) {
            entry.warnings.push(`Filename does not match pattern: ${entry.fileName}`);
            failed++;
            result.push(entry);
            continue;
          }
          const dateStr = m[1];
          newTime = parseDateFromFormat(dateStr, mode.dateFormat);
          if (Number.isNaN(newTime)) {
            entry.warnings.push(`Could not parse date "${dateStr}" as ${mode.dateFormat}`);
            failed++;
            result.push(entry);
            continue;
          }
        } catch (e) {
          entry.warnings.push(`Invalid regex: ${(e as Error).message}`);
          failed++;
          result.push(entry);
          continue;
        }
        break;
      }
      default:
        entry.warnings.push(`Unknown mode: ${(mode as { kind: string }).kind}`);
        failed++;
        result.push(entry);
        continue;
    }

    if (newTime !== undefined) {
      if (newTime === entry.originalMtime) {
        unchanged++;
      } else {
        changed++;
      }
      entry.newMtime = newTime;
    }
    result.push(entry);
  }

  return {
    entries: result,
    summary: { total: entries.length, changed, unchanged, failed },
    warnings,
  };
}

function parseDateFromFormat(s: string, format: Mode extends { kind: "filenameRegex" } ? string : string): number {
  // YYYY-MM-DD: 2024-12-25
  // YYYYMMDD: 20241225
  // DD-MM-YYYY: 25-12-2024
  // MM-DD-YYYY: 12-25-2024
  const clean = s.trim();
  if (format === "YYYY-MM-DD") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);
    if (!m) return Number.NaN;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  }
  if (format === "YYYYMMDD") {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(clean);
    if (!m) return Number.NaN;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  }
  if (format === "DD-MM-YYYY") {
    const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(clean);
    if (!m) return Number.NaN;
    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
  }
  if (format === "MM-DD-YYYY") {
    const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(clean);
    if (!m) return Number.NaN;
    return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2])).getTime();
  }
  return Number.NaN;
}

/** Generate PowerShell script to set timestamps. */
export function generatePowerShellScript(entries: FileTimestampEntry[]): string {
  const lines: string[] = [
    "# Bulk timestamp setter — generated by UnQTools",
    "# Run in PowerShell as Administrator for system files.",
    "",
  ];
  for (const e of entries) {
    if (e.newMtime === undefined) continue;
    const d = new Date(e.newMtime);
    const iso = d.toISOString();
    lines.push(`# ${e.fileName}`);
    lines.push(`(Get-Item "${e.fileName}").CreationTime = "${iso}"`);
    lines.push(`(Get-Item "${e.fileName}").LastWriteTime = "${iso}"`);
    lines.push(`(Get-Item "${e.fileName}").LastAccessTime = "${iso}"`);
    lines.push("");
  }
  return lines.join("\n");
}

/** Generate Bash script using touch. */
export function generateBashScript(entries: FileTimestampEntry[]): string {
  const lines: string[] = [
    "#!/usr/bin/env bash",
    "# Bulk timestamp setter — generated by UnQTools",
    "set -euo pipefail",
    "",
  ];
  for (const e of entries) {
    if (e.newMtime === undefined) continue;
    const d = new Date(e.newMtime);
    const yymmddhhmm = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
    lines.push(`touch -t ${yymmddhhmm} "${e.fileName}"`);
  }
  return lines.join("\n");
}

/** Export before/after CSV. */
export function entriesToCsv(entries: FileTimestampEntry[]): string {
  const lines = ["FileName,OriginalMtimeISO,NewMtimeISO,Changed,Size"];
  for (const e of entries) {
    const origISO = new Date(e.originalMtime).toISOString();
    const newISO = e.newMtime ? new Date(e.newMtime).toISOString() : "";
    const changed = e.newMtime !== undefined && e.newMtime !== e.originalMtime ? "yes" : "no";
    lines.push(`"${e.fileName}",${origISO},${newISO},${changed},${e.originalSize}`);
  }
  return lines.join("\n");
}

export function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString();
}
