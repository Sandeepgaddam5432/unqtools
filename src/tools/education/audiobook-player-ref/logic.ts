/**
 * Audiobook Player Reference — pure logic.
 *
 * A read-only reference companion for audiobook listeners: computes
 * effective listening speed ratios, total listening time at a given
 * playback rate, the chapter you'll reach within a fixed session,
 * a bookmark format spec, and a resume-point serialiser.
 *
 * No actual audio playback is performed — this is a planning helper.
 */

export type Speed = 0.75 | 1 | 1.25 | 1.5 | 1.75 | 2;

export interface Chapter {
  index: number; // 1-based
  title: string;
  /** Chapter duration in seconds. */
  durationSec: number;
}

export interface Audiobook {
  title: string;
  author: string;
  chapters: Chapter[];
  /** Total runtime in seconds (defaults to sum of chapters). */
  totalDurationSec?: number;
}

export interface SpeedRow {
  speed: Speed;
  totalListeningMin: number;
  timeSavedMin: number;
  percentSaved: number;
}

export interface AudiobookResult {
  totalDurationSec: number;
  totalListeningMin: number;
  speeds: SpeedRow[];
  recommendedSpeed: Speed;
  bookmarks: { id: string; chapter: number; offsetSec: number; label: string }[];
  sessionPlan: { minutes: number; reachableChapter: number; offsetInChapterSec: number };
  resumePoint: { chapter: number; offsetSec: number; serialised: string };
  notes: string[];
  warnings: string[];
}

const SPEEDS: Speed[] = [0.75, 1, 1.25, 1.5, 1.75, 2];

function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}h ${m}m ${ss}s`;
  if (m > 0) return `${m}m ${ss}s`;
  return `${ss}s`;
}

export function formatDuration(sec: number): string {
  return fmtDuration(sec);
}

/**
 * Compute speed ratios, session plan, and a resume point.
 * `sessionMinutes` defaults to 30; `resumeAtSec` defaults to 0.
 */
export function analyzeAudiobook(
  book: Audiobook,
  options: { sessionMinutes?: number; resumeAtSec?: number; recommendedSpeed?: Speed } = {},
): AudiobookResult | { error: string } {
  if (!book.chapters || book.chapters.length === 0) return { error: "Audiobook must have at least one chapter." };
  const totalDurationSec = book.totalDurationSec ?? book.chapters.reduce((s, c) => s + c.durationSec, 0);
  if (totalDurationSec <= 0) return { error: "Total duration must be greater than 0." };

  const sessionMinutes = options.sessionMinutes ?? 30;
  const resumeAtSec = options.resumeAtSec ?? 0;
  const warnings: string[] = [];

  // Speed rows: at 1.5× a 60-min book takes 40 min, saving 20 min
  const speeds: SpeedRow[] = SPEEDS.map((speed) => {
    const listeningSec = totalDurationSec / speed;
    const savedSec = totalDurationSec - listeningSec;
    return {
      speed,
      totalListeningMin: Math.round(listeningSec / 60),
      timeSavedMin: Math.round(savedSec / 60),
      percentSaved: Math.round((savedSec / totalDurationSec) * 100),
    };
  });

  // Recommended speed: pick 1.25 or 1.5 based on length (longer → faster)
  let recommendedSpeed: Speed = options.recommendedSpeed ?? 1;
  if (!options.recommendedSpeed) {
    const hours = totalDurationSec / 3600;
    if (hours < 3) recommendedSpeed = 1;
    else if (hours < 8) recommendedSpeed = 1.25;
    else if (hours < 15) recommendedSpeed = 1.5;
    else recommendedSpeed = 1.75;
  }

  // Bookmarks: one per chapter at chapter start
  const bookmarks = book.chapters.map((c) => ({
    id: `bm-${c.index.toString().padStart(3, "0")}`,
    chapter: c.index,
    offsetSec: 0,
    label: `Chapter ${c.index}: ${c.title}`,
  }));

  // Session plan: which chapter will you reach after `sessionMinutes`?
  let elapsed = 0;
  const sessionSec = sessionMinutes * 60;
  let reachableChapter = book.chapters[0]!.index;
  let offsetInChapterSec = 0;
  for (const c of book.chapters) {
    const chapterAdjusted = c.durationSec / recommendedSpeed;
    if (elapsed + chapterAdjusted >= sessionSec) {
      reachableChapter = c.index;
      offsetInChapterSec = (sessionSec - elapsed) * recommendedSpeed;
      break;
    }
    elapsed += chapterAdjusted;
    reachableChapter = c.index;
    offsetInChapterSec = c.durationSec;
  }

  // Resume point: find chapter containing resumeAtSec (wall-clock seconds)
  let resumeChapter = book.chapters[0]!.index;
  let resumeOffsetSec = resumeAtSec;
  let acc = 0;
  for (const c of book.chapters) {
    if (acc + c.durationSec > resumeAtSec) {
      resumeChapter = c.index;
      resumeOffsetSec = resumeAtSec - acc;
      break;
    }
    acc += c.durationSec;
    resumeChapter = c.index;
    resumeOffsetSec = c.durationSec;
  }
  if (resumeAtSec > totalDurationSec) {
    warnings.push("Resume point is past the end of the audiobook — clamping to final chapter.");
  }

  const notes = [
    `Total duration: ${fmtDuration(totalDurationSec)}`,
    `Recommended speed: ${recommendedSpeed}× (effective listening time ${fmtDuration(totalDurationSec / recommendedSpeed)})`,
    `Session of ${sessionMinutes} min at ${recommendedSpeed}× reaches chapter ${reachableChapter}.`,
    "Bookmarks use the format: bm-NNN @ chapter N offset Ss — paste into your player's notes field.",
  ];

  if (recommendedSpeed >= 1.75) warnings.push("Speeds above 1.5× may reduce comprehension for dense material.");
  if (sessionMinutes > 120) warnings.push("Long listening sessions risk fatigue — consider breaks.");

  return {
    totalDurationSec,
    totalListeningMin: Math.round(totalDurationSec / 60),
    speeds,
    recommendedSpeed,
    bookmarks,
    sessionPlan: { minutes: sessionMinutes, reachableChapter, offsetInChapterSec: Math.round(offsetInChapterSec) },
    resumePoint: {
      chapter: resumeChapter,
      offsetSec: Math.round(resumeOffsetSec),
      serialised: `resume://chapter=${resumeChapter};offset=${Math.round(resumeOffsetSec)}s`,
    },
    notes,
    warnings,
  };
}

/** Convert bookmarks to a CSV. */
export function bookmarksToCsv(book: Audiobook): string {
  const lines = ["ID,Chapter,Offset (sec),Label"];
  for (const c of book.chapters) {
    lines.push(`bm-${c.index.toString().padStart(3, "0")},${c.index},0,"${c.title.replace(/"/g, '""')}"`);
  }
  return lines.join("\n");
}

/** Build a sample audiobook for the UI. */
export function sampleAudiobook(): Audiobook {
  return {
    title: "The Sample Book",
    author: "Jane Author",
    chapters: [
      { index: 1, title: "Introduction", durationSec: 1200 },
      { index: 2, title: "Chapter 1: Beginnings", durationSec: 2400 },
      { index: 3, title: "Chapter 2: The Journey", durationSec: 3000 },
      { index: 4, title: "Chapter 3: Discoveries", durationSec: 2700 },
      { index: 5, title: "Chapter 4: Challenges", durationSec: 3300 },
      { index: 6, title: "Conclusion", durationSec: 1500 },
    ],
  };
}
