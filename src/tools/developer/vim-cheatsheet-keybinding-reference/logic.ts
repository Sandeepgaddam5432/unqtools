/**
 * Vim Cheatsheet & Keybinding Reference — pure logic.
 *
 * Static dataset of 100+ Vim commands + a verb+noun grammar engine + a
 * .vimrc snippet generator + reverse intent search. 100% client-side —
 * no DOM, no network.
 *
 * Design principles:
 *  - Every command has key + description + modes + (optional) count note.
 *  - Operators × motions × text-objects compose to valid commands.
 *  - Intent lookup is fuzzy substring match across descriptions.
 *  - .vimrc lines are annotated with what each setting does.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type VimCategory =
  | "movement"
  | "editing"
  | "insert"
  | "visual"
  | "search"
  | "registers"
  | "marks"
  | "folding"
  | "windows"
  | "exiting";

export type VimMode = "normal" | "insert" | "visual" | "command" | "select";

export interface VimCommand {
  keys: string;
  description: string;
  category: VimCategory;
  modes: VimMode[];
  count?: string;
  example?: string;
  neovim?: boolean;
}

export interface VimOption {
  label: string;
  key: string;
  description: string;
  value: string;
}

export type Operator = "d" | "c" | "y" | ">" | "<" | "=" | "gu" | "gU" | "~" | "gq";
export type Motion =
  | "w" | "b" | "e" | "ge" | "W" | "B" | "E" | "gE"
  | "$" | "0" | "^" | "g_" | "G" | "gg"
  | "}" | "{" | ")" | "(" | "]]" | "[["
  | "f<x>" | "F<x>" | "t<x>" | "T<x>" | ";" | ","
  | "h" | "j" | "k" | "l" | "%" | "H" | "M" | "L";

export type TextObject =
  | "iw" | "aw" | "iW" | "aW"
  | "is" | "as" | "ip" | "ap"
  | "i(" | "a(" | "i)" | "a)" | "ib" | "ab"
  | "i{" | "a{" | "iB" | "aB"
  | "i[" | "a[" | "i]" | "a]"
  | "i<" | "a<" | "i>" | "a>"
  | "it" | "at"
  | 'i"' | 'a"' | "i'" | "a'" | "i`" | "a`"
  | "ie" | "ae";

export interface ComposedCommand {
  command: string;
  operator: Operator;
  operand: string;
  description: string;
  countExample: string;
}

export interface SearchFilters {
  query?: string;
  category?: VimCategory | "";
  modes?: VimMode[];
}

export interface IntentMatch {
  command: VimCommand;
  score: number;
  matchedOn: string;
}

export interface VimrcConfig {
  lineNumber: boolean;
  relativeNumber: boolean;
  syntax: boolean;
  expandtab: boolean;
  shiftwidth: number;
  tabstop: number;
  softtabstop: number;
  smartindent: boolean;
  autoindent: boolean;
  wrap: boolean;
  swapfile: boolean;
  backup: boolean;
  undofile: boolean;
  hlsearch: boolean;
  incsearch: boolean;
  ignorecase: boolean;
  smartcase: boolean;
  wildmenu: boolean;
  mouse: "a" | "n" | "v" | "i" | "c" | "";
  colorscheme: string;
  leader: string;
  showMatch: boolean;
  cursorLine: boolean;
  remapEscape: boolean;
  splitRight: boolean;
  splitBelow: boolean;
}

export interface VimrcLine {
  code: string;
  comment: string;
}

export interface VimrcResult {
  text: string;
  lines: VimrcLine[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Constants — labels
// ---------------------------------------------------------------------------

export const CATEGORY_LABELS: Record<VimCategory, string> = {
  movement: "Movement",
  editing: "Editing",
  insert: "Insert Mode",
  visual: "Visual Mode",
  search: "Search & Replace",
  registers: "Registers & Macros",
  marks: "Marks",
  folding: "Folding",
  windows: "Windows & Tabs",
  exiting: "Saving & Exiting",
};

export const MODE_LABELS: Record<VimMode, string> = {
  normal: "Normal",
  insert: "Insert",
  visual: "Visual",
  command: "Command-line",
  select: "Select",
};

export const CATEGORY_ORDER: VimCategory[] = [
  "movement", "editing", "insert", "visual", "search",
  "registers", "marks", "folding", "windows", "exiting",
];

// ---------------------------------------------------------------------------
// Static dataset — 100+ Vim commands
// ---------------------------------------------------------------------------

export const VIM_COMMANDS: ReadonlyArray<VimCommand> = [
  // ---- Movement (20+) ----
  { keys: "h", description: "Move left", category: "movement", modes: ["normal", "visual"], count: "3h = left 3" },
  { keys: "j", description: "Move down", category: "movement", modes: ["normal", "visual"], count: "5j = down 5" },
  { keys: "k", description: "Move up", category: "movement", modes: ["normal", "visual"] },
  { keys: "l", description: "Move right", category: "movement", modes: ["normal", "visual"] },
  { keys: "w", description: "Next word start", category: "movement", modes: ["normal", "visual"], count: "3w = next 3 words" },
  { keys: "b", description: "Previous word start", category: "movement", modes: ["normal", "visual"] },
  { keys: "e", description: "End of next word", category: "movement", modes: ["normal", "visual"] },
  { keys: "ge", description: "End of previous word", category: "movement", modes: ["normal"] },
  { keys: "W", description: "Next WORD (whitespace-delimited) start", category: "movement", modes: ["normal", "visual"] },
  { keys: "B", description: "Previous WORD start", category: "movement", modes: ["normal", "visual"] },
  { keys: "E", description: "End of next WORD", category: "movement", modes: ["normal", "visual"] },
  { keys: "0", description: "Start of line", category: "movement", modes: ["normal", "visual"] },
  { keys: "^", description: "First non-blank char of line", category: "movement", modes: ["normal", "visual"] },
  { keys: "$", description: "End of line", category: "movement", modes: ["normal", "visual"] },
  { keys: "g_", description: "Last non-blank char of line", category: "movement", modes: ["normal", "visual"] },
  { keys: "gg", description: "First line of buffer", category: "movement", modes: ["normal", "visual"], count: "5gg = line 5" },
  { keys: "G", description: "Last line of buffer", category: "movement", modes: ["normal", "visual"], count: "20G = line 20" },
  { keys: "{", description: "Previous paragraph", category: "movement", modes: ["normal", "visual"] },
  { keys: "}", description: "Next paragraph", category: "movement", modes: ["normal", "visual"] },
  { keys: "%", description: "Jump to matching bracket", category: "movement", modes: ["normal", "visual"] },
  { keys: "H", description: "Top of viewport", category: "movement", modes: ["normal", "visual"] },
  { keys: "M", description: "Middle of viewport", category: "movement", modes: ["normal", "visual"] },
  { keys: "L", description: "Bottom of viewport", category: "movement", modes: ["normal", "visual"] },
  { keys: "f<x>", description: "Next <x> on the line", category: "movement", modes: ["normal", "visual"], example: "fa → next 'a'", count: "2fa = 2nd 'a'" },
  { keys: "F<x>", description: "Previous <x> on the line", category: "movement", modes: ["normal", "visual"] },
  { keys: "t<x>", description: "Up to next <x> (exclusive)", category: "movement", modes: ["normal", "visual"] },
  { keys: "T<x>", description: "Back up to previous <x> (exclusive)", category: "movement", modes: ["normal", "visual"] },
  { keys: ";", description: "Repeat last f/F/t/T", category: "movement", modes: ["normal", "visual"] },
  { keys: ",", description: "Repeat last f/F/t/T reversed", category: "movement", modes: ["normal", "visual"] },
  { keys: "Ctrl-d", description: "Half page down", category: "movement", modes: ["normal", "visual"] },
  { keys: "Ctrl-u", description: "Half page up", category: "movement", modes: ["normal", "visual"] },
  { keys: "Ctrl-f", description: "Full page down", category: "movement", modes: ["normal", "visual"] },
  { keys: "Ctrl-b", description: "Full page up", category: "movement", modes: ["normal", "visual"] },
  { keys: "Ctrl-o", description: "Jump back (older position in jumplist)", category: "movement", modes: ["normal"] },
  { keys: "Ctrl-i", description: "Jump forward (newer position in jumplist)", category: "movement", modes: ["normal"] },

  // ---- Editing (20+) ----
  { keys: "x", description: "Delete char under cursor", category: "editing", modes: ["normal", "visual"], count: "3x = delete 3 chars" },
  { keys: "X", description: "Delete char before cursor", category: "editing", modes: ["normal"] },
  { keys: "dd", description: "Delete (cut) current line", category: "editing", modes: ["normal"], count: "3dd = delete 3 lines" },
  { keys: "D", description: "Delete to end of line", category: "editing", modes: ["normal", "visual"] },
  { keys: "dw", description: "Delete to next word start", category: "editing", modes: ["normal"] },
  { keys: "de", description: "Delete to end of word", category: "editing", modes: ["normal"] },
  { keys: "d$", description: "Delete to end of line", category: "editing", modes: ["normal"] },
  { keys: "dG", description: "Delete to end of buffer", category: "editing", modes: ["normal"] },
  { keys: "dgg", description: "Delete to start of buffer", category: "editing", modes: ["normal"] },
  { keys: "cc", description: "Change (cut+insert) entire line", category: "editing", modes: ["normal"] },
  { keys: "C", description: "Change to end of line", category: "editing", modes: ["normal", "visual"] },
  { keys: "cw", description: "Change to end of word", category: "editing", modes: ["normal"] },
  { keys: "c$", description: "Change to end of line", category: "editing", modes: ["normal"] },
  { keys: "ci(", description: "Change inside parentheses", category: "editing", modes: ["normal"], example: "ci( inside foo(bar)" },
  { keys: 'ci"', description: "Change inside double quotes", category: "editing", modes: ["normal"] },
  { keys: "ci'", description: "Change inside single quotes", category: "editing", modes: ["normal"] },
  { keys: "ci{", description: "Change inside braces", category: "editing", modes: ["normal"] },
  { keys: "cit", description: "Change inside HTML/XML tag", category: "editing", modes: ["normal"] },
  { keys: "ciw", description: "Change inside word", category: "editing", modes: ["normal"] },
  { keys: "caw", description: "Change a word (with trailing space)", category: "editing", modes: ["normal"] },
  { keys: "di(", description: "Delete inside parentheses", category: "editing", modes: ["normal"] },
  { keys: 'di"', description: "Delete inside double quotes", category: "editing", modes: ["normal"] },
  { keys: "diw", description: "Delete inside word", category: "editing", modes: ["normal"] },
  { keys: "daw", description: "Delete a word (with trailing space)", category: "editing", modes: ["normal"] },
  { keys: "yi{", description: "Yank (copy) inside braces", category: "editing", modes: ["normal"] },
  { keys: "yi\"", description: "Yank inside double quotes", category: "editing", modes: ["normal"] },
  { keys: "p", description: "Paste after cursor / below line", category: "editing", modes: ["normal", "visual"], count: "3p = paste 3×" },
  { keys: "P", description: "Paste before cursor / above line", category: "editing", modes: ["normal"] },
  { keys: "gp", description: "Paste and leave cursor after pasted text", category: "editing", modes: ["normal"] },
  { keys: "J", description: "Join current line with next", category: "editing", modes: ["normal"] },
  { keys: "gJ", description: "Join without inserting a space", category: "editing", modes: ["normal"] },
  { keys: "u", description: "Undo", category: "editing", modes: ["normal"], count: "3u = undo 3 times" },
  { keys: "Ctrl-r", description: "Redo", category: "editing", modes: ["normal"] },
  { keys: ".", description: "Repeat last change", category: "editing", modes: ["normal"] },
  { keys: "r<x>", description: "Replace char under cursor with <x>", category: "editing", modes: ["normal"], example: "ra → replace with 'a'" },
  { keys: "R", description: "Enter Replace mode", category: "editing", modes: ["normal"] },
  { keys: "~", description: "Toggle case of char under cursor", category: "editing", modes: ["normal", "visual"] },
  { keys: "gU", description: "Uppercase motion (e.g. gUiw)", category: "editing", modes: ["normal", "visual"] },
  { keys: "gu", description: "Lowercase motion (e.g. guiw)", category: "editing", modes: ["normal", "visual"] },
  { keys: "g~~", description: "Toggle case of current line", category: "editing", modes: ["normal"] },
  { keys: ">", description: "Indent (motion or visual selection)", category: "editing", modes: ["normal", "visual"], example: ">>" },
  { keys: "<", description: "Outdent (motion or visual selection)", category: "editing", modes: ["normal", "visual"] },
  { keys: "=", description: "Auto-indent (motion or visual selection)", category: "editing", modes: ["normal", "visual"], example: "== realigns line" },

  // ---- Insert Mode (10+) ----
  { keys: "i", description: "Insert before cursor", category: "insert", modes: ["normal"] },
  { keys: "I", description: "Insert at first non-blank of line", category: "insert", modes: ["normal"] },
  { keys: "a", description: "Insert after cursor", category: "insert", modes: ["normal"] },
  { keys: "A", description: "Insert at end of line", category: "insert", modes: ["normal"] },
  { keys: "o", description: "Open new line below and insert", category: "insert", modes: ["normal"] },
  { keys: "O", description: "Open new line above and insert", category: "insert", modes: ["normal"] },
  { keys: "s", description: "Substitute: delete char and insert", category: "insert", modes: ["normal"] },
  { keys: "S", description: "Substitute line: delete line and insert", category: "insert", modes: ["normal"] },
  { keys: "Esc", description: "Leave Insert mode", category: "insert", modes: ["insert"] },
  { keys: "Ctrl-c", description: "Leave Insert mode (no InsertLeave check)", category: "insert", modes: ["insert"] },
  { keys: "Ctrl-[", description: "Leave Insert mode (same as Esc)", category: "insert", modes: ["insert"] },
  { keys: "Ctrl-o", description: "Run one Normal command then return to Insert", category: "insert", modes: ["insert"] },
  { keys: "Ctrl-r", description: "Insert register contents (e.g. Ctrl-r \")", category: "insert", modes: ["insert"] },
  { keys: "Ctrl-n", description: "Autocomplete — next match", category: "insert", modes: ["insert"], neovim: true },
  { keys: "Ctrl-p", description: "Autocomplete — previous match", category: "insert", modes: ["insert"], neovim: true },

  // ---- Visual Mode (8) ----
  { keys: "v", description: "Enter charwise Visual mode", category: "visual", modes: ["normal"] },
  { keys: "V", description: "Enter linewise Visual mode", category: "visual", modes: ["normal"] },
  { keys: "Ctrl-v", description: "Enter blockwise Visual mode (column)", category: "visual", modes: ["normal"] },
  { keys: "gv", description: "Re-select last visual selection", category: "visual", modes: ["normal"] },
  { keys: "o", description: "Move cursor to other end of selection", category: "visual", modes: ["visual"] },
  { keys: "I", description: "Insert at start of every line in block (blockwise)", category: "visual", modes: ["visual"] },
  { keys: "A", description: "Append at end of every line in block (blockwise)", category: "visual", modes: ["visual"] },
  { keys: "c", description: "Change selection (enters Insert)", category: "visual", modes: ["visual"] },
  { keys: "d", description: "Delete selection", category: "visual", modes: ["visual"] },
  { keys: "x", description: "Delete (cut) selection", category: "visual", modes: ["visual"] },
  { keys: "y", description: "Yank (copy) selection", category: "visual", modes: ["visual"] },

  // ---- Search & Replace (10) ----
  { keys: "/<x>", description: "Search forward for <x>", category: "search", modes: ["normal", "visual"], example: "/foo → next 'foo'" },
  { keys: "?<x>", description: "Search backward for <x>", category: "search", modes: ["normal"] },
  { keys: "n", description: "Next search match", category: "search", modes: ["normal"] },
  { keys: "N", description: "Previous search match", category: "search", modes: ["normal"] },
  { keys: "*", description: "Search forward for word under cursor", category: "search", modes: ["normal"] },
  { keys: "#", description: "Search backward for word under cursor", category: "search", modes: ["normal"] },
  { keys: "g*", description: "Search forward for partial word under cursor", category: "search", modes: ["normal"] },
  { keys: ":s/old/new/", description: "Substitute first occurrence on current line", category: "search", modes: ["command"] },
  { keys: ":s/old/new/g", description: "Substitute all on current line", category: "search", modes: ["command"] },
  { keys: ":%s/old/new/g", description: "Substitute all in buffer", category: "search", modes: ["command"] },
  { keys: ":%s/old/new/gc", description: "Substitute all with confirmation", category: "search", modes: ["command"] },
  { keys: ":noh", description: "Clear search highlighting", category: "search", modes: ["command"] },

  // ---- Registers & Macros (8) ----
  { keys: '"<reg>y', description: "Yank into register <reg> (e.g. \"ay)", category: "registers", modes: ["normal", "visual"] },
  { keys: '"<reg>p', description: "Paste from register <reg> (e.g. \"ap)", category: "registers", modes: ["normal"] },
  { keys: '"+y', description: "Yank into system clipboard (+ register)", category: "registers", modes: ["normal", "visual"], neovim: true },
  { keys: '"+p', description: "Paste from system clipboard", category: "registers", modes: ["normal"] },
  { keys: '""', description: "Unnamed register (last yank/delete)", category: "registers", modes: ["normal"] },
  { keys: '"0', description: "Yank register (last yank, not delete)", category: "registers", modes: ["normal"] },
  { keys: '"_', description: "Black hole register (discard)", category: "registers", modes: ["normal"] },
  { keys: ":reg", description: "List all registers", category: "registers", modes: ["command"] },
  { keys: "q<reg>", description: "Record macro into register <reg> (e.g. qa)", category: "registers", modes: ["normal"] },
  { keys: "q", description: "Stop recording macro", category: "registers", modes: ["normal"] },
  { keys: "@<reg>", description: "Run macro in <reg> (e.g. @a)", category: "registers", modes: ["normal"], count: "5@a = run 5×" },
  { keys: "@@", description: "Repeat last macro", category: "registers", modes: ["normal"] },

  // ---- Marks (8) ----
  { keys: "m<x>", description: "Set mark <x> at cursor (e.g. ma)", category: "marks", modes: ["normal"] },
  { keys: "`<x>", description: "Jump to mark <x> (exact column)", category: "marks", modes: ["normal"] },
  { keys: "'<x>", description: "Jump to mark <x> (start of line)", category: "marks", modes: ["normal"] },
  { keys: "``", description: "Toggle to last position", category: "marks", modes: ["normal"] },
  { keys: "''", description: "Toggle to last position (line start)", category: "marks", modes: ["normal"] },
  { keys: "m<capital>", description: "Set global (file-spanning) mark (e.g. mA)", category: "marks", modes: ["normal"] },
  { keys: ":marks", description: "List all marks", category: "marks", modes: ["command"] },
  { keys: ":delm <x>", description: "Delete mark <x>", category: "marks", modes: ["command"] },

  // ---- Folding (8) ----
  { keys: "zf{motion}", description: "Create fold (manual folding)", category: "folding", modes: ["normal"], example: "zfap → fold paragraph" },
  { keys: "zo", description: "Open fold under cursor", category: "folding", modes: ["normal"] },
  { keys: "zc", description: "Close fold under cursor", category: "folding", modes: ["normal"] },
  { keys: "za", description: "Toggle fold", category: "folding", modes: ["normal"] },
  { keys: "zR", description: "Open all folds", category: "folding", modes: ["normal"] },
  { keys: "zM", description: "Close all folds", category: "folding", modes: ["normal"] },
  { keys: "zj", description: "Move to next fold start", category: "folding", modes: ["normal"] },
  { keys: "zk", description: "Move to previous fold start", category: "folding", modes: ["normal"] },
  { keys: "[z", description: "Move to start of current open fold", category: "folding", modes: ["normal"] },
  { keys: "]z", description: "Move to end of current open fold", category: "folding", modes: ["normal"] },

  // ---- Windows & Tabs (10+) ----
  { keys: ":split", description: "Split window horizontally (top/bottom)", category: "windows", modes: ["command"] },
  { keys: ":vsplit", description: "Split window vertically (left/right)", category: "windows", modes: ["command"] },
  { keys: "Ctrl-w h", description: "Move to window on the left", category: "windows", modes: ["normal"] },
  { keys: "Ctrl-w j", description: "Move to window below", category: "windows", modes: ["normal"] },
  { keys: "Ctrl-w k", description: "Move to window above", category: "windows", modes: ["normal"] },
  { keys: "Ctrl-w l", description: "Move to window on the right", category: "windows", modes: ["normal"] },
  { keys: "Ctrl-w w", description: "Cycle to next window", category: "windows", modes: ["normal"] },
  { keys: "Ctrl-w =", description: "Make all windows equal size", category: "windows", modes: ["normal"] },
  { keys: "Ctrl-w _", description: "Maximize current window height", category: "windows", modes: ["normal"] },
  { keys: "Ctrl-w |", description: "Maximize current window width", category: "windows", modes: ["normal"] },
  { keys: "Ctrl-w c", description: "Close current window", category: "windows", modes: ["normal"] },
  { keys: "Ctrl-w o", description: "Close all other windows", category: "windows", modes: ["normal"] },
  { keys: ":tabnew", description: "Open a new tab", category: "windows", modes: ["command"] },
  { keys: "gt", description: "Next tab", category: "windows", modes: ["normal"], count: "3gt = tab 3" },
  { keys: "gT", description: "Previous tab", category: "windows", modes: ["normal"] },
  { keys: ":tabclose", description: "Close current tab", category: "windows", modes: ["command"] },

  // ---- Saving & Exiting (8) ----
  { keys: ":w", description: "Write (save) file", category: "exiting", modes: ["command"] },
  { keys: ":wq", description: "Write and quit", category: "exiting", modes: ["command"] },
  { keys: ":x", description: "Write (if changed) and quit", category: "exiting", modes: ["command"] },
  { keys: "ZZ", description: "Write (if changed) and quit (Normal-mode shortcut)", category: "exiting", modes: ["normal"] },
  { keys: ":q", description: "Quit (fails if unsaved changes)", category: "exiting", modes: ["command"] },
  { keys: ":q!", description: "Force quit (discard changes)", category: "exiting", modes: ["command"] },
  { keys: "ZQ", description: "Force quit (Normal-mode shortcut)", category: "exiting", modes: ["normal"] },
  { keys: ":wqa", description: "Write all and quit all", category: "exiting", modes: ["command"] },
  { keys: ":qa!", description: "Force quit all", category: "exiting", modes: ["command"] },
  { keys: ":e <file>", description: "Open <file> for editing", category: "exiting", modes: ["command"] },
  { keys: ":saveas <file>", description: "Save as new file and switch to it", category: "exiting", modes: ["command"] },
];

// ---------------------------------------------------------------------------
// Operators, motions, text-objects (for grammar explainer)
// ---------------------------------------------------------------------------

export const OPERATORS: ReadonlyArray<{ value: Operator; label: string; description: string }> = [
  { value: "d", label: "d", description: "Delete (cut to register)" },
  { value: "c", label: "c", description: "Change (delete + insert)" },
  { value: "y", label: "y", description: "Yank (copy)" },
  { value: ">", label: ">", description: "Indent right" },
  { value: "<", label: "<", description: "Outdent left" },
  { value: "=", label: "=", description: "Auto-indent" },
  { value: "gu", label: "gu", description: "Lowercase" },
  { value: "gU", label: "gU", description: "Uppercase" },
  { value: "~", label: "~", description: "Toggle case" },
  { value: "gq", label: "gq", description: "Hard-wrap (reformat)" },
];

export const MOTIONS: ReadonlyArray<{ value: Motion; label: string; description: string }> = [
  { value: "w", label: "w", description: "next word start" },
  { value: "b", label: "b", description: "previous word start" },
  { value: "e", label: "e", description: "end of word" },
  { value: "W", label: "W", description: "next WORD start" },
  { value: "B", label: "B", description: "previous WORD start" },
  { value: "E", label: "E", description: "end of WORD" },
  { value: "$", label: "$", description: "end of line" },
  { value: "0", label: "0", description: "start of line" },
  { value: "^", label: "^", description: "first non-blank" },
  { value: "G", label: "G", description: "end of buffer" },
  { value: "gg", label: "gg", description: "start of buffer" },
  { value: "}", label: "}", description: "next paragraph" },
  { value: "{", label: "{", description: "previous paragraph" },
  { value: ")", label: ")", description: "next sentence" },
  { value: "(", label: "(", description: "previous sentence" },
  { value: "%", label: "%", description: "matching bracket" },
  { value: "h", label: "h", description: "char left" },
  { value: "j", label: "j", description: "line down" },
  { value: "k", label: "k", description: "line up" },
  { value: "l", label: "l", description: "char right" },
  { value: "f<x>", label: "f<x>", description: "to next <x>" },
  { value: "F<x>", label: "F<x>", description: "to previous <x>" },
  { value: "t<x>", label: "t<x>", description: "up to next <x>" },
  { value: "H", label: "H", description: "top of viewport" },
  { value: "M", label: "M", description: "middle of viewport" },
  { value: "L", label: "L", description: "bottom of viewport" },
];

export const TEXT_OBJECTS: ReadonlyArray<{ value: TextObject; label: string; description: string }> = [
  { value: "iw", label: "iw", description: "inside word" },
  { value: "aw", label: "aw", description: "a word (with space)" },
  { value: "iW", label: "iW", description: "inside WORD" },
  { value: "aW", label: "aW", description: "a WORD (with space)" },
  { value: "is", label: "is", description: "inside sentence" },
  { value: "as", label: "as", description: "a sentence" },
  { value: "ip", label: "ip", description: "inside paragraph" },
  { value: "ap", label: "ap", description: "a paragraph" },
  { value: "i(", label: "i(", description: "inside parens" },
  { value: "a(", label: "a(", description: "a paren pair (with parens)" },
  { value: "i{", label: "i{", description: "inside braces" },
  { value: "a{", label: "a{", description: "a brace pair (with braces)" },
  { value: "i[", label: "i[", description: "inside brackets" },
  { value: "a[", label: "a[", description: "a bracket pair" },
  { value: "i<", label: "i<", description: "inside angle brackets" },
  { value: "a<", label: "a<", description: "a pair of angle brackets" },
  { value: "it", label: "it", description: "inside HTML/XML tag" },
  { value: "at", label: "at", description: "a whole tag" },
  { value: 'i"', label: 'i"', description: "inside double quotes" },
  { value: 'a"', label: 'a"', description: "a double-quoted string" },
  { value: "i'", label: "i'", description: "inside single quotes" },
  { value: "a'", label: "a'", description: "a single-quoted string" },
  { value: "i`", label: "i`", description: "inside backticks" },
  { value: "a`", label: "a`", description: "a backtick string" },
  { value: "ie", label: "ie", description: "inside entire buffer (textobj-entire plugin)" },
  { value: "ae", label: "ae", description: "entire buffer (textobj-entire plugin)" },
];

// ---------------------------------------------------------------------------
// Search + filter
// ---------------------------------------------------------------------------

export function normalizeQuery(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function searchCommands(filters: SearchFilters): VimCommand[] {
  const q = normalizeQuery(filters.query ?? "");
  return VIM_COMMANDS.filter((c) => {
    if (filters.category && c.category !== filters.category) return false;
    if (filters.modes && filters.modes.length > 0 && !c.modes.some((m) => filters.modes!.includes(m))) return false;
    if (!q) return true;
    return (
      c.keys.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      (c.example?.toLowerCase().includes(q) ?? false) ||
      (c.count?.toLowerCase().includes(q) ?? false) ||
      c.modes.some((m) => m.toLowerCase().includes(q))
    );
  });
}

/** Reverse intent lookup: "delete inside quotes" → di" */
export function intentLookup(intent: string): IntentMatch[] {
  const q = normalizeQuery(intent);
  if (!q) return [];
  const tokens = q.split(" ").filter((t) => t.length > 1);
  const matches: IntentMatch[] = [];
  for (const c of VIM_COMMANDS) {
    const desc = c.description.toLowerCase();
    const keysLower = c.keys.toLowerCase();
    let score = 0;
    let matchedOn = "";
    if (desc.includes(q)) { score += 100; matchedOn = "description"; }
    if (keysLower.includes(q)) { score += 80; matchedOn = "keys"; }
    // Token-level matching for "delete inside quotes" → description tokens
    const descTokens = desc.split(/\W+/).filter(Boolean);
    let tokenHits = 0;
    for (const t of tokens) {
      if (descTokens.includes(t)) { tokenHits += 1; }
      else if (desc.includes(t)) { tokenHits += 0.5; }
    }
    if (tokenHits > 0) {
      score += tokenHits * 10;
      if (!matchedOn) matchedOn = "tokens";
    }
    // Special intent aliases (intent → key)
    if (q.includes("save") && q.includes("quit") && (c.keys === ":wq" || c.keys === "ZZ" || c.keys === ":x")) {
      score += 200;
      matchedOn = "intent";
    }
    if (q.includes("force quit") && (c.keys === ":q!" || c.keys === "ZQ")) {
      score += 200;
      matchedOn = "intent";
    }
    if (q.includes("delete") && q.includes("inside") && q.includes("quote") && c.keys === 'di"') {
      score += 200;
      matchedOn = "intent";
    }
    if (q.includes("delete") && q.includes("inside") && q.includes("paren") && c.keys === "di(") {
      score += 200;
      matchedOn = "intent";
    }
    if (q.includes("yank") && q.includes("end") && q.includes("line") && c.keys === "y$") {
      score += 200;
      matchedOn = "intent";
    }
    if (q.includes("change") && q.includes("word") && (c.keys === "cw" || c.keys === "ciw")) {
      score += 200;
      matchedOn = "intent";
    }
    if (q.includes("comment") && c.keys === "gc") {
      score += 50;
    }
    if (score > 0) matches.push({ command: c, score, matchedOn });
  }
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, 20);
}

// ---------------------------------------------------------------------------
// Grammar explainer — operator × (motion | text-object)
// ---------------------------------------------------------------------------

function describeOperand(operand: string): string {
  const m = MOTIONS.find((x) => x.value === (operand as Motion));
  if (m) return m.description;
  const t = TEXT_OBJECTS.find((x) => x.value === (operand as TextObject));
  if (t) return t.description;
  return operand;
}

export function composeCommand(operator: Operator, operand: string, count?: number): ComposedCommand {
  const op = OPERATORS.find((o) => o.value === operator);
  const opLabel = op?.label ?? operator;
  const operandDesc = describeOperand(operand);
  const c = count && count > 1 ? String(count) : "";
  const cmd = `${c}${opLabel}${operand}`;
  let description: string;
  if (operator === "d") description = `Delete ${operandDesc}`;
  else if (operator === "c") description = `Change ${operandDesc} (delete + insert)`;
  else if (operator === "y") description = `Yank (copy) ${operandDesc}`;
  else if (operator === ">") description = `Indent ${operandDesc} right`;
  else if (operator === "<") description = `Outdent ${operandDesc} left`;
  else if (operator === "=") description = `Auto-indent ${operandDesc}`;
  else if (operator === "gu") description = `Lowercase ${operandDesc}`;
  else if (operator === "gU") description = `Uppercase ${operandDesc}`;
  else if (operator === "~") description = `Toggle case of ${operandDesc}`;
  else if (operator === "gq") description = `Hard-wrap ${operandDesc}`;
  else description = `${opLabel} ${operandDesc}`;
  const countExample = count && count > 1
    ? `With count ${count}: ${cmd}`
    : `With count N: ${count || "N"}${opLabel}${operand} (e.g. 3${opLabel}${operand})`;
  return { command: cmd, operator, operand, description, countExample };
}

/** Build a list of all valid composed commands for browsing. */
export function composeAll(): ComposedCommand[] {
  const out: ComposedCommand[] = [];
  for (const op of OPERATORS) {
    for (const m of MOTIONS) {
      out.push(composeCommand(op.value, m.value));
    }
    for (const t of TEXT_OBJECTS) {
      out.push(composeCommand(op.value, t.value));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// .vimrc generator
// ---------------------------------------------------------------------------

export function makeDefaultVimrc(): VimrcConfig {
  return {
    lineNumber: true,
    relativeNumber: true,
    syntax: true,
    expandtab: true,
    shiftwidth: 2,
    tabstop: 2,
    softtabstop: 2,
    smartindent: true,
    autoindent: true,
    wrap: false,
    swapfile: false,
    backup: false,
    undofile: true,
    hlsearch: true,
    incsearch: true,
    ignorecase: true,
    smartcase: true,
    wildmenu: true,
    mouse: "a",
    colorscheme: "default",
    leader: ",",
    showMatch: true,
    cursorLine: true,
    remapEscape: false,
    splitRight: true,
    splitBelow: true,
  };
}

export const COLORSCHEME_OPTIONS: ReadonlyArray<string> = [
  "default", "blue", "darkblue", "delek", "desert", "elflord", "evening",
  "habamax", "industry", "koehler", "morning", "murphy", "pablo", "peachpuff",
  "ron", "shine", "slate", "torte", "zellner",
];

export const MOUSE_OPTIONS: ReadonlyArray<{ value: VimrcConfig["mouse"]; label: string }> = [
  { value: "", label: "Off" },
  { value: "a", label: "All modes (a)" },
  { value: "n", label: "Normal only (n)" },
  { value: "v", label: "Visual only (v)" },
  { value: "i", label: "Insert only (i)" },
  { value: "c", label: "Command-line only (c)" },
];

export function buildVimrc(cfg: VimrcConfig): VimrcResult {
  const lines: VimrcLine[] = [];
  const warnings: string[] = [];

  lines.push({ code: `" .vimrc — generated by UnQTools (vim-cheatsheet-keybinding-reference)`, comment: "Use \" (double-quote) for comments in vimrc." });

  // Display
  if (cfg.lineNumber) lines.push({ code: `set number`, comment: "Show absolute line numbers." });
  if (cfg.relativeNumber) lines.push({ code: `set relativenumber`, comment: "Show relative line numbers (great for 5j, 3k)." });
  if (cfg.cursorLine) lines.push({ code: `set cursorline`, comment: "Highlight the line under the cursor." });
  if (cfg.syntax) lines.push({ code: `syntax on`, comment: "Enable syntax highlighting." });

  // Indentation
  if (cfg.smartindent) lines.push({ code: `set smartindent`, comment: "Smart auto-indenting for C-like languages." });
  if (cfg.autoindent) lines.push({ code: `set autoindent`, comment: "Carry indent from current line to the next." });
  if (cfg.expandtab) {
    lines.push({ code: `set expandtab`, comment: "Use spaces instead of a tab character when <Tab> is pressed." });
  } else {
    warnings.push("expandtab is off — tabs will be literal tab characters. Most projects prefer spaces.");
  }
  lines.push({ code: `set shiftwidth=${cfg.shiftwidth}`, comment: `How many columns to indent with >> and <<.` });
  lines.push({ code: `set tabstop=${cfg.tabstop}`, comment: `How many columns a literal <Tab> displays as.` });
  if (cfg.softtabstop !== cfg.tabstop) {
    lines.push({ code: `set softtabstop=${cfg.softtabstop}`, comment: `Columns to move for <Tab> in insert mode (with expandtab, equals softtabstop spaces).` });
  }
  if (cfg.shiftwidth !== cfg.tabstop) {
    warnings.push(`shiftwidth=${cfg.shiftwidth} differs from tabstop=${cfg.tabstop}. Mixing them is fine but can cause inconsistent indent display.`);
  }

  // Wrapping
  if (!cfg.wrap) lines.push({ code: `set nowrap`, comment: "Long lines are not wrapped — they extend past the right edge." });
  else lines.push({ code: `set wrap`, comment: "Long lines wrap visually at the right edge." });

  // Files
  if (!cfg.swapfile) lines.push({ code: `set noswapfile`, comment: "No .swp swap files (you lose crash recovery)." });
  if (!cfg.backup) lines.push({ code: `set nobackup`, comment: "No ~ backup files." });
  if (cfg.undofile) {
    lines.push({ code: `set undofile`, comment: "Persist undo history across sessions (in ~/.vim/undodir)." });
    lines.push({ code: `if !isdirectory($HOME . "/.vim/undodir")`, comment: "Make sure the undo dir exists." });
    lines.push({ code: `  call mkdir($HOME . "/.vim/undodir", "p", 0700)`, comment: "Create with safe permissions." });
    lines.push({ code: `endif`, comment: "" });
    lines.push({ code: `set undodir=~/.vim/undodir`, comment: "Where to store undo files." });
  }

  // Search
  if (cfg.hlsearch) lines.push({ code: `set hlsearch`, comment: "Highlight all matches of the last search." });
  if (cfg.incsearch) lines.push({ code: `set incsearch`, comment: "Show match incrementally as you type the search pattern." });
  if (cfg.ignorecase) lines.push({ code: `set ignorecase`, comment: "Case-insensitive search." });
  if (cfg.smartcase) {
    lines.push({ code: `set smartcase`, comment: "If the pattern has an uppercase letter, search becomes case-sensitive." });
    if (!cfg.ignorecase) warnings.push("smartcase only takes effect when ignorecase is on. We've enabled both for you.");
  }
  if (cfg.showMatch) lines.push({ code: `set showmatch`, comment: "Briefly jump to matching bracket when one is typed." });

  // UI
  if (cfg.wildmenu) lines.push({ code: `set wildmenu`, comment: "Better command-line completion (tab shows a menu)." });
  if (cfg.mouse) lines.push({ code: `set mouse=${cfg.mouse}`, comment: `Mouse support in ${cfg.mouse === "a" ? "all" : "selected"} mode(s).` });

  // Splits
  if (cfg.splitRight) lines.push({ code: `set splitright`, comment: "New vertical splits appear on the right." });
  if (cfg.splitBelow) lines.push({ code: `set splitbelow`, comment: "New horizontal splits appear below." });

  // Colorscheme
  if (cfg.colorscheme && cfg.colorscheme !== "default") {
    lines.push({ code: `colorscheme ${cfg.colorscheme}`, comment: `Color scheme: ${cfg.colorscheme}. Must be installed (built-in or via plugin).` });
  }

  // Leader
  if (cfg.leader) {
    lines.push({ code: `let mapleader = "${cfg.leader}"`, comment: `Leader key: ${cfg.leader === " " ? "<Space>" : cfg.leader}. Used for custom mappings (e.g. <leader>w).` });
  }

  // Remap escape
  if (cfg.remapEscape) {
    lines.push({ code: `inoremap jk <Esc>`, comment: "Press jk in Insert mode to exit (faster than reaching for Esc)." });
    lines.push({ code: `inoremap kj <Esc>`, comment: "Alternative jk combo (in case you type kj first)." });
  }

  // Common mappings
  lines.push({ code: `nnoremap <leader>w :w<CR>`, comment: "Leader + w → save." });
  lines.push({ code: `nnoremap <leader>q :q<CR>`, comment: "Leader + q → quit." });
  lines.push({ code: `nnoremap <leader>e :e<CR>`, comment: "Leader + e → re-edit file (reload)." });

  // Footer
  lines.push({ code: `" End of .vimrc`, comment: "Source with :so ~/.vimrc or restart vim." });

  const text = lines
    .map((l) => l.comment ? `${l.code}  " ${l.comment}` : l.code)
    .join("\n");

  return { text, lines, warnings };
}

// ---------------------------------------------------------------------------
// Interactive keyboard map
// ---------------------------------------------------------------------------

export interface KeyMapEntry {
  key: string;
  normal?: string;
  insert?: string;
  visual?: string;
  command?: string;
}

/** A subset of the QWERTY layout mapped to per-mode Vim meanings. */
export const KEYBOARD_MAP: ReadonlyArray<KeyMapEntry> = [
  { key: "h", normal: "left", visual: "left (extend selection)" },
  { key: "j", normal: "down", visual: "down (extend)" },
  { key: "k", normal: "up", visual: "up (extend)" },
  { key: "l", normal: "right", visual: "right (extend)" },
  { key: "w", normal: "next word", visual: "next word (extend)", command: "write (:w)" },
  { key: "b", normal: "prev word", visual: "prev word (extend)" },
  { key: "e", normal: "end of word", visual: "to end of word (extend)" },
  { key: "0", normal: "start of line", visual: "to start of line" },
  { key: "$", normal: "end of line", visual: "to end of line" },
  { key: "^", normal: "first non-blank", visual: "to first non-blank" },
  { key: "g", normal: "prefix (gg/G/ge/g~)", visual: "prefix" },
  { key: "G", normal: "last line", visual: "to last line" },
  { key: "d", normal: "delete operator (dw, dd)", visual: "delete selection" },
  { key: "c", normal: "change operator (cw, cc)", visual: "change selection" },
  { key: "y", normal: "yank operator (yw, yy)", visual: "yank selection" },
  { key: "p", normal: "paste after", visual: "paste over selection" },
  { key: "P", normal: "paste before" },
  { key: "x", normal: "delete char", visual: "delete selection" },
  { key: "u", normal: "undo", visual: "lowercase selection" },
  { key: "U", normal: "undo all line changes", visual: "uppercase selection" },
  { key: "r", normal: "replace char" },
  { key: "i", normal: "insert before", visual: "insert at start of block" },
  { key: "I", normal: "insert at first non-blank", visual: "insert at start of every line in block" },
  { key: "a", normal: "insert after", visual: "append at end of block" },
  { key: "A", normal: "insert at end of line", visual: "append at end of every line in block" },
  { key: "o", normal: "open line below + insert", visual: "move cursor to other end of selection" },
  { key: "O", normal: "open line above + insert" },
  { key: "v", normal: "enter charwise visual" },
  { key: "V", normal: "enter linewise visual" },
  { key: "R", normal: "replace mode" },
  { key: ".", normal: "repeat last change" },
  { key: "~", normal: "toggle case", visual: "toggle case" },
  { key: "%", normal: "match bracket", visual: "to matching bracket" },
  { key: "*", normal: "search word under cursor" },
  { key: "#", normal: "search word backward" },
  { key: "n", normal: "next match" },
  { key: "N", normal: "prev match" },
  { key: ":", normal: "enter command-line" },
  { key: "/", normal: "search forward", visual: "search forward" },
  { key: "?", normal: "search backward" },
  { key: "m", normal: "set mark (ma, mb…)" },
  { key: "@", normal: "run macro (@a)" },
  { key: "q", normal: "record macro (qa…q)" },
  { key: "z", normal: "folding prefix (zo, zc, za)" },
];

export function lookupKey(key: string): KeyMapEntry | undefined {
  const k = key.toLowerCase();
  return KEYBOARD_MAP.find((e) => e.key.toLowerCase() === k);
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

export function renderCheatsheetMarkdown(commands: VimCommand[]): string {
  const out: string[] = ["# Vim Cheatsheet", ""];
  for (const cat of CATEGORY_ORDER) {
    const items = commands.filter((c) => c.category === cat);
    if (items.length === 0) continue;
    out.push(`## ${CATEGORY_LABELS[cat]}`);
    out.push("");
    out.push("| Keys | Description | Modes | Count |");
    out.push("| --- | --- | --- | --- |");
    for (const c of items) {
      const modes = c.modes.map((m) => MODE_LABELS[m]).join(", ");
      out.push(`| \`${c.keys}\` | ${c.description} | ${modes} | ${c.count ?? ""} |`);
    }
    out.push("");
  }
  return out.join("\n");
}

export function renderCheatsheetText(commands: VimCommand[]): string {
  const out: string[] = ["Vim Cheatsheet", "=============", ""];
  for (const cat of CATEGORY_ORDER) {
    const items = commands.filter((c) => c.category === cat);
    if (items.length === 0) continue;
    out.push(`[${CATEGORY_LABELS[cat]}]`);
    for (const c of items) {
      const modes = c.modes.map((m) => MODE_LABELS[m]).join("/");
      out.push(`  ${c.keys.padEnd(16)} ${c.description}  [${modes}]`);
    }
    out.push("");
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface VimStats {
  total: number;
  byCategory: Record<VimCategory, number>;
  byMode: Record<VimMode, number>;
}

export function computeStats(commands: VimCommand[] = VIM_COMMANDS as VimCommand[]): VimStats {
  const byCategory: Record<VimCategory, number> = {
    movement: 0, editing: 0, insert: 0, visual: 0, search: 0,
    registers: 0, marks: 0, folding: 0, windows: 0, exiting: 0,
  };
  const byMode: Record<VimMode, number> = {
    normal: 0, insert: 0, visual: 0, command: 0, select: 0,
  };
  for (const c of commands) {
    byCategory[c.category] += 1;
    for (const m of c.modes) byMode[m] += 1;
  }
  return { total: commands.length, byCategory, byMode };
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:vim-cheatsheet:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  action: "search" | "intent" | "compose" | "vimrc";
  detail: string;
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

export function buildShareUrl(opts: { search?: string; category?: VimCategory | ""; intent?: string }): string {
  const params = new URLSearchParams();
  if (opts.search) params.set("q", opts.search);
  if (opts.category) params.set("cat", opts.category);
  if (opts.intent) params.set("intent", opts.intent);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { search: string; category: VimCategory | ""; intent: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { search: "", category: "", intent: "" };
  const params = new URLSearchParams(clean);
  const search = params.get("q") ?? "";
  const intent = params.get("intent") ?? "";
  const cat = params.get("cat") as VimCategory | null;
  const validCats = Object.keys(CATEGORY_LABELS) as VimCategory[];
  const category = cat && validCats.includes(cat) ? cat : "";
  return { search, category, intent };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateVimrc(cfg: VimrcConfig): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (cfg.shiftwidth < 1 || cfg.shiftwidth > 16) errors.push("shiftwidth must be between 1 and 16");
  if (cfg.tabstop < 1 || cfg.tabstop > 16) errors.push("tabstop must be between 1 and 16");
  if (cfg.softtabstop < 0 || cfg.softtabstop > 16) errors.push("softtabstop must be between 0 and 16");
  if (!COLORSCHEME_OPTIONS.includes(cfg.colorscheme)) errors.push(`unknown colorscheme: ${cfg.colorscheme}`);
  if (!MOUSE_OPTIONS.some((m) => m.value === cfg.mouse)) errors.push(`invalid mouse mode: ${cfg.mouse}`);
  if (!cfg.leader || cfg.leader.length !== 1) errors.push("leader must be a single character");
  if (cfg.smartcase && !cfg.ignorecase) errors.push("smartcase requires ignorecase");
  return { ok: errors.length === 0, errors };
}
