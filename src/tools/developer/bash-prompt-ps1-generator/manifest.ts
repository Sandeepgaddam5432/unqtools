/**
 * Bash Prompt (PS1) Generator — Tool Manifest.
 * Tool #332 — Category 4 (Developer & Code).
 *
 * Visually build your Bash or Zsh prompt from draggable elements — username,
 * hostname, cwd, git branch, time/date, exit code, prompt symbol, custom text,
 * Nerd Font glyphs — with per-element FG/BG color in 16/256/truecolor plus SGR
 * styles, and get the ready-to-paste PS1 (or Zsh PROMPT) with proper
 * `\[ \]` non-printing wrappers, a bundled git-branch helper, PS2/PS3/PS4
 * generation, two-line support, RPROMPT, title-bar escape, and a live
 * terminal-style preview. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "bash-prompt-ps1-generator",
  name: "Bash Prompt (PS1) Generator",
  description:
    "Build your Bash or Zsh prompt visually — drag username, hostname, cwd, git branch, time, exit-code, and prompt-symbol elements, set per-element FG/BG color in 16/256/truecolor, and copy the ready-to-paste PS1 (or Zsh PROMPT) with proper \\[ \\] non-printing wrappers. Includes bundled parse_git_branch helper, two-line prompts, RPROMPT, PS2/PS3/PS4, title-bar escape, Nerd Font glyphs, live preview, presets, history (localStorage), and shareable URL. 100% client-side.",
  category: "developer",
  keywords: [
    "bash prompt", "ps1", "ps1 generator", "bash prompt generator",
    "zsh prompt", "zsh prompt generator", "prompt", "bashrc",
    "git branch prompt", "terminal prompt", "prompt customization",
    "nerd font prompt", "truecolor prompt", "ansi prompt",
  ],
  icon: "terminal",
  requiresNetwork: false,
  seo: {
    title: "Bash Prompt (PS1) Generator — Bash + Zsh, Live Preview, Git Branch | UnQTools",
    faq: [
      {
        q: "What prompt elements can I add?",
        a: "Seventeen element types: username, hostname (short/full), cwd (full/basename), git branch, time (24h/12h), date, exit status, prompt symbol ($/#), custom text, newline (for two-line prompts), Nerd Font glyph, separator (like ': ', '@', '→'), job count, and history number. Each element has its own foreground + background color in 16/256/truecolor modes plus all 8 SGR styles (bold, italic, underline, etc.).",
      },
      {
        q: "Does it generate correct PS1 with non-printing wrappers?",
        a: "Yes. Every color sequence is wrapped in `\\[ … \\]` so bash readline can correctly compute the visible prompt width — without this wrapping you get the infamous line-wrap and cursor-positioning bugs. A trailing `\\[\\033[0m\\]` reset is appended by default to prevent color bleed into your typed input. You can toggle both in the options panel.",
      },
      {
        q: "Does it work for Zsh too?",
        a: "Yes — toggle the shell to Zsh and the generator emits the equivalent PROMPT using zsh escapes (%n, %m, %~, %F{…}, %#, %?). You can also build a separate RPROMPT (right-side prompt) for things like the current time. Literal `%` characters are auto-escaped to `%%` in custom text.",
      },
      {
        q: "How does the git branch element work?",
        a: "It expands to `\\$(parse_git_branch)` in bash (or `$(git_branch_zsh)` in zsh), which calls a small shell function the tool generates for you. The function uses `git symbolic-ref --short HEAD` to read the current branch and prints it in parentheses — e.g. ' (main)'. The function is bundled in the generated .bashrc / .zshrc snippet, so just paste the whole block.",
      },
      {
        q: "What extra features does this tool have versus other PS1 generators?",
        a: "(1) 17 element types — drag-and-drop reorder. (2) Per-element FG/BG in 16/bright/256/truecolor. (3) All 8 SGR styles per element. (4) Correct `\\[ \\]` non-printing wrappers (the most common bug in other generators). (5) Bash AND Zsh output (PROMPT + RPROMPT). (6) Bundled parse_git_branch helper function. (7) Two-line prompts. (8) PS2/PS3/PS4 secondary prompts. (9) Title-bar escape (xterm `\\e]0;\\u@\\h\\a`). (10) Reset-at-end to prevent color bleed. (11) Nerd Font glyph picker. (12) Exit-status-aware color (green=0, red=non-zero) for prompt-symbol and exit-code elements. (13) Live terminal-style preview using mock data. (14) .bashrc / .zshrc snippet generator. (15) Prompt validation with warnings. (16) 5 starter presets (Ubuntu, minimal arrow, two-line powerline, Zsh powerlevel, truecolor neon). (17) History (localStorage, last 20). (18) Shareable URL. 100% client-side — nothing uploaded, no ads.",
      },
    ],
  },
  status: "done",
};
