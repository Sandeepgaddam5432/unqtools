/**
 * ASCII / Unicode Code Point Explorer — Tool Manifest.
 * Tool #377 — Category 4 (Developer & Code).
 *
 * Browse ASCII (0–127) and Unicode code points: show character,
 * decimal, hex, binary, HTML entity, URL encoding, CSS escape, JS
 * escape, plus UTF-8/UTF-16/UTF-32 byte encodings. Search by name,
 * code, or character. Unicode block browser. 100% client-side & offline.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ascii-unicode-code-point-explorer",
  name: "ASCII / Unicode Code Point Explorer (UTF-8/16/32, HTML/CSS/JS Escapes)",
  description:
    "Browse ASCII (0–127) and any Unicode code point: see the character, decimal, hex, binary, HTML entity (decimal & hex), URL percent-encoding, CSS escape, JS escape, plus the full UTF-8 / UTF-16 / UTF-32 byte encodings. Search by name, code point, or literal character, and explore every Unicode block. Decompose pasted strings code-point-by-code-point. 100% client-side & offline.",
  category: "developer",
  keywords: [
    "ascii table", "unicode lookup", "code point explorer",
    "utf-8 encoding", "html entity", "css escape", "js escape",
    "url encoding", "unicode block", "character info",
  ],
  icon: "binary",
  requiresNetwork: false,
  seo: {
    title: "ASCII / Unicode Code Point Explorer — UTF-8/16/32 + HTML/CSS/JS Escapes | UnQTools",
    faq: [
      {
        q: "How do I look up a character or code point?",
        a: "Three ways: (1) type a literal character (e.g. A or ©) into the search box and the explorer shows its full identity; (2) type a decimal code (e.g. 65) or hex code (e.g. 0x41 or U+0041); (3) type part of the official Unicode name (e.g. 'COPYRIGHT' or 'LATIN CAPITAL'). The explorer matches against all of these at once and shows every encoding and escape form for each result.",
      },
      {
        q: "What encodings and escapes does the explorer show?",
        a: "For every code point it shows: the character itself, the code point in U+XXXX notation, decimal value, hexadecimal, and binary; the HTML decimal entity (&#NN;) and HTML hex entity (&#xHH;); the URL percent-encoded UTF-8 form (%XX); the CSS escape (\\HHHH or \\HHHHHH for astral); the JavaScript escape (\\uXXXX or \\u{XXXXX} for astral); and the raw byte sequences for UTF-8, UTF-16 (BE), and UTF-32 (BE).",
      },
      {
        q: "How does it handle characters outside the Basic Multilingual Plane (astral characters)?",
        a: "Code points above U+FFFF (such as emoji, rare CJK ideographs, or historic scripts) are handled natively with String.fromCodePoint / codePointAt. The UTF-16 encoding correctly emits a surrogate pair (two 16-bit units); the UTF-8 encoding correctly emits a 4-byte sequence; the JS escape uses the \\u{XXXXX} brace syntax that works in modern JavaScript. So astral characters display just as cleanly as ASCII.",
      },
      {
        q: "What Unicode blocks are covered?",
        a: "The tool bundles a curated list of the most-used Unicode blocks (Basic Latin, Latin-1 Supplement, Latin Extended, Greek, Cyrillic, Hebrew, Arabic, Devanagari, CJK, Hangul,Emoji blocks, private-use areas, specials, and more). The block browser lets you jump to any block and inspect every code point in it. Code points in unassigned or private-use ranges are clearly labelled.",
      },
      {
        q: "What extra features does this tool have compared to other Unicode explorers?",
        a: "(1) ASCII table browser (0–127). (2) Per-code-point view with all 11 encodings/escapes. (3) UTF-8/UTF-16/UTF-32 byte sequences. (4) HTML decimal & hex entities. (5) URL percent-encoding (UTF-8). (6) CSS \\HHHH escape. (7) JS \\uXXXX / \\u{XXXXX} escape. (8) Search by character, decimal, hex, or Unicode name. (9) Bundled ASCII names (all 128). (10) Unicode block browser with curated blocks. (11) String decomposition — paste any string and see every code point. (12) Binary representation. (13) Control-character detection. (14) History (localStorage, last 20). (15) Shareable URL. 100% client-side and offline — your input never leaves the device.",
      },
    ],
  },
  status: "done",
};
