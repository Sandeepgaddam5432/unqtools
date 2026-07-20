/**
 * AI Meeting Minutes Summarizer — pure logic.
 *
 * Parse a meeting transcript (plain text, VTT, or SRT) into structured
 * minutes:
 *   - attendees (detected speakers)
 *   - TL;DR + discussion summary (extractive summarization)
 *   - decisions (cue-based extraction)
 *   - action items (task / owner / due — NER)
 *   - open questions
 *   - risks / follow-ups
 * Render Markdown and a recap email. Local history (max 20) + shareable URL.
 *
 * Pure functions only — no DOM, no network.
 *
 * Honesty: this is a deterministic template-offline extractor. Subtle
 * owner/date cues and implicit decisions will be missed. Review before
 * sending. An optional BYO-key LLM hook is stubbed but not invoked here.
 */

// ---------- Types ----------

export type TranscriptFormat = "plain" | "vtt" | "srt";
export type SummaryLength = "brief" | "standard" | "detailed";

export interface SpeakerTurn {
  speaker: string;
  text: string;
  startSec?: number;
}

export interface Sentence {
  text: string;
  speaker: string;
  index: number;
  wordCount: number;
  position: number; // 0..1 within the document
}

export interface ActionItem {
  id: string;
  task: string;
  owner?: string;
  due?: string;
  rawCue: string;
  sentence: string;
}

export interface Decision {
  id: string;
  text: string;
  cue: string;
}

export interface OpenQuestion {
  id: string;
  text: string;
  speaker?: string;
}

export interface Risk {
  id: string;
  text: string;
  cue: string;
}

export interface MeetingMinutes {
  title: string;
  format: TranscriptFormat;
  attendees: string[];
  turns: SpeakerTurn[];
  tldr: string;
  summary: string;
  decisions: Decision[];
  actionItems: ActionItem[];
  openQuestions: OpenQuestion[];
  risks: Risk[];
  followUps: string[];
  warnings: string[];
  stats: {
    turnCount: number;
    wordCount: number;
    sentenceCount: number;
    chunkCount: number;
  };
}

export interface HistoryEntry {
  ts: number;
  title: string;
  attendeeCount: number;
  actionCount: number;
  decisionCount: number;
  wordCount: number;
}

// ---------- Format detection ----------

export function detectFormat(input: string): TranscriptFormat {
  const head = (input || "").slice(0, 500);
  // VTT: WEBVTT header OR timestamp with dot decimal (MM:SS.mmm or HH:MM:SS.mmm).
  if (/^WEBVTT/m.test(head)) return "vtt";
  if (/^\d{2}:\d{2}(?::\d{2})?\.\d{3}\s*-->\s*\d{2}:\d{2}(?::\d{2})?\.\d{3}/m.test(head)) {
    return "vtt";
  }
  // SRT: numeric index line + comma-decimal timestamp HH:MM:SS,mmm.
  if (/^\d+\s*$/m.test(head) && /^\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/m.test(head)) {
    return "srt";
  }
  // Also detect SRT by comma-decimal alone (some SRTs lack the leading index).
  if (/^\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/m.test(head)) {
    return "srt";
  }
  return "plain";
}

// ---------- VTT / SRT parsing ----------

/** Parse a timestamp like 00:01:23.456 or 00:01:23,456 into seconds. */
export function parseTimestamp(ts: string): number | undefined {
  if (!ts) return undefined;
  const cleaned = ts.trim().replace(",", ".");
  const m = cleaned.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?$/);
  if (!m) return undefined;
  const h = m[1] ? parseInt(m[1], 10) : 0;
  const min = parseInt(m[2], 10);
  const sec = parseInt(m[3], 10);
  const ms = m[4] ? parseInt(m[4].padEnd(3, "0"), 10) : 0;
  return h * 3600 + min * 60 + sec + ms / 1000;
}

/** Strip VTT/SRT metadata lines (cues, timestamps, NOTE blocks). */
export function stripCues(input: string, format: TranscriptFormat): string {
  const lines = input.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (/^WEBVTT/.test(line)) continue;
    if (/^NOTE\b/.test(line)) continue;
    if (/^\d+\s*$/.test(line) && format === "srt") continue;
    if (/\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->/.test(line)) continue;
    if (/^\d{2}:\d{2}\.\d{3}\s*-->/.test(line)) continue;
    if (/^STYLE\b/.test(line)) continue;
    if (/^REGION\b/.test(line)) continue;
    if (/^<c[^>]*>/.test(line)) {
      out.push(line.replace(/<[^>]+>/g, ""));
      continue;
    }
    if (/<[^>]+>/.test(line)) {
      out.push(line.replace(/<[^>]+>/g, ""));
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

// ---------- Speaker detection ----------

const SPEAKER_RE = /^(?:\[?([A-Z][A-Za-z0-9_.\- ]{0,40}?)\]?\s*[:\-—>]\s*)(.+)$/;
const VTT_VOICE_RE = /^<v\s+([^>]+)>\s*(.+)$/i;

/** Detect a speaker from a single line, or undefined if none. */
export function detectSpeaker(line: string): { speaker: string; rest: string } | undefined {
  if (!line) return undefined;
  const v = line.match(VTT_VOICE_RE);
  if (v) return { speaker: v[1].trim(), rest: v[2].trim() };
  const m = line.match(SPEAKER_RE);
  if (m && m[1] && m[1].length <= 40 && !/^\d/.test(m[1])) {
    return { speaker: m[1].trim(), rest: m[2].trim() };
  }
  return undefined;
}

/** Group raw transcript lines into speaker turns. */
export function groupTurns(text: string): SpeakerTurn[] {
  const lines = text.split(/\r?\n/);
  const turns: SpeakerTurn[] = [];
  let currentSpeaker = "Unknown";
  let buffer: string[] = [];
  const flush = () => {
    const text = buffer.join(" ").replace(/\s+/g, " ").trim();
    if (text) turns.push({ speaker: currentSpeaker, text });
    buffer = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const det = detectSpeaker(line);
    if (det) {
      flush();
      currentSpeaker = det.speaker;
      buffer.push(det.rest);
    } else {
      buffer.push(line);
    }
  }
  flush();
  return turns;
}

/** Extract unique attendee list (speakers) preserving first-seen order. */
export function extractAttendees(turns: SpeakerTurn[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of turns) {
    const s = t.speaker.trim();
    if (!s || s === "Unknown") continue;
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

// ---------- Sentence tokenization ----------

const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+(?=[A-Z0-9"'(\[])/g;

/** Split text into sentences. */
export function splitSentences(text: string): string[] {
  if (!text) return [];
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  return clean
    .split(SENTENCE_SPLIT_RE)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Tokenize a sentence into words (lowercase, alpha-only). */
export function tokenizeWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z'-]+/g) || []).filter(Boolean);
}

const STOP_WORDS = new Set<string>([
  "the", "a", "an", "and", "or", "but", "if", "then", "of", "to", "in", "on",
  "for", "with", "as", "is", "are", "be", "been", "being", "was", "were",
  "this", "that", "these", "those", "i", "you", "we", "they", "he", "she",
  "it", "so", "do", "does", "did", "have", "has", "had", "will", "would",
  "should", "could", "can", "may", "might", "just", "really", "very",
  "going", "get", "got", "want", "need", "like", "know", "think", "said",
  "say", "says", "okay", "ok", "yeah", "yes", "no", "not", "from", "at",
  "by", "about", "into", "out", "up", "down", "over", "under", "again",
]);

// ---------- Extractive summarization ----------

export interface SentenceScore {
  sentence: string;
  speaker: string;
  score: number;
  index: number;
}

/** Build a word-frequency table (excluding stop words). */
export function buildWordFreq(turns: SpeakerTurn[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of turns) {
    for (const w of tokenizeWords(t.text)) {
      if (STOP_WORDS.has(w) || w.length < 3) continue;
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }
  return freq;
}

/** Score every sentence for extractive summarization. */
export function scoreSentences(turns: SpeakerTurn[], sentences: Sentence[]): SentenceScore[] {
  const freq = buildWordFreq(turns);
  const total = sentences.length || 1;
  const maxFreq = Math.max(1, ...Array.from(freq.values()));
  return sentences.map((s) => {
    const words = tokenizeWords(s.text).filter((w) => !STOP_WORDS.has(w) && w.length >= 3);
    let sum = 0;
    for (const w of words) sum += (freq.get(w) ?? 0) / maxFreq;
    const freqScore = words.length ? sum / words.length : 0;
    // Position: earlier sentences slightly higher, but a bump in the first 20%.
    const positionScore = 1 - s.position * 0.6;
    // Length normalization: 8-25 words gets a boost.
    const wc = s.wordCount;
    const lengthScore = wc < 4 ? 0.4 : wc > 40 ? 0.7 : 0.8 + Math.min(0.4, (25 - Math.abs(20 - wc)) / 100);
    // Cue-word boost for decision/action verbs.
    const lower = s.text.toLowerCase();
    let cueBoost = 0;
    if (/\b(decided|agreed|action|owner|due|will|should|must|needs? to|by friday|next week|todo|deadline|risk|blocker)\b/.test(lower)) {
      cueBoost = 0.5;
    }
    const score = freqScore * 0.5 + positionScore * 0.25 + lengthScore * 0.15 + cueBoost * 0.1;
    return { sentence: s.text, speaker: s.speaker, score, index: s.index };
  });
}

/** Pick top-k sentences preserving original order. */
export function pickTopSentences(scores: SentenceScore[], k: number): SentenceScore[] {
  const sorted = [...scores].sort((a, b) => b.score - a.score).slice(0, k);
  return sorted.sort((a, b) => a.index - b.index);
}

/** Build the sentence list from turns. */
export function buildSentences(turns: SpeakerTurn[]): Sentence[] {
  const out: Sentence[] = [];
  let totalSentences = 0;
  // First pass to count total
  for (const t of turns) {
    totalSentences += splitSentences(t.text).length;
  }
  const denom = totalSentences || 1;
  let idx = 0;
  for (const t of turns) {
    for (const s of splitSentences(t.text)) {
      out.push({
        text: s,
        speaker: t.speaker,
        index: idx,
        wordCount: tokenizeWords(s).length,
        position: idx / denom,
      });
      idx += 1;
    }
  }
  return out;
}

/** Compute the number of summary sentences for a length preset. */
export function summaryLengthCount(totalSentences: number, length: SummaryLength): number {
  if (totalSentences <= 0) return 0;
  if (length === "brief") return Math.max(1, Math.round(totalSentences * 0.1));
  if (length === "detailed") return Math.max(2, Math.round(totalSentences * 0.35));
  return Math.max(1, Math.round(totalSentences * 0.2)); // standard
}

/** Generate the TL;DR (1-2 sentences, highest-scoring). */
export function generateTldr(turns: SpeakerTurn[], sentences: Sentence[]): string {
  if (sentences.length === 0) return "";
  const scores = scoreSentences(turns, sentences);
  const k = Math.min(2, sentences.length);
  const top = pickTopSentences(scores, k);
  return top.map((s) => s.sentence).join(" ");
}

/** Generate the discussion summary. */
export function generateSummary(
  turns: SpeakerTurn[],
  sentences: Sentence[],
  length: SummaryLength,
): string {
  if (sentences.length === 0) return "";
  const scores = scoreSentences(turns, sentences);
  const k = summaryLengthCount(sentences.length, length);
  const top = pickTopSentences(scores, k);
  return top.map((s) => s.sentence).join(" ");
}

// ---------- Map-reduce chunking ----------

/** Split turns into N roughly-equal chunks for map-reduce. */
export function chunkTurns(turns: SpeakerTurn[], chunkSize: number): SpeakerTurn[][] {
  if (chunkSize <= 0) return [turns];
  const out: SpeakerTurn[] = [];
  const chunks: SpeakerTurn[][] = [];
  for (let i = 0; i < turns.length; i += chunkSize) {
    chunks.push(turns.slice(i, i + chunkSize));
  }
  if (chunks.length === 0) chunks.push(out);
  return chunks;
}

/** Map-reduce summary: summarize each chunk, then summarize the concatenation. */
export function mapReduceSummary(
  turns: SpeakerTurn[],
  length: SummaryLength,
  chunkSize = 25,
): { summary: string; chunkCount: number } {
  if (turns.length === 0) return { summary: "", chunkCount: 0 };
  const chunks = chunkTurns(turns, chunkSize);
  if (chunks.length === 1) {
    const sentences = buildSentences(turns);
    return { summary: generateSummary(turns, sentences, length), chunkCount: 1 };
  }
  const partials: string[] = [];
  for (const c of chunks) {
    const sents = buildSentences(c);
    partials.push(generateSummary(c, sents, "brief"));
  }
  const combined: SpeakerTurn[] = [{ speaker: "Summary", text: partials.join(" ") }];
  const sentences = buildSentences(combined);
  return {
    summary: generateSummary(combined, sentences, length),
    chunkCount: chunks.length,
  };
}

// ---------- Decisions, actions, questions, risks ----------

const DECISION_CUES: Array<{ cue: string; re: RegExp }> = [
  { cue: "decided", re: /\b(?:we|i|let'?s|the team)\s+(?:have\s+)?(?:decided|agreed|concluded|resolved)\s+(?:that|to|on)?\s*(.+?)[.!?]?$/i },
  { cue: "agreed", re: /\b(?:agreed|agree)\s+(?:that|to|on)\s+(.+?)[.!?]?$/i },
  { cue: "will go with", re: /\bwill\s+go\s+with\s+(.+?)[.!?]?$/i },
  { cue: "final decision", re: /\bfinal\s+decision\s+is\s+(.+?)[.!?]?$/i },
  { cue: "approved", re: /\bapproved\s+(.+?)[.!?]?$/i },
  { cue: "going with", re: /\bgoing\s+with\s+(.+?)[.!?]?$/i },
];

const ACTION_CUES: Array<{ cue: string; re: RegExp }> = [
  { cue: "will", re: /\b(\w+)\s+will\s+(.+?)[.!?]?$/i },
  { cue: "going to", re: /\b(\w+)\s+(?:is|are)?\s*going\s+to\s+(.+?)[.!?]?$/i },
  { cue: "needs to", re: /\b(\w+)\s+needs?\s+to\s+(.+?)[.!?]?$/i },
  { cue: "should", re: /\b(\w+)\s+should\s+(.+?)[.!?]?$/i },
  { cue: "must", re: /\b(\w+)\s+must\s+(.+?)[.!?]?$/i },
  { cue: "TODO", re: /\bTODO[:\s]+(.+?)[.!?]?$/i },
  { cue: "action item", re: /\baction\s+item[:\s]+(.+?)[.!?]?$/i },
  { cue: "owner", re: /\bowner[:\s]+(\w+)\s*[-—:]?\s*(.+?)[.!?]?$/i },
];

const RISK_CUES: Array<{ cue: string; re: RegExp }> = [
  { cue: "risk", re: /\brisk[:\s]+(?:is|of|that)?\s*(.+?)[.!?]?$/i },
  { cue: "blocker", re: /\bblocker[:\s]+(.+?)[.!?]?$/i },
  { cue: "concern", re: /\bconcern[:\s]+(?:is|that)?\s*(.+?)[.!?]?$/i },
  { cue: "might break", re: /\bmight\s+break\s+(.+?)[.!?]?$/i },
];

/** Extract decisions from turns. */
export function extractDecisions(turns: SpeakerTurn[]): Decision[] {
  const out: Decision[] = [];
  let i = 0;
  for (const t of turns) {
    for (const s of splitSentences(t.text)) {
      for (const { cue, re } of DECISION_CUES) {
        const m = s.match(re);
        if (m) {
          out.push({
            id: `dec-${i++}`,
            text: s.trim(),
            cue,
          });
          break;
        }
      }
    }
  }
  return out;
}

/** Extract a date-like due date from a sentence. */
export function extractDueDate(text: string): string | undefined {
  const lower = text.toLowerCase();
  const patterns: Array<{ re: RegExp; label: string }> = [
    { re: /\bby\s+(end\s+of\s+day|eod)\b/, label: "EOD" },
    { re: /\bby\s+(end\s+of\s+week|eow)\b/, label: "EOW" },
    { re: /\bby\s+(end\s+of\s+sprint|eos)\b/, label: "EOS" },
    { re: /\bby\s+tomorrow\b/, label: "tomorrow" },
    { re: /\bby\s+next\s+week\b/, label: "next week" },
    { re: /\bby\s+next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/, label: "next $1" },
    { re: /\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/, label: "$1" },
    { re: /\bby\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/, label: "$1 $2" },
    { re: /\bby\s+(\d{4}-\d{2}-\d{2})\b/, label: "$1" },
    { re: /\bby\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/, label: "$1" },
    { re: /\bwithin\s+(\d+)\s+(day|week|month)s?\b/, label: "within $1 $2s" },
    { re: /\bin\s+(\d+)\s+(day|week|month)s?\b/, label: "in $1 $2s" },
  ];
  for (const { re, label } of patterns) {
    const m = lower.match(re);
    if (m) {
      return label.includes("$1")
        ? label.replace("$1", m[1] || "").replace("$2", m[2] || "")
        : label;
    }
  }
  return undefined;
}

/** Normalize a detected owner name (capitalize, strip @). */
export function normalizeOwner(name: string): string {
  const clean = name.replace(/^@/, "").trim();
  if (!clean) return clean;
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

/** Extract action items from turns. */
export function extractActionItems(turns: SpeakerTurn[], attendees: string[]): ActionItem[] {
  const out: ActionItem[] = [];
  let i = 0;
  const attendeeSet = new Set(attendees.map((a) => a.toLowerCase()));
  for (const t of turns) {
    for (const s of splitSentences(t.text)) {
      for (const { cue, re } of ACTION_CUES) {
        const m = s.match(re);
        if (m) {
          let owner: string | undefined;
          let task: string;
          if (cue === "TODO" || cue === "action item") {
            task = m[1].trim();
            owner = t.speaker !== "Unknown" ? t.speaker : undefined;
          } else if (cue === "owner") {
            owner = normalizeOwner(m[1]);
            task = m[2].trim();
          } else {
            const candidate = normalizeOwner(m[1]);
            // Prefer the speaker if first token is "I", "we", "you", "they"
            if (/^(i|we|you|they|everyone|everybody|team|all)$/i.test(candidate)) {
              owner = t.speaker !== "Unknown" ? t.speaker : candidate;
            } else if (attendeeSet.has(candidate.toLowerCase())) {
              owner = candidate;
            } else {
              owner = t.speaker !== "Unknown" ? t.speaker : undefined;
            }
            task = m[2].trim();
          }
          // @mention detection inside the sentence
          const mention = s.match(/@([A-Za-z][A-Za-z0-9_.\-]+)/);
          if (mention) owner = normalizeOwner(mention[1]);
          const due = extractDueDate(s);
          out.push({
            id: `act-${i++}`,
            task: task.charAt(0).toUpperCase() + task.slice(1),
            owner,
            due,
            rawCue: cue,
            sentence: s.trim(),
          });
          break;
        }
      }
    }
  }
  return out;
}

/** Extract open questions (sentences ending in '?' or question cues). */
export function extractOpenQuestions(turns: SpeakerTurn[]): OpenQuestion[] {
  const out: OpenQuestion[] = [];
  let i = 0;
  const cueRe = /\b(?:what|how|when|where|who|why|should we|can we|could we|do we|are we|is there)\b/i;
  for (const t of turns) {
    for (const s of splitSentences(t.text)) {
      const trimmed = s.trim();
      if (trimmed.endsWith("?") && trimmed.length > 8) {
        out.push({ id: `q-${i++}`, text: trimmed, speaker: t.speaker });
      } else if (cueRe.test(trimmed) && trimmed.length < 80) {
        out.push({ id: `q-${i++}`, text: trimmed, speaker: t.speaker });
      }
    }
  }
  return out;
}

/** Extract risks / blockers / concerns. */
export function extractRisks(turns: SpeakerTurn[]): Risk[] {
  const out: Risk[] = [];
  let i = 0;
  for (const t of turns) {
    for (const s of splitSentences(t.text)) {
      for (const { cue, re } of RISK_CUES) {
        const m = s.match(re);
        if (m) {
          out.push({ id: `risk-${i++}`, text: s.trim(), cue });
          break;
        }
      }
    }
  }
  return out;
}

/** Extract follow-ups (questions + risk sentences combined). */
export function extractFollowUps(questions: OpenQuestion[], risks: Risk[]): string[] {
  const out: string[] = [];
  for (const q of questions) out.push(`Follow up: ${q.text}`);
  for (const r of risks) out.push(`Mitigate: ${r.text}`);
  return out;
}

// ---------- End-to-end summarization ----------

export interface SummarizeOptions {
  title?: string;
  length?: SummaryLength;
  chunkSize?: number;
}

/** Run the full summarization pipeline. Pure. */
export function summarizeTranscript(input: string, opts: SummarizeOptions = {}): MeetingMinutes {
  const title = opts.title || "Meeting Minutes";
  const length: SummaryLength = opts.length || "standard";
  const chunkSize = opts.chunkSize ?? 25;
  const warnings: string[] = [];

  if (!input || !input.trim()) {
    return {
      title,
      format: "plain",
      attendees: [],
      turns: [],
      tldr: "",
      summary: "",
      decisions: [],
      actionItems: [],
      openQuestions: [],
      risks: [],
      followUps: [],
      warnings: ["Empty transcript."],
      stats: { turnCount: 0, wordCount: 0, sentenceCount: 0, chunkCount: 0 },
    };
  }

  const format = detectFormat(input);
  const stripped = format === "plain" ? input : stripCues(input, format);
  const turns = groupTurns(stripped);
  const attendees = extractAttendees(turns);
  if (attendees.length === 0) {
    warnings.push("No speaker labels detected — used paragraph-level summarization.");
  }
  const sentences = buildSentences(turns);
  const tldr = generateTldr(turns, sentences);
  const { summary, chunkCount } = mapReduceSummary(turns, length, chunkSize);
  const decisions = extractDecisions(turns);
  const actionItems = extractActionItems(turns, attendees);
  const openQuestions = extractOpenQuestions(turns);
  const risks = extractRisks(turns);
  const followUps = extractFollowUps(openQuestions, risks);
  if (sentences.length > 200) {
    warnings.push("Long transcript — used map-reduce chunking. Review carefully.");
  }
  const wordCount = turns.reduce((acc, t) => acc + tokenizeWords(t.text).length, 0);
  return {
    title,
    format,
    attendees,
    turns,
    tldr,
    summary,
    decisions,
    actionItems,
    openQuestions,
    risks,
    followUps,
    warnings,
    stats: {
      turnCount: turns.length,
      wordCount,
      sentenceCount: sentences.length,
      chunkCount,
    },
  };
}

// ---------- Markdown render ----------

function escapeMd(s: string): string {
  return s.replace(/[\n\r]+/g, " ").trim();
}

/** Render minutes as Markdown. */
export function renderMarkdown(m: MeetingMinutes): string {
  const lines: string[] = [];
  lines.push(`# ${m.title}`);
  lines.push("");
  lines.push(`_Format: ${m.format} · ${m.stats.turnCount} turns · ${m.stats.wordCount} words · ${m.stats.sentenceCount} sentences · ${m.stats.chunkCount} chunk(s)._`);
  lines.push("");
  if (m.warnings.length > 0) {
    lines.push("> ⚠️ " + m.warnings.join(" "));
    lines.push("");
  }
  if (m.attendees.length > 0) {
    lines.push("## Attendees");
    lines.push("");
    for (const a of m.attendees) lines.push(`- ${a}`);
    lines.push("");
  }
  if (m.tldr) {
    lines.push("## TL;DR");
    lines.push("");
    lines.push(escapeMd(m.tldr));
    lines.push("");
  }
  if (m.summary) {
    lines.push("## Discussion summary");
    lines.push("");
    lines.push(escapeMd(m.summary));
    lines.push("");
  }
  if (m.decisions.length > 0) {
    lines.push("## Decisions");
    lines.push("");
    for (const d of m.decisions) lines.push(`- ${escapeMd(d.text)}`);
    lines.push("");
  }
  if (m.actionItems.length > 0) {
    lines.push("## Action items");
    lines.push("");
    for (const a of m.actionItems) {
      const owner = a.owner ? ` **@${a.owner}**` : "";
      const due = a.due ? ` _(due ${a.due})_` : "";
      lines.push(`- [ ] ${escapeMd(a.task)}${owner}${due}`);
    }
    lines.push("");
  }
  if (m.openQuestions.length > 0) {
    lines.push("## Open questions");
    lines.push("");
    for (const q of m.openQuestions) lines.push(`- ${escapeMd(q.text)}`);
    lines.push("");
  }
  if (m.risks.length > 0) {
    lines.push("## Risks / blockers");
    lines.push("");
    for (const r of m.risks) lines.push(`- ${escapeMd(r.text)}`);
    lines.push("");
  }
  if (m.followUps.length > 0) {
    lines.push("## Follow-ups");
    lines.push("");
    for (const f of m.followUps) lines.push(`- ${escapeMd(f)}`);
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

/** Render a recap email (plain text, copy-ready). */
export function renderRecapEmail(m: MeetingMinutes, senderName = "Your name"): string {
  const lines: string[] = [];
  lines.push(`Subject: Recap — ${m.title}`);
  lines.push("");
  lines.push("Hi team,");
  lines.push("");
  lines.push(`Here's a quick recap of ${m.title}.`);
  lines.push("");
  if (m.tldr) {
    lines.push("TL;DR:");
    lines.push(m.tldr);
    lines.push("");
  }
  if (m.decisions.length > 0) {
    lines.push("Decisions:");
    for (const d of m.decisions) lines.push(`  • ${d.text}`);
    lines.push("");
  }
  if (m.actionItems.length > 0) {
    lines.push("Action items:");
    for (const a of m.actionItems) {
      const owner = a.owner ? ` [${a.owner}]` : "";
      const due = a.due ? ` (due ${a.due})` : "";
      lines.push(`  • ${a.task}${owner}${due}`);
    }
    lines.push("");
  }
  if (m.openQuestions.length > 0) {
    lines.push("Open questions:");
    for (const q of m.openQuestions) lines.push(`  • ${q.text}`);
    lines.push("");
  }
  lines.push("Thanks,");
  lines.push(senderName);
  return lines.join("\n");
}

// ---------- History (localStorage) ----------

const HISTORY_KEY = "unqtools:ai-meeting-minutes-summarizer:history";
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

// ---------- Shareable URL ----------

export function buildShareUrl(transcript: string, opts: SummarizeOptions): string {
  const params = new URLSearchParams();
  if (transcript) params.set("t", transcript);
  if (opts.title) params.set("title", opts.title);
  if (opts.length) params.set("len", opts.length);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): {
  transcript: string;
  title: string;
  length: SummaryLength;
} {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { transcript: "", title: "", length: "standard" };
  const params = new URLSearchParams(clean);
  const transcript = params.get("t") ?? "";
  const title = params.get("title") ?? "";
  const lenRaw = params.get("len") ?? "standard";
  const length: SummaryLength =
    lenRaw === "brief" || lenRaw === "standard" || lenRaw === "detailed" ? lenRaw : "standard";
  return { transcript, title, length };
}

// ---------- Optional BYO-key LLM hook (stub, not invoked) ----------

export interface LLMAdapter {
  complete(prompt: string): Promise<string>;
}

/** Stub: returns the template summary untouched. Real adapters plug in here. */
export async function llmRefine(
  minutes: MeetingMinutes,
  adapter?: LLMAdapter,
): Promise<MeetingMinutes> {
  if (!adapter) return minutes;
  // Real implementation would call adapter.complete(...) and re-parse.
  return minutes;
}
