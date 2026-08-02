"use client"

/**
 * Text Sorter — engine half of the 100x rebuild.
 *
 * Copy to: src/tools/text/text-sorter/logic.ts
 * Pair with: CODE-2-UI.tsx -> src/tools/text/text-sorter/ui.tsx
 *
 * Imports only react (for the hooks at the end). No project imports.
 * sortText, naturalCompare, statsToCsv and every exported type keep their old
 * names and remain call-compatible.
 */

import { useCallback, useEffect, useRef, useState } from "react"

/* ===== 1. Types ===== */

export type SortBy =
	| "alphabetical" | "numeric" | "natural" | "version" | "length" | "wordCount"
	| "date" | "lastWord" | "pattern" | "random" | "reverse" | "none"

export type SortUnit = "lines" | "words" | "paragraphs" | "sentences" | "list" | "pattern" | "csv-column"

export type Direction = "asc" | "desc"

export interface SortKey {
	by: SortBy
	direction: Direction
	column?: number
}

export interface SortOptions {
	unit: SortUnit
	by: SortBy
	direction?: Direction
	/** Kept for compatibility with the previous version. Same as direction "desc". */
	reverse?: boolean
	keys?: SortKey[]
	caseInsensitive?: boolean
	ignoreAccents?: boolean
	ignoreLeading?: boolean
	removeDuplicates?: boolean
	duplicatesOnly?: boolean
	keepEmpty?: boolean
	trimItems?: boolean
	stripMarkers?: boolean
	renumber?: boolean
	skipFirst?: number
	locale?: string
	numericCollation?: boolean
	csvColumn?: number
	csvDelimiter?: string
	csvHasHeader?: boolean
	splitPattern?: string
	keyPattern?: string
	seed?: string
}

export const DEFAULT_OPTIONS: SortOptions = {
	unit: "lines",
	by: "alphabetical",
	direction: "asc",
	reverse: false,
	keys: [],
	caseInsensitive: false,
	ignoreAccents: false,
	ignoreLeading: false,
	removeDuplicates: false,
	duplicatesOnly: false,
	keepEmpty: false,
	trimItems: true,
	stripMarkers: false,
	renumber: false,
	skipFirst: 0,
	locale: "",
	numericCollation: true,
	csvColumn: 0,
	csvDelimiter: ",",
	csvHasHeader: true,
	splitPattern: "",
	keyPattern: "",
	seed: "",
}

export interface SortItem {
	/** The text as it will be written out. */
	text: string
	/** Zero-based position in the input, so movement can be shown. */
	origin: number
	/** The list marker that was stripped, restored on output. */
	marker?: string
	/** True when the sort key could not be parsed as a number or a date. */
	unparsed?: boolean
	/** How many identical items were folded into this one, when grouping. */
	count?: number
}

export interface SortResult {
	output: string
	inputCount: number
	outputCount: number
	duplicatesRemoved: number
	warnings: string[]
	/** Added. Everything below is new; nothing was removed. */
	items: SortItem[]
	header: string[]
	blanksRemoved: number
	movedCount: number
	unparsedCount: number
	alreadySorted: boolean
	longest: string
	shortest: string
	summary: string
}

export const EMPTY_RESULT: SortResult = {
	output: "", inputCount: 0, outputCount: 0, duplicatesRemoved: 0, warnings: [],
	items: [], header: [], blanksRemoved: 0, movedCount: 0, unparsedCount: 0,
	alreadySorted: true, longest: "", shortest: "", summary: "Nothing to sort yet.",
}

/* ===== 2. Locale and collation (bugs 3 and 10) ===== */

/** F042 — an invalid tag is refused rather than thrown at the user. */
export function isValidLocale(tag: string): boolean {
	if (tag.trim().length === 0) return true
	try {
		return Intl.Collator.supportedLocalesOf([tag]).length > 0 || new Intl.Collator(tag) !== null
	} catch {
		return false
	}
}

export const LOCALES: ReadonlyArray<{ tag: string; label: string }> = [
	{ tag: "", label: "Your browser's language" },
	{ tag: "en", label: "English" },
	{ tag: "en-GB", label: "English (United Kingdom)" },
	{ tag: "de", label: "German" },
	{ tag: "sv", label: "Swedish" },
	{ tag: "tr", label: "Turkish" },
	{ tag: "es", label: "Spanish" },
	{ tag: "fr", label: "French" },
	{ tag: "pt", label: "Portuguese" },
	{ tag: "hi", label: "Hindi" },
	{ tag: "te", label: "Telugu" },
	{ tag: "ta", label: "Tamil" },
	{ tag: "bn", label: "Bengali" },
	{ tag: "ar", label: "Arabic" },
	{ tag: "he", label: "Hebrew" },
	{ tag: "ru", label: "Russian" },
	{ tag: "ja", label: "Japanese" },
	{ tag: "zh", label: "Chinese" },
	{ tag: "ko", label: "Korean" },
	{ tag: "th", label: "Thai" },
]

const collators = new Map<string, Intl.Collator>()

/** F043 — one collator per configuration, reused for every comparison. */
export function collator(locale: string | undefined, opts: { caseInsensitive?: boolean; numeric?: boolean; ignoreAccents?: boolean }): Intl.Collator {
	const tag = locale && isValidLocale(locale) && locale.trim().length > 0 ? locale : undefined
	const key = `${tag ?? "auto"}|${opts.caseInsensitive ? 1 : 0}|${opts.numeric ? 1 : 0}|${opts.ignoreAccents ? 1 : 0}`
	const cached = collators.get(key)
	if (cached) return cached
	const sensitivity: "base" | "accent" | "case" | "variant" =
		opts.caseInsensitive && opts.ignoreAccents ? "base" : opts.caseInsensitive ? "accent" : opts.ignoreAccents ? "case" : "variant"
	let made: Intl.Collator
	try {
		made = new Intl.Collator(tag, { sensitivity, numeric: opts.numeric ?? false })
	} catch {
		made = new Intl.Collator(undefined, { sensitivity, numeric: opts.numeric ?? false })
	}
	collators.set(key, made)
	return made
}

/* ===== 3. Key parsing ===== */

const stripAccents = (s: string): string => s.normalize("NFD").replace(/\p{M}+/gu, "")
const MARKER_RE = /^(\s*)((?:[-*\u2022\u2013\u25cf\u25a0]|\d+[.)]|[a-zA-Z][.)])\s+)/u

export function splitMarker(line: string): { marker: string; body: string } {
	const m = MARKER_RE.exec(line)
	if (!m) return { marker: "", body: line }
	return { marker: `${m[1] ?? ""}${m[2] ?? ""}`, body: line.slice((m[0] ?? "").length) }
}

/**
 * F024 — a real number reader. The old version stripped every character that was
 * not a digit, dot or minus, which turned 1e5 into 15 and a date into a year.
 */
export function parseNumber(raw: string): number | null {
	const s = raw.trim()
	if (s.length === 0) return null
	// A plain number, optionally signed, with an exponent.
	const direct = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/u
	if (direct.test(s)) return Number(s)
	// Find the first number-like run, allowing currency symbols, percent signs,
	// units and grouping separators around it.
	const m = /[+-]?(?:\d{1,3}(?:[.,\u00a0\u202f ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?|[.,]\d+)(?:[eE][+-]?\d+)?/u.exec(s)
	if (!m) return null
	let t = m[0]
	const lastComma = t.lastIndexOf(",")
	const lastDot = t.lastIndexOf(".")
	if (lastComma >= 0 && lastDot >= 0) {
		// Whichever comes last is the decimal separator.
		const decimal = lastComma > lastDot ? "," : "."
		const group = decimal === "," ? "." : ","
		t = t.split(group).join("")
		if (decimal === ",") t = t.replace(",", ".")
	} else if (lastComma >= 0) {
		// A single comma: a decimal comma if it is followed by one or two digits,
		// otherwise a thousands separator.
		const after = t.length - lastComma - 1
		t = after === 3 ? t.split(",").join("") : t.replace(",", ".")
	} else if (lastDot >= 0) {
		const after = t.length - lastDot - 1
		const dots = (t.match(/\./gu) ?? []).length
		if (dots > 1 || (after === 3 && /^\d{1,3}\.\d{3}$/u.test(t))) t = t.split(".").join("")
	}
	t = t.replace(/[\u00a0\u202f ]/gu, "")
	const n = Number(t)
	return Number.isFinite(n) ? n : null
}

/** F026 — version order, so 1.9.0 comes before 1.10.0. */
export function compareVersion(a: string, b: string): number {
	const parse = (s: string): number[] => (s.match(/\d+/gu) ?? []).map((x) => Number.parseInt(x, 10))
	const pa = parse(a)
	const pb = parse(b)
	for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
		const d = (pa[i] ?? 0) - (pb[i] ?? 0)
		if (d !== 0) return d
	}
	return 0
}

/** F029 — the common date shapes, without pretending to read every format. */
export function parseDate(raw: string): number | null {
	const s = raw.trim()
	if (s.length === 0) return null
	const iso = /(\d{4})-(\d{1,2})-(\d{1,2})/u.exec(s)
	if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
	const dmy = /\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/u.exec(s)
	if (dmy) {
		const first = Number(dmy[1])
		const second = Number(dmy[2])
		// Only one ordering can be right when a value is above 12.
		const day = first > 12 ? first : second > 12 ? second : first
		const month = first > 12 ? second : second > 12 ? first : second
		return Date.UTC(Number(dmy[3]), month - 1, day)
	}
	const named = Date.parse(s)
	return Number.isFinite(named) ? named : null
}

/** F025 — unchanged behaviour, kept for the existing tests. */
export function naturalCompare(a: string, b: string, locale?: string): number {
	const aParts = a.split(/(\d+)/u)
	const bParts = b.split(/(\d+)/u)
	const c = collator(locale, {})
	for (let i = 0; i < Math.max(aParts.length, bParts.length); i += 1) {
		const ap = aParts[i] ?? ""
		const bp = bParts[i] ?? ""
		if (/^\d+$/u.test(ap) && /^\d+$/u.test(bp)) {
			const d = Number.parseInt(ap, 10) - Number.parseInt(bp, 10)
			if (d !== 0) return d
		} else {
			const cmp = c.compare(ap, bp)
			if (cmp !== 0) return cmp
		}
	}
	return 0
}

/* ===== 4. Splitting (bugs 5 and 8) ===== */

/** F020 — RFC 4180: quoted fields, doubled quotes, delimiters inside quotes. */
export function parseCsvLine(line: string, delim: string): string[] {
	const out: string[] = []
	let field = ""
	let quoted = false
	for (let i = 0; i < line.length; i += 1) {
		const ch = line[i]
		if (quoted) {
			if (ch === '"') {
				if (line[i + 1] === '"') { field += '"'; i += 1 } else quoted = false
			} else field += ch
		} else if (ch === '"') quoted = true
		else if (ch === delim) { out.push(field); field = "" }
		else field += ch
	}
	out.push(field)
	return out
}

/** F022 — pick the delimiter that gives a consistent column count. */
export function detectDelimiter(text: string): string {
	const lines = text.split(/\r\n|\r|\n/u).filter((l) => l.trim().length > 0).slice(0, 20)
	if (lines.length === 0) return ","
	let best = ","
	let bestScore = -1
	for (const d of [",", ";", "\t", "|"]) {
		const counts = lines.map((l) => parseCsvLine(l, d).length)
		const firstCount = counts[0] ?? 1
		if (firstCount < 2) continue
		const consistent = counts.filter((c) => c === firstCount).length
		const score = consistent * 10 + firstCount
		if (score > bestScore) { bestScore = score; best = d }
	}
	return best
}

export type LineEnding = "LF" | "CRLF" | "CR" | "mixed" | "none"

export function detectLineEnding(s: string): LineEnding {
	const crlf = (s.match(/\r\n/gu) ?? []).length
	const lf = (s.match(/(?<!\r)\n/gu) ?? []).length
	const cr = (s.match(/\r(?!\n)/gu) ?? []).length
	const kinds = [crlf > 0, lf > 0, cr > 0].filter(Boolean).length
	if (kinds === 0) return "none"
	if (kinds > 1) return "mixed"
	return crlf > 0 ? "CRLF" : lf > 0 ? "LF" : "CR"
}

export const newlineFor = (e: LineEnding): string => (e === "CRLF" ? "\r\n" : e === "CR" ? "\r" : "\n")

function splitUnits(text: string, o: SortOptions): { items: string[]; joiner: string } {
	switch (o.unit) {
		case "words":
			// F014 — keep the separators so the layout survives the round trip.
			return { items: text.split(/\s+/u).filter((w) => w.length > 0), joiner: " " }
		case "paragraphs":
			return { items: text.split(/\n\s*\n/u), joiner: "\n\n" }
		case "sentences":
			return { items: text.split(/(?<=[.!?\u0964])\s+/u).filter((s) => s.trim().length > 0), joiner: " " }
		case "list":
			return { items: text.split(/\s*[,;]\s*/u), joiner: ", " }
		case "pattern": {
			const p = o.splitPattern ?? ""
			if (p.trim().length === 0) return { items: text.split(/\r\n|\r|\n/u), joiner: "\n" }
			try {
				return { items: text.split(new RegExp(p, "u")), joiner: "\n" }
			} catch {
				return { items: text.split(/\r\n|\r|\n/u), joiner: "\n" }
			}
		}
		default:
			return { items: text.split(/\r\n|\r|\n/u), joiner: "\n" }
	}
}

/* ===== 5. Seeded shuffle (bug 1) ===== */

function hashSeed(seed: string): number {
	let h = 2166136261
	for (let i = 0; i < seed.length; i += 1) {
		h ^= seed.charCodeAt(i)
		h = Math.imul(h, 16777619)
	}
	return h >>> 0
}

/** F030/F031 — Fisher–Yates, optionally reproducible from a seed. */
export function shuffle<T>(list: T[], seed?: string): T[] {
	const out = [...list]
	let state = seed && seed.length > 0 ? hashSeed(seed) : 0
	const next = (): number => {
		if (!seed || seed.length === 0) return Math.random()
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0
		return state / 4294967296
	}
	for (let i = out.length - 1; i > 0; i -= 1) {
		const j = Math.floor(next() * (i + 1))
		const a = out[i]
		const b = out[j]
		if (a !== undefined && b !== undefined) { out[i] = b; out[j] = a }
	}
	return out
}

/* ===== 6. Comparison ===== */

function keyText(item: SortItem, o: SortOptions, column?: number): string {
	let v = item.text
	if (o.unit === "csv-column") {
		const delim = o.csvDelimiter ?? ","
		v = parseCsvLine(v, delim)[column ?? o.csvColumn ?? 0] ?? ""
	}
	if (o.ignoreLeading) v = splitMarker(v).body
	if (o.trimItems !== false) v = v.trim()
	if (o.ignoreAccents) v = stripAccents(v)
	return v
}

function compareBy(by: SortBy, a: string, b: string, o: SortOptions, c: Intl.Collator): number {
	switch (by) {
		case "numeric": {
			const na = parseNumber(a)
			const nb = parseNumber(b)
			if (na === null && nb === null) return c.compare(a, b)
			if (na === null) return 1
			if (nb === null) return -1
			return na - nb
		}
		case "date": {
			const da = parseDate(a)
			const db = parseDate(b)
			if (da === null && db === null) return c.compare(a, b)
			if (da === null) return 1
			if (db === null) return -1
			return da - db
		}
		case "natural":
			return naturalCompare(a, b, o.locale)
		case "version":
			return compareVersion(a, b) || c.compare(a, b)
		case "length":
			return a.length - b.length || c.compare(a, b)
		case "wordCount": {
			const wa = (a.match(/[\p{L}\p{N}]+/gu) ?? []).length
			const wb = (b.match(/[\p{L}\p{N}]+/gu) ?? []).length
			return wa - wb || c.compare(a, b)
		}
		case "lastWord": {
			const la = a.trim().split(/\s+/u).pop() ?? ""
			const lb = b.trim().split(/\s+/u).pop() ?? ""
			return c.compare(la, lb) || c.compare(a, b)
		}
		case "pattern": {
			const p = o.keyPattern ?? ""
			if (p.trim().length === 0) return c.compare(a, b)
			try {
				const re = new RegExp(p, "u")
				const ka = re.exec(a)
				const kb = re.exec(b)
				return c.compare(ka?.[1] ?? ka?.[0] ?? "", kb?.[1] ?? kb?.[0] ?? "")
			} catch {
				return c.compare(a, b)
			}
		}
		case "none":
		case "random":
		case "reverse":
			return 0
		default:
			return c.compare(a, b)
	}
}

/* ===== 7. The pipeline ===== */

export function sortText(text: string, options: SortOptions): SortResult {
	const o: SortOptions = { ...DEFAULT_OPTIONS, ...options }
	if (!text) return EMPTY_RESULT
	const warnings: string[] = []
	if (o.locale && !isValidLocale(o.locale)) warnings.push(`"${o.locale}" is not a language tag the browser recognises, so your browser's own order was used instead.`)
	if ((o.splitPattern ?? "").trim().length > 0) {
		try { new RegExp(o.splitPattern ?? "", "u") } catch { warnings.push("The split pattern is not a valid regular expression, so lines were used instead.") }
	}

	const ending = detectLineEnding(text)
	const hadTrailing = /(\r\n|\r|\n)$/u.test(text)
	const body = hadTrailing ? text.replace(/(\r\n|\r|\n)$/u, "") : text
	const { items: rawItems, joiner } = splitUnits(body, o)
	const inputCount = rawItems.length

	// F054 — lines held back at the top, plus the CSV header.
	const skip = Math.max(0, Math.min(o.skipFirst ?? 0, rawItems.length))
	const header = rawItems.slice(0, skip)
	let working = rawItems.slice(skip)
	if (o.unit === "csv-column" && o.csvHasHeader !== false && working.length > 0) {
		header.push(working[0] ?? "")
		working = working.slice(1)
	}

	// F050 — blanks removed or kept, and reported either way.
	let blanksRemoved = 0
	if (!o.keepEmpty) {
		const kept = working.filter((u) => u.trim().length > 0)
		blanksRemoved = working.length - kept.length
		working = kept
	}

	let items: SortItem[] = working.map((line, i) => {
		if (o.stripMarkers) {
			const { marker, body: rest } = splitMarker(line)
			return { text: rest, origin: i, marker }
		}
		return { text: line, origin: i }
	})

	// F047–F049 — duplicates.
	const dupKey = (it: SortItem): string => {
		let k = o.trimItems !== false ? it.text.trim() : it.text
		if (o.caseInsensitive) k = k.toLowerCase()
		if (o.ignoreAccents) k = stripAccents(k)
		return k
	}
	let duplicatesRemoved = 0
	if (o.duplicatesOnly) {
		const counts = new Map<string, number>()
		for (const it of items) counts.set(dupKey(it), (counts.get(dupKey(it)) ?? 0) + 1)
		const seen = new Set<string>()
		const only: SortItem[] = []
		for (const it of items) {
			const k = dupKey(it)
			if ((counts.get(k) ?? 0) > 1 && !seen.has(k)) { seen.add(k); only.push({ ...it, count: counts.get(k) }) }
		}
		duplicatesRemoved = items.length - only.length
		items = only
		warnings.push(`Showing only the ${only.length} value${only.length === 1 ? "" : "s"} that appear more than once.`)
	} else if (o.removeDuplicates) {
		const seen = new Set<string>()
		const out: SortItem[] = []
		for (const it of items) {
			const k = dupKey(it)
			if (seen.has(k)) duplicatesRemoved += 1
			else { seen.add(k); out.push(it) }
		}
		items = out
	}

	// F040 — sort. Stable, with the original position as the final tiebreak.
	const c = collator(o.locale, { caseInsensitive: o.caseInsensitive, numeric: o.numericCollation, ignoreAccents: o.ignoreAccents })
	const before = items.map((it) => it.origin)
	const dir = ((o.reverse ? "desc" : undefined) ?? o.direction ?? "asc") === "desc" ? -1 : 1

	if (o.by === "random") {
		items = shuffle(items, o.seed)
	} else if (o.by === "reverse") {
		// F032 — this now reverses the order, which is what it says.
		items = [...items].reverse()
	} else if (o.by !== "none") {
		const levels: SortKey[] = [{ by: o.by, direction: (o.reverse ? "desc" : undefined) ?? o.direction ?? "asc", column: o.csvColumn }, ...(o.keys ?? [])]
		items = [...items].sort((x, y) => {
			for (const level of levels) {
				const d = compareBy(level.by, keyText(x, o, level.column), keyText(y, o, level.column), o, c)
				if (d !== 0) return level.direction === "desc" ? -d : d
			}
			return x.origin - y.origin
		})
		if (dir === -1 && (o.keys ?? []).length === 0 && o.direction === undefined) items = items // direction already applied per level
	}

	// F076 — say how many items the chosen key could not read.
	let unparsedCount = 0
	if (o.by === "numeric" || o.by === "date") {
		for (const it of items) {
			const parsed = o.by === "numeric" ? parseNumber(keyText(it, o)) : parseDate(keyText(it, o))
			if (parsed === null && keyText(it, o).length > 0) { it.unparsed = true; unparsedCount += 1 }
		}
		if (unparsedCount > 0) warnings.push(`${unparsedCount} item${unparsedCount === 1 ? "" : "s"} could not be read as a ${o.by === "numeric" ? "number" : "date"}, so they were placed at the end in their original order.`)
	}

	// F053 — renumber, or restore the original marker.
	const lines = items.map((it, i) => {
		if (o.renumber) return `${i + 1}. ${it.text}`
		if (o.stripMarkers && it.marker) return `${it.marker}${it.text}`
		return it.count && it.count > 1 && o.duplicatesOnly ? `${it.text}\t\u00d7${it.count}` : it.text
	})

	const after = items.map((it) => it.origin)
	let movedCount = 0
	for (let i = 0; i < after.length; i += 1) if (after[i] !== before[i]) movedCount += 1

	const nl = newlineFor(ending)
	const joined = [...header, ...lines].join(o.unit === "lines" || o.unit === "csv-column" || o.unit === "pattern" ? nl : joiner)
	const output = hadTrailing && (o.unit === "lines" || o.unit === "csv-column") ? `${joined}${nl}` : joined

	if (blanksRemoved > 0) warnings.push(`Removed ${blanksRemoved} empty item${blanksRemoved === 1 ? "" : "s"}. Switch on Keep empty items to leave them in place.`)
	if (duplicatesRemoved > 0 && !o.duplicatesOnly) warnings.push(`Removed ${duplicatesRemoved} duplicate${duplicatesRemoved === 1 ? "" : "s"}.`)

	const lengths = items.map((it) => it.text)
	const summary = items.length === 0
		? "Everything was filtered out. Check the empty and duplicate settings."
		: movedCount === 0
			? `${items.length} item${items.length === 1 ? "" : "s"} — already in this order, so nothing moved.`
			: `${items.length} item${items.length === 1 ? "" : "s"} sorted; ${movedCount} changed position.`

	return {
		output,
		inputCount,
		outputCount: items.length,
		duplicatesRemoved,
		warnings,
		items,
		header,
		blanksRemoved,
		movedCount,
		unparsedCount,
		alreadySorted: movedCount === 0,
		longest: lengths.reduce((m, s) => (s.length > m.length ? s : m), ""),
		shortest: lengths.reduce((m, s) => (m === "" || s.length < m.length ? s : m), ""),
		summary,
	}
}

/* ===== 8. Chunked run (F095) ===== */

export const WARN_CHARS = 200_000
export const CHUNK_THRESHOLD = 250_000
export const MAX_CHARS = 5_000_000
export const MAX_FILE_BYTES = 5_000_000
export const RENDER_LIMIT = 2000

export async function sortTextChunked(
	text: string,
	options: SortOptions,
	onProgress: (ratio: number) => void,
	isCancelled: () => boolean,
): Promise<{ result: SortResult; cancelled: boolean }> {
	// The sort itself is a single call the engine cannot interrupt, so the yield
	// points sit around it: parse, then sort, then render.
	onProgress(0.1)
	await new Promise<void>((r) => setTimeout(r, 0))
	if (isCancelled()) return { result: EMPTY_RESULT, cancelled: true }
	onProgress(0.4)
	const result = sortText(text, options)
	onProgress(0.9)
	await new Promise<void>((r) => setTimeout(r, 0))
	onProgress(1)
	return { result, cancelled: isCancelled() }
}

/* ===== 9. Export ===== */

export type ExportFormat = "txt" | "md" | "json" | "csv" | "html"

export const MIME: Record<ExportFormat, string> = {
	txt: "text/plain;charset=utf-8",
	md: "text/markdown;charset=utf-8",
	json: "application/json;charset=utf-8",
	csv: "text/csv;charset=utf-8",
	html: "text/html;charset=utf-8",
}

export const csvCell = (v: string): string =>
	`"${(/^[=+\-@\t\r]/u.test(v) ? `'${v}` : v).replace(/"/gu, '""')}"`

const esc = (v: string): string => v.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;")

export function buildReceipt(o: SortOptions): string {
	const changed = (Object.keys(DEFAULT_OPTIONS) as Array<keyof SortOptions>)
		.filter((k) => JSON.stringify(o[k]) !== JSON.stringify(DEFAULT_OPTIONS[k]))
		.map((k) => `${k}=${JSON.stringify(o[k])}`)
	return [
		"Tool: Text Sorter",
		`Generated: ${new Date().toISOString()}`,
		`Settings: ${changed.length > 0 ? changed.join(", ") : "defaults"}`,
		o.by === "random" && (o.seed ?? "").length > 0 ? `Shuffle seed: ${o.seed}` : "",
	].filter(Boolean).join("\n")
}

/** Kept from the previous version, same name and shape. */
export function statsToCsv(result: SortResult, options: SortOptions): string {
	return [
		"Field,Value",
		`Unit,${options.unit}`,
		`By,${options.by}`,
		`Direction,${options.direction ?? (options.reverse ? "desc" : "asc")}`,
		`CaseInsensitive,${options.caseInsensitive ? "yes" : "no"}`,
		`RemoveDuplicates,${options.removeDuplicates ? "yes" : "no"}`,
		`InputCount,${result.inputCount}`,
		`OutputCount,${result.outputCount}`,
		`BlanksRemoved,${result.blanksRemoved}`,
		`DuplicatesRemoved,${result.duplicatesRemoved}`,
		`MovedCount,${result.movedCount}`,
		`Unparsed,${result.unparsedCount}`,
	].join("\n")
}

export function serialize(format: ExportFormat, result: SortResult, o: SortOptions): string {
	const receipt = buildReceipt(o)
	if (format === "txt") return `${result.output}\n\n${receipt}\n`
	if (format === "md") return `# Sorted list\n\n${result.items.map((it) => `- ${it.text}`).join("\n")}\n\n${receipt.split("\n").map((x) => `- ${x}`).join("\n")}\n`
	if (format === "json") return JSON.stringify({ tool: "text-sorter", options: o, summary: result.summary, header: result.header, items: result.items, receipt }, null, 2)
	if (format === "csv") {
		return ["position,original_position,value", ...result.items.map((it, i) => `${i + 1},${it.origin + 1},${csvCell(it.text)}`)].join("\n")
	}
	return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>Sorted list</title></head><body><h1>Sorted list</h1><p>${esc(result.summary)}</p><table border="0" cellpadding="4"><caption>Sorted items with their original position</caption><thead><tr><th scope="col">#</th><th scope="col">Was</th><th scope="col">Value</th></tr></thead><tbody>${result.items.map((it, i) => `<tr><td>${i + 1}</td><td>${it.origin + 1}</td><td>${esc(it.text)}</td></tr>`).join("")}</tbody></table><hr><pre>${esc(receipt)}</pre></body></html>\n`
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

/* ===== 10. Storage and hooks ===== */

const PREFIX = "unqtools:text-sorter"
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
		// Private mode or a full quota.
	}
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

export type HistoryEntry = { id: string; at: number; input: string; summary: string; pinned: boolean }

export function useHistory(): {
	entries: HistoryEntry[]
	add: (input: string, summary: string) => void
	togglePin: (id: string) => void
	remove: (id: string) => void
	clearAll: () => void
} {
	const [entries, setEntries] = usePersisted<HistoryEntry[]>("history", [])
	const add = useCallback((input: string, summary: string) => {
		if (input.trim().length === 0) return
		setEntries([
			{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: Date.now(), input: input.slice(0, 6000), summary, pinned: false },
			...entries,
		].sort((a, b) => Number(b.pinned) - Number(a.pinned)).slice(0, MAX_HISTORY))
	}, [entries, setEntries])
	return {
		entries,
		add,
		togglePin: (id) => setEntries(entries.map((e) => (e.id === id ? { ...e, pinned: !e.pinned } : e))),
		remove: (id) => setEntries(entries.filter((e) => e.id !== id)),
		clearAll: () => setEntries([]),
	}
}

export function useDraft(input: string): { draft: string | null; dismiss: () => void } {
	const [draft, setDraft] = useState<string | null>(null)
	useEffect(() => {
		const saved = readJson<{ at: number; input: string } | null>(`${PREFIX}:draft`, null)
		if (saved && Date.now() - saved.at < DRAFT_MAX_AGE && saved.input.trim().length > 0) setDraft(saved.input)
	}, [])
	useEffect(() => {
		const t = setTimeout(() => {
			if (input.length > 0 && input.length < 256_000) writeJson(`${PREFIX}:draft`, { at: Date.now(), input })
		}, 1200)
		return () => clearTimeout(t)
	}, [input])
	return { draft, dismiss: () => setDraft(null) }
}

export function useUndoRedo(value: string, setValue: (next: string) => void): { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean } {
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

export function useDebounced<T>(value: T, ms = 160): T {
	const [out, setOut] = useState(value)
	useEffect(() => {
		const t = setTimeout(() => setOut(value), ms)
		return () => clearTimeout(t)
	}, [value, ms])
	return out
}

/* ===== 11. Content ===== */

export const SAMPLES: ReadonlyArray<{ label: string; hint: string; text: string; options?: Partial<SortOptions> }> = [
	{ label: "Names", hint: "Try Sort by last word for surnames.", text: "Asha Rao\nbilal khan\nÉlodie Martin\nChen Wei\nAsha Rao\nzoe adams" },
	{ label: "Numbers", hint: "Mixed formats the old parser could not read.", text: "1e5\n$1,234.50\n-7\n42\n0.5\n1.234,50\nnot a number", options: { by: "numeric" } },
	{ label: "Versions", hint: "1.9.0 must come before 1.10.0.", text: "v1.10.0\nv1.9.0\nv1.2.10\nv1.2.2\nv2.0.0-beta", options: { by: "version" } },
	{ label: "CSV", hint: "A quoted comma inside a field.", text: 'name,score\n"Smith, John",42\n"O\u0027Neill, Ann",91\nChen,77', options: { unit: "csv-column", csvColumn: 1, by: "numeric", csvHasHeader: true } },
	{ label: "Messy list", hint: "Markers, blanks and duplicates.", text: "- pears\n\n- apples\n1. bananas\n- apples\n   - cherries\n", options: { stripMarkers: true, removeDuplicates: true } },
	{ label: "Mixed scripts", hint: "Change the locale and watch the order change.", text: "äpfel\napple\nångström\nzebra\nनमस्ते\nあさし" },
]

export type Preset = { id: string; label: string; description: string; values: Partial<SortOptions> }

export const PRESETS: readonly Preset[] = [
	{ id: "names", label: "Names A–Z", description: "Alphabetical, case and accent insensitive.", values: { by: "alphabetical", caseInsensitive: true, ignoreAccents: true, direction: "asc" } },
	{ id: "numbers", label: "Numbers", description: "Numeric, smallest first, unreadable values at the end.", values: { by: "numeric", direction: "asc" } },
	{ id: "versions", label: "Version numbers", description: "1.9.0 before 1.10.0.", values: { by: "version", direction: "asc" } },
	{ id: "csv", label: "CSV by column", description: "Quoted fields handled, header kept on top.", values: { unit: "csv-column", csvHasHeader: true, by: "alphabetical" } },
	{ id: "tidy", label: "Tidy a list", description: "Trim, drop blanks, remove duplicates, renumber.", values: { trimItems: true, keepEmpty: false, removeDuplicates: true, stripMarkers: true, renumber: true } },
	{ id: "shuffle", label: "Shuffle", description: "A real random order, seedable.", values: { by: "random" } },
]

export const HOW_TO: ReadonlyArray<{ name: string; text: string }> = [
	{ name: "Paste your list", text: "One item per line, or choose words, sentences, paragraphs, a comma list or a CSV column." },
	{ name: "Choose the order", text: "Alphabetical, numeric, natural, version, length, date, random and more, ascending or descending." },
	{ name: "Tidy while you sort", text: "Remove duplicates and blanks, trim, strip bullets, renumber, or hold back a header row." },
	{ name: "Take the result", text: "Copy it, or download it as TXT, Markdown, JSON, CSV or an HTML report." },
]

export const FAQ: ReadonlyArray<{ question: string; answer: string }> = [
	{ question: "Why did my shuffle barely change anything before?", answer: "The old version shuffled by comparing two items with a coin flip, which is not a valid way to compare and leaves items close to where they started. This version uses a Fisher\u2013Yates shuffle, where every order is equally likely." },
	{ question: "Can I reproduce a shuffle?", answer: "Yes. Type anything in the seed box. The same seed and the same list always give the same order, which is useful for a draw you need to justify later." },
	{ question: "What is natural order?", answer: "It reads runs of digits as numbers, so item2 comes before item10. Plain alphabetical order puts item10 first because 1 sorts before 2." },
	{ question: "Why is numeric sorting different from before?", answer: "The old version deleted every character that was not a digit, dot or minus, which turned 1e5 into 15 and a date into a year. This version reads the number a person would read, and tells you which items it could not read at all." },
	{ question: "How does it sort CSV rows?", answer: "It parses the row properly, so a comma inside a quoted field does not split it, and it can keep the header row at the top. Choose the column by its number, counting from zero." },
	{ question: "Why does changing the language change the order?", answer: "Languages disagree. In Swedish \u00e4 sorts after z; in German it sorts with a. Choosing a language tells the browser which convention to follow." },
	{ question: "Can I sort by more than one thing?", answer: "Yes. Add up to two more levels, each with its own key and direction, for example by length then alphabetically." },
	{ question: "Is my text uploaded?", answer: "No. Sorting happens in this browser tab, there is no network request in this tool, and it works offline." },
	{ question: "How long a list can it handle?", answer: "Five million characters. Above 250 KB it shows progress and can be stopped, and only the first part of a very long result is rendered while the full text stays available to copy or download." },
]

export const ALIASES: readonly string[] = [
	"text sorter", "sort lines alphabetically", "alphabetize a list", "sort list online",
	"natural sort", "sort numbers", "shuffle a list", "randomise a list",
	"sort csv by column", "remove duplicates and sort",
]

export const RELATED: ReadonlyArray<{ id: string; label: string; why: string }> = [
	{ id: "duplicate-lines-remover", label: "Remove Duplicate Lines", why: "When de-duplicating is the whole job." },
	{ id: "text-trimmer", label: "Text Trimmer", why: "Clean whitespace before sorting." },
	{ id: "diff-checker", label: "Diff Checker", why: "Compare the list before and after." },
	{ id: "csv-to-markdown", label: "CSV to Markdown", why: "Turn the sorted CSV into a table." },
]

export const ASSUMPTIONS: readonly string[] = [
	"Items the chosen key cannot read — a word in a numeric sort, for example — are placed at the end in their original order and counted, rather than being dropped or guessed at.",
	"Sorting is stable: items with the same key keep their original relative order.",
	"Date reading covers ISO dates, day/month/year and month/day/year where the numbers make the order unambiguous, and whatever else the browser recognises. Anything else is reported as unreadable.",
	"CSV rows are reordered whole; only the chosen column is compared.",
]

export const SHORTCUTS: ReadonlyArray<{ keys: string; label: string }> = [
	{ keys: "Ctrl/Cmd + Enter", label: "Sort now" },
	{ keys: "Ctrl/Cmd + Shift + C", label: "Copy the result" },
	{ keys: "Ctrl/Cmd + Shift + R", label: "Reverse the order" },
	{ keys: "Ctrl/Cmd + Shift + D", label: "Toggle remove duplicates" },
	{ keys: "?", label: "Show this list" },
	{ keys: "Esc", label: "Close a dialog" },
]
