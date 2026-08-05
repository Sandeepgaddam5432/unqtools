# UnQTools - God-Level Upgrade Programme

_Owner directive, 2026-08-05: every tool in the catalog must be upgraded to "god level"._

This document defines what god level means, why the current per-tool grind
cannot reach it, and the plan that can. It is a planning document, not a
status report. `STATE.md` remains the resume point.

---

## 1. Ground truth

Measured against `main` at `a18c1e5` (PR #5, 2026-08-03).

| Fact | Detail |
|---|---|
| Version | `17.63.0` |
| Categories | 13 |
| Claimed catalog | ~1,700 tools |
| Explicitly marked Coming Soon | 565 tools carry `status: "planned"` |
| Generic template tools | 555 shipped in v17.56-v17.61; only 30 rebuilt in v17.63 |
| Tools with a real "100x" pass | roughly 60, from the numbered batches #1-#60 |
| Registry | `src/lib/registry.ts` is a single 202 KB explicit-import file |
| Build | `next build` OOMs on a 4 GB sandbox; only the 7 GB Cloudflare runner completes |
| Duplicate ids | Widespread. The PDF category alone contains dozens of `x` / `x-tool` pairs plus semantic repeats |

### 1.1 The duplicate problem

A sample from `src/tools/pdf/` shows the same job shipped under many ids:

- merge: `merge-pdf`, `pdf-merge`, `pdf-merge-combine-multiple`, `pdf-merge-combine-multiple-tool`
- split: `split-pdf`, `pdf-split`, `pdf-split-advanced`, `pdf-split-advanced-tool`
- crop: `crop-pdf`, `pdf-crop`, `pdf-crop-to-content`, `pdf-crop-content-autotrim`
- compress: `compress-pdf`, `pdf-compress`, `pdf-compress-target`, `pdf-compress-target-size`, `pdf-size-optimizer`
- chat: `pdf-chat`, `pdf-chat-qa`, `pdf-ai-chat`, `pdf-ai-chat-qa`, `ai-chat-with-pdf`

Every duplicate multiplies the upgrade cost, splits SEO authority across
competing URLs, inflates the bundle, and is a direct cause of the build OOM.
**Deduplication is not cleanup - it is the single highest-leverage step in
this programme.**

### 1.2 Why we measure before we build

The numbers above are self-reported in `STATE.md`, and GitHub code search is
not indexed for this repo. `scripts/audit-tools.mjs` replaces claims with
measurement: it scans every tool folder and writes `docs/TOOL-AUDIT.json`
plus `docs/TOOL-AUDIT.md`. Run it first, every time.

```bash
node scripts/audit-tools.mjs
```

---

## 2. The definition of god level

A tool is god level only when **all twelve gates** pass. Nine out of twelve is
not god level; it is a tool with a to-do list.

| # | Gate | Pass condition |
|---|---|---|
| G1 | Real engine | `logic.ts` implements the actual domain algorithm. No generic `process`/`validate` stub wrappers, no `Math.random` stand-ins, 150+ lines of real logic |
| G2 | Blueprint 100% | Every feature in blueprint sections 5, 7 and 10 is implemented, or omitted with a documented reason in the FAQ |
| G3 | Ten extras | 10+ genuinely useful features beyond the blueprint, listed in `manifest.seo.faq`. UI polish and baseline a11y do not count |
| G4 | Proof | 15+ unit tests covering valid, invalid, edge and large input; 90%+ logic coverage; property tests wherever the domain allows |
| G5 | Kernel wired | History, presets, batch mode, URL state, shortcuts, multi-format export, validation report, reproducibility receipt and references all come from `src/lib/god/`, not hand-rolled per tool |
| G6 | Accessible | axe reports 0 serious and 0 critical in light and dark, full keyboard operation, live regions on async results, 44x44 px targets |
| G7 | Fast | Tool island 50 KB gzipped or less, work over 16 ms runs in a Worker, CLS under 0.1, heavy libraries lazy-loaded |
| G8 | Responsive | 320 px to 4K with zero horizontal scroll |
| G9 | Honest | Privacy note, offline guarantee, explicit disclaimer on anything approximate. No invented statistics, no fake testimonials, no claiming a feature the tool does not have |
| G10 | Findable | Unique title and description, 5+ FAQ entries, FAQPage and SoftwareApplication structured data, links to 5 related tools |
| G11 | Safe | Never throws to the user, friendly `ErrorBanner`, input size guardrails with a warning before heavy work |
| G12 | Singular | Exactly one canonical id per job. Any sibling id is deleted and redirected |

---

## 3. Strategy: build a kernel, do not grind

### 3.1 The arithmetic that forces this

The numbered batches upgraded about 10 tools per session. At that rate a
1,700 tool catalog needs roughly 170 sessions, and every session re-implements
the same history, export and receipt code by hand. That path does not finish.

The fix is to move the repeated 80% of god level out of the tools and into
shared infrastructure, so a tool only has to supply its domain logic.

### 3.2 `src/lib/god/` - the kernel

Build once, inherit everywhere.

| Module | Responsibility |
|---|---|
| `history.ts` | Last N runs per tool in IndexedDB, restore, clear, opt-out for sensitive tools |
| `presets.ts` | Named presets, import and export as JSON, per-tool defaults |
| `batch.ts` | Run one tool over many inputs or files, progress, partial failure, ZIP result |
| `url-state.ts` | Encode and restore tool state in the URL, with a sensitive-tool blocklist |
| `shortcuts.ts` | Standard keymap across the whole catalog, with a discoverable help sheet |
| `export.ts` | One output, many formats: TXT, JSON, CSV, Markdown, clipboard, file |
| `validate.ts` | Uniform validation report shape - errors, warnings, hints |
| `receipt.ts` | Reproducibility receipt: inputs, options, versions, timestamp |
| `references.ts` | Typed citation list rendered under every tool |
| `worker.ts` | Generic "run this pure function off the main thread" harness |
| `seo.ts` | FAQPage and SoftwareApplication structured data from the manifest |
| `related.ts` | Related-tool selection from registry keywords |
| `sensitive.ts` | F075 policy: no history, no drafts, no URL state, clipboard auto-clear |

With the kernel in place, G3, G5, G9, G10 and G11 are satisfied by wiring
rather than by writing, for every tool at once.

### 3.3 Archetype engines

Most of the catalog is eight shapes wearing different labels:

`converter` · `calculator` · `formatter` · `generator` · `validator` ·
`encoder` · `transformer` · `editor`

Each archetype gets one tested engine plus a declarative descriptor per tool.
Property-based tests run at engine level, so every tool built on an engine
inherits real proof instead of 15 shallow assertions.

---

## 4. Phases

### Phase 0 - Measure

- Run `scripts/audit-tools.mjs`, commit `docs/TOOL-AUDIT.md` and `.json`.
- Exit criteria: we know the real tool count, the real stub count, and the
  full duplicate list.

### Phase 1 - Dedupe and de-mock

- Pick one canonical id per duplicate group; delete the rest.
- Add 301 redirects in `public/_redirects` so no URL 404s.
- Decide the fate of the template stubs: rebuild, or remove from the registry
  until rebuilt. A Coming Soon badge on a page that already ships broken
  output fails G9.
- Exit criteria: registry contains only distinct, honest jobs; `next build`
  completes inside 4 GB again.

### Phase 2 - Kernel

- Build `src/lib/god/`, with its own unit tests, before touching any tool.
- Migrate three reference tools end to end: `json-formatter`, `emi-calculator`,
  `merge-pdf`. These become the copy-paste templates.
- Exit criteria: three tools score 90+ in the audit purely through kernel
  wiring plus domain work.

### Phase 3 - Archetype migration

- Implement the eight engines, each with property-based tests.
- Convert the largest archetype families first.
- Exit criteria: 60%+ of surviving tools are engine-backed.

### Phase 4 - Category sweeps

- One category per sweep, worst score first, in batches of 20-30 tools.
- Recommended order by traffic value and duplicate density:
  `pdf` → `developer` → `image` → `calculators` → `text` → `seo` →
  `network-security` → `file` → `business` → `education` → `social` →
  `audio-video` → `ai`.
- Exit criteria per sweep: every tool in the category scores 90+, CI green.

### Phase 5 - Keep it god level

- Add an `audit` job to CI that runs the scanner and fails the build if any
  registered tool drops below the score floor, or if a new duplicate key or
  template stub appears.
- Exit criteria: regression is impossible without a red build.

---

## 5. Rules for every batch

1. Branch per batch. Never commit directly to `main`.
2. `main` stays deployable. No merge with a red must-pass job.
3. Never weaken or delete a test to make a batch pass.
4. Re-run `scripts/audit-tools.mjs` at the end of every batch and commit the
   refreshed report - the score is the receipt.
5. Commit and push every 20-30 minutes. The sandbox is ephemeral.
6. Update `STATE.md` before the session ends.
7. Extract Framer Motion prop objects to named module-level constants. Pushing
   inline motion props through the GitHub MCP API corrupts them.
8. `.github/workflows/**` cannot be written through the GitHub integration.
   Workflow changes need the web UI or a local push.

---

## 6. Definition of done for a batch

- [ ] Every tool in the batch scores 90+ in `docs/TOOL-AUDIT.json`
- [ ] Lint clean, unit tests green, build green
- [ ] Smoke, tool, CLS and axe e2e green in light and dark
- [ ] No new duplicate keys, no new template stubs
- [ ] `STATE.md` and `docs/TOOL-AUDIT.md` refreshed and committed
- [ ] Commit message lists the 10 extras shipped per tool

---

## 7. Open decisions for the owner

1. **Stub policy.** Rebuild the ~525 remaining template tools, or delete them
   from the registry until they are real? Deleting is faster, honest, and
   fixes the build OOM. Rebuilding preserves the headline tool count.
2. **Catalog target.** Is 1,700 still the goal, or is "800 tools that are all
   god level" the better product? Deduplication may answer this by itself.
3. **Duplicate winners.** For each duplicate group, does the shorter id win
   (`merge-pdf`) or the descriptive one (`pdf-merge-combine-multiple`)?
   Recommendation: shortest id that reads naturally, redirect the rest.
4. **Registry split.** 202 KB of explicit imports in one file is a build-memory
   liability. Split per category behind lazy loaders?
