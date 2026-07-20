/**
 * Unix Timestamp / Epoch Converter — Tool Manifest.
 * Tool #301 — Category 4 (Developer & Code).
 *
 * Convert between Unix/epoch timestamps and human-readable dates in both
 * directions — auto-detecting seconds / milliseconds / microseconds /
 * nanoseconds with BigInt-backed precision, multi-epoch support
 * (UNIX, JS ms, FILETIME, LDAP/NT, NTP, Cocoa/Apple, Excel serial, Mongo
 * ObjectId), batch conversion, start/end-of-period helpers, 2038 overflow
 * warning, code snippets in 15+ languages. Fully client-side, no network.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "unix-timestamp-epoch-converter",
  name: "Unix Timestamp / Epoch Converter",
  description:
    "Convert between Unix timestamps and human-readable dates both directions. Auto-detects seconds / milliseconds / microseconds / nanoseconds with BigInt precision. Multi-epoch support: UNIX, JS ms, Windows FILETIME, LDAP/NT, NTP, Cocoa/Apple (2001), Excel serial, Mongo ObjectId. Outputs ISO 8601, RFC 2822, locale, day-of-week, relative. Batch convert thousands of rows. 100% client-side.",
  category: "developer",
  keywords: [
    "unix timestamp", "epoch converter", "unix to date",
    "date to timestamp", "milliseconds to date", "seconds to date",
    "iso 8601", "rfc 2822", "filetime", "ldap timestamp",
    "ntp timestamp", "cocoa time", "excel serial date",
    "mongodb objectid timestamp", "epoch batch converter",
  ],
  icon: "clock",
  requiresNetwork: false,
  seo: {
    title: "Unix Timestamp / Epoch Converter — s/ms/μs/ns + FILETIME/LDAP/NTP/Excel | UnQTools",
    faq: [
      {
        q: "What is a Unix timestamp?",
        a: "A Unix timestamp (also called Unix epoch time or POSIX time) is the number of seconds that have elapsed since 00:00:00 UTC on 1 January 1970 (the 'Unix epoch'), excluding leap seconds. It is the standard way computers represent absolute time. Most systems store it as a 32-bit signed integer, which will overflow on 19 January 2038 (the 'Y2K38' or 'Year 2038' problem).",
      },
      {
        q: "How does this tool detect seconds vs milliseconds vs microseconds vs nanoseconds?",
        a: "We look at the digit count and magnitude of the input. Roughly: 1-10 digits = seconds, 11-13 digits = milliseconds, 14-16 digits = microseconds, 17+ digits = nanoseconds. You can always override with the unit selector. All conversions are done with BigInt so microsecond and nanosecond precision is never rounded by JavaScript's 53-bit float Number.",
      },
      {
        q: "What happens in 2038?",
        a: "On 19 January 2038 at 03:14:07 UTC, the signed 32-bit Unix timestamp (2,147,483,647) will roll over to a negative number, breaking any system that stores time as a 32-bit signed int. This tool always uses BigInt internally and warns you if your input is near or beyond that boundary so you know which legacy systems would break.",
      },
      {
        q: "Which non-Unix epochs are supported?",
        a: "Windows FILETIME (100-nanosecond intervals since 1601-01-01 UTC), LDAP/NT (100-ns intervals since 1601), NTP (seconds since 1900-01-01 with a 32-bit seconds field that wraps in 2036), Apple/Cocoa (seconds since 2001-01-01 UTC), Excel serial date (days since 1899-12-30, with Excel's 1900 leap-year bug called out), and MongoDB ObjectId embedded timestamps (4-byte seconds since 1970).",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) Auto unit detection (s/ms/μs/ns) with manual override. (2) BigInt precision so μs/ns never lose digits. (3) Timestamp → date AND date → timestamp both directions. (4) 6 output formats (ISO 8601, RFC 2822, locale, day-of-week, relative time, UTC + local). (5) 8 epoch systems (UNIX, JS ms, FILETIME, LDAP/NT, NTP, Cocoa, Excel serial, Mongo ObjectId). (6) Live ticking current-epoch clock in any unit. (7) Batch mode: paste thousands of timestamps, get a converted table + CSV export. (8) Start/end-of-year/month/day epoch helpers. (9) 2038 (signed 32-bit) overflow warning. (10) Code snippets for getting/converting epoch in 15+ languages. (11) Color-coded unit badge. (12) localStorage history (max 20, metadata only). (13) Shareable URL with ?ts=...&unit=... (fragment-encoded).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All conversions run locally with BigInt and Intl.DateTimeFormat. History is stored in localStorage on this device only and contains metadata (input length, unit, epoch kind), never your raw data.",
      },
    ],
  },
  status: "done",
};
