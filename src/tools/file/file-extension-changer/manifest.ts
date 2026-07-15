import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "file-extension-changer",
  name: "File Extension Changer",
  description:
    "Batch change file extensions safely — add, remove, or replace extensions. Drag-drop multiple files, regex find/replace, case conversion, presets, conflict detection, undo, JSON export. 100% client-side.",
  category: "file",
  keywords: [
    "file extension changer", "change extension", "rename extension",
    "add extension", "remove extension", "replace extension",
    "batch extension", "file rename", "regex extension", "extension converter",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "File Extension Changer — Batch Add/Remove/Replace Extensions | UnQTools",
    faq: [
      { q: "What does the File Extension Changer do?", a: "It batch-changes file extensions: add an extension to files without one, remove existing extensions, or replace one extension with another. You can apply plain or regex find/replace on extensions, convert case, and use common presets like .txt, .csv, .json, .xml, .html. Live before/after preview lets you verify before applying." },
      { q: "Can I use regex for find/replace on extensions?", a: "Yes. Switch the find mode to 'Regex' and enter a JavaScript-style regex pattern. Useful for patterns like \\d+$ to strip trailing digits from extensions, or for converting .jpeg to .jpg." },
      { q: "Does it preserve the original filename?", a: "Yes — by default the stem (filename without extension) is preserved untouched. Only the extension part is modified, unless you opt into regex find/replace which can match across the whole filename." },
      { q: "What happens if two files end up with the same name?", a: "Conflict detection flags any rename that would collide with another file in the batch. Collisions are shown as warnings in the preview and excluded from the rename stats." },
      { q: "What extra features does this tool have?", a: "10 extras: (1) Drag-drop multiple files. (2) Regex find/replace on extension. (3) Case conversion (upper/lower). (4) Common extension presets (.txt/.csv/.json/.xml/.html). (5) Conflict detection. (6) Undo — revert to original names. (7) Stats (changed/skipped counts). (8) Export rename plan as JSON. (9) History (localStorage — last 10 plans). (10) Shareable URL with settings." },
      { q: "Are my files uploaded anywhere?", a: "No. All rename logic runs in your browser. When you download, the renamed files are packaged locally. Your files never leave your device." },
    ],
  },
  status: "done",
};
