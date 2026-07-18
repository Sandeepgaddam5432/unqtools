/**
 * Video Schema Generator — pure logic.
 *
 * Generates VideoObject JSON-LD schema markup, with duration conversion,
 * validation, BreadcrumbList companion, Clip + SeekToAction schemas for
 * video chapters. Pure functions only — no DOM, no network.
 */

export type CreatorType = "Person" | "Organization";

export interface VideoInputs {
  videoTitle: string;
  videoDescription: string;
  videoUrl: string;            // content URL or embed URL (auto-detected)
  thumbnailUrl: string;
  uploadDate: string;          // YYYY-MM-DD
  duration: string;            // ISO 8601, HH:MM:SS, MM:SS, or seconds
  contentRating: string;       // optional
  creatorName: string;
  creatorType: CreatorType;
  viewsCount: string;          // optional number (kept as string for form simplicity)
  likesCount: string;          // optional number
  chaptersText: string;        // optional chapters text (0:00 Intro format, one per line)
  includeBreadcrumb: boolean;  // toggle companion BreadcrumbList schema
  breadcrumbItems: string;     // newline-separated breadcrumb labels
  pageUrl: string;             // URL of the page hosting the video (for breadcrumb + seekToAction)
}

export interface Clip {
  name: string;
  startOffset: number;
  endOffset: number;
  url: string;
}

export interface ValidationIssue {
  level: "error" | "warning";
  field: string;
  message: string;
}

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  isValid: boolean;
}

export interface SummaryStats {
  requiredFieldsCount: number;
  requiredFieldsProvided: number;
  optionalFieldsCount: number;
  optionalFieldsProvided: number;
  clipCount: number;
  hasBreadcrumb: boolean;
  hasSeekToAction: boolean;
  validationStatus: "valid" | "warnings" | "errors" | "empty";
  durationIso: string;
}

export interface SchemaResult {
  videoObject: Record<string, unknown>;
  breadcrumb?: Record<string, unknown>;
  clips: Clip[];
  seekToAction?: Record<string, unknown>;
  validation: ValidationResult;
  summary: SummaryStats;
}

// ---- Constants ----

export const CREATOR_TYPES: CreatorType[] = ["Person", "Organization"];

export const REQUIRED_FIELDS = [
  "name", "description", "thumbnailUrl", "uploadDate", "duration",
] as const;

/** Google rich results also requires at least one of contentUrl or embedUrl. */
export const GOOGLE_RICH_RESULT_FIELDS = [
  "name", "description", "thumbnailUrl", "uploadDate", "duration",
  "contentUrl OR embedUrl",
] as const;

export const OPTIONAL_FIELDS = [
  "contentUrl", "embedUrl", "creator", "contentRating",
  "interactionStatistic", "regionsAllowed", "hasPart", "potentialAction",
] as const;

// ---- Normalization ----

export function normalizeInput(s: string): string {
  return (s || "").trim();
}

export function parseInputs(raw: Partial<VideoInputs>): VideoInputs {
  return {
    videoTitle: raw.videoTitle ?? "",
    videoDescription: raw.videoDescription ?? "",
    videoUrl: raw.videoUrl ?? "",
    thumbnailUrl: raw.thumbnailUrl ?? "",
    uploadDate: raw.uploadDate ?? "",
    duration: raw.duration ?? "",
    contentRating: raw.contentRating ?? "",
    creatorName: raw.creatorName ?? "",
    creatorType: raw.creatorType === "Organization" ? "Organization" : "Person",
    viewsCount: raw.viewsCount ?? "",
    likesCount: raw.likesCount ?? "",
    chaptersText: raw.chaptersText ?? "",
    includeBreadcrumb: raw.includeBreadcrumb ?? false,
    breadcrumbItems: raw.breadcrumbItems ?? "",
    pageUrl: raw.pageUrl ?? "",
  };
}

// ---- Duration conversion ----

/** Parse a duration string into total seconds. Returns -1 on invalid. */
export function parseDuration(input: string): number {
  const s = normalizeInput(input);
  if (!s) return -1;

  // Already ISO 8601: PT4M13S, PT1H, PT60S, etc.
  if (/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.test(s)) {
    const m = s.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
    if (!m) return -1;
    const h = parseInt(m[1] ?? "0", 10);
    const min = parseInt(m[2] ?? "0", 10);
    const sec = parseInt(m[3] ?? "0", 10);
    return h * 3600 + min * 60 + sec;
  }

  // HH:MM:SS or MM:SS (validate MM and SS are <= 59)
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
    const parts = s.split(":").map((p) => parseInt(p, 10));
    if (parts.some((n) => Number.isNaN(n))) return -1;
    // validate the MM and SS positions
    if (parts.length === 2) {
      if (parts[1] > 59) return -1;
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3) {
      if (parts[1] > 59 || parts[2] > 59) return -1;
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return -1;
  }

  // Plain seconds
  if (/^\d+$/.test(s)) {
    return parseInt(s, 10);
  }

  return -1;
}

/** Convert seconds to ISO 8601 duration string (PT4M13S). Returns "" if invalid. */
export function durationToIso8601(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  if (seconds === 0) return "PT0S";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  let out = "PT";
  if (h > 0) out += `${h}H`;
  if (m > 0) out += `${m}M`;
  if (s > 0) out += `${s}S`;
  return out;
}

/** Convert any duration input to ISO 8601. Returns "" if invalid. */
export function convertDuration(input: string): string {
  const sec = parseDuration(input);
  if (sec < 0) return "";
  return durationToIso8601(sec);
}

// ---- URL / date validation ----

export function isValidUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidDate(date: string): boolean {
  if (!date) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(date);
  return !Number.isNaN(d.getTime());
}

/** Detect whether a video URL is an embed URL (e.g. youtube.com/embed/...). */
export function isEmbedUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes("/embed/") ||
    lower.includes("player.vimeo.com") ||
    lower.includes("//player.") ||
    lower.includes("youtube-nocookie.com/embed") ||
    lower.includes("youtube.com/embed")
  );
}

// ---- Chapter parsing ----

export interface ParsedChapter {
  raw: string;
  seconds: number;
  label: string;
}

/** Parse `0:00 Intro` lines from chapters text. */
export function parseChapters(text: string): ParsedChapter[] {
  if (!text) return [];
  const lines = text.split(/\n+/);
  const out: ParsedChapter[] = [];
  const re = /^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/;
  for (const line of lines) {
    const m = line.trim().match(re);
    if (!m) continue;
    const raw = m[1];
    const label = m[2].trim();
    const sec = timestampToSeconds(raw);
    if (sec < 0) continue;
    out.push({ raw, seconds: sec, label });
  }
  return out;
}

export function timestampToSeconds(ts: string): number {
  const parts = ts.split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return -1;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return -1;
}

// ---- Schema generation ----

/** Generate Clip schema entries from parsed chapters. */
export function generateClips(
  chapters: ParsedChapter[],
  videoUrl: string,
): Clip[] {
  if (chapters.length === 0) return [];
  const out: Clip[] = [];
  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i];
    const next = chapters[i + 1];
    const endOffset = next ? next.seconds : c.seconds;
    const url = videoUrl
      ? (videoUrl.includes("?") ? `${videoUrl}&t=${c.seconds}` : `${videoUrl}?t=${c.seconds}`)
      : "";
    out.push({
      name: c.label,
      startOffset: c.seconds,
      endOffset,
      url,
    });
  }
  return out;
}

/** Generate SeekToAction potentialAction. */
export function generateSeekToAction(
  chapters: ParsedChapter[],
  pageUrl: string,
): Record<string, unknown> | undefined {
  if (chapters.length < 2) return undefined;
  if (!pageUrl) return undefined;
  const base = pageUrl.includes("?") ? `${pageUrl}&t={seek_to_second_number}` : `${pageUrl}?t={seek_to_second_number}`;
  return {
    "@type": "SeekToAction",
    "target": base,
    "startOffset-input": "required name=seek_to_second_number",
  };
}

/** Generate BreadcrumbList companion schema. */
export function generateBreadcrumbSchema(
  items: string[],
  pageUrl: string,
): Record<string, unknown> | undefined {
  if (items.length === 0) return undefined;
  const base = pageUrl ? new URL(pageUrl).origin : "";
  const itemListElement = items.map((name, i) => ({
    "@type": "ListItem",
    "position": i + 1,
    "name": name,
    "item": `${base}/${i === 0 ? "" : name.toLowerCase().replace(/\s+/g, "-")}`,
  }));
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": itemListElement,
  };
}

/** Generate the main VideoObject JSON-LD schema. */
export function generateVideoObjectSchema(inputs: VideoInputs): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
  };

  if (inputs.videoTitle) schema["name"] = inputs.videoTitle;
  if (inputs.videoDescription) schema["description"] = inputs.videoDescription;
  if (inputs.thumbnailUrl) schema["thumbnailUrl"] = inputs.thumbnailUrl;
  if (inputs.uploadDate) schema["uploadDate"] = inputs.uploadDate;
  const iso = convertDuration(inputs.duration);
  if (iso) schema["duration"] = iso;

  // contentUrl or embedUrl (auto-detect)
  if (inputs.videoUrl) {
    if (isEmbedUrl(inputs.videoUrl)) {
      schema["embedUrl"] = inputs.videoUrl;
    } else {
      schema["contentUrl"] = inputs.videoUrl;
    }
  }

  if (inputs.contentRating) schema["contentRating"] = inputs.contentRating;

  if (inputs.creatorName) {
    schema["creator"] = {
      "@type": inputs.creatorType,
      "name": inputs.creatorName,
    };
  }

  // interactionStatistic: WatchAction with view/like counts
  const stats: Record<string, unknown>[] = [];
  if (inputs.viewsCount) {
    const n = parseInt(inputs.viewsCount, 10);
    if (!Number.isNaN(n)) {
      stats.push({
        "@type": "InteractionCounter",
        "interactionType": "https://schema.org/WatchAction",
        "userInteractionCount": n,
      });
    }
  }
  if (inputs.likesCount) {
    const n = parseInt(inputs.likesCount, 10);
    if (!Number.isNaN(n)) {
      stats.push({
        "@type": "InteractionCounter",
        "interactionType": "https://schema.org/LikeAction",
        "userInteractionCount": n,
      });
    }
  }
  if (stats.length > 0) schema["interactionStatistic"] = stats;

  // Chapters → hasPart (Clip schema)
  const chapters = parseChapters(inputs.chaptersText);
  if (chapters.length > 0) {
    const clips = generateClips(chapters, inputs.videoUrl);
    if (clips.length > 0) {
      schema["hasPart"] = clips.map((c) => ({
        "@type": "Clip",
        "name": c.name,
        "startOffset": c.startOffset,
        "endOffset": c.endOffset,
        "url": c.url,
      }));
    }
  }

  // SeekToAction
  const seekAction = generateSeekToAction(chapters, inputs.pageUrl);
  if (seekAction) schema["potentialAction"] = seekAction;

  return schema;
}

// ---- Validation ----

export function validateSchema(inputs: VideoInputs): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // Required fields
  if (!inputs.videoTitle) errors.push({ level: "error", field: "name", message: "Video title is required." });
  if (!inputs.videoDescription) errors.push({ level: "error", field: "description", message: "Video description is required." });
  if (!inputs.thumbnailUrl) errors.push({ level: "error", field: "thumbnailUrl", message: "Thumbnail URL is required." });
  else if (!isValidUrl(inputs.thumbnailUrl)) errors.push({ level: "error", field: "thumbnailUrl", message: "Thumbnail URL is not a valid HTTP(S) URL." });
  if (!inputs.uploadDate) errors.push({ level: "error", field: "uploadDate", message: "Upload date is required." });
  else if (!isValidDate(inputs.uploadDate)) errors.push({ level: "error", field: "uploadDate", message: "Upload date must be YYYY-MM-DD." });
  if (!inputs.duration) errors.push({ level: "error", field: "duration", message: "Duration is required." });
  else if (parseDuration(inputs.duration) < 0) errors.push({ level: "error", field: "duration", message: "Duration format invalid (use PT4M13S, HH:MM:SS, or seconds)." });

  // contentUrl or embedUrl required for Google rich results
  if (!inputs.videoUrl) {
    warnings.push({ level: "warning", field: "videoUrl", message: "Provide a contentUrl or embedUrl to qualify for Google rich results." });
  } else if (!isValidUrl(inputs.videoUrl)) {
    errors.push({ level: "error", field: "videoUrl", message: "Video URL is not a valid HTTP(S) URL." });
  }

  // Optional: page URL for SeekToAction
  const chapters = parseChapters(inputs.chaptersText);
  if (chapters.length >= 2 && !inputs.pageUrl) {
    warnings.push({ level: "warning", field: "pageUrl", message: "Provide a pageUrl to enable SeekToAction markup for chapters." });
  }
  if (chapters.length > 0) {
    // Validate chapter sequence
    let prev = -1;
    for (const c of chapters) {
      if (c.seconds <= prev) {
        warnings.push({ level: "warning", field: "chaptersText", message: `Chapter "${c.label}" timestamp is not monotonically increasing.` });
      }
      prev = c.seconds;
    }
  }

  // Breadcrumb warning
  if (inputs.includeBreadcrumb && !inputs.breadcrumbItems.trim()) {
    warnings.push({ level: "warning", field: "breadcrumbItems", message: "Breadcrumb toggle is on but no breadcrumb labels provided." });
  }

  // Description too short
  if (inputs.videoDescription && inputs.videoDescription.length < 50) {
    warnings.push({ level: "warning", field: "description", message: "Description is short. Aim for 50+ characters for better rich-result eligibility." });
  }

  return { errors, warnings, isValid: errors.length === 0 };
}

/** Google rich results compliance checker. */
export function checkGoogleRichResultsCompliance(inputs: VideoInputs): {
  compliant: boolean;
  missing: string[];
  present: string[];
} {
  const present: string[] = [];
  const missing: string[] = [];
  if (inputs.videoTitle) present.push("name"); else missing.push("name");
  if (inputs.videoDescription) present.push("description"); else missing.push("description");
  if (inputs.thumbnailUrl) present.push("thumbnailUrl"); else missing.push("thumbnailUrl");
  if (inputs.uploadDate) present.push("uploadDate"); else missing.push("uploadDate");
  const iso = convertDuration(inputs.duration);
  if (iso) present.push("duration"); else missing.push("duration");
  if (inputs.videoUrl) present.push("contentUrl OR embedUrl"); else missing.push("contentUrl OR embedUrl");
  return { compliant: missing.length === 0, missing, present };
}

// ---- Summary stats ----

export function computeSummaryStats(inputs: VideoInputs, result?: SchemaResult): SummaryStats {
  const requiredProvided = REQUIRED_FIELDS.filter((f) => {
    if (f === "duration") return Boolean(convertDuration(inputs.duration));
    if (f === "uploadDate") return isValidDate(inputs.uploadDate);
    if (f === "thumbnailUrl") return isValidUrl(inputs.thumbnailUrl);
    if (f === "name") return Boolean(inputs.videoTitle);
    if (f === "description") return Boolean(inputs.videoDescription);
    return Boolean((inputs as unknown as Record<string, unknown>)[f]);
  }).length;

  const optionalProvided: string[] = [];
  if (inputs.videoUrl) optionalProvided.push("contentUrl/embedUrl");
  if (inputs.creatorName) optionalProvided.push("creator");
  if (inputs.contentRating) optionalProvided.push("contentRating");
  if (inputs.viewsCount || inputs.likesCount) optionalProvided.push("interactionStatistic");
  if (parseChapters(inputs.chaptersText).length > 0) optionalProvided.push("hasPart");
  if (parseChapters(inputs.chaptersText).length >= 2 && inputs.pageUrl) optionalProvided.push("potentialAction");

  const chapters = parseChapters(inputs.chaptersText);
  const validation = result?.validation ?? validateSchema(inputs);
  const validationStatus: SummaryStats["validationStatus"] = inputs.videoTitle || inputs.videoDescription || inputs.videoUrl
    ? (validation.errors.length > 0 ? "errors" : validation.warnings.length > 0 ? "warnings" : "valid")
    : "empty";

  return {
    requiredFieldsCount: REQUIRED_FIELDS.length,
    requiredFieldsProvided: requiredProvided,
    optionalFieldsCount: OPTIONAL_FIELDS.length,
    optionalFieldsProvided: optionalProvided.length,
    clipCount: chapters.length,
    hasBreadcrumb: inputs.includeBreadcrumb && Boolean(inputs.breadcrumbItems.trim()),
    hasSeekToAction: chapters.length >= 2 && Boolean(inputs.pageUrl),
    validationStatus,
    durationIso: convertDuration(inputs.duration),
  };
}

// ---- Orchestrator ----

export function generateAll(inputs: VideoInputs): SchemaResult {
  const videoObject = generateVideoObjectSchema(inputs);
  const chapters = parseChapters(inputs.chaptersText);
  const clips = generateClips(chapters, inputs.videoUrl);
  const seekToAction = generateSeekToAction(chapters, inputs.pageUrl);
  const breadcrumbItems = inputs.breadcrumbItems
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const breadcrumb = inputs.includeBreadcrumb
    ? generateBreadcrumbSchema(breadcrumbItems, inputs.pageUrl)
    : undefined;
  const validation = validateSchema(inputs);
  const summary = computeSummaryStats(inputs, { videoObject, breadcrumb, clips, seekToAction, validation, summary: undefined as unknown as SummaryStats });
  return { videoObject, breadcrumb, clips, seekToAction, validation, summary };
}

// ---- HTML script tag wrapper ----

export function wrapHtmlScriptTag(schema: Record<string, unknown>): string {
  const json = JSON.stringify(schema, null, 2);
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

export function wrapAllHtmlScriptTags(result: SchemaResult): string {
  const parts: string[] = [wrapHtmlScriptTag(result.videoObject)];
  if (result.breadcrumb) parts.push(wrapHtmlScriptTag(result.breadcrumb));
  return parts.join("\n\n");
}

// ---- Rendering ----

export function renderText(result: SchemaResult, inputs: VideoInputs): string {
  const lines: string[] = [];
  lines.push("Video Schema Generator Report");
  lines.push("=".repeat(60));
  lines.push(`Video: ${inputs.videoTitle || "(untitled)"}`);
  lines.push(`Validation: ${result.validation.isValid ? "VALID" : "INVALID"} (${result.validation.errors.length} errors, ${result.validation.warnings.length} warnings)`);
  lines.push(`Duration (ISO 8601): ${result.summary.durationIso || "(invalid)"}`);
  lines.push(`Required fields: ${result.summary.requiredFieldsProvided}/${result.summary.requiredFieldsCount}`);
  lines.push(`Optional fields: ${result.summary.optionalFieldsProvided}/${result.summary.optionalFieldsCount}`);
  lines.push(`Clips: ${result.summary.clipCount}`);
  lines.push(`SeekToAction: ${result.summary.hasSeekToAction ? "yes" : "no"}`);
  lines.push(`Breadcrumb: ${result.summary.hasBreadcrumb ? "yes" : "no"}`);
  lines.push("");

  if (result.validation.errors.length > 0) {
    lines.push("ERRORS");
    lines.push("-".repeat(60));
    for (const e of result.validation.errors) lines.push(`  [${e.field}] ${e.message}`);
    lines.push("");
  }
  if (result.validation.warnings.length > 0) {
    lines.push("WARNINGS");
    lines.push("-".repeat(60));
    for (const w of result.validation.warnings) lines.push(`  [${w.field}] ${w.message}`);
    lines.push("");
  }

  lines.push("VIDEOOBJECT JSON-LD");
  lines.push("-".repeat(60));
  lines.push(JSON.stringify(result.videoObject, null, 2));
  lines.push("");

  lines.push("HTML SCRIPT TAG");
  lines.push("-".repeat(60));
  lines.push(wrapHtmlScriptTag(result.videoObject));
  lines.push("");

  if (result.clips.length > 0) {
    lines.push("CLIPS");
    lines.push("-".repeat(60));
    for (const c of result.clips) {
      lines.push(`  ${c.name} (${c.startOffset}-${c.endOffset}s) → ${c.url}`);
    }
    lines.push("");
  }

  if (result.seekToAction) {
    lines.push("SEEKTOACTION");
    lines.push("-".repeat(60));
    lines.push(JSON.stringify(result.seekToAction, null, 2));
    lines.push("");
  }

  if (result.breadcrumb) {
    lines.push("BREADCRUMB JSON-LD");
    lines.push("-".repeat(60));
    lines.push(JSON.stringify(result.breadcrumb, null, 2));
    lines.push("");
  }

  const grc = checkGoogleRichResultsCompliance(inputs);
  lines.push("GOOGLE RICH RESULTS COMPLIANCE");
  lines.push("-".repeat(60));
  lines.push(`  Compliant: ${grc.compliant ? "YES" : "NO"}`);
  if (grc.missing.length > 0) lines.push(`  Missing: ${grc.missing.join(", ")}`);
  if (grc.present.length > 0) lines.push(`  Present: ${grc.present.join(", ")}`);

  return lines.join("\n");
}

export function renderCsv(result: SchemaResult, inputs: VideoInputs): string {
  const rows: string[][] = [
    ["field", "value"],
    ["videoTitle", escapeCsv(inputs.videoTitle)],
    ["videoDescription", escapeCsv(inputs.videoDescription)],
    ["videoUrl", escapeCsv(inputs.videoUrl)],
    ["thumbnailUrl", escapeCsv(inputs.thumbnailUrl)],
    ["uploadDate", escapeCsv(inputs.uploadDate)],
    ["duration_input", escapeCsv(inputs.duration)],
    ["duration_iso", escapeCsv(result.summary.durationIso)],
    ["creatorName", escapeCsv(inputs.creatorName)],
    ["creatorType", escapeCsv(inputs.creatorType)],
    ["contentRating", escapeCsv(inputs.contentRating)],
    ["viewsCount", escapeCsv(inputs.viewsCount)],
    ["likesCount", escapeCsv(inputs.likesCount)],
    ["clipCount", String(result.summary.clipCount)],
    ["hasBreadcrumb", String(result.summary.hasBreadcrumb)],
    ["hasSeekToAction", String(result.summary.hasSeekToAction)],
    ["requiredFieldsProvided", String(result.summary.requiredFieldsProvided)],
    ["requiredFieldsCount", String(result.summary.requiredFieldsCount)],
    ["optionalFieldsProvided", String(result.summary.optionalFieldsProvided)],
    ["optionalFieldsCount", String(result.summary.optionalFieldsCount)],
    ["validationStatus", escapeCsv(result.summary.validationStatus)],
    ["errorCount", String(result.validation.errors.length)],
    ["warningCount", String(result.validation.warnings.length)],
  ];
  for (const e of result.validation.errors) {
    rows.push([`error:${e.field}`, escapeCsv(e.message)]);
  }
  for (const w of result.validation.warnings) {
    rows.push([`warning:${w.field}`, escapeCsv(w.message)]);
  }
  return rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
}

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

function escapeCsv(s: string): string {
  if (s == null) return "";
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:video-schema-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  videoTitle: string;
  durationIso: string;
  validationStatus: string;
  clipCount: number;
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
    } catch { /* ignore */ }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
}

// ---- Shareable URL ----

export function buildShareUrl(inputs: VideoInputs): string {
  const params = new URLSearchParams();
  if (inputs.videoTitle) params.set("title", inputs.videoTitle);
  if (inputs.videoDescription) params.set("desc", inputs.videoDescription);
  if (inputs.videoUrl) params.set("vurl", inputs.videoUrl);
  if (inputs.thumbnailUrl) params.set("thumb", inputs.thumbnailUrl);
  if (inputs.uploadDate) params.set("date", inputs.uploadDate);
  if (inputs.duration) params.set("dur", inputs.duration);
  if (inputs.contentRating) params.set("rating", inputs.contentRating);
  if (inputs.creatorName) params.set("creator", inputs.creatorName);
  if (inputs.creatorType) params.set("ctype", inputs.creatorType);
  if (inputs.viewsCount) params.set("views", inputs.viewsCount);
  if (inputs.likesCount) params.set("likes", inputs.likesCount);
  if (inputs.chaptersText) params.set("chapters", inputs.chaptersText);
  if (inputs.includeBreadcrumb) params.set("bc", "1");
  if (inputs.breadcrumbItems) params.set("bcitems", inputs.breadcrumbItems);
  if (inputs.pageUrl) params.set("purl", inputs.pageUrl);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<VideoInputs> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<VideoInputs> = {};
  const title = params.get("title"); if (title) out.videoTitle = title;
  const desc = params.get("desc"); if (desc) out.videoDescription = desc;
  const vurl = params.get("vurl"); if (vurl) out.videoUrl = vurl;
  const thumb = params.get("thumb"); if (thumb) out.thumbnailUrl = thumb;
  const date = params.get("date"); if (date) out.uploadDate = date;
  const dur = params.get("dur"); if (dur) out.duration = dur;
  const rating = params.get("rating"); if (rating) out.contentRating = rating;
  const creator = params.get("creator"); if (creator) out.creatorName = creator;
  const ctype = params.get("ctype");
  if (ctype === "Person" || ctype === "Organization") out.creatorType = ctype;
  const views = params.get("views"); if (views) out.viewsCount = views;
  const likes = params.get("likes"); if (likes) out.likesCount = likes;
  const chapters = params.get("chapters"); if (chapters) out.chaptersText = chapters;
  if (params.get("bc") === "1") out.includeBreadcrumb = true;
  const bcitems = params.get("bcitems"); if (bcitems) out.breadcrumbItems = bcitems;
  const purl = params.get("purl"); if (purl) out.pageUrl = purl;
  return out;
}
