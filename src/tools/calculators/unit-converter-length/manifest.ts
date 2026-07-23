/**
 * Unit Converter (Length) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "unit-converter-length",
  name: "Length / Distance Unit Converter",
  description:
    "Convert between 18+ length units: metric (m, km, cm, mm, µm, nm), imperial (in, ft, yd, mi, nautical mi), astronomical (AU, ly, parsec), typographic (pt, px), and more. With 10+ extras. 100% private.",
  category: "calculators",
  keywords: ["length converter", "distance converter", "meters to feet", "km to miles", "unit conversion", "imperial metric"],
  icon: "ruler",
  requiresNetwork: false,
  seo: {
    title: "Length Converter — 18+ Units (Metric, Imperial, Astronomical) | UnQTools",
    faq: [
      { q: "How accurate is the conversion?", a: "All conversions use exact SI definitions: 1 inch = 2.54 cm exactly, 1 foot = 0.3048 m exactly, 1 mile = 1609.344 m exactly. Astronomical units use IAU 2015 definitions: 1 AU = 149,597,870,700 m, 1 ly = 9,460,730,472,580,800 m, 1 parsec = 3.0856775814913673e16 m." },
      { q: "What extras does this tool have?", a: "Extras: (1) 18+ units across 5 systems, (2) Bidirectional single-unit conversion, (3) All-units-at-once table view, (4) Custom precision (0-10 decimals), (5) Scientific notation toggle for very large/small values, (6) Common conversions quick-reference (1 m = ? in every unit), (7) Convert chained units (e.g. 5 km 300 m 50 cm), (8) Decimal ↔ fraction display for imperial, (9) Copy individual results, (10) CSV export of all-unit view, (11) Temperature-style step ladder (e.g. powers of 10), (12) Conversion history (localStorage), (13) Add custom conversion factor." },
    ],
  },
  status: "done",
};
