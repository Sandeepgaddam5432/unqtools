/**
 * tmux Config Generator & Cheatsheet — pure logic.
 *
 * Emits a `~/.tmux.conf` from a structured TmuxConfig object, plus a
 * searchable keybinding cheatsheet. 100% client-side — no DOM, no network.
 *
 * Design principles:
 *  - Every emitted line is paired with an explanatory comment.
 *  - Style syntax is version-aware (pre-2.9 vs 3.x).
 *  - The cheatsheet reflects the user's custom bindings, not just defaults.
 *  - Warnings surface common foot-guns (escape-time, mouse, send-prefix).
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PrefixKey = "C-b" | "C-a" | "C-Space" | "C-f" | "C-g" | "C-s";

export type TmuxVersion = "2.9" | "3.0" | "3.2" | "3.3";

export type CopyMode = "emacs" | "vi";

export type StatusBarPosition = "top" | "bottom";

export type SplitBinding = "|" | "-" | "\\" | "%";

export type StatusSegment =
  | "session"
  | "host"
  | "datetime"
  | "battery"
  | "uptime"
  | "window-list"
  | "custom";

export interface TmuxConfig {
  prefix: PrefixKey;
  sendPrefix: boolean;
  mouse: boolean;
  baseIndex: number;
  historyLimit: number;
  escapeTime: number;
  copyMode: CopyMode;
  renumberWindows: boolean;
  splitBinding: SplitBinding;
  vSplitBinding: SplitBinding;
  enableResizeBinds: boolean;
  enableReloadBind: boolean;
  enableTrueColor: boolean;
  version: TmuxVersion;
  statusPosition: StatusBarPosition;
  statusFg: string;
  statusBg: string;
  statusLeftSegments: StatusSegment[];
  statusRightSegments: StatusSegment[];
  statusLeftCustom: string;
  statusRightCustom: string;
  plugins: TmuxPlugin[];
}

export interface TmuxPlugin {
  repo: string;
  enabled: boolean;
  options?: Record<string, string>;
}

export interface KeyBinding {
  key: string;
  description: string;
  category: BindingCategory;
  mode: "prefix" | "no-prefix" | "copy-mode" | "command";
  custom?: boolean;
}

export type BindingCategory =
  | "session"
  | "window"
  | "pane"
  | "copy-mode"
  | "config"
  | "misc";

export interface ConfigLine {
  code: string;
  comment: string;
  section: ConfigSection;
}

export type ConfigSection =
  | "header"
  | "prefix"
  | "options"
  | "display"
  | "bindings"
  | "status"
  | "plugins"
  | "footer";

export interface ConfigWarning {
  level: "info" | "warning" | "danger";
  message: string;
}

export interface GenerateResult {
  config: string;
  lines: ConfigLine[];
  warnings: ConfigWarning[];
  cheatsheet: KeyBinding[];
  stats: {
    totalLines: number;
    codeLines: number;
    commentLines: number;
    pluginCount: number;
    bindingCount: number;
  };
}

export interface CheatsheetFilters {
  query?: string;
  category?: BindingCategory | "";
  mode?: ("prefix" | "no-prefix" | "copy-mode" | "command")[];
}

// ---------------------------------------------------------------------------
// Constants / catalogs (UI drives off these)
// ---------------------------------------------------------------------------

export const PREFIX_OPTIONS: ReadonlyArray<{ value: PrefixKey; label: string; hint: string }> = [
  { value: "C-b", label: "C-b", hint: "Default — pairs poorly with bash C-b (backward-char)" },
  { value: "C-a", label: "C-a", hint: "Popular (screen-compatible); conflicts with bash C-a (line-start)" },
  { value: "C-Space", label: "C-Space", hint: "Recommended — no shell conflict; ergonomic" },
  { value: "C-f", label: "C-f", hint: "Conflicts with bash forward-char" },
  { value: "C-g", label: "C-g", hint: "Rarely used in shell; safe" },
  { value: "C-s", label: "C-s", hint: "Conflicts with terminal XOFF flow control" },
];

export const VERSION_OPTIONS: ReadonlyArray<{ value: TmuxVersion; label: string }> = [
  { value: "2.9", label: "tmux 2.9 (legacy style syntax)" },
  { value: "3.0", label: "tmux 3.0+ (unified *-style syntax)" },
  { value: "3.2", label: "tmux 3.2+ (copy-mode-vi fixes)" },
  { value: "3.3", label: "tmux 3.3+ (latest — copy-command, popup)" },
];

export const COPY_MODE_OPTIONS: ReadonlyArray<{ value: CopyMode; label: string }> = [
  { value: "emacs", label: "emacs (default)" },
  { value: "vi", label: "vi" },
];

export const SPLIT_BINDING_OPTIONS: ReadonlyArray<{ value: SplitBinding; label: string }> = [
  { value: "|", label: "  |  (vertical split — like vim)" },
  { value: "-", label: "  -  (horizontal split — like vim)" },
  { value: "\\", label: "  \\  " },
  { value: "%", label: "  %  (tmux default for vertical)" },
];

export const STATUS_SEGMENT_OPTIONS: ReadonlyArray<{ value: StatusSegment; label: string }> = [
  { value: "session", label: "Session name" },
  { value: "host", label: "Hostname" },
  { value: "datetime", label: "Date / time" },
  { value: "battery", label: "Battery (requires tmux-battery plugin)" },
  { value: "uptime", label: "System uptime" },
  { value: "window-list", label: "Window list" },
  { value: "custom", label: "Custom format string" },
];

export const CURATED_PLUGINS: ReadonlyArray<TmuxPlugin> = [
  { repo: "tmux-plugins/tmux-sensible", enabled: false },
  { repo: "tmux-plugins/tmux-resurrect", enabled: false, options: { "@resurrect-capture-pane-contents": "on" } },
  { repo: "tmux-plugins/tmux-continuum", enabled: false, options: { "@continuum-restore": "on", "@continuum-save-interval": "15" } },
  { repo: "tmux-plugins/tmux-yank", enabled: false },
  { repo: "tmux-plugins/tmux-pain-control", enabled: false },
  { repo: "fcsonline/tmux-thumbs", enabled: false },
  { repo: "catppuccin/tmux", enabled: false, options: { "@catppuccin_flavour": "mocha" } },
];

export const CATEGORY_LABELS: Record<BindingCategory, string> = {
  session: "Session",
  window: "Window",
  pane: "Pane",
  "copy-mode": "Copy Mode",
  config: "Config",
  misc: "Misc",
};

export const MODE_LABELS: Record<KeyBinding["mode"], string> = {
  prefix: "Prefix +",
  "no-prefix": "Direct",
  "copy-mode": "Copy mode",
  command: "Command",
};

export const PRESETS: ReadonlyArray<{
  id: string;
  label: string;
  description: string;
  config: TmuxConfig;
}> = [
  {
    id: "minimal",
    label: "Minimal",
    description: "Bare minimum — mouse + 1-base windows + sensible escape-time",
    config: makeDefaultConfig(),
  },
  {
    id: "sensible",
    label: "Sensible",
    description: "C-a prefix, vi mode, | / - splits, true color, sensible plugin",
    config: {
      ...makeDefaultConfig(),
      prefix: "C-a",
      sendPrefix: true,
      copyMode: "vi",
      splitBinding: "|",
      vSplitBinding: "-",
      enableResizeBinds: true,
      enableReloadBind: true,
      enableTrueColor: true,
      plugins: [{ repo: "tmux-plugins/tmux-sensible", enabled: true }],
    },
  },
  {
    id: "gpakosz",
    label: "gpakosz-style",
    description: "Opinionated (gpakosz/.tmux) — C-a, vi, renumber, status bar, resurrect+continuum",
    config: {
      ...makeDefaultConfig(),
      prefix: "C-a",
      sendPrefix: true,
      copyMode: "vi",
      renumberWindows: true,
      splitBinding: "|",
      vSplitBinding: "-",
      enableResizeBinds: true,
      enableReloadBind: true,
      enableTrueColor: true,
      historyLimit: 50000,
      statusPosition: "top",
      statusFg: "white",
      statusBg: "black",
      statusLeftSegments: ["session", "host"],
      statusRightSegments: ["datetime", "uptime"],
      plugins: [
        { repo: "tmux-plugins/tmux-sensible", enabled: true },
        { repo: "tmux-plugins/tmux-resurrect", enabled: true, options: { "@resurrect-capture-pane-contents": "on" } },
        { repo: "tmux-plugins/tmux-continuum", enabled: true, options: { "@continuum-restore": "on" } },
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Default config + helpers
// ---------------------------------------------------------------------------

export function makeDefaultConfig(): TmuxConfig {
  return {
    prefix: "C-b",
    sendPrefix: false,
    mouse: true,
    baseIndex: 1,
    historyLimit: 10000,
    escapeTime: 10,
    copyMode: "emacs",
    renumberWindows: false,
    splitBinding: "|",
    vSplitBinding: "-",
    enableResizeBinds: true,
    enableReloadBind: true,
    enableTrueColor: true,
    version: "3.3",
    statusPosition: "bottom",
    statusFg: "white",
    statusBg: "black",
    statusLeftSegments: ["session"],
    statusRightSegments: ["datetime", "host"],
    statusLeftCustom: "",
    statusRightCustom: "",
    plugins: [],
  };
}

export function normalizeColor(s: string): string {
  // Allow named colors, hex (#rrggbb), or tmux color spec (colour255)
  const v = (s || "").trim();
  if (!v) return "default";
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v;
  if (/^colour\d{1,3}$/.test(v)) return v;
  if (/^[a-z]+$/i.test(v)) return v.toLowerCase();
  return v;
}

export function normalizePluginRepo(repo: string): string {
  return (repo || "").trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "");
}

// ---------------------------------------------------------------------------
// Base keybindings (defaults) — 60+ entries
// ---------------------------------------------------------------------------

export const DEFAULT_BINDINGS: ReadonlyArray<KeyBinding> = [
  // Session
  { key: "d", description: "Detach from session", category: "session", mode: "prefix" },
  { key: "s", description: "List sessions (interactive)", category: "session", mode: "prefix" },
  { key: "$", description: "Rename current session", category: "session", mode: "prefix" },
  { key: "(", description: "Switch to previous session", category: "session", mode: "prefix" },
  { key: ")", description: "Switch to next session", category: "session", mode: "prefix" },
  { key: "L", description: "Toggle last active session", category: "session", mode: "prefix" },
  // Window
  { key: "c", description: "Create new window", category: "window", mode: "prefix" },
  { key: ",", description: "Rename current window", category: "window", mode: "prefix" },
  { key: "&", description: "Kill current window (confirm)", category: "window", mode: "prefix" },
  { key: "n", description: "Next window", category: "window", mode: "prefix" },
  { key: "p", description: "Previous window", category: "window", mode: "prefix" },
  { key: "l", description: "Toggle last window", category: "window", mode: "prefix" },
  { key: "0..9", description: "Select window by index", category: "window", mode: "prefix" },
  { key: "w", description: "List windows (interactive)", category: "window", mode: "prefix" },
  { key: "i", description: "Display window info", category: "window", mode: "prefix" },
  { key: "f", description: "Find window by name", category: "window", mode: "prefix" },
  { key: ".", description: "Reorder window (prompt for index)", category: "window", mode: "prefix" },
  // Pane
  { key: "%", description: "Split vertically (right)", category: "pane", mode: "prefix" },
  { key: '"', description: "Split horizontally (below)", category: "pane", mode: "prefix" },
  { key: "o", description: "Cycle to next pane", category: "pane", mode: "prefix" },
  { key: ";", description: "Toggle last active pane", category: "pane", mode: "prefix" },
  { key: "{", description: "Swap pane with previous", category: "pane", mode: "prefix" },
  { key: "}", description: "Swap pane with next", category: "pane", mode: "prefix" },
  { key: "x", description: "Kill pane (confirm)", category: "pane", mode: "prefix" },
  { key: "q", description: "Show pane numbers; type number to jump", category: "pane", mode: "prefix" },
  { key: "z", description: "Toggle pane zoom (fullscreen)", category: "pane", mode: "prefix" },
  { key: "!", description: "Break pane into its own window", category: "pane", mode: "prefix" },
  { key: "Up", description: "Navigate to pane above", category: "pane", mode: "prefix" },
  { key: "Down", description: "Navigate to pane below", category: "pane", mode: "prefix" },
  { key: "Left", description: "Navigate to pane on the left", category: "pane", mode: "prefix" },
  { key: "Right", description: "Navigate to pane on the right", category: "pane", mode: "prefix" },
  // Config
  { key: "r", description: "Reload ~/.tmux.conf (custom bind)", category: "config", mode: "prefix", custom: true },
  { key: "?", description: "List all keybindings", category: "config", mode: "prefix" },
  { key: ":", description: "Enter command prompt", category: "config", mode: "prefix" },
  { key: "$", description: "Rename session", category: "config", mode: "prefix" },
  // Copy-mode
  { key: "[", description: "Enter copy mode", category: "copy-mode", mode: "prefix" },
  { key: "]", description: "Paste from buffer", category: "copy-mode", mode: "prefix" },
  { key: "PageUp", description: "Enter copy mode and scroll up", category: "copy-mode", mode: "no-prefix" },
  { key: "Space", description: "Start selection (copy-mode-vi)", category: "copy-mode", mode: "copy-mode" },
  { key: "Enter", description: "Copy selection (copy-mode-vi)", category: "copy-mode", mode: "copy-mode" },
  { key: "v", description: "Begin visual selection (emacs)", category: "copy-mode", mode: "copy-mode" },
  { key: "y", description: "Copy selection (vi)", category: "copy-mode", mode: "copy-mode" },
  { key: "q", description: "Exit copy mode", category: "copy-mode", mode: "copy-mode" },
  { key: "/", description: "Search forward", category: "copy-mode", mode: "copy-mode" },
  { key: "?", description: "Search backward", category: "copy-mode", mode: "copy-mode" },
  { key: "n", description: "Next search match", category: "copy-mode", mode: "copy-mode" },
  { key: "N", description: "Previous search match", category: "copy-mode", mode: "copy-mode" },
  { key: "w", description: "Forward by word", category: "copy-mode", mode: "copy-mode" },
  { key: "b", description: "Backward by word", category: "copy-mode", mode: "copy-mode" },
  { key: "0", description: "Start of line", category: "copy-mode", mode: "copy-mode" },
  { key: "$", description: "End of line", category: "copy-mode", mode: "copy-mode" },
  { key: "G", description: "Bottom of scrollback", category: "copy-mode", mode: "copy-mode" },
  { key: "g", description: "Top of scrollback", category: "copy-mode", mode: "copy-mode" },
  // Misc
  { key: "t", description: "Show clock", category: "misc", mode: "prefix" },
  { key: "~", description: "Show tmux messages", category: "misc", mode: "prefix" },
  { key: "C-z", description: "Suspend tmux client", category: "misc", mode: "prefix" },
  { key: "?", description: "List keybindings (prefix)", category: "misc", mode: "prefix" },
  { key: "C-up", description: "Resize pane up by 1 (custom)", category: "pane", mode: "prefix", custom: true },
  { key: "C-down", description: "Resize pane down by 1 (custom)", category: "pane", mode: "prefix", custom: true },
  { key: "C-left", description: "Resize pane left by 1 (custom)", category: "pane", mode: "prefix", custom: true },
  { key: "C-right", description: "Resize pane right by 1 (custom)", category: "pane", mode: "prefix", custom: true },
  { key: "M-1..5", description: "Select layout: even-horizontal, even-vertical, main-vertical, main-horizontal, tiled", category: "pane", mode: "prefix" },
  { key: "Space", description: "Cycle to next layout", category: "pane", mode: "prefix" },
];

// ---------------------------------------------------------------------------
// Personalized cheatsheet — overlay user config on defaults
// ---------------------------------------------------------------------------

export function buildCheatsheet(cfg: TmuxConfig): KeyBinding[] {
  const out: KeyBinding[] = DEFAULT_BINDINGS.map((b) => ({ ...b }));

  // Overlay prefix change in descriptions
  if (cfg.prefix !== "C-b") {
    for (const b of out) {
      if (b.mode === "prefix") {
        // Tag with the new prefix in the key string by mutating the displayed key
        b.key = `${cfg.prefix} ${b.key}`;
      }
    }
  }

  // Overlay split bindings
  const splitV = out.find((b) => b.category === "pane" && b.description.startsWith("Split vertically"));
  if (splitV && cfg.splitBinding !== "%") {
    splitV.key = `${cfg.prefix} ${cfg.splitBinding}`;
    splitV.description = `Split vertically (custom bind: ${cfg.splitBinding})`;
    splitV.custom = true;
  }
  const splitH = out.find((b) => b.category === "pane" && b.description.startsWith("Split horizontally"));
  if (splitH && cfg.vSplitBinding !== '"') {
    splitH.key = `${cfg.prefix} ${cfg.vSplitBinding}`;
    splitH.description = `Split horizontally (custom bind: ${cfg.vSplitBinding})`;
    splitH.custom = true;
  }

  // Reload bind
  if (cfg.enableReloadBind) {
    const reload = out.find((b) => b.description.startsWith("Reload ~/.tmux.conf"));
    if (reload) {
      reload.key = `${cfg.prefix} r`;
      reload.custom = true;
    }
  }

  // Resize binds
  if (!cfg.enableResizeBinds) {
    for (const b of out) {
      if (b.description.startsWith("Resize pane")) {
        b.description = `${b.description} (disabled in your config)`;
      }
    }
  }

  // Mouse note
  if (cfg.mouse) {
    out.push({
      key: "(mouse)",
      description: "Click to select pane; drag dividers to resize; scroll to enter copy mode",
      category: "misc",
      mode: "no-prefix",
      custom: true,
    });
  }

  // Sort: by category then by description
  const order: BindingCategory[] = ["session", "window", "pane", "copy-mode", "config", "misc"];
  out.sort((a, b) => {
    const ca = order.indexOf(a.category);
    const cb = order.indexOf(b.category);
    if (ca !== cb) return ca - cb;
    return a.description.localeCompare(b.description);
  });

  return out;
}

export function filterCheatsheet(bindings: KeyBinding[], filters: CheatsheetFilters): KeyBinding[] {
  const q = (filters.query ?? "").toLowerCase().trim();
  return bindings.filter((b) => {
    if (filters.category && b.category !== filters.category) return false;
    if (filters.mode && filters.mode.length > 0 && !filters.mode.includes(b.mode)) return false;
    if (!q) return true;
    return (
      b.key.toLowerCase().includes(q) ||
      b.description.toLowerCase().includes(q) ||
      b.category.toLowerCase().includes(q) ||
      b.mode.toLowerCase().includes(q)
    );
  });
}

// ---------------------------------------------------------------------------
// Config generation (per-line)
// ---------------------------------------------------------------------------

function styleSyntax(cfg: TmuxConfig, base: string, attrs: string): string {
  // version 2.9 uses separate attributes; 3.x uses unified -style
  if (cfg.version === "2.9") {
    // e.g. set -g status-attr bold; status-fg green; status-bg black
    // We return a multi-line string for the comment to cover it
    return `set -g ${base}-attr ${attrs.split(",")[0] || "none"}\nset -g ${base}-fg ${attrs.split(",").find((a) => a.startsWith("fg="))?.slice(3) || "default"}\nset -g ${base}-bg ${attrs.split(",").find((a) => a.startsWith("bg="))?.slice(3) || "default"}`;
  }
  return `set -g ${base}-style ${attrs}`;
}

function buildStatusSegment(segments: StatusSegment[], custom: string): string {
  if (segments.includes("custom") && custom) return custom;
  const map: Record<StatusSegment, string> = {
    session: "#S",
    host: "#H",
    datetime: "%Y-%m-%d %H:%M",
    battery: "#{battery_percentage}",
    uptime: "#{uptime_s}",
    "window-list": "#W",
    custom: custom || "",
  };
  return segments.map((s) => map[s]).filter(Boolean).join(" | ");
}

export function buildLines(cfg: TmuxConfig): ConfigLine[] {
  const lines: ConfigLine[] = [];
  const date = new Date().toISOString().slice(0, 10);

  // Header
  lines.push({
    code: `# ~/.tmux.conf — generated by UnQTools (tmux-config-generator-cheatsheet)`,
    comment: `Generated ${date}. Drop into your home directory and run: tmux source ~/.tmux.conf`,
    section: "header",
  });
  lines.push({
    code: `# tmux version target: ${cfg.version}`,
    comment: `Emits ${cfg.version === "2.9" ? "pre-2.9 (separate -attr/-fg/-bg)" : "3.x (unified -style)"} syntax.`,
    section: "header",
  });

  // Prefix
  lines.push({
    code: `# --- Prefix key ---`,
    comment: `Changing the prefix? Also unbind the default and rebind send-prefix if you want nested tmux to forward the prefix.`,
    section: "prefix",
  });
  if (cfg.prefix !== "C-b") {
    lines.push({
      code: `unbind C-b`,
      comment: `Remove the default C-b prefix so it stops triggering tmux commands.`,
      section: "prefix",
    });
  }
  lines.push({
    code: `set -g prefix ${cfg.prefix}`,
    comment: `New prefix is ${cfg.prefix}. All "prefix + key" combos below start with ${cfg.prefix}.`,
    section: "prefix",
  });
  if (cfg.sendPrefix) {
    lines.push({
      code: `bind-key ${cfg.prefix} send-prefix`,
      comment: `Press ${cfg.prefix} twice to send a literal ${cfg.prefix} to the inner program (needed for nested tmux).`,
      section: "prefix",
    });
  }

  // Options
  lines.push({
    code: `# --- General options ---`,
    comment: `Set once; affect all sessions.`,
    section: "options",
  });
  lines.push({
    code: `set -g mouse ${cfg.mouse ? "on" : "off"}`,
    comment: cfg.mouse
      ? "Mouse on: click panes, drag dividers, scroll to copy. Trade-off: terminal text selection needs Shift."
      : "Mouse off: terminal gets normal text selection. Tmux mouse features disabled.",
    section: "options",
  });
  lines.push({
    code: `set -g base-index ${cfg.baseIndex}`,
    comment: `Windows are numbered starting at ${cfg.baseIndex} (default 0). ${cfg.baseIndex === 1 ? "Pairs well with keyboard 1-9." : ""}`,
    section: "options",
  });
  lines.push({
    code: `setw -g pane-base-index ${cfg.baseIndex}`,
    comment: `Panes also start at ${cfg.baseIndex} for consistency with windows.`,
    section: "options",
  });
  lines.push({
    code: `set -g history-limit ${cfg.historyLimit}`,
    comment: `Lines of scrollback per pane. ${cfg.historyLimit >= 50000 ? "Generous; uses more RAM per pane." : "Default-ish."} Raise if you lose output.`,
    section: "options",
  });
  lines.push({
    code: `set -sg escape-time ${cfg.escapeTime}`,
    comment: `Ms to wait after ESC before passing it through. ${cfg.escapeTime > 100 ? "High — may cause vim ESC lag." : cfg.escapeTime === 0 ? "0 — fastest, but breaks some keys in legacy terminals." : "Low — good for vim."}`,
    section: "options",
  });
  if (cfg.renumberWindows) {
    lines.push({
      code: `set -g renumber-windows on`,
      comment: `Auto-renumber windows when one is closed (no gaps in 1,2,4,5).`,
      section: "options",
    });
  }
  lines.push({
    code: `set -g status-keys ${cfg.copyMode === "vi" ? "vi" : "emacs"}`,
    comment: `Key table used in the tmux command prompt (e.g. when renaming a session).`,
    section: "options",
  });

  // Display / copy-mode
  lines.push({
    code: `# --- Display & copy-mode ---`,
    comment: `vi-mode keys in copy-mode (hjkl, v, y) match vim. emacs-mode uses C-n/C-p/C-b/C-f.`,
    section: "display",
  });
  lines.push({
    code: `setw -g mode-keys ${cfg.copyMode}`,
    comment: `Copy-mode key table: ${cfg.copyMode}.`,
    section: "display",
  });
  if (cfg.copyMode === "vi") {
    lines.push({
      code: `bind-key -T copy-mode-vi v send -X begin-selection`,
      comment: `v starts a visual selection in copy-mode-vi (matches vim).`,
      section: "display",
    });
    lines.push({
      code: `bind-key -T copy-mode-vi y send -X copy-selection-and-cancel`,
      comment: `y yanks the selection into the tmux buffer (and exits copy mode).`,
      section: "display",
    });
  }
  if (cfg.enableTrueColor) {
    lines.push({
      code: `set -g default-terminal "tmux-256color"`,
      comment: `Advertises 256-color capability to programs inside tmux.`,
      section: "display",
    });
    lines.push({
      code: `set -ag terminal-overrides ",xterm-256color:RGB"`,
      comment: `Enables 24-bit true color (Tc) on supporting terminals (xterm, iTerm2, Alacritty, kitty).`,
      section: "display",
    });
  }

  // Bindings
  lines.push({
    code: `# --- Custom keybindings ---`,
    comment: `All binds below use the new prefix (${cfg.prefix}).`,
    section: "bindings",
  });
  if (cfg.enableReloadBind) {
    lines.push({
      code: `bind r source-file ~/.tmux.conf \\; display-message "Config reloaded."`,
      comment: `Prefix + r reloads this file. No need to restart tmux.`,
      section: "bindings",
    });
  }
  lines.push({
    code: `bind ${cfg.splitBinding} split-window -h -c "#{pane_current_path}"`,
    comment: `Prefix + ${cfg.splitBinding} splits the active pane vertically (left|right) and keeps the cwd.`,
    section: "bindings",
  });
  lines.push({
    code: `bind ${cfg.vSplitBinding} split-window -v -c "#{pane_current_path}"`,
    comment: `Prefix + ${cfg.vSplitBinding} splits the active pane horizontally (top/bottom) and keeps the cwd.`,
    section: "bindings",
  });
  if (cfg.enableResizeBinds) {
    lines.push({
      code: `bind -r C-up resize-pane -U 5`,
      comment: `Prefix + C-up resizes the pane up by 5 lines. -r allows repeat without re-pressing prefix.`,
      section: "bindings",
    });
    lines.push({
      code: `bind -r C-down resize-pane -D 5`,
      comment: `Prefix + C-down resizes the pane down by 5 lines.`,
      section: "bindings",
    });
    lines.push({
      code: `bind -r C-left resize-pane -L 5`,
      comment: `Prefix + C-left resizes the pane left by 5 columns.`,
      section: "bindings",
    });
    lines.push({
      code: `bind -r C-right resize-pane -R 5`,
      comment: `Prefix + C-right resizes the pane right by 5 columns.`,
      section: "bindings",
    });
  }
  // Vi-style pane navigation if copy-mode is vi
  if (cfg.copyMode === "vi") {
    lines.push({
      code: `bind h select-pane -L`,
      comment: `Prefix + h → left pane (vi-style).`,
      section: "bindings",
    });
    lines.push({
      code: `bind j select-pane -D`,
      comment: `Prefix + j → down pane (vi-style).`,
      section: "bindings",
    });
    lines.push({
      code: `bind k select-pane -U`,
      comment: `Prefix + k → up pane (vi-style).`,
      section: "bindings",
    });
    lines.push({
      code: `bind l select-pane -R`,
      comment: `Prefix + l → right pane (vi-style).`,
      section: "bindings",
    });
  }

  // Status bar
  lines.push({
    code: `# --- Status bar ---`,
    comment: `Position, colors, and left/right content.`,
    section: "status",
  });
  lines.push({
    code: `set -g status-position ${cfg.statusPosition}`,
    comment: `Status bar appears at the ${cfg.statusPosition} of the terminal.`,
    section: "status",
  });
  const fg = normalizeColor(cfg.statusFg);
  const bg = normalizeColor(cfg.statusBg);
  if (cfg.version === "2.9") {
    lines.push({
      code: `set -g status-fg ${fg}`,
      comment: `Status bar foreground color.`,
      section: "status",
    });
    lines.push({
      code: `set -g status-bg ${bg}`,
      comment: `Status bar background color.`,
      section: "status",
    });
  } else {
    lines.push({
      code: `set -g status-style fg=${fg},bg=${bg}`,
      comment: `Status bar foreground (${fg}) and background (${bg}) — unified 3.x syntax.`,
      section: "status",
    });
  }
  const leftContent = buildStatusSegment(cfg.statusLeftSegments, cfg.statusLeftCustom);
  const rightContent = buildStatusSegment(cfg.statusRightSegments, cfg.statusRightCustom);
  if (leftContent) {
    lines.push({
      code: `set -g status-left "${leftContent}"`,
      comment: `Left side of the status bar: ${cfg.statusLeftSegments.join(", ") || "custom"}.`,
      section: "status",
    });
    lines.push({
      code: `set -g status-left-length 60`,
      comment: `Reserve up to 60 columns for the left segment so it isn't truncated.`,
      section: "status",
    });
  }
  if (rightContent) {
    lines.push({
      code: `set -g status-right "${rightContent}"`,
      comment: `Right side of the status bar: ${cfg.statusRightSegments.join(", ") || "custom"}.`,
      section: "status",
    });
    lines.push({
      code: `set -g status-right-length 60`,
      comment: `Reserve up to 60 columns for the right segment.`,
      section: "status",
    });
  }
  // Active window style
  if (cfg.version === "2.9") {
    lines.push({
      code: `set -g window-status-current-attr reverse`,
      comment: `Active window is shown in reverse video.`,
      section: "status",
    });
  } else {
    lines.push({
      code: `set -g window-status-current-style "bold,fg=${fg},bg=${bg === "black" ? "brightblack" : bg}"`,
      comment: `Active window is shown bold with a contrasting background.`,
      section: "status",
    });
  }

  // Plugins (TPM)
  const enabledPlugins = cfg.plugins.filter((p) => p.enabled && normalizePluginRepo(p.repo));
  if (enabledPlugins.length > 0) {
    lines.push({
      code: `# --- Plugins (TPM) ---`,
      comment: `Requires tmux-plugin-manager (TPM). Clone once: git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm`,
      section: "plugins",
    });
    lines.push({
      code: `set -g @plugin "tmux-plugins/tpm"`,
      comment: `The plugin manager itself. Must be the first @plugin line.`,
      section: "plugins",
    });
    for (const p of enabledPlugins) {
      lines.push({
        code: `set -g @plugin "${normalizePluginRepo(p.repo)}"`,
        comment: `Plugin: ${p.repo}. ${pluginHint(p.repo)}`,
        section: "plugins",
      });
      if (p.options) {
        for (const [k, v] of Object.entries(p.options)) {
          lines.push({
            code: `set -g ${k} "${v}"`,
            comment: `Option for ${p.repo}: ${k}=${v}`,
            section: "plugins",
          });
        }
      }
    }
  }

  // Footer (TPM init MUST be at the very bottom)
  if (enabledPlugins.length > 0) {
    lines.push({
      code: `# --- TPM init (MUST stay at the very bottom) ---`,
      comment: `TPM loads every @plugin listed above. If you remove this, none of your plugins will load.`,
      section: "footer",
    });
    lines.push({
      code: `run "~/.tmux/plugins/tpm/tpm"`,
      comment: `Run TPM. Press prefix + I to install plugins, prefix + U to update, prefix + alt + u to uninstall.`,
      section: "footer",
    });
  } else {
    lines.push({
      code: `# --- End of ~/.tmux.conf ---`,
      comment: `No plugins enabled. Add one in the UI to get the TPM bootstrap block.`,
      section: "footer",
    });
  }

  return lines;
}

function pluginHint(repo: string): string {
  const map: Record<string, string> = {
    "tmux-plugins/tmux-sensible": "A set of broadly-agreed options that everyone wants.",
    "tmux-plugins/tmux-resurrect": "Persists sessions across reboots. prefix + Ctrl-s to save, prefix + Ctrl-r to restore.",
    "tmux-plugins/tmux-continuum": "Automatic background save + restore-on-start for resurrect.",
    "tmux-plugins/tmux-yank": "Better copy: copies to system clipboard, supports copy-pipe.",
    "tmux-plugins/tmux-pain-control": "Sane pane bindings (split, resize, swap, kill).",
    "fcsonline/tmux-thumbs": "Vimium/Easymotion-style hints for text on screen.",
    "catppuccin/tmux": "Pastel theme. Set @catppuccin_flavour to mocha/latte/frappe/macchiato.",
  };
  return map[repo] ?? "";
}

export function buildWarnings(cfg: TmuxConfig): ConfigWarning[] {
  const w: ConfigWarning[] = [];
  if (cfg.escapeTime > 100) {
    w.push({
      level: "warning",
      message: `escape-time is ${cfg.escapeTime}ms — high. Vim users will notice ESC lag. 10–50ms is recommended.`,
    });
  }
  if (cfg.escapeTime === 0) {
    w.push({
      level: "info",
      message: "escape-time is 0. Fastest, but some terminal keys (e.g. arrow keys in legacy apps) may break.",
    });
  }
  if (cfg.prefix !== "C-b" && !cfg.sendPrefix) {
    w.push({
      level: "warning",
      message: `You changed the prefix to ${cfg.prefix} but didn't enable "send-prefix". Nested tmux (local + SSH) won't be able to forward ${cfg.prefix} to the inner tmux.`,
    });
  }
  if (cfg.mouse) {
    w.push({
      level: "info",
      message: "Mouse mode is on. Hold Shift to select/copy text the terminal way (bypassing tmux).",
    });
  }
  if (cfg.prefix === "C-a" && cfg.copyMode === "emacs") {
    w.push({
      level: "info",
      message: "Prefix C-a conflicts with bash C-a (move to line start). Press prefix C-a twice or use C-Space.",
    });
  }
  if (cfg.prefix === "C-s") {
    w.push({
      level: "danger",
      message: "C-s is XOFF (terminal flow control) in many terminals. Pressing it can freeze your terminal — C-q resumes.",
    });
  }
  if (cfg.plugins.some((p) => p.enabled && p.repo.includes("resurrect")) &&
      !cfg.plugins.some((p) => p.enabled && p.repo.includes("continuum"))) {
    w.push({
      level: "info",
      message: "tmux-resurrect is enabled but tmux-continuum is not. Add continuum for automatic save/restore.",
    });
  }
  if (cfg.statusLeftSegments.includes("battery") && !cfg.plugins.some((p) => p.enabled && p.repo.includes("tmux-battery"))) {
    w.push({
      level: "warning",
      message: "Status bar uses battery segment but tmux-battery plugin is not enabled. Add tmux-plugins/tmux-battery.",
    });
  }
  return w;
}

export function renderConfig(lines: ConfigLine[]): string {
  return lines
    .map((l) => {
      if (l.code.startsWith("#")) return l.code;
      if (l.code.includes("\n")) {
        // Multi-line code (rare, e.g. 2.9 style). Comment above each block.
        return `${l.comment}\n${l.code}`;
      }
      return `${l.code}  # ${l.comment}`;
    })
    .join("\n");
}

export function generateConfig(cfg: TmuxConfig): GenerateResult {
  const lines = buildLines(cfg);
  const config = renderConfig(lines);
  const warnings = buildWarnings(cfg);
  const cheatsheet = buildCheatsheet(cfg);
  const enabledPlugins = cfg.plugins.filter((p) => p.enabled && normalizePluginRepo(p.repo));
  return {
    config,
    lines,
    warnings,
    cheatsheet,
    stats: {
      totalLines: lines.length,
      codeLines: lines.filter((l) => !l.code.startsWith("#")).length,
      commentLines: lines.filter((l) => l.code.startsWith("#")).length,
      pluginCount: enabledPlugins.length,
      bindingCount: cheatsheet.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Render cheatsheet as plain text / markdown
// ---------------------------------------------------------------------------

export function renderCheatsheetMarkdown(bindings: KeyBinding[]): string {
  const order: BindingCategory[] = ["session", "window", "pane", "copy-mode", "config", "misc"];
  const out: string[] = ["# tmux Cheatsheet", ""];
  for (const cat of order) {
    const items = bindings.filter((b) => b.category === cat);
    if (items.length === 0) continue;
    out.push(`## ${CATEGORY_LABELS[cat]}`);
    out.push("");
    out.push("| Key | Description | Mode |");
    out.push("| --- | --- | --- |");
    for (const b of items) {
      out.push(`| \`${b.key}\` | ${b.description} | ${MODE_LABELS[b.mode]} |`);
    }
    out.push("");
  }
  return out.join("\n");
}

export function renderCheatsheetText(bindings: KeyBinding[]): string {
  const order: BindingCategory[] = ["session", "window", "pane", "copy-mode", "config", "misc"];
  const out: string[] = ["tmux Cheatsheet", "================", ""];
  for (const cat of order) {
    const items = bindings.filter((b) => b.category === cat);
    if (items.length === 0) continue;
    out.push(`[${CATEGORY_LABELS[cat]}]`);
    for (const b of items) {
      out.push(`  ${b.key.padEnd(20)} ${b.description}`);
    }
    out.push("");
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateConfig(cfg: TmuxConfig): { ok: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (cfg.baseIndex < 0) errors.push("base-index must be >= 0");
  if (cfg.baseIndex > 99) errors.push("base-index too high (max 99)");
  if (cfg.historyLimit < 100) errors.push("history-limit too low (min 100)");
  if (cfg.escapeTime < 0) errors.push("escape-time must be >= 0");
  if (cfg.escapeTime > 1000) errors.push("escape-time too high (max 1000ms)");
  if (!PREFIX_OPTIONS.some((p) => p.value === cfg.prefix)) errors.push(`invalid prefix: ${cfg.prefix}`);
  if (!VERSION_OPTIONS.some((v) => v.value === cfg.version)) errors.push(`invalid version: ${cfg.version}`);
  for (const p of cfg.plugins) {
    if (p.enabled && !normalizePluginRepo(p.repo)) {
      errors.push(`plugin with empty repo is enabled`);
    }
    if (p.enabled && !/^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(normalizePluginRepo(p.repo))) {
      errors.push(`plugin repo looks malformed: ${p.repo}`);
    }
  }
  for (const w of buildWarnings(cfg)) warnings.push(w.message);
  return { ok: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:tmux-config-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  presetId: string;
  prefix: PrefixKey;
  version: TmuxVersion;
  pluginCount: number;
  lineCount: number;
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

export function buildShareUrl(cfg: TmuxConfig): string {
  const params = new URLSearchParams();
  params.set("prefix", cfg.prefix);
  params.set("version", cfg.version);
  params.set("mouse", String(cfg.mouse));
  params.set("base", String(cfg.baseIndex));
  params.set("hist", String(cfg.historyLimit));
  params.set("esc", String(cfg.escapeTime));
  params.set("mode", cfg.copyMode);
  params.set("splitV", cfg.splitBinding);
  params.set("splitH", cfg.vSplitBinding);
  params.set("renum", String(cfg.renumberWindows));
  params.set("tc", String(cfg.enableTrueColor));
  params.set("spos", cfg.statusPosition);
  params.set("sfg", cfg.statusFg);
  params.set("sbg", cfg.statusBg);
  params.set("sleft", cfg.statusLeftSegments.join(","));
  params.set("sright", cfg.statusRightSegments.join(","));
  params.set("plugins", cfg.plugins.filter((p) => p.enabled).map((p) => p.repo).join(","));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string, base?: Partial<TmuxConfig>): TmuxConfig {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { ...makeDefaultConfig(), ...base };
  const params = new URLSearchParams(clean);
  const cfg = { ...makeDefaultConfig(), ...base };

  const prefix = params.get("prefix") as PrefixKey | null;
  if (prefix && PREFIX_OPTIONS.some((p) => p.value === prefix)) cfg.prefix = prefix;

  const version = params.get("version") as TmuxVersion | null;
  if (version && VERSION_OPTIONS.some((v) => v.value === version)) cfg.version = version;

  const mouse = params.get("mouse");
  if (mouse !== null) cfg.mouse = mouse === "true";

  const base_ = params.get("base");
  if (base_ !== null) {
    const n = parseInt(base_, 10);
    if (!Number.isNaN(n) && n >= 0 && n <= 99) cfg.baseIndex = n;
  }

  const hist = params.get("hist");
  if (hist !== null) {
    const n = parseInt(hist, 10);
    if (!Number.isNaN(n) && n >= 100) cfg.historyLimit = n;
  }

  const esc = params.get("esc");
  if (esc !== null) {
    const n = parseInt(esc, 10);
    if (!Number.isNaN(n) && n >= 0) cfg.escapeTime = n;
  }

  const mode = params.get("mode") as CopyMode | null;
  if (mode && (mode === "vi" || mode === "emacs")) cfg.copyMode = mode;

  const splitV = params.get("splitV") as SplitBinding | null;
  if (splitV && SPLIT_BINDING_OPTIONS.some((s) => s.value === splitV)) cfg.splitBinding = splitV;

  const splitH = params.get("splitH") as SplitBinding | null;
  if (splitH && SPLIT_BINDING_OPTIONS.some((s) => s.value === splitH)) cfg.vSplitBinding = splitH;

  const renum = params.get("renum");
  if (renum !== null) cfg.renumberWindows = renum === "true";

  const tc = params.get("tc");
  if (tc !== null) cfg.enableTrueColor = tc === "true";

  const spos = params.get("spos") as StatusBarPosition | null;
  if (spos && (spos === "top" || spos === "bottom")) cfg.statusPosition = spos;

  const sfg = params.get("sfg");
  if (sfg) cfg.statusFg = sfg;

  const sbg = params.get("sbg");
  if (sbg) cfg.statusBg = sbg;

  const sleft = params.get("sleft");
  if (sleft !== null) {
    const valid = STATUS_SEGMENT_OPTIONS.map((s) => s.value);
    cfg.statusLeftSegments = sleft
      .split(",")
      .filter((s) => valid.includes(s as StatusSegment)) as StatusSegment[];
  }

  const sright = params.get("sright");
  if (sright !== null) {
    const valid = STATUS_SEGMENT_OPTIONS.map((s) => s.value);
    cfg.statusRightSegments = sright
      .split(",")
      .filter((s) => valid.includes(s as StatusSegment)) as StatusSegment[];
  }

  const plugins = params.get("plugins");
  if (plugins !== null) {
    const repos = plugins.split(",").filter(Boolean);
    const curated = CURATED_PLUGINS.map((p) => ({ ...p }));
    for (const r of repos) {
      const existing = curated.find((p) => p.repo === r);
      if (existing) existing.enabled = true;
      else curated.push({ repo: r, enabled: true });
    }
    cfg.plugins = curated;
  }

  return cfg;
}

// ---------------------------------------------------------------------------
// Style-syntax helper export (for tests)
// ---------------------------------------------------------------------------

export function _styleSyntax(cfg: TmuxConfig, base: string, attrs: string): string {
  return styleSyntax(cfg, base, attrs);
}
