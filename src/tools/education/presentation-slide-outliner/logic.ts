/**
 * Presentation Slide Outliner — pure logic.
 *
 * Generate structured presentation slide outlines from a topic outline +
 * audience level + duration. Pure functions only — no DOM, no network.
 */

export type AudienceLevel =
  | "elementary"
  | "middle-school"
  | "high-school"
  | "college"
  | "professional"
  | "expert";

export type PresentationType =
  | "lecture"
  | "training"
  | "sales-pitch"
  | "conference-talk";

export type SlideKind =
  | "title"
  | "agenda"
  | "content"
  | "summary"
  | "qa";

export interface TopicSection {
  title: string;
  keyPoints: string[];
}

export interface Slide {
  index: number; // 1-based
  kind: SlideKind;
  title: string;
  bullets: string[];
  speakerNotes: string;
  visualSuggestion: string;
  timeMinutes: number;
  section?: string; // source section title (for content slides)
}

export interface PresentationInput {
  presentationTitle: string;
  presenterName: string;
  audienceLevel: AudienceLevel;
  presentationDuration: number; // minutes
  topicOutline: string; // raw textarea
  includeTitleSlide: boolean;
  includeAgendaSlide: boolean;
  includeQASlide: boolean;
  includeSummarySlide: boolean;
  slidesPerMinute: number;
}

export interface PresentationStats {
  totalSlides: number;
  totalContentSlides: number;
  totalSections: number;
  totalTimeMinutes: number;
  avgTimePerSlide: number;
  byKind: Record<SlideKind, number>;
}

export interface ValidationIssue {
  reason: "empty-title" | "invalid-duration" | "no-topics" | "title-too-long" | "too-many-bullets";
  message: string;
  slideIndex?: number;
}

export interface PresentationTypePreset {
  type: PresentationType;
  label: string;
  description: string;
  defaults: Partial<PresentationInput>;
}

export const MAX_BULLETS_PER_SLIDE = 6;
export const MAX_TITLE_LENGTH = 50;
export const DEFAULT_SLIDES_PER_MINUTE = 0.5;

export const AUDIENCE_LEVELS: AudienceLevel[] = [
  "elementary",
  "middle-school",
  "high-school",
  "college",
  "professional",
  "expert",
];

export const AUDIENCE_LABELS: Record<AudienceLevel, string> = {
  "elementary": "Elementary (K-5)",
  "middle-school": "Middle School (6-8)",
  "high-school": "High School (9-12)",
  "college": "College / University",
  "professional": "Professional",
  "expert": "Expert / Specialist",
};

export interface AudienceStyle {
  bulletTone: string;
  noteTone: string;
  visualPreference: string;
  maxBullets: number;
}

export const AUDIENCE_STYLES: Record<AudienceLevel, AudienceStyle> = {
  "elementary": {
    bulletTone: "Use simple words, short sentences, and lots of examples.",
    noteTone: "Speak slowly. Pause for questions. Use stories kids relate to.",
    visualPreference: "Large colorful images, simple icons, big fonts.",
    maxBullets: 4,
  },
  "middle-school": {
    bulletTone: "Clear bullets with brief definitions for new terms.",
    noteTone: "Check understanding with quick questions. Connect to real life.",
    visualPreference: "Diagrams, photos, short video clips.",
    maxBullets: 5,
  },
  "high-school": {
    bulletTone: "Provide context and comparisons. Introduce formal terms.",
    noteTone: "Encourage critical thinking. Pose discussion questions.",
    visualPreference: "Charts, comparison tables, annotated diagrams.",
    maxBullets: 5,
  },
  "college": {
    bulletTone: "Detailed content. Cite sources. Include data points.",
    noteTone: "Reference readings. Anticipate follow-up questions.",
    visualPreference: "Data charts, references, source citations on each slide.",
    maxBullets: 6,
  },
  "professional": {
    bulletTone: "Action-oriented. ROI, metrics, next steps. Skip basics.",
    noteTone: "Lead with insights. Be ready for stakeholder pushback.",
    visualPreference: "KPI dashboards, before/after, Gantt charts.",
    maxBullets: 6,
  },
  "expert": {
    bulletTone: "Dense data, technical jargon, minimal fluff. Cite papers.",
    noteTone: "Assume deep prior knowledge. Discuss trade-offs and edge cases.",
    visualPreference: "Technical diagrams, raw data tables, equations.",
    maxBullets: 6,
  },
};

export const PRESENTATION_TYPE_PRESETS: PresentationTypePreset[] = [
  {
    type: "lecture",
    label: "Lecture",
    description: "Educational lecture for a class — moderate pace, comprehensive.",
    defaults: {
      audienceLevel: "college",
      slidesPerMinute: 0.5,
      includeTitleSlide: true,
      includeAgendaSlide: true,
      includeQASlide: true,
      includeSummarySlide: true,
    },
  },
  {
    type: "training",
    label: "Training",
    description: "Hands-on training workshop — slower pace, more examples.",
    defaults: {
      audienceLevel: "professional",
      slidesPerMinute: 0.4,
      includeTitleSlide: true,
      includeAgendaSlide: true,
      includeQASlide: true,
      includeSummarySlide: true,
    },
  },
  {
    type: "sales-pitch",
    label: "Sales Pitch",
    description: "Sales demo — fast pace, action-oriented, ROI focus.",
    defaults: {
      audienceLevel: "professional",
      slidesPerMinute: 0.7,
      includeTitleSlide: true,
      includeAgendaSlide: false,
      includeQASlide: true,
      includeSummarySlide: true,
    },
  },
  {
    type: "conference-talk",
    label: "Conference Talk",
    description: "Conference presentation — expert audience, dense data.",
    defaults: {
      audienceLevel: "expert",
      slidesPerMinute: 0.6,
      includeTitleSlide: true,
      includeAgendaSlide: true,
      includeQASlide: true,
      includeSummarySlide: true,
    },
  },
];

/** Parse a topic outline textarea. One section per line: title|key_points (semicolon-separated). */
export function parseTopicOutline(input: string): TopicSection[] {
  if (!input) return [];
  const lines = input.split(/\r?\n/);
  const out: TopicSection[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const pipeIdx = trimmed.indexOf("|");
    let title: string;
    let pointsStr: string;
    if (pipeIdx === -1) {
      title = trimmed;
      pointsStr = "";
    } else {
      title = trimmed.slice(0, pipeIdx).trim();
      pointsStr = trimmed.slice(pipeIdx + 1).trim();
    }
    if (!title) continue;
    const keyPoints = pointsStr
      ? pointsStr
          .split(";")
          .map((p) => p.trim())
          .filter(Boolean)
      : [];
    out.push({ title, keyPoints });
  }
  return out;
}

/** Calculate the number of content slides based on duration × slidesPerMinute. */
export function calculateSlideCount(duration: number, slidesPerMinute: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  if (!Number.isFinite(slidesPerMinute) || slidesPerMinute <= 0) return 0;
  return Math.max(1, Math.round(duration * slidesPerMinute));
}

/** Distribute sections across N content slides. */
export function distributeSections(sections: TopicSection[], slideCount: number): TopicSection[][] {
  if (slideCount <= 0) return [];
  if (sections.length === 0) return Array.from({ length: slideCount }, () => []);
  if (sections.length <= slideCount) {
    // Pad with empty slots at the end if more slides than sections
    const result = sections.map((s) => [s]);
    while (result.length < slideCount) result.push([]);
    return result;
  }
  // More sections than slides — distribute evenly
  const result: TopicSection[][] = Array.from({ length: slideCount }, () => []);
  const perSlide = Math.ceil(sections.length / slideCount);
  for (let i = 0; i < sections.length; i++) {
    const targetIdx = Math.min(Math.floor(i / perSlide), slideCount - 1);
    result[targetIdx].push(sections[i]);
  }
  return result;
}

/** Generate bullets for a content slide from one or more sections (respecting audience maxBullets). */
export function generateBullets(sections: TopicSection[], audience: AudienceLevel): string[] {
  const style = AUDIENCE_STYLES[audience];
  const max = style.maxBullets;
  const bullets: string[] = [];
  for (const s of sections) {
    if (s.keyPoints.length === 0) {
      bullets.push(s.title);
    } else {
      for (const p of s.keyPoints) {
        bullets.push(`${s.title}: ${p}`);
        if (bullets.length >= max) break;
      }
    }
    if (bullets.length >= max) break;
  }
  return bullets.slice(0, max);
}

/** Generate speaker notes for a slide based on its kind and audience. */
export function generateSpeakerNotes(
  kind: SlideKind,
  title: string,
  bullets: string[],
  audience: AudienceLevel,
  presentationTitle: string,
): string {
  const style = AUDIENCE_STYLES[audience];
  switch (kind) {
    case "title":
      return `Welcome the audience. Introduce yourself. State the presentation title "${presentationTitle}" and what they'll learn. ${style.noteTone}`;
    case "agenda":
      return `Walk through the agenda: ${bullets.join(", ")}. Set expectations for duration and Q&A timing.`;
    case "content":
      return `Cover: ${bullets.join("; ")}. ${style.noteTone}`;
    case "summary":
      return `Recap the key takeaways. Reinforce the main message of "${title}". Transition to Q&A.`;
    case "qa":
      return `Open the floor for questions. Repeat each question for the audience. Thank attendees for their attention.`;
  }
}

/** Generate a visual suggestion for a slide based on kind + audience. */
export function generateVisualSuggestion(kind: SlideKind, audience: AudienceLevel, title: string): string {
  const style = AUDIENCE_STYLES[audience];
  switch (kind) {
    case "title":
      return `Full-bleed title slide with presenter name and presentation title. ${style.visualPreference}`;
    case "agenda":
      return `Numbered list with section icons.`;
    case "content":
      return `Visual for "${title}": ${style.visualPreference}`;
    case "summary":
      return `Single-page recap with key bullet points highlighted.`;
    case "qa":
      return `Large "Questions?" text with contact info.`;
  }
}

/** Validate bullets per slide (max MAX_BULLETS_PER_SLIDE). */
export function validateBulletCount(bullets: string[]): boolean {
  return bullets.length <= MAX_BULLETS_PER_SLIDE;
}

/** Validate slide title length (max MAX_TITLE_LENGTH chars). */
export function validateTitleLength(title: string): boolean {
  return (title || "").length <= MAX_TITLE_LENGTH;
}

/** Build the full slide deck from input. */
export function buildSlides(input: PresentationInput): Slide[] {
  const sections = parseTopicOutline(input.topicOutline);
  const contentSlideCount = calculateSlideCount(
    input.presentationDuration,
    input.slidesPerMinute,
  );
  const distributed = distributeSections(sections, contentSlideCount);
  const style = AUDIENCE_STYLES[input.audienceLevel];
  const totalSlides =
    (input.includeTitleSlide ? 1 : 0) +
    (input.includeAgendaSlide ? 1 : 0) +
    contentSlideCount +
    (input.includeSummarySlide ? 1 : 0) +
    (input.includeQASlide ? 1 : 0);
  const totalTime = input.presentationDuration || 0;
  const timePerSlide = totalSlides > 0 ? totalTime / totalSlides : 0;

  const slides: Slide[] = [];
  let idx = 1;

  if (input.includeTitleSlide) {
    slides.push({
      index: idx++,
      kind: "title",
      title: input.presentationTitle || "Untitled Presentation",
      bullets: input.presenterName ? [`Presenter: ${input.presenterName}`] : [],
      speakerNotes: generateSpeakerNotes("title", "", [], input.audienceLevel, input.presentationTitle),
      visualSuggestion: generateVisualSuggestion("title", input.audienceLevel, input.presentationTitle),
      timeMinutes: timePerSlide,
    });
  }

  if (input.includeAgendaSlide) {
    const agendaBullets = sections.slice(0, style.maxBullets).map((s) => s.title);
    slides.push({
      index: idx++,
      kind: "agenda",
      title: "Agenda",
      bullets: agendaBullets,
      speakerNotes: generateSpeakerNotes("agenda", "Agenda", agendaBullets, input.audienceLevel, input.presentationTitle),
      visualSuggestion: generateVisualSuggestion("agenda", input.audienceLevel, "Agenda"),
      timeMinutes: timePerSlide,
    });
  }

  for (let i = 0; i < contentSlideCount; i++) {
    const sectionsForSlide = distributed[i] || [];
    const sectionTitles = sectionsForSlide.map((s) => s.title);
    const title = sectionTitles.length > 0
      ? sectionTitles.join(" + ")
      : `Section ${i + 1}`;
    const bullets = generateBullets(sectionsForSlide, input.audienceLevel);
    slides.push({
      index: idx++,
      kind: "content",
      title,
      bullets,
      speakerNotes: generateSpeakerNotes("content", title, bullets, input.audienceLevel, input.presentationTitle),
      visualSuggestion: generateVisualSuggestion("content", input.audienceLevel, title),
      timeMinutes: timePerSlide,
      section: sectionTitles[0],
    });
  }

  if (input.includeSummarySlide) {
    const summaryBullets = sections.slice(0, 3).map((s) => `Key takeaway: ${s.title}`);
    slides.push({
      index: idx++,
      kind: "summary",
      title: "Summary & Key Takeaways",
      bullets: summaryBullets,
      speakerNotes: generateSpeakerNotes("summary", "Summary", summaryBullets, input.audienceLevel, input.presentationTitle),
      visualSuggestion: generateVisualSuggestion("summary", input.audienceLevel, "Summary"),
      timeMinutes: timePerSlide,
    });
  }

  if (input.includeQASlide) {
    slides.push({
      index: idx++,
      kind: "qa",
      title: "Questions & Answers",
      bullets: [],
      speakerNotes: generateSpeakerNotes("qa", "Q&A", [], input.audienceLevel, input.presentationTitle),
      visualSuggestion: generateVisualSuggestion("qa", input.audienceLevel, "Q&A"),
      timeMinutes: timePerSlide,
    });
  }

  return slides;
}

/** Validate the full slide deck — checks title length + bullet count. */
export function validatePresentation(slides: Slide[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const s of slides) {
    if (!validateTitleLength(s.title)) {
      issues.push({
        reason: "title-too-long",
        message: `Slide ${s.index}: title exceeds ${MAX_TITLE_LENGTH} chars ("${s.title.slice(0, 50)}…")`,
        slideIndex: s.index,
      });
    }
    if (!validateBulletCount(s.bullets)) {
      issues.push({
        reason: "too-many-bullets",
        message: `Slide ${s.index}: has ${s.bullets.length} bullets (max ${MAX_BULLETS_PER_SLIDE})`,
        slideIndex: s.index,
      });
    }
  }
  return issues;
}

/** Compute summary stats. */
export function computeStats(slides: Slide[], totalDuration: number): PresentationStats {
  const byKind: Record<SlideKind, number> = {
    "title": 0,
    "agenda": 0,
    "content": 0,
    "summary": 0,
    "qa": 0,
  };
  const sections = new Set<string>();
  for (const s of slides) {
    byKind[s.kind] += 1;
    if (s.kind === "content" && s.section) sections.add(s.section);
  }
  const totalSlides = slides.length;
  return {
    totalSlides,
    totalContentSlides: byKind.content,
    totalSections: sections.size,
    totalTimeMinutes: totalDuration,
    avgTimePerSlide: totalSlides > 0 ? totalDuration / totalSlides : 0,
    byKind,
  };
}

// ---- Renderers ----

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeCsvField(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render as plain-text outline. */
export function renderText(slides: Slide[], input: PresentationInput): string {
  if (slides.length === 0) return "";
  const lines: string[] = [];
  lines.push(`Presentation: ${input.presentationTitle}`);
  if (input.presenterName) lines.push(`Presenter: ${input.presenterName}`);
  lines.push(`Audience: ${AUDIENCE_LABELS[input.audienceLevel]}`);
  lines.push(`Duration: ${input.presentationDuration} min`);
  lines.push(`Total slides: ${slides.length}`);
  lines.push("");
  for (const s of slides) {
    lines.push(`--- Slide ${s.index}: ${s.title} [${s.kind}] (${s.timeMinutes.toFixed(1)} min) ---`);
    if (s.bullets.length > 0) {
      for (const b of s.bullets) lines.push(`  • ${b}`);
    }
    lines.push(`  [Speaker notes] ${s.speakerNotes}`);
    lines.push(`  [Visual] ${s.visualSuggestion}`);
    lines.push("");
  }
  return lines.join("\n");
}

/** Render as printable HTML (one slide per section). */
export function renderHtml(slides: Slide[], input: PresentationInput): string {
  if (slides.length === 0) return "<!doctype html><html><body><p>No slides.</p></body></html>";
  const slideHtml = slides.map((s) => {
    const bullets = s.bullets.length > 0
      ? `<ul>${s.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
      : "";
    return `<section class="slide">
  <h2>${escapeHtml(s.title)} <small>[${s.kind}]</small></h2>
  ${bullets}
  <p class="notes"><strong>Speaker notes:</strong> ${escapeHtml(s.speakerNotes)}</p>
  <p class="visual"><strong>Visual:</strong> ${escapeHtml(s.visualSuggestion)}</p>
  <p class="time">⏱ ${s.timeMinutes.toFixed(1)} min</p>
</section>`;
  }).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(input.presentationTitle || "Presentation")}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:900px;margin:1rem auto;padding:0 1rem;line-height:1.5;color:#222}
.slide{border:1px solid #ddd;border-radius:8px;padding:1.5rem;margin:1rem 0;background:#fff;page-break-after:always}
.slide h2{margin-top:0;border-bottom:2px solid #4a90e2;padding-bottom:.5rem;color:#1a4480}
.slide small{color:#888;font-weight:normal;font-size:.7em}
.notes{background:#fffbe6;padding:.5rem;border-left:3px solid #f5a623;font-size:.9em}
.visual{color:#666;font-size:.9em;font-style:italic}
.time{color:#4a90e2;font-size:.85em}
ul{padding-left:1.5rem}
@media print{.slide{page-break-after:always}}
</style>
</head>
<body>
<h1>${escapeHtml(input.presentationTitle || "Presentation")}</h1>
${input.presenterName ? `<p>Presenter: ${escapeHtml(input.presenterName)}</p>` : ""}
${slideHtml}
</body>
</html>`;
}

/** Render as Markdown (Marp/reveal.js compatible — uses --- as slide separator). */
export function renderMarkdown(slides: Slide[], input: PresentationInput): string {
  if (slides.length === 0) return "";
  const lines: string[] = [];
  lines.push(`---`);
  lines.push(`marp: true`);
  lines.push(`title: ${input.presentationTitle || "Presentation"}`);
  if (input.presenterName) lines.push(`author: ${input.presenterName}`);
  lines.push(`---`);
  lines.push("");
  for (const s of slides) {
    lines.push(`# ${s.title}`);
    lines.push("");
    if (s.bullets.length > 0) {
      for (const b of s.bullets) lines.push(`- ${b}`);
      lines.push("");
    }
    if (s.speakerNotes) lines.push(`<!-- ${s.speakerNotes} -->`);
    lines.push(`<!-- Visual: ${s.visualSuggestion} -->`);
    lines.push(`<!-- Time: ${s.timeMinutes.toFixed(1)} min -->`);
    lines.push("");
    lines.push(`---`);
    lines.push("");
  }
  return lines.join("\n");
}

/** Render as CSV (slide_num, kind, title, bullets, notes, visual, time). */
export function renderCsv(slides: Slide[]): string {
  const lines = ["slide_num,kind,title,bullets,speaker_notes,visual,time_minutes"];
  for (const s of slides) {
    lines.push([
      String(s.index),
      s.kind,
      escapeCsvField(s.title),
      escapeCsvField(s.bullets.join(" | ")),
      escapeCsvField(s.speakerNotes),
      escapeCsvField(s.visualSuggestion),
      s.timeMinutes.toFixed(2),
    ].join(","));
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:presentation-slide-outliner:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  presentationTitle: string;
  audienceLevel: AudienceLevel;
  slideCount: number;
  durationMinutes: number;
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

export function buildShareUrl(input: PresentationInput): string {
  const params = new URLSearchParams();
  if (input.presentationTitle) params.set("title", input.presentationTitle);
  if (input.presenterName) params.set("presenter", input.presenterName);
  params.set("audience", input.audienceLevel);
  params.set("duration", String(input.presentationDuration));
  if (input.topicOutline) params.set("outline", input.topicOutline);
  params.set("title_slide", String(input.includeTitleSlide));
  params.set("agenda_slide", String(input.includeAgendaSlide));
  params.set("qa_slide", String(input.includeQASlide));
  params.set("summary_slide", String(input.includeSummarySlide));
  params.set("spm", String(input.slidesPerMinute));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<PresentationInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<PresentationInput> = {};
  if (params.get("title")) out.presentationTitle = params.get("title")!;
  if (params.get("presenter")) out.presenterName = params.get("presenter")!;
  const aud = params.get("audience");
  if (aud && AUDIENCE_LEVELS.includes(aud as AudienceLevel)) {
    out.audienceLevel = aud as AudienceLevel;
  }
  const dur = params.get("duration");
  if (dur) {
    const n = Number(dur);
    if (Number.isFinite(n) && n > 0) out.presentationDuration = n;
  }
  if (params.get("outline")) out.topicOutline = params.get("outline")!;
  out.includeTitleSlide = params.get("title_slide") !== "false";
  out.includeAgendaSlide = params.get("agenda_slide") !== "false";
  out.includeQASlide = params.get("qa_slide") !== "false";
  out.includeSummarySlide = params.get("summary_slide") !== "false";
  const spm = params.get("spm");
  if (spm) {
    const n = Number(spm);
    if (Number.isFinite(n) && n > 0) out.slidesPerMinute = n;
  }
  return out;
}
