/**
 * Printable Calendar Generator — Tool Manifest.
 * Tool #315 — Category 4 (Developer & Code).
 *
 * Generate clean, print-perfect printable calendars (monthly, yearly, weekly,
 * multi-month grid) for any year. Pure-JS rendering to HTML + print CSS,
 * paper-size aware (Letter / Legal / A3 / A4 / A5 / Tabloid / custom), portrait
 * or landscape, Sunday / Monday / Saturday week start, locale month & weekday
 * names, ISO week numbers, day-of-year, offline holiday presets (US / UK / EU),
 * custom events, theme colors, title / subtitle, notes space, ICS import.
 * Fully client-side, no network, no upload, no watermark.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "printable-calendar-generator",
  name: "Printable Calendar Generator",
  description:
    "Generate clean, print-perfect printable calendars (monthly, yearly, weekly, multi-month grid) for any year as HTML with print CSS. Sunday / Monday / Saturday week start, locale month & day names, ISO week numbers, day-of-year, offline holiday presets (US / UK / EU), custom events, theme colors, paper sizes (Letter / Legal / A3 / A4 / A5 / Tabloid / custom), portrait / landscape. 100% client-side, no watermark.",
  category: "developer",
  keywords: [
    "printable calendar", "calendar generator", "calendar pdf",
    "monthly calendar", "yearly calendar", "weekly calendar",
    "calendar maker", "calendar printable", "calendar template",
    "week numbers", "iso week", "calendar with holidays",
    "ics import", "calendar 2026", "a4 calendar", "letter calendar",
  ],
  icon: "calendar",
  requiresNetwork: false,
  seo: {
    title: "Printable Calendar Generator — monthly, yearly, weekly, PDF-ready | UnQTools",
    faq: [
      {
        q: "What layouts and paper sizes does the printable calendar generator support?",
        a: "Four layouts: monthly (one month per page, large day cells), yearly (12 mini-months on one page), weekly (one week per row with notes column), and multi-month (a configurable 2-6 month grid). Paper sizes: US Letter (8.5x11 in), Legal (8.5x14 in), Tabloid (11x17 in), A3 (297x420 mm), A4 (210x297 mm), A5 (148x210 mm), and custom dimensions. Portrait or landscape orientation. The HTML output is print-CSS aware so the browser's Print to PDF produces a true-vector, watermark-free file.",
      },
      {
        q: "Can I choose Sunday, Monday or Saturday as the first day of the week?",
        a: "Yes. The Week start dropdown lets you pick Sunday (US convention), Monday (ISO 8601 / most of the world) or Saturday (Middle-East convention). Week numbers, weekend highlighting and the weekly layout all respect the chosen start day. When Monday is selected, week numbers follow ISO 8601 (week 1 contains the year's first Thursday); for other start days we still compute an ISO week number for reference.",
      },
      {
        q: "How are holidays and events added?",
        a: "Three ways. (1) Toggle a built-in holiday preset — US federal, UK bank holidays, or common European holidays — computed locally with no API calls (including Easter via the Computus algorithm). (2) Add custom events one by one (date + title + color). (3) Paste an ICS file's contents to import events — VEVENTs with DTSTART are parsed and merged. Holidays appear as small badges in the day cell; custom events appear as colored dots with the title. The Today cell is highlighted when generating for the current month.",
      },
      {
        q: "What extra features does this tool have compared to other calendar generators?",
        a: "(1) Four layouts (monthly / yearly / weekly / multi-month). (2) Six paper sizes plus custom dimensions. (3) Portrait and landscape. (4) Three week-start conventions. (5) Ten locale presets for month and day names. (6) Three offline holiday presets (US / UK / EU) with Easter. (7) Custom events with colors. (8) ICS import. (9) Five themes (light / dark / sepia / blue / green). (10) Title + subtitle on every page. (11) Optional notes column. (12) ISO week numbers and day-of-year. (13) Today highlight. (14) localStorage history (max 20). (15) Shareable URL (fragment-encoded, never uploaded).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All calendar rendering runs locally in the browser using pure JavaScript — no API calls, no uploads, no watermarks, no account. The print-CSS HTML is opened in a new window or saved directly; ICS imports are parsed locally. History is stored in localStorage on this device only and contains only metadata (year, layout, paper size), never your custom event titles.",
      },
    ],
  },
  status: "done",
};
