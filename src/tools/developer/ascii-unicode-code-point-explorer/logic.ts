/**
 * ASCII / Unicode Code Point Explorer — pure logic.
 *
 * Browse ASCII (0–127) and any Unicode code point: derive character,
 * decimal, hex, binary, HTML entity, URL encoding, CSS escape, JS
 * escape, plus UTF-8 / UTF-16 / UTF-32 byte encodings. Search by name,
 * code point, or literal character. Unicode block browser.
 *
 * Pure functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export interface CharInfo {
  codePoint: number;
  character: string;
  name: string;
  block: string;
  category: string;
  isAscii: boolean;
  isControl: boolean;
  isPrintable: boolean;
  decimal: number;
  hex4: string;            // "0041" (uppercase, min 4 digits)
  hexShort: string;        // "41" (no padding)
  uPlus: string;           // "U+0041"
  binary: string;          // "1000001"
  htmlEntityDecimal: string;  // "&#65;"
  htmlEntityHex: string;       // "&#x41;"
  urlEncoding: string;         // "%41" or "%C3%A9" (UTF-8)
  cssEscape: string;           // "\41" or "\000041" for astral
  jsEscape: string;            // "\u0041" or "\u{1F600}"
  utf8Bytes: number[];         // [0x41]
  utf16Bytes: number[];        // [0x00, 0x41] (big-endian pairs)
  utf32Bytes: number[];        // [0x00, 0x00, 0x00, 0x41] (big-endian)
}

export interface UnicodeBlock {
  start: number;
  end: number;
  name: string;
}

export type SearchMode = "auto" | "character" | "decimal" | "hex" | "name";

export interface SearchResult {
  query: string;
  mode: SearchMode;
  results: CharInfo[];
}

// ---------------------------------------------------------------------------
// Bundled ASCII character names (0–127) per the Unicode standard.
// ---------------------------------------------------------------------------
const ASCII_NAMES: string[] = [
  "NULL",
  "START OF HEADING",
  "START OF TEXT",
  "END OF TEXT",
  "END OF TRANSMISSION",
  "ENQUIRY",
  "ACKNOWLEDGE",
  "BELL",
  "BACKSPACE",
  "CHARACTER TABULATION",
  "LINE FEED",
  "LINE TABULATION",
  "FORM FEED",
  "CARRIAGE RETURN",
  "SHIFT OUT",
  "SHIFT IN",
  "DATA LINK ESCAPE",
  "DEVICE CONTROL ONE",
  "DEVICE CONTROL TWO",
  "DEVICE CONTROL THREE",
  "DEVICE CONTROL FOUR",
  "NEGATIVE ACKNOWLEDGE",
  "SYNCHRONOUS IDLE",
  "END OF TRANSMISSION BLOCK",
  "CANCEL",
  "END OF MEDIUM",
  "SUBSTITUTE",
  "ESCAPE",
  "INFORMATION SEPARATOR FOUR",
  "INFORMATION SEPARATOR THREE",
  "INFORMATION SEPARATOR TWO",
  "INFORMATION SEPARATOR ONE",
  "SPACE",
  "EXCLAMATION MARK",
  "QUOTATION MARK",
  "NUMBER SIGN",
  "DOLLAR SIGN",
  "PERCENT SIGN",
  "AMPERSAND",
  "APOSTROPHE",
  "LEFT PARENTHESIS",
  "RIGHT PARENTHESIS",
  "ASTERISK",
  "PLUS SIGN",
  "COMMA",
  "HYPHEN-MINUS",
  "FULL STOP",
  "SOLIDUS",
  "DIGIT ZERO",
  "DIGIT ONE",
  "DIGIT TWO",
  "DIGIT THREE",
  "DIGIT FOUR",
  "DIGIT FIVE",
  "DIGIT SIX",
  "DIGIT SEVEN",
  "DIGIT EIGHT",
  "DIGIT NINE",
  "COLON",
  "SEMICOLON",
  "LESS-THAN SIGN",
  "EQUALS SIGN",
  "GREATER-THAN SIGN",
  "QUESTION MARK",
  "COMMERCIAL AT",
  "LATIN CAPITAL LETTER A",
  "LATIN CAPITAL LETTER B",
  "LATIN CAPITAL LETTER C",
  "LATIN CAPITAL LETTER D",
  "LATIN CAPITAL LETTER E",
  "LATIN CAPITAL LETTER F",
  "LATIN CAPITAL LETTER G",
  "LATIN CAPITAL LETTER H",
  "LATIN CAPITAL LETTER I",
  "LATIN CAPITAL LETTER J",
  "LATIN CAPITAL LETTER K",
  "LATIN CAPITAL LETTER L",
  "LATIN CAPITAL LETTER M",
  "LATIN CAPITAL LETTER N",
  "LATIN CAPITAL LETTER O",
  "LATIN CAPITAL LETTER P",
  "LATIN CAPITAL LETTER Q",
  "LATIN CAPITAL LETTER R",
  "LATIN CAPITAL LETTER S",
  "LATIN CAPITAL LETTER T",
  "LATIN CAPITAL LETTER U",
  "LATIN CAPITAL LETTER V",
  "LATIN CAPITAL LETTER W",
  "LATIN CAPITAL LETTER X",
  "LATIN CAPITAL LETTER Y",
  "LATIN CAPITAL LETTER Z",
  "LEFT SQUARE BRACKET",
  "REVERSE SOLIDUS",
  "RIGHT SQUARE BRACKET",
  "CIRCUMFLEX ACCENT",
  "LOW LINE",
  "GRAVE ACCENT",
  "LATIN SMALL LETTER A",
  "LATIN SMALL LETTER B",
  "LATIN SMALL LETTER C",
  "LATIN SMALL LETTER D",
  "LATIN SMALL LETTER E",
  "LATIN SMALL LETTER F",
  "LATIN SMALL LETTER G",
  "LATIN SMALL LETTER H",
  "LATIN SMALL LETTER I",
  "LATIN SMALL LETTER J",
  "LATIN SMALL LETTER K",
  "LATIN SMALL LETTER L",
  "LATIN SMALL LETTER M",
  "LATIN SMALL LETTER N",
  "LATIN SMALL LETTER O",
  "LATIN SMALL LETTER P",
  "LATIN SMALL LETTER Q",
  "LATIN SMALL LETTER R",
  "LATIN SMALL LETTER S",
  "LATIN SMALL LETTER T",
  "LATIN SMALL LETTER U",
  "LATIN SMALL LETTER V",
  "LATIN SMALL LETTER W",
  "LATIN SMALL LETTER X",
  "LATIN SMALL LETTER Y",
  "LATIN SMALL LETTER Z",
  "LEFT CURLY BRACKET",
  "VERTICAL LINE",
  "RIGHT CURLY BRACKET",
  "TILDE",
  "DELETE",
];

// ---------------------------------------------------------------------------
// Curated Unicode blocks (start, end, name).
// ---------------------------------------------------------------------------
export const UNICODE_BLOCKS: UnicodeBlock[] = [
  { start: 0x0000, end: 0x007f, name: "Basic Latin" },
  { start: 0x0080, end: 0x00ff, name: "Latin-1 Supplement" },
  { start: 0x0100, end: 0x017f, name: "Latin Extended-A" },
  { start: 0x0180, end: 0x024f, name: "Latin Extended-B" },
  { start: 0x0250, end: 0x02af, name: "IPA Extensions" },
  { start: 0x02b0, end: 0x02ff, name: "Spacing Modifier Letters" },
  { start: 0x0300, end: 0x036f, name: "Combining Diacritical Marks" },
  { start: 0x0370, end: 0x03ff, name: "Greek and Coptic" },
  { start: 0x0400, end: 0x04ff, name: "Cyrillic" },
  { start: 0x0500, end: 0x052f, name: "Cyrillic Supplement" },
  { start: 0x0530, end: 0x058f, name: "Armenian" },
  { start: 0x0590, end: 0x05ff, name: "Hebrew" },
  { start: 0x0600, end: 0x06ff, name: "Arabic" },
  { start: 0x0700, end: 0x074f, name: "Syriac" },
  { start: 0x0750, end: 0x077f, name: "Arabic Supplement" },
  { start: 0x0780, end: 0x07bf, name: "Thaana" },
  { start: 0x07c0, end: 0x07ff, name: "NKo" },
  { start: 0x0800, end: 0x083f, name: "Samaritan" },
  { start: 0x0840, end: 0x085f, name: "Mandaic" },
  { start: 0x0860, end: 0x086f, name: "Syriac Supplement" },
  { start: 0x0870, end: 0x089f, name: "Arabic Extended-B" },
  { start: 0x08a0, end: 0x08ff, name: "Arabic Extended-A" },
  { start: 0x0900, end: 0x097f, name: "Devanagari" },
  { start: 0x0980, end: 0x09ff, name: "Bengali" },
  { start: 0x0a00, end: 0x0a7f, name: "Gurmukhi" },
  { start: 0x0a80, end: 0x0aff, name: "Gujarati" },
  { start: 0x0b00, end: 0x0b7f, name: "Oriya" },
  { start: 0x0b80, end: 0x0bff, name: "Tamil" },
  { start: 0x0c00, end: 0x0c7f, name: "Telugu" },
  { start: 0x0c80, end: 0x0cff, name: "Kannada" },
  { start: 0x0d00, end: 0x0d7f, name: "Malayalam" },
  { start: 0x0d80, end: 0x0dff, name: "Sinhala" },
  { start: 0x0e00, end: 0x0e7f, name: "Thai" },
  { start: 0x0e80, end: 0x0eff, name: "Lao" },
  { start: 0x0f00, end: 0x0fff, name: "Tibetan" },
  { start: 0x1000, end: 0x109f, name: "Myanmar" },
  { start: 0x10a0, end: 0x10ff, name: "Georgian" },
  { start: 0x1100, end: 0x11ff, name: "Hangul Jamo" },
  { start: 0x1200, end: 0x137f, name: "Ethiopic" },
  { start: 0x13a0, end: 0x13ff, name: "Cherokee" },
  { start: 0x1400, end: 0x167f, name: "Unified Canadian Aboriginal Syllabics" },
  { start: 0x1680, end: 0x169f, name: "Ogham" },
  { start: 0x16a0, end: 0x16ff, name: "Runic" },
  { start: 0x1700, end: 0x171f, name: "Tagalog" },
  { start: 0x1720, end: 0x173f, name: "Hanunoo" },
  { start: 0x1740, end: 0x175f, name: "Buhid" },
  { start: 0x1760, end: 0x177f, name: "Tagbanwa" },
  { start: 0x1780, end: 0x17ff, name: "Khmer" },
  { start: 0x1800, end: 0x18af, name: "Mongolian" },
  { start: 0x1900, end: 0x194f, name: "Limbu" },
  { start: 0x1950, end: 0x197f, name: "Tai Le" },
  { start: 0x1980, end: 0x19df, name: "New Tai Lue" },
  { start: 0x19e0, end: 0x19ff, name: "Khmer Symbols" },
  { start: 0x1a00, end: 0x1a1f, name: "Buginese" },
  { start: 0x1a20, end: 0x1a7f, name: "Tai Tham" },
  { start: 0x1b00, end: 0x1b7f, name: "Balinese" },
  { start: 0x1b80, end: 0x1bbf, name: "Sundanese" },
  { start: 0x1bc0, end: 0x1bff, name: "Batak" },
  { start: 0x1c00, end: 0x1c4f, name: "Lepcha" },
  { start: 0x1c50, end: 0x1c7f, name: "Ol Chiki" },
  { start: 0x1cd0, end: 0x1cff, name: "Vedic Extensions" },
  { start: 0x1d00, end: 0x1d7f, name: "Phonetic Extensions" },
  { start: 0x1d80, end: 0x1dbf, name: "Phonetic Extensions Supplement" },
  { start: 0x1dc0, end: 0x1dff, name: "Combining Diacritical Marks Supplement" },
  { start: 0x1e00, end: 0x1eff, name: "Latin Extended Additional" },
  { start: 0x1f00, end: 0x1fff, name: "Greek Extended" },
  { start: 0x2000, end: 0x206f, name: "General Punctuation" },
  { start: 0x2070, end: 0x209f, name: "Superscripts and Subscripts" },
  { start: 0x20a0, end: 0x20cf, name: "Currency Symbols" },
  { start: 0x20d0, end: 0x20ff, name: "Combining Diacritical Marks for Symbols" },
  { start: 0x2100, end: 0x214f, name: "Letterlike Symbols" },
  { start: 0x2150, end: 0x218f, name: "Number Forms" },
  { start: 0x2190, end: 0x21ff, name: "Arrows" },
  { start: 0x2200, end: 0x22ff, name: "Mathematical Operators" },
  { start: 0x2300, end: 0x23ff, name: "Miscellaneous Technical" },
  { start: 0x2400, end: 0x243f, name: "Control Pictures" },
  { start: 0x2440, end: 0x245f, name: "Optical Character Recognition" },
  { start: 0x2460, end: 0x24ff, name: "Enclosed Alphanumerics" },
  { start: 0x2500, end: 0x257f, name: "Box Drawing" },
  { start: 0x2580, end: 0x259f, name: "Block Elements" },
  { start: 0x25a0, end: 0x25ff, name: "Geometric Shapes" },
  { start: 0x2600, end: 0x26ff, name: "Miscellaneous Symbols" },
  { start: 0x2700, end: 0x27bf, name: "Dingbats" },
  { start: 0x27c0, end: 0x27ef, name: "Miscellaneous Mathematical Symbols-A" },
  { start: 0x27f0, end: 0x27ff, name: "Supplemental Arrows-A" },
  { start: 0x2800, end: 0x28ff, name: "Braille Patterns" },
  { start: 0x2900, end: 0x297f, name: "Supplemental Arrows-B" },
  { start: 0x2980, end: 0x29ff, name: "Miscellaneous Mathematical Symbols-B" },
  { start: 0x2a00, end: 0x2aff, name: "Supplemental Mathematical Operators" },
  { start: 0x2b00, end: 0x2bff, name: "Miscellaneous Symbols and Arrows" },
  { start: 0x2c00, end: 0x2c5f, name: "Glagolitic" },
  { start: 0x2c60, end: 0x2c7f, name: "Latin Extended-C" },
  { start: 0x2c80, end: 0x2cff, name: "Coptic" },
  { start: 0x2d00, end: 0x2d2f, name: "Georgian Supplement" },
  { start: 0x2d30, end: 0x2d7f, name: "Tifinagh" },
  { start: 0x2d80, end: 0x2ddf, name: "Ethiopic Extended" },
  { start: 0x2de0, end: 0x2dff, name: "Cyrillic Extended-A" },
  { start: 0x2e00, end: 0x2e7f, name: "Supplemental Punctuation" },
  { start: 0x2e80, end: 0x2eff, name: "CJK Radicals Supplement" },
  { start: 0x2f00, end: 0x2fdf, name: "Kangxi Radicals" },
  { start: 0x2ff0, end: 0x2fff, name: "Ideographic Description Characters" },
  { start: 0x3000, end: 0x303f, name: "CJK Symbols and Punctuation" },
  { start: 0x3040, end: 0x309f, name: "Hiragana" },
  { start: 0x30a0, end: 0x30ff, name: "Katakana" },
  { start: 0x3100, end: 0x312f, name: "Bopomofo" },
  { start: 0x3130, end: 0x318f, name: "Hangul Compatibility Jamo" },
  { start: 0x3190, end: 0x319f, name: "Kanbun" },
  { start: 0x31a0, end: 0x31bf, name: "Bopomofo Extended" },
  { start: 0x31c0, end: 0x31ef, name: "CJK Strokes" },
  { start: 0x31f0, end: 0x31ff, name: "Katakana Phonetic Extensions" },
  { start: 0x3200, end: 0x32ff, name: "Enclosed CJK Letters and Months" },
  { start: 0x3300, end: 0x33ff, name: "CJK Compatibility" },
  { start: 0x3400, end: 0x4dbf, name: "CJK Unified Ideographs Extension A" },
  { start: 0x4dc0, end: 0x4dff, name: "Yijing Hexagram Symbols" },
  { start: 0x4e00, end: 0x9fff, name: "CJK Unified Ideographs" },
  { start: 0xa000, end: 0xa48f, name: "Yi Syllables" },
  { start: 0xa490, end: 0xa4cf, name: "Yi Radicals" },
  { start: 0xa4d0, end: 0xa4ff, name: "Lisu" },
  { start: 0xa500, end: 0xa63f, name: "Vai" },
  { start: 0xa640, end: 0xa69f, name: "Cyrillic Extended-B" },
  { start: 0xa6a0, end: 0xa6ff, name: "Bamum" },
  { start: 0xa700, end: 0xa71f, name: "Modifier Tone Letters" },
  { start: 0xa720, end: 0xa7ff, name: "Latin Extended-D" },
  { start: 0xa800, end: 0xa82f, name: "Syloti Nagri" },
  { start: 0xa840, end: 0xa87f, name: "Common Indic Number Forms" },
  { start: 0xa880, end: 0xa8df, name: "Phags-pa" },
  { start: 0xa8e0, end: 0xa8ff, name: "Saurashtra" },
  { start: 0xa900, end: 0xa92f, name: "Kayah Li" },
  { start: 0xa930, end: 0xa95f, name: "Rejang" },
  { start: 0xa960, end: 0xa97f, name: "Hangul Jamo Extended-A" },
  { start: 0xa980, end: 0xa9df, name: "Javanese" },
  { start: 0xa9e0, end: 0xa9ff, name: "Myanmar Extended-B" },
  { start: 0xaa00, end: 0xaa5f, name: "Cham" },
  { start: 0xaa60, end: 0xaa7f, name: "Myanmar Extended-A" },
  { start: 0xaa80, end: 0xaadf, name: "Tai Viet" },
  { start: 0xaae0, end: 0xaaff, name: "Meetei Mayek Extensions" },
  { start: 0xab00, end: 0xab2f, name: "Ethiopic Extended-A" },
  { start: 0xab30, end: 0xab6f, name: "Latin Extended-E" },
  { start: 0xab70, end: 0xabbf, name: "Cherokee Supplement" },
  { start: 0xabc0, end: 0xabff, name: "Meetei Mayek" },
  { start: 0xac00, end: 0xd7af, name: "Hangul Syllables" },
  { start: 0xd7b0, end: 0xd7ff, name: "Hangul Jamo Extended-B" },
  { start: 0xe000, end: 0xf8ff, name: "Private Use Area" },
  { start: 0xf900, end: 0xfaff, name: "CJK Compatibility Ideographs" },
  { start: 0xfb00, end: 0xfb4f, name: "Alphabetic Presentation Forms" },
  { start: 0xfb50, end: 0xfdff, name: "Arabic Presentation Forms-A" },
  { start: 0xfe00, end: 0xfe0f, name: "Variation Selectors" },
  { start: 0xfe10, end: 0xfe1f, name: "Vertical Forms" },
  { start: 0xfe20, end: 0xfe2f, name: "Combining Half Marks" },
  { start: 0xfe30, end: 0xfe4f, name: "CJK Compatibility Forms" },
  { start: 0xfe50, end: 0xfe6f, name: "Small Form Variants" },
  { start: 0xfe70, end: 0xfeff, name: "Arabic Presentation Forms-B" },
  { start: 0xff00, end: 0xffef, name: "Halfwidth and Fullwidth Forms" },
  { start: 0xfff0, end: 0xffff, name: "Specials" },
  { start: 0x10000, end: 0x1007f, name: "Linear B Syllabary" },
  { start: 0x10080, end: 0x100ff, name: "Linear B Ideograms" },
  { start: 0x10100, end: 0x1013f, name: "Aegean Numbers" },
  { start: 0x10140, end: 0x1018f, name: "Ancient Greek Numbers" },
  { start: 0x10190, end: 0x101cf, name: "Ancient Symbols" },
  { start: 0x101d0, end: 0x101ff, name: "Phaistos Disc" },
  { start: 0x10280, end: 0x1029f, name: "Lycian" },
  { start: 0x102a0, end: 0x102df, name: "Carian" },
  { start: 0x10300, end: 0x1032f, name: "Old Italic" },
  { start: 0x10330, end: 0x1034f, name: "Gothic" },
  { start: 0x10350, end: 0x1037f, name: "Old Permic" },
  { start: 0x10380, end: 0x1039f, name: "Ugaritic" },
  { start: 0x103a0, end: 0x103df, name: "Old Persian" },
  { start: 0x10400, end: 0x1044f, name: "Deseret" },
  { start: 0x10450, end: 0x1047f, name: "Shavian" },
  { start: 0x10480, end: 0x104af, name: "Osmanya" },
  { start: 0x104b0, end: 0x104ff, name: "Osage" },
  { start: 0x10500, end: 0x1052f, name: "Elbasan" },
  { start: 0x10530, end: 0x1056f, name: "Caucasian Albanian" },
  { start: 0x10570, end: 0x105bf, name: "Vithkuqi" },
  { start: 0x10600, end: 0x1077f, name: "Linear A" },
  { start: 0x10800, end: 0x1083f, name: "Cypriot Syllabary" },
  { start: 0x10840, end: 0x1085f, name: "Imperial Aramaic" },
  { start: 0x10860, end: 0x1087f, name: "Palmyrene" },
  { start: 0x10880, end: 0x108af, name: "Nabataean" },
  { start: 0x108e0, end: 0x108ff, name: "Hatran" },
  { start: 0x10900, end: 0x1091f, name: "Phoenician" },
  { start: 0x10920, end: 0x1093f, name: "Lydian" },
  { start: 0x10980, end: 0x1099f, name: "Meroitic Hieroglyphs" },
  { start: 0x109a0, end: 0x109ff, name: "Meroitic Cursive" },
  { start: 0x10a00, end: 0x10a5f, name: "Kharoshthi" },
  { start: 0x10a60, end: 0x10a7f, name: "Old South Arabian" },
  { start: 0x10a80, end: 0x10a9f, name: "Old North Arabian" },
  { start: 0x10ac0, end: 0x10aff, name: "Manichaean" },
  { start: 0x10b00, end: 0x10b3f, name: "Avestan" },
  { start: 0x10b40, end: 0x10b5f, name: "Inscriptional Parthian" },
  { start: 0x10b60, end: 0x10b7f, name: "Inscriptional Pahlavi" },
  { start: 0x10b80, end: 0x10bff, name: "Psalter Pahlavi" },
  { start: 0x10c00, end: 0x10c4f, name: "Old Turkic" },
  { start: 0x10c80, end: 0x10cff, name: "Old Hungarian" },
  { start: 0x10d00, end: 0x10d3f, name: "Hanifi Rohingya" },
  { start: 0x10e60, end: 0x10e7f, name: "Rumi Numeral Symbols" },
  { start: 0x10e80, end: 0x10ebf, name: "Yezidi" },
  { start: 0x10f00, end: 0x10f2f, name: "Old Sogdian" },
  { start: 0x10f30, end: 0x10f6f, name: "Sogdian" },
  { start: 0x10f70, end: 0x10faf, name: "Old Uyghur" },
  { start: 0x10fb0, end: 0x10fdf, name: "Chorasmian" },
  { start: 0x10fe0, end: 0x10fff, name: "Elymaic" },
  { start: 0x11000, end: 0x1107f, name: "Brahmi" },
  { start: 0x11080, end: 0x110cf, name: "Kaithi" },
  { start: 0x110d0, end: 0x110ff, name: "Sora Sompeng" },
  { start: 0x11100, end: 0x1114f, name: "Chakma" },
  { start: 0x11150, end: 0x1117f, name: "Mahajani" },
  { start: 0x11180, end: 0x111df, name: "Sharada" },
  { start: 0x111e0, end: 0x111ff, name: "Sinhala Archaic Numbers" },
  { start: 0x11200, end: 0x1124f, name: "Khojki" },
  { start: 0x11280, end: 0x112af, name: "Multani" },
  { start: 0x112b0, end: 0x112ff, name: "Khudawadi" },
  { start: 0x11300, end: 0x1137f, name: "Grantha" },
  { start: 0x11400, end: 0x1147f, name: "Newa" },
  { start: 0x11480, end: 0x114df, name: "Tirhuta" },
  { start: 0x11580, end: 0x115ff, name: "Siddham" },
  { start: 0x11600, end: 0x1165f, name: "Modi" },
  { start: 0x11680, end: 0x116cf, name: "Mongolian Supplement" },
  { start: 0x11700, end: 0x1174f, name: "Ahom" },
  { start: 0x11800, end: 0x1184f, name: "Dogra" },
  { start: 0x118a0, end: 0x118ff, name: "Warang Citi" },
  { start: 0x11900, end: 0x1195f, name: "Dives Akuru" },
  { start: 0x119a0, end: 0x119ff, name: "Nandinagari" },
  { start: 0x11a00, end: 0x11a4f, name: "Zanabazar Square" },
  { start: 0x11a50, end: 0x11aaf, name: "Soyombo" },
  { start: 0x11ab0, end: 0x11abf, name: "Unified Canadian Aboriginal Syllabics Extended-A" },
  { start: 0x11ac0, end: 0x11aff, name: "Pau Cin Hau" },
  { start: 0x11c00, end: 0x11c6f, name: "Bhaiksuki" },
  { start: 0x11c70, end: 0x11cbf, name: "Marchen" },
  { start: 0x11d00, end: 0x11d5f, name: "Masaram Gondi" },
  { start: 0x11d60, end: 0x11daf, name: "Gunjala Gondi" },
  { start: 0x11ee0, end: 0x11eff, name: "Makasar" },
  { start: 0x11f00, end: 0x11f5f, name: "Kawi" },
  { start: 0x11fb0, end: 0x11fbf, name: "Lisu Supplement" },
  { start: 0x11fc0, end: 0x11fff, name: "Tamil Supplement" },
  { start: 0x12000, end: 0x123ff, name: "Cuneiform" },
  { start: 0x12400, end: 0x1247f, name: "Cuneiform Numbers and Punctuation" },
  { start: 0x12480, end: 0x1254f, name: "Early Dynastic Cuneiform" },
  { start: 0x12f90, end: 0x12fff, name: "Cypro-Minoan" },
  { start: 0x13000, end: 0x1342f, name: "Egyptian Hieroglyphs" },
  { start: 0x13430, end: 0x1345f, name: "Egyptian Hieroglyph Format Controls" },
  { start: 0x14400, end: 0x1467f, name: "Anatolian Hieroglyphs" },
  { start: 0x16800, end: 0x16a3f, name: "Bamum Supplement" },
  { start: 0x16a40, end: 0x16a6f, name: "Mro" },
  { start: 0x16a70, end: 0x16acf, name: "Tangsa" },
  { start: 0x16ad0, end: 0x16aff, name: "Bassa Vah" },
  { start: 0x16b00, end: 0x16b8f, name: "Pahawh Hmong" },
  { start: 0x16e40, end: 0x16e9f, name: "Medefaidrin" },
  { start: 0x16f00, end: 0x16f9f, name: "Miao" },
  { start: 0x16fe0, end: 0x16fff, name: "Ideographic Symbols and Punctuation" },
  { start: 0x17000, end: 0x187ff, name: "Tangut" },
  { start: 0x18800, end: 0x18aff, name: "Tangut Components" },
  { start: 0x18b00, end: 0x18cff, name: "Khitan Small Script" },
  { start: 0x18d00, end: 0x18d7f, name: "Tangut Supplement" },
  { start: 0x1aff0, end: 0x1afff, name: "Kana Extended-B" },
  { start: 0x1b000, end: 0x1b0ff, name: "Kana Supplement" },
  { start: 0x1b100, end: 0x1b12f, name: "Kana Extended-A" },
  { start: 0x1b130, end: 0x1b16f, name: "Small Kana Extension" },
  { start: 0x1b170, end: 0x1b2ff, name: "Nushu" },
  { start: 0x1bc00, end: 0x1bc9f, name: "Duployan" },
  { start: 0x1d000, end: 0x1d0ff, name: "Byzantine Musical Symbols" },
  { start: 0x1d100, end: 0x1d1ff, name: "Musical Symbols" },
  { start: 0x1d200, end: 0x1d24f, name: "Ancient Greek Musical Notation" },
  { start: 0x1d2e0, end: 0x1d2ff, name: "Mayan Numerals" },
  { start: 0x1d300, end: 0x1d35f, name: "Tai Xuan Jing Symbols" },
  { start: 0x1d360, end: 0x1d37f, name: "Counting Rod Numerals" },
  { start: 0x1d400, end: 0x1d7ff, name: "Mathematical Alphanumeric Symbols" },
  { start: 0x1d800, end: 0x1daaf, name: "Sutton SignWriting" },
  { start: 0x1df00, end: 0x1dfff, name: "Latin Extended-G" },
  { start: 0x1e000, end: 0x1e02f, name: "Glagolitic Supplement" },
  { start: 0x1e100, end: 0x1e14f, name: "Nyiakeng Puachue Hmong" },
  { start: 0x1e290, end: 0x1e2bf, name: "Toto" },
  { start: 0x1e2c0, end: 0x1e2ff, name: "Wancho" },
  { start: 0x1e4d0, end: 0x1e4ff, name: "Nag Mundari" },
  { start: 0x1e800, end: 0x1e8df, name: "Mende Kikakui" },
  { start: 0x1e900, end: 0x1e95f, name: "Adlam" },
  { start: 0x1ec70, end: 0x1ecbf, name: "Indic Siyaq Numbers" },
  { start: 0x1ed00, end: 0x1ed4f, name: "Ottoman Siyaq Numbers" },
  { start: 0x1ee00, end: 0x1eeff, name: "Arabic Mathematical Alphabetic Symbols" },
  { start: 0x1f000, end: 0x1f02f, name: "Mahjong Tiles" },
  { start: 0x1f030, end: 0x1f09f, name: "Domino Tiles" },
  { start: 0x1f0a0, end: 0x1f0ff, name: "Playing Cards" },
  { start: 0x1f100, end: 0x1f1ff, name: "Enclosed Alphanumeric Supplement" },
  { start: 0x1f200, end: 0x1f2ff, name: "Enclosed Ideographic Supplement" },
  { start: 0x1f300, end: 0x1f5ff, name: "Miscellaneous Symbols and Pictographs" },
  { start: 0x1f600, end: 0x1f64f, name: "Emoticons" },
  { start: 0x1f650, end: 0x1f67f, name: "Ornamental Dingbats" },
  { start: 0x1f680, end: 0x1f6ff, name: "Transport and Map Symbols" },
  { start: 0x1f700, end: 0x1f77f, name: "Alchemical Symbols" },
  { start: 0x1f780, end: 0x1f7ff, name: "Geometric Shapes Extended" },
  { start: 0x1f800, end: 0x1f8ff, name: "Supplemental Arrows-C" },
  { start: 0x1f900, end: 0x1f9ff, name: "Supplemental Symbols and Pictographs" },
  { start: 0x1fa00, end: 0x1fa6f, name: "Chess Symbols" },
  { start: 0x1fa70, end: 0x1faff, name: "Symbols and Pictographs Extended-A" },
  { start: 0x1fb00, end: 0x1fbff, name: "Symbols for Legacy Computing" },
  { start: 0x20000, end: 0x2a6df, name: "CJK Unified Ideographs Extension B" },
  { start: 0x2a700, end: 0x2b73f, name: "CJK Unified Ideographs Extension C" },
  { start: 0x2b740, end: 0x2b81f, name: "CJK Unified Ideographs Extension D" },
  { start: 0x2b820, end: 0x2ceaf, name: "CJK Unified Ideographs Extension E" },
  { start: 0x2ceb0, end: 0x2ebef, name: "CJK Unified Ideographs Extension F" },
  { start: 0x2f800, end: 0x2fa1f, name: "CJK Compatibility Ideographs Supplement" },
  { start: 0x30000, end: 0x3134f, name: "CJK Unified Ideographs Extension G" },
  { start: 0x31350, end: 0x323af, name: "CJK Unified Ideographs Extension H" },
  { start: 0xe0000, end: 0xe007f, name: "Tags" },
  { start: 0xe0100, end: 0xe01ef, name: "Variation Selectors Supplement" },
  { start: 0xf0000, end: 0xfffff, name: "Supplementary Private Use Area-A" },
  { start: 0x100000, end: 0x10ffff, name: "Supplementary Private Use Area-B" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get the ASCII name for code point 0–127 (empty string otherwise). */
export function getAsciiName(cp: number): string {
  if (cp < 0 || cp > 0x10ffff) return "";
  if (cp < 128) return ASCII_NAMES[cp] ?? "";
  return "";
}

/** Find the Unicode block a code point belongs to (or null). */
export function getUnicodeBlock(cp: number): UnicodeBlock | null {
  for (const b of UNICODE_BLOCKS) {
    if (cp >= b.start && cp <= b.end) return b;
  }
  return null;
}

/** Coarse Unicode general category derived from simple ASCII rules. */
function deriveCategory(cp: number): string {
  if (cp < 32 || cp === 127) return "Cc";       // control
  if (cp >= 48 && cp <= 57) return "Nd";        // digit
  if (cp >= 65 && cp <= 90) return "Lu";        // upper letter
  if (cp >= 97 && cp <= 122) return "Ll";       // lower letter
  if (cp === 32) return "Zs";                   // space separator
  if (cp >= 33 && cp <= 47) return "Po";        // punctuation other (approx)
  if (cp >= 58 && cp <= 64) return "Po";
  if (cp >= 91 && cp <= 96) return "Po";
  if (cp >= 123 && cp <= 126) return "Po";
  if (cp >= 128 && cp <= 0x33ff) return "Lo";   // approximation for many scripts
  if (cp >= 0x3400 && cp <= 0x9fff) return "Lo";// CJK
  if (cp >= 0xac00 && cp <= 0xd7af) return "Lo";// Hangul
  if (cp >= 0xe000 && cp <= 0xf8ff) return "Co";// private use
  if (cp >= 0xf900 && cp <= 0xfaff) return "Lo";// CJK compat
  return "So";                                  // symbol other (fallback)
}

/** Encode a single code point as UTF-8 bytes. */
export function encodeUtf8(cp: number): number[] {
  if (cp < 0 || cp > 0x10ffff) return [];
  if (cp < 0x80) return [cp];
  if (cp < 0x800) return [0xc0 | (cp >> 6), 0x80 | (cp & 0x3f)];
  if (cp < 0x10000) {
    return [0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f)];
  }
  return [
    0xf0 | (cp >> 18),
    0x80 | ((cp >> 12) & 0x3f),
    0x80 | ((cp >> 6) & 0x3f),
    0x80 | (cp & 0x3f),
  ];
}

/** Encode a single code point as UTF-16 BE bytes (one or two 16-bit units). */
export function encodeUtf16(cp: number): number[] {
  if (cp < 0 || cp > 0x10ffff) return [];
  if (cp < 0x10000) {
    return [(cp >> 8) & 0xff, cp & 0xff];
  }
  // Surrogate pair
  const offset = cp - 0x10000;
  const hi = 0xd800 + (offset >> 10);
  const lo = 0xdc00 + (offset & 0x3ff);
  return [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff];
}

/** Encode a single code point as UTF-32 BE bytes (always 4 bytes). */
export function encodeUtf32(cp: number): number[] {
  if (cp < 0 || cp > 0x10ffff) return [];
  return [
    (cp >> 24) & 0xff,
    (cp >> 16) & 0xff,
    (cp >> 8) & 0xff,
    cp & 0xff,
  ];
}

/** HTML decimal entity: &#65; */
export function toHtmlEntityDecimal(cp: number): string {
  return `&#${cp};`;
}

/** HTML hex entity: &#x41; */
export function toHtmlEntityHex(cp: number): string {
  return `&#x${cp.toString(16).toUpperCase()};`;
}

/** URL percent-encoding (UTF-8 based): %41 or %C3%A9. */
export function toUrlEncoding(cp: number): string {
  const bytes = encodeUtf8(cp);
  return bytes.map((b) => `%${b.toString(16).toUpperCase().padStart(2, "0")}`).join("");
}

/** CSS escape: \41 or \000041 (6 hex digits max for astral). */
export function toCssEscape(cp: number): string {
  const hex = cp.toString(16).toUpperCase();
  // CSS allows 1–6 hex digits after the backslash. Pad to 6 digits when astral
  // to avoid ambiguity with following whitespace; otherwise use the short form.
  if (cp > 0xffff) return `\\${hex.padStart(6, "0")}`;
  return `\\${hex}`;
}

/** JavaScript escape: \u0041 (BMP) or \u{1F600} (astral). */
export function toJsEscape(cp: number): string {
  if (cp > 0xffff) return `\\u{${cp.toString(16).toUpperCase()}}`;
  return `\\u${cp.toString(16).toUpperCase().padStart(4, "0")}`;
}

/** Hex string with U+ prefix: U+0041. */
export function toUPlus(cp: number): string {
  return `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
}

/** Padded hex (min 4 digits): 0041. */
export function toHexPadded(cp: number, minWidth = 4): string {
  return cp.toString(16).toUpperCase().padStart(minWidth, "0");
}

/** Binary representation of the code point (no leading zeros). */
export function toBinary(cp: number): string {
  return cp.toString(2);
}

// ---------------------------------------------------------------------------
// Build a full CharInfo for any code point.
// ---------------------------------------------------------------------------

export function codePointInfo(cp: number): CharInfo {
  if (!Number.isInteger(cp) || cp < 0 || cp > 0x10ffff) {
    throw new Error(`Invalid code point: ${cp}`);
  }
  const character = String.fromCodePoint(cp);
  const block = getUnicodeBlock(cp);
  const name = getAsciiName(cp) || (block ? `<code point in ${block.name}>` : "<unassigned>");
  const isAscii = cp < 128;
  const isControl = (cp < 32) || cp === 127 || (cp >= 0x80 && cp <= 0x9f);
  const isPrintable = !isControl && cp !== 0x200b && cp !== 0xfeff;
  return {
    codePoint: cp,
    character,
    name,
    block: block ? block.name : "Unassigned",
    category: deriveCategory(cp),
    isAscii,
    isControl,
    isPrintable,
    decimal: cp,
    hex4: toHexPadded(cp, 4),
    hexShort: cp.toString(16).toUpperCase(),
    uPlus: toUPlus(cp),
    binary: toBinary(cp),
    htmlEntityDecimal: toHtmlEntityDecimal(cp),
    htmlEntityHex: toHtmlEntityHex(cp),
    urlEncoding: toUrlEncoding(cp),
    cssEscape: toCssEscape(cp),
    jsEscape: toJsEscape(cp),
    utf8Bytes: encodeUtf8(cp),
    utf16Bytes: encodeUtf16(cp),
    utf32Bytes: encodeUtf32(cp),
  };
}

/** Look up the first code point of a literal character (handles astral). */
export function characterInfo(ch: string): CharInfo | null {
  if (!ch) return null;
  const cp = ch.codePointAt(0);
  if (cp === undefined) return null;
  return codePointInfo(cp);
}

// ---------------------------------------------------------------------------
// ASCII table
// ---------------------------------------------------------------------------

/** Return CharInfo for all 128 ASCII characters (0–127). */
export function asciiTable(): CharInfo[] {
  const out: CharInfo[] = [];
  for (let cp = 0; cp < 128; cp++) out.push(codePointInfo(cp));
  return out;
}

/** Return CharInfo for every code point in a Unicode block. */
export function blockTable(block: UnicodeBlock, max = 256): CharInfo[] {
  const out: CharInfo[] = [];
  const cap = Math.min(block.end, block.start + max - 1);
  for (let cp = block.start; cp <= cap; cp++) {
    try {
      out.push(codePointInfo(cp));
    } catch {
      // skip invalid
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// String decomposition (handles surrogate pairs)
// ---------------------------------------------------------------------------

/** Split a string into an array of code points (handles astral characters). */
export function stringToCodePoints(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; ) {
    const cp = s.codePointAt(i);
    if (cp === undefined) break;
    out.push(cp);
    i += cp > 0xffff ? 2 : 1;
  }
  return out;
}

/** Join an array of code points back into a string. */
export function codePointsToString(cps: number[]): string {
  return String.fromCodePoint(...cps);
}

/** Decompose a string into one CharInfo per code point. */
export function decomposeString(s: string): CharInfo[] {
  return stringToCodePoints(s).map((cp) => {
    try {
      return codePointInfo(cp);
    } catch {
      // Defensive: invalid code point — skip
      return codePointInfo(0xfffd); // replacement character
    }
  });
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/** Detect the most-likely search mode from a query string. */
export function detectSearchMode(query: string): SearchMode {
  const q = query.trim();
  if (!q) return "auto";
  // Single character (BMP or astral via surrogate pair) wins first.
  if (q.length === 1 || (q.length === 2 && q.codePointAt(0)! > 0xffff)) {
    return "character";
  }
  // Explicit hex prefixes.
  if (/^u\+[0-9a-f]+$/i.test(q) || /^0x[0-9a-f]+$/i.test(q)) {
    return "hex";
  }
  // Pure decimal.
  if (/^\d+$/.test(q)) {
    return "decimal";
  }
  // Bare hex with at least one a–f letter is unambiguously hex.
  if (/^[0-9a-f]{1,6}$/i.test(q) && /[a-f]/i.test(q)) {
    return "hex";
  }
  return "name";
}

/** Parse a query into a single code point if possible (returns -1 if not). */
export function parseCodePointQuery(query: string): number {
  const q = query.trim();
  if (!q) return -1;
  let m: RegExpMatchArray | null;
  // Explicit hex prefixes first.
  if ((m = q.match(/^u\+([0-9a-f]+)$/i))) return parseInt(m[1], 16);
  if ((m = q.match(/^0x([0-9a-f]+)$/i))) return parseInt(m[1], 16);
  if ((m = q.match(/^&#x([0-9a-f]+);$/i))) return parseInt(m[1], 16);
  if ((m = q.match(/^&#(\d+);$/))) return parseInt(m[1], 10);
  // Single character (BMP or astral) — character mode wins over bare hex
  // so that "A" returns 65, not 10.
  if (q.length === 1 || (q.length === 2 && q.codePointAt(0)! > 0xffff)) {
    return q.codePointAt(0)!;
  }
  // Pure decimal (e.g. "65") — decimal wins over bare hex so that "41" → 41.
  if (/^\d+$/.test(q)) {
    const n = parseInt(q, 10);
    if (n <= 0x10ffff) return n;
  }
  // Bare hex with at least one a–f letter (e.g. "1f600", "0a").
  if (/^[0-9a-f]{1,6}$/i.test(q) && /[a-f]/i.test(q)) {
    const n = parseInt(q, 16);
    if (n <= 0x10ffff) return n;
  }
  return -1;
}

/** Search for code points by name within ASCII + the bundled block list. */
export function searchByName(query: string, max = 100): CharInfo[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  const results: CharInfo[] = [];
  // Search ASCII first (most likely).
  for (let cp = 0; cp < 128; cp++) {
    const info = codePointInfo(cp);
    if (info.name.toUpperCase().includes(q)) {
      results.push(info);
      if (results.length >= max) return results;
    }
  }
  return results;
}

/**
 * Run a unified search: parses the query as a code point if possible,
 * else searches by name. Returns at most `max` results.
 */
export function searchCodePoints(query: string, max = 100): SearchResult {
  const q = query.trim();
  if (!q) return { query, mode: "auto", results: [] };
  const cp = parseCodePointQuery(q);
  if (cp >= 0 && cp <= 0x10ffff) {
    return { query, mode: detectSearchMode(q), results: [codePointInfo(cp)] };
  }
  // Fallback: name search
  const results = searchByName(q, max);
  return { query, mode: "name", results };
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:ascii-unicode-code-point-explorer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  query: string;
  codePoint: number | null;
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

export interface ShareState {
  mode: "ascii" | "block" | "search" | "string";
  query: string;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.mode) params.set("mode", state.mode);
  if (state.query) params.set("q", state.query);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { mode: "ascii", query: "" };
  const params = new URLSearchParams(clean);
  const modeRaw = params.get("mode") ?? "ascii";
  const validModes: ShareState["mode"][] = ["ascii", "block", "search", "string"];
  const mode: ShareState["mode"] = validModes.includes(modeRaw as ShareState["mode"])
    ? (modeRaw as ShareState["mode"])
    : "ascii";
  const query = params.get("q") ?? "";
  return { mode, query };
}
