/**
 * Time Unit Converter — Tool Manifest.
 * Tool #320 — Category 4 (Developer & Code).
 *
 * Convert between every time unit from nanoseconds to centuries (ns, μs,
 * ms, s, min, h, d, wk, mo, yr, decade, century) with explicit, switchable
 * month (28/30/30.44/31) and year (365/365.25/366) definitions. BigInt-safe
 * down to nanoseconds. Single input fans out to all units. Humanize mode
 * ("1d 1h 1m 1s"), inverse parser, dev units (ticks, jiffies, frames@fps),
 * JS/Python code snippets. Shareable link. 100% client-side, no network.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "time-unit-converter",
  name: "Time Unit Converter",
  description:
    "Convert between every time unit — nanoseconds, microseconds, milliseconds, seconds, minutes, hours, days, weeks, months, years, decades, centuries — with explicit, switchable month (28/30/30.44/31) and year (365/365.25/366) definitions. BigInt-safe down to nanoseconds, so even huge magnitudes stay exact. Single input fans out to all units. Humanize mode ('1d 1h 1m 1s'), inverse parser, dev units (ticks, jiffies, frames@fps) and JS/Python code snippets. 100% client-side.",
  category: "developer",
  keywords: [
    "time unit converter", "nanoseconds to seconds", "milliseconds to seconds",
    "seconds to hours", "seconds to minutes", "hours to days",
    "humanize duration", "time conversion table", "ticks converter",
    "jiffies", "frames to seconds", "seconds to years",
  ],
  icon: "clock",
  requiresNetwork: false,
  seo: {
    title: "Time Unit Converter — ns to centuries, BigInt-exact, humanize | UnQTools",
    faq: [
      {
        q: "How does this converter handle month and year ambiguity?",
        a: "A 'month' and a 'year' aren't a fixed number of seconds — a month can be 28, 29, 30 or 31 days, and a year can be 365 or 366 days (or 365.25 averaged). This tool surfaces that ambiguity rather than hiding it: you pick an explicit month definition (28, 30, 30.44 average, or 31 days) and year definition (365, 365.25 average, or 366 days). Every conversion uses the chosen definition, so you always know exactly what '1 month' means.",
      },
      {
        q: "Why does this tool use BigInt and how does it preserve nanosecond precision?",
        a: "JavaScript Number is a 64-bit float, so beyond about 9 × 10¹⁵ (a few months in nanoseconds) it loses integer precision. This tool stores the source value internally as BigInt nanoseconds and computes every conversion in integer math, only converting to Number (or a scientific-notation string) at the very end for display. That means 1 year = 31_536_000_000_000_000 ns stays exact, and even centuries stay precise to the nanosecond.",
      },
      {
        q: "What is the humanize duration mode?",
        a: "Humanize takes a value in seconds (or any unit) and expresses it as a friendly compound string like '1d 1h 1m 1s' instead of 90061. It picks the largest meaningful units and only shows as many as you ask for (e.g. top 3 units). The inverse parser does the opposite: type '1d 1h 1m 1s' and get back 90061 seconds. They round-trip cleanly so you can copy a humanized duration and paste it back to verify.",
      },
      {
        q: "What are the developer units (ticks, jiffies, frames)?",
        a: "Ticks (.NET) are 100 ns each. Jiffies (Linux) historically are 10 ms each (HZ=100) but you can configure the HZ rate. Frames are a media unit: at 60 fps one frame is 1/60 s, at 30 fps it's 1/30 s. This tool lets you set the fps for frame conversion and the HZ rate for jiffies, so you can convert a frame count to milliseconds for video timing, or a tick count to nanoseconds for .NET diagnostics.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 12 base time units from ns to centuries. (2) Switchable month (28/30/30.44/31) and year (365/365.25/366) definitions, surfaced not hidden. (3) BigInt-exact integer math down to ns — no float rounding. (4) Single-input fan-out batch table to every unit. (5) Humanize mode (seconds → '1d 1h 1m 1s'). (6) Inverse parser ('1d 1h' → seconds). (7) Dev units: ticks (100 ns), jiffies (configurable HZ), frames (configurable fps). (8) JS and Python code snippets for the conversion. (9) Scientific notation for very small / very large magnitudes. (10) Copy-per-row buttons. (11) Shareable URL encoding value + source unit + definitions. (12) localStorage history (max 20, metadata only). (13) 100% offline, no network.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All conversion math runs locally with native BigInt. History is stored in localStorage on this device only and contains just the value + unit + definitions, never any notes or external data.",
      },
    ],
  },
  status: "done",
};
