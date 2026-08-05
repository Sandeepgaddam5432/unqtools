#!/usr/bin/env node
/**
 * UnQTools - Tool Audit Scanner
 *
 * Walks every tool folder under src/tools/<category>/<id>/ and produces an
 * objective, machine-readable picture of the catalog:
 *
 *   docs/TOOL-AUDIT.json  - full per-tool records
 *   docs/TOOL-AUDIT.md    - human summary + worst-offender tables
 *
 * Why: STATE.md tool counts are self-reported, GitHub code search is not
 * indexed for this private repo, and the catalog contains a large number of
 * generic-template tools and duplicate ids. Before any "god level" upgrade
 * programme can be planned, we need measured numbers, not claimed ones.
 *
 * Zero dependencies. Run from the repo root:
 *
 *   node scripts/audit-tools.mjs
 *
 * Exit code is always 0 - this is a reporting tool, not a gate. A separate
 * CI gate can later read docs/TOOL-AUDIT.json and fail on regressions.
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const TOOLS_DIR = join(ROOT, "src", "tools");
const OUT_DIR = join(ROOT, "docs");

/** Folders inside a category that are not tools. */
const SKIP_DIRS = new Set(["_shared", "__tests__", "__snapshots__"]);

/** Tokens that carry no meaning when comparing two tool ids. */
const NOISE_TOKENS = new Set([
  "tool",
  "tools",
  "online",
  "free",
  "app",
  "utility",
  "web",
]);

/**
 * The generic stub template shipped in v17.56-v17.61 always exports these
 * four wrappers. On a real tool they are harmless; combined with a thin
 * logic file they are the fingerprint of a mock.
 */
const STUB_EXPORT_SIGNATURES = [
  "export function process",
  "export function validate",
  "export function formatBytes",
  "export function getStats",
];

/** Strings that mean "this tool does not really do the job". */
const MOCK_MARKERS = [
  "not implemented",
  "todo: implement",
  "placeholder implementation",
  "mock data",
  "mock output",
  "fake output",
  "sample output only",
  "coming soon",
];

/** Minimum bars from AGENTS.md section 1b. */
const MIN_LOGIC_LINES = 150;
const MIN_UI_LINES = 120;
const MIN_TESTS = 15;
const NEAR_DUPLICATE_THRESHOLD = 0.6;

// --------------------------------------------------------------- utilities

function safeRead(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function listDirs(path) {
  try {
    const entries = readdirSync(path, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/** Non-blank, non-comment lines. Comments should not count as substance. */
function codeLines(src) {
  if (!src) {
    return 0;
  }
  let inBlockComment = false;
  let total = 0;
  for (const raw of src.split("\n")) {
    const line = raw.trim();
    if (!line) {
      continue;
    }
    if (inBlockComment) {
      if (line.includes("*/")) {
        inBlockComment = false;
      }
      continue;
    }
    if (line.startsWith("/*")) {
      if (!line.includes("*/")) {
        inBlockComment = true;
      }
      continue;
    }
    if (line.startsWith("//") || line.startsWith("*")) {
      continue;
    }
    total += 1;
  }
  return total;
}

function countMatches(src, pattern) {
  if (!src) {
    return 0;
  }
  const found = src.match(pattern);
  return found ? found.length : 0;
}

function readManifestField(src, key) {
  if (!src) {
    return null;
  }
  const pattern = new RegExp(key + '\\s*:\\s*["\'`]([^"\'`]*)["\'`]');
  const found = src.match(pattern);
  return found ? found[1] : null;
}

function tokensOf(id) {
  return id
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((token) => !NOISE_TOKENS.has(token));
}

/**
 * Order-insensitive, noise-stripped key. Collapses pdf-merge, merge-pdf and
 * pdf-merge-tool onto the same key so exact duplicates surface.
 */
function canonicalKey(id) {
  return Array.from(new Set(tokensOf(id))).sort().join("-");
}

function jaccard(listA, listB) {
  const setA = new Set(listA);
  const setB = new Set(listB);
  let shared = 0;
  for (const value of setA) {
    if (setB.has(value)) {
      shared += 1;
    }
  }
  const union = setA.size + setB.size - shared;
  return union === 0 ? 0 : shared / union;
}

// ------------------------------------------------------------- per-tool scan

function scanTool(category, id) {
  const dir = join(TOOLS_DIR, category, id);
  const manifestSrc = safeRead(join(dir, "manifest.ts"));
  const logicSrc = safeRead(join(dir, "logic.ts"));
  const testSrc = safeRead(join(dir, "logic.test.ts"));
  const uiSrc = safeRead(join(dir, "ui.tsx"));
  const hasWorker = existsSync(join(dir, "worker.ts"));

  const logicLines = codeLines(logicSrc);
  const uiLines = codeLines(uiSrc);
  const testCount = countMatches(testSrc, /\b(it|test)\s*\(/g);
  const exportCount = countMatches(logicSrc, /^export\s+(const|function|class|type|interface)\s/gm);

  const lowerLogic = (logicSrc || "").toLowerCase();
  const stubHits = STUB_EXPORT_SIGNATURES.filter((sig) => (logicSrc || "").includes(sig)).length;
  const mockHits = MOCK_MARKERS.filter((marker) => lowerLogic.includes(marker));

  const looksLikeStub = stubHits >= 3 && logicLines < MIN_LOGIC_LINES;
  const declaredStatus = readManifestField(manifestSrc, "status") || "unset";

  return {
    id,
    category,
    path: "src/tools/" + category + "/" + id,
    name: readManifestField(manifestSrc, "name"),
    declaredStatus,
    files: {
      manifest: manifestSrc !== null,
      logic: logicSrc !== null,
      test: testSrc !== null,
      ui: uiSrc !== null,
      worker: hasWorker,
    },
    logicLines,
    uiLines,
    testCount,
    exportCount,
    faqCount: countMatches(manifestSrc, /\bq\s*:\s*["'`]/g),
    hasReferences: /\bREFERENCES\b/.test(logicSrc || ""),
    hasReceipt: /buildReceipt|reproducibilityReceipt/.test(logicSrc || ""),
    hasValidationReport: /validationReport|buildValidationReport/.test(logicSrc || ""),
    looksLikeStub,
    stubHits,
    mockMarkers: mockHits,
    canonicalKey: canonicalKey(id),
    tokens: tokensOf(id),
  };
}

// ----------------------------------------------------------------- scoring

/**
 * The 12 God-Level gates, scored 0-100. See docs/GOD-LEVEL-PLAN.md section 2.
 * Only the gates a static scan can honestly judge are scored here; a11y,
 * performance and responsiveness are proven by the e2e suites instead.
 */
function scoreTool(tool, duplicateGroupSize) {
  const parts = [];
  let score = 0;

  function award(points, label) {
    score += points;
    if (points > 0) {
      parts.push(label);
    }
  }

  award(tool.looksLikeStub ? 0 : 20, "real engine (not a template stub)");
  award(tool.mockMarkers.length === 0 ? 10 : 0, "no mock markers");
  award(Math.min(15, Math.round((tool.logicLines / MIN_LOGIC_LINES) * 15)), "logic depth");
  award(Math.min(20, Math.round((tool.testCount / MIN_TESTS) * 20)), "test depth");
  award(Math.min(10, Math.round((tool.uiLines / MIN_UI_LINES) * 10)), "ui depth");
  award(tool.exportCount >= 10 ? 5 : 0, "rich public surface");
  award(tool.hasValidationReport ? 4 : 0, "validation report");
  award(tool.hasReceipt ? 3 : 0, "reproducibility receipt");
  award(tool.hasReferences ? 3 : 0, "references");
  award(tool.faqCount >= 5 ? 5 : 0, "seo faq");
  award(duplicateGroupSize <= 1 ? 5 : 0, "unique id");

  return {
    score: Math.max(0, Math.min(100, score)),
    credit: parts,
  };
}

function tier(score) {
  if (score >= 90) {
    return "god";
  }
  if (score >= 70) {
    return "strong";
  }
  if (score >= 45) {
    return "thin";
  }
  return "mock";
}

// -------------------------------------------------------------------- main

function main() {
  if (!existsSync(TOOLS_DIR)) {
    console.error("src/tools not found - run this from the repo root.");
    return;
  }

  const categories = listDirs(TOOLS_DIR).filter((name) => !SKIP_DIRS.has(name));
  const tools = [];

  for (const category of categories) {
    for (const id of listDirs(join(TOOLS_DIR, category))) {
      if (SKIP_DIRS.has(id)) {
        continue;
      }
      tools.push(scanTool(category, id));
    }
  }

  // Exact duplicate groups by canonical key.
  const byKey = new Map();
  for (const tool of tools) {
    const bucket = byKey.get(tool.canonicalKey) || [];
    bucket.push(tool.id);
    byKey.set(tool.canonicalKey, bucket);
  }
  const exactDuplicateGroups = Array.from(byKey.entries())
    .filter((entry) => entry[1].length > 1)
    .map((entry) => ({ key: entry[0], ids: entry[1].sort() }))
    .sort((a, b) => b.ids.length - a.ids.length);

  // Near duplicates within a category.
  const nearDuplicatePairs = [];
  for (const category of categories) {
    const inCategory = tools.filter((tool) => tool.category === category);
    for (let i = 0; i < inCategory.length; i += 1) {
      for (let j = i + 1; j < inCategory.length; j += 1) {
        const a = inCategory[i];
        const b = inCategory[j];
        if (a.canonicalKey === b.canonicalKey) {
          continue;
        }
        const similarity = jaccard(a.tokens, b.tokens);
        if (similarity >= NEAR_DUPLICATE_THRESHOLD) {
          nearDuplicatePairs.push({
            category,
            a: a.id,
            b: b.id,
            similarity: Number(similarity.toFixed(2)),
          });
        }
      }
    }
  }
  nearDuplicatePairs.sort((x, y) => y.similarity - x.similarity);

  // Score everything.
  for (const tool of tools) {
    const groupSize = (byKey.get(tool.canonicalKey) || []).length;
    const scored = scoreTool(tool, groupSize);
    tool.duplicateGroupSize = groupSize;
    tool.score = scored.score;
    tool.credit = scored.credit;
    tool.tier = tier(scored.score);
  }

  tools.sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));

  const tierCounts = { god: 0, strong: 0, thin: 0, mock: 0 };
  for (const tool of tools) {
    tierCounts[tool.tier] += 1;
  }

  const perCategory = categories.map((category) => {
    const inCategory = tools.filter((tool) => tool.category === category);
    const totalScore = inCategory.reduce((sum, tool) => sum + tool.score, 0);
    return {
      category,
      count: inCategory.length,
      averageScore: inCategory.length ? Math.round(totalScore / inCategory.length) : 0,
      god: inCategory.filter((tool) => tool.tier === "god").length,
      strong: inCategory.filter((tool) => tool.tier === "strong").length,
      thin: inCategory.filter((tool) => tool.tier === "thin").length,
      mock: inCategory.filter((tool) => tool.tier === "mock").length,
      planned: inCategory.filter((tool) => tool.declaredStatus === "planned").length,
    };
  });
  perCategory.sort((a, b) => b.count - a.count);

  const duplicateIdCount = exactDuplicateGroups.reduce((sum, group) => sum + group.ids.length, 0);
  const redundantIdCount = exactDuplicateGroups.reduce((sum, group) => sum + group.ids.length - 1, 0);

  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      categories: categories.length,
      tools: tools.length,
      declaredPlanned: tools.filter((tool) => tool.declaredStatus === "planned").length,
      declaredDone: tools.filter((tool) => tool.declaredStatus === "done").length,
      looksLikeStub: tools.filter((tool) => tool.looksLikeStub).length,
      withMockMarkers: tools.filter((tool) => tool.mockMarkers.length > 0).length,
      missingTests: tools.filter((tool) => tool.testCount === 0).length,
      belowTestBar: tools.filter((tool) => tool.testCount < MIN_TESTS).length,
      belowLogicBar: tools.filter((tool) => tool.logicLines < MIN_LOGIC_LINES).length,
      belowUiBar: tools.filter((tool) => tool.uiLines < MIN_UI_LINES).length,
      idsInDuplicateGroups: duplicateIdCount,
      redundantIds: redundantIdCount,
      uniqueJobs: tools.length - redundantIdCount,
    },
    tierCounts,
    perCategory,
    exactDuplicateGroups,
    nearDuplicatePairs: nearDuplicatePairs.slice(0, 300),
    tools,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "TOOL-AUDIT.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  writeFileSync(join(OUT_DIR, "TOOL-AUDIT.md"), renderMarkdown(report), "utf8");

  console.log("Tools scanned:        " + report.totals.tools);
  console.log("Unique jobs:          " + report.totals.uniqueJobs);
  console.log("Redundant duplicate:  " + report.totals.redundantIds);
  console.log("Template stubs:       " + report.totals.looksLikeStub);
  console.log("Declared planned:     " + report.totals.declaredPlanned);
  console.log("Below 15-test bar:    " + report.totals.belowTestBar);
  console.log("Tiers:                god " + tierCounts.god + " / strong " + tierCounts.strong + " / thin " + tierCounts.thin + " / mock " + tierCounts.mock);
  console.log("Wrote docs/TOOL-AUDIT.json and docs/TOOL-AUDIT.md");
}

// ------------------------------------------------------------ markdown view

function renderMarkdown(report) {
  const out = [];
  const t = report.totals;

  out.push("# UnQTools - Tool Audit");
  out.push("");
  out.push("_Generated by `scripts/audit-tools.mjs` on " + report.generatedAt + ". Do not edit by hand._");
  out.push("");
  out.push("## Headline numbers");
  out.push("");
  out.push("| Metric | Value |");
  out.push("|---|---|");
  out.push("| Categories | " + report.totals.categories + " |");
  out.push("| Tool folders | " + t.tools + " |");
  out.push("| Distinct jobs after dedupe | " + t.uniqueJobs + " |");
  out.push("| Redundant duplicate ids | " + t.redundantIds + " |");
  out.push("| Declared `status: planned` | " + t.declaredPlanned + " |");
  out.push("| Declared `status: done` | " + t.declaredDone + " |");
  out.push("| Generic template stubs | " + t.looksLikeStub + " |");
  out.push("| Contains mock markers | " + t.withMockMarkers + " |");
  out.push("| Zero unit tests | " + t.missingTests + " |");
  out.push("| Below 15-test bar | " + t.belowTestBar + " |");
  out.push("| Below 150-line logic bar | " + t.belowLogicBar + " |");
  out.push("| Below 120-line ui bar | " + t.belowUiBar + " |");
  out.push("");
  out.push("## Tiers");
  out.push("");
  out.push("| Tier | Score | Count |");
  out.push("|---|---|---|");
  out.push("| god | 90-100 | " + report.tierCounts.god + " |");
  out.push("| strong | 70-89 | " + report.tierCounts.strong + " |");
  out.push("| thin | 45-69 | " + report.tierCounts.thin + " |");
  out.push("| mock | 0-44 | " + report.tierCounts.mock + " |");
  out.push("");
  out.push("## By category");
  out.push("");
  out.push("| Category | Tools | Avg score | god | strong | thin | mock | planned |");
  out.push("|---|---|---|---|---|---|---|---|");
  for (const row of report.perCategory) {
    out.push(
      "| " +
        [row.category, row.count, row.averageScore, row.god, row.strong, row.thin, row.mock, row.planned].join(" | ") +
        " |",
    );
  }
  out.push("");
  out.push("## Exact duplicate groups");
  out.push("");
  out.push("Ids that collapse to the same noise-stripped token key. Each group needs one");
  out.push("canonical winner; the rest should be deleted with a redirect.");
  out.push("");
  if (report.exactDuplicateGroups.length === 0) {
    out.push("None.");
  } else {
    out.push("| Key | Ids |");
    out.push("|---|---|");
    for (const group of report.exactDuplicateGroups) {
      out.push("| `" + group.key + "` | " + group.ids.map((id) => "`" + id + "`").join(", ") + " |");
    }
  }
  out.push("");
  out.push("## Near duplicates");
  out.push("");
  out.push("Token similarity at or above " + NEAR_DUPLICATE_THRESHOLD + " inside the same category. Review by hand:");
  out.push("some are real siblings, some are accidental re-builds of the same job.");
  out.push("");
  if (report.nearDuplicatePairs.length === 0) {
    out.push("None.");
  } else {
    out.push("| Category | A | B | Similarity |");
    out.push("|---|---|---|---|");
    for (const pair of report.nearDuplicatePairs) {
      out.push("| " + pair.category + " | `" + pair.a + "` | `" + pair.b + "` | " + pair.similarity + " |");
    }
  }
  out.push("");
  out.push("## Worst 100 tools");
  out.push("");
  out.push("Upgrade queue, worst first.");
  out.push("");
  out.push("| Score | Tier | Category | Id | Logic | Tests | UI | Status |");
  out.push("|---|---|---|---|---|---|---|---|");
  for (const tool of report.tools.slice(0, 100)) {
    out.push(
      "| " +
        [tool.score, tool.tier, tool.category, "`" + tool.id + "`", tool.logicLines, tool.testCount, tool.uiLines, tool.declaredStatus].join(
          " | ",
        ) +
        " |",
    );
  }
  out.push("");
  return out.join("\n");
}

main();
