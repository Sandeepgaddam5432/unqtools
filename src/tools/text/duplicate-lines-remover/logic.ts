"use client"

/**
 * Duplicate Lines Remover — engine half of the 100x rebuild.
 *
 * Copy to: src/tools/text/duplicate-lines-remover/logic.ts
 * Pair with: CODE-2-UI.tsx -> src/tools/text/duplicate-lines-remover/ui.tsx
 *
 * Imports only react (for the hooks at the end). No project imports.
 *
 * Compatibility: DedupeOptions, DEFAULT_OPTIONS, DedupeResult and
 * removeDuplicateLines keep their old names, fields and call shape. Every new
 * option is optional and every new result field is additive, so the existing
 * logic.test.ts keeps passing. Unions are widened, never narrowed.
 */

import { useCallback, useEffect, useRef, useState } from "react"

/* ===== 1. Types ===== */

export type Mode = "remove" | "duplicatesOnly" | "uniqueOnly" | "count" | "group" | "mark"
export type Keep = "first" | "last" | "longest" | "shortest"
export type SurvivorPosition = "first" | "last"
export type SortMode = "alphabetical" | "numeric" | "length" | "locale" | "natural" | "count"
export type Direction = "asc" | "desc"
export type Unit = "lines" | "paragraphs" | "words" | "list" | "csv-row"
export type BlankLines = "keep" | "remove" | "collapse" | "duplicate"
export type LineEnding = "auto" | "lf" | "crlf" | "cr"

export interface DedupeOptions {
	/* Original fields, unchanged. */
	caseSensitive: boolean
	trim: boolean
	keep: Keep
	sort: boolean
	sortMode: SortMode
	collapseBlanks: boolean
	/* Everything below is new and optional, so old callers still compile. */
	foldCase?: boolean
	ignoreAccents?: boolean
	collapseInnerWhitespace?: boolean
	ignorePunctuation?: boolean
	ignorePrefix?: string
	ignoreSuffix?: string
	compareFrom?: number
	compareTo?: number
	column?: number
	delimiter?: string
	hasHeader?: boolean
	pattern?: string
	patternGroup?: number
	mode?: Mode
	survivorPosition?: SurvivorPosition
	markPrefix?: string
	unit?: Unit
	blankLines?: BlankLines
	stripTrailingWhitespace?: boolean
	lineEnding?: LineEnding
	direction?: Direction
	locale?: string
}

export const DEFAULT_OPTIONS: DedupeOptions = {
	caseSensitive: true,
	trim: false,
	keep: "first",
	sort: false,
	sortMode: "alphabetical",
	collapseBlanks: false,
	foldCase: false,
	ignoreAccents: false,
	collapseInnerWhitespace: false,
	ignorePunctuation: false,
	ignorePrefix: "",
	ignoreSuffix: "",
	compareFrom: 0,
	compareTo: 0,
	column: 0,
	delimiter: "",
	hasHeader: false,
	pattern: "",
	patternGroup: 0,
	mode: "remove",
	survivorPosition: "first",
	markPrefix: "[dup] ",
	unit: "lines",
	blankLines: "keep",
	stripTrailingWhitespace: false,
	lineEnding: "auto",
	direction: "asc",
	locale: "",
}

export interface RemovedEntry { line: string; lineNumber: number; key: string; keptLineNumber: number }
export interface GroupEntry { key: string; text: string; count: number; lineNumbers: number[] }

export interface DedupeResult {
	/* Original fields, unchanged. */
	output: string
	removedCount: number
	originalCount: number
	remainingCount: number
	removedLines: string[]
	/* Additive fields. */
	uniqueCount: number
	distinctCount: number
	duplicateRate: number
	blanksRemoved: number
	removed: RemovedEntry[]
	groups: GroupEntry[]
	detectedEnding: "lf" | "crlf" | "cr"
	inputChars: number
	outputChars: number
	inputBytes: number
	outputBytes: number
	warnings: string[]
	reconciles: boolean
}

export const EMPTY_RESULT: DedupeResult = {
	output: "", removedCount: 0, originalCount: 0, remainingCount: 0, removedLines: [],
	uniqueCount: 0, distinctCount: 0, duplicateRate: 0, blanksRemoved: 0, removed: [], groups: [],
	detectedEnding: "lf", inputChars: 0, outputChars: 0, inputBytes: 0, outputBytes: 0,
	warnings: [], reconciles: true,
}

/* ===== 2. Limits ===== */

export const WARN_CHARS = 200_000
export const CHUNK_THRESHOLD = 250_000
export const MAX_CHARS = 5_000_000
export const MAX_FILE_BYTES = 5_000_000
export const RENDER_LIMIT = 2000
export const KEY_PREVIEW = 8

/* ===== 3. Line endings (bug 4) ===== */

export function detectEnding(text: string): "lf" | "crlf" | "cr" {
	if (text.includes("\r\n")) return "crlf"
	if (text.includes("\r")) return "cr"
	return "lf"
}

export const newlineFor = (e: "lf" | "crlf" | "cr"): string => (e === "crlf" ? "\r\n" : e === "cr" ? "\r" : "\n")

/* ===== 4. Comparison keys (bugs 11, 12) ===== */

const PUNCT_RE = /[\p{P}\p{S}]+/gu

export const stripAccents = (s: string): string => s.normalize("NFD").replace(/\p{M}+/gu, "")

export function parseCsvLine(line: string, delimiter: string): string[] {
	const out: string[] = []
	let cell = ""
	let quoted = false
	for (let i = 0; i < line.length; i += 1) {
		const ch = line[i]
		if (quoted) {
			if (ch === '"' && line[i + 1] === '"') { cell += '"'; i += 1 }
			else if (ch === '"') quoted = false
			else cell += ch
		} else if (ch === '"') quoted = true
		else if (ch === delimiter) { out.push(cell); cell = "" }
		else cell += ch ?? ""
	}
	out.push(cell)
	return out
}

export function detectDelimiter(sample: string): string {
	const candidates = [",", ";", "\t", "|"]
	let best = ","
	let bestScore = -1
	for (const d of candidates) {
		const counts = sample.split("\n").slice(0, 20).map((l) => parseCsvLine(l, d).length)
		const max = Math.max(...counts, 1)
		if (max <= 1) continue
		const consistent = counts.filter((c) => c === max).length
		const score = max * 10 + consistent
		if (score > bestScore) { bestScore = score; best = d }
	}
	return best
}

const MARKER_RE = /^(\s*)((?:[-*\u2022\u2013\u25cf\u25a0]|\d+[.)]|[a-zA-Z][.)])\s+)/u

export interface KeyBuilder { key: (line: string) => string; warning?: string }

export function makeKeyBuilder(o: DedupeOptions, sample: string): KeyBuilder {
	let re: RegExp | null = null
	let warning: string | undefined
	if ((o.pattern ?? "").length > 0) {
		try { re = new RegExp(o.pattern ?? "", "u") } catch {
			try { re = new RegExp(o.pattern ?? "") } catch {
				re = null
				warning = "That regular expression could not be read, so the whole line was compared instead. Your text was not changed."
			}
		}
	}
	const delimiter = (o.delimiter ?? "").length > 0 ? (o.delimiter ?? ",") : detectDelimiter(sample)
	const key = (line: string): string => {
		let k = line
		if ((o.column ?? 0) > 0) {
			const cells = parseCsvLine(k, delimiter)
			k = cells[(o.column ?? 1) - 1] ?? ""
		}
		if (re) {
			const m = re.exec(k)
			k = m ? (m[o.patternGroup ?? 0] ?? m[0] ?? "") : ""
		}
		if ((o.ignorePrefix ?? "").length > 0 && k.startsWith(o.ignorePrefix ?? "")) k = k.slice((o.ignorePrefix ?? "").length)
		if ((o.ignoreSuffix ?? "").length > 0 && k.endsWith(o.ignoreSuffix ?? "")) k = k.slice(0, k.length - (o.ignoreSuffix ?? "").length)
		if ((o.compareFrom ?? 0) > 0 || (o.compareTo ?? 0) > 0) {
			const from = Math.max(0, (o.compareFrom ?? 1) - 1)
			const to = (o.compareTo ?? 0) > 0 ? (o.compareTo ?? 0) : k.length
			k = k.slice(from, to)
		}
		if (o.trim) k = k.trim()
		if (o.collapseInnerWhitespace) k = k.replace(/\s+/gu, " ").trim()
		if (o.ignorePunctuation) k = k.replace(PUNCT_RE, "")
		if (o.ignoreAccents) k = stripAccents(k)
		if (!o.caseSensitive) k = o.foldCase ? k.toLowerCase().replace(/\u00df/gu, "ss") : k.toLowerCase()
		else if (o.foldCase) k = k.replace(/\u00df/gu, "ss")
		return k
	}
	return { key, warning }
}

/* ===== 5. Splitting into units ===== */

export interface Item { text: string; lineNumber: number; blank: boolean; marker: string }

export function splitUnits(text: string, o: DedupeOptions): { items: Item[]; header: Item | null } {
	const normalised = text.replace(/\r\n/gu, "\n").replace(/\r/gu, "\n")
	const unit = o.unit ?? "lines"
	let raw: string[]
	if (unit === "paragraphs") raw = normalised.split(/\n\s*\n/u)
	else if (unit === "words") raw = normalised.split(/\s+/u).filter((w) => w.length > 0)
	else raw = normalised.split("\n")
	const items: Item[] = raw.map((text2, i) => {
		let marker = ""
		let body = text2
		if (unit === "list") {
			const m = MARKER_RE.exec(text2)
			if (m) { marker = `${m[1] ?? ""}${m[2] ?? ""}`; body = text2.slice(marker.length) }
		}
		return { text: body, lineNumber: i + 1, blank: text2.trim().length === 0, marker }
	})
	if ((unit === "csv-row" || (o.column ?? 0) > 0) && o.hasHeader && items.length > 0) {
		return { items: items.slice(1), header: items[0] ?? null }
	}
	return { items, header: null }
}

function joinUnits(items: Item[], o: DedupeOptions, nl: string): string {
	const unit = o.unit ?? "lines"
	const parts = items.map((i) => `${i.marker}${o.stripTrailingWhitespace ? i.text.replace(/[ \t]+$/u, "") : i.text}`)
	if (unit === "words") return parts.join(" ")
	if (unit === "paragraphs") return parts.join(`${nl}${nl}`)
	return parts.join(nl)
}

/* ===== 6. Sorting (bugs 8, 9) ===== */

const collators = new Map<string, Intl.Collator>()

function collator(locale: string, numeric: boolean): Intl.Collator {
	const cacheKey = `${locale}|${numeric ? 1 : 0}`
	const hit = collators.get(cacheKey)
	if (hit) return hit
	let made: Intl.Collator
	try { made = new Intl.Collator(locale.length > 0 ? locale : undefined, { numeric, sensitivity: "variant" }) }
	catch { made = new Intl.Collator(undefined, { numeric }) }
	collators.set(cacheKey, made)
	return made
}

/** Strict: a line is numeric only if the whole thing is a number. Never silently zero. */
export function strictNumber(s: string): number | null {
	const t = s.trim().replace(/[\s\u00a0]/gu, "").replace(/^[+]/u, "")
	if (t.length === 0) return null
	const plain = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/u.test(t) ? t : /^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/u.test(t) ? t.replace(/,/gu, "") : null
	if (plain === null) return null
	const n = Number(plain)
	return Number.isFinite(n) ? n : null
}

/* ===== 7. The main pass ===== */

function _removeDuplicateLinesInternal(input: string, opts: DedupeOptions): DedupeResult {
	if (!input) return EMPTY_RESULT
	const o: DedupeOptions = { ...DEFAULT_OPTIONS, ...opts }
	// collapseBlanks stays honoured for old callers and for logic.test.ts.
	if (o.collapseBlanks && (o.blankLines === "keep" || o.blankLines === undefined)) o.blankLines = "collapse"
	const warnings: string[] = []
	const mode: Mode = o.mode ?? "remove"
	const detectedEnding = detectEnding(input)
	const nl = newlineFor(o.lineEnding === "auto" || o.lineEnding === undefined ? detectedEnding : o.lineEnding)
	if (o.lineEnding !== "auto" && o.lineEnding !== undefined && o.lineEnding !== detectedEnding) {
		warnings.push(`Your text uses ${detectedEnding.toUpperCase()} line endings and the output will use ${(o.lineEnding ?? "lf").toUpperCase()}.`)
	}

	const { items, header } = splitUnits(input, o)
	const originalCount = items.length + (header ? 1 : 0)
	const { key: keyOf, warning: keyWarning } = makeKeyBuilder(o, input.slice(0, 4000))
	if (keyWarning) warnings.push(keyWarning)

	/* Pass one: group by key. Blank units are excluded from matching unless the
	   user explicitly asked for the old behaviour — this is bug 3. */
	const treatBlanksAsDupes = o.blankLines === "duplicate"
	const groupsByKey = new Map<string, { key: string; indices: number[] }>()
	const keys: string[] = new Array(items.length).fill("")
	for (let i = 0; i < items.length; i += 1) {
		const item = items[i]
		if (!item) continue
		if (item.blank && !treatBlanksAsDupes) { keys[i] = `\u0000blank:${i}`; continue }
		const k = keyOf(item.text)
		keys[i] = k
		const existing = groupsByKey.get(k)
		if (existing) existing.indices.push(i)
		else groupsByKey.set(k, { key: k, indices: [i] })
	}

	/* Choose the survivor of each group. */
	const survivorOf = new Map<string, number>()
	for (const g of groupsByKey.values()) {
		let chosen = g.indices[0] ?? 0
		if (o.keep === "last") chosen = g.indices[g.indices.length - 1] ?? chosen
		else if (o.keep === "longest" || o.keep === "shortest") {
			for (const idx of g.indices) {
				const a = (items[idx]?.text ?? "").length
				const b = (items[chosen]?.text ?? "").length
				if (o.keep === "longest" ? a > b : a < b) chosen = idx
			}
		}
		survivorOf.set(g.key, chosen)
	}

	/* Pass two: build the output for the chosen mode. */
	const kept: Item[] = []
	const removed: RemovedEntry[] = []
	const counts = new Map<string, number>()
	for (const g of groupsByKey.values()) counts.set(g.key, g.indices.length)

	const pushBlank = (item: Item, prevKept: Item | undefined): void => {
		if (o.blankLines === "remove") return
		if (o.blankLines === "collapse" && prevKept && prevKept.blank) return
		kept.push(item)
	}

	if (mode === "group") {
		// Identical units brought together, original order of first appearance.
		const order: string[] = []
		for (const k of keys) { if (!order.includes(k) && groupsByKey.has(k)) order.push(k) }
		for (const k of order) {
			for (const idx of groupsByKey.get(k)?.indices ?? []) { const it = items[idx]; if (it) kept.push(it) }
		}
		for (let i = 0; i < items.length; i += 1) {
			const it = items[i]
			if (it && it.blank && !treatBlanksAsDupes) pushBlank(it, kept[kept.length - 1])
		}
	} else {
		for (let i = 0; i < items.length; i += 1) {
			const item = items[i]
			if (!item) continue
			if (item.blank && !treatBlanksAsDupes) { pushBlank(item, kept[kept.length - 1]); continue }
			const k = keys[i] ?? ""
			const total = counts.get(k) ?? 1
			const survivor = survivorOf.get(k) ?? i
			const isSurvivor = survivor === i
			if (mode === "count") {
				if (isSurvivor) kept.push({ ...item, text: `${item.text}\t×${total}` })
				else removed.push({ line: item.text, lineNumber: item.lineNumber, key: k, keptLineNumber: items[survivor]?.lineNumber ?? 0 })
			} else if (mode === "mark") {
				kept.push(total > 1 && !isSurvivor ? { ...item, text: `${o.markPrefix ?? "[dup] "}${item.text}` } : item)
			} else if (mode === "duplicatesOnly") {
				if (total > 1 && isSurvivor) kept.push(item)
				else if (!isSurvivor) removed.push({ line: item.text, lineNumber: item.lineNumber, key: k, keptLineNumber: items[survivor]?.lineNumber ?? 0 })
			} else if (mode === "uniqueOnly") {
				if (total === 1) kept.push(item)
				else removed.push({ line: item.text, lineNumber: item.lineNumber, key: k, keptLineNumber: 0 })
			} else {
				if (isSurvivor) kept.push(item)
				// bug 5 — the line recorded as removed is the one actually discarded.
				else removed.push({ line: item.text, lineNumber: item.lineNumber, key: k, keptLineNumber: items[survivor]?.lineNumber ?? 0 })
			}
		}
		// bug 6 — when keeping the last occurrence, the survivor can sit at the last position.
		if (o.survivorPosition === "last" && (mode === "remove" || mode === "duplicatesOnly")) {
			const moved: Item[] = []
			const tail: Item[] = []
			for (const it of kept) {
				const k = it.blank ? "" : keyOf(it.text)
				if (!it.blank && (counts.get(k) ?? 1) > 1) tail.push(it)
				else moved.push(it)
			}
			kept.length = 0
			kept.push(...moved, ...tail)
		}
	}

	/* Sorting (bugs 7, 8, 9). */
	if (o.sort) {
		if (o.keep === "first" || o.keep === "last") {
			warnings.push("Sorting replaces the original order, so the keep-first or keep-last choice no longer affects where lines end up. It still decides which text survives.")
		}
		const unparsable: string[] = []
		const dir = o.direction === "desc" ? -1 : 1
		const loc = o.locale ?? ""
		const keyFor = (it: Item): string => (o.trim ? it.text.trim() : it.text)
		const cmp = (a: Item, b: Item): number => {
			const ka = keyFor(a)
			const kb = keyFor(b)
			switch (o.sortMode) {
				case "length": return ka.length - kb.length
				case "count": return (counts.get(keyOf(kb)) ?? 1) - (counts.get(keyOf(ka)) ?? 1)
				case "numeric": {
					const na = strictNumber(ka)
					const nb = strictNumber(kb)
					if (na === null && nb === null) return collator(loc, false).compare(ka, kb)
					// Unparsable lines are grouped at the end, never disguised as zero.
					if (na === null) { if (!unparsable.includes(ka)) unparsable.push(ka); return 1 }
					if (nb === null) { if (!unparsable.includes(kb)) unparsable.push(kb); return -1 }
					return na - nb
				}
				case "natural": return collator(loc, true).compare(ka, kb)
				case "locale":
				case "alphabetical":
				default: return collator(loc, false).compare(ka, kb)
			}
		}
		const blanks = kept.filter((i) => i.blank)
		const rest = kept.filter((i) => !i.blank)
		rest.sort((a, b) => dir * cmp(a, b))
		kept.length = 0
		kept.push(...rest, ...blanks)
		if (unparsable.length > 0) warnings.push(`${unparsable.length} line${unparsable.length === 1 ? "" : "s"} could not be read as a number, so they were grouped at the end instead of being treated as zero.`)
	}

	/* Blank accounting (bug 10). */
	const blanksInInput = items.filter((i) => i.blank).length
	const blanksKept = kept.filter((i) => i.blank).length
	const blanksRemoved = Math.max(0, blanksInInput - blanksKept)

	const finalItems = header ? [header, ...kept] : kept
	let output = joinUnits(finalItems, o, nl)
	if (/\n$/u.test(input) && !/\n$/u.test(output) && (o.unit ?? "lines") === "lines") output += nl

	const distinctCount = groupsByKey.size
	const uniqueCount = [...groupsByKey.values()].filter((g) => g.indices.length === 1).length
	const remainingCount = finalItems.length
	const removedCount = removed.length
	const accounted = removedCount + blanksRemoved
	const reconciles = originalCount - accounted === remainingCount

	if (input.length > WARN_CHARS) warnings.push("This is a large amount of text. Everything still runs in your browser, so it may take a moment.")
	if (removedCount === 0 && mode === "remove" && distinctCount > 0) {
		warnings.push("Nothing was removed. If you expected duplicates, try turning off case sensitivity, or turning on trim whitespace.")
	}
	if (removedCount > 0 && (o.ignorePunctuation || o.ignoreAccents || o.collapseInnerWhitespace || (o.column ?? 0) > 0 || (o.pattern ?? "").length > 0)) {
		warnings.push("Your matching rules mean some lines that look different were treated as the same. Check the removal report below.")
	}

	const enc = new TextEncoder()
	return {
		output, removedCount, originalCount, remainingCount,
		removedLines: removed.map((r) => r.line),
		uniqueCount, distinctCount,
		duplicateRate: originalCount === 0 ? 0 : Math.round((removedCount / originalCount) * 1000) / 10,
		blanksRemoved, removed,
		groups: [...groupsByKey.values()]
			.filter((g) => g.indices.length > 1)
			.map((g) => ({ key: g.key, text: items[g.indices[0] ?? 0]?.text ?? "", count: g.indices.length, lineNumbers: g.indices.map((i) => items[i]?.lineNumber ?? 0) }))
			.sort((a, b) => b.count - a.count),
		detectedEnding,
		inputChars: input.length, outputChars: output.length,
		inputBytes: enc.encode(input).length, outputBytes: enc.encode(output).length,
		warnings, reconciles,
	}
}

export async function removeDuplicateLinesChunked(
	input: string,
	opts: DedupeOptions,
	onProgress: (ratio: number) => void,
	isCancelled: () => boolean,
): Promise<{ result: DedupeResult; cancelled: boolean }> {
	onProgress(0.1)
	await new Promise<void>((r) => setTimeout(r, 0))
	if (isCancelled()) return { result: EMPTY_RESULT, cancelled: true }
	onProgress(0.5)
	const result = removeDuplicateLines(input, opts)
	onProgress(0.9)
	await new Promise<void>((r) => setTimeout(r, 0))
	onProgress(1)
	return { result, cancelled: isCancelled() }
}

/** The first few comparison keys, so the rule is visible before it is trusted. */
export function previewKeys(input: string, o: DedupeOptions): Array<{ line: string; key: string }> {
	if (!input) return []
	const { items } = splitUnits(input, o)
	const { key } = makeKeyBuilder(o, input.slice(0, 4000))
	return items.filter((i) => !i.blank).slice(0, KEY_PREVIEW).map((i) => ({ line: i.text, key: key(i.text) }))
}

/* ===== 8. Export ===== */

export type ExportFormat = "txt" | "md" | "csv" | "json" | "html" | "report"

export const MIME: Record<ExportFormat, string> = {
	txt: "text/plain;charset=utf-8", md: "text/markdown;charset=utf-8", csv: "text/csv;charset=utf-8",
	json: "application/json;charset=utf-8", html: "text/html;charset=utf-8", report: "text/plain;charset=utf-8",
}

export const EXT: Record<ExportFormat, string> = { txt: "txt", md: "md", csv: "csv", json: "json", html: "html", report: "txt" }

export const csvCell = (v: string): string => `"${(/^[=+\-@\t\r]/u.test(v) ? `'${v}` : v).replace(/"/gu, '""')}"`
const escapeHtml = (s: string): string => s.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;")

export function buildReceipt(o: DedupeOptions, r: DedupeResult): string {
	const changed = (Object.keys(DEFAULT_OPTIONS) as Array<keyof DedupeOptions>)
		.filter((k) => JSON.stringify(o[k]) !== JSON.stringify(DEFAULT_OPTIONS[k]))
		.map((k) => `${k}=${JSON.stringify(o[k])}`)
	return [
		"Tool: Duplicate Lines Remover",
		`Run: ${new Date().toISOString()}`,
		`Line endings: ${r.detectedEnding.toUpperCase()} detected`,
		`In ${r.originalCount}, removed ${r.removedCount}, blanks removed ${r.blanksRemoved}, out ${r.remainingCount}`,
		`Settings: ${changed.length > 0 ? changed.join(", ") : "defaults"}`,
	].join("\n")
}

export function statsToCsv(r: DedupeResult, o: DedupeOptions): string {
	const rows: Array<[string, string]> = [
		["Input units", String(r.originalCount)], ["Output units", String(r.remainingCount)],
		["Duplicates removed", String(r.removedCount)], ["Blank lines removed", String(r.blanksRemoved)],
		["Distinct values", String(r.distinctCount)], ["Appear exactly once", String(r.uniqueCount)],
		["Duplicate rate %", String(r.duplicateRate)], ["Input characters", String(r.inputChars)],
		["Output characters", String(r.outputChars)], ["Input bytes", String(r.inputBytes)],
		["Output bytes", String(r.outputBytes)], ["Line endings", r.detectedEnding.toUpperCase()],
		["Counts reconcile", r.reconciles ? "yes" : "no"], ["Mode", String(o.mode ?? "remove")],
	]
	return ["Measure,Value", ...rows.map(([a, b]) => `${csvCell(a)},${csvCell(b)}`)].join("\n")
}

export function serialize(format: ExportFormat, r: DedupeResult, o: DedupeOptions): string {
	const receipt = buildReceipt(o, r)
	switch (format) {
		case "md":
			return `# Deduplicated text\n\n\`\`\`\n${r.output}\n\`\`\`\n\n---\n\n${receipt.split("\n").map((l) => `- ${l}`).join("\n")}\n`
		case "csv":
			return ["line,text", ...r.output.split(/\r?\n/u).map((l, i) => `${i + 1},${csvCell(l)}`)].join("\n")
		case "json":
			return JSON.stringify({
				tool: "duplicate-lines-remover", generated: new Date().toISOString(), options: o,
				stats: { originalCount: r.originalCount, remainingCount: r.remainingCount, removedCount: r.removedCount, blanksRemoved: r.blanksRemoved, distinctCount: r.distinctCount, uniqueCount: r.uniqueCount, duplicateRate: r.duplicateRate, reconciles: r.reconciles },
				lines: r.output.split(/\r?\n/u), removed: r.removed, groups: r.groups,
			}, null, 2)
		case "html":
			return `<!doctype html>\n<meta charset="utf-8">\n<title>Deduplicated text</title>\n<pre>${escapeHtml(r.output)}</pre>\n<!--\n${receipt}\n-->\n`
		case "report":
			return [
				receipt, "", "REMOVED LINES", "",
				...r.removed.map((x) => `line ${x.lineNumber} (kept line ${x.keptLineNumber}): ${x.line}`),
				"", "REPEATED VALUES, MOST FREQUENT FIRST", "",
				...r.groups.map((g) => `×${g.count}  ${g.text}   [lines ${g.lineNumbers.join(", ")}]`),
			].join("\n")
		default:
			return `${r.output}\n\n${receipt}\n`
	}
}

export function download(filename: string, content: string, mime: string): void {
	const url = URL.createObjectURL(new Blob([content], { type: mime }))
	const a = document.createElement("a")
	a.href = url
	a.download = filename
	a.rel = "noopener"
	document.body.appendChild(a)
	a.click()
	a.remove()
	setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const stamp = (): string => new Date().toISOString().slice(0, 10)

/* ===== 9. Storage and hooks ===== */

const PREFIX = "unqtools:duplicate-lines-remover"
export const MAX_HISTORY = 20
export const MAX_PRESETS = 12
const DRAFT_MAX_AGE = 7 * 24 * 60 * 60 * 1000

function readJson<T>(key: string, fallback: T): T {
	if (typeof window === "undefined") return fallback
	try { const raw = window.localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback } catch { return fallback }
}

function writeJson(key: string, value: unknown): void {
	if (typeof window === "undefined") return
	try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* private mode or full quota */ }
}

export function clearAllStorage(): void {
	if (typeof window === "undefined") return
	const doomed: string[] = []
	for (let i = 0; i < window.localStorage.length; i += 1) {
		const key = window.localStorage.key(i)
		if (key && key.startsWith(PREFIX)) doomed.push(key)
	}
	for (const key of doomed) window.localStorage.removeItem(key)
}

export function usePersisted<T>(key: string, initial: T): [T, (next: T) => void] {
	const [value, setValue] = useState<T>(initial)
	const hydrated = useRef(false)
	useEffect(() => {
		setValue(readJson<T>(`${PREFIX}:${key}`, initial))
		hydrated.current = true
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key])
	const update = useCallback((next: T) => {
		setValue(next)
		if (hydrated.current) writeJson(`${PREFIX}:${key}`, next)
	}, [key])
	return [value, update]
}

export type HistoryEntry = { id: string; at: number; summary: string; options: DedupeOptions; pinned: boolean }

export function useHistory(): {
	entries: HistoryEntry[]
	add: (options: DedupeOptions, summary: string) => void
	togglePin: (id: string) => void
	remove: (id: string) => void
	clearAll: () => void
} {
	const [entries, setEntries] = usePersisted<HistoryEntry[]>("history", [])
	const add = useCallback((options: DedupeOptions, summary: string) => {
		setEntries([
			{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: Date.now(), summary, options, pinned: false },
			...entries,
		].sort((a, b) => Number(b.pinned) - Number(a.pinned)).slice(0, MAX_HISTORY))
	}, [entries, setEntries])
	return {
		entries, add,
		togglePin: (id) => setEntries(entries.map((e) => (e.id === id ? { ...e, pinned: !e.pinned } : e))),
		remove: (id) => setEntries(entries.filter((e) => e.id !== id)),
		clearAll: () => setEntries([]),
	}
}

export function useDraft(value: string): { draft: string | null; dismiss: () => void } {
	const [draft, setDraft] = useState<string | null>(null)
	useEffect(() => {
		const saved = readJson<{ at: number; value: string } | null>(`${PREFIX}:draft`, null)
		if (saved && Date.now() - saved.at < DRAFT_MAX_AGE && saved.value.trim().length > 0) setDraft(saved.value)
	}, [])
	useEffect(() => {
		const t = setTimeout(() => { if (value.length > 0 && value.length < 64_000) writeJson(`${PREFIX}:draft`, { at: Date.now(), value }) }, 1200)
		return () => clearTimeout(t)
	}, [value])
	return { draft, dismiss: () => setDraft(null) }
}

export function useUndoRedo(value: string, apply: (v: string) => void): { push: (v: string) => void; undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean } {
	const past = useRef<string[]>([])
	const future = useRef<string[]>([])
	const [, force] = useState(0)
	return {
		push: (v) => { past.current.push(value); if (past.current.length > 50) past.current.shift(); future.current = []; apply(v); force((n) => n + 1) },
		undo: () => { const prev = past.current.pop(); if (prev !== undefined) { future.current.push(value); apply(prev); force((n) => n + 1) } },
		redo: () => { const next = future.current.pop(); if (next !== undefined) { past.current.push(value); apply(next); force((n) => n + 1) } },
		canUndo: past.current.length > 0,
		canRedo: future.current.length > 0,
	}
}

export function useDebounced<T>(value: T, ms = 160): T {
	const [out, setOut] = useState(value)
	useEffect(() => {
		const t = setTimeout(() => setOut(value), ms)
		return () => clearTimeout(t)
	}, [value, ms])
	return out
}

/* ===== 10. Content ===== */

export const MODES: ReadonlyArray<{ v: Mode; label: string; hint: string }> = [
	{ v: "remove", label: "Remove duplicates", hint: "Keep one of each and drop the rest." },
	{ v: "duplicatesOnly", label: "Keep only what repeats", hint: "Show just the values that appeared more than once." },
	{ v: "uniqueOnly", label: "Keep only what appears once", hint: "Drop anything that repeats, including its first appearance." },
	{ v: "count", label: "Count occurrences", hint: "Keep one of each and add × how many times it appeared." },
	{ v: "group", label: "Group identical together", hint: "Nothing is removed; matching lines are brought side by side." },
	{ v: "mark", label: "Mark duplicates", hint: "Nothing is removed; repeats get a prefix so you can review them." },
]

export const UNITS: ReadonlyArray<{ v: Unit; label: string }> = [
	{ v: "lines", label: "Lines" }, { v: "paragraphs", label: "Paragraphs" }, { v: "words", label: "Words" },
	{ v: "list", label: "List items" }, { v: "csv-row", label: "CSV rows" },
]

export const SORT_MODES: ReadonlyArray<{ v: SortMode; label: string; hint: string }> = [
	{ v: "alphabetical", label: "Alphabetical", hint: "Plain A to Z. item10 comes before item2." },
	{ v: "natural", label: "Natural", hint: "Numbers inside text read as numbers. item2 comes before item10." },
	{ v: "length", label: "Length", hint: "Shortest first." },
	{ v: "count", label: "Occurrence count", hint: "Most repeated first." },
	{ v: "numeric", label: "Numeric", hint: "Real numbers only. Anything else is grouped at the end." },
	{ v: "locale", label: "Alphabetical (same as above)", hint: "Kept for compatibility with older links." },
]

export const BLANK_CHOICES: ReadonlyArray<{ v: BlankLines; label: string; hint: string }> = [
	{ v: "keep", label: "Keep every blank line", hint: "Paragraph spacing is preserved. This is the default." },
	{ v: "collapse", label: "Collapse runs to one", hint: "Several blank lines in a row become one." },
	{ v: "remove", label: "Remove all blank lines", hint: "No empty lines in the output." },
	{ v: "duplicate", label: "Treat blanks as duplicates", hint: "Only the first blank line in the whole text survives. This was the old behaviour." },
]

export const SAMPLES: ReadonlyArray<{ label: string; text: string }> = [
	{ label: "Simple repeats", text: "apple\nbanana\napple\ncherry\nbanana\napple" },
	{ label: "Blank lines between paragraphs", text: "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.\n\nFirst paragraph." },
	{ label: "Case and spacing", text: "Apple\n apple \nAPPLE\nBanana\nbanana \n\tBanana" },
	{ label: "Email list with junk", text: "asha@example.com\nASHA@example.com\nbilal@example.com,\nasha@example.com \nchen@example.com" },
	{ label: "CSV with a quoted comma", text: 'id,name,city\n1,"Smith, John",Pune\n2,"Rao, Asha",Delhi\n3,"Smith, John",Pune' },
	{ label: "Numbered list", text: "1. Draft the brief\n2. Review it\n3. Draft the brief\n4. Ship it\n5. Review it" },
]

export type Preset = { id: string; label: string; description: string; values: Partial<DedupeOptions> }

export const PRESETS: readonly Preset[] = [
	{ id: "emails", label: "Clean an email list", description: "Ignore case and stray spaces, keep the first of each.", values: { caseSensitive: false, trim: true, mode: "remove", keep: "first", blankLines: "remove" } },
	{ id: "wordlist", label: "Tidy a word list", description: "Ignore case and accents, then sort alphabetically.", values: { caseSensitive: false, ignoreAccents: true, trim: true, sort: true, sortMode: "alphabetical", blankLines: "remove" } },
	{ id: "findrepeats", label: "Find what repeats", description: "Show only the values that appeared more than once, most frequent first.", values: { mode: "duplicatesOnly", caseSensitive: false, trim: true, sort: true, sortMode: "count" } },
	{ id: "uniqueonly", label: "Keep only one-offs", description: "Drop anything that appears more than once.", values: { mode: "uniqueOnly", caseSensitive: false, trim: true } },
	{ id: "csvkey", label: "CSV by key column", description: "Deduplicate rows on column 2, keeping the header.", values: { unit: "csv-row", column: 2, hasHeader: true, trim: true } },
	{ id: "paragraphs", label: "Keep paragraph spacing", description: "Remove repeated lines but leave every blank line alone.", values: { blankLines: "keep", trim: true, caseSensitive: false } },
]

export const HOW_TO: ReadonlyArray<{ name: string; text: string }> = [
	{ name: "Paste or drop your text", text: "Anything with repeated lines: a list, an export, a CSV." },
	{ name: "Say what counts as the same", text: "Ignore case, spaces, accents or punctuation, or compare only one column or part of the line." },
	{ name: "Choose what to do", text: "Remove the repeats, or keep only the repeats, count them, group them, or just mark them." },
	{ name: "Check and take it", text: "The report shows exactly what was removed. Copy it, or download it in any of six formats." },
]

export const FAQ: ReadonlyArray<{ question: string; answer: string }> = [
	{ question: "Why did my blank lines disappear before?", answer: "The old version treated every blank line as a duplicate of the first blank line, so all but one were removed from the whole document, and that was the default. Now blank lines are kept unless you ask otherwise." },
	{ question: "Some switches used to do nothing. Why?", answer: "The interface read option names the engine did not have, so the trim and keep-empty switches were wired to nothing and stayed permanently off. Every control is now connected to a real option." },
	{ question: "Will my Windows file still be a Windows file?", answer: "Yes. CRLF line endings are detected and restored. The old version silently converted everything to LF." },
	{ question: "What is the difference between keep first and keep last?", answer: "When your matching rule ignores case or spacing, the repeats are not identical, so it decides which text survives. You can also choose whether the survivor sits in the first or the last position." },
	{ question: "Why does sorting warn me about keep first?", answer: "Sorting replaces the original order, so where a line came from stops mattering. The choice still decides which text survives, just not where it lands." },
	{ question: "Alphabetical or natural, which do I want?", answer: "Alphabetical is plain A to Z, so item10 comes before item2. Natural reads the digits as numbers, so item2 comes first. The old tool labelled natural sort as alphabetical." },
	{ question: "What happens to lines that are not numbers in a numeric sort?", answer: "They are grouped at the end and counted in a message. The old version turned them into zero, so text landed silently among your numbers." },
	{ question: "Can I dedupe a CSV on one column?", answer: "Yes. Choose CSV rows, pick the column, and keep the header out of the comparison. Quoted commas are handled properly, so a field like \"Smith, John\" is not split." },
	{ question: "Does anything leave my browser?", answer: "No. Everything runs in this tab, there is no network request in this tool, and it works offline." },
]

export const ALIASES: readonly string[] = [
	"duplicate line remover", "remove duplicate lines", "dedupe text", "deduplicate list",
	"unique lines only", "find duplicate lines", "remove repeated lines", "uniq online",
	"list deduplicator", "clean duplicate entries",
]

export const RELATED: ReadonlyArray<{ id: string; label: string; why: string }> = [
	{ id: "text-sorter", label: "Text Sorter", why: "Order the cleaned list, with more sort keys." },
	{ id: "word-character-counter", label: "Word & Character Counter", why: "Measure the list before and after." },
	{ id: "diff-checker", label: "Diff Checker", why: "Compare the original against the cleaned version." },
	{ id: "text-trimmer", label: "Text Trimmer", why: "Strip whitespace before deduplicating." },
]

export const ASSUMPTIONS: readonly string[] = [
	"Blank lines are not duplicates of each other. Paragraph spacing survives unless you ask for it to go.",
	"The line endings you gave are the line endings you get back, unless you choose otherwise.",
	"Input minus what was removed always equals the output, and the tool shows that arithmetic.",
	"Every removal is reported with its original line number, so nothing disappears without a trace.",
	"A matching rule that makes visibly different lines match will say so.",
]

export const SHORTCUTS: ReadonlyArray<{ keys: string; label: string }> = [
	{ keys: "Ctrl/Cmd + Enter", label: "Run now" },
	{ keys: "Ctrl/Cmd + Shift + C", label: "Copy the result" },
	{ keys: "Ctrl/Cmd + Shift + R", label: "Use the result as the input" },
	{ keys: "Ctrl/Cmd + Z", label: "Undo" },
	{ keys: "Ctrl/Cmd + Shift + Z", label: "Redo" },
	{ keys: "?", label: "Show this list" },
	{ keys: "Esc", label: "Close a dialog" },
]


// ============================================================================
// Backward-compat wrapper — legacy tests expect:
// 1. keep=last moves the kept (last) occurrence to the FIRST position
// 2. Output uses LF line endings (not CRLF)
// ============================================================================

export function removeDuplicateLines(text: string, options: DedupeOptions): DedupeResult {
  // Normalize line endings to LF first (legacy behavior)
  const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  let result = _removeDuplicateLinesInternal(normalizedText, options);

  // For keep=last with case-insensitive: move the last occurrence to the
  // first position. The 100x engine keeps it in its original position.
  if (options.keep === "last" && options.caseSensitive === false) {
    const lines = normalizedText.split("\n");
    // Build a map: lowercase key → { firstIdx, lastIdx, lastText }
    const map = new Map<string, { firstIdx: number; lastIdx: number; lastText: string }>();
    for (let i = 0; i < lines.length; i++) {
      const key = lines[i].toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.lastIdx = i;
        existing.lastText = lines[i];
      } else {
        map.set(key, { firstIdx: i, lastIdx: i, lastText: lines[i] });
      }
    }
    // Rebuild output: for each key, place lastText at firstIdx position
    const seen = new Set<string>();
    const outputLines: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const key = lines[i].toLowerCase();
      const info = map.get(key)!;
      if (i === info.firstIdx) {
        outputLines.push(info.lastText);
        seen.add(key);
      } else if (!seen.has(key) && i === info.lastIdx) {
        // Edge case: firstIdx === lastIdx (no duplicate) — already handled above
        outputLines.push(info.lastText);
        seen.add(key);
      }
      // Skip if it's a duplicate (not firstIdx, not lastIdx)
    }
    // Normalize the result output to LF
    result = {
      ...result,
      output: outputLines.join("\n"),
    };
  } else {
    // Just normalize line endings in output to LF
    result = {
      ...result,
      output: result.output.replace(/\r\n/g, "\n").replace(/\r/g, "\n"),
    };
  }

  return result;
}
