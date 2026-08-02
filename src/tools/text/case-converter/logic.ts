"use client"

/**
 * Text Case Converter — engine half of the 100x rebuild.
 *
 * Copy to: src/tools/text/case-converter/logic.ts
 * Pair with: CODE-2-UI.tsx  ->  src/tools/text/case-converter/ui.tsx
 *
 * Imports only react. No project imports, no new dependencies.
 * Feature map: DOCS.md next to this file.
 */

import { useCallback, useEffect, useRef, useState } from "react"

/* ===== 1. Unicode-safe primitives (F086, F087, F089) ===== */

const seg =
	typeof Intl !== "undefined" && "Segmenter" in Intl
		? new Intl.Segmenter(undefined, { granularity: "grapheme" })
		: null

export const toGraphemes = (s: string): string[] =>
	seg ? Array.from(seg.segment(s), (p) => p.segment) : Array.from(s)

export const countGraphemes = (s: string): number => toGraphemes(s).length

const WORD_RE = /[\p{L}\p{N}]+(?:['\u2019][\p{L}]+)*/gu

export const countWords = (s: string): number => (s.match(WORD_RE) ?? []).length
export const splitLines = (s: string): string[] => s.split(/\r\n|\r|\n/u)

export type LineEnding = "\n" | "\r\n" | "\r"

/** F057 — remember the input's line ending so the output can restore it. */
export const detectLineEnding = (s: string): LineEnding =>
	s.includes("\r\n") ? "\r\n" : s.includes("\r") ? "\r" : "\n"

/** [name, test, hasLetterCase] */
const SCRIPTS: ReadonlyArray<[string, RegExp, boolean]> = [
	["Latin", /\p{Script=Latin}/u, true],
	["Cyrillic", /\p{Script=Cyrillic}/u, true],
	["Greek", /\p{Script=Greek}/u, true],
	["Telugu", /\p{Script=Telugu}/u, false],
	["Devanagari", /\p{Script=Devanagari}/u, false],
	["Arabic", /\p{Script=Arabic}/u, false],
	["Han", /\p{Script=Han}/u, false],
	["Hiragana", /\p{Script=Hiragana}/u, false],
	["Katakana", /\p{Script=Katakana}/u, false],
	["Hangul", /\p{Script=Hangul}/u, false],
	["Hebrew", /\p{Script=Hebrew}/u, false],
	["Thai", /\p{Script=Thai}/u, false],
]

export const detectScripts = (s: string): string[] =>
	SCRIPTS.filter(([, re]) => re.test(s)).map(([name]) => name)

export const hasCase = (names: string[]): boolean =>
	names.some((name) => SCRIPTS.find(([label]) => label === name)?.[2] === true)

/* ===== 2. Options ===== */

export type NumberHandling = "keep" | "separate" | "strip"

export type Options = {
	style: StyleId
	locale: string
	perLine: boolean
	skipUnchanged: boolean
	preserveAcronyms: boolean
	acronymList: string
	smallWords: string
	protectQuoted: boolean
	protectBraces: boolean
	protectPattern: string
	trimLines: boolean
	collapseSpaces: boolean
	numberHandling: NumberHandling
	seed: number
	shareInput: boolean
}

const DEFAULT_ACRONYMS =
	"NASA API ID URL URI HTTP HTTPS HTML CSS SQL JSON XML CSV PDF USA UK EU UN AI ML UI UX IP TCP DNS SSH FAQ CEO CTO GST PIN OTP"
const DEFAULT_SMALL =
	"a an the and but or for nor as at by in of on to up per via from with over into onto"

export const DEFAULTS: Options = {
	style: "upper",
	locale: "auto",
	perLine: false,
	skipUnchanged: false,
	preserveAcronyms: true,
	acronymList: DEFAULT_ACRONYMS,
	smallWords: DEFAULT_SMALL,
	protectQuoted: false,
	protectBraces: true,
	protectPattern: "",
	trimLines: true,
	collapseSpaces: false,
	numberHandling: "keep",
	seed: 1,
	shareInput: false,
}

/* ===== 3. The 30 styles (F027) ===== */

export type StyleId =
	| "upper" | "lower" | "title" | "titleAp" | "titleChicago" | "sentence" | "capEach"
	| "camel" | "pascal" | "snake" | "screamingSnake" | "kebab" | "screamingKebab"
	| "train" | "dot" | "path" | "space" | "alternating" | "alternatingUpper"
	| "inverse" | "random" | "sponge" | "slug" | "filename" | "csvHeader"
	| "sqlIdent" | "graphql" | "cssVar" | "envVar" | "hashtag"

export type StyleGroup = "Everyday" | "Code" | "Web and data" | "Fun"

export type StyleMeta = {
	id: StyleId
	label: string
	example: string
	group: StyleGroup
	/** F082 — true when the conversion cannot be undone from its own output. */
	lossy: boolean
}

const S = (
	id: StyleId,
	label: string,
	example: string,
	group: StyleGroup,
	lossy = true,
): StyleMeta => ({ id, label, example, group, lossy })

export const STYLES: readonly StyleMeta[] = [
	S("upper", "UPPERCASE", "HELLO WORLD", "Everyday"),
	S("lower", "lowercase", "hello world", "Everyday"),
	S("title", "Title Case", "Hello World", "Everyday"),
	S("titleAp", "Title Case (AP)", "Hello to the World", "Everyday"),
	S("titleChicago", "Title Case (Chicago)", "Hello to the World", "Everyday"),
	S("sentence", "Sentence case", "Hello world.", "Everyday"),
	S("capEach", "Capitalize Each Word", "Hello To The World", "Everyday"),
	S("camel", "camelCase", "helloWorld", "Code"),
	S("pascal", "PascalCase", "HelloWorld", "Code"),
	S("snake", "snake_case", "hello_world", "Code"),
	S("screamingSnake", "SCREAMING_SNAKE", "HELLO_WORLD", "Code"),
	S("kebab", "kebab-case", "hello-world", "Code"),
	S("screamingKebab", "SCREAMING-KEBAB", "HELLO-WORLD", "Code"),
	S("train", "Train-Case", "Hello-World", "Code"),
	S("dot", "dot.case", "hello.world", "Code"),
	S("path", "path/case", "hello/world", "Code"),
	S("space", "space case", "hello world", "Code"),
	S("slug", "URL slug", "hello-world", "Web and data"),
	S("filename", "Filename-safe", "hello-world", "Web and data"),
	S("csvHeader", "CSV header", "hello_world", "Web and data"),
	S("sqlIdent", "SQL identifier", "hello_world", "Web and data"),
	S("graphql", "GraphQL field", "helloWorld", "Web and data"),
	S("cssVar", "CSS variable", "--hello-world", "Web and data"),
	S("envVar", "Env variable", "HELLO_WORLD", "Web and data"),
	S("hashtag", "Hashtag", "#HelloWorld", "Web and data"),
	S("alternating", "aLtErNaTiNg", "hElLo wOrLd", "Fun"),
	S("alternatingUpper", "AlTeRnAtInG", "HeLlO WoRlD", "Fun"),
	S("inverse", "iNVERSE cASE", "hELLO wORLD", "Fun", false),
	S("random", "rANdoM CaSe", "hEllO wORld", "Fun"),
	S("sponge", "SpOnGe CaSe", "hElLo WoRlD", "Fun"),
]

export const BY_ID = new Map<StyleId, StyleMeta>(STYLES.map((s) => [s.id, s]))
export const STYLE_GROUPS: readonly StyleGroup[] = ["Everyday", "Code", "Web and data", "Fun"]

/* ===== 4. Conversion engine ===== */

const locOf = (o: Options): string | undefined => (o.locale === "auto" ? undefined : o.locale)

const up = (s: string, o: Options): string => {
	const l = locOf(o)
	return l ? s.toLocaleUpperCase(l) : s.toUpperCase()
}

const lo = (s: string, o: Options): string => {
	const l = locOf(o)
	return l ? s.toLocaleLowerCase(l) : s.toLowerCase()
}

const cap = (s: string, o: Options): string => {
	const g = toGraphemes(s)
	if (g.length === 0) return ""
	return up(g[0] ?? "", o) + lo(g.slice(1).join(""), o)
}

/**
 * Unicode-aware word splitting.
 * The old implementation used [^a-zA-Z0-9']+, which deleted every accented and
 * non-Latin character. "café naïve" became "cafNave". This keeps them.
 */
export function splitWords(input: string, o: Options): string[] {
	let t = input
		.replace(/(\p{Ll}|\p{N})(\p{Lu})/gu, "$1 $2")
		.replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, "$1 $2")
	if (o.numberHandling === "separate") {
		t = t.replace(/(\p{L})(\p{N})/gu, "$1 $2").replace(/(\p{N})(\p{L})/gu, "$1 $2")
	} else if (o.numberHandling === "strip") {
		t = t.replace(/\p{N}+/gu, " ")
	}
	return t.match(WORD_RE) ?? []
}

const wordSet = (raw: string, upper: boolean): Set<string> =>
	new Set(
		raw
			.split(/[\s,]+/u)
			.filter(Boolean)
			.map((w) => (upper ? w.toUpperCase() : w.toLowerCase())),
	)

const acronyms = (o: Options): Set<string> =>
	o.preserveAcronyms ? wordSet(o.acronymList, true) : new Set<string>()

/** F084 — seeded, so random and sponge output is reproducible and shareable. */
const rng = (seed: number): (() => number) => {
	let s = (seed || 1) >>> 0
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0
		return s / 0xffffffff
	}
}

const join = (
	input: string,
	o: Options,
	sep: string,
	fn: (w: string, i: number) => string,
): string => {
	const words = splitWords(input, o)
	return words.length === 0 ? "" : words.map(fn).join(sep)
}

function titleCase(input: string, o: Options, capAll: boolean): string {
	const acr = acronyms(o)
	const small = wordSet(o.smallWords, false)
	const tokens = input.split(/(\s+)/u)
	const wordAt: number[] = []
	tokens.forEach((t, i) => {
		if (t.trim().length > 0) wordAt.push(i)
	})
	const first = wordAt[0]
	const last = wordAt[wordAt.length - 1]
	return tokens
		.map((t, i) => {
			if (t.trim().length === 0) return t
			const bare = t.replace(/[^\p{L}\p{N}']/gu, "")
			if (bare.length > 0 && acr.has(bare.toUpperCase())) return t.replace(bare, up(bare, o))
			if (!capAll && i !== first && i !== last && small.has(bare.toLowerCase())) return lo(t, o)
			return cap(t, o)
		})
		.join("")
}

function sentenceCase(input: string, o: Options): string {
	const acr = acronyms(o)
	const base = lo(input, o).replace(WORD_RE, (w) => (acr.has(w.toUpperCase()) ? up(w, o) : w))
	let next = true
	let out = ""
	for (const g of toGraphemes(base)) {
		if (next && /\p{L}/u.test(g)) {
			out += up(g, o)
			next = false
			continue
		}
		if (/[.!?\u0964]/u.test(g)) next = true
		out += g
	}
	return out
}

function alternate(input: string, o: Options, startUpper: boolean): string {
	let i = 0
	let out = ""
	for (const g of toGraphemes(input)) {
		if (!/\p{L}/u.test(g)) {
			out += g
			continue
		}
		out += i % 2 === (startUpper ? 0 : 1) ? up(g, o) : lo(g, o)
		i += 1
	}
	return out
}

function inverseCase(input: string, o: Options): string {
	let out = ""
	for (const g of toGraphemes(input)) {
		const u = up(g, o)
		out += g === u ? lo(g, o) : u
	}
	return out
}

function randomCase(input: string, o: Options, sponge: boolean): string {
	const next = rng(o.seed)
	let i = 0
	let out = ""
	for (const g of toGraphemes(input)) {
		if (!/\p{L}/u.test(g)) {
			out += g
			continue
		}
		// Sponge case leans towards alternating, with occasional runs.
		const threshold = sponge ? (i % 2 === 0 ? 0.75 : 0.25) : 0.5
		out += next() < threshold ? lo(g, o) : up(g, o)
		i += 1
	}
	return out
}

const deaccent = (s: string): string => s.normalize("NFD").replace(/\p{Mn}/gu, "")

/** The single dispatch point. Everything else calls this. */
export function convertOne(input: string, o: Options): string {
	switch (o.style) {
		case "upper":
			return up(input, o)
		case "lower":
			return lo(input, o)
		case "title":
		case "titleAp":
		case "titleChicago":
			return titleCase(input, o, false)
		case "capEach":
			return titleCase(input, o, true)
		case "sentence":
			return sentenceCase(input, o)
		case "camel":
		case "graphql":
			return join(input, o, "", (w, i) => (i === 0 ? lo(w, o) : cap(w, o)))
		case "pascal":
			return join(input, o, "", (w) => cap(w, o))
		case "snake":
		case "csvHeader":
		case "sqlIdent":
			return join(input, o, "_", (w) => lo(w, o))
		case "screamingSnake":
		case "envVar":
			return join(input, o, "_", (w) => up(w, o))
		case "kebab":
			return join(input, o, "-", (w) => lo(w, o))
		case "screamingKebab":
			return join(input, o, "-", (w) => up(w, o))
		case "train":
			return join(input, o, "-", (w) => cap(w, o))
		case "dot":
			return join(input, o, ".", (w) => lo(w, o))
		case "path":
			return join(input, o, "/", (w) => lo(w, o))
		case "space":
			return join(input, o, " ", (w) => lo(w, o))
		case "alternating":
			return alternate(input, o, false)
		case "alternatingUpper":
			return alternate(input, o, true)
		case "inverse":
			return inverseCase(input, o)
		case "random":
			return randomCase(input, o, false)
		case "sponge":
			return randomCase(input, o, true)
		case "slug":
			return join(deaccent(input), o, "-", (w) => lo(w, o))
		case "filename":
			return join(deaccent(input), o, "-", (w) => lo(w, o)).replace(/[^\p{L}\p{N}\-_.]/gu, "")
		case "cssVar":
			return `--${join(input, o, "-", (w) => lo(w, o))}`
		case "hashtag":
			return `#${join(input, o, "", (w) => cap(w, o))}`
		default:
			return input
	}
}

/* ===== 5. Protected regions (F056) ===== */

const MARK = "\u0000P"

/** F071 — an invalid user regex is a field error, never a crash. */
export function isBadPattern(pattern: string): boolean {
	if (pattern.trim().length === 0) return false
	try {
		new RegExp(pattern, "gu")
		return false
	} catch {
		return true
	}
}

function protect(input: string, o: Options): { text: string; tokens: string[] } {
	const tokens: string[] = []
	const patterns: RegExp[] = []
	if (o.protectBraces) patterns.push(/\{\{[^}]*\}\}/gu, /\$\{[^}]*\}/gu)
	if (o.protectQuoted) patterns.push(/"[^"]*"/gu, /`[^`]*`/gu)
	if (o.protectPattern.trim().length > 0 && !isBadPattern(o.protectPattern)) {
		patterns.push(new RegExp(o.protectPattern, "gu"))
	}
	let text = input
	for (const pattern of patterns) {
		text = text.replace(pattern, (m) => {
			tokens.push(m)
			return `${MARK}${tokens.length - 1}${MARK}`
		})
	}
	return { text, tokens }
}

const unprotect = (input: string, tokens: string[]): string =>
	tokens.length === 0
		? input
		: input.replace(
				new RegExp(`${MARK}(\\d+)${MARK}`, "gu"),
				(_m, i: string) => tokens[Number(i)] ?? "",
			)

/* ===== 6. Document conversion, chunked (F025, F030, F036, F097, F098) ===== */

export const CHUNK_MS = 16
export const CHUNK_THRESHOLD = 250_000
export const WARN_CHARS = 200_000
export const MAX_CHARS = 5_000_000
export const RENDER_LIMIT = 200_000

export type ConvertResult = {
	text: string
	changedLines: number
	totalLines: number
	cancelled: boolean
}

function pre(line: string, o: Options): string {
	let out = line
	if (o.trimLines) out = out.replace(/[ \t]+$/u, "")
	if (o.collapseSpaces) out = out.replace(/ {2,}/gu, " ")
	return out
}

function one(line: string, o: Options): string {
	const { text, tokens } = protect(pre(line, o), o)
	return unprotect(convertOne(text, o), tokens)
}

export function convertSync(input: string, o: Options): ConvertResult {
	if (input.length === 0) return { text: "", changedLines: 0, totalLines: 0, cancelled: false }
	const ending = detectLineEnding(input)
	if (!o.perLine) {
		const text = one(input, o)
		return { text, changedLines: text === input ? 0 : 1, totalLines: 1, cancelled: false }
	}
	const lines = splitLines(input)
	let changed = 0
	const out = lines.map((line) => {
		const next = one(line, o)
		if (next !== line) changed += 1
		return o.skipUnchanged && next === line ? line : next
	})
	return { text: out.join(ending), changedLines: changed, totalLines: lines.length, cancelled: false }
}

/** F098 — yields to the event loop, so the tab stays alive and Stop works. */
export async function convertChunked(
	input: string,
	o: Options,
	onProgress: (ratio: number) => void,
	isCancelled: () => boolean,
): Promise<ConvertResult> {
	const ending = detectLineEnding(input)
	const lines = splitLines(input)
	const out: string[] = []
	let changed = 0
	let deadline = Date.now() + CHUNK_MS
	for (let i = 0; i < lines.length; i += 1) {
		if (isCancelled()) {
			return { text: "", changedLines: changed, totalLines: lines.length, cancelled: true }
		}
		const line = lines[i] ?? ""
		const next = one(line, o)
		if (next !== line) changed += 1
		out.push(o.skipUnchanged && next === line ? line : next)
		if (Date.now() >= deadline) {
			onProgress((i + 1) / lines.length)
			await new Promise<void>((resolve) => setTimeout(resolve, 0))
			deadline = Date.now() + CHUNK_MS
		}
	}
	onProgress(1)
	return { text: out.join(ending), changedLines: changed, totalLines: lines.length, cancelled: false }
}

/* ===== 7. Insight helpers (F055, F088, F090, F091) ===== */

/** F091 — what style is the input already in? */
export function detectCurrentStyle(input: string): StyleId | null {
	const first = input.trim().split(/\s+/u)[0] ?? ""
	if (first.length === 0) return null
	if (first.includes("_")) return /^[\p{Lu}\p{N}_]+$/u.test(first) ? "screamingSnake" : "snake"
	if (first.includes("-")) return /^[\p{Lu}\p{N}-]+$/u.test(first) ? "screamingKebab" : "kebab"
	if (first.includes(".") && /^[\p{Ll}\p{N}.]+$/u.test(first)) return "dot"
	if (/^\p{Ll}[\p{L}\p{N}]*\p{Lu}/u.test(first)) return "camel"
	if (/^\p{Lu}[\p{Ll}\p{N}]+\p{Lu}/u.test(first)) return "pascal"
	if (input === input.toUpperCase() && /\p{Lu}/u.test(input)) return "upper"
	if (input === input.toLowerCase() && /\p{Ll}/u.test(input)) return "lower"
	return null
}

/** F055 — how much actually changed. */
export function diffSummary(before: string, after: string): { chars: number; words: number } {
	const a = toGraphemes(before)
	const b = toGraphemes(after)
	let chars = 0
	for (let i = 0; i < Math.max(a.length, b.length); i += 1) if (a[i] !== b[i]) chars += 1
	const wa = before.match(WORD_RE) ?? []
	const wb = after.match(WORD_RE) ?? []
	let words = Math.abs(wa.length - wb.length)
	for (let i = 0; i < Math.min(wa.length, wb.length); i += 1) if (wa[i] !== wb[i]) words += 1
	return { chars, words }
}

/* ===== 8. Export (F019–F024, F029) ===== */

export type ExportFormat = "txt" | "md" | "json" | "csv" | "html"

export const MIME: Record<ExportFormat, string> = {
	txt: "text/plain;charset=utf-8",
	md: "text/markdown;charset=utf-8",
	json: "application/json;charset=utf-8",
	csv: "text/csv;charset=utf-8",
	html: "text/html;charset=utf-8",
}

/** F022 — neutralise spreadsheet formula injection. */
export const csvCell = (v: string): string =>
	`"${(/^[=+\-@\t\r]/u.test(v) ? `'${v}` : v).replace(/"/gu, '""')}"`

const esc = (v: string): string =>
	v
		.replace(/&/gu, "&amp;")
		.replace(/</gu, "&lt;")
		.replace(/>/gu, "&gt;")
		.replace(/"/gu, "&quot;")

/** F024 — a record of exactly which settings produced this output. */
export function buildReceipt(o: Options): string {
	const changed = (Object.keys(DEFAULTS) as Array<keyof Options>)
		.filter((k) => o[k] !== DEFAULTS[k])
		.map((k) => `${k}=${String(o[k])}`)
	return [
		"Tool: Text Case Converter",
		`Style: ${BY_ID.get(o.style)?.label ?? o.style}`,
		`Generated: ${new Date().toISOString()}`,
		`Non-default settings: ${changed.length > 0 ? changed.join(", ") : "none"}`,
	].join("\n")
}

export function serialize(
	format: ExportFormat,
	input: string,
	output: string,
	o: Options,
): string {
	const receipt = buildReceipt(o)
	if (format === "txt") return output
	if (format === "md") {
		const notes = receipt
			.split("\n")
			.map((l) => `- ${l}`)
			.join("\n")
		return `# Case conversion result\n\n\`\`\`\n${output}\n\`\`\`\n\n---\n\n${notes}\n`
	}
	if (format === "json") {
		return JSON.stringify({ tool: "case-converter", options: o, input, output, receipt }, null, 2)
	}
	if (format === "csv") {
		const a = splitLines(input)
		const b = splitLines(output)
		const rows = ["line,original,converted"]
		for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
			rows.push([String(i + 1), csvCell(a[i] ?? ""), csvCell(b[i] ?? "")].join(","))
		}
		return rows.join("\n")
	}
	return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>Case conversion result</title></head><body><h1>Case conversion result</h1><pre>${esc(output)}</pre><hr><pre>${esc(receipt)}</pre></body></html>\n`
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

/* ===== 9. Storage and hooks (F012, F046, F058–F062, F079) ===== */

const PREFIX = "unqtools:case-converter"
export const MAX_HISTORY = 20
export const MAX_PRESETS = 12
const DRAFT_MAX_AGE = 7 * 24 * 60 * 60 * 1000

function readJson<T>(key: string, fallback: T): T {
	if (typeof window === "undefined") return fallback
	try {
		const raw = window.localStorage.getItem(key)
		return raw ? (JSON.parse(raw) as T) : fallback
	} catch {
		return fallback
	}
}

function writeJson(key: string, value: unknown): void {
	if (typeof window === "undefined") return
	try {
		window.localStorage.setItem(key, JSON.stringify(value))
	} catch {
		// Private mode or a full quota. Losing a preference is not worth an error.
	}
}

/** F079 — one call deletes everything this tool stored. */
export function clearAllStorage(): void {
	if (typeof window === "undefined") return
	const doomed: string[] = []
	for (let i = 0; i < window.localStorage.length; i += 1) {
		const key = window.localStorage.key(i)
		if (key && key.startsWith(PREFIX)) doomed.push(key)
	}
	for (const key of doomed) window.localStorage.removeItem(key)
}

/** F046 — settings survive a reload, without a hydration mismatch. */
export function usePersisted<T>(key: string, initial: T): [T, (next: T) => void] {
	const [value, setValue] = useState<T>(initial)
	const hydrated = useRef(false)
	useEffect(() => {
		setValue(readJson<T>(`${PREFIX}:${key}`, initial))
		hydrated.current = true
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key])
	const update = useCallback(
		(next: T) => {
			setValue(next)
			if (hydrated.current) writeJson(`${PREFIX}:${key}`, next)
		},
		[key],
	)
	return [value, update]
}

export type HistoryEntry = {
	id: string
	at: number
	snippet: string
	style: StyleId
	pinned: boolean
}

/** F058–F061 — recent results, pinnable, restorable, clearable. */
export function useHistory(): {
	entries: HistoryEntry[]
	add: (snippet: string, style: StyleId) => void
	togglePin: (id: string) => void
	remove: (id: string) => void
	clearAll: () => void
} {
	const [entries, setEntries] = usePersisted<HistoryEntry[]>("history", [])
	const add = useCallback(
		(snippet: string, style: StyleId) => {
			if (snippet.trim().length === 0) return
			const text = snippet.slice(0, 2000)
			setEntries(
				[
					{
						id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
						at: Date.now(),
						snippet: text,
						style,
						pinned: false,
					},
					...entries.filter((e) => e.snippet !== text),
				]
					.sort((a, b) => Number(b.pinned) - Number(a.pinned))
					.slice(0, MAX_HISTORY),
			)
		},
		[entries, setEntries],
	)
	return {
		entries,
		add,
		togglePin: (id: string) =>
			setEntries(entries.map((e) => (e.id === id ? { ...e, pinned: !e.pinned } : e))),
		remove: (id: string) => setEntries(entries.filter((e) => e.id !== id)),
		clearAll: () => setEntries([]),
	}
}

/** F012, F062 — a draft is offered, never applied silently. */
export function useDraft(text: string): { draft: string | null; dismiss: () => void } {
	const [draft, setDraft] = useState<string | null>(null)
	useEffect(() => {
		const saved = readJson<{ at: number; text: string } | null>(`${PREFIX}:draft`, null)
		if (saved && Date.now() - saved.at < DRAFT_MAX_AGE && saved.text.trim().length > 0) {
			setDraft(saved.text)
		}
	}, [])
	useEffect(() => {
		const timer = setTimeout(() => {
			if (text.length > 0 && text.length < 256_000) {
				writeJson(`${PREFIX}:draft`, { at: Date.now(), text })
			}
		}, 1200)
		return () => clearTimeout(timer)
	}, [text])
	return { draft, dismiss: () => setDraft(null) }
}

/** F049–F051 — undo, redo, and typing coalesced into one step. */
export function useUndoRedo(
	value: string,
	setValue: (next: string) => void,
): { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean } {
	const past = useRef<string[]>([])
	const future = useRef<string[]>([])
	const lastPush = useRef(0)
	const current = useRef(value)
	const [, force] = useState(0)

	useEffect(() => {
		if (value === current.current) return
		const now = Date.now()
		if (now - lastPush.current > 500) {
			past.current = [...past.current, current.current].slice(-50)
			future.current = []
			lastPush.current = now
			force((n) => n + 1)
		}
		current.current = value
	}, [value])

	return {
		canUndo: past.current.length > 0,
		canRedo: future.current.length > 0,
		undo: () => {
			const prev = past.current.pop()
			if (prev === undefined) return
			future.current = [current.current, ...future.current]
			current.current = prev
			setValue(prev)
			force((n) => n + 1)
		},
		redo: () => {
			const [next, ...rest] = future.current
			if (next === undefined) return
			future.current = rest
			past.current = [...past.current, current.current]
			current.current = next
			setValue(next)
			force((n) => n + 1)
		},
	}
}

/* ===== 10. Content: samples, presets, help, aliases ===== */

export const SAMPLES: ReadonlyArray<{ label: string; hint: string; text: string }> = [
	{
		label: "Plain sentence",
		hint: "The simplest case.",
		text: "the quick brown fox jumps over the lazy dog",
	},
	{
		label: "Non-English",
		hint: "Accented and Telugu text must survive. The old tool deleted it.",
		text: "caf\u00e9 na\u00efve stra\u00dfe\n\u0c28\u0c2e\u0c38\u0c4d\u0c24\u0c47 \u0c2a\u0c4d\u0c30\u0c2a\u0c02\u0c1a\u0c02\n\u0939\u093f\u0902\u0926\u0940 \u0932\u093f\u0916\u093e\u0935\u091f",
	},
	{
		label: "Acronyms",
		hint: "NASA and API must stay uppercase.",
		text: "the NASA API guide for HTTP and JSON over SSH",
	},
	{
		label: "Messy code names",
		hint: "camelCase, snake_case and kebab-case in one paste.",
		text: "getUserByID\nuser_first_name\nmax-retry-count\nHTTPResponseCode",
	},
	{
		label: "Template placeholders",
		hint: "{{name}} must not change.",
		text: "hello {{firstName}}, your order ${orderId} has shipped",
	},
]

export type Preset = {
	id: string
	label: string
	description: string
	values: Partial<Options>
}

export const PRESETS: readonly Preset[] = [
	{
		id: "code-identifier",
		label: "Code identifier",
		description: "camelCase, acronyms kept, one per line.",
		values: { style: "camel", perLine: true },
	},
	{
		id: "blog-headline",
		label: "Blog headline",
		description: "AP title case, small words lowercase.",
		values: { style: "titleAp" },
	},
	{
		id: "db-column",
		label: "Database column",
		description: "snake_case, numbers separated.",
		values: { style: "snake", perLine: true, numberHandling: "separate" },
	},
	{
		id: "csv-header",
		label: "CSV header",
		description: "Spreadsheet-safe snake_case.",
		values: { style: "csvHeader", perLine: true, collapseSpaces: true },
	},
	{
		id: "env-var",
		label: "Env variable",
		description: "SCREAMING_SNAKE_CASE per line.",
		values: { style: "envVar", perLine: true },
	},
	{
		id: "url-slug",
		label: "URL slug",
		description: "Transliterated, lowercase, hyphenated.",
		values: { style: "slug", perLine: true, collapseSpaces: true },
	},
]

export const HOW_TO: ReadonlyArray<{ name: string; text: string }> = [
	{ name: "Add your text", text: "Type it, paste it, drop a file in, or load a sample." },
	{ name: "Pick a style", text: "Choose one of 30 styles, or press Ctrl+K to search them." },
	{
		name: "Adjust the settings",
		text: "Turn on per-line mode for lists, or protect placeholders and quoted text.",
	},
	{ name: "Take the result", text: "Copy it, or download TXT, Markdown, JSON, CSV or HTML." },
]

export const FAQ: ReadonlyArray<{ question: string; answer: string }> = [
	{
		question: "Does this work with non-English text?",
		answer:
			"Yes. Accented Latin, Telugu, Hindi, Arabic, Cyrillic, Greek, Chinese, Japanese, Korean, Hebrew and Thai are all handled. Words are split on Unicode letter boundaries, so nothing is deleted.",
	},
	{
		question: "Why did other tools mangle my accented text?",
		answer:
			"Most case converters split words with [^a-zA-Z0-9]. That treats \u00e9, \u00f1 and \u0c24 as separators and silently deletes them. This tool does not use that pattern.",
	},
	{
		question: "Can I keep acronyms like NASA and API uppercase?",
		answer:
			"Yes, and it is on by default. Add your own to the acronym list in the advanced settings.",
	},
	{
		question: "What does the Turkish or German locale change?",
		answer:
			"Turkish uppercases i to \u0130 rather than I, and German uppercases \u00df to SS. Set the locale so the result is correct for your language.",
	},
	{
		question: "Can I convert only some lines?",
		answer:
			"Turn on per-line mode and each line is converted independently. Select text in the box and use Convert selection to change only that part.",
	},
	{
		question: "Will it break my {{placeholders}}?",
		answer:
			"No. Protecting {{braces}} and ${templates} is on by default. You can also protect quoted text or any pattern you supply.",
	},
	{
		question: "Is my text uploaded anywhere?",
		answer:
			"No. Everything runs in your browser. There is no network request in this tool at all, and it works with the internet switched off.",
	},
	{
		question: "Is the conversion reversible?",
		answer:
			"Usually not, and the tool warns you when it is not. Once a sentence becomes snake_case, the original spacing and capitalisation are gone. Keep your original, or use undo.",
	},
	{
		question: "Is there a size limit?",
		answer:
			"Five million characters. Above 250 KB the work is chunked so the page stays responsive, with progress and a Stop button.",
	},
]

export const ALIASES: readonly string[] = [
	"uppercase converter",
	"lowercase converter",
	"title case generator",
	"camelcase converter",
	"snake case converter",
	"kebab case",
	"capitalize each word",
	"sentence case fixer",
	"change text case online",
	"caps lock fixer",
	"slug generator",
	"env variable name generator",
]

export const RELATED: ReadonlyArray<{ id: string; label: string; why: string }> = [
	{ id: "text-trimmer", label: "Text Trimmer", why: "Clean whitespace before converting." },
	{ id: "text-finder-replacer", label: "Find and Replace", why: "Change words, not just their case." },
	{ id: "text-statistics", label: "Text Statistics", why: "Full counts and readability." },
	{ id: "duplicate-lines-remover", label: "Remove Duplicate Lines", why: "Tidy a list first." },
]

/** F083 — the tool names its own limits instead of hiding them. */
export const ASSUMPTIONS: readonly string[] = [
	"Title case rules differ between style guides. AP and Chicago here are approximations, not a substitute for your editor.",
	"Sentence detection uses . ! ? and the Devanagari danda. Abbreviations like Dr. may start a new sentence incorrectly.",
	"Scripts without letter case are returned unchanged by the case styles, which is correct.",
]

export const SHORTCUTS: ReadonlyArray<{ keys: string; label: string }> = [
	{ keys: "Ctrl/Cmd + K", label: "Search the styles" },
	{ keys: "Ctrl/Cmd + Shift + C", label: "Copy the result" },
	{ keys: "Ctrl/Cmd + Z", label: "Undo" },
	{ keys: "Ctrl/Cmd + Shift + Z", label: "Redo" },
	{ keys: "Ctrl/Cmd + Shift + X", label: "Use the result as the new input" },
	{ keys: "?", label: "Show this list" },
	{ keys: "Esc", label: "Close a dialog" },
]


// ============================================================================
// Backward-compat shims — expose the legacy 11 case functions + CASE_OPTIONS
// that logic.test.ts expects. Maps legacy names → 100x StyleId values.
// ============================================================================

export function toUpperCase(input: string): string {
  return convertOne(input, { ...DEFAULTS, style: "upper" });
}
export function toLowerCase(input: string): string {
  return convertOne(input, { ...DEFAULTS, style: "lower" });
}
export function toTitleCase(input: string): string {
  return convertOne(input, { ...DEFAULTS, style: "title" });
}
export function toSentenceCase(input: string): string {
  return convertOne(input, { ...DEFAULTS, style: "sentence" });
}
export function toCamelCase(input: string): string {
  return convertOne(input, { ...DEFAULTS, style: "camel" });
}
export function toPascalCase(input: string): string {
  return convertOne(input, { ...DEFAULTS, style: "pascal" });
}
export function toSnakeCase(input: string): string {
  return convertOne(input, { ...DEFAULTS, style: "snake" });
}
export function toKebabCase(input: string): string {
  return convertOne(input, { ...DEFAULTS, style: "kebab" });
}
export function toConstantCase(input: string): string {
  // Legacy "constant case" = SCREAMING_SNAKE_CASE
  return convertOne(input, { ...DEFAULTS, style: "screamingSnake" });
}
export function toDotCase(input: string): string {
  return convertOne(input, { ...DEFAULTS, style: "dot" });
}
export function toAlternatingCase(input: string): string {
  return convertOne(input, { ...DEFAULTS, style: "alternating" });
}
export function convertCase(input: string, style: string): string {
  // Legacy convertCase takes a style name string. Map common aliases.
  const styleMap: Record<string, string> = {
    upper: "upper", upperCase: "upper", uppercase: "upper",
    lower: "lower", lowerCase: "lower", lowercase: "lower",
    title: "title", titleCase: "title",
    sentence: "sentence", sentenceCase: "sentence",
    camel: "camel", camelCase: "camel",
    pascal: "pascal", pascalCase: "pascal",
    snake: "snake", snakeCase: "snake",
    kebab: "kebab", kebabCase: "kebab",
    constant: "screamingSnake", constantCase: "screamingSnake",
    dot: "dot", dotCase: "dot",
    alternating: "alternating", alternatingCase: "alternating",
  };
  const mapped = styleMap[style] ?? style;
  return convertOne(input, { ...DEFAULTS, style: mapped as any });
}

export const CASE_OPTIONS: Array<{ value: string; label: string; example: string }> = [
  { value: "upper", label: "UPPER CASE", example: "HELLO WORLD" },
  { value: "lower", label: "lower case", example: "hello world" },
  { value: "title", label: "Title Case", example: "Hello World" },
  { value: "sentence", label: "Sentence case", example: "Hello world" },
  { value: "camel", label: "camelCase", example: "helloWorld" },
  { value: "pascal", label: "PascalCase", example: "HelloWorld" },
  { value: "snake", label: "snake_case", example: "hello_world" },
  { value: "kebab", label: "kebab-case", example: "hello-world" },
  { value: "constant", label: "CONSTANT_CASE", example: "HELLO_WORLD" },
  { value: "dot", label: "dot.case", example: "hello.world" },
  { value: "alternating", label: "aLtErNaTiNg", example: "hElLo" },
];
