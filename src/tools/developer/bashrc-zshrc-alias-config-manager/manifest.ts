/**
 * .bashrc / .zshrc Alias & Config Manager — Tool Manifest.
 * Tool #336 — Category 4 (Developer & Code).
 *
 * Build and organize shell aliases, functions, exports, and PATH edits in a
 * visual editor, then export a clean, commented `.aliases` file sourced from
 * both `.bashrc` and `.zshrc` — with conflict detection against shell
 * builtins and common CLI tools, plus starter packs for git, docker, kubectl,
 * navigation, safety, ls, dev, devops, and data science. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "bashrc-zshrc-alias-config-manager",
  name: ".bashrc / .zshrc Alias & Config Manager",
  description:
    "Build shell aliases, functions, exports, and PATH edits in a visual editor, then export a clean, commented .aliases file sourced from both .bashrc and .zshrc — with shadowing detection against shell builtins and common CLI tools, function suggestions when args are needed, starter packs (git, docker, kubectl, navigation, safety, ls, dev, devops, data science), import of existing rc files, dedupe, history (localStorage), and shareable URL. 100% client-side.",
  category: "developer",
  keywords: [
    "bashrc", "zshrc", "alias manager", "shell aliases",
    "bash aliases", "zsh aliases", "shared aliases bash zsh",
    "create bash function", "alias config", "rc file editor",
    "dotfiles aliases", "terminal aliases", "cli shortcuts",
  ],
  icon: "terminal",
  requiresNetwork: false,
  seo: {
    title: ".bashrc / .zshrc Alias & Config Manager — Shared .aliases + Linter | UnQTools",
    faq: [
      {
        q: "How does the alias manager work?",
        a: "Add aliases (name → command) with an optional description, group them by category (git, docker, kubectl, navigation, safety, ls, dev, devops, data science), add shell functions for commands that need positional arguments ($1, $@), set exports (env vars) and PATH-prepend/append entries, then export a single commented .aliases file. The tool also emits the exact two-line sourcing snippet for both .bashrc and .zshrc so the same file works in both shells.",
      },
      {
        q: "What is alias shadowing and how does the linter detect it?",
        a: "Shadowing happens when an alias name overrides a real command — for example `alias ls='ls -la'` or `alias rm='rm -i'`. The bundled linter ships with the full bash/zsh builtin list (~50 commands like cd, export, source) plus a list of ~80 common CLI tools (git, docker, kubectl, vim, python, grep, …) and warns you when an alias collides. It also flags recursive aliases (`alias x='x …'`) and cases where a function should be used because the command references $1, $@, $#, or $2.",
      },
      {
        q: "Can I import my existing .bashrc or .aliases file?",
        a: "Yes. Paste the contents of your existing .bashrc, .zshrc, or .aliases file and the parser extracts alias lines (`alias name='value'`), export lines (`export KEY=value`), PATH manipulations (`export PATH=/foo:$PATH`), and one-line function definitions, plus any `# description` comments above each entry. Imported aliases are then merged with your current config, deduplicated by name.",
      },
      {
        q: "Why use functions instead of aliases?",
        a: "Aliases can't take positional arguments. `alias greet='echo Hello $1'` won't work — when you run `greet World` the shell expands the alias to `echo Hello $1 World` and `$1` is empty inside an alias. The linter detects commands referencing $1, $@, $#, or $2 and suggests converting them to a function: `greet() { echo \"Hello $1\"; }`. Functions also let you write multi-step logic and use `local` variables.",
      },
      {
        q: "What extra features does this tool have versus hand-editing my rc files?",
        a: "(1) Visual editor for aliases, functions, exports, and PATH entries. (2) Starter packs for git, docker, kubectl, navigation, safety, ls, dev, devops, and data science. (3) Shadowing linter against 50+ shell builtins and 80+ common CLI tools. (4) Function-needed detector (catches $1/$@ misuse). (5) Recursive-alias guard. (6) bash-only / zsh-only flagging. (7) Import existing .bashrc/.zshrc/.aliases with comment-aware parsing. (8) Dedupe aliases by name. (9) Grouped, commented .aliases output. (10) .bashrc + .zshrc sourcing snippet generators. (11) Stats by category and enabled/disabled counts. (12) History (localStorage, last 20). (13) Shareable URL with full config encoded. 100% client-side — your config is never uploaded. No ads.",
      },
    ],
  },
  status: "done",
};
