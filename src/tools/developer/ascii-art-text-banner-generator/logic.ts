/**
 * ASCII Art Text Banner Generator — pure logic.
 *
 * Pure-JS functions for rendering text to ASCII art banners using a bundled
 * font set. 100% client-side. No DOM, no network — pure functions only.
 *
 * Font design: each font is a map of glyph (single char) → array of equal-
 * length row strings. The renderer concatenates glyphs horizontally (one
 * column of space between glyphs) and joins rows with newlines.
 */

// ---------- Types ----------

export interface AsciiFont {
  /** Stable internal id. */
  id: string;
  /** Display name. */
  name: string;
  /** Glyph height in rows. */
  height: number;
  /** Default glyph width in columns (max across glyphs). */
  width: number;
  /** Glyph map: char → array of `height` row strings (each `width` chars). */
  glyphs: Record<string, string[]>;
  /** Description shown in UI. */
  description: string;
}

export type CharSet = "raw" | "hash" | "block" | "slash" | "dot" | "star";

export interface RenderOptions {
  /** Character-set overlay. Default "raw" (use the font's native characters). */
  charSet?: CharSet;
  /** Maximum output width in columns. Default 80. */
  maxWidth?: number;
  /** Flip horizontally (mirror each row). */
  flipH?: boolean;
  /** Flip vertically (reverse row order). */
  flipV?: boolean;
  /** Letter spacing in columns (extra spaces between glyphs). Default 1. */
  letterSpacing?: number;
}

export interface HistoryEntry {
  ts: number;
  text: string;
  fontId: string;
  charSet: CharSet;
  width: number;
}

// ---------- Constants ----------

export const HISTORY_MAX = 20;
const HISTORY_KEY = "unqtools:ascii-art-text-banner-generator:history";

export const CHARSET_LABELS: Record<CharSet, string> = {
  raw: "Native (use font's characters)",
  hash: "# Hash",
  block: "█ Block",
  slash: "/ Slash",
  dot: "· Dot",
  star: "* Star",
};

export const CHARSET_OVERLAYS: Record<Exclude<CharSet, "raw">, string> = {
  hash: "#",
  block: "█",
  slash: "/",
  dot: "·",
  star: "*",
};

export const PRESET_PHRASES: string[] = [
  "HELLO", "README", "ASCII ART", "BANNER", "CONSOLE",
  "UNQTOOLS", "WAVE 11", "DEV 110", "TEST", "FOO BAR",
];

// ---------- Font helpers ----------

/**
 * Build a font from a compact definition: each glyph is described as a
 * semicolon-separated string of rows (each row exactly `width` chars).
 * Example: parseFont("block", "Block", 5, 5, { A: ".###.;#...#;#####;#...#;#...#" })
 */
function parseFont(
  id: string,
  name: string,
  height: number,
  width: number,
  raw: Record<string, string>,
  description: string,
): AsciiFont {
  const glyphs: Record<string, string[]> = {};
  for (const [ch, rows] of Object.entries(raw)) {
    const parts = rows.split(";");
    // Lenient: pad missing rows with blank, truncate extra rows.
    const padded: string[] = [];
    for (let i = 0; i < height; i++) {
      const row = parts[i] ?? "";
      padded.push(row.padEnd(width, " ").slice(0, width));
    }
    glyphs[ch] = padded;
  }
  return { id, name, height, width, glyphs, description };
}

// ---------- Font definitions (12 fonts) ----------

// Font 1: BLOCK — solid 5x5 block letters
const BLOCK = parseFont("block", "Block", 5, 5, {
  " ": "     ;     ;     ;     ;     ",
  A: ".###.;#...#;#####;#...#;#...#",
  B: "####.;#...#;####.;#...#;####.",
  C: ".####;#....;#....;#....;.####",
  D: "####.;#...#;#...#;#...#;####.",
  E: "#####;#....;####.;#....;#####",
  F: "#####;#....;####.;#....;#....",
  G: ".####;#....;#.###;#...#;.####",
  H: "#...#;#...#;#####;#...#;#...#",
  I: "#####;..#..;..#..;..#..;#####",
  J: "#####;...#.;...#.;#..#.;.##..",
  K: "#...#;#..#.;###..;#..#.;#...#",
  L: "#....;#....;#....;#....;#####",
  M: "#...#;##.##;#.#.#;#...#;#...#",
  N: "#...#;##..#;#.#.#;#..##;#...#",
  O: ".###.;#...#;#...#;#...#;.###.",
  P: "####.;#...#;####.;#....;#....",
  Q: ".###.;#...#;#.#.#;#..#.;.##.#",
  R: "####.;#...#;####.;#..#.;#...#",
  S: ".####;#....;.###.;....#;####.",
  T: "#####;..#..;..#..;..#..;..#..",
  U: "#...#;#...#;#...#;#...#;.###.",
  V: "#...#;#...#;#...#;.#.#.;..#..",
  W: "#...#;#...#;#.#.#;##.##;#...#",
  X: "#...#;.#.#.;..#..;.#.#.;#...#",
  Y: "#...#;.#.#.;..#..;..#..;..#..",
  Z: "#####;...#.;..#..;.#...;#####",
  "0": ".###.;#..##;#.#.#;##..#;.###.",
  "1": "..#..;.##..;..#..;..#..;#####",
  "2": ".###.;#...#;..##.;.#...;#####",
  "3": "####.;....#;.##..;....#;####.",
  "4": "..##.;.#.#.;#####;...#.;...#.",
  "5": "#####;#....;####.;....#;####.",
  "6": ".###.;#....;####.;#...#;.###.",
  "7": "#####;....#;...#.;..#..;..#..",
  "8": ".###.;#...#;.###.;#...#;.###.",
  "9": ".###.;#...#;.####;....#;.###.",
  ".": ".....;.....;.....;.....;.##..",
  ",": ".....;.....;.....;.##..;.#...",
  "!": "..#..;..#..;..#..;.....;..#..",
  "?": "####.;....#;.##..;.....;..#..",
  "'": "..#..;..#..;.....;.....;.....",
  "-": ".....;.....;.###.;.....;.....",
  "/": "....#;...#.;..#..;.#...;#....",
  "+": ".....;..#..;.###.;..#..;.....",
  ":": ".....;..#..;.....;..#..;.....",
  ";": ".....;..#..;.....;..#..;.#...",
  "(": "...#.;..#..;.#...;..#..;...#.",
  ")": ".#...;..#..;...#.;..#..;.#...",
}, "Solid 5x5 block letters using #; the workhorse font for terminal banners.");

// Font 2: BANNER — 5x5 banner-style using #
const BANNER = parseFont("banner", "Banner", 5, 6, {
  " ": "      ;      ;      ;      ;      ",
  A: " # #  ;#   # ;##### ;#   # ;#   # ",
  B: "####  ;#   # ;####  ;#   # ;####  ",
  C: " #### ;#     ;#     ;#     ; #### ",
  D: "####  ;#   # ;#   # ;#   # ;####  ",
  E: "##### ;#     ;####  ;#     ;##### ",
  F: "##### ;#     ;####  ;#     ;#     ",
  G: " #### ;#     ;#  ## ;#   # ; #### ",
  H: "#   # ;#   # ;##### ;#   # ;#   # ",
  I: "##### ;  #   ;  #   ;  #   ;##### ",
  J: "##### ;   #  ;   #  ;#  #  ; ##   ",
  K: "#   # ;#  #  ;###   ;#  #  ;#   # ",
  L: "#     ;#     ;#     ;#     ;##### ",
  M: "#   # ;## ## ;# # # ;#   # ;#   # ",
  N: "#   # ;##  # ;# # # ;#  ## ;#   # ",
  O: " ###  ;#   # ;#   # ;#   # ; ###  ",
  P: "####  ;#   # ;####  ;#     ;#     ",
  Q: " ###  ;#   # ;#   # ;#  #  ; ## # ",
  R: "####  ;#   # ;####  ;#  #  ;#   # ",
  S: " #### ;#     ; ###  ;    # ;####  ",
  T: "##### ;  #   ;  #   ;  #   ;  #   ",
  U: "#   # ;#   # ;#   # ;#   # ; ###  ",
  V: "#   # ;#   # ;#   # ; # #  ;  #   ",
  W: "#   # ;#   # ;# # # ;## ## ;#   # ",
  X: "#   # ; # #  ;  #   ; # #  ;#   # ",
  Y: "#   # ; # #  ;  #   ;  #   ;  #   ",
  Z: "##### ;    # ;  #   ; #    ;##### ",
  "0": " ###  ;#  ## ;# # # ;##  # ; ###  ",
  "1": "  #   ; ##   ;  #   ;  #   ;##### ",
  "2": " ###  ;#   # ;  ##  ; #    ;##### ",
  "3": "####  ;    # ; ##   ;    # ;####  ",
  "4": "  ##  ; # #  ;##### ;   #  ;   #  ",
  "5": "##### ;#     ;####  ;    # ;####  ",
  "6": " ###  ;#     ;####  ;#   # ; ###  ",
  "7": "##### ;    # ;   #  ;  #   ;  #   ",
  "8": " ###  ;#   # ; ###  ;#   # ; ###  ",
  "9": " ###  ;#   # ; #### ;    # ; ###  ",
  ".": "      ;      ;      ;      ; ##   ",
  ",": "      ;      ;      ; ##   ; #    ",
  "!": "  #   ;  #   ;  #   ;      ;  #   ",
  "?": "####  ;    # ; ##   ;      ;  #   ",
  "'": "  #   ;  #   ;      ;      ;      ",
  "-": "      ;      ; ###  ;      ;      ",
  "/": "    # ;   #  ;  #   ; #    ;#     ",
  "+": "      ;  #   ; ###  ;  #   ;      ",
}, "Banner-style 5x6 with rounded edges; the classic figlet banner look.");

// Font 3: STANDARD — 5x5 using /, \, _, |
const STANDARD = parseFont("standard", "Standard", 5, 6, {
  " ": "      ;      ;      ;      ;      ",
  A: "  /\\  ; /  \\ ;/____\\;\\    /; \\  / ",
  B: "____  ;\\   \\ ; \\___\\; /   /;____/ ",
  C: " ____ ;/     ;|     ;|     ; \\____",
  D: "____  ;\\   \\ ;|    |;|    |;____/ ",
  E: "_____ ;\\     ;\\___  ;/     ;_____/",
  F: "_____ ;\\     ;\\___  ;/     ;/     ",
  G: " ____ ;/     ;|  __ ;|    \\; \\___/",
  H: "\\    /;\\  / ; \\/  ; /\\  / ;/    \\",
  I: "_____ ;  |   ;  |   ;  |   ;_____ ",
  J: "_____ ;   |  ;   |  ;|  |  ; \\__  ",
  K: "\\   / ;\\ /  ;|<   ;/ \\   ;/   \\ ",
  L: "\\     ;\\     ;\\     ;\\     ;_____/",
  M: "\\/\\/\\ ;\\    /; \\  / ;  \\/  ;  /\\  ",
  N: "\\    /;\\   / ; \\  / ;  \\ \\ ;   \\/ ",
  O: " __ _ ;/    \\\\  /\\  ;/ /  \\;\\____/",
  P: "____  ;\\   \\ ; \\___\\; /    ;/     ",
  Q: " ___  ;/   \\ ;|    |;\\  / /; \\_\\\\ ",
  R: "____  ;\\   \\ ; \\___\\; / \\  ;/   \\ ",
  S: " ____ ;/     ;\\___  ;    / ;____/ ",
  T: "_____ ;  |   ;  |   ;  |   ;  |   ",
  U: "\\    /;\\    /;\\    /;\\    /; \\__/ ",
  V: "\\    /;\\    /; \\  / ;  \\  ;   \\  ",
  W: "\\/  \\/ ;\\    /; \\  / ; /  \\ ;/    \\",
  X: "\\    /; \\  / ;  \\/  ; /  \\ ;/    \\",
  Y: "\\    /; \\  / ;  \\/  ;  |   ;  |   ",
  Z: "_____ ;   /  ;  /   ; /    ;/_____",
  "0": " ___  ;/   \\ ;|   |;|   |; \\___/ ",
  "1": "  |   ;  |   ;  |   ;  |   ;_____ ",
  "2": " ___  ;/   \\ ;   /  ;  /   ;/____ ",
  "3": "___   ;   \\  ; __|  ;    / ;___/  ",
  "4": "/   | ;|   |;|___|;    |;    |   ",
  "5": "_____ ;\\     ;\\___  ;    / ;___/  ",
  "6": " ___  ;/     ;\\___  ;/   \\ ; \\__/ ",
  "7": "_____ ;    / ;   /  ;  /   ; /    ",
  "8": " ___  ;/   \\ ; \\_/  ;/   \\ ; \\__/ ",
  "9": " ___  ;/   \\ ; \\___ ;    / ; \\__/ ",
  ".": "      ;      ;      ;      ;  __  ",
  ",": "      ;      ;      ;  __  ; /    ",
  "!": "  |   ;  |   ;  |   ;      ;  |   ",
  "?": "___   ;   \\  ; __|  ;      ;  |   ",
  "'": "  |   ;  |   ;      ;      ;      ",
  "-": "      ;      ; ___  ;      ;      ",
  "/": "    / ;   /  ;  /   ; /    ;/     ",
  "+": "      ;  |   ; ___  ;  |   ;      ",
}, "FIGlet-style 5x6 using / \\ _ | strokes — the original ANSI figlet vibe.");

// Font 4: BIG — 7-row wide letters using #
const BIG = parseFont("big", "Big", 7, 8, {
  " ": "        ;        ;        ;        ;        ;        ;        ",
  A: "   /\\   ;  /  \\  ; / /\\ \\ ;/ /  \\ \\;\\ \\  / /; \\ \\/ / ;  \\/  ",
  B: "______  ;\\____ \\ ; |   | |; |___| |; |   | |; |___|/ ;______  ",
  C: "  ______; /     ;|      ;|      ;|      ;|      ; \\_____/",
  D: "______  ;\\    \\ ; |    |; |    |; |    |; |    |;______/ ",
  E: "________;\\       ;|_____  ;|      ;|_____  ;|      ;\\______/",
  F: "________;\\       ;|_____  ;|      ;|_____  ;|      ;|      ",
  G: "  ______; /     ;|      ;|  ____ ;|    \\ \\; \\    \\|; \\_____/",
  H: "\\      /;\\    / ; |  |  ; |  |  ; |  |  ;/    \\ ;/      \\",
  I: "________;   |    ;   |    ;   |    ;   |    ;   |    ;________",
  J: "_________;     |  ;     |  ;     |  ;|    |  ;|    |  ; \\____/  ",
  K: "\\      /;\\    / ; |  /  ; | /   ; |/\\   ; /  \\  ;/    \\ ",
  L: "\\       ;\\       ;\\       ;\\       ;\\       ;\\       ;\\______/",
  M: "\\/\\/\\  / ;\\    /  ; \\  /   ;  \\/    ;  /\\    ; /  \\   ;/    \\  ",
  N: "\\      /;\\ \\  / ; \\ \\ /  ;  \\ |  ;   /| \\  ;  / | \\ ; /  /  \\/",
  O: "  ____  ; /    \\ ;|      ;|      ;|      ;|      ; \\____/ ",
  P: "______  ;\\    \\ ; |   | ; |___| ; |      ; |      ; |      ",
  Q: "  ____  ; /    \\ ;|      ;|      ;|  ___ ;|    \\ \\; \\____\\\\/",
  R: "______  ;\\    \\ ; |   | ; |___| ; |  \\ \\ ; |   \\ ;/    \\ ",
  S: "  ______; /     ;|_____ ;|      ;|_____ ;|      ; \\_____/",
  T: "________;   |    ;   |    ;   |    ;   |    ;   |    ;   |    ",
  U: "\\      /;\\      ;\\      ;\\      ;\\      ;\\      ; \\____/ ",
  V: "\\      /;\\      ; \\    / ;  \\  /  ;   \\/   ;   /\\   ;  /  \\  ",
  W: "\\/  \\/\\/ ;\\      ; \\    / ; /|\\ \\ ;/ |  \\ ;  |  \\ ;  |  \\ ",
  X: "\\      /; \\    / ;  \\  /  ;   \\/   ;   /\\   ;  /  \\  ; /    \\ ",
  Y: "\\      /; \\    / ;  \\  /  ;   \\/   ;   |    ;   |    ;   |    ",
  Z: "________;      / ;     /  ;    /   ;   /    ;  /     ; /______",
  "0": "  ____  ; /    \\ ;|  /\\  ;| /  \\ ;| |  | ;| \\  / ; \\____/ ",
  "1": "   |    ;   |    ;   |    ;   |    ;   |    ;   |    ;________",
  "2": "  ____  ; /    \\ ;     /  ;   /    ;  /     ; /      ;/______ ",
  "3": " ______ ;/      ; \\___   ;      | ;      | ;\\     | ; \\____/ ",
  "4": "/    |  ;|    |  ;|    |  ;|____|  ;   /|   ;  / |   ; /  |   ",
  "5": "________;|       ;|_____  ;|      ;|_____ ;|      ; \\_____/",
  "6": "  ____  ; /      ;|       ;|_____  ;|    \\ ;|    | ; \\____/ ",
  "7": "________;      / ;     /  ;    /   ;   /    ;  /     ; /      ",
  "8": "  ____  ; /    \\ ;|      ; \\____/ ;|      ;|      ; \\____/ ",
  "9": "  ____  ; /    \\ ;|    | ;|    / ;|____/ ;|      ; \\____/ ",
  ".": "        ;        ;        ;        ;        ;   __   ;  /  \\  ",
  ",": "        ;        ;        ;        ;   __   ;  /  \\  ; /      ",
  "!": "   |    ;   |    ;   |    ;   |    ;   |    ;        ;   |    ",
  "?": " ______ ;/      ; \\___   ;      | ;      | ;        ;   |    ",
  "'": "   |    ;   |    ;        ;        ;        ;        ;        ",
  "-": "        ;        ;        ; ______ ;        ;        ;        ",
}, "Tall 7x8 figlet-style; maximally readable from across the room.");

// Font 5: SMALL — 3x3 compact
const SMALL = parseFont("small", "Small", 3, 4, {
  " ": "    ;    ;    ",
  A: " ## ;#  #;####",
  B: "### ;#  #;### ",
  C: " ###;#   ; ###",
  D: "### ;#  #;### ",
  E: "####;#   ;### ",
  F: "####;#   ;#   ",
  G: " ###;#   ;# ##",
  H: "#  #;####;#  #",
  I: "###; # ;###",
  J: "###;  #;## ",
  K: "#  #;##  ;#  #",
  L: "#   ;#   ;### ",
  M: "#  #;####;#  #",
  N: "#  #;## #;#  #",
  O: " ## ;#  #; ## ",
  P: "### ;#  #;#   ",
  Q: " ## ;#  #; ##*",
  R: "### ;#  #;# ##",
  S: " ###;#   ;### ",
  T: "###; # ; # ",
  U: "#  #;#  #; ## ",
  V: "#  #;#  #; ## ",
  W: "#  #;####;#  #",
  X: "#  #; ## ;#  #",
  Y: "#  #; ## ; #  ",
  Z: "###; #;###",
  "0": " ## ;#  #; ## ",
  "1": " # ;## ; # ",
  "2": "## ; #;###",
  "3": "## ; #;## ",
  "4": "# #;###;  #",
  "5": "###;## ;## ",
  "6": " ##;###;## ",
  "7": "###; #; # ",
  "8": " # ;# #; # ",
  "9": "## ;###; ##",
  ".": "   ;   ;## ",
  ",": "   ;## ;#  ",
  "!": "#;#;#",
  "?": "##; #; #",
  "'": "#; ; ",
  "-": "   ;###;   ",
  "/": "  #; # ;#  ",
  "+": "   ; # ;   ",
}, "Compact 3x4 — fits more text per line than other fonts.");

// Font 6: SHADOW — 5x5 with shadow effect using ▓
const SHADOW = parseFont("shadow", "Shadow", 5, 6, {
  " ": "      ;      ;      ;      ;      ",
  A: " ###  ;#   # ;##### ;#   # ;#  ##▓",
  B: "####  ;#   # ;####  ;#   # ;####▓▓",
  C: " #### ;#     ;#     ;#     ; ###▓▓",
  D: "####  ;#   # ;#   # ;#   # ;####▓▓",
  E: "##### ;#     ;####  ;#     ;####▓▓",
  F: "##### ;#     ;####  ;#     ;#   ▓▓",
  G: " #### ;#     ;#  ## ;#   # ; ###▓▓",
  H: "#   # ;#   # ;##### ;#   # ;#  #▓▓",
  I: "##### ;  #   ;  #   ;  #   ;  ##▓▓",
  J: "##### ;   #  ;   #  ;#  #  ; ## ▓▓",
  K: "#   # ;#  #  ;###   ;#  #  ;#  #▓▓",
  L: "#     ;#     ;#     ;#     ;####▓▓",
  M: "#   # ;## ## ;# # # ;#   # ;#  #▓▓",
  N: "#   # ;##  # ;# # # ;#  ## ;#  #▓▓",
  O: " ###  ;#   # ;#   # ;#   # ; ###▓▓",
  P: "####  ;#   # ;####  ;#     ;#   ▓▓",
  Q: " ###  ;#   # ;#   # ;#  #  ; ## #▓",
  R: "####  ;#   # ;####  ;#  #  ;#  #▓▓",
  S: " #### ;#     ; ###  ;    # ;####▓▓",
  T: "##### ;  #   ;  #   ;  #   ;  # ▓▓",
  U: "#   # ;#   # ;#   # ;#   # ; ###▓▓",
  V: "#   # ;#   # ;#   # ; # #  ;  # ▓▓",
  W: "#   # ;#   # ;# # # ;## ## ;#  #▓▓",
  X: "#   # ; # #  ;  #   ; # #  ;#  #▓▓",
  Y: "#   # ; # #  ;  #   ;  #   ;  # ▓▓",
  Z: "##### ;    # ;  #   ; #    ;####▓▓",
  "0": " ###  ;#  ## ;# # # ;##  # ; ###▓▓",
  "1": "  #   ; ##   ;  #   ;  #   ;#####▓",
  "2": " ###  ;#   # ;  ##  ; #    ;####▓▓",
  "3": "####  ;    # ; ##   ;    # ;####▓▓",
  "4": "  ##  ; # #  ;##### ;   #  ;   #▓▓",
  "5": "##### ;#     ;####  ;    # ;####▓▓",
  "6": " ###  ;#     ;####  ;#   # ; ###▓▓",
  "7": "##### ;    # ;   #  ;  #   ;  # ▓▓",
  "8": " ###  ;#   # ; ###  ;#   # ; ###▓▓",
  "9": " ###  ;#   # ; #### ;    # ; ###▓▓",
  ".": "      ;      ;      ;      ; ## ▓▓",
  ",": "      ;      ;      ; ##   ; #  ▓▓",
  "!": "  #   ;  #   ;  #   ;      ;  # ▓▓",
  "?": "####  ;    # ; ##   ;      ;  # ▓▓",
  "'": "  #   ;  #   ;      ;      ;     ▓",
  "-": "      ;      ; ###  ;      ;    ▓▓",
  "/": "    # ;   #  ;  #   ; #    ;#   ▓▓",
  "+": "      ;  #   ; ###  ;  #   ;    ▓▓",
}, "5x6 block letters with a ▓ shadow strip on the right edge — adds depth.");

// Font 7: SLANT — 5x6 italic-like
const SLANT = parseFont("slant", "Slant", 5, 7, {
  " ": "       ;       ;       ;       ;       ",
  A: "   /\\  ;  /  \\ ; / /\\ \\;/ /  \\ \\\\ \\  / /; \\  \\/ /",
  B: "____   ;\\   \\  ; \\___\\ ; /   / ;/____/  ",
  C: " _____ ;/     ;|     ;|     ; \\____/",
  D: "____   ;\\   \\ ;|    |;|    |;____/  ",
  E: "_____  ;\\     ;\\___  ;/     ;_____/",
  F: "_____  ;\\     ;\\___  ;/     ;/     ",
  G: " _____ ;/     ;|  __ ;|    \\; \\___/",
  H: "\\    /;\\  / ; \\/  ; /\\  / ;/    \\ ",
  I: "_____ ;  |   ;  |   ;  |   ;_____/",
  J: "_____ ;   |  ;   |  ;|  |  ; \\__/ ",
  K: "\\   / ;\\ /  ;|<   ;/ \\   ;/   \\ ",
  L: "\\     ;\\     ;\\     ;\\     ;_____/",
  M: "\\/\\/\\ ;\\    /; \\  / ;  \\/  ;  /\\  ",
  N: "\\    /;\\   / ; \\  / ;  \\ \\ ;   \\/ ",
  O: " __ _ ;/    \\\\  /\\  ;/ /  \\;\\____/",
  P: "____  ;\\   \\ ; \\___\\; /    ;/     ",
  Q: " ___  ;/   \\ ;|    |;\\  / /; \\_\\\\ ",
  R: "____  ;\\   \\ ; \\___\\; / \\  ;/   \\ ",
  S: " ____ ;/     ;\\___  ;    / ;____/ ",
  T: "_____ ;  |   ;  |   ;  |   ;  |   ",
  U: "\\    /;\\    /;\\    /;\\    /; \\__/ ",
  V: "\\    /;\\    /; \\  / ;  \\  ;   \\  ",
  W: "\\/  \\/ ;\\    /; \\  / ; /  \\ ;/    \\",
  X: "\\    /; \\  / ;  \\/  ; /  \\ ;/    \\",
  Y: "\\    /; \\  / ;  \\/  ;  |   ;  |   ",
  Z: "_____ ;   /  ;  /   ; /    ;/_____",
  "0": " ___  ;/   \\ ;|   |;|   |; \\___/ ",
  "1": "  |   ;  |   ;  |   ;  |   ;_____ ",
  "2": " ___  ;/   \\ ;   /  ;  /   ;/____ ",
  "3": "___   ;   \\  ; __|  ;    / ;___/  ",
  "4": "/   | ;|   |;|___|;    |;    |   ",
  "5": "_____ ;\\     ;\\___  ;    / ;___/  ",
  "6": " ___  ;/     ;\\___  ;/   \\ ; \\__/ ",
  "7": "_____ ;    / ;   /  ;  /   ; /    ",
  "8": " ___  ;/   \\ ; \\_/  ;/   \\ ; \\__/ ",
  "9": " ___  ;/   \\ ; \\___ ;    / ; \\__/ ",
  ".": "      ;      ;      ;      ;  __  ",
  ",": "      ;      ;      ;  __  ; /    ",
  "!": "  |   ;  |   ;  |   ;      ;  |   ",
  "?": "___   ;   \\  ; __|  ;      ;  |   ",
  "'": "  |   ;  |   ;      ;      ;      ",
  "-": "      ;      ; ___  ;      ;      ",
  "/": "    / ;   /  ;  /   ; /    ;/     ",
  "+": "      ;  |   ; ___  ;  |   ;      ",
}, "Italic 5x7 — letters lean right for a fast, technical feel.");

// Font 8: DIGITAL — 5x5 LCD-style
const DIGITAL = parseFont("digital", "Digital", 5, 5, {
  " ": "     ;     ;     ;     ;     ",
  A: " ### ;    #; ####;    #; ### ",
  B: "#### ;#   #;#### ;#   #;#### ",
  C: " ####;#    ;#    ;#    ; ####",
  D: "###  ;#  # ;#  # ;#  # ;###  ",
  E: "#####;#    ;#### ;#    ;#####",
  F: "#####;#    ;#### ;#    ;#    ",
  G: " ####;#    ;#  ##;#   #; ####",
  H: "#   #;#   #;#####;#   #;#   #",
  I: "#####;  #  ;  #  ;  #  ;#####",
  J: "#####;   # ;   # ;#  # ; ##  ",
  K: "#   #;## # ;###  ;# ## ;#  # ",
  L: "#    ;#    ;#    ;#    ;#####",
  M: "#   #;## ##;# # #;#   #;#   #",
  N: "#   #;##  #;# # #;#  ##;#   #",
  O: " ### ;#   #;#   #;#   #; ### ",
  P: "#### ;#   #;#### ;#    ;#    ",
  Q: " ### ;#   #;# # #;#  # ; ## #",
  R: "#### ;#   #;#### ;# ## ;#  # ",
  S: " ####;#    ; ### ;    #;#### ",
  T: "#####;  #  ;  #  ;  #  ;  #  ",
  U: "#   #;#   #;#   #;#   #; ### ",
  V: "#   #;#   #;#   #; # # ;  #  ",
  W: "#   #;#   #;# # #;## ##;#   #",
  X: "#   #; # # ;  #  ; # # ;#   #",
  Y: "#   #; # # ;  #  ;  #  ;  #  ",
  Z: "#####;   # ;  #  ; #   ;#####",
  "0": " ### ;#  ##;# # #;##  #; ### ",
  "1": "  #  ; ##  ;  #  ;  #  ;#####",
  "2": " ### ;#   #;  ## ; #   ;#####",
  "3": "#### ;    #; ##  ;    #;#### ",
  "4": "  ## ; # # ;#####;   # ;   # ",
  "5": "#####;#    ;#### ;    #;#### ",
  "6": " ### ;#    ;#### ;#   #; ### ",
  "7": "#####;    #;   # ;  #  ;  #  ",
  "8": " ### ;#   #; ### ;#   #; ### ",
  "9": " ### ;#   #; ####;    #; ### ",
  ".": "     ;     ;     ;     ; ##  ",
  ",": "     ;     ;     ; ##  ; #   ",
  "!": "  #  ;  #  ;  #  ;     ;  #  ",
  "?": "#### ;    #; ##  ;     ;  #  ",
  "'": "  #  ;  #  ;     ;     ;     ",
  "-": "     ;     ; ### ;     ;     ",
  "/": "    #;   # ;  #  ; #   ;#    ",
  "+": "     ;  #  ; ### ;  #  ;     ",
}, "LCD/7-segment-like 5x5 — straight strokes only, no diagonals.");

// Font 9: THIN — 5x5 thin outline
const THIN = parseFont("thin", "Thin", 5, 5, {
  " ": "     ;     ;     ;     ;     ",
  A: "  _  ; / \\ ;/   \\;\\_/_/;     ",
  B: "___  ;|__] ;|__  ;|__] ;___  ",
  C: " ___ ;/   _;|  | ;|   |;\\___/",
  D: "___  ;|  \\ ;|   |;|   |;|__/ ",
  E: "____ ;|    ;|___ ;|    ;|____",
  F: "____ ;|    ;|___ ;|    ;|    ",
  G: " ___ ;/   _;|  | ;|   |;\\__]|",
  H: "|   |;|___|;|   |;|   |;|   |",
  I: "_____;  |  ;  |  ;  |  ;_____",
  J: "_____;   | ;   | ;|  | ; \\_/ ",
  K: "|  / ;| /  ;|<<  ;| \\  ;|  \\ ",
  L: "|    ;|    ;|    ;|    ;|____",
  M: "|\\ /|;| V |;|   |;|   |;|   |",
  N: "|\\  |;| \\ |;|  \\|;|   |;|   |",
  O: " ___ ;/   \\;|   |;|   |;\\___/",
  P: "___  ;|__] ;|__  ;|    ;|    ",
  Q: " ___ ;/   \\;|   |;|  \\|;\\__|\\",
  R: "___  ;|__] ;|__  ;| \\  ;|  \\ ",
  S: " ____;/    ;|___ ;    |;____/",
  T: "_____;  |  ;  |  ;  |  ;  |  ",
  U: "|   |;|   |;|   |;|   |;|___|",
  V: "|   |;|   |;|   |; \\ / ;  V  ",
  W: "|   |;|   |;| | |;| | |;|   |",
  X: "\\   /; \\ / ;  X  ; / \\ ;/   \\",
  Y: "\\   /; \\ / ;  X  ;  |  ;  |  ",
  Z: "_____;   / ;  /  ; /   ;/____",
  "0": " ___ ;/   \\;| | |;|   |; \\_/ ",
  "1": "  |  ; _|_ ;  |  ;  |  ;|___|",
  "2": " ___ ;/   \\;   / ;  /  ;/____",
  "3": "____;   /;__| ;   \\;____/",
  "4": "/  | ;|  | ;|__|_;   | ;   | ",
  "5": "____ ;|    ;|___ ;    |;____/",
  "6": " ___ ;/    ;|___ ;|   |;\\___/",
  "7": "_____;   / ;  /  ; /   ;/    ",
  "8": " _-_ ;|   |;-_  ;|   |; _-_ ",
  "9": " _-_ ;|   |; -__ ;    |;\\___/",
  ".": "     ;     ;     ;     ;  __ ",
  ",": "     ;     ;     ;  __ ; /   ",
  "!": "  |  ;  |  ;  |  ;     ;  |  ",
  "?": "____ ;   / ; _|  ;     ;  |  ",
  "'": "  |  ;  |  ;     ;     ;     ",
  "-": "     ;     ; ___ ;     ;     ",
  "/": "    /;   / ;  /  ; /   ;/    ",
  "+": "     ;  |  ; ___ ;  |  ;     ",
}, "Thin outline 5x5 using | / \\ _ strokes — minimal, readable.");

// Font 10: THICK — 5x5 thick outline
const THICK = parseFont("thick", "Thick", 5, 6, {
  " ": "      ;      ;      ;      ;      ",
  A: "  __  ; /  \\ ;/ /\\ \\;\\ \\/ /; \\  / ",
  B: " ____ ;|    \\;|====|;|    /;|____/",
  C: " ____;/    ;|    ;|    ;\\____",
  D: " ____ ;|    \\;|    |;|    |;|____/",
  E: "_____ ;|     ;|==== ;|     ;|_____",
  F: "_____ ;|     ;|==== ;|     ;|     ",
  G: " ____;/     ;|  __ ;|    \\;\\____/",
  H: "|    |;|====|;|    |;|    |;|    |",
  I: "______;  ||  ;  ||  ;  ||  ;______",
  J: "______;/     ;/     ;|    |;|____/",
  K: "|    /;|   / ;|==<  ;|   \\ ;|    \\",
  L: "|     ;|     ;|     ;|     ;|_____",
  M: "|\\    /;| \\  / ;|  \\/  ;|  /\\  ;| /  \\ ",
  N: "|\\   |;| \\  |;|  \\ |;|   \\|;|    |",
  O: " ____ ;/    \\;|    |;|    |;\\____/",
  P: " ____ ;|    \\;|====|;|     ;|     ",
  Q: " ____ ;/    \\;|    |;|    |;\\___/|",
  R: " ____ ;|    \\;|====|;|  \\  ;|    \\",
  S: " ____;/     ;|==== ;\\     ;\\____/",
  T: "______;  ||  ;  ||  ;  ||  ;  ||  ",
  U: "|    |;|    |;|    |;|    |;\\____/",
  V: "|    |;|    |;|    |; \\  / ;  \\/  ",
  W: "|    |;|    |;|  |||;| /||\\;|/  \\|",
  X: "\\    /; \\  / ;  \\/  ; /  \\ ;/    \\",
  Y: "\\    /; \\  / ;  \\/  ;  ||  ;  ||  ",
  Z: "______;/     ; \\    ;  \\   ;   \\__",
  "0": " ____ ;/    \\;| || |;|    |;\\____/",
  "1": "  ||  ;  ||  ;  ||  ;  ||  ;______",
  "2": " ____ ;/    \\;    / ;   /  ;/____ ",
  "3": "_____ ;     ; ___ ;     ;\\____/",
  "4": "/   | ;|   | ;|===|;    | ;    | ",
  "5": "_____ ;|     ;|==== ;     ;\\____/",
  "6": " ____;/     ;|==== ;|    |;\\____/",
  "7": "______;/     ; /    ;/     ;/     ",
  "8": " ____ ;/    \\;|====|;|    |;\\____/",
  "9": " ____ ;/    \\;|==== ;     ;\\____/",
  ".": "      ;      ;      ;      ;  __  ",
  ",": "      ;      ;      ;  __  ; /    ",
  "!": "  ||  ;  ||  ;  ||  ;      ;  ||  ",
  "?": "_____ ;     ; __|| ;      ;  ||  ",
  "'": "  ||  ;  ||  ;      ;      ;      ",
  "-": "      ;      ;======;      ;      ",
  "/": "    / ;   /  ;  /   ; /    ;/     ",
  "+": "      ;  ||  ;======;  ||  ;      ",
}, "Heavy 5x6 with double-stroke === fill — reads at any size.");

// Font 11: MINI — 3x3 super-compact
const MINI = parseFont("mini", "Mini", 3, 3, {
  " ": "   ;   ;   ",
  A: "/\\ ;/__;",
  B: "|\\ ;|/ ;|\\ ",
  C: " / ;<  ; \\_",
  D: "|\\ ;| >;|/ ",
  E: "|__;|_ ;|__",
  F: "|__;|_ ;|  ",
  G: " / ;|_ ;|_]",
  H: "| |;|-|;| |",
  I: "|-|; | ;|-|",
  J: " |-;  |;|_ ",
  K: "|/ ;|< ;| \\",
  L: "|  ;|  ;|_]",
  M: "/\\;;/XX;",
  N: "|\\;;|\\|;",
  O: "/\\;||;",
  P: "|\\ ;|/ ;|  ",
  Q: "/\\;||;\\>",
  R: "|\\ ;|< ;| \\",
  S: " / ;[_ ;_]",
  T: "TTT; T ; T ",
  U: "| |;| |;\\_/",
  V: "\\ /; V ;   ",
  W: "\\ /;X X;\\_/",
  X: "\\ ; X;/ ",
  Y: "\\ /; X ; | ",
  Z: "__; /;/_",
  "0": "/\\;||;",
  "1": " |;_|; |",
  "2": " /;[_;_]",
  "3": " _;_|;_]",
  "4": "/| ;||; |",
  "5": "[_;\\ ;_]",
  "6": " / ;[_;_]",
  "7": "__; /;/ ",
  "8": "/\\;><;",
  "9": "/\\;>_;_]",
  ".": "   ;   ;__ ",
  ",": "   ;__ ;|  ",
  "!": "|;|;*",
  "?": "/; ;|",
  "'": "|; ; ",
  "-": "   ;___;   ",
  "/": "  /; / ;/  ",
  "+": "   ; | ;   ",
}, "Tiny 3x3 — maximally compact; useful for inline banner labels.");

// Font 12: LETTERS — letters spelled out
const LETTERS = parseFont("letters", "Letters", 1, 1, {
  " ": " ",
  A: "A", B: "B", C: "C", D: "D", E: "E", F: "F", G: "G", H: "H",
  I: "I", J: "J", K: "K", L: "L", M: "M", N: "N", O: "O", P: "P",
  Q: "Q", R: "R", S: "S", T: "T", U: "U", V: "V", W: "W", X: "X",
  Y: "Y", Z: "Z",
  "0": "0", "1": "1", "2": "2", "3": "3", "4": "4", "5": "5",
  "6": "6", "7": "7", "8": "8", "9": "9",
  ".": ".", ",": ",", "!": "!", "?": "?", "'": "'",
  "-": "-", "/": "/", "+": "+", ":": ":", ";": ";",
  "(": "(", ")": ")",
}, "Passthrough — just the raw text in your typed case. Useful as a sanity check / spacer mode.");

export const FONTS: AsciiFont[] = [
  BLOCK, BANNER, STANDARD, BIG, SMALL, SHADOW,
  SLANT, DIGITAL, THIN, THICK, MINI, LETTERS,
];

export const FONT_BY_ID: Record<string, AsciiFont> = Object.fromEntries(
  FONTS.map((f) => [f.id, f]),
);

export function getFont(id: string): AsciiFont | null {
  return FONT_BY_ID[id] ?? null;
}

// ---------- Glyph lookup ----------

/** Look up the glyph for a character in a font; fall back to space, then to a blank. */
export function lookupGlyph(font: AsciiFont, ch: string): string[] {
  if (font.glyphs[ch]) return font.glyphs[ch];
  // Try uppercase
  const up = ch.toUpperCase();
  if (font.glyphs[up]) return font.glyphs[up];
  // Try space
  if (font.glyphs[" "]) return font.glyphs[" "];
  // Blank
  return Array<string>(font.height).fill(" ".repeat(font.width));
}

// ---------- Character-set overlay ----------

/** Apply a character-set overlay: replace every non-space character with the overlay char. */
export function applyCharSet(lines: string[], charSet: CharSet): string[] {
  if (charSet === "raw") return lines;
  const overlay = CHARSET_OVERLAYS[charSet];
  return lines.map((line) =>
    line
      .split("")
      .map((c) => (c === " " ? " " : overlay))
      .join(""),
  );
}

// ---------- Render ----------

/** Render a single line of text using a font. Returns an array of `height` strings. */
export function renderLine(text: string, font: AsciiFont, opts: RenderOptions = {}): string[] {
  const letterSpacing = opts.letterSpacing ?? 1;
  const sep = " ".repeat(letterSpacing);
  const chars = text.split("");
  // For each char, get its glyph (array of `height` strings)
  const glyphs = chars.map((c) => lookupGlyph(font, c));
  // Build `height` output rows
  const rows: string[] = [];
  for (let row = 0; row < font.height; row++) {
    const parts: string[] = [];
    for (let i = 0; i < glyphs.length; i++) {
      const g = glyphs[i];
      const line = g[row] ?? "";
      parts.push(line);
      if (i < glyphs.length - 1) parts.push(sep);
    }
    rows.push(parts.join(""));
  }
  return transformLines(rows, opts);
}

/** Apply optional flipH / flipV transforms to rendered lines. */
export function transformLines(lines: string[], opts: RenderOptions = {}): string[] {
  let out = lines.slice();
  if (opts.flipH) {
    out = out.map((l) => l.split("").reverse().join(""));
  }
  if (opts.flipV) {
    out = out.reverse();
  }
  return out;
}

/** Wrap a long text into multiple lines that fit within `maxWidth` columns of output. */
export function wrapText(text: string, font: AsciiFont, maxWidth: number, letterSpacing = 1): string[] {
  if (maxWidth <= 0) return [text];
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  // Compute the rendered width of a single word
  const wordWidth = (w: string): number => {
    let total = 0;
    const chars = w.split("");
    for (let i = 0; i < chars.length; i++) {
      total += font.width;
      if (i < chars.length - 1) total += letterSpacing;
    }
    return total;
  };
  const lines: string[] = [];
  let current: string[] = [];
  let currentWidth = 0;
  for (const word of words) {
    const w = wordWidth(word);
    // If the word itself is too long, render it alone
    if (w > maxWidth) {
      if (current.length > 0) {
        lines.push(current.join(" "));
        current = [];
        currentWidth = 0;
      }
      lines.push(word);
      continue;
    }
    // Compute width if we add this word + separator
    const sep = current.length > 0 ? letterSpacing + font.width : 0; // a space glyph + letterSpacing
    const sepWidth = current.length > 0 ? font.width + letterSpacing : 0;
    if (currentWidth + sepWidth + w > maxWidth) {
      lines.push(current.join(" "));
      current = [word];
      currentWidth = w;
    } else {
      current.push(word);
      currentWidth += sepWidth + w;
    }
  }
  if (current.length > 0) lines.push(current.join(" "));
  return lines;
}

/** Render an entire (possibly multi-line) text block. */
export function renderText(text: string, font: AsciiFont, opts: RenderOptions = {}): string {
  const maxWidth = opts.maxWidth ?? 80;
  const letterSpacing = opts.letterSpacing ?? 1;
  const lines = wrapText(text, font, maxWidth, letterSpacing);
  if (lines.length === 0) return "";
  const renderedBlocks = lines.map((line) => renderLine(line, font, opts));
  // Join blocks with a blank line of separator
  const blankRow = " ".repeat(Math.min(maxWidth, 200));
  const out: string[] = [];
  for (let i = 0; i < renderedBlocks.length; i++) {
    if (i > 0) out.push(blankRow);
    out.push(...renderedBlocks[i]);
  }
  let result = out.join("\n");
  // Apply character-set overlay AFTER all rendering and transforms
  if (opts.charSet && opts.charSet !== "raw") {
    const linesArr = result.split("\n");
    result = applyCharSet(linesArr, opts.charSet).join("\n");
  }
  return result;
}

// ---------- Wrappers ----------

/** Wrap rendered output as a Markdown fenced code block. */
export function wrapAsMarkdown(art: string, language = ""): string {
  return "```" + language + "\n" + art + "\n```";
}

/** Wrap rendered output as an HTML <pre> block. */
export function wrapAsHtml(art: string): string {
  const escaped = art
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; line-height: 1.1; white-space: pre;">\n${escaped}\n</pre>`;
}

/** Wrap rendered output as a slash-star code comment block. */
export function wrapAsComment(art: string, style: "c" | "shell" | "hash" = "c"): string {
  const lines = art.split("\n");
  if (style === "c") {
    return ["/**", ...lines.map((l) => ` * ${l}`), " */"].join("\n");
  }
  if (style === "shell") {
    return lines.map((l) => `# ${l}`).join("\n");
  }
  return lines.map((l) => `// ${l}`).join("\n");
}

/** Build a downloadable HTML document wrapping the rendered output. */
export function buildHtmlDocument(art: string, title = "ASCII Art"): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
body { background: #0b0e14; color: #c8d3e0; padding: 2rem; }
pre { font-family: ui-monospace, SFMono-Regular, Menlo, "Courier New", monospace;
      line-height: 1.1; white-space: pre; font-size: 12px; }
</style>
</head>
<body>
<pre>${art.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
</body>
</html>`;
}

/** Compute the rendered width (columns) of the widest line. */
export function renderedWidth(art: string): number {
  return art.split("\n").reduce((m, l) => Math.max(m, l.length), 0);
}

/** Compute the rendered height (rows). */
export function renderedHeight(art: string): number {
  return art.split("\n").length;
}

// ---------- History (localStorage) ----------

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

// ---------- Shareable URL ----------

export function buildShareUrl(text: string, fontId: string, charSet: CharSet, width: number, flipH: boolean, flipV: boolean): string {
  const params = new URLSearchParams();
  if (text) params.set("text", text);
  if (fontId) params.set("font", fontId);
  if (charSet !== "raw") params.set("cs", charSet);
  if (width !== 80) params.set("w", width.toString(10));
  if (flipH) params.set("fh", "1");
  if (flipV) params.set("fv", "1");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export interface ShareState {
  text: string;
  fontId: string;
  charSet: CharSet;
  width: number;
  flipH: boolean;
  flipV: boolean;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const defaultState: ShareState = {
    text: "", fontId: "block", charSet: "raw", width: 80, flipH: false, flipV: false,
  };
  if (!clean) return defaultState;
  const params = new URLSearchParams(clean);
  const text = params.get("text") ?? "";
  const fontId = params.get("font") ?? "block";
  const csRaw = params.get("cs");
  const validCs: CharSet[] = ["raw", "hash", "block", "slash", "dot", "star"];
  const charSet: CharSet = csRaw && validCs.includes(csRaw as CharSet) ? (csRaw as CharSet) : "raw";
  const widthRaw = params.get("w");
  const width = widthRaw ? Math.max(20, Math.min(500, parseInt(widthRaw, 10) || 80)) : 80;
  const flipH = params.get("fh") === "1";
  const flipV = params.get("fv") === "1";
  return { text, fontId, charSet, width, flipH, flipV };
}
