/**
 * Dotfiles Manager Generator — Tool Manifest.
 * Tool #337 — Category 4 (Developer & Code).
 *
 * Scaffold a dotfiles repo + idempotent install/bootstrap script from your
 * choices — pick the configs to track (.bashrc, .vimrc, .gitconfig,
 * .tmux.conf, ssh, …), choose a manager (GNU Stow / bare-git / chezmoi /
 * Dotbot) with a comparison table, and get a repo structure, README, an
 * idempotent install.sh that backs up existing files, and a secret-safe
 * .gitignore. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "dotfiles-manager-generator",
  name: "Dotfiles Manager Generator",
  description:
    "Scaffold a dotfiles repo + idempotent install script. Pick the configs to track (.bashrc, .vimrc, .gitconfig, .tmux.conf, ssh config, …), choose a manager (GNU Stow / bare-git / chezmoi / Dotbot) with a full comparison table, and get a repo tree, README, idempotent install.sh that backs up existing files, and a secret-safe .gitignore with a 'never commit these' checklist. 100% client-side.",
  category: "developer",
  keywords: [
    "dotfiles manager", "dotfiles generator", "gnu stow",
    "chezmoi vs stow", "bootstrap dotfiles script",
    "manage dotfiles git", "bare git dotfiles", "dotbot",
    "dotfiles repo", "dotfiles installer", "symlink dotfiles",
  ],
  icon: "folder-tree",
  requiresNetwork: false,
  seo: {
    title: "Dotfiles Manager Generator — Stow / bare-git / chezmoi / Dotbot | UnQTools",
    faq: [
      {
        q: "Which dotfiles managers are supported?",
        a: "Four managers, each with a full comparison card: GNU Stow (symlink farm, beginner-friendly), bare-git (no extra binary, files live at real $HOME paths), chezmoi (templating + encrypted secrets via age/gpg), and Dotbot (Python bootstrap with YAML config). The cards list pros, cons, difficulty level, whether symlinks are used, and whether an external binary is required.",
      },
      {
        q: "Is the install script idempotent and does it back up existing files?",
        a: "Yes — running install.sh twice produces the same end-state. Existing files at target paths are handled per your chosen backup mode: 'bak' (default) moves them to *.bak.<timestamp>, 'skip' leaves them in place and skips the link, or 'overwrite' removes them. The script uses `set -euo pipefail`, creates parent directories, and uses `ln -sfn` so re-running is safe.",
      },
      {
        q: "What's in the generated .gitignore?",
        a: "A secret-safe default: SSH private keys (~/.ssh/id_*), cloud credentials (~/.aws/credentials, ~/.kube/config, ~/.config/gh/hosts.yml), .env files, GnuPG dir, shell histories, password-store, Docker registry tokens, and *.pem/*.key/*.p12 patterns — plus OS junk (.DS_Store, Thumbs.db) and editor swap files. Manager-specific notes are appended (e.g. chezmoi ignores .chezmoi.toml local config).",
      },
      {
        q: "Which dotfiles can I track?",
        a: "Twelve common configs are in the catalog: .bashrc, .zshrc, .vimrc, .config/nvim (directory), .tmux.conf, .gitconfig, .gitignore_global, .ssh/config (flagged for secret risk), .config/starship.toml, .editorconfig, .profile, and .inputrc. Each has a default repo filename and starter content. You can tick exactly the ones you want.",
      },
      {
        q: "What extra features does this tool have versus copying someone's repo?",
        a: "(1) Manager comparison cards (Stow / bare-git / chezmoi / Dotbot) with pros, cons, difficulty. (2) Catalog of 12 common dotfiles with secret-risk flags. (3) Repo tree diagram for the chosen manager. (4) Idempotent install.sh with three backup modes. (5) OS detection guards (macOS / Linux / Windows). (6) Optional brew/apt package-install stub. (7) Secret-safe .gitignore (~25 patterns). (8) 'Never commit these' checklist with severity (critical/warn). (9) Generated README with manager rationale + repo layout. (10) Dotbot YAML config generator. (11) chezmoi .chezmoi.toml.tmpl generator. (12) Config validation (e.g. flags bare-git + ssh/config as risky). (13) History (localStorage, last 20). (14) Shareable URL with full config encoded. 100% client-side — nothing uploaded, no ads.",
      },
    ],
  },
  status: "done",
};
