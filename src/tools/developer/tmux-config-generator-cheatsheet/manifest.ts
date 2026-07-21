/**
 * tmux Config Generator & Cheatsheet — Tool Manifest.
 * Tool #334 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "tmux-config-generator-cheatsheet",
  name: "tmux Config Generator & Cheatsheet",
  description:
    "Build a .tmux.conf from a UI — prefix key (C-b / C-a / C-Space), mouse, base-index, history limit, escape-time, vi/emacs mode, split bindings, status bar (position/colors/left/right), and TPM plugin wiring. Version-aware (2.9 vs 3.x style syntax). Live preview with per-line comments + searchable 60+ keybinding cheatsheet reflecting YOUR custom bindings. 100% client-side.",
  category: "developer",
  keywords: [
    "tmux", "tmux conf", "tmux config", "tmux.conf", "tmux generator",
    "tmux cheat sheet", "tmux keybindings", "tmux prefix", "tmux status bar",
    "tmux plugins", "tpm", "tmux sensible", "tmux resurrect", "tmux continuum",
  ],
  icon: "terminal",
  requiresNetwork: false,
  seo: {
    title: "tmux Config Generator & Cheatsheet — .tmux.conf, Prefix, Status Bar, TPM | UnQTools",
    faq: [
      {
        q: "What can I configure with this tmux config generator?",
        a: "Every common option: prefix key (C-b / C-a / C-Space), mouse mode, base-index, history limit, escape-time, vi/emacs mode, split bindings (| and -), pane navigation, pane-resize bindings, copy-mode keys, status-bar position/colors and left/right content, terminal-overrides for true-color (Tc), and the TPM plugin block (sensible, resurrect, continuum, and more). All emitted with per-line comments.",
      },
      {
        q: "Why does the generator ask for a tmux version?",
        a: "tmux changed its styling syntax between 2.9 and 3.x. Older versions use 'set -g status-attr bold,fg=green,bg=black'; 3.x uses the unified 'set -g status-style bold,fg=green,bg=black' (and 'window-status-style' etc.). Selecting the right version makes sure your generated config loads without errors on your machine.",
      },
      {
        q: "How does the cheatsheet reflect my custom bindings?",
        a: "The cheatsheet is generated from a base set of 60+ default tmux keybindings, then overlaid with your custom choices. If you change the prefix from C-b to C-a, rebind splits to | and -, or remap pane-navigation keys, those changes show up immediately in the personalized cheatsheet so you don't have to remember which defaults you overrode.",
      },
      {
        q: "Does the TPM plugin block include the install line?",
        a: "Yes. When you enable any plugin, the generator emits the full TPM bootstrap block: the 'set -g @plugin tmux-plugins/tpm' line, each selected plugin line, and the 'run ~/.tmux/plugins/tpm/tpm' initializer at the very bottom of the config — exactly as the TPM README requires. Curated plugins: tmux-sensible, tmux-resurrect, tmux-continuum, tmux-yank, tmux-pain-control, tmux-fzf, and catppuccin/tmux.",
      },
      {
        q: "What extra features does this tool have versus other tmux generators?",
        a: "(1) Generator + live cheatsheet in one tool. (2) Per-line explanatory comments. (3) Version-aware syntax (2.9 vs 3.x). (4) Six prefix-key presets. (5) TPM plugin block with curated list (7 plugins). (6) Personalized cheatsheet reflecting YOUR custom bindings. (7) 60+ default keybindings across sessions, windows, panes, copy-mode, and config. (8) Warnings for escape-time too high, mouse mode trade-offs, nested-tmux prefix, and missing send-prefix. (9) Copy / download .tmux.conf. (10) localStorage history (max 20). (11) Shareable URL (options in fragment, never sent to server). (12) One-click presets (Minimal / Sensible / gpakosz-style). 100% offline.",
      },
    ],
  },
  status: "done",
};
