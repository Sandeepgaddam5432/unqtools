import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "text-file-joiner",
  name: "Text File Joiner",
  description:
    "Merge multiple text files (.txt, .log, .md, .csv, .json) into one with custom separators, filename headers, line numbering, dedup, sorting, and stats. 100% client-side, no upload.",
  category: "file",
  keywords: [
    "text merge", "txt join", "log merge", "combine files", "merge files",
    "concatenate text", "join text", "line numbering", "filename header",
    "text file joiner", "file combiner",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "Text File Joiner — Merge .txt/.log/.md Files Online | UnQTools",
    faq: [
      { q: "What does the Text File Joiner do?", a: "It merges multiple text files (.txt, .log, .md, .csv, .json, etc.) into a single output. You can add filename headers, line numbers, custom separators, remove empty lines, trim whitespace, dedup lines, and sort lines alphabetically." },
      { q: "What separator options are available?", a: "Single newline (default), double newline (blank line between files), or a custom string you specify (e.g. '---' or '\\n===\\n'). Filename headers can be prepended before each file's content." },
      { q: "Can I reorder files before merging?", a: "Yes. Drag files up/down using the arrow buttons to control the merge order. The merged output respects the order shown in the list." },
      { q: "What extra features does this tool have?", a: "10 extras: (1) Drag-drop multiple files. (2) File order reorder (up/down arrows). (3) Per-file stats (line/word/char count, size). (4) Preview of merged output (first 200 lines). (5) Custom separator (any string). (6) Remove empty lines. (7) Trim whitespace per line. (8) Sort lines alphabetically. (9) Dedup lines. (10) History (localStorage — last 10 merges)." },
      { q: "Are my text files uploaded anywhere?", a: "No. All file reading and merging happens in your browser via the File API. Your data never leaves your device." },
      { q: "What's the maximum file size?", a: "There's no hard limit, but very large files (> 50MB) may slow the browser. We process files sequentially and show progress." },
    ],
  },
  status: "done",
};
