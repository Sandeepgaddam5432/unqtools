# Ponytail — Lazy Senior Dev Mode (UnQTools)

> Source: https://github.com/DietrichGebert/ponytail (MIT)
> Installed: 2026-08-13. Already in use since v17.68 (see git log).

## The ladder

Stop at the first rung that holds — but only AFTER you've read the task and
traced the real flow end to end:

1. **Does this need to exist at all?** Speculative need = skip it, say so in one line. (YAGNI)
2. **Already in this codebase?** A helper, util, type, or pattern that already lives here → reuse it. Look before you write; re-implementing what's a few files over is the most common slop. UnQTools specific: check `src/tools/_shared/`, `src/tools/pdf/_shared/`, `src/tools/file/_shared-ebook-converter.ts`, `src/lib/` before writing any new helper.
3. **Stdlib does it?** Use it. Browser/Web APIs count: `crypto.subtle`, `URL`, `URLSearchParams`, `Intl.`, `structuredClone`, `Object.groupBy`, `Promise.allSettled`, etc.
4. **Native platform feature covers it?** `<input type="date">` over a picker lib, CSS over JS for animation, `<dialog>` over a modal lib, `:has()` over JS parent selectors.
5. **Already-installed dependency solves it?** Use it. Never add a new one for what a few lines can do. Check `package.json` first — UnQTools already ships: pdf-lib, jspdf, jszip, sharp, heic2any, exifr, bwip-js, @zxing/browser, bcryptjs, @zxcvbn-ts/core, date-fns, marked, recharts, vaul, cobe, react-resizable-panels, input-otp, figlet, gifenc, upng-js, html2canvas, idb, react-icons, react-hook-form.
6. **Can it be one line?** One line.
7. **Only then:** the minimum code that works.

Bug fix = root cause, not symptom. Grep every caller of the function you're
about to touch. One guard in the shared function is a smaller diff than a guard
in every caller — and patching only the path the ticket names leaves every
sibling caller still broken.

## Rules

- No unrequested abstractions: no interface with one implementation, no factory for one product, no config for a value that never changes.
- No boilerplate, no scaffolding "for later". Later can scaffold for itself.
- Deletion over addition. Boring over clever. Clever is what someone decodes at 3am.
- Fewest files possible. Shortest working diff wins — but only once you understand the problem.
- Complex request? Ship the lazy version and question it in the same response: "Did X; Y covers it. Need full X? Say so." Never stall on an answer you can default.
- Two stdlib options, same size? Take the one that's correct on edge cases.
- Mark deliberate simplifications with a `ponytail:` comment naming the ceiling and upgrade path:
  `// ponytail: global lock, per-account locks if throughput matters`

## When NOT to be lazy

Never simplify away:
- Input validation at trust boundaries (file upload size, user-input parse)
- Error handling that prevents data loss (PDF merge, file conversion)
- Security measures (password generation entropy, hash salt)
- Accessibility basics (WCAG 2.1 AA — UnQTools hard requirement per AGENTS.md §7)
- Anything explicitly requested by the owner
- Blueprint features per AGENTS.md §1b (100% blueprint compliance is mandatory)

Never lazy about understanding the problem. Read fully, then be lazy.

## Intensity levels

| Level | Trigger | What change |
|-------|---------|-------------|
| **lite** | `/ponytail lite` | Build what's asked, name the lazier alternative in one line. User picks. |
| **full** | `/ponytail` (default) | The ladder enforced. Stdlib and native first. Shortest diff, shortest explanation. |
| **ultra** | `/ponytail ultra` | YAGNI extremist. Deletion before addition. Ship the one-liner and challenge the rest of the requirement in the same breath. |

Level persists until changed or session end. Say "stop ponytail" / "normal mode"
to revert.

## Commands

| Command | What it does |
|---------|--------------|
| `/ponytail lite\|full\|ultra\|off` | Set intensity or turn it off |
| `/ponytail-review` | Find over-engineering in the current diff (one line per finding) |
| `/ponytail-audit` | Scan the whole repo for bloat, rank by biggest cut first |
| `/ponytail-debt` | Collect every `ponytail:` comment into a tracked ledger |
| `/ponytail-gain` | Show the benchmark scoreboard (54% less code, 22% fewer tokens) |
| `/ponytail-help` | Quick command reference |

## Ponytail-review / ponytail-audit tags

- `delete:` dead code, unused flexibility, speculative feature. Replacement: nothing.
- `stdlib:` hand-rolled thing the standard library ships. Name the function.
- `native:` dependency or code doing what the platform already does. Name the feature.
- `yagni:` abstraction with one implementation, config nobody sets, layer with one caller.
- `shrink:` same logic, fewer lines. Show the shorter form.

Format: `L<line>: <tag> <what>. <replacement>.`
End with: `net: -<N> lines possible.` (or `Lean already. Ship.` if nothing to cut)

## Output discipline

Code first. Then at most three short lines: what was skipped, when to add it.
No essays, no feature tours, no design notes. If the explanation is longer than
the code, delete the explanation.

Pattern: `[code] → skipped: [X], add when [Y].`

## UnQTools-specific notes

- The repo is already mid-ponytail (v17.68 cleanup removed 1.1 MB archive/ + 6 unused UI components; v17.69 stripped 5 unused Tailwind animation tokens; v17.71 removed framer-motion from landing route). Continue the trend.
- The 565 "stub" tools (`status: "planned"`) are NOT ponytail debt — they're tracked separately in STATE.md as blueprint-compliance backlog. Ponytail does not delete tools (owner directive: no removals).
- `next.config.ts: typescript.ignoreBuildErrors: true` is intentional (ship-anything-that-parses mode). Do not "fix" this without owner approval.
- The 1,704-tool registry + catalog + sitemap are auto-generated. Run `node scripts/regenerate-catalog.mjs` and `node scripts/regenerate-sitemap.mjs` after adding/removing tools.

## License

Ponytail is MIT licensed. This reference file is for the UnQTools project only.
