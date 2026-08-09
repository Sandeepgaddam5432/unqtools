/**
 * Timezone Converter — Tool Manifest
 * Convert a date/time between any two timezones, entirely offline
 * (uses the browser's native Intl / IANA timezone data).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "timezone-converter",
  name: "Timezone Converter",
  description:
    "Convert a date & time between any two IANA timezones — fully offline with the browser's native timezone database. See the result in all timezones at once, with DST handling, UTC offset, and 12/24-hour toggles. 100% private.",
  category: "developer",
  keywords: [
    "timezone converter",
    "time zone converter",
    "world clock",
    "convert time",
    "UTC offset",
    "DST",
    "meeting time",
    "international time",
    "time difference",
  ],
  icon: "Clock",
  requiresNetwork: false,
  seo: {
    title: "Timezone Converter — Convert Time Between Any Two Zones | UnQTools",
    faq: [
      {
        q: "Does this need internet?",
        a: "No. It uses the browser's built-in Intl API and IANA timezone database, which is bundled with every modern browser. All conversion happens locally — your data never leaves your device.",
      },
      {
        q: "Does it handle daylight saving time (DST)?",
        a: "Yes. Because conversions use the browser's real timezone database, DST transitions are handled automatically and correctly for every region.",
      },
      {
        q: "What extras does this tool have?",
        a: "Extras: (1) 400+ IANA timezones; (2) Convert between any two zones; (3) See the moment in ALL zones at once; (4) Automatic DST + UTC offset display; (5) 12/24-hour toggle; (6) Now button; (7) Copy result; (8) Swap zones; (9) Searchable zone list with city names; (10) Date + time together; (11) Meeting-friendly time summary; (12) 100% offline.",
      },
    ],
  },
  status: "done",
};
