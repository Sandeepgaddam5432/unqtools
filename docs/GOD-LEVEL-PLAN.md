# UnQTools - God-Level Upgrade Plan

> Goal: every one of the 1700 tools becomes genuinely best-in-class, without
> removing a single tool.
>
> Branch: `arena/019fd1ad-unqtools` (from `1bdb395`)
> Written: 2026-08-05

---

## 0. Owner constraints (non-negotiable)

1. **No tool removals.** All 1700 tools stay. Every URL stays. This is settled -
   the v17.65 removal commits were already reverted.
2. **100% static / client-side.** No backend, no database, no server round-trip.
3. **No weakening tests** to make CI pass. No merging to `main` with red CI.
4. **Minimal-change discipline** (ponytail): do not rewrite what already works.
5. Build verification happens on Cloudflare's runner - the local sandbox
   (3.8 GB / 2 cores) cannot finish `next build`.

---

## 1. Where we actually are

| Fact | Value |
|------|-------|
| Tools in catalog | 1700 across 13 categories |
| Marked `status: "planned"` (Coming Soon) | 565 |
| Built on generic template logic in v17.56-v17.61 | 555 |
| Of those, rebuilt properly in v17.63 | 30 |
| Tools that received the "100x" pass (batches 1-60) | ~60 |
| `src/lib/registry.ts` | 202 KB |
| `src/lib/catalog.ts` | 765 KB (generated) |
| Source files parsed by the last quality check | 6812 |

So roughly **60 tools are genuinely deep**, ~500+ are template shells wearing a
Coming Soon badge, and the rest sit somewhere in between. Nobody has an exact
number - which is why `scripts/audit-tools.mjs` exists.

---

## 2. What "god level" means (the gates)

A tool is god level only when **all eleven** gates pass. The auditor scores
each gate; 100/100 = god level.

| # | Gate | Bar | Points |
|---|------|-----|--------|
| G1 | **Real engine** | `logic.ts` >= 150 LOC of actual computation, no template stub signature, no mock markers | 25 |
| G2 | **Real UI** | `ui.tsx` >= 120 LOC, full states: empty, loading, success, error | 10 |
| G3 | **Depth beyond the basics** | >= 10 exported capabilities, plus REFERENCES, a validation report and a reproducibility receipt | 25 |
| G4 | **Proven** | >= 15 tests in `logic.test.ts`, covering edge cases and malformed input | 20 |
| G5 | **Honest** | not `status: "planned"`; never claims work it did not do | 10 |
| G6 | **Discoverable** | >= 3 `seo.faq` entries, schema.org markup, related-tool links | 5 |
| G7 | **Accessible** | axe: 0 serious violations, light and dark, keyboard reachable | gate |
| G8 | **Fast** | island <= 50 KB gz, heavy work in a Worker, CLS < 0.1 | gate |
| G9 | **Responsive** | 320px to 4K, zero horizontal overflow | gate |
| G10 | **Private** | everything client-side, stated plainly in the UI | gate |
| G11 | **Unbreakable** | never throws at the user; every failure is a readable message | gate |

G7-G11 are enforced by the existing Playwright suites (`axe.e2e.ts`,
`overflow.e2e.ts`, `cls.e2e.ts`), not by the static auditor.

---

## 3. Why the current approach cannot finish

Batches 1-60 upgraded about **10 tools per session**. At that rate 1700 tools
needs **~170 sessions**. And each session hand-writes the same history panel,
the same export menu, the same receipt builder, the same references block.

The work is not 1700 tools. The work is **~8 patterns x 1700 skins**.

---

## 4. The strategy: canonical engines + variant wrappers + one kernel

Three layers. Write each thing once.

### Layer 1 - `src/lib/god/` (the kernel)

Everything every tool repeats, implemented once, tested once:

- `history.ts` - IndexedDB recent-runs, restore, clear
- `presets.ts` - save / load / share named presets
- `batch.ts` - run any engine over N inputs with progress
- `urlState.ts` - encode inputs into the URL for shareable results
- `shortcuts.ts` - consistent keyboard map across all tools
- `exporters.ts` - JSON / CSV / TXT / clipboard / file download
- `report.ts` - the standard validation report shape
- `receipt.ts` - the reproducibility receipt (inputs, options, version, hash)
- `references.ts` - typed REFERENCES block that renders as citations
- `seo.ts` - FAQ + schema.org + related-tools generator
- `a11y.tsx` - the accessible tool shell (labels, live regions, focus)
- `worker.ts` - offload helper so heavy engines never block the main thread
- `errors.ts` - error boundary + human-readable failure messages
- `agent.ts` - **machine-readable JSON output**, so an LLM agent can drive any
  tool (this continues the AI-agent-first direction already logged in PROGRESS)

One kernel upgrade lifts all 1700 tools at once. That is the whole point.

### Layer 2 - archetype engines

Almost every tool is one of eight shapes:

`converter` - `calculator` - `formatter` - `generator` - `validator` -
`encoder` - `transformer` - `editor`

Each archetype gets one hardened base engine + one base UI. A tool then
declares its archetype and supplies only its domain logic.

### Layer 3 - canonical engine, many faces (this is how we keep all 1700)

The audit will show clusters like:

```
merge-pdf, pdf-merge, pdf-merge-tool, pdf-merge-combine-multiple, ...
```

We do **not** delete any of them. Instead:

1. Pick the highest-scoring member as the **canonical** tool and make its
   engine god level.
2. Every sibling keeps its id, route, name, description, FAQ and SEO angle -
   but its `logic.ts` becomes a wrapper:

```ts
// src/tools/pdf/pdf-merge-tool/logic.ts
export * from "@/tools/pdf/merge-pdf/logic"
```

3. Each sibling ships **different defaults / presets / copy**, so it is a
   genuinely useful variant rather than a clone.

Result: 1700 tools stay live, 1700 URLs keep ranking, but there are only a few
hundred engines to actually perfect. Bundle size drops too, because the shared
engine is one chunk instead of N copies.

---

## 5. Phases

| Phase | What | Exit criteria |
|-------|------|---------------|
| **P0 Measure** | Run `node scripts/audit-tools.mjs`, commit `docs/TOOL-AUDIT.*` | Real numbers replace every estimate in this doc |
| **P1 Kernel** | Build `src/lib/god/`, full unit tests, zero tool changes | Kernel at 100% coverage, CI green |
| **P2 Canonicalise** | For the top duplicate clusters: pick canonical, wrapper the siblings, differentiate presets/copy | Tool count still 1700; no route lost; bundle smaller |
| **P3 Archetypes** | Build the 8 archetype engines on top of the kernel | Each archetype proven on 3 pilot tools |
| **P4 De-mock** | Migrate the 565 Coming Soon tools onto real archetype engines, batch by batch | `status: "planned"` count reaches 0 |
| **P5 Sweep** | Category by category to 90+ average score | Every category avg >= 90 in the audit |
| **P6 Gate** | Add the auditor to CI as a ratchet: score can never drop | New tools cannot land below the bar |

Start with the **worst-average category** from the P0 scoreboard, not the
biggest one.

---

## 6. Definition of done, per batch

A batch (20-30 tools) may only be committed when:

- [ ] every tool in the batch scores >= 90 in the auditor
- [ ] `npm run lint` clean
- [ ] `npm test` green, no test weakened or skipped
- [ ] `npm run e2e:axe`, `e2e:overflow`, `e2e:cls` green for the batch routes
- [ ] tool count unchanged (1700) and no route removed
- [ ] `docs/PROGRESS.md` + `STATE.md` updated in the same commit
- [ ] Cloudflare build green before anything reaches `main`

---

## 7. Open decisions for the owner

1. **Coming Soon copy** - while the 565 are being rebuilt, keep the badge as-is,
   or replace it with a working basic version plus an "advanced coming soon"
   note?
2. **Variant differentiation** - how different should sibling tools be? Same
   engine with different presets, or also different UI layout?
3. **Batch size** - 20-30 tools per session, or larger batches with a longer
   review?
4. **Order** - worst category first (fastest score gain) or highest-traffic
   category first (fastest revenue impact)?
