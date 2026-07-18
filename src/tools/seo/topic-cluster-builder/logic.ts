/**
 * Topic Cluster Builder — pure logic.
 *
 * Build topic cluster maps: pillar page + supporting cluster content +
 * subtopics + internal link recommendations. Pure functions only — no DOM,
 * no network. Subtopic generation is deterministic (no AI).
 */

export type AudienceLevel = "beginner" | "intermediate" | "advanced";

export interface ClusterInputs {
  pillarTopic: string;
  clusters: string[];
  targetKeywords: Map<string, string>; // clusterTopic (lowercase) -> keyword
  audienceLevel: AudienceLevel;
}

export interface Subtopic {
  title: string;
  template: string;
}

export interface Cluster {
  topic: string;
  title: string;
  keyword: string;
  wordCount: number;
  subtopics: Subtopic[];
}

export type InternalLinkType =
  | "pillar-to-cluster"
  | "cluster-to-pillar"
  | "cluster-to-cluster";

export interface InternalLink {
  from: string;
  to: string;
  type: InternalLinkType;
}

export interface ClusterMap {
  pillar: string;
  clusters: Cluster[];
  internalLinks: InternalLink[];
}

export interface ContentBrief {
  cluster: string;
  title: string;
  keyword: string;
  wordCount: number;
  headers: { level: 1 | 2 | 3; text: string }[];
}

export interface SummaryStats {
  totalClusters: number;
  totalSubtopics: number;
  totalInternalLinks: number;
  totalWordCount: number;
  audience: AudienceLevel;
}

export interface LinkMatrix {
  nodes: string[];
  matrix: boolean[][];
}

export const AUDIENCE_PRESETS: { value: AudienceLevel; label: string; wordCount: number }[] = [
  { value: "beginner", label: "Beginner", wordCount: 800 },
  { value: "intermediate", label: "Intermediate", wordCount: 1500 },
  { value: "advanced", label: "Advanced", wordCount: 2500 },
];

export const SUBTOPIC_TEMPLATES = [
  "What is <cluster>",
  "How to do <cluster>",
  "<cluster> best practices",
  "<cluster> tools",
  "<cluster> examples",
  "Common <cluster> mistakes",
] as const;

export const AUDIENCE_TEMPLATE_SELECTION: Record<AudienceLevel, number[]> = {
  beginner: [0, 1, 4, 5],     // What is, How to, Examples, Mistakes
  intermediate: [1, 2, 3, 5], // How to, Best practices, Tools, Mistakes
  advanced: [2, 3, 4, 5],     // Best practices, Tools, Examples, Mistakes
};

// ---- Helpers ----

/** Normalize a topic string (collapse whitespace, trim). */
export function normalizeTopic(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Title-case a topic (lowercase rest of each word). */
export function titleCase(s: string): string {
  const n = normalizeTopic(s);
  if (!n) return "";
  return n.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// ---- Parsers ----

/** Parse pillar + cluster topics from raw text. */
export function parsePillarAndClusters(
  pillarTopic: string,
  clusterTopicsText: string,
): { pillar: string; clusters: string[] } {
  const pillar = normalizeTopic(pillarTopic);
  const clusters = (clusterTopicsText || "")
    .split(/[\n,;]+/)
    .map(normalizeTopic)
    .filter(Boolean);
  return { pillar, clusters };
}

/** Parse target keywords CSV: "cluster_topic,keyword" per line. */
export function parseTargetKeywords(csv: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!csv) return out;
  for (const line of csv.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const commaIdx = trimmed.indexOf(",");
    if (commaIdx < 1) continue;
    const cluster = normalizeTopic(trimmed.slice(0, commaIdx));
    const keyword = normalizeTopic(trimmed.slice(commaIdx + 1));
    if (cluster && keyword) out.set(cluster.toLowerCase(), keyword);
  }
  return out;
}

// ---- Cluster title generator ----

/** Generate cluster page title suggestion: "Pillar: Cluster Guide". */
export function generateClusterTitle(pillar: string, cluster: string): string {
  const p = titleCase(pillar);
  const c = titleCase(cluster);
  if (!p || !c) return "";
  return `${p}: ${c} Guide`;
}

// ---- Subtopic generator ----

/** Generate subtopics for a cluster, audience-aware. */
export function generateSubtopics(cluster: string, audience: AudienceLevel): Subtopic[] {
  const c = normalizeTopic(cluster);
  if (!c) return [];
  const indices = AUDIENCE_TEMPLATE_SELECTION[audience];
  return indices.map((i) => {
    const template = SUBTOPIC_TEMPLATES[i];
    const title = template.replace(/<cluster>/g, c);
    return { title, template };
  });
}

// ---- Word count estimator ----

/** Get word count for audience level. */
export function getWordCountForAudience(audience: AudienceLevel): number {
  return AUDIENCE_PRESETS.find((a) => a.value === audience)?.wordCount ?? 1500;
}

// ---- Content brief ----

/** Generate content brief outline for a single cluster. */
export function generateContentBrief(
  pillar: string,
  cluster: string,
  keyword: string,
  audience: AudienceLevel,
): ContentBrief {
  const title = generateClusterTitle(pillar, cluster);
  const subtopics = generateSubtopics(cluster, audience);
  const wordCount = getWordCountForAudience(audience);
  const headers: { level: 1 | 2 | 3; text: string }[] = [
    { level: 1, text: title },
    { level: 2, text: "Introduction" },
    ...subtopics.map((s) => ({ level: 2 as const, text: s.title })),
    { level: 2, text: "Conclusion" },
  ];
  return {
    cluster: normalizeTopic(cluster),
    title,
    keyword,
    wordCount,
    headers,
  };
}

// ---- Internal links ----

/** Generate internal link recommendations. */
export function generateInternalLinks(pillar: string, clusters: string[]): InternalLink[] {
  const out: InternalLink[] = [];
  const p = normalizeTopic(pillar);
  for (const c of clusters) {
    const cn = normalizeTopic(c);
    if (!p || !cn) continue;
    out.push({ from: p, to: cn, type: "pillar-to-cluster" });
    out.push({ from: cn, to: p, type: "cluster-to-pillar" });
  }
  // Cluster ↔ cluster: adjacent pairs (bidirectional)
  for (let i = 0; i < clusters.length - 1; i++) {
    const a = normalizeTopic(clusters[i]);
    const b = normalizeTopic(clusters[i + 1]);
    if (a && b) {
      out.push({ from: a, to: b, type: "cluster-to-cluster" });
      out.push({ from: b, to: a, type: "cluster-to-cluster" });
    }
  }
  return out;
}

/** Build internal link matrix as 2D boolean array (cluster ↔ cluster only). */
export function buildInternalLinkMatrix(clusters: string[]): LinkMatrix {
  const nodes = clusters.map(normalizeTopic).filter(Boolean);
  const matrix: boolean[][] = nodes.map(() => nodes.map(() => false));
  for (let i = 0; i < nodes.length; i++) {
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      if (Math.abs(i - j) === 1) matrix[i][j] = true;
    }
  }
  return { nodes, matrix };
}

// ---- Cluster map + briefs builders ----

/** Build full cluster map. */
export function buildClusterMap(inputs: ClusterInputs): ClusterMap {
  const pillar = normalizeTopic(inputs.pillarTopic);
  const wordCount = getWordCountForAudience(inputs.audienceLevel);
  const clusters: Cluster[] = inputs.clusters
    .map((c) => {
      const cn = normalizeTopic(c);
      if (!cn) return null;
      const keyword = inputs.targetKeywords.get(cn.toLowerCase()) ?? "";
      return {
        topic: cn,
        title: generateClusterTitle(pillar, cn),
        keyword,
        wordCount,
        subtopics: generateSubtopics(cn, inputs.audienceLevel),
      } as Cluster;
    })
    .filter((c): c is Cluster => c !== null);
  const internalLinks = generateInternalLinks(pillar, inputs.clusters);
  return { pillar, clusters, internalLinks };
}

/** Build content briefs for all clusters. */
export function buildContentBriefs(inputs: ClusterInputs): ContentBrief[] {
  const pillar = normalizeTopic(inputs.pillarTopic);
  return inputs.clusters
    .map((c) => {
      const cn = normalizeTopic(c);
      if (!cn) return null;
      const keyword = inputs.targetKeywords.get(cn.toLowerCase()) ?? "";
      return generateContentBrief(pillar, cn, keyword, inputs.audienceLevel);
    })
    .filter((b): b is ContentBrief => b !== null);
}

// ---- Summary stats ----

export function computeSummaryStats(
  map: ClusterMap,
  briefs: ContentBrief[],
  audience: AudienceLevel,
): SummaryStats {
  let totalSubtopics = 0;
  for (const c of map.clusters) totalSubtopics += c.subtopics.length;
  const totalWordCount = briefs.reduce((sum, b) => sum + b.wordCount, 0);
  return {
    totalClusters: map.clusters.length,
    totalSubtopics,
    totalInternalLinks: map.internalLinks.length,
    totalWordCount,
    audience,
  };
}

// ---- Filter ----

export function filterByCluster(map: ClusterMap, cluster: string): ClusterMap {
  if (!cluster) return map;
  const cn = normalizeTopic(cluster).toLowerCase();
  return {
    ...map,
    clusters: map.clusters.filter((c) => c.topic.toLowerCase() === cn),
    internalLinks: map.internalLinks.filter((l) =>
      l.from.toLowerCase() === cn || l.to.toLowerCase() === cn,
    ),
  };
}

// ---- Renderers ----

/** Render cluster map + briefs as plain text. */
export function renderText(map: ClusterMap, briefs: ContentBrief[]): string {
  if (map.clusters.length === 0) return "";
  const lines: string[] = [];
  lines.push(`PILLAR PAGE: ${titleCase(map.pillar)}`);
  lines.push("");
  lines.push("CLUSTERS:");
  for (const c of map.clusters) {
    lines.push(`  - ${c.title}`);
    lines.push(`    Target keyword: ${c.keyword || "(none)"}`);
    lines.push(`    Word count: ${c.wordCount}`);
    lines.push(`    Subtopics:`);
    for (const s of c.subtopics) {
      lines.push(`      * ${s.title}`);
    }
  }
  lines.push("");
  lines.push("INTERNAL LINKS:");
  for (const l of map.internalLinks) {
    lines.push(`  ${l.from} -> ${l.to}  [${l.type}]`);
  }
  lines.push("");
  lines.push("CONTENT BRIEFS:");
  for (const b of briefs) {
    lines.push(`  ## ${b.title}`);
    lines.push(`    Keyword: ${b.keyword || "(none)"} | Word count: ${b.wordCount}`);
    for (const h of b.headers) {
      const prefix = h.level === 1 ? "H1" : h.level === 2 ? "H2" : "H3";
      lines.push(`    ${prefix}: ${h.text}`);
    }
  }
  return lines.join("\n");
}

/** Render cluster + subtopics as CSV. */
export function renderCsv(map: ClusterMap): string {
  const lines = ["cluster,subtopic,title,keyword,word_count"];
  for (const c of map.clusters) {
    if (c.subtopics.length === 0) {
      lines.push([
        escapeCsv(c.topic),
        "",
        escapeCsv(c.title),
        escapeCsv(c.keyword),
        String(c.wordCount),
      ].join(","));
    } else {
      for (const s of c.subtopics) {
        lines.push([
          escapeCsv(c.topic),
          escapeCsv(s.title),
          escapeCsv(c.title),
          escapeCsv(c.keyword),
          String(c.wordCount),
        ].join(","));
      }
    }
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Split CSV row with quoted values. */
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

/** Render the cluster map as pretty JSON. */
export function renderClusterMapJson(map: ClusterMap): string {
  return JSON.stringify({
    pillar: map.pillar,
    clusters: map.clusters.map((c) => ({
      topic: c.topic,
      title: c.title,
      keyword: c.keyword,
      wordCount: c.wordCount,
      subtopics: c.subtopics.map((s) => s.title),
    })),
    internalLinks: map.internalLinks.map((l) => ({
      from: l.from,
      to: l.to,
      type: l.type,
    })),
  }, null, 2);
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:topic-cluster-builder:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  pillar: string;
  clusterCount: number;
  audience: AudienceLevel;
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

export interface ShareInputs {
  pillar: string;
  clusters: string;
  keywords: string;
  audience: AudienceLevel;
}

const VALID_AUDIENCES: AudienceLevel[] = ["beginner", "intermediate", "advanced"];

export function buildShareUrl(inputs: ShareInputs): string {
  const params = new URLSearchParams();
  if (inputs.pillar) params.set("pillar", inputs.pillar);
  if (inputs.clusters) params.set("clusters", inputs.clusters);
  if (inputs.keywords) params.set("kw", inputs.keywords);
  params.set("aud", inputs.audience);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareInputs {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const defaultResult: ShareInputs = {
    pillar: "",
    clusters: "",
    keywords: "",
    audience: "intermediate",
  };
  if (!clean) return defaultResult;
  const params = new URLSearchParams(clean);
  const audParam = params.get("aud") as AudienceLevel | null;
  const audience = audParam && VALID_AUDIENCES.includes(audParam) ? audParam : "intermediate";
  return {
    pillar: params.get("pillar") ?? "",
    clusters: params.get("clusters") ?? "",
    keywords: params.get("kw") ?? "",
    audience,
  };
}
