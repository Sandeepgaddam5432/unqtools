/**
 * Text Typewriter Effect — pure logic. No DOM access.
 *
 * Splits text into timed segments based on per-character typing speed
 * (with optional variable delays for punctuation) and emits HTML for
 * a CSS-driven typewriter animation.
 */
export interface TypewriterOptions {
  /** Base characters per second. */
  cps: number;
  /** Multiply delay after sentence-ending punctuation. */
  sentencePause: number;
  /** Multiply delay after comma. */
  commaPause: number;
  /** Loop the animation. */
  loop: boolean;
}

export const DEFAULT_OPTIONS: TypewriterOptions = {
  cps: 12,
  sentencePause: 4,
  commaPause: 2,
  loop: true,
};

/** Validate options. */
export function validateOptions(opts: Partial<TypewriterOptions>): TypewriterOptions {
  return {
    cps: Math.max(1, Math.min(opts.cps ?? DEFAULT_OPTIONS.cps, 100)),
    sentencePause: Math.max(0, opts.sentencePause ?? DEFAULT_OPTIONS.sentencePause),
    commaPause: Math.max(0, opts.commaPause ?? DEFAULT_OPTIONS.commaPause),
    loop: opts.loop ?? DEFAULT_OPTIONS.loop,
  };
}

/** Compute the delay (ms) before showing character at index i. */
export function delayForChar(text: string, i: number, opts: TypewriterOptions): number {
  const base = 1000 / opts.cps;
  if (i === 0) return 0;
  const prev = text[i - 1]!;
  if (/[.!?]/.test(prev)) return base * opts.sentencePause;
  if (/[,;:]/.test(prev)) return base * opts.commaPause;
  return base;
}

/** Cumulative start time (ms) at which character i should appear. */
export function cumulativeStart(text: string, opts: TypewriterOptions): number[] {
  const starts: number[] = [0];
  for (let i = 1; i < text.length; i++) {
    starts.push(starts[i - 1]! + delayForChar(text, i, opts));
  }
  return starts;
}

/** Total animation duration in ms. */
export function totalDuration(text: string, opts: TypewriterOptions): number {
  if (!text) return 0;
  const starts = cumulativeStart(text, opts);
  return starts[starts.length - 1]! + 1000 / opts.cps;
}

/** Escape HTML special chars. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Generate HTML with each character revealed via CSS animation timing. */
export function typewriterHtml(text: string, opts: TypewriterOptions): string {
  if (!text) return "";
  const starts = cumulativeStart(text, opts);
  const total = totalDuration(text, opts);
  const lines = text.split("\n");
  let idx = 0;
  const htmlLines = lines.map((line) => {
    const escapedLine = escapeHtml(line);
    const spans = Array.from(line).map((ch) => {
      const start = starts[idx] ?? 0;
      const delay = (start / total) * 100;
      const safe = ch === " " ? "&nbsp;" : escapeHtml(ch);
      const s = `<span style="animation:tw ${total}ms steps(1) ${delay}% forwards;opacity:0">${safe}</span>`;
      idx++;
      return s;
    });
    return `<span data-raw="${escapedLine}">${spans.join("")}</span>`;
  });
  return htmlLines.join("<br/>");
}

/** Inline <style> for the typewriter keyframes. */
export function typewriterCss(): string {
  return "@keyframes tw{to{opacity:1}}";
}
