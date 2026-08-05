#!/usr/bin/env node
/**
 * UnQTools - God-Level Tool Auditor
 *
 * Dependency-free. Run from the repo root:
 *   node scripts/audit-tools.mjs
 *
 * Walks src/tools/<category>/<tool-id>/ and scores every tool 0-100 against
 * the god-level gates described in docs/GOD-LEVEL-PLAN.md, then writes:
 *   docs/TOOL-AUDIT.json - machine readable, one record per tool
 *   docs/TOOL-AUDIT.md   - human readable summary + prioritised worklist
 *
 * READ-ONLY over src/. Nothing outside docs/ is ever written.
 * This script never proposes deleting a tool: duplicate clusters exist so we
 * can pick ONE canonical engine and turn the siblings into thin wrappers.
 */

import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs"
import { join, resolve } from "node:path"

const ROOT = resolve(process.cwd())
const TOOLS_DIR = join(ROOT, "src", "tools")
const OUT_DIR = join(ROOT, "docs")

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "")

const loc = (src) => (src ? src.split("\n").filter((l) => l.trim() !== "").length : 0)

const count = (src, re) => (src ? (src.match(re) || []).length : 0)

const has = (src, needle) => Boolean(src) && src.includes(needle)

const row = (cells) => "| " + cells.join(" | ") + " |"

const pct = (n, total) => (total === 0 ? "0%" : Math.round((n / total) * 100) + "%")

/* ------------------------------------------------------------------ */
/* config                                                              */
/* ------------------------------------------------------------------ */

// Strings that suggest the tool fakes its result instead of computing it.
const MOCK_MARKERS = [
	"Math.random(",
	"TODO",
	"FIXME",
	"not implemented",
	"Not implemented",
	"Coming Soon",
	"placeholder",
	"mockResult",
	"fakeResult",
]

// The four exports every generic-template tool was scaffolded with.
// All four present AND a small logic file means it is almost certainly a stub.
const STUB_EXPORTS = [
	"export function validate",
	"export function process",
	"export function formatBytes",
	"export function getStats",
]

const STOPWORDS = new Set(["tool", "online", "free", "app", "web", "the", "my"])

// Different words, same capability. Used only for duplicate CLUSTERING.
const SYNONYMS = new Map([
	["gen", "generator"],
	["generate", "generator"],
	["convert", "converter"],
	["conv", "converter"],
	["calc", "calculator"],
	["calculate", "calculator"],
	["compressor", "compress"],
	["compression", "compress"],
	["optimizer", "optimize"],
	["optimiser", "optimize"],
	["merger", "merge"],
	["combine", "merge"],
	["splitter", "split"],
	["cropper", "crop"],
	["rotator", "rotate"],
	["encoder", "encode"],
	["decoder", "decode"],
	["formatter", "format"],
	["beautifier", "format"],
	["prettifier", "format"],
	["validator", "validate"],
	["checker", "validate"],
	["qa", "chat"],
])

const normTokens = (id) => {
	const raw = id.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
	const out = []
	for (const t of raw) {
		if (STOPWORDS.has(t)) continue
		out.push(SYNONYMS.get(t) || t)
	}
	return [...new Set(out)].sort()
}

const jaccard = (a, b) => {
	const A = new Set(a)
	const B = new Set(b)
	let inter = 0
	for (const x of A) if (B.has(x)) inter += 1
	const union = A.size + B.size - inter
	return union === 0 ? 0 : inter / union
}

const field = (src, key) => {
	const m = src.match(new RegExp("\\b" + key + "\\s*:\\s*[\"'`]([^\"'`]*)"))
	return m ? m[1] : ""
}

/* ------------------------------------------------------------------ */
/* scoring - the god-level gates                                       */
/* ------------------------------------------------------------------ */

function scoreTool(t) {
	let s = 0
	const gaps = []

	if (t.logicLoc >= 150) s += 15
	else gaps.push("G1 real engine: logic " + t.logicLoc + " LOC (need 150)")

	if (t.tests >= 15) s += 20
	else gaps.push("G4 tests: " + t.tests + " (need 15)")

	if (t.uiLoc >= 120) s += 10
	else gaps.push("G2 ui: " + t.uiLoc + " LOC (need 120)")

	if (t.status !== "planned") s += 10
	else gaps.push("G9 still marked Coming Soon")

	if (!t.isStub) s += 10
	else gaps.push("G1 generic template stub signature")

	if (t.mockMarkers.length === 0) s += 5
	else gaps.push("G9 mock markers: " + t.mockMarkers.join(", "))

	if (t.hasReferences) s += 5
	else gaps.push("G3 no REFERENCES block")

	if (t.hasValidationReport) s += 5
	else gaps.push("G3 no validation report")

	if (t.hasReceipt) s += 5
	else gaps.push("G3 no reproducibility receipt")

	if (t.faq >= 3) s += 5
	else gaps.push("G10 seo.faq entries: " + t.faq + " (need 3)")

	if (t.exports >= 10) s += 10
	else gaps.push("G3 exports: " + t.exports + " (need 10)")

	return { total: s, gaps }
}

const band = (n) => {
	if (n >= 90) return "god"
	if (n >= 70) return "strong"
	if (n >= 40) return "weak"
	return "critical"
}

/* ------------------------------------------------------------------ */
/* walk                                                                */
/* ------------------------------------------------------------------ */

if (!existsSync(TOOLS_DIR)) {
	console.error("Cannot find " + TOOLS_DIR + " - run this from the repo root.")
	process.exit(1)
}

const dirsIn = (p) =>
	readdirSync(p, { withFileTypes: true })
		.filter((d) => d.isDirectory() && !d.name.startsWith("_") && !d.name.startsWith("."))
		.map((d) => d.name)
		.sort()

const categories = dirsIn(TOOLS_DIR)
const tools = []

for (const cat of categories) {
	const catDir = join(TOOLS_DIR, cat)
	for (const id of dirsIn(catDir)) {
		const dir = join(catDir, id)
		const manifest = read(join(dir, "manifest.ts"))
		const logic = read(join(dir, "logic.ts"))
		const spec = read(join(dir, "logic.test.ts"))
		const ui = read(join(dir, "ui.tsx"))
		const worker = read(join(dir, "worker.ts"))

		const logicLoc = loc(logic)
		const stubSig = STUB_EXPORTS.every((e) => has(logic, e))

		const rec = {
			id,
			category: cat,
			name: field(manifest, "name"),
			status: field(manifest, "status") || "none",
			logicLoc,
			uiLoc: loc(ui),
			testLoc: loc(spec),
			tests: count(spec, /(^|[^\w$.])(it|test)\s*(\.\w+)?\s*\(/g),
			exports: count(logic, /export\s+(const|function|class|async)\s/g),
			faq: count(manifest, /\bq\s*:/g),
			hasWorker: worker.length > 0,
			hasLogic: logic.length > 0,
			hasTests: spec.length > 0,
			hasReferences: has(logic, "REFERENCES"),
			hasValidationReport: /alidationReport/.test(logic),
			hasReceipt: /uildReceipt|eproducibilityReceipt/.test(logic),
			isStub: stubSig && logicLoc < 150,
			mockMarkers: MOCK_MARKERS.filter((m) => has(logic, m)),
			tokens: normTokens(id),
		}

		const sc = scoreTool(rec)
		rec.score = sc.total
		rec.band = band(sc.total)
		rec.gaps = sc.gaps
		tools.push(rec)
	}
}

/* ------------------------------------------------------------------ */
/* duplicate clustering (for canonicalisation, never for deletion)     */
/* ------------------------------------------------------------------ */

const byKey = new Map()
for (const t of tools) {
	t.exactKey = t.tokens.join("-")
	if (!byKey.has(t.exactKey)) byKey.set(t.exactKey, [])
	byKey.get(t.exactKey).push(t)
}

const exactClusters = [...byKey.entries()]
	.filter((e) => e[1].length > 1)
	.map((e) => {
		const list = e[1]
		const best = list.slice().sort((a, b) => b.score - a.score || a.id.length - b.id.length)[0]
		return {
			key: e[0],
			count: list.length,
			categories: [...new Set(list.map((t) => t.category))],
			suggestedCanonical: best.id,
			canonicalScore: best.score,
			members: list.map((t) => t.id + " (" + t.score + ")"),
		}
	})
	.sort((a, b) => b.count - a.count)

const nearDuplicates = []
for (const cat of categories) {
	const list = tools.filter((t) => t.category === cat)
	for (let i = 0; i < list.length; i += 1) {
		for (let j = i + 1; j < list.length; j += 1) {
			if (list[i].exactKey === list[j].exactKey) continue
			const sim = jaccard(list[i].tokens, list[j].tokens)
			if (sim < 0.6) continue
			nearDuplicates.push({
				category: cat,
				a: list[i].id,
				b: list[j].id,
				similarity: Number(sim.toFixed(2)),
			})
		}
	}
}
nearDuplicates.sort((x, y) => y.similarity - x.similarity)

/* ------------------------------------------------------------------ */
/* summarise                                                           */
/* ------------------------------------------------------------------ */

const total = tools.length
const inCluster = exactClusters.reduce((n, c) => n + c.count, 0)

const summary = {
	generatedAt: new Date().toISOString(),
	totalTools: total,
	categories: categories.length,
	avgScore: Number((tools.reduce((n, t) => n + t.score, 0) / (total || 1)).toFixed(1)),
	godLevel: tools.filter((t) => t.band === "god").length,
	strong: tools.filter((t) => t.band === "strong").length,
	weak: tools.filter((t) => t.band === "weak").length,
	critical: tools.filter((t) => t.band === "critical").length,
	comingSoon: tools.filter((t) => t.status === "planned").length,
	genericStubs: tools.filter((t) => t.isStub).length,
	withMockMarkers: tools.filter((t) => t.mockMarkers.length > 0).length,
	missingLogic: tools.filter((t) => !t.hasLogic).length,
	missingTestFile: tools.filter((t) => !t.hasTests).length,
	underTested: tools.filter((t) => t.tests < 15).length,
	withWorker: tools.filter((t) => t.hasWorker).length,
	exactDuplicateClusters: exactClusters.length,
	toolsInExactClusters: inCluster,
	uniqueCapabilities: total - inCluster + exactClusters.length,
	nearDuplicatePairs: nearDuplicates.length,
}

const perCategory = categories
	.map((cat) => {
		const list = tools.filter((t) => t.category === cat)
		const avg = list.reduce((n, t) => n + t.score, 0) / (list.length || 1)
		return {
			category: cat,
			tools: list.length,
			avgScore: Number(avg.toFixed(1)),
			godLevel: list.filter((t) => t.band === "god").length,
			comingSoon: list.filter((t) => t.status === "planned").length,
			genericStubs: list.filter((t) => t.isStub).length,
		}
	})
	.sort((a, b) => a.avgScore - b.avgScore)

/* ------------------------------------------------------------------ */
/* write reports                                                       */
/* ------------------------------------------------------------------ */

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

writeFileSync(
	join(OUT_DIR, "TOOL-AUDIT.json"),
	JSON.stringify(
		{
			summary,
			perCategory,
			exactClusters,
			nearDuplicates: nearDuplicates.slice(0, 1000),
			tools,
		},
		null,
		2,
	) + "\n",
)

const md = []
md.push("# UnQTools - Tool Audit")
md.push("")
md.push("_Auto-generated by `scripts/audit-tools.mjs`. Do not edit by hand._")
md.push("")
md.push("Generated: " + summary.generatedAt)
md.push("")
md.push("## Headline")
md.push("")
md.push(row(["Metric", "Value", "Share"]))
md.push(row(["---", "---:", "---:"]))
md.push(row(["Tools scanned", total, "100%"]))
md.push(row(["Average god-level score", summary.avgScore + " / 100", ""]))
md.push(row(["God level (90+)", summary.godLevel, pct(summary.godLevel, total)]))
md.push(row(["Strong (70-89)", summary.strong, pct(summary.strong, total)]))
md.push(row(["Weak (40-69)", summary.weak, pct(summary.weak, total)]))
md.push(row(["Critical (<40)", summary.critical, pct(summary.critical, total)]))
md.push(row(["Marked Coming Soon", summary.comingSoon, pct(summary.comingSoon, total)]))
md.push(row(["Generic template stubs", summary.genericStubs, pct(summary.genericStubs, total)]))
md.push(row(["Contain mock markers", summary.withMockMarkers, pct(summary.withMockMarkers, total)]))
md.push(row(["Under 15 tests", summary.underTested, pct(summary.underTested, total)]))
md.push(row(["Missing logic.ts", summary.missingLogic, pct(summary.missingLogic, total)]))
md.push(row(["Missing logic.test.ts", summary.missingTestFile, pct(summary.missingTestFile, total)]))
md.push(row(["Use a Web Worker", summary.withWorker, pct(summary.withWorker, total)]))
md.push(row(["Exact duplicate clusters", summary.exactDuplicateClusters, ""]))
md.push(row(["Tools inside those clusters", summary.toolsInExactClusters, pct(summary.toolsInExactClusters, total)]))
md.push(row(["Distinct capabilities", summary.uniqueCapabilities, ""]))
md.push(row(["Near-duplicate pairs (>=0.6)", summary.nearDuplicatePairs, ""]))
md.push("")
md.push("> Duplicates are NOT removal candidates. Owner directive: keep all tools.")
md.push("> Each cluster gets ONE canonical engine; the siblings become thin")
md.push("> wrappers with their own copy, SEO angle and presets.")
md.push("")

md.push("## Category scoreboard (worst first)")
md.push("")
md.push(row(["Category", "Tools", "Avg score", "God level", "Coming Soon", "Stubs"]))
md.push(row(["---", "---:", "---:", "---:", "---:", "---:"]))
for (const c of perCategory) {
	md.push(row([c.category, c.tools, c.avgScore, c.godLevel, c.comingSoon, c.genericStubs]))
}
md.push("")

md.push("## Biggest duplicate clusters (top 40)")
md.push("")
md.push(row(["Capability key", "N", "Suggested canonical", "Members"]))
md.push(row(["---", "---:", "---", "---"]))
for (const c of exactClusters.slice(0, 40)) {
	md.push(row([c.key, c.count, c.suggestedCanonical, c.members.join(", ")]))
}
md.push("")

md.push("## Worklist - 200 lowest scoring tools")
md.push("")
md.push(row(["Score", "Category", "Tool", "Top gaps"]))
md.push(row(["---:", "---", "---", "---"]))
const worst = tools.slice().sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))
for (const t of worst.slice(0, 200)) {
	md.push(row([t.score, t.category, t.id, t.gaps.slice(0, 3).join("; ")]))
}
md.push("")

md.push("## Already god level (90+)")
md.push("")
const best = tools.filter((t) => t.band === "god").sort((a, b) => b.score - a.score)
if (best.length === 0) {
	md.push("_None yet._")
} else {
	md.push(row(["Score", "Category", "Tool"]))
	md.push(row(["---:", "---", "---"]))
	for (const t of best.slice(0, 100)) md.push(row([t.score, t.category, t.id]))
}
md.push("")

writeFileSync(join(OUT_DIR, "TOOL-AUDIT.md"), md.join("\n"))

console.log("Scanned " + total + " tools across " + categories.length + " categories.")
console.log("Average god-level score: " + summary.avgScore + " / 100")
console.log("God level: " + summary.godLevel + " | Critical: " + summary.critical)
console.log("Duplicate clusters: " + summary.exactDuplicateClusters + " covering " + summary.toolsInExactClusters + " tools")
console.log("Distinct capabilities: " + summary.uniqueCapabilities)
console.log("Wrote docs/TOOL-AUDIT.json and docs/TOOL-AUDIT.md")
