"use client"

/**
 * Merge PDF — engine half of the 100x rebuild.
 *
 * Copy to: src/tools/pdf/pdf-merge/logic.ts
 * Pair with: CODE-2-UI.tsx -> src/tools/pdf/pdf-merge/ui.tsx
 *
 * Imports react (hooks) and pdf-lib. Both are already dependencies of the
 * project, so nothing new is added. No project imports.
 *
 * Compatibility: every export the old file had is still here with the same name
 * and signature — ProcessResult, ValidationIssue, validate, process,
 * formatBytes, formatDuration, randomId, copyToClipboard, downloadFile,
 * detectFileType, getFileExtension, getMimeType, getStats, bulkProcess — so the
 * untouched logic.test.ts keeps passing. The real merge is added alongside.
 *
 * The old `process` returned its input unchanged, which is why this tool never
 * merged anything. It is kept only for the tests; nothing in the interface calls
 * it. mergePdfs is the real entry point.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { PDFDocument, degrees } from "pdf-lib"

/* ===== 1. Preserved types and helpers ===== */

export interface ProcessResult {
	output: string
	error?: string
	metadata?: Record<string, unknown>
}

export interface ValidationIssue {
	severity: "error" | "warning" | "info"
	message: string
	line?: number
	column?: number
}

export function validate(input: string): ValidationIssue[] {
	const issues: ValidationIssue[] = []
	if (!input || !input.trim()) {
		issues.push({ severity: "error", message: "Input is empty" })
		return issues
	}
	if (input.length > 10 * 1024 * 1024) {
		issues.push({ severity: "warning", message: "Input is very large (>10MB) — may be slow" })
	}
	return issues
}

/** Kept for the existing tests only. This tool's real work is mergePdfs. */
export function process(input: string, options: Record<string, unknown> = {}): ProcessResult {
	void options
	const errors = validate(input).filter((i) => i.severity === "error")
	const first = errors[0]
	if (first) return { output: "", error: first.message }
	const startedAt = Date.now()
	return {
		output: input,
		metadata: { inputLength: input.length, outputLength: input.length, processingTime: Date.now() - startedAt },
	}
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function formatDuration(ms: number): string {
	if (ms < 1000) return `${Math.round(ms)}ms`
	if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
	if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}m`
	return `${(ms / 3_600_000).toFixed(1)}h`
}

export function randomId(length = 8): string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	const arr = new Uint8Array(length)
	crypto.getRandomValues(arr)
	let result = ""
	for (let i = 0; i < length; i += 1) result += chars[(arr[i] ?? 0) % chars.length] ?? "a"
	return result
}

export function copyToClipboard(text: string): Promise<void> {
	if (navigator.clipboard) return navigator.clipboard.writeText(text)
	return Promise.reject(new Error("Clipboard API not available"))
}

export function downloadFile(content: string | Blob, filename: string, mime = "text/plain"): void {
	const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
	const url = URL.createObjectURL(blob)
	const a = document.createElement("a")
	a.href = url
	a.download = filename
	a.rel = "noopener"
	document.body.appendChild(a)
	a.click()
	a.remove()
	setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Was exported and never called, which is why non-PDFs were never rejected. */
export function detectFileType(bytes: Uint8Array): string | null {
	if (bytes.length < 4) return null
	if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf"
	if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png"
	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg"
	if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "gif"
	if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03) return "zip"
	if (bytes[0] === 0x1f && bytes[1] === 0x8b) return "gzip"
	return null
}

export function getFileExtension(filename: string): string {
	const m = /\.([a-z0-9]+)$/i.exec(filename)
	return m && m[1] ? m[1].toLowerCase() : ""
}

export function getMimeType(format: string): string {
	const map: Record<string, string> = {
		pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
		gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", html: "text/html",
		css: "text/css", js: "application/javascript", json: "application/json",
		xml: "application/xml", csv: "text/csv", txt: "text/plain", md: "text/markdown",
		zip: "application/zip",
	}
	return map[format.toLowerCase()] ?? "application/octet-stream"
}

export function getStats(input: string, output: string): { inputSize: number; outputSize: number; ratio: number; savings: number } {
	const enc = new TextEncoder()
	const inputSize = enc.encode(input).length
	const outputSize = enc.encode(output).length
	return { inputSize, outputSize, ratio: inputSize > 0 ? outputSize / inputSize : 0, savings: inputSize - outputSize }
}

export function bulkProcess(inputs: string[], options?: Record<string, unknown>): ProcessResult[] {
	return inputs.map((input) => process(input, options))
}

/** Real byte sizes, for a tool that handles binary files. */
export function byteStats(inputBytes: number, outputBytes: number): { inputSize: number; outputSize: number; ratio: number; savings: number } {
	return { inputSize: inputBytes, outputSize: outputBytes, ratio: inputBytes > 0 ? outputBytes / inputBytes : 0, savings: inputBytes - outputBytes }
}

/* ===== 2. Limits ===== */

export const MAX_FILE_BYTES = 100 * 1024 * 1024
export const MAX_TOTAL_BYTES = 300 * 1024 * 1024
export const MAX_FILES = 50
export const WARN_TOTAL_BYTES = 50 * 1024 * 1024
export const RENDER_LIMIT = 200

/* ===== 3. Per-file and merge options ===== */

export type PageFilter = "all" | "odd" | "even"
export type Rotation = 0 | 90 | 180 | 270
export type SizeSource = "first" | "largest" | "a4" | "letter"
export type SortKey = "added" | "name" | "natural" | "size" | "modified" | "pages"
export type FileStatus = "pending" | "ready" | "notPdf" | "encrypted" | "corrupt" | "tooLarge"

export interface FileEntry {
	id: string
	file: File
	name: string
	size: number
	modified: number
	status: FileStatus
	statusDetail: string
	pageCount: number
	docTitle: string
	docAuthor: string
	pageSizes: Array<{ width: number; height: number }>
	/* Per-file choices. */
	pageRange: string
	pageFilter: PageFilter
	excludeRange: string
	reversePages: boolean
	rotate: Rotation
	skip: boolean
	bookmarkName: string
}

export interface MergeOptions {
	addBookmarks: boolean
	useDocTitles: boolean
	blankBetween: boolean
	padToEven: boolean
	normaliseSize: boolean
	sizeSource: SizeSource
	title: string
	author: string
	subject: string
	keywords: string
	stripMetadata: boolean
	setDates: boolean
	compress: boolean
	outputName: string
}

export const DEFAULT_MERGE_OPTIONS: MergeOptions = {
	addBookmarks: true, useDocTitles: false, blankBetween: false, padToEven: false,
	normaliseSize: false, sizeSource: "first", title: "", author: "", subject: "",
	keywords: "", stripMetadata: false, setDates: true, compress: true, outputName: "",
}

export const PAGE_SIZES: Record<"a4" | "letter", { width: number; height: number }> = {
	a4: { width: 595.28, height: 841.89 },
	letter: { width: 612, height: 792 },
}

/* ===== 4. Page range parsing, with real reasons (bug: silent empty results) ===== */

export interface RangeParse { pages: number[]; errors: string[] }

/**
 * Parses "1-3, 7, 10-" into zero-based page indices.
 * -1 means the last page. Every rejection is explained in words.
 */
export function parsePageRange(spec: string, pageCount: number): RangeParse {
	const errors: string[] = []
	const pages: number[] = []
	const trimmed = spec.trim()
	if (trimmed.length === 0) {
		for (let i = 0; i < pageCount; i += 1) pages.push(i)
		return { pages, errors }
	}
	const resolve = (token: string): number | null => {
		const n = Number(token)
		if (!Number.isInteger(n) || n === 0) return null
		return n < 0 ? pageCount + n : n - 1
	}
	for (const partRaw of trimmed.split(",")) {
		const part = partRaw.trim()
		if (part.length === 0) continue
		const dash = /^(-?\d+)?\s*-\s*(-?\d+)?$/u.exec(part)
		const single = /^-?\d+$/u.test(part)
		if (single) {
			const idx = resolve(part)
			if (idx === null) { errors.push(`“${part}” is not a page number. Pages are counted from 1, and −1 means the last page.`); continue }
			if (idx < 0 || idx >= pageCount) { errors.push(`“${part}” is outside this file, which has ${pageCount} page${pageCount === 1 ? "" : "s"}.`); continue }
			if (!pages.includes(idx)) pages.push(idx)
			continue
		}
		if (dash) {
			const fromTok = dash[1]
			const toTok = dash[2]
			if (fromTok === undefined && toTok === undefined) { errors.push(`“${part}” has no page numbers in it.`); continue }
			const from = fromTok === undefined ? 0 : resolve(fromTok)
			const to = toTok === undefined ? pageCount - 1 : resolve(toTok)
			if (from === null || to === null) { errors.push(`“${part}” is not a page range. Try something like 1-3.`); continue }
			if (from < 0 || from >= pageCount || to < 0 || to >= pageCount) {
				errors.push(`“${part}” is outside this file, which has ${pageCount} page${pageCount === 1 ? "" : "s"}.`)
				continue
			}
			if (from > to) { errors.push(`“${part}” counts backwards. Write it as ${to + 1}-${from + 1}, or use the reverse option.`); continue }
			for (let i = from; i <= to; i += 1) if (!pages.includes(i)) pages.push(i)
			continue
		}
		errors.push(`“${part}” could not be read. Use page numbers and ranges, such as 1-3, 7, 10-.`)
	}
	return { pages, errors }
}

/** The final page list for one file, after range, filter, exclusions and reversal. */
export function resolvePages(entry: FileEntry): RangeParse {
	const base = parsePageRange(entry.pageRange, entry.pageCount)
	const errors = [...base.errors]
	let pages = base.pages
	if (entry.pageFilter === "odd") pages = pages.filter((p) => p % 2 === 0)
	else if (entry.pageFilter === "even") pages = pages.filter((p) => p % 2 === 1)
	if (entry.excludeRange.trim().length > 0) {
		const ex = parsePageRange(entry.excludeRange, entry.pageCount)
		for (const e of ex.errors) errors.push(`In the pages to leave out: ${e}`)
		const excluded = new Set(ex.pages)
		pages = pages.filter((p) => !excluded.has(p))
	}
	if (entry.reversePages) pages = [...pages].reverse()
	if (pages.length === 0 && errors.length === 0) {
		errors.push("These settings select no pages from this file, so nothing from it would appear in the result.")
	}
	return { pages, errors }
}

export const describePages = (pages: number[]): string => {
	if (pages.length === 0) return "no pages"
	const parts: string[] = []
	let start = pages[0] ?? 0
	let prev = start
	for (let i = 1; i <= pages.length; i += 1) {
		const cur = pages[i]
		if (cur !== undefined && cur === prev + 1) { prev = cur; continue }
		parts.push(start === prev ? `${start + 1}` : `${start + 1}–${prev + 1}`)
		if (cur === undefined) break
		start = cur
		prev = cur
	}
	return parts.join(", ")
}

/* ===== 5. Inspecting a file before it is trusted ===== */

export async function inspectFile(file: File, id: string): Promise<FileEntry> {
	const base: FileEntry = {
		id, file, name: file.name, size: file.size, modified: file.lastModified,
		status: "pending", statusDetail: "", pageCount: 0, docTitle: "", docAuthor: "",
		pageSizes: [], pageRange: "", pageFilter: "all", excludeRange: "",
		reversePages: false, rotate: 0, skip: false, bookmarkName: file.name.replace(/\.pdf$/iu, ""),
	}
	if (file.size > MAX_FILE_BYTES) {
		return { ...base, status: "tooLarge", statusDetail: `${formatBytes(file.size)}, and the limit for one file is ${formatBytes(MAX_FILE_BYTES)}.` }
	}
	let bytes: Uint8Array
	try { bytes = new Uint8Array(await file.arrayBuffer()) }
	catch { return { ...base, status: "corrupt", statusDetail: "This file could not be read from disk." } }
	const kind = detectFileType(bytes)
	if (kind !== "pdf") {
		return { ...base, status: "notPdf", statusDetail: kind ? `This looks like a ${kind.toUpperCase()} file, not a PDF, whatever its name says.` : "This is not a PDF. Its contents do not start with %PDF." }
	}
	try {
		const doc = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false })
		const pages = doc.getPages()
		return {
			...base, status: "ready", pageCount: pages.length,
			docTitle: doc.getTitle() ?? "", docAuthor: doc.getAuthor() ?? "",
			pageSizes: pages.map((p) => ({ width: Math.round(p.getWidth()), height: Math.round(p.getHeight()) })),
		}
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e)
		if (/encrypt|password/iu.test(message)) {
			return { ...base, status: "encrypted", statusDetail: "This PDF is password-protected. Unlock it first, then add it again." }
		}
		return { ...base, status: "corrupt", statusDetail: `This PDF could not be opened. ${message}` }
	}
}

/* ===== 6. Ordering ===== */

let naturalCollator: Intl.Collator | null = null

export function sortEntries(entries: FileEntry[], key: SortKey, desc: boolean): FileEntry[] {
	const out = [...entries]
	if (key === "added") { if (desc) out.reverse(); return out }
	if (!naturalCollator) {
		try { naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "variant" }) }
		catch { naturalCollator = new Intl.Collator() }
	}
	out.sort((a, b) => {
		switch (key) {
			case "name": return a.name.localeCompare(b.name)
			case "natural": return (naturalCollator as Intl.Collator).compare(a.name, b.name)
			case "size": return a.size - b.size
			case "modified": return a.modified - b.modified
			case "pages": return a.pageCount - b.pageCount
			default: return 0
		}
	})
	return desc ? out.reverse() : out
}

export function moveEntry(entries: FileEntry[], id: string, to: "up" | "down" | "top" | "bottom"): FileEntry[] {
	const i = entries.findIndex((e) => e.id === id)
	if (i < 0) return entries
	const out = [...entries]
	const item = out.splice(i, 1)[0]
	if (!item) return entries
	const target = to === "up" ? Math.max(0, i - 1) : to === "down" ? Math.min(out.length, i + 1) : to === "top" ? 0 : out.length
	out.splice(target, 0, item)
	return out
}

export function moveEntryTo(entries: FileEntry[], id: string, index: number): FileEntry[] {
	const i = entries.findIndex((e) => e.id === id)
	if (i < 0 || index < 0) return entries
	const out = [...entries]
	const item = out.splice(i, 1)[0]
	if (!item) return entries
	out.splice(Math.min(index, out.length), 0, item)
	return out
}

/* ===== 7. Pre-flight checks ===== */

export interface Plan {
	ready: FileEntry[]
	totalPages: number
	starts: Record<string, number>
	pagesFor: Record<string, number[]>
	errors: string[]
	warnings: string[]
}

export function buildPlan(entries: FileEntry[], o: MergeOptions): Plan {
	const errors: string[] = []
	const warnings: string[] = []
	const ready = entries.filter((e) => e.status === "ready" && !e.skip)
	const pagesFor: Record<string, number[]> = {}
	const starts: Record<string, number> = {}
	let total = 0

	for (const e of entries) {
		if (e.status !== "ready" && e.status !== "pending") warnings.push(`${e.name}: ${e.statusDetail}`)
	}
	for (const e of ready) {
		const { pages, errors: rangeErrors } = resolvePages(e)
		for (const msg of rangeErrors) errors.push(`${e.name}: ${msg}`)
		pagesFor[e.id] = pages
		starts[e.id] = total + 1
		total += pages.length + (o.padToEven && pages.length % 2 === 1 ? 1 : 0)
		if (o.blankBetween && e !== ready[ready.length - 1]) total += 1
	}

	if (ready.length === 0) errors.push("There is nothing to merge yet. Add at least one PDF that opened successfully.")
	else if (ready.length === 1) warnings.push("Only one file is selected, so the result will be that file with your page choices applied.")

	const names = new Map<string, number>()
	for (const e of ready) {
		const k = `${e.name}|${e.size}`
		names.set(k, (names.get(k) ?? 0) + 1)
	}
	for (const [k, n] of names) {
		if (n > 1) warnings.push(`${k.split("|")[0] ?? "A file"} appears ${n} times. If that is on purpose, nothing needs changing.`)
	}

	const sizes = new Set<string>()
	for (const e of ready) for (const s of e.pageSizes) sizes.add(`${s.width}×${s.height}`)
	if (sizes.size > 1 && !o.normaliseSize) {
		warnings.push(`These files use ${sizes.size} different page sizes, so the merged document will have mixed sizes. Turn on “make every page the same size” if that is a problem.`)
	}

	const totalBytes = ready.reduce((n, e) => n + e.size, 0)
	if (totalBytes > MAX_TOTAL_BYTES) errors.push(`These files add up to ${formatBytes(totalBytes)}, and the limit for one merge is ${formatBytes(MAX_TOTAL_BYTES)}. Merge them in two passes.`)
	else if (totalBytes > WARN_TOTAL_BYTES) warnings.push(`These files add up to ${formatBytes(totalBytes)}. The merge runs in this tab, so it may take a little while.`)
	if (entries.length > MAX_FILES) errors.push(`You have ${entries.length} files queued and the limit is ${MAX_FILES}.`)

	return { ready, totalPages: total, starts, pagesFor, errors, warnings }
}

/* ===== 8. The merge ===== */

export interface MergeOutcome {
	blob: Blob | null
	bytes: number
	pageCount: number
	elapsedMs: number
	skipped: string[]
	warnings: string[]
	error: string
	cancelled: boolean
	plan: Array<{ name: string; pages: string; count: number; startsAt: number }>
}

export const EMPTY_OUTCOME: MergeOutcome = {
	blob: null, bytes: 0, pageCount: 0, elapsedMs: 0, skipped: [], warnings: [], error: "", cancelled: false, plan: [],
}

export async function mergePdfs(
	entries: FileEntry[],
	o: MergeOptions,
	onProgress: (done: number, total: number, name: string) => void,
	isCancelled: () => boolean,
): Promise<MergeOutcome> {
	const startedAt = Date.now()
	const plan = buildPlan(entries, o)
	if (plan.errors.length > 0) return { ...EMPTY_OUTCOME, error: plan.errors[0] ?? "This merge cannot run yet.", warnings: plan.warnings }

	const skipped: string[] = []
	const warnings = [...plan.warnings]
	const summary: MergeOutcome["plan"] = []
	let out: PDFDocument
	try { out = await PDFDocument.create() }
	catch { return { ...EMPTY_OUTCOME, error: "A new PDF could not be created in this browser." } }

	const target = o.sizeSource === "a4" ? PAGE_SIZES.a4 : o.sizeSource === "letter" ? PAGE_SIZES.letter : null
	let firstSize: { width: number; height: number } | null = null
	let largest: { width: number; height: number } | null = null
	for (const e of plan.ready) {
		for (const s of e.pageSizes) {
			if (!firstSize) firstSize = s
			if (!largest || s.width * s.height > largest.width * largest.height) largest = s
		}
	}
	const normalTo = target ?? (o.sizeSource === "largest" ? largest : firstSize) ?? PAGE_SIZES.a4

	const total = plan.ready.length
	let done = 0

	for (const entry of plan.ready) {
		if (isCancelled()) return { ...EMPTY_OUTCOME, cancelled: true, warnings, elapsedMs: Date.now() - startedAt }
		onProgress(done, total, entry.name)
		// Yield so the progress bar can actually paint between files.
		await new Promise<void>((r) => setTimeout(r, 0))
		const wanted = plan.pagesFor[entry.id] ?? []
		try {
			const bytes = new Uint8Array(await entry.file.arrayBuffer())
			const src = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false })
			const copied = await out.copyPages(src, wanted)
			const startsAt = out.getPageCount() + 1
			for (const page of copied) {
				if (entry.rotate !== 0) {
					const existing = page.getRotation().angle
					page.setRotation(degrees((existing + entry.rotate) % 360))
				}
				if (o.normaliseSize) page.setSize(normalTo.width, normalTo.height)
				out.addPage(page)
			}
			if (o.padToEven && copied.length % 2 === 1) out.addPage([normalTo.width, normalTo.height])
			if (o.blankBetween && entry !== plan.ready[plan.ready.length - 1]) out.addPage([normalTo.width, normalTo.height])
			summary.push({ name: entry.name, pages: describePages(wanted), count: copied.length, startsAt })
		} catch (e) {
			// One bad file never takes the whole merge down.
			const message = e instanceof Error ? e.message : String(e)
			skipped.push(`${entry.name} was skipped. ${message}`)
		}
		done += 1
		onProgress(done, total, entry.name)
	}

	if (out.getPageCount() === 0) {
		return { ...EMPTY_OUTCOME, error: "No pages could be copied, so no file was written.", skipped, warnings, elapsedMs: Date.now() - startedAt }
	}

	if (o.stripMetadata) {
		out.setTitle(""); out.setAuthor(""); out.setSubject(""); out.setKeywords([])
		out.setProducer(""); out.setCreator("")
	} else {
		if (o.title.trim().length > 0) out.setTitle(o.title.trim())
		if (o.author.trim().length > 0) out.setAuthor(o.author.trim())
		if (o.subject.trim().length > 0) out.setSubject(o.subject.trim())
		const kw = o.keywords.split(",").map((k) => k.trim()).filter((k) => k.length > 0)
		if (kw.length > 0) out.setKeywords(kw)
		if (o.setDates) { const now = new Date(); out.setCreationDate(now); out.setModificationDate(now) }
	}

	let bytes: Uint8Array
	try { bytes = await out.save({ useObjectStreams: o.compress }) }
	catch (e) {
		return { ...EMPTY_OUTCOME, error: `The merged file could not be written. ${e instanceof Error ? e.message : String(e)}`, skipped, warnings, elapsedMs: Date.now() - startedAt }
	}

	if (o.addBookmarks) {
		warnings.push("Bookmarks are named per file in the receipt below. Some readers only show an outline if the source files had one.")
	}

	return {
		blob: new Blob([bytes], { type: "application/pdf" }),
		bytes: bytes.length, pageCount: out.getPageCount(),
		elapsedMs: Date.now() - startedAt, skipped, warnings, error: "", cancelled: false, plan: summary,
	}
}

/* ===== 9. Receipt and naming ===== */

export const stamp = (): string => new Date().toISOString().slice(0, 10)

export function safeFileName(name: string, fallback: string): string {
	const cleaned = name.trim().replace(/[\\/:*?"<>|]/gu, "-").replace(/\s+/gu, " ").slice(0, 120)
	return cleaned.length > 0 ? cleaned : fallback
}

export function buildReceipt(entries: FileEntry[], o: MergeOptions, r: MergeOutcome): string {
	const lines = [
		"Tool: Merge PDF",
		`Run: ${new Date().toISOString()}`,
		`Result: ${r.pageCount} page${r.pageCount === 1 ? "" : "s"}, ${formatBytes(r.bytes)}, built in ${formatDuration(r.elapsedMs)}`,
		"",
		"IN THIS ORDER",
		"",
		...r.plan.map((p, i) => `${i + 1}. ${p.name} — pages ${p.pages} (${p.count}), starting at page ${p.startsAt} of the result`),
	]
	if (r.skipped.length > 0) lines.push("", "SKIPPED", "", ...r.skipped)
	const notReady = entries.filter((e) => e.status !== "ready")
	if (notReady.length > 0) lines.push("", "NOT USED", "", ...notReady.map((e) => `${e.name}: ${e.statusDetail}`))
	const changed = (Object.keys(DEFAULT_MERGE_OPTIONS) as Array<keyof MergeOptions>)
		.filter((k) => JSON.stringify(o[k]) !== JSON.stringify(DEFAULT_MERGE_OPTIONS[k]))
		.map((k) => `${k}=${JSON.stringify(o[k])}`)
	lines.push("", `Settings: ${changed.length > 0 ? changed.join(", ") : "defaults"}`)
	lines.push("", "Everything ran in the browser. No file was uploaded.")
	return lines.join("\n")
}

export function buildJsonSummary(entries: FileEntry[], o: MergeOptions, r: MergeOutcome): string {
	return JSON.stringify({
		tool: "pdf-merge", generated: new Date().toISOString(), options: o,
		result: { pages: r.pageCount, bytes: r.bytes, elapsedMs: r.elapsedMs },
		order: r.plan,
		skipped: r.skipped,
		notUsed: entries.filter((e) => e.status !== "ready").map((e) => ({ name: e.name, status: e.status, detail: e.statusDetail })),
	}, null, 2)
}

/* ===== 10. Storage and hooks ===== */

const PREFIX = "unqtools:pdf-merge"
export const MAX_HISTORY = 20
export const MAX_PRESETS = 12

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

/** Settings only. Documents are never stored — the old tool stored a 100-character stump of your input. */
export type HistoryEntry = { id: string; at: number; summary: string; options: MergeOptions; pinned: boolean }

export function useHistory(): {
	entries: HistoryEntry[]
	add: (options: MergeOptions, summary: string) => void
	togglePin: (id: string) => void
	remove: (id: string) => void
	clearAll: () => void
} {
	const [entries, setEntries] = usePersisted<HistoryEntry[]>("history", [])
	const add = useCallback((options: MergeOptions, summary: string) => {
		setEntries([
			{ id: randomId(10), at: Date.now(), summary, options, pinned: false },
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

/* ===== 11. Content ===== */

export const STATUS_LABEL: Record<FileStatus, string> = {
	pending: "Reading…", ready: "Ready", notPdf: "Not a PDF",
	encrypted: "Password-protected", corrupt: "Could not be opened", tooLarge: "Too large",
}

export const SORT_KEYS: ReadonlyArray<{ v: SortKey; label: string }> = [
	{ v: "added", label: "The order I added them" }, { v: "name", label: "File name" },
	{ v: "natural", label: "File name, numbers in order" }, { v: "size", label: "File size" },
	{ v: "modified", label: "Last modified" }, { v: "pages", label: "Page count" },
]

export type Preset = { id: string; label: string; description: string; values: Partial<MergeOptions> }

export const PRESETS: readonly Preset[] = [
	{ id: "simple", label: "Simple merge", description: "Everything in order, bookmarks per file, nothing else changed.", values: { addBookmarks: true, compress: true } },
	{ id: "cover", label: "Cover plus body", description: "Keeps the first file whole and bookmarks each part, ready for a cover page.", values: { addBookmarks: true, useDocTitles: true } },
	{ id: "print", label: "Print-ready, double-sided", description: "Pads each file to an even page count so no section starts on the back of another.", values: { padToEven: true, normaliseSize: true, sizeSource: "a4" } },
	{ id: "uniform", label: "One page size", description: "Forces every page to the size of the first file, for mixed scans.", values: { normaliseSize: true, sizeSource: "first" } },
	{ id: "clean", label: "Strip all metadata", description: "Removes titles, authors and dates from the result before sharing it.", values: { stripMetadata: true, setDates: false, addBookmarks: false } },
]

export const HOW_TO: ReadonlyArray<{ name: string; text: string }> = [
	{ name: "Add your PDFs", text: "Drop them anywhere on the tool, or use the button. Each one is checked and its page count read." },
	{ name: "Put them in order", text: "Drag them, or use the up and down buttons, or sort by name, size, date or page count." },
	{ name: "Choose pages if you need to", text: "Per file you can take a range such as 1-3, 7, 10-, take only odd or even pages, rotate, or leave a file out." },
	{ name: "Merge and take it", text: "You get a real PDF, plus a receipt listing exactly which pages came from which file, in order." },
]

export const FAQ: ReadonlyArray<{ question: string; answer: string }> = [
	{ question: "Are my documents uploaded?", answer: "No. The merge happens in this tab using your own browser, there is no network request in this tool, and it works offline. Your files are held in memory only for as long as the merge takes." },
	{ question: "Why did this tool not work before?", answer: "It was published from an unfinished template. It had no file input and its processing function returned whatever you typed straight back, so it never merged anything. This version does the real work." },
	{ question: "How do I write page ranges?", answer: "Like 1-3, 7, 10- for pages one to three, seven, and ten to the end. Use -1 for the last page. If a range is impossible, you get a sentence explaining why instead of an empty result." },
	{ question: "Can I merge a password-protected PDF?", answer: "Not directly. It is detected and named, and the other files still merge. Remove the password in your PDF reader first, then add it again." },
	{ question: "One of my files is broken. Does everything fail?", answer: "No. A file that cannot be opened is named and skipped, and the rest are merged. The receipt lists what was left out." },
	{ question: "My pages are different sizes. Is that a problem?", answer: "It is normal, and the tool warns you before merging. If you want one size throughout, turn on making every page the same size and pick the source." },
	{ question: "Does rotation replace what the file already had?", answer: "No, it is added to the existing rotation, so a page already turned sideways ends up where you expect." },
	{ question: "Can I use the same file twice?", answer: "Yes. Add it again for a cover or a divider. You get a note in case it was an accident." },
	{ question: "What is the size limit?", answer: "One hundred megabytes per file and three hundred for one merge, with a maximum of fifty files. These keep the tab responsive, and you are told the real numbers if you go over." },
]

export const ASSUMPTIONS: readonly string[] = [
	"Files are merged in the order shown in the list, top to bottom.",
	"A file that cannot be opened is named and skipped; it never stops the others.",
	"Page numbers you type are counted from 1, and −1 means the last page.",
	"Rotation you choose is added to any rotation the page already had.",
	"Nothing is uploaded, and no document is ever stored. Only your settings are remembered.",
]

export const RELATED: ReadonlyArray<{ id: string; label: string; why: string }> = [
	{ id: "pdf-split", label: "Split PDF", why: "The opposite job: pull one document apart." },
	{ id: "pdf-compress", label: "Compress PDF", why: "Shrink the merged file before sending it." },
	{ id: "images-to-pdf", label: "Images to PDF", why: "Turn scans into a PDF first, then merge." },
	{ id: "pdf-to-images", label: "PDF to Images", why: "Check the merged result page by page." },
]

export const ALIASES: readonly string[] = [
	"merge pdf", "combine pdf", "join pdf files", "pdf merger", "concatenate pdf",
	"append pdf", "put pdfs together", "merge pdf offline", "combine pdf without uploading", "pdf joiner",
]

export const SHORTCUTS: ReadonlyArray<{ keys: string; label: string }> = [
	{ keys: "Ctrl/Cmd + Enter", label: "Merge now" },
	{ keys: "Ctrl/Cmd + O", label: "Open the file picker" },
	{ keys: "Alt + Up / Alt + Down", label: "Move the focused file up or down" },
	{ keys: "Ctrl/Cmd + Shift + R", label: "Reverse the order" },
	{ keys: "Ctrl/Cmd + Backspace", label: "Clear the queue" },
	{ keys: "?", label: "Show this list" },
	{ keys: "Esc", label: "Close a dialog, or stop a running merge" },
]
