/**
 * Hex Dump / Hex Viewer & Editor — Tool Manifest.
 * Tool #368 — Category 4 (Developer & Code).
 *
 * Display binary data as a classic hex dump (offset | hex bytes | ASCII
 * gutter) with in-place editing, byte insert/delete, search by hex bytes /
 * text / regex, goto offset, multi-format display (hex / decimal / binary /
 * octal), a data inspector decoding int8/16/32/64 (signed & unsigned),
 * float32/64, LEB128, and strings (ASCII / UTF-8 / UTF-16) at the cursor in
 * both endiannesses, and file import via ArrayBuffer. 100% client-side,
 * nothing uploaded.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "hex-dump-hex-viewer-editor",
  name: "Hex Dump Viewer & Editor (with Data Inspector)",
  description:
    "Display binary data as a classic hex dump (offset | hex bytes | ASCII gutter) with in-place editing, byte insert/delete with undo, search by hex bytes / ASCII text / regex, goto offset, multi-format display (hex / decimal / binary / octal), a data inspector decoding int8/16/32/64 (signed & unsigned), float32/64, LEB128, and strings (ASCII / UTF-8 / UTF-16) at the cursor in both endiannesses, and file import via ArrayBuffer. 100% client-side, nothing uploaded.",
  category: "developer",
  keywords: [
    "hex dump", "hex viewer", "hex editor", "binary viewer",
    "online hex editor", "edit binary file in browser", "data inspector",
    "byte editor", "ascii gutter", "offset table",
    "uint8 array viewer", "endianness", "leb128 decoder", "file hex dump",
  ],
  icon: "binary",
  requiresNetwork: false,
  seo: {
    title: "Hex Dump Viewer & Editor with Data Inspector (100% client-side) | UnQTools",
    faq: [
      {
        q: "What does the hex dump viewer do?",
        a: "Drop or paste any binary data and the tool renders a classic three-pane hex dump: byte offset on the left, the hex bytes in the middle (grouped 2-per-byte, configurable bytes per line of 8 / 16 / 32), and an ASCII gutter on the right where non-printable bytes (outside 32-126) are shown as dots. You can edit any byte in place by clicking the hex or ASCII cell, insert or delete bytes, undo / redo any edit, search by hex bytes / ASCII text / regex, jump to any offset (decimal or hex), and read a live data inspector that decodes every numeric type and string encoding at the cursor.",
      },
      {
        q: "What does the data inspector show?",
        a: "At the current cursor offset, the inspector decodes the next bytes as: int8 / uint8, int16 / uint16, int32 / uint32, int64 / uint64 (both big-endian and little-endian), float32 (single) and float64 (double) in both endians, LEB128 (unsigned and signed), and strings in ASCII / UTF-8 / UTF-16 (BE and LE) up to a configurable length. The decoded values update instantly as you move the cursor or edit bytes.",
      },
      {
        q: "Can I import a real file?",
        a: "Yes. Use the Import file button and pick any binary file — it is read into an ArrayBuffer via the FileReader API, sliced into a Uint8Array, and rendered in the hex grid. Files never leave the browser; there is no upload, no server round-trip, no telemetry. You can also paste hex bytes (e.g. 'FFD8FFE0' or 'FF D8 FF E0') or ASCII text directly into the input box and the tool parses it into bytes.",
      },
      {
        q: "How does search work?",
        a: "Three search modes: (1) Hex bytes — type a hex string with or without spaces ('FFD8FF' or 'FF D8 FF') and the tool finds every match with its byte offset. (2) Text — type ASCII text and the tool encodes it to UTF-8 and searches byte-by-byte. (3) Regex — for flexible ASCII matching. All matches are highlighted in the dump and listed with their offsets; click any match to jump to it. Search runs client-side in pure JS, no server.",
      },
      {
        q: "What extra features does this tool have compared to other hex viewers?",
        a: "(1) In-place byte editing via the hex grid or ASCII gutter (most viewers are read-only). (2) Insert / delete bytes with undo / redo (not just overwrite). (3) Full data inspector: int8/16/32/64 signed & unsigned, float32/64, LEB128 (unsigned & signed), and ASCII / UTF-8 / UTF-16 strings, in both endiannesses. (4) Three search modes: hex bytes, ASCII text, regex. (5) Goto offset (decimal or hex). (6) Multi-format display: hex / decimal / binary / octal at the cursor. (7) Configurable bytes per line (8 / 16 / 32) and byte grouping. (8) Import any file via ArrayBuffer (drag-drop or file picker). (9) Selection checksums (CRC32, Adler32, sum8/16/32, XOR). (10) Export the edited bytes as a new file. (11) History (localStorage, last 20 sessions). (12) Shareable URL with the hex content round-tripped (for small inputs). 100% client-side and offline — your bytes never leave the device.",
      },
    ],
  },
  status: "done",
};
