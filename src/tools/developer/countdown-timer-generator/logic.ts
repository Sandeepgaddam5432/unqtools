/**
 * Countdown Timer Generator (Embeddable) — pure logic.
 *
 * Compute a countdown (or count-up) to any target date/time, render it as
 * plain text, an embeddable HTML widget, a standalone HTML page, or an ICS
 * calendar event. Supports per-visitor-local or fixed IANA timezone, DST-safe
 * display, themes, style variants, on-finish behaviors, and recurring annual
 * countdowns.
 *
 * Pure functions only — no DOM, no network.
 */

export type Style = "digit" | "flip" | "simple";
export type Theme = "dark" | "light" | "neon" | "minimal";
export type OnFinish = "message" | "hide" | "redirect";
export type TimezoneMode = "visitor" | "fixed";

export interface TimerConfig {
  /** ISO 8601 target, e.g. "2025-12-31T23:59:59Z" or "2025-12-31T18:00:00-05:00". */
  targetIso: string;
  title: string;
  timezoneMode: TimezoneMode;
  /** IANA timezone when mode === "fixed", e.g. "America/New_York". */
  fixedTimezone?: string;
  style: Style;
  theme: Theme;
  onFinish: OnFinish;
  finishedMessage?: string;
  redirectUrl?: string;
  countUpAfterTarget: boolean;
  recurringAnnual: boolean;
  showLabels: boolean;
}

export interface CountdownParts {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** True when now ≥ target. */
  isFinished: boolean;
  /** Effective target (already rolled forward for recurring). */
  effectiveTargetIso: string;
}

export const STYLE_LABELS: Record<Style, string> = {
  digit: "Digit blocks",
  flip: "Flip clock",
  simple: "Simple text",
};

export const THEME_LABELS: Record<Theme, string> = {
  dark: "Dark",
  light: "Light",
  neon: "Neon",
  minimal: "Minimal",
};

export const THEME_COLORS: Record<Theme, { bg: string; fg: string; accent: string; label: string }> = {
  dark:   { bg: "#0f172a", fg: "#f1f5f9", accent: "#38bdf8", label: "#94a3b8" },
  light:  { bg: "#f8fafc", fg: "#0f172a", accent: "#2563eb", label: "#475569" },
  neon:   { bg: "#0a0a0a", fg: "#22d3ee", accent: "#a3e635", label: "#fb7185" },
  minimal:{ bg: "transparent", fg: "#111111", accent: "#111111", label: "#666666" },
};

export const SAMPLE_TIMEZONES: string[] = [
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export const STYLE_OPTIONS: Style[] = ["digit", "flip", "simple"];
export const THEME_OPTIONS: Theme[] = ["dark", "light", "neon", "minimal"];
export const ONFINISH_OPTIONS: OnFinish[] = ["message", "hide", "redirect"];

// ---------------------------------------------------------------------------
// Parsing & validation
// ---------------------------------------------------------------------------

/** Parse and validate an ISO datetime string. Returns null on failure. */
export function parseTargetDateTime(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Validate a fixed IANA timezone string. */
export function validateTimezone(tz: string): boolean {
  if (!tz) return false;
  try {
    // Intl.DateTimeFormat throws RangeError for invalid zones.
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Validate the full TimerConfig; returns { ok, errors }. */
export function validateConfig(cfg: TimerConfig): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const target = parseTargetDateTime(cfg.targetIso);
  if (!target) errors.push("Target date/time is invalid or empty (use ISO 8601).");
  if (cfg.timezoneMode === "fixed") {
    if (!cfg.fixedTimezone) {
      errors.push("Fixed timezone selected but no zone provided.");
    } else if (!validateTimezone(cfg.fixedTimezone)) {
      errors.push(`Unknown IANA timezone: ${cfg.fixedTimezone}`);
    }
  }
  if (cfg.onFinish === "redirect" && !cfg.redirectUrl) {
    errors.push("Redirect on-finish selected but no redirect URL provided.");
  }
  if (cfg.onFinish === "message" && !cfg.finishedMessage) {
    errors.push("Message on-finish selected but no message provided.");
  }
  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Countdown math
// ---------------------------------------------------------------------------

/** Round-truncate ms to whole seconds. */
function floorMs(ms: number): number {
  return Math.floor(ms / 1000) * 1000;
}

/** If recurring annual, roll the target forward to the next upcoming anniversary. */
export function rollRecurringAnnual(target: Date, now: Date): Date {
  if (target.getTime() >= now.getTime()) return target;
  let next = new Date(target);
  // Walk forward year by year until next >= now. Safe for far-future targets too.
  while (next.getTime() < now.getTime()) {
    next = new Date(target.getFullYear() + (next.getFullYear() - target.getFullYear() + 1), target.getMonth(), target.getDate(), target.getHours(), target.getMinutes(), target.getSeconds(), target.getMilliseconds());
  }
  return next;
}

/** Compute the countdown parts from a target & current time. */
export function computeCountdown(cfg: TimerConfig, now: Date = new Date()): CountdownParts {
  const target = parseTargetDateTime(cfg.targetIso);
  if (!target) {
    return {
      totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0,
      isFinished: false, effectiveTargetIso: cfg.targetIso,
    };
  }
  const eff = cfg.recurringAnnual ? rollRecurringAnnual(target, now) : target;
  const totalMs = eff.getTime() - now.getTime();
  const finished = totalMs <= 0;
  const abs = Math.abs(floorMs(totalMs));
  const days = Math.floor(abs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((abs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((abs % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((abs % (60 * 1000)) / 1000);
  return {
    totalMs,
    days,
    hours,
    minutes,
    seconds,
    isFinished: finished,
    effectiveTargetIso: eff.toISOString(),
  };
}

/** Format a CountdownParts as plain text. */
export function formatCountdown(cfg: TimerConfig, parts: CountdownParts): string {
  const targetLabel = formatTargetLabel(cfg);
  if (parts.isFinished && !cfg.countUpAfterTarget) {
    if (cfg.onFinish === "message" && cfg.finishedMessage) {
      return `${cfg.title} — ${cfg.finishedMessage}`;
    }
    return `${cfg.title} — reached ${targetLabel}`;
  }
  if (parts.isFinished && cfg.countUpAfterTarget) {
    return `${cfg.title} — elapsed ${parts.days}d ${pad2(parts.hours)}h ${pad2(parts.minutes)}m ${pad2(parts.seconds)}s since ${targetLabel}`;
  }
  return `${cfg.title} — ${parts.days}d ${pad2(parts.hours)}h ${pad2(parts.minutes)}m ${pad2(parts.seconds)}s until ${targetLabel}`;
}

/** Render a human label for the target including its timezone. */
export function formatTargetLabel(cfg: TimerConfig): string {
  const target = parseTargetDateTime(cfg.targetIso);
  if (!target) return "(invalid target)";
  if (cfg.timezoneMode === "fixed" && cfg.fixedTimezone && validateTimezone(cfg.fixedTimezone)) {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: cfg.fixedTimezone,
        dateStyle: "medium",
        timeStyle: "long",
      }).format(target) + ` (${cfg.fixedTimezone})`;
    } catch {
      return target.toUTCString();
    }
  }
  return target.toUTCString();
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

// ---------------------------------------------------------------------------
// HTML widget generation
// ---------------------------------------------------------------------------

interface WidgetParts {
  html: string;
  css: string;
  js: string;
}

/** Generate HTML, CSS, and JS parts of the embeddable widget. */
export function generateWidgetParts(cfg: TimerConfig): WidgetParts {
  const colors = THEME_COLORS[cfg.theme];
  const target = parseTargetDateTime(cfg.targetIso);
  const targetMs = target ? target.getTime() : 0;
  const instanceId = `unq-cd-${Math.random().toString(36).slice(2, 9)}`;

  // ---- HTML ----
  const html = buildWidgetHtml(cfg, instanceId);

  // ---- CSS ----
  const css = buildWidgetCss(cfg, instanceId, colors);

  // ---- JS ----
  const js = buildWidgetJs(cfg, instanceId, targetMs);

  return { html, css, js };
}

function buildWidgetHtml(cfg: TimerConfig, id: string): string {
  const labels = cfg.showLabels;
  const block = (unit: string, label: string) => `
      <div class="unq-cd-unit">
        <div class="unq-cd-num" data-unit="${unit}">00</div>${labels ? `\n        <div class="unq-cd-lbl">${label}</div>` : ""}
      </div>`;
  if (cfg.style === "simple") {
    return `<div class="unq-cd unq-cd-simple" id="${id}" role="timer" aria-live="polite" aria-atomic="true">
  <div class="unq-cd-title">${escapeHtml(cfg.title)}</div>
  <div class="unq-cd-text" data-unit="text">—</div>
</div>`;
  }
  if (cfg.style === "flip") {
    return `<div class="unq-cd unq-cd-flip" id="${id}" role="timer" aria-live="polite" aria-atomic="true">
  <div class="unq-cd-title">${escapeHtml(cfg.title)}</div>
  <div class="unq-cd-flip-grid">${block("days", "Days")}${block("hours", "Hours")}${block("minutes", "Minutes")}${block("seconds", "Seconds")}
  </div>
</div>`;
  }
  return `<div class="unq-cd unq-cd-digit" id="${id}" role="timer" aria-live="polite" aria-atomic="true">
  <div class="unq-cd-title">${escapeHtml(cfg.title)}</div>
  <div class="unq-cd-grid">${block("days", "Days")}${block("hours", "Hours")}${block("minutes", "Minutes")}${block("seconds", "Seconds")}
  </div>
</div>`;
}

function buildWidgetCss(cfg: TimerConfig, id: string, colors: { bg: string; fg: string; accent: string; label: string }): string {
  const reduceMotion = "@media (prefers-reduced-motion: reduce) { .unq-cd-flip-card { animation: none !important; transform: none !important; } }";
  const base = `
#${id} {
  --bg: ${colors.bg};
  --fg: ${colors.fg};
  --accent: ${colors.accent};
  --lbl: ${colors.label};
  background: var(--bg);
  color: var(--fg);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  padding: 1rem 1.25rem;
  border-radius: 0.5rem;
  display: inline-block;
  min-width: 280px;
  text-align: center;
  box-sizing: border-box;
}
#${id} .unq-cd-title { font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--accent); text-transform: uppercase; letter-spacing: 0.05em; }
#${id} .unq-cd-grid, #${id} .unq-cd-flip-grid { display: flex; gap: 0.5rem; justify-content: center; align-items: flex-start; }
#${id} .unq-cd-unit { display: flex; flex-direction: column; align-items: center; min-width: 3rem; }
#${id} .unq-cd-num { font-size: 1.75rem; font-weight: 700; line-height: 1; color: var(--fg); background: rgba(0,0,0,0.15); padding: 0.4rem 0.5rem; border-radius: 0.35rem; min-width: 2.5rem; text-align: center; }
#${id} .unq-cd-lbl { font-size: 0.65rem; margin-top: 0.25rem; color: var(--lbl); text-transform: uppercase; letter-spacing: 0.05em; }
#${id} .unq-cd-text { font-size: 1.25rem; font-weight: 600; color: var(--fg); }
#${id} .unq-cd-done { color: var(--accent); font-size: 1.25rem; font-weight: 700; }
${reduceMotion}
/* Flip-card subtle hover */
#${id} .unq-cd-flip .unq-cd-num { perspective: 200px; }
#${id}.unq-cd-flip .unq-cd-num::after { content: ""; display:block; height: 1px; background: var(--accent); opacity: 0.35; margin-top: 4px; }
`;
  return base.trim();
}

function buildWidgetJs(cfg: TimerConfig, id: string, targetMs: number): string {
  // Self-contained vanilla JS — no external dependencies.
  const opts: string[] = [
    `targetMs: ${targetMs}`,
    `recurring: ${cfg.recurringAnnual ? "true" : "false"}`,
    `countUp: ${cfg.countUpAfterTarget ? "true" : "false"}`,
    `onFinish: ${JSON.stringify(cfg.onFinish)}`,
    `finishedMessage: ${JSON.stringify(cfg.finishedMessage ?? "")}`,
    `redirectUrl: ${JSON.stringify(cfg.redirectUrl ?? "")}`,
  ];
  return `(function(){
  var cfg = { ${opts.join(", ")} };
  var root = document.getElementById(${JSON.stringify(id)});
  if (!root) return;
  function rollAnnual(ms){ var d = new Date(ms); var now = new Date(); while (d.getTime() < now.getTime()){ d = new Date(d.getFullYear()+1, d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()); } return d.getTime(); }
  function tick(){
    var now = Date.now();
    var tgt = cfg.recurring ? rollAnnual(cfg.targetMs) : cfg.targetMs;
    var diff = tgt - now;
    var finished = diff <= 0;
    if (finished && cfg.onFinish === "hide"){ root.style.display = "none"; clearInterval(timerId); return; }
    if (finished && cfg.onFinish === "redirect" && cfg.redirectUrl){ window.location.href = cfg.redirectUrl; clearInterval(timerId); return; }
    var abs = Math.abs(Math.floor(diff / 1000) * 1000);
    var days = Math.floor(abs / 86400000);
    var hrs = Math.floor((abs % 86400000) / 3600000);
    var min = Math.floor((abs % 3600000) / 60000);
    var sec = Math.floor((abs % 60000) / 1000);
    var pad = function(n){ return n < 10 ? "0"+n : ""+n; };
    if (cfg.onFinish === "message" && finished && !cfg.countUp){
      var msg = cfg.finishedMessage || "Countdown finished";
      root.innerHTML = "<div class=\\"unq-cd-title\\">" + ${JSON.stringify(escapeHtml(cfg.title))} + "</div><div class=\\"unq-cd-done\\">" + msg + "</div>";
      clearInterval(timerId); return;
    }
    var dE = root.querySelector("[data-unit='days']");
    var hE = root.querySelector("[data-unit='hours']");
    var mE = root.querySelector("[data-unit='minutes']");
    var sE = root.querySelector("[data-unit='seconds']");
    var tE = root.querySelector("[data-unit='text']");
    if (tE) {
      var label = finished && cfg.countUp ? "since " : "until ";
      tE.textContent = pad(days)+"d "+pad(hrs)+"h "+pad(min)+"m "+pad(sec)+"s " + label;
    } else {
      if (dE) dE.textContent = pad(days);
      if (hE) hE.textContent = pad(hrs);
      if (mE) mE.textContent = pad(min);
      if (sE) sE.textContent = pad(sec);
    }
  }
  tick();
  var timerId = setInterval(tick, 1000);
})();`;
}

/** Generate the full embeddable HTML widget snippet (copy-paste ready). */
export function generateEmbedSnippet(cfg: TimerConfig): string {
  const parts = generateWidgetParts(cfg);
  return `<!-- UnQTools countdown widget — self-contained, no dependencies -->
<style>
${parts.css}
</style>
${parts.html}
<script>
${parts.js}
</script>
<!-- End UnQTools countdown widget -->`;
}

/** Generate a complete standalone HTML page export. */
export function generateStandaloneHtml(cfg: TimerConfig): string {
  const parts = generateWidgetParts(cfg);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(cfg.title)} — Countdown</title>
<style>
body { margin: 0; padding: 2rem; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0b0f17; font-family: ui-sans-serif, system-ui, sans-serif; }
.wrap { max-width: 720px; }
.note { color: #94a3b8; font-size: 0.75rem; margin-top: 1rem; text-align: center; }
${parts.css}
</style>
</head>
<body>
<div class="wrap">
${parts.html}
<p class="note">Self-hosted countdown · no tracking · no dependencies</p>
</div>
<script>
${parts.js}
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// ICS calendar event export
// ---------------------------------------------------------------------------

/** Generate an ICS calendar event for the target. */
export function generateIcsEvent(cfg: TimerConfig): string {
  const target = parseTargetDateTime(cfg.targetIso);
  if (!target) {
    throw new Error("Cannot generate ICS for invalid target date.");
  }
  const dtStart = formatIcsDate(target);
  // Default 1-hour event.
  const dtEnd = new Date(target.getTime() + 60 * 60 * 1000);
  const dtEndStr = formatIcsDate(dtEnd);
  const now = formatIcsDate(new Date());
  const uid = `${now}-${Math.random().toString(36).slice(2, 10)}@unqtools`;
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//UnQTools//Countdown Timer Generator//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEndStr}`,
    `SUMMARY:${escapeIcs(cfg.title)}`,
    `DESCRIPTION:${escapeIcs(formatTargetLabel(cfg))}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  // ICS lines should be ≤75 octets; fold long lines with CRLF + space.
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

function formatIcsDate(d: Date): string {
  // YYYYMMDDTHHMMSSZ (UTC)
  const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = d.getUTCDate().toString().padStart(2, "0");
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mi = d.getUTCMinutes().toString().padStart(2, "0");
  const ss = d.getUTCSeconds().toString().padStart(2, "0");
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

function escapeIcs(s: string): string {
  return (s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    out.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length > 0) out.push(" " + rest);
  return out.join("\r\n");
}

// ---------------------------------------------------------------------------
// Escaping
// ---------------------------------------------------------------------------

export function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:countdown-timer-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  title: string;
  targetIso: string;
  style: Style;
  theme: Theme;
  recurringAnnual: boolean;
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

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

export function buildShareUrl(cfg: TimerConfig): string {
  const sp = new URLSearchParams();
  if (cfg.targetIso) sp.set("t", cfg.targetIso);
  if (cfg.title) sp.set("title", cfg.title);
  sp.set("tz", cfg.timezoneMode);
  if (cfg.fixedTimezone) sp.set("zone", cfg.fixedTimezone);
  sp.set("style", cfg.style);
  sp.set("theme", cfg.theme);
  sp.set("onFinish", cfg.onFinish);
  if (cfg.finishedMessage) sp.set("msg", cfg.finishedMessage);
  if (cfg.redirectUrl) sp.set("url", cfg.redirectUrl);
  sp.set("countUp", cfg.countUpAfterTarget ? "1" : "0");
  sp.set("recurring", cfg.recurringAnnual ? "1" : "0");
  sp.set("labels", cfg.showLabels ? "1" : "0");
  if (typeof window === "undefined") return `?${sp.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${sp.toString()}`;
}

export function parseShareUrl(hash: string): Partial<TimerConfig> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const sp = new URLSearchParams(clean);
  const out: Partial<TimerConfig> = {};
  if (sp.get("t")) out.targetIso = sp.get("t")!;
  if (sp.get("title")) out.title = sp.get("title")!;
  const tz = sp.get("tz");
  if (tz === "visitor" || tz === "fixed") out.timezoneMode = tz;
  if (sp.get("zone")) out.fixedTimezone = sp.get("zone")!;
  const style = sp.get("style");
  if (style && (style === "digit" || style === "flip" || style === "simple")) out.style = style;
  const theme = sp.get("theme");
  if (theme && THEME_OPTIONS.includes(theme as Theme)) out.theme = theme as Theme;
  const onFinish = sp.get("onFinish");
  if (onFinish && ONFINISH_OPTIONS.includes(onFinish as OnFinish)) out.onFinish = onFinish as OnFinish;
  if (sp.get("msg")) out.finishedMessage = sp.get("msg")!;
  if (sp.get("url")) out.redirectUrl = sp.get("url")!;
  out.countUpAfterTarget = sp.get("countUp") === "1";
  out.recurringAnnual = sp.get("recurring") === "1";
  out.showLabels = sp.get("labels") !== "0";
  return out;
}

/** Build a default TimerConfig for new sessions. */
export function defaultConfig(): TimerConfig {
  const future = new Date();
  future.setFullYear(future.getFullYear() + 1);
  future.setHours(0, 0, 0, 0);
  return {
    targetIso: future.toISOString(),
    title: "Countdown to event",
    timezoneMode: "visitor",
    fixedTimezone: "UTC",
    style: "digit",
    theme: "dark",
    onFinish: "message",
    finishedMessage: "🎉 The wait is over!",
    redirectUrl: "",
    countUpAfterTarget: false,
    recurringAnnual: false,
    showLabels: true,
  };
}
