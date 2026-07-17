/**
 * NAP Citation Consistency Checker — pure logic.
 *
 * Compare business NAP (Name, Address, Phone) across citation sources
 * against a master NAP. Detect inconsistencies, normalize formatting,
 * compute consistency %.
 *
 * Pure functions only — no DOM, no network.
 */

export interface Nap {
  name: string;
  address: string;
  phone: string;
}

export interface Citation {
  source: string;
  nap: Nap;
}

export type FieldKey = "name" | "address" | "phone";

export interface FieldComparison {
  field: FieldKey;
  master: string;
  citation: string;
  masterNormalized: string;
  citationNormalized: string;
  match: boolean;
}

export interface CitationComparison {
  source: string;
  fields: Record<FieldKey, FieldComparison>;
  allMatch: boolean;
  mismatchCount: number;
}

export interface ConsistencyStats {
  totalCitations: number;
  fullyConsistent: number;
  partiallyConsistent: number;
  consistencyPercentage: number;
  issuesByField: Record<FieldKey, number>;
  totalIssues: number;
}

export interface AnalysisResult {
  comparisons: CitationComparison[];
  stats: ConsistencyStats;
  recommendations: string[];
}

/** Normalize a business name: trim, lowercase, collapse spaces, strip punctuation. */
export function normalizeName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[.,&'"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize an address: trim, lowercase, expand abbreviations, strip punctuation. */
export function normalizeAddress(address: string): string {
  if (!address) return "";
  let s = address.toLowerCase().trim();
  // Common abbreviations
  s = s.replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bboulevard\b/g, "blvd")
    .replace(/\broad\b/g, "rd")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\blane\b/g, "ln")
    .replace(/\bcourt\b/g, "ct")
    .replace(/\bapartment\b/g, "apt")
    .replace(/\bsuite\b/g, "ste")
    .replace(/\bnorth\b/g, "n")
    .replace(/\bsouth\b/g, "s")
    .replace(/\beast\b/g, "e")
    .replace(/\bwest\b/g, "w");
  // Strip punctuation except # and / (apartment/suite indicators)
  s = s.replace(/[.,]/g, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** Normalize a phone number: strip all non-digit characters, keep last 10. */
export function normalizePhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  // Keep last 10 (strip leading 1 country code)
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/** Normalize a NAP. */
export function normalizeNap(nap: Nap): Nap {
  return {
    name: normalizeName(nap.name),
    address: normalizeAddress(nap.address),
    phone: normalizePhone(nap.phone),
  };
}

/** Compare a single field between master and citation. */
export function compareField(
  field: FieldKey,
  master: string,
  citation: string,
): FieldComparison {
  const masterNormalized =
    field === "name" ? normalizeName(master)
      : field === "address" ? normalizeAddress(master)
        : normalizePhone(master);
  const citationNormalized =
    field === "name" ? normalizeName(citation)
      : field === "address" ? normalizeAddress(citation)
        : normalizePhone(citation);
  return {
    field,
    master,
    citation,
    masterNormalized,
    citationNormalized,
    match: masterNormalized === citationNormalized,
  };
}

/** Compare a full citation against the master NAP. */
export function compareCitation(master: Nap, citation: Citation): CitationComparison {
  const fields: Record<FieldKey, FieldComparison> = {
    name: compareField("name", master.name, citation.nap.name),
    address: compareField("address", master.address, citation.nap.address),
    phone: compareField("phone", master.phone, citation.nap.phone),
  };
  const mismatchCount = Object.values(fields).filter((f) => !f.match).length;
  return {
    source: citation.source,
    fields,
    allMatch: mismatchCount === 0,
    mismatchCount,
  };
}

/** Run the full consistency analysis. */
export function analyze(master: Nap, citations: Citation[]): AnalysisResult {
  const comparisons = citations.map((c) => compareCitation(master, c));
  const totalCitations = citations.length;
  const fullyConsistent = comparisons.filter((c) => c.allMatch).length;
  const partiallyConsistent = totalCitations - fullyConsistent;
  const consistencyPercentage = totalCitations === 0 ? 0 : (fullyConsistent / totalCitations) * 100;

  const issuesByField: Record<FieldKey, number> = { name: 0, address: 0, phone: 0 };
  for (const c of comparisons) {
    for (const field of Object.keys(c.fields) as FieldKey[]) {
      if (!c.fields[field].match) issuesByField[field]++;
    }
  }
  const totalIssues = Object.values(issuesByField).reduce((a, b) => a + b, 0);

  const stats: ConsistencyStats = {
    totalCitations,
    fullyConsistent,
    partiallyConsistent,
    consistencyPercentage,
    issuesByField,
    totalIssues,
  };

  const recommendations: string[] = [];
  if (totalCitations === 0) {
    recommendations.push("Add citation sources to compare against your master NAP.");
  } else {
    if (consistencyPercentage === 100) {
      recommendations.push("Perfect NAP consistency — all citations match the master.");
    } else if (consistencyPercentage >= 80) {
      recommendations.push(`Good consistency (${consistencyPercentage.toFixed(1)}%). Fix the remaining mismatches to reach 100%.`);
    } else if (consistencyPercentage >= 50) {
      recommendations.push(`Moderate consistency (${consistencyPercentage.toFixed(1)}%). NAP inconsistencies hurt local SEO — prioritize fixing the most authoritative citations first.`);
    } else {
      recommendations.push(`Poor consistency (${consistencyPercentage.toFixed(1)}%). This is significantly hurting your local search visibility. Standardize your master NAP and update all citations.`);
    }
    if (issuesByField.name > 0) {
      recommendations.push(`${issuesByField.name} citation(s) have mismatched business name. Exact name consistency is critical for local pack rankings.`);
    }
    if (issuesByField.address > 0) {
      recommendations.push(`${issuesByField.address} citation(s) have mismatched address. Address inconsistencies confuse Google's local algorithm.`);
    }
    if (issuesByField.phone > 0) {
      recommendations.push(`${issuesByField.phone} citation(s) have mismatched phone. Use a single tracking phone number across all citations.`);
    }
  }

  return { comparisons, stats, recommendations };
}

/** Render analysis as a CSV report. */
export function renderCsv(result: AnalysisResult): string {
  const lines: string[] = ["source,field,master_value,citation_value,match"];
  for (const c of result.comparisons) {
    for (const field of Object.keys(c.fields) as FieldKey[]) {
      const f = c.fields[field];
      lines.push(
        `${escapeCsv(c.source)},${field},${escapeCsv(f.master)},${escapeCsv(f.citation)},${f.match ? "yes" : "no"}`,
      );
    }
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Render a Markdown report. */
export function renderReport(master: Nap, result: AnalysisResult): string {
  const lines: string[] = [];
  lines.push("# NAP Citation Consistency Report");
  lines.push("");
  lines.push("## Master NAP");
  lines.push("");
  lines.push(`- **Name:** ${master.name}`);
  lines.push(`- **Address:** ${master.address}`);
  lines.push(`- **Phone:** ${master.phone}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total citations: ${result.stats.totalCitations}`);
  lines.push(`- Fully consistent: ${result.stats.fullyConsistent}`);
  lines.push(`- Partially consistent: ${result.stats.partiallyConsistent}`);
  lines.push(`- Consistency: ${result.stats.consistencyPercentage.toFixed(1)}%`);
  lines.push(`- Total issues: ${result.stats.totalIssues}`);
  lines.push(`- Name mismatches: ${result.stats.issuesByField.name}`);
  lines.push(`- Address mismatches: ${result.stats.issuesByField.address}`);
  lines.push(`- Phone mismatches: ${result.stats.issuesByField.phone}`);
  lines.push("");
  if (result.comparisons.length > 0) {
    lines.push("## Per-citation comparison");
    lines.push("");
    for (const c of result.comparisons) {
      lines.push(`### ${c.source}`);
      lines.push("");
      lines.push(`- Status: ${c.allMatch ? "✓ Consistent" : "✗ " + c.mismatchCount + " mismatch(es)"}`);
      for (const field of Object.keys(c.fields) as FieldKey[]) {
        const f = c.fields[field];
        const icon = f.match ? "✓" : "✗";
        lines.push(`  - ${icon} **${field}**: master="${f.master}" vs citation="${f.citation}"`);
      }
      lines.push("");
    }
  }
  if (result.recommendations.length > 0) {
    lines.push("## Recommendations");
    lines.push("");
    for (const r of result.recommendations) {
      lines.push(`- ${r}`);
    }
    lines.push("");
  }
  lines.push("---");
  lines.push("_Generated with UnQTools NAP Citation Consistency Checker_");
  return lines.join("\n");
}

/** Google Business Profile reference URL. */
export const GOOGLE_BUSINESS_PROFILE_URL = "https://www.google.com/business/";

// ---- History ----

const HISTORY_KEY = "unqtools:nap-citation-consistency-checker:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  citationCount: number;
  consistencyPct: number;
  issueCount: number;
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

// ---- Shareable URL ----

export interface ShareState {
  master: Nap;
  citations: Citation[];
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  params.set("m_name", state.master.name);
  params.set("m_address", state.master.address);
  params.set("m_phone", state.master.phone);
  for (let i = 0; i < Math.min(state.citations.length, 5); i++) {
    params.set(`c${i}_source`, state.citations[i].source);
    params.set(`c${i}_name`, state.citations[i].nap.name);
    params.set(`c${i}_address`, state.citations[i].nap.address);
    params.set(`c${i}_phone`, state.citations[i].nap.phone);
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareState> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const masterName = params.get("m_name");
  if (!masterName) return {};
  const master: Nap = {
    name: masterName,
    address: params.get("m_address") || "",
    phone: params.get("m_phone") || "",
  };
  const citations: Citation[] = [];
  for (let i = 0; i < 5; i++) {
    const source = params.get(`c${i}_source`);
    if (!source) continue;
    citations.push({
      source,
      nap: {
        name: params.get(`c${i}_name`) || "",
        address: params.get(`c${i}_address`) || "",
        phone: params.get(`c${i}_phone`) || "",
      },
    });
  }
  return { master, citations };
}
