/**
 * Vim Cheatsheet & Keybinding Reference — Tool Manifest.
 * Tool #335 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "vim-cheatsheet-keybinding-reference",
  name: "Vim Cheatsheet & Keybinding Reference",
  description:
    "Searchable, interactive Vim/Neovim cheatsheet with 100+ commands across movement, editing, insert, visual, search/replace, registers, marks, folding, windows/tabs, and exiting. Includes an interactive keyboard map (per-mode meanings), a verb+noun grammar explainer (operator × motion × text-object), reverse intent lookup ('delete inside quotes' → di\"), and a .vimrc snippet generator. 100% client-side.",
  category: "developer",
  keywords: [
    "vim", "vim cheat sheet", "vim commands", "vim keybindings",
    "vim reference", "vim motions", "vim text objects", "vim operators",
    "neovim cheatsheet", "vimrc", "vim grammar", "vim delete inside",
  ],
  icon: "keyboard",
  requiresNetwork: false,
  seo: {
    title: "Vim Cheatsheet & Keybinding Reference — 100+ Commands, Grammar, .vimrc | UnQTools",
    faq: [
      {
        q: "How many Vim commands does this reference include?",
        a: "100+ commands across 10 categories: Movement, Editing, Insert Mode, Visual Mode, Search & Replace, Registers & Macros, Marks, Folding, Windows & Tabs, and Exiting. Each entry includes the keystroke, a plain-English description, the modes it works in, and any count-prefix behavior (e.g. 3dd deletes three lines).",
      },
      {
        q: "What is the verb + noun grammar explainer?",
        a: "Vim is composable: an operator (verb) like d/c/y is combined with a motion (noun) like w/$/} or a text-object like iw/i(/it to form a complete command. The explainer lets you pick any operator × any motion/text-object and shows the composed command and its meaning — so 'delete inside parentheses' becomes di( and 'change a word' becomes caw.",
      },
      {
        q: "How does the reverse intent lookup work?",
        a: "Instead of searching by keystroke, you describe what you want: 'delete inside quotes', 'yank to end of line', 'save and quit'. The tool matches your phrase against command descriptions and shows the matching keystroke(s). For 'save and quit' it surfaces both :wq and ZZ (the two ways to write-and-quit).",
      },
      {
        q: "Can I generate a .vimrc snippet from this?",
        a: "Yes. The .vimrc generator emits a starter config from your chosen options: line numbers, syntax on/off, tab vs spaces, shiftwidth/tabstop, expandtab, smartindent, swapfile, backup, undofile, search highlighting, wildmenu, mouse, colorscheme, leader key, and a curated set of common remaps. Each line is annotated.",
      },
      {
        q: "What extra features does this tool have versus other Vim cheatsheets?",
        a: "(1) 100+ commands across 10 categories. (2) Fuzzy search by key OR intent. (3) Interactive keyboard map showing per-mode meaning of each key. (4) Verb+noun grammar explainer (operator × motion × text-object). (5) Reverse intent lookup. (6) .vimrc snippet generator with per-line comments. (7) Mode legend (Normal / Insert / Visual / Command). (8) Count-prefix notes (3dd, 5j). (9) Neovim-specific notes where relevant. (10) Copy command / copy .vimrc. (11) localStorage history (max 20). (12) Shareable deep-link to a command or search. 100% offline.",
      },
    ],
  },
  status: "done",
};
