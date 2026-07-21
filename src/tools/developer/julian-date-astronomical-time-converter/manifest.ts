/**
 * Julian Date & Astronomical Time Converter — Tool Manifest.
 * Tool #317 — Category 4 (Developer & Code).
 *
 * Convert between calendar date/time and astronomical Julian Date (JD),
 * Modified Julian Date (MJD), Reduced/Truncated/Dublin JD, Rata Die,
 * days since J2000.0 epoch, Unix epoch (s/ms), and the **mainframe
 * ordinal "Julian date"** (YYDDD / YYYYDDD) — making the two distinct
 * meanings of "Julian date" explicit. Supports BC dates (negative years),
 * proleptic Gregorian AND Julian calendar systems, fraction-of-day
 * output, weekday, and high precision. Fully client-side, no network.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "julian-date-astronomical-time-converter",
  name: "Julian Date & Astronomical Time Converter",
  description:
    "Convert between Julian Date (JD), Modified Julian Date (MJD), Reduced/Truncated/Dublin JD, Rata Die, days since J2000.0, Unix epoch, and Gregorian calendar date/time. Supports BC dates, proleptic Gregorian AND Julian calendar systems, fraction-of-day, and the separate mainframe ordinal 'Julian date' (YYDDD/YYYYDDD). High precision, fully client-side.",
  category: "developer",
  keywords: [
    "julian date", "julian day", "julian day number", "jd converter",
    "modified julian date", "mjd", "rata die", "j2000 epoch",
    "astronomical time", "yyddd", "yyyyddd", "ordinal date",
    "proleptic gregorian", "julian calendar", "bc date converter",
    "reduced julian date", "truncated julian date", "dublin julian date",
  ],
  icon: "calendar-clock",
  requiresNetwork: false,
  seo: {
    title: "Julian Date & Astronomical Time Converter — JD/MJD/Rata Die/J2000/YYDDD | UnQTools",
    faq: [
      {
        q: "What is the difference between astronomical Julian Date and the mainframe 'Julian date' (YYDDD)?",
        a: "The astronomical Julian Date (JD) is a continuous count of days since noon Universal Time on Monday, 1 January 4713 BC (proleptic Julian calendar). It is used by astronomers and is always a single (often fractional) number — for example, JD 2460684.5 is midnight UTC on 2025-01-01. The mainframe 'Julian date' YYDDD or YYYYDDD is completely unrelated: it is a 5- or 7-digit ordinal form like 25001 (year 2025, day 1 of year = 2025-01-01). This tool handles both meanings clearly and never confuses them.",
      },
      {
        q: "Why does the Julian Date start at noon rather than midnight?",
        a: "Historically, astronomers observed at night, so a day that began at noon meant a single night's observations would all fall on the same Julian Day number. The 0.5-day offset means an integer JD corresponds to noon UTC. Modified Julian Date (MJD) subtracts 2400000.5 from JD precisely to remove that offset so MJD changes at midnight like civil dates. This converter shows both forms and clearly labels the 0.5-day offset.",
      },
      {
        q: "What is MJD, Reduced JD, Truncated JD, Dublin JD, and Rata Die?",
        a: "All are offsets from JD that shift the zero point and (sometimes) the noon offset: MJD = JD − 2400000.5 (starts at 1858-11-17 midnight UTC); Reduced JD = JD − 2400000 (integer offset); Truncated JD (TJD) = JD − 2440000.5 (NASA, starts 1968-05-24); Dublin JD = JD − 2415020 (used for variable star work); Rata Die = JD − 1721424.5 (day 1 = 0001-01-01 proleptic Gregorian).",
      },
      {
        q: "Can this converter handle BC dates and the proleptic Julian calendar?",
        a: "Yes. We use astronomical year numbering (year 0 = 1 BC, year −1 = 2 BC, etc.) and offer a calendar-system toggle: 'proleptic Gregorian' (the Gregorian calendar extended backward, the ISO 8601 default) or 'proleptic Julian' (the Julian calendar used historically before 1582-10-15). The converter works for any year in the supported range including BC dates and negative JD values.",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) Calendar date/time ↔ JD and MJD at high precision. (2) Ordinal YYDDD / YYYYDDD ↔ calendar date in a clearly separate mode. (3) Reduced JD, Truncated JD, Dublin JD, Rata Die, days since J2000.0. (4) Unix epoch (seconds/milliseconds) ↔ JD. (5) Fraction-of-day display with selectable precision. (6) Proleptic Gregorian / Julian calendar toggle. (7) BC date support (astronomical year numbering). (8) Weekday derived from JD mod 7. (9) Live current JD/MJD readout. (10) Copy each field. (11) localStorage history (max 20). (12) Shareable URL (fragment-encoded). (13) Round-trip integrity (date→JD→date returns the same value).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All conversions run locally using pure arithmetic and Intl.DateTimeFormat. History is stored in localStorage on this device only and contains metadata (input preview, mode, calendar system), never your raw data beyond a short preview.",
      },
    ],
  },
  status: "done",
};
