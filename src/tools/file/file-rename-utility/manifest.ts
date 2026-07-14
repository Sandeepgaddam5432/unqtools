import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "file-rename-utility",
  name: "File Rename Utility",
  description:
    "Batch rename files with pattern rules — find/replace, regex, sequential numbering (001, 002…), case conversion (upper/lower/title/kebab/camel), prefix/suffix, character cleanup, truncation, extension change. Live before/after preview and JSON export of the rename plan. 100% client-side.",
  category: "file",
  keywords: [
    "rename files", "batch rename", "file renamer", "rename utility",
    "find replace filename", "sequential numbering", "case conversion",
    "prefix suffix", "regex rename", "file rename utility",
  ],
  icon: "pencil-line",
  requiresNetwork: false,
  seo: {
    title: "File Rename Utility — Batch Rename with Patterns | UnQTools",
    faq: [
      { q: "What does the File Rename Utility do?", a: "It applies pattern rules to rename multiple files at once: find/replace (plain or regex), sequential numbering (file_001, file_002…), case conversion (UPPER, lower, Title, kebab-case, camelCase), prefix/suffix, character cleanup (remove specific chars or keep only alphanumeric), and truncation to a max length. You see a live before/after preview before applying." },
      { q: "Can I use regex for find/replace?", a: "Yes. Switch the find mode to 'Regex' and enter a JavaScript-style regex pattern (e.g. \\d{4}-\\d{2}-\\d{2} to match dates). Use $1, $2 in the replacement to reference capture groups." },
      { q: "How does sequential numbering work?", a: "Pick a starting number (default 1) and a padding width (default 3 → 001, 002, 003). Use the {n} placeholder in your naming pattern. Files are numbered in their current sort order." },
      { q: "Can I undo the rename?", a: "Yes. Every rename session creates an 'undo plan' mapping new names back to original names. Click 'Undo' to revert (works as long as the files are still in their renamed state — the mapping is stored in localStorage history too)." },
      { q: "How do I download the renamed files?", a: "Click 'Download all' to get a ZIP containing every file with its new name. Or download the rename plan as JSON (a list of {originalName, newName} pairs) for scripting or auditing." },
      { q: "What extra features does this tool have?", a: "10 extras: (1) Drag-drop multiple files. (2) Regex find/replace with capture groups. (3) Remove specific characters (e.g. remove all spaces or punctuation). (4) Keep only alphanumeric (strip everything else). (5) Truncate to max length (preserves extension). (6) Sort files before renaming (by name / size / date). (7) Undo — revert to original names. (8) Export rename plan as JSON. (9) History (localStorage — last 10 rename plans). (10) Shareable URL with rename settings." },
      { q: "Are my files uploaded anywhere?", a: "No. All rename logic runs in your browser. When you download, the renamed files are packaged locally. Your files never leave your device." },
    ],
  },
  status: "done",
};
