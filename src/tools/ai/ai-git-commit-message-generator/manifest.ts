import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-git-commit-message-generator",
  name: "AI Git Commit Message Generator",
  description:
    "Paste a git diff and get a clear Conventional Commits message (type, scope, subject, body, footer) plus gitmoji, plain, and subject+body styles. Parses file changes, additions/deletions, classifies change type (feat / fix / docs / refactor / test / chore / perf / style / ci / build), detects breaking changes and issue refs, summarizes large diffs with chunked map-reduce, generates a prepare-commit-msg hook snippet, validates output against the Conventional Commits spec, history (last 20), shareable URL. 100% client-side, no upload, optional BYO-key LLM.",
  category: "ai",
  keywords: [
    "git commit message generator", "conventional commits", "aicommits alternative",
    "opencommit alternative", "commit message from diff", "gitmoji generator",
    "prepare-commit-msg hook", "private commit generator", "no upload commit message",
    "conventional commit linter", "git commit type classifier",
    "free aicommits", "free opencommit",
  ],
  icon: "git-commit-horizontal",
  requiresNetwork: false,
  seo: {
    title: "AI Git Commit Message Generator — Conventional Commits, Private | UnQTools",
    faq: [
      {
        q: "How does the git commit message generator work?",
        a: "Paste your staged git diff (the output of `git diff --cached`) and the tool parses it into file-level changes — for each file it captures the path, change kind (added / modified / deleted / renamed), language, and the line counts of additions and deletions. It then classifies the overall change type (feat, fix, docs, refactor, test, chore, perf, style, ci, or build) using filename and content heuristics, detects breaking changes (BREAKING CHANGE: markers, !-suffix, or deleted public APIs), extracts issue refs (#123, JIRA-456), and composes a Conventional Commits message with subject, body, and footer in the style you choose.",
      },
      {
        q: "What styles does it support?",
        a: "Four: (1) Conventional Commits subject-only — `feat(parser): add support for nested arrays`. (2) Conventional Commits with body — adds a wrapped paragraph describing what and why. (3) Gitmoji — `✨ feat(parser): add support for nested arrays` with an emoji picked by change type. (4) Plain — a normal imperative sentence without the type/scope prefix. All four also include the optional body, footer (issue refs + breaking change note), and a copy-paste-ready message.",
      },
      {
        q: "How does it handle large diffs?",
        a: "Large diffs (over ~5,000 lines or 50 files) are chunked: each file is summarized to its kind, language, additions/deletions, and a top-line content hint (function names touched, primary keywords). The classifier then operates on the chunk summaries rather than the raw diff — so a 50,000-line refactor still produces a single readable message. The tool flags when it has summarized and reminds you to review the body.",
      },
      {
        q: "What extra features does this tool have compared to other commit generators?",
        a: "(1) Diff parser for unified-diff format (added / modified / deleted / renamed, with hunk counts). (2) Per-file language detection from extension. (3) Change-type classifier (feat / fix / docs / refactor / test / chore / perf / style / ci / build) with filename + content heuristics. (4) Breaking-change detection (BREAKING CHANGE:, ! suffix, deleted public exports). (5) Issue-ref extraction (#123, ABC-123). (6) Four commit styles: conventional, conventional+body, gitmoji, plain. (7) Conventional Commits validator (subject length, type, scope, tense). (8) Large-diff chunked summarization (map-reduce). (9) prepare-commit-msg hook snippet generator. (10) Gitmoji map (12 types). (11) Team convention preset persistence (localStorage). (12) History (localStorage, last 20). (13) Shareable URL with diff encoded (size permitting). (14) Copy / download as .txt and .md. (15) Optional BYO-key LLM polish (OpenAI / Anthropic). (16) Honesty disclaimer (AI infers intent from the diff — review before committing).",
      },
      {
        q: "Is my diff sent anywhere?",
        a: "No. All parsing, classification, and message generation run locally in your browser. Your diff (which often contains proprietary code) never leaves this device — no account, no upload. The only network path is if you explicitly paste your own LLM API key and click 'Polish with LLM' — that request goes directly from your browser to your chosen LLM provider (OpenAI or Anthropic) and never touches UnQTools servers. Skip the LLM step for 100% offline use.",
      },
    ],
  },
  status: "done",
};
