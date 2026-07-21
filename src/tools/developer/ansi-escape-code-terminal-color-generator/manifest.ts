/**
 * ANSI Escape Code Terminal Color Generator — Tool Manifest.
 * Tool #331 — Category 4 (Developer & Code).
 *
 * Visually compose terminal text styling — foreground/background color,
 * bold, italic, underline, blink, etc. — and get the exact ANSI escape
 * sequence with a live terminal-style preview and copy-ready snippets
 * for many languages. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ansi-escape-code-terminal-color-generator",
  name: "ANSI Escape Code / Terminal Color Generator",
  description:
    "Visually compose terminal text styling — FG/BG color in 16/256/24-bit truecolor, SGR styles (bold, faint, italic, underline, blink, inverse, hidden, strikethrough) — and get the exact ANSI escape sequence with a live preview. Multi-format escape output (\\x1b, \\033, \\e, \\u001b, raw ESC), language snippets (bash printf, Python, JS, Go, Rust, C), reverse decoder (paste a sequence → see what it does), hex→256 and hex→truecolor conversion, 256-color palette grid, strip-ANSI helper, terminal-support notes. 100% client-side.",
  category: "developer",
  keywords: [
    "ansi escape code", "terminal color", "ansi color generator",
    "256 color terminal", "truecolor terminal", "24-bit color terminal",
    "printf color bash", "sgr codes", "ansi 16 color",
    "ansi 256 color", "terminal color codes", "bash color escape",
    "ansi sequence decoder", "strip ansi",
  ],
  icon: "palette",
  requiresNetwork: false,
  seo: {
    title: "ANSI Escape Code / Terminal Color Generator — 16/256/Truecolor | UnQTools",
    faq: [
      {
        q: "What color modes does the generator support?",
        a: "All four: (1) Standard 16-color (codes 30–37 / 40–47 foreground/background). (2) Bright 16-color (90–97 / 100–107). (3) 256-color cube (38;5;N / 48;5;N where N is 0–255, with 16 + 36r + 6g + b cube math and a 232–255 grayscale ramp). (4) 24-bit truecolor (38;2;r;g;b / 48;2;r;g;b). Plus every SGR style — bold, faint, italic, underline, blink, inverse, hidden, strikethrough.",
      },
      {
        q: "Which escape sequence formats can I copy?",
        a: "Five. The same SGR parameters can be rendered as \\x1b[…m (JS/C/Go string), \\033[…m (shell printf), \\e[…m (bash echo -e), \\u001b[…m (JS template literal / JSON), or a raw ESC character (0x1B). The tool always auto-appends \\x1b[0m reset to avoid color bleed, and you can toggle showing a visible ^[ marker versus the literal escape.",
      },
      {
        q: "Does it generate language-specific snippets?",
        a: "Yes — copy-ready snippets for bash `printf` and `echo -e`, Python 3 (`print('\\033[31m…')`), Node.js (`process.stdout.write`), Go (`fmt.Printf`), Rust (`print!` with `\\x1b`), and C (`printf`). Each snippet wraps your sample text with the chosen escape and reset so it compiles and runs verbatim.",
      },
      {
        q: "Can I decode an existing ANSI sequence?",
        a: "Yes. Paste any string containing SGR escape codes (e.g. `\\x1b[1;38;5;208mHello\\x1b[0m`) and the reverse decoder lists every applied attribute — styles, foreground color (with mode + value), background color, and any resets. It also flags malformed sequences. A `strip ANSI` helper removes all escapes from a string.",
      },
      {
        q: "What extra features does this tool have versus other ANSI generators?",
        a: "(1) Four color modes (16, bright, 256, truecolor) with FG and BG pickers. (2) All 8 SGR styles as independent toggles. (3) Five escape-format renderings. (4) Language snippets for bash/Python/JS/Go/Rust/C. (5) Reverse decoder for pasted sequences. (6) hex→256 and hex→truecolor conversion with the canonical 16+36r+6g+b cube math. (7) 256-color palette grid with IDs. (8) Live terminal-style preview that honors the codes. (9) Strip-ANSI helper. (10) Terminal-support notes (truecolor/italic/blink caveats). (11) Reset auto-appended to prevent bleed. (12) Visible-^[ toggle. (13) Copy sequence / copy snippet / share URL. (14) History (localStorage, last 20). 100% client-side — nothing uploaded, no ads.",
      },
    ],
  },
  status: "done",
};
