/**
 * Countdown Timer Generator (Embeddable) — Tool Manifest.
 * Tool #314 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "countdown-timer-generator",
  name: "Countdown Timer Generator (Embeddable)",
  description:
    "Generate a self-contained, watermark-free, embeddable countdown (or count-up) timer to any target date/time. Output as plain text, HTML widget snippet, or ICS calendar event. Per-visitor or fixed-timezone display, DST-safe, multiple themes/styles, on-finish behavior, recurring annual countdowns. 100% client-side.",
  category: "developer",
  keywords: [
    "countdown timer", "embeddable countdown", "countdown generator",
    "countdown to date", "ics calendar event", "count up timer",
    "vanilla js timer", "self-hosted countdown", "no watermark countdown",
    "website countdown widget",
  ],
  icon: "timer",
  requiresNetwork: false,
  seo: {
    title: "Countdown Timer Generator — Embeddable, No Watermark, ICS Export | UnQTools",
    faq: [
      {
        q: "Is the embeddable countdown truly self-contained?",
        a: "Yes. The exported HTML/CSS/JS snippet has zero external dependencies — no CDN, no tracking, no API calls. It runs entirely in your visitor's browser using setInterval. You can paste it into any plain HTML page, a CMS post, or an email-friendly stub. The ICS calendar export is a separate .ics file that opens in any calendar app.",
      },
      {
        q: "How does timezone handling work for visitors?",
        a: "Two modes: 'visitor-local' uses each visitor's own browser timezone (so everyone sees the countdown relative to their local clock — correct across DST), or 'fixed timezone' locks the target to a specific IANA zone (e.g. America/New_York, Europe/London). Internally the target is stored as a UTC instant and rendered with Intl.DateTimeFormat, so DST transitions are handled automatically.",
      },
      {
        q: "What happens when the countdown reaches zero?",
        a: "Three on-finish behaviors: show a custom message (default), hide the widget entirely, or redirect to a URL. After the target, an optional 'count-up' mode shows elapsed time since the target — useful for tracking how long since a launch or event.",
      },
      {
        q: "Can the countdown recur annually (e.g., a birthday)?",
        a: "Yes. Toggle 'Recurring annual' and the tool computes the next upcoming anniversary of the target date/time. When the current year's anniversary passes, the live widget automatically rolls forward to next year's occurrence.",
      },
      {
        q: "What extra features does this tool have versus other generators?",
        a: "(1) Plain-text countdown (D/H/M/S). (2) Embeddable HTML widget (zero dependencies). (3) Standalone full-page HTML export. (4) ICS calendar event export. (5) Per-visitor-local or fixed IANA timezone. (6) DST-safe via Intl.DateTimeFormat. (7) Count-up after target. (8) Three on-finish behaviors (message/hide/redirect). (9) Recurring annual countdowns. (10) Theme presets + style variants (digit/flip/simple). (11) localStorage history (max 20). (12) Shareable URL config. (13) Accessible aria-live updates + reduced-motion respect.",
      },
    ],
  },
  status: "done",
};
